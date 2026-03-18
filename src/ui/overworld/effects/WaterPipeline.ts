import Phaser from 'phaser';

const FRAG_SHADER = `
precision mediump float;

uniform sampler2D uMainSampler;
uniform float uTime;

varying vec2 outTexCoord;
varying float outTintEffect;
varying vec4 outTint;

void main() {
  vec2 uv = outTexCoord;

  // Layered wave distortion
  float t = uTime * 0.001;
  uv.x += sin(uv.y * 10.0 + t * 1.5) * 0.012;
  uv.y += cos(uv.x * 8.0 + t * 1.2) * 0.010;
  uv.x += sin((uv.x + uv.y) * 12.0 + t * 1.8) * 0.006;

  vec4 texture = texture2D(uMainSampler, uv);

  // Specular shimmer highlights
  float shimmer = sin(uv.x * 20.0 + uv.y * 14.0 + t * 3.0);
  shimmer = pow(shimmer * 0.5 + 0.5, 8.0) * 0.15;
  texture.rgb += shimmer * texture.a;

  // Tint handling (matches Phaser SinglePipeline)
  vec4 texel = vec4(outTint.bgr * outTint.a, outTint.a);
  vec4 color = texture;

  if (outTintEffect == 1.0) {
    color.rgb = mix(texture.rgb, outTint.bgr * outTint.a, texture.a);
  } else if (outTintEffect == 2.0) {
    color = texel;
  } else {
    color *= texel;
  }

  gl_FragColor = color;
}
`;

export class WaterPipeline extends Phaser.Renderer.WebGL.Pipelines.SinglePipeline {
  constructor(game: Phaser.Game) {
    super({
      game,
      name: 'WaterPipeline',
      fragShader: FRAG_SHADER,
    });
  }

  onBind(): void {
    super.onBind();
    this.set1f('uTime', this.game.loop.time);
  }
}
