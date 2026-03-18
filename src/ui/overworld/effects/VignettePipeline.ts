import Phaser from 'phaser';

const FRAG_SHADER = `
precision mediump float;

uniform sampler2D uMainSampler;
uniform vec2 uResolution;
uniform float uIntensity;

varying vec2 outTexCoord;

void main() {
  vec4 color = texture2D(uMainSampler, outTexCoord);
  vec2 uv = outTexCoord;
  vec2 center = vec2(0.5, 0.5);
  float dist = distance(uv, center);
  float vignette = smoothstep(0.4, 1.0, dist) * uIntensity;
  color.rgb *= 1.0 - vignette;
  gl_FragColor = color;
}
`;

export class VignettePipeline extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  private _intensity = 0.35;

  constructor(game: Phaser.Game) {
    super({
      game,
      name: 'VignettePipeline',
      fragShader: FRAG_SHADER,
    });
  }

  onPreRender(): void {
    this.set2f('uResolution', this.renderer.width, this.renderer.height);
    this.set1f('uIntensity', this._intensity);
  }

  setIntensity(value: number): void {
    this._intensity = value;
  }
}
