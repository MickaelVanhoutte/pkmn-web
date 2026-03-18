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
import { TEST_MAP, isWalkable, isEncounterTile, getTileHeight, TALL_GRASS_TILES } from './map-data';
import type { MapData } from './map-data';
import { generateWildPokemon, buildWildBattleConfig } from './wild-encounter';
import { playBattleTransition } from './battle-transitions';
import type { PokemonConfig } from '@/types/pokemon';
import type { NavigateFn } from '../main';
import { audioManager } from '../util/audio';
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
import { IS_DEBUG } from '../util/debug';
import type { DebugTimeControllerComponent } from '../components/debug-time-controller';

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

/** Wild Pokemon spawn config */
const SPAWN_INTERVAL_MS = 30_000;  // try to spawn every 30s
const SPAWN_LIFETIME_MS = 60_000;  // despawn after 1 minute
const MAX_SPAWNS = 3;
const SPAWN_TINT = 0xaaffaa;       // brighter tint for active spawn bush

interface WildSpawn {
  col: number;
  row: number;
  pokemon: PokemonConfig;
  shakeTimer: Phaser.Time.TimerEvent; // periodic shake bursts
  despawnTimer: Phaser.Time.TimerEvent;
}

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
  private leafEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private wasMoving = false;

  // Navigation (injected via game registry)
  private navigate!: NavigateFn;

  // Wild encounter spawn system
  private decorationSprites!: (Phaser.GameObjects.Sprite | null)[][];
  private spawns: WildSpawn[] = [];
  private encounterTiles: Array<{ col: number; row: number }> = [];
  private encounterPending = false;
  private lastCheckedCol = -1;
  private lastCheckedRow = -1;

  private debugTimeCtrl: DebugTimeControllerComponent | null = null;

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
    // Retrieve navigate function and optional saved position from game registry
    this.navigate = this.game.registry.get('navigate') as NavigateFn;
    const savedPos = this.game.registry.get('playerPosition') as { col: number; row: number } | undefined;

    this.map = TEST_MAP;
    this.tileMetaMap = getTileMetaMap();

    const startCol = savedPos?.col ?? this.map.playerStart.col;
    const startRow = savedPos?.row ?? this.map.playerStart.row;
    this.player = createPlayer(startCol, startRow);
    this.lastCheckedCol = startCol;
    this.lastCheckedRow = startRow;
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
    this.createLeafEmitter();

    // Wild encounter spawn system
    this.initSpawnSystem();

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

    // Debug day/night controller
    if (IS_DEBUG) {
      import('../components/debug-time-controller').then(({ createDebugTimeController }) => {
        this.debugTimeCtrl = createDebugTimeController(this.timeSystem);
        document.body.appendChild(this.debugTimeCtrl.el);
      });
    }

    // Clean up debug DOM element when leaving the scene
    const cleanupDebug = () => {
      this.debugTimeCtrl?.el.remove();
      this.debugTimeCtrl = null;
    };
    this.events.on('shutdown', cleanupDebug);
    this.events.on('destroy', cleanupDebug);
  }

  update(_time: number, delta: number): void {
    if (this.encounterPending) return;

    const dt = delta / 1000;

    this.handleMovementInput();
    updatePlayer(this.player, dt);

    // Check for wild encounter + grass rustle when arriving at a new tile
    if (
      this.player.moveProgress >= 1 &&
      (this.player.col !== this.lastCheckedCol || this.player.row !== this.lastCheckedRow)
    ) {
      this.lastCheckedCol = this.player.col;
      this.lastCheckedRow = this.player.row;
      this.rustleGrass(this.player.col, this.player.row);
      this.checkSpawnEncounter(this.player.col, this.player.row);
    }

    this.updatePlayerSprite();
    this.emitFootstepDust();

    // Atmospheric systems
    this.timeSystem.update(dt);
    this.particles.setNight(this.timeSystem.isNight());
    this.particles.update();

    // Player light: always at viewport center.
    // The camera follows the player, so the player is always near center.
    const cam = this.cameras.main;
    this.lighting.setPlayerScreenPos(Math.round(cam.width * 0.5), Math.round(cam.height * 0.5));
    this.lighting.update(dt);

    this.debugTimeCtrl?.update();
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

    // Initialize decoration sprite grid for spawn visual effects
    this.decorationSprites = Array.from({ length: map.height }, () =>
      Array.from<Phaser.GameObjects.Sprite | null>({ length: map.width }).fill(null),
    );
    this.encounterTiles = [];

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

          // Constant sway only for non-tall-grass sway tiles (trees)
          // Tall grass bushes stay still until the player walks through them
          if (SWAY_TILES.has(cell.decoration) && !TALL_GRASS_TILES.has(cell.decoration)) {
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

          // Track tall grass decorations for the spawn system
          if (TALL_GRASS_TILES.has(cell.decoration)) {
            this.decorationSprites[row][col] = decSprite;
            this.encounterTiles.push({ col, row });
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

  // ── Leaf Particles & Grass Rustle ──────────────────────────────

  private createLeafEmitter(): void {
    if (!this.textures.exists('particle-leaf')) {
      const g = this.add.graphics();
      g.fillStyle(0x4aaa3a, 1);
      g.fillRect(0, 0, 3, 2);
      g.generateTexture('particle-leaf', 3, 2);
      g.destroy();
    }

    this.leafEmitter = this.add.particles(0, 0, 'particle-leaf', {
      lifespan: { min: 400, max: 700 },
      speed: { min: 8, max: 20 },
      angle: { min: 220, max: 320 },
      scale: { start: 1.0, end: 0.2 },
      alpha: { start: 0.8, end: 0 },
      gravityY: 15,
      frequency: -1,
      blendMode: Phaser.BlendModes.NORMAL,
      emitting: false,
    });
    this.leafEmitter.setDepth(50000);
  }

  /** Briefly rustle a tall grass bush when the player walks through it */
  private rustleGrass(col: number, row: number): void {
    const sprite = this.decorationSprites[row]?.[col];
    if (!sprite) return;
    // Don't rustle if this tile has an active spawn (it already has its own animation)
    if (this.spawns.some(s => s.col === col && s.row === row)) return;

    // Kill any existing rustle tween on this sprite
    this.tweens.killTweensOf(sprite);

    // Quick rustle: shake then settle back to 0
    this.tweens.add({
      targets: sprite,
      angle: { from: -3, to: 3 },
      duration: 60,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: 2,
      onComplete: () => sprite.setAngle(0),
    });

    // Emit a few leaves
    this.leafEmitter.setPosition(sprite.x, sprite.y - 4);
    this.leafEmitter.explode(3);
  }

  // ── Wild Pokemon Spawn System ──────────────────────────────────

  private initSpawnSystem(): void {
    if (this.encounterTiles.length === 0) return;

    // Spawn 1-2 immediately to populate the area
    this.trySpawn();
    if (this.encounterTiles.length > 1) this.trySpawn();

    // Recurring spawn timer
    this.time.addEvent({
      delay: SPAWN_INTERVAL_MS,
      callback: () => this.trySpawn(),
      loop: true,
    });
  }

  private trySpawn(): void {
    if (this.spawns.length >= MAX_SPAWNS) return;

    // Collect available encounter tiles (no existing spawn, player not standing on it)
    const occupied = new Set(this.spawns.map(s => `${s.col},${s.row}`));
    const available = this.encounterTiles.filter(
      t =>
        !occupied.has(`${t.col},${t.row}`) &&
        !(t.col === this.player.col && t.row === this.player.row),
    );
    if (available.length === 0) return;

    const target = available[Math.floor(Math.random() * available.length)];
    this.spawnOnTile(target.col, target.row);
  }

  private spawnOnTile(col: number, row: number): void {
    const sprite = this.decorationSprites[row]?.[col];
    if (!sprite) return;

    const pokemon = generateWildPokemon();

    // Kill any existing tweens
    this.tweens.killTweensOf(sprite);

    // Brighter tint to signal a hidden Pokemon
    sprite.setTint(SPAWN_TINT);

    // Intermittent shake: burst of shakes, pause, repeat
    const doShakeBurst = () => {
      if (!sprite.active) return;
      this.tweens.add({
        targets: sprite,
        angle: { from: -5, to: 5 },
        duration: 50,
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: 3, // 4 shakes total
        onComplete: () => { if (sprite.active) sprite.setAngle(0); },
      });
      // Emit leaves during the shake burst
      this.leafEmitter.setPosition(sprite.x, sprite.y - 4);
      this.leafEmitter.explode(2);
    };

    // First burst immediately
    doShakeBurst();

    // Periodic bursts every 2-3 seconds
    const shakeTimer = this.time.addEvent({
      delay: 2500,
      callback: doShakeBurst,
      loop: true,
    });

    // Auto-despawn after 1 minute
    const despawnTimer = this.time.addEvent({
      delay: SPAWN_LIFETIME_MS,
      callback: () => this.despawnFromTile(col, row),
    });

    this.spawns.push({ col, row, pokemon, shakeTimer, despawnTimer });
  }

  private despawnFromTile(col: number, row: number): void {
    const idx = this.spawns.findIndex(s => s.col === col && s.row === row);
    if (idx === -1) return;

    const spawn = this.spawns[idx];
    spawn.shakeTimer.remove();
    spawn.despawnTimer.remove();

    // Restore normal appearance
    const sprite = this.decorationSprites[row]?.[col];
    if (sprite) {
      this.tweens.killTweensOf(sprite);
      sprite.clearTint();
      sprite.setAngle(0);
    }

    this.spawns.splice(idx, 1);
  }

  private checkSpawnEncounter(col: number, row: number): void {
    const spawn = this.spawns.find(s => s.col === col && s.row === row);
    if (!spawn) return;

    this.encounterPending = true;

    // Stop movement and clear path
    this.player.path = [];
    this.player.isMoving = false;

    // Clean up the spawn visuals
    const pokemon = spawn.pokemon;
    this.despawnFromTile(col, row);

    // Play battle-start jingle (~2.9s)
    audioManager.playMusic('./audio/music/battle-start.mp3', false);

    // Flash → pause → screen-wipe transition (timed to match ~2.9s audio)
    this.cameras.main.flash(300, 255, 255, 255, false, (_cam: unknown, progress: number) => {
      if (progress >= 1) {
        // Brief dramatic pause after flash before the wipe begins
        this.time.delayedCall(400, () => {
          playBattleTransition(this, () => {
            const config = buildWildBattleConfig(pokemon);
            this.navigate('battle', {
              config,
              playerPosition: { col: this.player.col, row: this.player.row },
            });
          });
        });
      }
    });
  }
}
