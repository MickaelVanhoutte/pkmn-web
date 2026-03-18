import Phaser from 'phaser';
import {
  gridToScreen,
  screenToGrid,
  TILE_W,
  TILE_IMG_H,
  TILE_HALF_W,
  TILE_HALF_H,
  TILE_ORIGIN_Y,
  RENDER_SCALE,
} from './iso-math';
import { TEST_MAP, isWalkable, getTileHeight } from './map-data';
import type { MapData } from './map-data';
import {
  createPlayer,
  updatePlayer,
  movePlayerStep,
  setPlayerPath,
  getPlayerScreenPos,
} from './player';
import type { PlayerState, Direction } from './player';
import { findPath } from './pathfinder';
import { TILE_META, getTileMetaMap } from './tile-registry';
import type { TileDef } from './tile-registry';
import { ParticleManager } from './particles';
import { TimeSystem } from './time-system';
import { LightingManager } from './lighting';
import { VignettePipeline } from './effects/VignettePipeline';
import { WaterPipeline } from './effects/WaterPipeline';

const DIR_DELTAS: Record<Direction, { dc: number; dr: number }> = {
  up: { dc: 0, dr: -1 },
  down: { dc: 0, dr: 1 },
  left: { dc: -1, dr: 0 },
  right: { dc: 1, dr: 0 },
};

/** Cliff face colors per tile type */
const CLIFF_COLORS: Record<string, { left: number; right: number }> = {
  // Grass tiles
  'tile_027': { left: 0x4a8a3a, right: 0x3a7a2a },
  'tile_028': { left: 0x4a8a3a, right: 0x3a7a2a },
  'tile_037': { left: 0x6aaa4a, right: 0x5a9a3a },
  'tile_040': { left: 0x3a6a2a, right: 0x2a5a1a },
  // Earth/dirt tiles
  'tile_000': { left: 0x6a4a3a, right: 0x5a3a2a },
  'tile_005': { left: 0x7a5a4a, right: 0x6a4a3a },
  'tile_010': { left: 0x8a6a3a, right: 0x6a5a2a },
  'tile_014': { left: 0x7a5a3a, right: 0x6a4a2a },
  'tile_025': { left: 0x7a5a4a, right: 0x6a4a3a },
  // Stone tiles
  'tile_011': { left: 0x8a8a7a, right: 0x6a6a5a },
  'tile_026': { left: 0x5a7a3a, right: 0x4a6a2a },
};
const DEFAULT_CLIFF = { left: 0x6a6a5a, right: 0x5a5a4a };

/** Decoration tiles that should sway (bushes/trees, not rocks) */
const SWAY_TILES = new Set([
  'tile_029', 'tile_030', 'tile_031', 'tile_032', 'tile_033',
  'tile_034', 'tile_035', 'tile_036',
  'tile_045',
]);

/**
 * 8-direction spritesheet mapping for isometric view.
 * Sheet: 8 cols (directions) × 12 rows (3 chars × 4 rows each, 16×24 frames).
 * Character 3 (orange): rows 8–11.
 *   Row 8: arrows, Rows 9–11: the "3 last rows" (idle + 2 walk frames).
 * Diagonal columns (0-indexed): 1=SW, 3=NW, 5=NE, 7=SE.
 * Iso mapping: game-down→SW, game-left→NW, game-up→NE, game-right→SE.
 */
const CHAR_ROW_OFFSET = 8; // character 3 starts at row 8
const SHEET_COLS = 8;
const ISO_DIR_COL: Record<Direction, number> = {
  down: 5,  // NE → faces toward camera when moving down
  left: 7,  // SE → faces left when moving left
  up: 1,    // SW → faces away when moving up
  right: 3, // NW → faces right when moving right
};
const IDLE_ROW = CHAR_ROW_OFFSET + 2;    // row 10 (both feet on ground)
const WALK_ROWS = [CHAR_ROW_OFFSET + 1, CHAR_ROW_OFFSET + 2, CHAR_ROW_OFFSET + 3]; // rows 9,10,11

export class OverworldScene extends Phaser.Scene {
  private map!: MapData;
  private player!: PlayerState;
  private tileMetaMap!: Map<string, TileDef>;

  private playerSprite!: Phaser.GameObjects.Sprite;
  private hoverGraphic!: Phaser.GameObjects.Graphics;
  private cameraTarget!: Phaser.GameObjects.Zone;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

  private queuedDirection: Direction | null = null;

  private particles!: ParticleManager;
  private timeSystem!: TimeSystem;
  private lighting!: LightingManager;
  private footstepEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private wasMoving = false;

  constructor() {
    super({ key: 'OverworldScene' });
  }

  preload(): void {
    const basePath = import.meta.env.BASE_URL;

    // Terrain tiles
    for (const id of Object.keys(TILE_META)) {
      this.load.image(id, `${basePath}terrain/${id}.png`);
    }

    // 8-direction character spritesheet (128×288 = 8 cols × 12 rows of 16×24 frames)
    this.load.spritesheet('player-sheet', `${basePath}characters/8d-characters.png`, {
      frameWidth: 16,
      frameHeight: 24,
    });
  }

  create(): void {
    this.map = TEST_MAP;
    this.tileMetaMap = getTileMetaMap();
    this.player = createPlayer(this.map.playerStart.col, this.map.playerStart.row);
    this.queuedDirection = null;

    // Register water pipeline before building the map
    if (this.renderer.type === Phaser.WEBGL) {
      (this.renderer as Phaser.Renderer.WebGL.WebGLRenderer).pipelines.add('WaterPipeline', new WaterPipeline(this.game));
    }

    this.createCharacterAnimations();
    this.buildMap();
    this.createPlayerSprite();
    this.createHoverHighlight();
    this.setupCamera();
    this.setupInput();

    // Atmospheric systems
    this.timeSystem = new TimeSystem();
    this.particles = new ParticleManager(this);
    this.lighting = new LightingManager(this, this.timeSystem);

    // Footstep dust emitter
    this.createFootstepEmitter();

    // Apply vignette to camera
    if (this.renderer.type === Phaser.WEBGL) {
      this.cameras.main.setPostPipeline(VignettePipeline);
    }

    // Fade in
    this.cameras.main.fadeIn(500, 26, 26, 46);

    // Debug access (dev only)
    if (import.meta.env.DEV) {
      (window as any).__scene = this;
    }
  }

  update(_time: number, delta: number): void {
    const dt = delta / 1000;

    this.handleMovementInput();
    updatePlayer(this.player, dt);
    this.updatePlayerSprite();
    this.emitFootstepDust();

    // Atmospheric systems
    this.timeSystem.update(dt);
    this.particles.setNight(this.timeSystem.isNight());
    this.particles.update();

    const pos = getPlayerScreenPos(this.player, this.map);
    this.lighting.setPlayerPosition(pos.x, pos.y);
    this.lighting.update(dt);
  }

  // ── Character Animations ─────────────────────────────────────

  private createCharacterAnimations(): void {
    const directions: Direction[] = ['down', 'left', 'up', 'right'];

    for (const dir of directions) {
      const col = ISO_DIR_COL[dir];

      // Walk: 3 frames from the last 3 rows of the character block
      const walkFrames = WALK_ROWS.map(row => ({
        key: 'player-sheet',
        frame: row * SHEET_COLS + col,
      }));
      this.anims.create({
        key: `walk-${dir}`,
        frames: walkFrames,
        frameRate: 8,
        repeat: -1,
      });

      // Idle: single frame from the idle row
      this.anims.create({
        key: `idle-${dir}`,
        frames: [{ key: 'player-sheet', frame: IDLE_ROW * SHEET_COLS + col }],
        frameRate: 1,
      });
    }
  }

  // ── Map Building ──────────────────────────────────────────────

  private buildMap(): void {
    const { map } = this;

    for (let row = 0; row < map.height; row++) {
      for (let col = 0; col < map.width; col++) {
        const cell = map.tiles[row][col];
        const height = cell.height ?? 0;
        const screen = gridToScreen(col, row);
        const elevOffset = height * TILE_HALF_H;

        // Cliff faces (behind the tile surface)
        if (height > 0) {
          this.drawCliffFace(screen.x, screen.y, elevOffset, cell.base, row, col);
        }

        // Base tile sprite
        const tileId = cell.base;
        if (this.textures.exists(tileId)) {
          const sprite = this.add.sprite(screen.x, screen.y - elevOffset, tileId);
          sprite.setOrigin(TILE_HALF_W / TILE_W, TILE_ORIGIN_Y / TILE_IMG_H);
          sprite.setDepth(row * 1000 + col * 10 + 1);

          // Apply water shader
          if (tileId === 'tile_114') {
            sprite.setPipeline('WaterPipeline');
          }
        }

        // Decoration sprite
        if (cell.decoration && this.textures.exists(cell.decoration)) {
          const decMeta = TILE_META[cell.decoration];
          const anchorY = decMeta?.footY ?? TILE_ORIGIN_Y;
          const decSprite = this.add.sprite(screen.x, screen.y - elevOffset, cell.decoration);
          decSprite.setOrigin(TILE_HALF_W / TILE_W, anchorY / TILE_IMG_H);
          // Decorations render after all entities on their row
          decSprite.setDepth((row + 1) * 1000 - 10 + col * 0.1);

          // Subtle sway animation for bushes only (not rocks)
          if (SWAY_TILES.has(cell.decoration)) {
            const phase = (row * 7 + col * 13) % 100;
            this.tweens.add({
              targets: decSprite,
              angle: { from: -1.5, to: 1.5 },
              duration: 2500 + phase * 20,
              ease: 'Sine.easeInOut',
              yoyo: true,
              repeat: -1,
              delay: phase * 30,
            });
          }
        }
      }
    }
  }

  private drawCliffFace(
    sx: number,
    sy: number,
    elevOffset: number,
    baseTileId: string,
    row: number,
    col: number,
  ): void {
    const colors = CLIFF_COLORS[baseTileId] ?? DEFAULT_CLIFF;
    const g = this.add.graphics();
    g.setDepth(row * 1000 + col * 10); // just behind the tile surface

    // Left face
    g.fillStyle(colors.left, 1);
    g.beginPath();
    g.moveTo(sx - TILE_HALF_W, sy - elevOffset);
    g.lineTo(sx, sy + TILE_HALF_H - elevOffset);
    g.lineTo(sx, sy + TILE_HALF_H);
    g.lineTo(sx - TILE_HALF_W, sy);
    g.closePath();
    g.fillPath();

    // Right face
    g.fillStyle(colors.right, 1);
    g.beginPath();
    g.moveTo(sx, sy + TILE_HALF_H - elevOffset);
    g.lineTo(sx + TILE_HALF_W, sy - elevOffset);
    g.lineTo(sx + TILE_HALF_W, sy);
    g.lineTo(sx, sy + TILE_HALF_H);
    g.closePath();
    g.fillPath();
  }

  // ── Player ────────────────────────────────────────────────────

  private createPlayerSprite(): void {
    const pos = getPlayerScreenPos(this.player, this.map);
    const idleFrame = IDLE_ROW * SHEET_COLS + ISO_DIR_COL['down'];

    this.playerSprite = this.add.sprite(pos.x, pos.y, 'player-sheet', idleFrame);
    // Origin: horizontally centered, vertically anchored near feet
    this.playerSprite.setOrigin(0.5, 0.9);
    this.playerSprite.setDepth(this.player.row * 1000 + this.player.col * 10 + 5);
    this.playerSprite.play('idle-down');
  }

  private updatePlayerSprite(): void {
    const pos = getPlayerScreenPos(this.player, this.map);
    this.playerSprite.setPosition(pos.x, pos.y);

    const sourceDepth = this.player.prevRow * 1000 + this.player.prevCol * 10;
    const destDepth = this.player.row * 1000 + this.player.col * 10;
    this.playerSprite.setDepth(Math.max(sourceDepth, destDepth) + 5);

    // Switch animation based on movement state and direction
    const dir = this.player.direction;
    const isMoving = this.player.isMoving && this.player.moveProgress < 1;

    if (isMoving) {
      const walkKey = `walk-${dir}`;
      if (this.playerSprite.anims.currentAnim?.key !== walkKey) {
        this.playerSprite.play(walkKey);
      }
    } else {
      const idleKey = `idle-${dir}`;
      const currentAnimKey = this.playerSprite.anims.currentAnim?.key;
      if (currentAnimKey?.startsWith('walk-')) {
        // Let walk cycle finish to neutral frame (both feet down) before switching to idle
        if (this.playerSprite.anims.isPlaying) {
          this.playerSprite.anims.stopOnFrame(this.playerSprite.anims.currentAnim!.frames[1]);
        } else {
          this.playerSprite.play(idleKey);
        }
      } else if (currentAnimKey !== idleKey) {
        this.playerSprite.play(idleKey);
      }
    }

    // Camera target follows player
    this.cameraTarget.setPosition(pos.x, pos.y);
  }

  // ── Hover Highlight ───────────────────────────────────────────

  private createHoverHighlight(): void {
    this.hoverGraphic = this.add.graphics();
    this.hoverGraphic.fillStyle(0xffffff, 0.2);
    this.hoverGraphic.beginPath();
    this.hoverGraphic.moveTo(0, -TILE_HALF_H);
    this.hoverGraphic.lineTo(TILE_HALF_W, 0);
    this.hoverGraphic.lineTo(0, TILE_HALF_H);
    this.hoverGraphic.lineTo(-TILE_HALF_W, 0);
    this.hoverGraphic.closePath();
    this.hoverGraphic.fillPath();
    this.hoverGraphic.setVisible(false);
  }

  // ── Camera ────────────────────────────────────────────────────

  private setupCamera(): void {
    this.cameraTarget = this.add.zone(0, 0, 1, 1);

    const pos = getPlayerScreenPos(this.player, this.map);
    this.cameraTarget.setPosition(pos.x, pos.y);

    const cam = this.cameras.main;
    cam.setZoom(RENDER_SCALE);
    cam.startFollow(this.cameraTarget, true, 0.12, 0.12);
  }

  // ── Input ─────────────────────────────────────────────────────

  private setupInput(): void {
    this.cursors = this.input.keyboard!.createCursorKeys();

    this.input.keyboard!.on('keydown', (event: KeyboardEvent) => {
      const dir = this.arrowToDir(event.key);
      if (dir) this.queuedDirection = dir;
    });

    // Click-to-move
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      const grid = screenToGrid(pointer.worldX, pointer.worldY, 0, 0);

      if (grid.col < 0 || grid.row < 0 || grid.col >= this.map.width || grid.row >= this.map.height) return;
      if (!isWalkable(this.map, grid.col, grid.row, this.tileMetaMap)) return;

      const path = findPath(this.map, this.player.col, this.player.row, grid.col, grid.row, this.tileMetaMap);
      if (path && path.length > 0) {
        setPlayerPath(this.player, path);
      }
    });

    // Hover highlight
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      const grid = screenToGrid(pointer.worldX, pointer.worldY, 0, 0);

      if (grid.col >= 0 && grid.row >= 0 && grid.col < this.map.width && grid.row < this.map.height) {
        const screen = gridToScreen(grid.col, grid.row);
        const h = getTileHeight(this.map, grid.col, grid.row);
        this.hoverGraphic.setPosition(screen.x, screen.y - h * TILE_HALF_H);
        this.hoverGraphic.setDepth(grid.row * 1000 + grid.col * 10 + 2);
        this.hoverGraphic.setVisible(true);
      } else {
        this.hoverGraphic.setVisible(false);
      }
    });

    this.input.on('pointerout', () => {
      this.hoverGraphic.setVisible(false);
    });
  }

  private handleMovementInput(): void {
    let dir: Direction | null = null;
    if (this.cursors.up.isDown) dir = 'up';
    else if (this.cursors.down.isDown) dir = 'down';
    else if (this.cursors.left.isDown) dir = 'left';
    else if (this.cursors.right.isDown) dir = 'right';

    const moveDir = dir ?? this.queuedDirection;
    if (moveDir) {
      const delta = DIR_DELTAS[moveDir];
      movePlayerStep(this.player, delta.dc, delta.dr, this.map, this.tileMetaMap);
      this.queuedDirection = null;
    }
  }

  private arrowToDir(key: string): Direction | null {
    switch (key) {
      case 'ArrowUp': return 'up';
      case 'ArrowDown': return 'down';
      case 'ArrowLeft': return 'left';
      case 'ArrowRight': return 'right';
      default: return null;
    }
  }

  // ── Footstep Dust ────────────────────────────────────────────

  private createFootstepEmitter(): void {
    // Generate tiny dust texture
    if (!this.textures.exists('particle-footstep')) {
      const g = this.add.graphics();
      g.fillStyle(0xc4a060, 1);
      g.fillCircle(1, 1, 1);
      g.generateTexture('particle-footstep', 3, 3);
      g.destroy();
    }

    this.footstepEmitter = this.add.particles(0, 0, 'particle-footstep', {
      lifespan: { min: 300, max: 600 },
      speed: { min: 5, max: 15 },
      angle: { min: 200, max: 340 },
      scale: { start: 1.2, end: 0.3 },
      alpha: { start: 0.5, end: 0 },
      frequency: -1, // manual burst only
      blendMode: Phaser.BlendModes.NORMAL,
      emitting: false,
    });
    this.footstepEmitter.setDepth(50000);
  }

  private emitFootstepDust(): void {
    const isMoving = this.player.moveProgress > 0 && this.player.moveProgress < 1;

    if (isMoving && !this.wasMoving) {
      // Emit puff at player position when movement starts
      const pos = getPlayerScreenPos(this.player, this.map);
      this.footstepEmitter.setPosition(pos.x, pos.y);
      this.footstepEmitter.explode(3);
    }

    this.wasMoving = isMoving;
  }
}
