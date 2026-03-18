import Phaser from 'phaser';
import type { TimeSystem } from './time-system';

interface PointLight {
  worldX: number;
  worldY: number;
  radius: number;
  color: number;
  intensity: number;
  flicker?: boolean;
}

/**
 * Day/night overlay with light holes.
 * Uses a RenderTexture filled with ambient color, then erases circles for light sources.
 */
export class LightingManager {
  private rt: Phaser.GameObjects.RenderTexture;
  private lightBrush: Phaser.GameObjects.Graphics;
  private lights: PointLight[] = [];
  private playerLight: PointLight;
  private elapsed = 0;

  constructor(
    private scene: Phaser.Scene,
    private timeSystem: TimeSystem,
  ) {
    const cam = scene.cameras.main;

    // RT covers the full viewport, fixed to camera
    this.rt = scene.add.renderTexture(0, 0, cam.width, cam.height);
    this.rt.setOrigin(0, 0);
    this.rt.setScrollFactor(0);
    this.rt.setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.rt.setDepth(90000);

    // Offscreen graphics used as a brush for erasing light holes
    this.lightBrush = scene.add.graphics();
    this.lightBrush.setVisible(false);

    // Player glow
    this.playerLight = {
      worldX: 0,
      worldY: 0,
      radius: 60,
      color: 0xffeedd,
      intensity: 0.9,
    };
  }

  addLight(light: PointLight): void {
    this.lights.push(light);
  }

  setPlayerPosition(x: number, y: number): void {
    this.playerLight.worldX = x;
    this.playerLight.worldY = y;
  }

  update(dt: number): void {
    this.elapsed += dt;

    const cam = this.scene.cameras.main;
    const w = cam.width;
    const h = cam.height;

    // Resize if viewport changed
    if (this.rt.width !== w || this.rt.height !== h) {
      this.rt.resize(w, h);
    }

    const alpha = this.timeSystem.getAmbientAlpha();
    const tint = this.timeSystem.getAmbientTint();

    // Full daylight — hide overlay
    if (alpha < 0.01) {
      this.rt.setVisible(false);
      return;
    }
    this.rt.setVisible(true);

    // Fill with ambient color
    this.rt.fill(tint, alpha);

    // Punch light holes
    const allLights = [...this.lights, this.playerLight];
    for (const light of allLights) {
      let intensity = light.intensity;
      if (light.flicker) {
        intensity *= 0.85 + 0.15 * Math.sin(this.elapsed * 5 + light.worldX);
      }

      // World → screen coords (use worldView, not scrollX)
      const screenX = (light.worldX - cam.worldView.x) * cam.zoom;
      const screenY = (light.worldY - cam.worldView.y) * cam.zoom;
      const screenRadius = light.radius * cam.zoom;

      // Draw concentric circles for soft falloff
      this.lightBrush.clear();
      const steps = 8;
      for (let i = steps; i >= 0; i--) {
        const f = i / steps;
        const rad = screenRadius * f;
        const a = intensity * (1 - f * f); // quadratic falloff
        this.lightBrush.fillStyle(0xffffff, a);
        this.lightBrush.fillCircle(screenX, screenY, rad);
      }

      this.rt.erase(this.lightBrush, 0, 0);
    }
  }

  destroy(): void {
    this.rt.destroy();
    this.lightBrush.destroy();
  }
}
