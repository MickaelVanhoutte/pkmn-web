import Phaser from 'phaser';
import { el } from '../util/dom';
import type { NavigateFn } from '../main';
import { OverworldScene } from '../overworld/OverworldScene';
import { VignettePipeline } from '../overworld/effects/VignettePipeline';

export function showOverworldScreen(
  container: HTMLElement,
  navigate: NavigateFn,
  params?: { playerPosition?: { col: number; row: number } },
): () => void {
  const wrapper = el('div', { class: 'overworld-screen' });
  container.appendChild(wrapper);

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: wrapper,
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    backgroundColor: '#1a1a2e',
    pixelArt: true,
    scene: [OverworldScene],
    pipeline: [VignettePipeline as any],
    callbacks: {
      preBoot: (bootGame) => {
        bootGame.registry.set('navigate', navigate);
        if (params?.playerPosition) {
          bootGame.registry.set('playerPosition', params.playerPosition);
        }
      },
    },
  });

  return () => {
    game.destroy(true);
  };
}
