import type { AbilityHandlerMap, AbilityHookContext, AbilityHookResult } from '../types';
import { registerAbilityHandler } from './ability-registry';

const handlers: Record<string, AbilityHandlerMap> = {
  blaze: {
    modifyDamage: (ctx: AbilityHookContext): AbilityHookResult => {
      if (ctx.move?.type === 'fire' && ctx.source.currentHp <= ctx.source.maxHp / 3) {
        return { action: 'modify-damage', factor: 1.5 };
      }
      return { action: 'none' };
    },
  },

  torrent: {
    modifyDamage: (ctx: AbilityHookContext): AbilityHookResult => {
      if (ctx.move?.type === 'water' && ctx.source.currentHp <= ctx.source.maxHp / 3) {
        return { action: 'modify-damage', factor: 1.5 };
      }
      return { action: 'none' };
    },
  },

  overgrow: {
    modifyDamage: (ctx: AbilityHookContext): AbilityHookResult => {
      if (ctx.move?.type === 'grass' && ctx.source.currentHp <= ctx.source.maxHp / 3) {
        return { action: 'modify-damage', factor: 1.5 };
      }
      return { action: 'none' };
    },
  },

  static: {
    onBeingHit: (ctx: AbilityHookContext): AbilityHookResult => {
      if (ctx.move?.contact) {
        return {
          action: 'inflict-status',
          status: 'paralysis',
          target: { player: 0, slot: 0 }, // caller will resolve
        };
      }
      return { action: 'none' };
    },
  },

  intimidate: {
    onSwitchIn: (ctx: AbilityHookContext): AbilityHookResult => {
      // Lower all opponents' attack by 1
      return {
        action: 'boost-stat',
        stat: 'atk',
        stages: -1,
        target: { player: 0, slot: 0 }, // caller resolves for all opponents
      };
    },
  },

  levitate: {
    onTryHit: (ctx: AbilityHookContext): AbilityHookResult => {
      if (ctx.move?.type === 'ground' && ctx.move.category !== 'status') {
        return { action: 'prevent' };
      }
      return { action: 'none' };
    },
  },

  chlorophyll: {
    modifySpe: (ctx: AbilityHookContext): AbilityHookResult => {
      if (ctx.weather === 'sun') {
        return { action: 'modify-stat', factor: 2.0 };
      }
      return { action: 'none' };
    },
  },

  'swift-swim': {
    modifySpe: (ctx: AbilityHookContext): AbilityHookResult => {
      if (ctx.weather === 'rain') {
        return { action: 'modify-stat', factor: 2.0 };
      }
      return { action: 'none' };
    },
  },

  'clear-body': {
    onStatChange: (ctx: AbilityHookContext): AbilityHookResult => {
      if (ctx.statChange && ctx.statChange.stages < 0) {
        return { action: 'prevent' };
      }
      return { action: 'none' };
    },
  },

  'huge-power': {
    modifyAtk: (): AbilityHookResult => {
      return { action: 'modify-stat', factor: 2.0 };
    },
  },

  'water-absorb': {
    onTryHit: (ctx: AbilityHookContext): AbilityHookResult => {
      if (ctx.move?.type === 'water') {
        return { action: 'heal', amount: Math.floor(ctx.source.maxHp / 4) };
      }
      return { action: 'none' };
    },
  },

  'sand-stream': {
    onSwitchIn: (): AbilityHookResult => {
      return { action: 'set-weather', weather: 'sandstorm' };
    },
  },

  'natural-cure': {
    onSwitchOut: (): AbilityHookResult => {
      return { action: 'message', text: 'Natural Cure activated!' };
      // Actual cure logic handled by switch processor
    },
  },

  'serene-grace': {
    // Doubles secondary effect chances - handled in move executor
    modifyDamage: (): AbilityHookResult => {
      return { action: 'none' };
    },
  },

  technician: {
    modifyDamage: (ctx: AbilityHookContext): AbilityHookResult => {
      if (ctx.move && ctx.move.power !== null && ctx.move.power <= 60) {
        return { action: 'modify-damage', factor: 1.5 };
      }
      return { action: 'none' };
    },
  },

  'iron-fist': {
    modifyDamage: (ctx: AbilityHookContext): AbilityHookResult => {
      if (ctx.move?.flags.isPunch) {
        return { action: 'modify-damage', factor: 1.2 };
      }
      return { action: 'none' };
    },
  },

  'inner-focus': {
    onBeingHit: (): AbilityHookResult => {
      // Prevents flinch - handled in move executor
      return { action: 'none' };
    },
  },

  sturdy: {
    onDamageReceived: (ctx: AbilityHookContext): AbilityHookResult => {
      if (ctx.source.currentHp === ctx.source.maxHp && ctx.damage && ctx.damage >= ctx.source.currentHp) {
        return { action: 'modify-damage', factor: 0 }; // signal to leave at 1HP
      }
      return { action: 'none' };
    },
  },

  pressure: {
    onSwitchIn: (): AbilityHookResult => {
      return { action: 'message', text: 'Pressure is exerting its pressure!' };
    },
  },

  multiscale: {
    modifyDamage: (ctx: AbilityHookContext): AbilityHookResult => {
      if (ctx.source.currentHp === ctx.source.maxHp) {
        return { action: 'modify-damage', factor: 0.5 };
      }
      return { action: 'none' };
    },
  },
};

export function registerAllAbilityHandlers(): void {
  for (const [id, handler] of Object.entries(handlers)) {
    registerAbilityHandler(id, handler);
  }
}
