import './styles/global.css';
import './styles/battle.css';
import './styles/panels.css';
import './styles/team-select.css';

import { showTitleScreen } from './screens/title-screen';
import { showTeamSelect } from './screens/team-select';
import { showBattleScreen } from './screens/battle-screen';
import { showResultScreen } from './screens/result-screen';

export type Screen = 'title' | 'team-select' | 'battle' | 'result';
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
      });
      break;
    case 'result':
      cleanupFn = showResultScreen(app, navigate, {
        winner: params?.winner as 0 | 1 | null,
        config: params?.config as import('../types/battle').BattleConfig,
      });
      break;
  }
}

navigate('title');
