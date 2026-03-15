import type {
  AbilityTrigger, AbilityHookContext, AbilityHookResult, AbilityHandlerMap,
  PokemonBattleState, BattlePosition,
} from '../types';
import { getAbilityHandler } from '../data/ability-registry';
import { getPokemonName } from '../model/pokemon';
import type { EventBus } from '../events/event-bus';

export class AbilityDispatcher {
  constructor(private eventBus: EventBus) {}

  dispatch(
    trigger: AbilityTrigger,
    pokemon: PokemonBattleState,
    position: BattlePosition,
    context: AbilityHookContext,
    turn: number,
  ): AbilityHookResult[] {
    if (pokemon.isFainted) return [{ action: 'none' }];

    const handler = getAbilityHandler(pokemon.ability);
    if (!handler) return [{ action: 'none' }];

    const triggerFn = handler[trigger];
    if (!triggerFn) return [{ action: 'none' }];

    const result = triggerFn(context);
    const results = Array.isArray(result) ? result : [result];

    // Emit ability activation event for non-none results
    const hasAction = results.some(r => r.action !== 'none');
    if (hasAction) {
      this.eventBus.emit({
        kind: 'ability-activate',
        turn,
        pokemon: position,
        abilityId: pokemon.ability,
        abilityName: pokemon.ability, // Will be resolved from registry if needed
        message: `${getPokemonName(pokemon)}'s ${pokemon.ability} activated!`,
      });
    }

    return results;
  }

  getModifier(
    trigger: AbilityTrigger,
    pokemon: PokemonBattleState,
    context: AbilityHookContext,
  ): number {
    if (pokemon.isFainted) return 1;

    const handler = getAbilityHandler(pokemon.ability);
    if (!handler) return 1;

    const triggerFn = handler[trigger];
    if (!triggerFn) return 1;

    const result = triggerFn(context);
    const results = Array.isArray(result) ? result : [result];

    for (const r of results) {
      if (r.action === 'modify-stat' || r.action === 'modify-damage') {
        return r.factor;
      }
    }

    return 1;
  }

  shouldPrevent(
    trigger: AbilityTrigger,
    pokemon: PokemonBattleState,
    context: AbilityHookContext,
  ): boolean {
    if (pokemon.isFainted) return false;

    const handler = getAbilityHandler(pokemon.ability);
    if (!handler) return false;

    const triggerFn = handler[trigger];
    if (!triggerFn) return false;

    const result = triggerFn(context);
    const results = Array.isArray(result) ? result : [result];

    return results.some(r => r.action === 'prevent');
  }
}
