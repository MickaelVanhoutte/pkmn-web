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
 * Uses a RenderTexture filled with ambient color, then erases ellipses for light sources.
 */
export class LightingManager {
  private rt: Phaser.GameObjects.RenderTexture;
  private lightBrush: Phaser.GameObjects.Graphics;
  private lights: PointLight[] = [];
  private elapsed = 0;

  /** Player light screen position (set externally from the sprite) */
  private playerScreenX = 0;
  private playerScreenY = 0;
  private playerRadius = 30;
  private playerIntensity = 0.95;

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
  }

  addLight(light: PointLight): void {
    this.lights.push(light);
  }

  /** Set the player light position in screen/viewport coords (from sprite). */
  setPlayerScreenPos(screenX: number, screenY: number): void {
    this.playerScreenX = screenX;
    this.playerScreenY = screenY;
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

    // Clear previous frame and fill with ambient color
    this.rt.clear();
    this.rt.fill(tint, alpha);

    // Punch light holes for static/world lights
    for (const light of this.lights) {
      let intensity = light.intensity;
      if (light.flicker) {
        intensity *= 0.85 + 0.15 * Math.sin(this.elapsed * 5 + light.worldX);
      }

      // Match Phaser's camera transform: (world - scroll) * zoom - halfView * (zoom - 1)
      const screenX = (light.worldX - cam.scrollX) * cam.zoom - w * 0.5 * (cam.zoom - 1);
      const screenY = (light.worldY - cam.scrollY) * cam.zoom - h * 0.5 * (cam.zoom - 1);
      const screenRadius = light.radius * cam.zoom;

      this.drawLightEllipse(screenX, screenY, screenRadius, intensity);
    }

    // Punch player light (using pre-computed screen coords — always centered)
    const playerScreenRadius = this.playerRadius * cam.zoom;
    this.drawLightEllipse(
      this.playerScreenX,
      this.playerScreenY,
      playerScreenRadius,
      this.playerIntensity,
    );
  }

  private drawLightEllipse(sx: number, sy: number, radius: number, intensity: number): void {
    this.lightBrush.clear();
    const steps = 8;
    for (let i = steps; i >= 0; i--) {
      const f = i / steps;
      const radX = radius * f;
      const radY = radius * f * 0.5; // 2:1 iso ratio
      const a = intensity * (1 - f * f); // quadratic falloff
      this.lightBrush.fillStyle(0xffffff, a);
      this.lightBrush.fillEllipse(sx, sy, radX * 2, radY * 2);
    }
    this.rt.erase(this.lightBrush, 0, 0);
  }

  destroy(): void {
    this.rt.destroy();
    this.lightBrush.destroy();
  }
}
