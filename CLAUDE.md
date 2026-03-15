# Pokemon Battle Engine

A Pokemon battle engine built from scratch in TypeScript. Client-side only, no UI yet.

## Commands

```bash
npm test          # run all tests (vitest)
npm run test:watch # watch mode
npm run build     # tsc + vite build
npm run dev       # vite dev server
npx tsc --noEmit  # type-check only
```

## Project Structure

```
data/                    # User-editable JSON data files
  type-chart.json        # 18x18 type effectiveness matrix
  moves.json             # Move definitions (48 moves)
  abilities.json         # Ability metadata (20 abilities)
  pokemon.json           # Pokemon species data (18 pokemon)
  items.json             # Item definitions (14 items: consumables + held items)

src/
  types/                 # All TypeScript interfaces
    common.ts            # TypeName, StatBlock, MajorStatus, Weather, Natures, status constants
    pokemon.ts           # PokemonSpecies, PokemonConfig, PokemonBattleState
    move.ts              # MoveData, MoveEffect, MoveTarget, MoveFlags
    ability.ts           # AbilityData, AbilityTrigger, AbilityHookContext/Result
    item.ts              # ItemData, ItemEffect, ItemCategory
    battle.ts            # BattleConfig, BattleState, TurnAction, BattlePhase, SideState
    events.ts            # BattleEvent discriminated union (44 event kinds)

  data/                  # Data loading and lookup
    type-chart.ts        # getTypeEffectiveness(attackType, defenderTypes) -> 0/0.25/0.5/1/2/4
    move-registry.ts     # getMove(id), getAllMoves()
    ability-registry.ts  # getAbility(id), registerAbilityHandler(), getAbilityHandler()
    pokemon-registry.ts  # getSpecies(id), getAllSpecies()
    ability-handlers.ts  # All ability handler implementations, registerAllAbilityHandlers()
    item-registry.ts     # getItem(id), getAllItems()

  model/                 # Runtime state management
    pokemon.ts           # createPokemonBattleState(), applyDamage(), applyHeal(), setStatus(), cureStatus()
    field.ts             # createFieldState(), setWeather(), tickWeather()

  engine/                # Battle logic
    battle-engine.ts     # BattleEngine class (main state machine)
    turn-resolver.ts     # Action sorting + execution loop
    damage-calc.ts       # calculateDamage() pure function (Gen 4+ formula)
    move-executor.ts     # Full move pipeline
    status-processor.ts  # Custom status damage/healing/curing
    weather-processor.ts # Weather countdown, damage, move modifiers
    ability-dispatcher.ts# Ability hook dispatch system
    hazard-processor.ts  # Entry hazard setup + trigger
    switch-processor.ts  # Switch-in/out logic
    action-validator.ts  # Validates submitted actions
    rng.ts               # SeededRNG (mulberry32)

  events/
    event-bus.ts         # Typed pub/sub for BattleEvent

  utils/
    stat-calc.ts         # Stat calculation, stage multipliers

tests/
  data/type-chart.test.ts
  engine/damage-calc.test.ts
  engine/status-processor.test.ts
  engine/screen.test.ts
  engine/substitute.test.ts
  engine/multi-hit.test.ts
  engine/confusion.test.ts
  engine/charge-moves.test.ts
  engine/force-switch.test.ts
  engine/pursuit.test.ts
  engine/items.test.ts
  engine/terrain.test.ts
  engine/ability-handlers.test.ts
  engine/dual-type-effectiveness.test.ts
  engine/modifier-stacking.test.ts
  integration/singles-battle.test.ts
  integration/doubles-battle.test.ts
  integration/status-weather-interaction.test.ts
  integration/new-features-interaction.test.ts
  integration/weather-damage-calc.test.ts
  integration/end-of-turn.test.ts
```

## Architecture

### Battle Engine State Machine

```
not-started -> awaiting-actions -> resolving-turn -> turn-end
                    ^                                    |
                    |                                    v
                    +------ forced-switch <----- [faint check]
                    |
                    +------ battle-over (when all fainted)
```

### BattleEngine Public API

```typescript
const engine = new BattleEngine(config: BattleConfig);
engine.startBattle(): BattleEvent[];
engine.submitAction(player: PlayerIndex, actions: TurnAction[]): boolean;
engine.resolveTurn(): BattleEvent[];
engine.submitSwitch(player, slot, switchToIndex): BattleEvent[];
engine.getState() / getPhase() / getTurn() / isOver() / getWinner()
engine.getActivePokemon(player, slot): PokemonBattleState | null
engine.on(eventKind, handler) / engine.onAny(handler)
```

### Turn Resolution Order

1. Switches (always first)
2. Items
3. Run attempts
4. Moves sorted by: priority (desc) -> effective speed (desc) -> random tiebreak

### End of Turn Order

1. Weather damage (sandstorm/hail)
2. Status effects (typed damage or sleep healing)
3. Weather curing of status
4. Weather tick (countdown)
5. Screen/Tailwind countdown
6. Win condition check

## Custom Status Effects (IMPORTANT - departs from vanilla Pokemon)

| Status    | Stat Hit  | Damage Type | Per Turn     | Move Cure  | Weather Cure |
|-----------|-----------|-------------|--------------|------------|--------------|
| Burn      | Atk -50%  | Fire        | 1/16 HP      | Water move | Rain         |
| Paralysis | Spe -50%  | Electric    | 1/16 HP      | Ground move| Sandstorm    |
| Freeze    | Def -50%  | Ice         | 1/16 HP      | Fire move  | Sun          |
| Poison    | SpDef -50%| Poison      | 1/16 HP      | Ice move   | Hail         |
| Sleep     | None      | N/A         | Heals 1/16 HP| N/A        | N/A          |

**Status damage is typed**: type effectiveness of the damage type vs the pokemon's types applies.
Example: Ice-type pokemon takes 2x burn damage (fire SE vs ice). Water-type takes 0.5x.

Constants for these rules are defined in `src/types/common.ts`:
- `STATUS_TYPE_MAP` - status -> damage type
- `STATUS_STAT_REDUCTION` - status -> reduced stat
- `STATUS_WEATHER_CURE` - status -> curing weather
- `STATUS_MOVE_CURE` - status -> curing move type

No toxic/badly-poisoned status. Only one major status at a time.
Paralysis does NOT prevent acting (only reduces speed + deals electric damage).
Sleep lasts 2-5 turns, prevents acting, heals 1/16 HP per turn.

## Key Design Decisions

- **Gen 4+ physical/special split**: each move has its own category (physical/special/status)
- **All 18 types** including Fairy
- **Singles + Doubles** supported (spread penalty 0.75x, Earthquake hits ally)
- **Seeded RNG**: deterministic battles via `SeededRNG(seed)` for testing/replay
- **Event-driven**: every mutation emits a `BattleEvent` for future UI consumption
- **JSON-editable data**: moves, abilities, pokemon all stored in `data/*.json`
- **Ability system**: hook-based dispatch with 25+ trigger points, handlers in `src/data/ability-handlers.ts`

## Adding New Content

### New Move
Add to `data/moves.json`. Required fields: id, name, type, category, power, accuracy, pp, priority, contact, sound, target, effects[], flags.

### New Ability
1. Add metadata to `data/abilities.json`
2. Add handler to `src/data/ability-handlers.ts` in the `handlers` object
3. Handler maps trigger names to functions returning `AbilityHookResult`

### New Pokemon
Add to `data/pokemon.json`. Required: id, name, types, baseStats, possibleAbilities, learnableMoves.

## Current Starter Content

- **18 Pokemon**: Snorlax, Charizard, Blastoise, Jolteon, Venusaur, Lapras, Lucario, Gengar, Garchomp, Togekiss, Alakazam, Scizor, Tyranitar, Dragonite, Swampert, Ferrothorn, Azumarill, Metagross
- **48 Moves**: 18 type-coverage attacks + Protect, Stealth Rock, Spikes, Rapid Spin, Quick Attack, Recover, Swords Dance, Will-O-Wisp, Thunder Wave, Rain Dance, Sunny Day, Sandstorm, Hail, Giga Drain, Double-Edge, Light Screen, Reflect, Substitute, Rock Blast, Bullet Seed, Icicle Spear, Dual Wingbeat, Confuse Ray, Solar Beam, Fly, Whirlwind, Roar, Pursuit, Electric/Grassy/Psychic/Misty Terrain
- **20 Abilities**: Blaze, Torrent, Overgrow, Static, Intimidate, Levitate, Chlorophyll, Swift Swim, Clear Body, Huge Power, Water Absorb, Sand Stream, Natural Cure, Serene Grace, Technician, Iron Fist, Inner Focus, Sturdy, Pressure, Multiscale
- **15 Items**: Potion, Super Potion, Full Restore, status cures (Antidote, Burn Heal, etc.), Leftovers, Life Orb, Choice Band/Specs/Scarf, Focus Sash

## Not Yet Implemented

- Admin UI for editing JSON
