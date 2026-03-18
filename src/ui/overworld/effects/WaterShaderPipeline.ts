import Phaser from 'phaser';

const FRAG_SHADER = `
precision mediump float;

uniform sampler2D uMainSampler;
uniform float uTime;

varying vec2 outTexCoord;

void main() {
  vec2 uv = outTexCoord;

  // Gentle sinusoidal UV distortion for wave effect
  float waveX = sin(uv.y * 30.0 + uTime * 2.0) * 0.002;
  float waveY = cos(uv.x * 25.0 + uTime * 1.5) * 0.001;
  vec2 distorted = uv + vec2(waveX, waveY);

  vec4 color = texture2D(uMainSampler, distorted);

  // Brightness shimmer
  float shimmer = sin(uv.x * 40.0 + uv.y * 20.0 + uTime * 3.0) * 0.03 + 1.0;
  color.rgb *= shimmer;

  gl_FragColor = color;
}
`;

export class WaterShaderPipeline extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  constructor(game: Phaser.Game) {
    super({
      game,
      name: 'WaterShaderPipeline',
      fragShader: FRAG_SHADER,
    });
  }

  onPreRender(): void {
    this.set1f('uTime', this.game.loop.time / 1000);
  }
}
