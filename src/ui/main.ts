import './styles/global.css';
import './styles/battle.css';
import './styles/panels.css';
import './styles/team-select.css';
import './styles/overworld.css';

import { showTitleScreen } from './screens/title-screen';
import { showTeamSelect } from './screens/team-select';
import { showBattleScreen } from './screens/battle-screen';
import { showResultScreen } from './screens/result-screen';
import { showOverworldScreen } from './screens/overworld-screen';

export type Screen = 'title' | 'team-select' | 'battle' | 'result' | 'overworld';
export type NavigateFn = (screen: Screen, params?: Record<string, unknown>) => void;

const app = document.getElementById('app')!;
let cleanupFn: (() => void) | null = null;

const navigate: NavigateFn = (screen, params) => {
  if (cleanupFn) {
    cleanupFn();
    cleanupFn = null;
  }
  app.innerHTML = '';

  switch (screen) {
    case 'title':
      cleanupFn = showTitleScreen(app, navigate);
      break;
    case 'team-select':
      cleanupFn = showTeamSelect(app, navigate, {
        format: (params?.format as 'singles' | 'doubles') ?? 'singles',
      });
      break;
    case 'battle':
      cleanupFn = showBattleScreen(app, navigate, {
        config: params?.config as import('../types/battle').BattleConfig,
        playerPosition: params?.playerPosition as { col: number; row: number } | undefined,
      });
      break;
    case 'result':
      cleanupFn = showResultScreen(app, navigate, {
        winner: params?.winner as 0 | 1 | null,
        config: params?.config as import('../types/battle').BattleConfig,
      });
      break;
    case 'overworld':
      cleanupFn = showOverworldScreen(app, navigate, {
        playerPosition: params?.playerPosition as { col: number; row: number } | undefined,
      });
      break;
  }
}

navigate('title');

// Register service worker for PWA — auto-reload on new version
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js').then((reg) => {
    reg.addEventListener('updatefound', () => {
      const newSW = reg.installing;
      if (!newSW) return;
      newSW.addEventListener('statechange', () => {
        // New SW activated and there was a previous one — reload to get fresh assets
        if (newSW.state === 'activated' && navigator.serviceWorker.controller) {
          window.location.reload();
        }
      });
    });
  }).catch(() => {});
}
