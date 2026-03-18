import Phaser from 'phaser';
import { el } from '../util/dom';
import type { NavigateFn } from '../main';
import { OverworldScene } from '../overworld/OverworldScene';
import { VignettePipeline } from '../overworld/effects/VignettePipeline';

export function showOverworldScreen(
  container: HTMLElement,
  _navigate: NavigateFn,
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
  });

  return () => {
    game.destroy(true);
  };
}
