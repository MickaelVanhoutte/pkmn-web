import type { BattleEvent } from '@/types/events';
import type { PlayerIndex } from '@/types/common';

export interface EventUIUpdate {
  logText?: string;
  hpUpdate?: {
    player: PlayerIndex;
    slot: number;
    currentHp: number;
    maxHp: number;
  };
  spriteUpdate?: {
    player: PlayerIndex;
    slot: number;
    action: 'show' | 'hide' | 'substitute' | 'unsubstitute';
    speciesId?: string;
  };
  statusUpdate?: {
    player: PlayerIndex;
    slot: number;
    status: string | null;
  };
  infoUpdate?: {
    player: PlayerIndex;
    slot: number;
    name: string;
    level: number;
    currentHp: number;
    maxHp: number;
    status: string | null;
  };
  playCry?: string;
  playMoveSfx?: string;
  delay?: number;
}

// --- Helpers ---

function pokeSide(player: PlayerIndex): 'player' | 'opponent' {
  return player === 0 ? 'player' : 'opponent';
}

function formatStatName(stat: string): string {
  const map: Record<string, string> = {
    atk: 'Attack',
    def: 'Defense',
    spa: 'Sp. Atk',
    spd: 'Sp. Def',
    spe: 'Speed',
    accuracy: 'accuracy',
    evasion: 'evasion',
  };
  return map[stat] ?? stat;
}

function statChangeVerb(stages: number): string {
  const abs = Math.abs(stages);
  if (stages > 0) {
    if (abs === 1) return 'rose';
    if (abs === 2) return 'rose sharply';
    return 'rose drastically';
  }
  if (abs === 1) return 'fell';
  if (abs === 2) return 'harshly fell';
  return 'severely fell';
}

function weatherStartText(weather: string): string {
  switch (weather) {
    case 'rain': return 'It started to rain!';
    case 'sun': return 'The sunlight turned harsh!';
    case 'sandstorm': return 'A sandstorm kicked up!';
    case 'hail': return 'It started to hail!';
    default: return `${weather} began!`;
  }
}

function weatherEndText(weather: string): string {
  switch (weather) {
    case 'rain': return 'The rain stopped.';
    case 'sun': return 'The harsh sunlight faded.';
    case 'sandstorm': return 'The sandstorm subsided.';
    case 'hail': return 'The hail stopped.';
    default: return `${weather} ended.`;
  }
}

function weatherDamageText(weather: string): string {
  switch (weather) {
    case 'sandstorm': return 'is buffeted by the sandstorm!';
    case 'hail': return 'is pelted by hail!';
    default: return `is hurt by the ${weather}!`;
  }
}

function statusAppliedText(status: string): string {
  switch (status) {
    case 'burn': return 'was burned!';
    case 'paralysis': return 'was paralyzed! It may be unable to move!';
    case 'freeze': return 'was frozen solid!';
    case 'poison': return 'was poisoned!';
    case 'sleep': return 'fell asleep!';
    default: return `got ${status}!`;
  }
}

function statusDamageText(status: string): string {
  switch (status) {
    case 'burn': return 'is hurt by its burn!';
    case 'paralysis': return 'is hurt by paralysis!';
    case 'freeze': return 'is hurt by the freeze!';
    case 'poison': return 'is hurt by poison!';
    default: return `is hurt by ${status}!`;
  }
}

function screenName(screen: string): string {
  switch (screen) {
    case 'lightScreen': return 'Light Screen';
    case 'reflect': return 'Reflect';
    case 'tailwind': return 'Tailwind';
    default: return screen;
  }
}

function terrainName(terrain: string): string {
  switch (terrain) {
    case 'electric': return 'Electric Terrain';
    case 'grassy': return 'Grassy Terrain';
    case 'psychic': return 'Psychic Terrain';
    case 'misty': return 'Misty Terrain';
    default: return terrain;
  }
}

function hazardName(hazard: string): string {
  switch (hazard) {
    case 'stealthRock': return 'Stealth Rock';
    case 'spikes': return 'Spikes';
    case 'toxicSpikes': return 'Toxic Spikes';
    case 'stickyWeb': return 'Sticky Web';
    default: return hazard;
  }
}

function sideName(side: PlayerIndex): string {
  return side === 0 ? 'your' : "the opposing team's";
}

// --- Main renderer ---

export function renderEvent(event: BattleEvent): EventUIUpdate {
  switch (event.kind) {
    case 'battle-start':
      return {
        logText: `${event.players[0]} vs ${event.players[1]}!`,
        delay: 800,
      };

    case 'turn-start':
      return {
        logText: `--- Turn ${event.turn} ---`,
        delay: 200,
      };

    case 'turn-end':
      return { delay: 100 };

    case 'move-use':
      return {
        logText: event.user.player === 0
          ? `${event.moveName}!`
          : `The opposing Pokemon used ${event.moveName}!`,
        playMoveSfx: event.moveName,
        delay: 400,
      };

    case 'damage': {
      let logText: string | undefined;
      switch (event.source) {
        case 'recoil':
          logText = 'It was hit with recoil!';
          break;
        case 'status':
          // Handled by status-damage event
          break;
        case 'weather':
          // Handled by weather-damage event
          break;
        case 'hazard':
          // Handled by hazard-damage event
          break;
        case 'item':
          if (event.sourceDetail) {
            logText = `It was hurt by its ${event.sourceDetail}!`;
          }
          break;
        case 'ability':
          // Ability damage text is typically handled by ability-activate
          break;
        default:
          // Move damage has no separate text (covered by type-effectiveness etc.)
          break;
      }
      return {
        logText,
        hpUpdate: {
          player: event.target.player,
          slot: event.target.slot,
          currentHp: event.currentHp,
          maxHp: event.maxHp,
        },
        delay: 300,
      };
    }

    case 'heal': {
      let logText: string | undefined;
      switch (event.source) {
        case 'item':
          if (event.sourceDetail) {
            logText = `A little HP was restored by ${event.sourceDetail}!`;
          }
          break;
        case 'status':
          logText = 'It restored a little HP while sleeping!';
          break;
        case 'drain':
          logText = 'The opposing Pokemon had its energy drained!';
          break;
        case 'move':
          logText = 'HP was restored!';
          break;
        case 'ability':
          if (event.sourceDetail) {
            logText = `HP was restored by ${event.sourceDetail}!`;
          }
          break;
        case 'terrain':
          logText = 'HP was restored by the grassy terrain!';
          break;
      }
      return {
        logText,
        hpUpdate: {
          player: event.target.player,
          slot: event.target.slot,
          currentHp: event.currentHp,
          maxHp: event.maxHp,
        },
        delay: 300,
      };
    }

    case 'faint':
      return {
        logText: `${event.pokemonName} fainted!`,
        spriteUpdate: {
          player: event.target.player,
          slot: event.target.slot,
          action: 'hide',
        },
        delay: 800,
      };

    case 'switch-in':
      return {
        logText: event.player === 0
          ? `Go! ${event.pokemonName}!`
          : `${event.pokemonName} was sent out!`,
        spriteUpdate: {
          player: event.player,
          slot: event.slot,
          action: 'show',
          speciesId: event.speciesId,
        },
        infoUpdate: {
          player: event.player,
          slot: event.slot,
          name: event.pokemonName,
          level: 50, // Level is not in the event; use default
          currentHp: event.currentHp,
          maxHp: event.maxHp,
          status: null,
        },
        playCry: event.speciesId,
        delay: 600,
      };

    case 'switch-out':
      return {
        logText: event.player === 0
          ? `${event.pokemonName}, come back!`
          : `${event.pokemonName} was withdrawn!`,
        spriteUpdate: {
          player: event.player,
          slot: event.slot,
          action: 'hide',
        },
        delay: 400,
      };

    case 'status-applied':
      return {
        logText: `${event.pokemonName} ${statusAppliedText(event.status)}`,
        statusUpdate: {
          player: event.target.player,
          slot: event.target.slot,
          status: event.status,
        },
        delay: 500,
      };

    case 'status-cured': {
      let cureText: string;
      switch (event.source) {
        case 'weather':
          cureText = `${event.pokemonName} was cured of its ${event.status} by the weather!`;
          break;
        case 'move':
          cureText = `${event.pokemonName} was cured of its ${event.status}!`;
          break;
        case 'ability':
          cureText = `${event.pokemonName}'s status was cured!`;
          break;
        case 'item':
          cureText = `${event.pokemonName}'s ${event.status} was healed!`;
          break;
        default:
          cureText = `${event.pokemonName} was cured of its ${event.status}!`;
          break;
      }
      return {
        logText: cureText,
        statusUpdate: {
          player: event.target.player,
          slot: event.target.slot,
          status: null,
        },
        delay: 400,
      };
    }

    case 'status-damage':
      return {
        logText: `${statusDamageText(event.status)}`,
        hpUpdate: {
          player: event.target.player,
          slot: event.target.slot,
          currentHp: event.currentHp,
          maxHp: event.maxHp,
        },
        delay: 400,
      };

    case 'stat-change':
      return {
        logText: `${event.pokemonName}'s ${formatStatName(event.stat)} ${statChangeVerb(event.stages)}!`,
        delay: 400,
      };

    case 'weather-set':
      return {
        logText: weatherStartText(event.weather),
        delay: 500,
      };

    case 'weather-damage':
      return {
        logText: weatherDamageText(event.weather),
        hpUpdate: {
          player: event.target.player,
          slot: event.target.slot,
          currentHp: event.currentHp,
          maxHp: event.maxHp,
        },
        delay: 400,
      };

    case 'weather-end':
      return {
        logText: weatherEndText(event.weather),
        delay: 400,
      };

    case 'critical-hit':
      return {
        logText: 'A critical hit!',
        delay: 300,
      };

    case 'type-effectiveness':
      switch (event.effectiveness) {
        case 'super-effective':
          return { logText: "It's super effective!", delay: 400 };
        case 'not-very-effective':
          return { logText: "It's not very effective...", delay: 400 };
        case 'immune':
          return { logText: "It doesn't affect the target...", delay: 400 };
        case 'neutral':
        default:
          return { delay: 0 };
      }

    case 'miss':
      return {
        logText: 'The attack missed!',
        delay: 400,
      };

    case 'fail':
      return {
        logText: `But it failed! (${event.reason})`,
        delay: 400,
      };

    case 'immunity':
      return {
        logText: `It had no effect! (${event.reason})`,
        delay: 400,
      };

    case 'ability-activate':
      return {
        logText: `[${event.abilityName}] ${event.message}`,
        delay: 400,
      };

    case 'hazard-set':
      return {
        logText: `${hazardName(event.hazard)} was set on ${sideName(event.side)} side!`,
        delay: 400,
      };

    case 'hazard-damage':
      return {
        logText: `Hurt by ${hazardName(event.hazard)}!`,
        hpUpdate: {
          player: event.target.player,
          slot: event.target.slot,
          currentHp: event.currentHp,
          maxHp: event.maxHp,
        },
        delay: 400,
      };

    case 'hazard-cleared':
      return {
        logText: `${hazardName(event.hazard)} disappeared from ${sideName(event.side)} side!`,
        delay: 400,
      };

    case 'item-used':
      return {
        logText: `${event.itemName} was used!`,
        delay: 400,
      };

    case 'run-attempt':
      return {
        logText: event.success ? 'Got away safely!' : "Can't escape!",
        delay: 600,
      };

    case 'battle-end': {
      let logText: string;
      if (event.winner === null) {
        logText = 'The battle ended in a draw!';
      } else if (event.reason === 'forfeit') {
        logText = event.winner === 0
          ? 'The opponent forfeited! You win!'
          : 'You forfeited the battle.';
      } else if (event.reason === 'run') {
        logText = 'You got away safely!';
      } else {
        logText = event.winner === 0
          ? 'You won the battle!'
          : 'You lost the battle...';
      }
      return { logText, delay: 1200 };
    }

    case 'message':
      return {
        logText: event.text,
        delay: 400,
      };

    case 'screen-set':
      return {
        logText: `${screenName(event.screen)} was raised on ${sideName(event.side)} side!`,
        delay: 400,
      };

    case 'screen-end':
      return {
        logText: `${sideName(event.side)} ${screenName(event.screen)} wore off!`,
        delay: 400,
      };

    case 'substitute-created':
      return {
        logText: 'A substitute was created!',
        spriteUpdate: {
          player: event.target.player,
          slot: event.target.slot,
          action: 'substitute',
        },
        hpUpdate: {
          player: event.target.player,
          slot: event.target.slot,
          currentHp: 0, // Will be updated by a separate damage/HP event
          maxHp: 0,
        },
        delay: 500,
      };

    case 'substitute-broken':
      return {
        logText: "The substitute took the hit and broke!",
        spriteUpdate: {
          player: event.target.player,
          slot: event.target.slot,
          action: 'unsubstitute',
        },
        delay: 500,
      };

    case 'substitute-blocked':
      return {
        logText: 'The substitute blocked the attack!',
        delay: 300,
      };

    case 'multi-hit-complete':
      return {
        logText: `Hit ${event.hitCount} time(s)!`,
        delay: 400,
      };

    case 'confusion-start':
      return {
        logText: `${event.pokemonName} became confused!`,
        delay: 400,
      };

    case 'confusion-end':
      return {
        logText: `${event.pokemonName} snapped out of its confusion!`,
        delay: 400,
      };

    case 'confusion-hit-self':
      return {
        logText: 'It hurt itself in its confusion!',
        hpUpdate: {
          player: event.target.player,
          slot: event.target.slot,
          currentHp: event.currentHp,
          maxHp: event.maxHp,
        },
        delay: 400,
      };

    case 'charging':
      return {
        logText: `${event.moveName} is charging up!`,
        delay: 500,
      };

    case 'force-switch':
      return {
        logText: `Forced to switch out! (${event.reason})`,
        delay: 400,
      };

    case 'pursuit-hit':
      return {
        logText: 'Pursuit caught the fleeing Pokemon!',
        delay: 400,
      };

    case 'terrain-set':
      return {
        logText: `${terrainName(event.terrain)} covers the battlefield!`,
        delay: 500,
      };

    case 'terrain-end':
      return {
        logText: `The ${terrainName(event.terrain)} faded.`,
        delay: 400,
      };

    case 'force-switch-needed':
      return { delay: 0 };

    default: {
      // Exhaustiveness check
      const _exhaustive: never = event;
      return { delay: 0 };
    }
  }
}
