import Phaser from 'phaser';

/**
 * Manages atmospheric particle effects: leaves, wind streaks, dust motes, fireflies.
 * All textures are generated at runtime — no image assets needed.
 *
 * Leaves and dust spawn across the visible map area and drift with the wind.
 * Wind streaks burst from random edges periodically.
 */
export class ParticleManager {
  private leafEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private leafEmitter2!: Phaser.GameObjects.Particles.ParticleEmitter;
  private windEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private dustEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private fireflyEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private windTimer!: Phaser.Time.TimerEvent;
  private isNight = false;

  constructor(private scene: Phaser.Scene) {
    this.generateTextures();
    this.createLeafEmitter();
    this.createWindEmitter();
    this.createDustEmitter();
    this.createFireflyEmitter();
  }

  setNight(night: boolean): void {
    if (night === this.isNight) return;
    this.isNight = night;
    this.fireflyEmitter.emitting = night;
  }

  update(): void {
    // Position emitters to cover the visible world area
    const cam = this.scene.cameras.main;
    const cx = cam.worldView.centerX;
    const cy = cam.worldView.centerY;

    // All area-based emitters follow the camera center
    this.leafEmitter.setPosition(cx, cy);
    this.leafEmitter2.setPosition(cx, cy);
    this.dustEmitter.setPosition(cx, cy);
    this.fireflyEmitter.setPosition(cx, cy);
  }

  destroy(): void {
    this.windTimer?.destroy();
  }

  private generateTextures(): void {
    if (!this.scene.textures.exists('particle-leaf')) {
      const g = this.scene.add.graphics();
      g.fillStyle(0x5a8a3a, 1);
      g.fillEllipse(3, 2, 6, 3);
      g.fillStyle(0x4a7a2a, 1);
      g.fillRect(2, 2, 2, 1);
      g.generateTexture('particle-leaf', 6, 4);
      g.destroy();
    }

    if (!this.scene.textures.exists('particle-leaf2')) {
      const g = this.scene.add.graphics();
      g.fillStyle(0x7a9a4a, 1);
      g.fillEllipse(3, 2, 5, 3);
      g.generateTexture('particle-leaf2', 6, 4);
      g.destroy();
    }

    if (!this.scene.textures.exists('particle-wind')) {
      const g = this.scene.add.graphics();
      g.fillStyle(0xffffff, 1);
      g.fillRect(0, 0, 10, 1);
      g.generateTexture('particle-wind', 10, 1);
      g.destroy();
    }

    if (!this.scene.textures.exists('particle-dust')) {
      const g = this.scene.add.graphics();
      g.fillStyle(0xd4a050, 1);
      g.fillCircle(1, 1, 1);
      g.generateTexture('particle-dust', 3, 3);
      g.destroy();
    }

    if (!this.scene.textures.exists('particle-firefly')) {
      const g = this.scene.add.graphics();
      g.fillStyle(0xffee88, 0.3);
      g.fillCircle(4, 4, 4);
      g.fillStyle(0xffffcc, 0.9);
      g.fillCircle(4, 4, 2);
      g.generateTexture('particle-firefly', 8, 8);
      g.destroy();
    }
  }

  private createLeafEmitter(): void {
    const cam = this.scene.cameras.main;
    const hw = cam.width / (2 * cam.zoom);
    const hh = cam.height / (2 * cam.zoom);

    // Leaves spawn across the visible area and drift diagonally (wind-carried)
    this.leafEmitter = this.scene.add.particles(0, 0, 'particle-leaf', {
      lifespan: { min: 3000, max: 5000 },
      speedX: { min: 8, max: 18 },
      speedY: { min: 3, max: 10 },
      rotate: { min: 0, max: 360 },
      scale: { start: 1.8, end: 0.8 },
      alpha: { values: [0, 0.7, 0.7, 0], interpolation: 'catmull' as any },
      frequency: 250,
      quantity: 1,
      blendMode: Phaser.BlendModes.NORMAL,
      emitting: true,
      emitZone: { type: 'random', source: new Phaser.Geom.Rectangle(-hw, -hh, hw * 2, hh * 2) as any },
    });
    this.leafEmitter.setDepth(50000);

    this.leafEmitter2 = this.scene.add.particles(0, 0, 'particle-leaf2', {
      lifespan: { min: 2500, max: 4500 },
      speedX: { min: 6, max: 14 },
      speedY: { min: 2, max: 8 },
      rotate: { min: 0, max: 360 },
      scale: { start: 1.5, end: 0.6 },
      alpha: { values: [0, 0.6, 0.6, 0], interpolation: 'catmull' as any },
      frequency: 400,
      quantity: 1,
      blendMode: Phaser.BlendModes.NORMAL,
      emitting: true,
      emitZone: { type: 'random', source: new Phaser.Geom.Rectangle(-hw, -hh, hw * 2, hh * 2) as any },
    });
    this.leafEmitter2.setDepth(50000);
  }

  private createWindEmitter(): void {
    this.windEmitter = this.scene.add.particles(0, 0, 'particle-wind', {
      lifespan: { min: 400, max: 700 },
      speedX: { min: 150, max: 300 },
      speedY: { min: -10, max: 10 },
      alpha: { start: 0.12, end: 0 },
      scale: { start: 1, end: 0.5 },
      frequency: -1,
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    });
    this.windEmitter.setDepth(50001);

    this.windTimer = this.scene.time.addEvent({
      delay: Phaser.Math.Between(4000, 8000),
      callback: () => {
        const cam = this.scene.cameras.main;
        const wv = cam.worldView;

        // Spawn wind from a random vertical band on the left edge
        const bandY = Phaser.Math.Between(
          Math.round(wv.y + wv.height * 0.1),
          Math.round(wv.y + wv.height * 0.9),
        );
        const bandH = Math.round(wv.height * 0.3);

        this.windEmitter.setPosition(wv.x - 10, bandY);
        this.windEmitter.addEmitZone({
          type: 'random',
          source: new Phaser.Geom.Rectangle(0, -bandH / 2, 20, bandH) as any,
        });
        this.windEmitter.explode(Phaser.Math.Between(8, 16));

        // Randomize next wind burst timing
        (this.windTimer as any).delay = Phaser.Math.Between(4000, 8000);
      },
      loop: true,
      startAt: 2000,
    });
  }

  private createDustEmitter(): void {
    const cam = this.scene.cameras.main;
    const hw = cam.width / (2 * cam.zoom);
    const hh = cam.height / (2 * cam.zoom);

    this.dustEmitter = this.scene.add.particles(0, 0, 'particle-dust', {
      lifespan: { min: 3000, max: 5000 },
      speedX: { min: -3, max: 3 },
      speedY: { min: -8, max: -3 },
      alpha: { start: 0.2, end: 0 },
      scale: { start: 1, end: 0.5 },
      frequency: 400,
      quantity: 1,
      blendMode: Phaser.BlendModes.ADD,
      emitting: true,
      emitZone: { type: 'random', source: new Phaser.Geom.Rectangle(-hw, 0, hw * 2, hh) as any },
    });
    this.dustEmitter.setDepth(50002);
  }

  private createFireflyEmitter(): void {
    const cam = this.scene.cameras.main;
    const hw = cam.width / (2 * cam.zoom);
    const hh = cam.height / (2 * cam.zoom);

    this.fireflyEmitter = this.scene.add.particles(0, 0, 'particle-firefly', {
      lifespan: { min: 4000, max: 7000 },
      speedX: { min: -6, max: 6 },
      speedY: { min: -6, max: 6 },
      alpha: { start: 0.8, end: 0 },
      scale: { start: 0.6, end: 1.2 },
      frequency: 300,
      quantity: 1,
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
      emitZone: { type: 'random', source: new Phaser.Geom.Rectangle(-hw, -hh, hw * 2, hh * 2) as any },
    });
    this.fireflyEmitter.setDepth(50003);
  }
}

