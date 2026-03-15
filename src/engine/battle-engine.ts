import type {
  BattleEvent, PlayerIndex, TurnAction, BattlePosition, PokemonBattleState,
} from '../types';
import type {
  BattleConfig, BattleState, BattlePhase, PlayerState, FieldState,
} from '../types/battle';
import { defaultSideState } from '../types/battle';
import { createPokemonBattleState, getPokemonName, removeVolatileStatus, hasVolatileStatus, applyHeal } from '../model/pokemon';
import { getMove } from '../data/move-registry';
import { createFieldState } from '../model/field';
import { EventBus } from '../events/event-bus';
import { SeededRNG } from './rng';
import { StatusProcessor } from './status-processor';
import { WeatherProcessor } from './weather-processor';
import { AbilityDispatcher } from './ability-dispatcher';
import { HazardProcessor } from './hazard-processor';
import { SwitchProcessor } from './switch-processor';
import { MoveExecutor } from './move-executor';
import { TurnResolver } from './turn-resolver';
import { validateActions } from './action-validator';
import { registerAllAbilityHandlers } from '../data/ability-handlers';

export class BattleEngine {
  private state: BattleState;
  private eventBus: EventBus;
  private rng: SeededRNG;
  private statusProcessor: StatusProcessor;
  private weatherProcessor: WeatherProcessor;
  private abilityDispatcher: AbilityDispatcher;
  private hazardProcessor: HazardProcessor;
  private switchProcessor: SwitchProcessor;
  private moveExecutor: MoveExecutor;
  private turnResolver: TurnResolver;
  private pendingActions: Map<PlayerIndex, TurnAction[]> = new Map();

  constructor(config: BattleConfig) {
    // Register ability handlers
    registerAllAbilityHandlers();

    this.eventBus = new EventBus();
    this.rng = new SeededRNG(config.seed ?? Date.now());

    // Initialize processors
    this.statusProcessor = new StatusProcessor(this.eventBus, this.rng);
    this.weatherProcessor = new WeatherProcessor(this.eventBus);
    this.abilityDispatcher = new AbilityDispatcher(this.eventBus);
    this.hazardProcessor = new HazardProcessor(this.eventBus);
    this.switchProcessor = new SwitchProcessor(this.eventBus, this.hazardProcessor, this.abilityDispatcher);
    this.moveExecutor = new MoveExecutor(
      this.eventBus, this.rng, this.statusProcessor,
      this.abilityDispatcher, this.hazardProcessor, this.weatherProcessor,
    );
    this.moveExecutor.setSwitchProcessor(this.switchProcessor);
    this.turnResolver = new TurnResolver(
      this.eventBus, this.rng, this.moveExecutor,
      this.switchProcessor, this.statusProcessor, this.abilityDispatcher,
    );

    // Initialize battle state
    const players = config.players.map((pConfig, i) => {
      const team = pConfig.team.map((pokemonConfig, j) =>
        createPokemonBattleState(pokemonConfig, j),
      );
      return {
        index: i as PlayerIndex,
        name: pConfig.name,
        team,
        activePokemon: [] as number[],
      } as PlayerState;
    }) as [PlayerState, PlayerState];

    this.state = {
      config,
      turn: 0,
      phase: 'not-started' as BattlePhase,
      players,
      field: createFieldState(),
      actionQueue: [],
      log: [],
      winner: null,
      isOver: false,
      rngState: this.rng.getState(),
    };
  }

  startBattle(): BattleEvent[] {
    if (this.state.phase !== 'not-started') {
      throw new Error('Battle already started');
    }

    this.eventBus.clearLog();

    this.eventBus.emit({
      kind: 'battle-start',
      turn: 0,
      format: this.state.config.format,
      players: [this.state.players[0].name, this.state.players[1].name],
    });

    const slotsPerPlayer = this.state.config.format === 'doubles' ? 2 : 1;

    // Send out initial pokemon
    for (let p = 0; p < 2; p++) {
      const player = this.state.players[p as PlayerIndex];
      for (let s = 0; s < slotsPerPlayer && s < player.team.length; s++) {
        player.activePokemon.push(s);
      }
    }

    // Initial send-out: emit events and trigger abilities
    // Player 1 first, then player 2
    for (let p = 0; p < 2; p++) {
      const player = this.state.players[p as PlayerIndex];
      const opponents = this.getActiveOpponents(p as PlayerIndex);

      for (let s = 0; s < player.activePokemon.length; s++) {
        const teamIdx = player.activePokemon[s];
        this.switchProcessor.sendOutInitial(
          player, s, teamIdx, this.state.field, opponents, 0,
        );
      }
    }

    this.state.turn = 1;
    this.transitionTo('awaiting-actions');

    return this.eventBus.getLog();
  }

  submitAction(player: PlayerIndex, actions: TurnAction[]): boolean {
    if (this.state.phase !== 'awaiting-actions') {
      throw new Error(`Cannot submit actions in phase: ${this.state.phase}`);
    }

    const validation = validateActions(player, actions, this.state);
    if (!validation.valid) {
      throw new Error(`Invalid actions: ${validation.errors.join(', ')}`);
    }

    this.pendingActions.set(player, actions);

    return this.pendingActions.size === 2;
  }

  resolveTurn(): BattleEvent[] {
    if (this.state.phase !== 'awaiting-actions') {
      throw new Error(`Cannot resolve turn in phase: ${this.state.phase}`);
    }

    if (this.pendingActions.size !== 2) {
      throw new Error('Both players must submit actions before resolving');
    }

    this.eventBus.clearLog();
    this.transitionTo('resolving-turn');

    this.eventBus.emit({ kind: 'turn-start', turn: this.state.turn });

    // Clear protect status from previous turn
    for (const player of this.state.players) {
      for (const idx of player.activePokemon) {
        const pokemon = player.team[idx];
        if (pokemon) {
          removeVolatileStatus(pokemon, 'protect');
          removeVolatileStatus(pokemon, 'flinch');
        }
      }
    }

    // Collect all actions
    const allActions: TurnAction[] = [
      ...(this.pendingActions.get(0) ?? []),
      ...(this.pendingActions.get(1) ?? []),
    ];

    // Resolve actions
    this.turnResolver.resolveActions(allActions, this.state);

    if (!this.state.isOver) {
      // End of turn processing
      this.processEndOfTurn();
    }

    const currentTurn = this.state.turn;

    if (!this.state.isOver) {
      // Reset consecutiveProtectUse for pokemon that didn't use Protect this turn
      for (const player of this.state.players) {
        for (const idx of player.activePokemon) {
          const pokemon = player.team[idx];
          if (pokemon && !pokemon.isFainted && !hasVolatileStatus(pokemon, 'protect')) {
            pokemon.consecutiveProtectUse = 0;
          }
        }
      }

      this.eventBus.emit({ kind: 'turn-end', turn: currentTurn });

      // Check for forced switches
      const needsSwitch = this.checkForcedSwitches();
      if (needsSwitch.length > 0) {
        for (const ns of needsSwitch) {
          this.eventBus.emit({
            kind: 'force-switch-needed', turn: currentTurn,
            player: ns.player, slot: ns.slot,
          });
        }
        this.transitionTo('forced-switch');
      } else {
        this.state.turn++;
        this.transitionTo('awaiting-actions');
      }
    }

    this.pendingActions.clear();

    return this.eventBus.getLog();
  }

  submitSwitch(player: PlayerIndex, slot: number, switchToIndex: number): BattleEvent[] {
    if (this.state.phase !== 'forced-switch') {
      throw new Error(`Cannot submit switch in phase: ${this.state.phase}`);
    }

    this.eventBus.clearLog();

    const playerState = this.state.players[player];
    const opponents = this.getActiveOpponents(player);

    this.switchProcessor.performSwitch(
      playerState, slot, switchToIndex,
      this.state.field, opponents, this.state.turn,
    );

    // Check if more switches are needed
    const needsSwitch = this.checkForcedSwitches();
    if (needsSwitch.length === 0) {
      // Check win condition after switches
      const winner = this.checkWinCondition();
      if (winner !== null) {
        this.state.isOver = true;
        this.state.winner = winner === 'draw' ? null : winner;
        this.eventBus.emit({
          kind: 'battle-end', turn: this.state.turn,
          winner: winner === 'draw' ? null : winner, reason: 'all-fainted',
        });
        this.transitionTo('battle-over');
      } else {
        this.state.turn++;
        this.transitionTo('awaiting-actions');
      }
    }

    return this.eventBus.getLog();
  }

  private processEndOfTurn(): void {
    const turn = this.state.turn;

    // Weather damage
    if (this.state.field.weather) {
      const activePokemon = this.getAllActive();
      this.weatherProcessor.processEndOfTurn(this.state.field, activePokemon, turn);
    }

    // Status end-of-turn effects
    for (const player of this.state.players) {
      for (const slotIdx of player.activePokemon) {
        const pokemon = player.team[slotIdx];
        if (!pokemon || pokemon.isFainted) continue;

        const position: BattlePosition = { player: player.index, slot: pokemon.slotIndex };
        this.statusProcessor.processEndOfTurnStatus(
          pokemon, position, this.state.field.weather, turn,
        );
      }
    }

    // Held item end-of-turn effects (Leftovers)
    for (const player of this.state.players) {
      for (const idx of player.activePokemon) {
        const pokemon = player.team[idx];
        if (!pokemon || pokemon.isFainted) continue;
        if (pokemon.item === 'leftovers') {
          const healAmount = Math.max(1, Math.floor(pokemon.maxHp / 16));
          const healed = applyHeal(pokemon, healAmount);
          if (healed > 0) {
            const position: BattlePosition = { player: player.index, slot: pokemon.slotIndex };
            this.eventBus.emit({
              kind: 'heal', turn, target: position,
              amount: healed, currentHp: pokemon.currentHp, maxHp: pokemon.maxHp,
              source: 'item',
            });
          }
        }
      }
    }

    // Increment turnsSinceSwitch
    for (const player of this.state.players) {
      for (const idx of player.activePokemon) {
        const pokemon = player.team[idx];
        if (pokemon && !pokemon.isFainted) {
          pokemon.turnsSinceSwitch++;
        }
      }
    }

    // Weather tick
    this.weatherProcessor.processWeatherTick(this.state.field, turn);

    // Light Screen / Reflect / Tailwind countdown
    for (let p = 0; p < 2; p++) {
      const side = this.state.field.sides[p];
      if (side.lightScreen > 0) {
        side.lightScreen--;
        if (side.lightScreen === 0) {
          this.eventBus.emit({ kind: 'screen-end', turn, side: p as PlayerIndex, screen: 'lightScreen' });
        }
      }
      if (side.reflect > 0) {
        side.reflect--;
        if (side.reflect === 0) {
          this.eventBus.emit({ kind: 'screen-end', turn, side: p as PlayerIndex, screen: 'reflect' });
        }
      }
      if (side.tailwind > 0) {
        side.tailwind--;
        if (side.tailwind === 0) {
          this.eventBus.emit({ kind: 'screen-end', turn, side: p as PlayerIndex, screen: 'tailwind' });
        }
      }
    }

    // Terrain end-of-turn: Grassy Terrain heals grounded pokemon 1/16 HP
    if (this.state.field.terrain === 'grassy') {
      for (const player of this.state.players) {
        for (const idx of player.activePokemon) {
          const pokemon = player.team[idx];
          if (!pokemon || pokemon.isFainted) continue;
          // Grounded check: not Flying-type and not Levitate
          const isGrounded = !pokemon.species.types.includes('flying') && pokemon.ability !== 'levitate';
          if (isGrounded) {
            const healAmount = Math.max(1, Math.floor(pokemon.maxHp / 16));
            const healed = applyHeal(pokemon, healAmount);
            if (healed > 0) {
              this.eventBus.emit({
                kind: 'heal', turn, target: { player: player.index, slot: pokemon.slotIndex },
                amount: healed, currentHp: pokemon.currentHp, maxHp: pokemon.maxHp,
                source: 'terrain',
              });
            }
          }
        }
      }
    }

    // Terrain tick
    if (this.state.field.terrain) {
      this.state.field.terrainTurnsRemaining--;
      if (this.state.field.terrainTurnsRemaining <= 0) {
        const oldTerrain = this.state.field.terrain;
        this.state.field.terrain = null;
        this.state.field.terrainTurnsRemaining = 0;
        this.eventBus.emit({ kind: 'terrain-end', turn, terrain: oldTerrain });
      }
    }

    // Trick Room tick
    if (this.state.field.trickRoom > 0) {
      this.state.field.trickRoom--;
      if (this.state.field.trickRoom === 0) {
        this.eventBus.emit({ kind: 'message', turn, text: 'The twisted dimensions returned to normal!' });
      }
    }

    // Check win condition
    const winner = this.checkWinCondition();
    if (winner !== null) {
      this.state.isOver = true;
      this.state.winner = winner === 'draw' ? null : winner;
      this.eventBus.emit({
        kind: 'battle-end', turn,
        winner: winner === 'draw' ? null : winner, reason: 'all-fainted',
      });
      this.transitionTo('battle-over');
      return;
    }

    // maxTurns enforcement
    if (this.state.config.maxTurns && turn >= this.state.config.maxTurns) {
      this.state.isOver = true;
      this.state.winner = null;
      this.eventBus.emit({
        kind: 'battle-end', turn,
        winner: null, reason: 'turn-limit',
      });
      this.transitionTo('battle-over');
    }
  }

  private checkForcedSwitches(): { player: PlayerIndex; slot: number }[] {
    const needed: { player: PlayerIndex; slot: number }[] = [];

    for (const player of this.state.players) {
      for (let s = 0; s < player.activePokemon.length; s++) {
        const idx = player.activePokemon[s];
        const pokemon = player.team[idx];
        if (pokemon && pokemon.isFainted) {
          // Check if there's a non-fainted bench pokemon
          const hasBench = player.team.some((p, i) =>
            !p.isFainted && !p.isActive && !player.activePokemon.includes(i),
          );
          if (hasBench) {
            needed.push({ player: player.index, slot: s });
          }
        }
      }
    }

    return needed;
  }

  private checkWinCondition(): PlayerIndex | 'draw' | null {
    const p0AllFainted = this.state.players[0].team.every(p => p.isFainted);
    const p1AllFainted = this.state.players[1].team.every(p => p.isFainted);

    if (p0AllFainted && p1AllFainted) return 'draw';
    if (p0AllFainted) return 1 as PlayerIndex;
    if (p1AllFainted) return 0 as PlayerIndex;
    return null;
  }

  private getAllActive(): { pokemon: PokemonBattleState; position: BattlePosition }[] {
    const result: { pokemon: PokemonBattleState; position: BattlePosition }[] = [];
    for (const player of this.state.players) {
      for (let s = 0; s < player.activePokemon.length; s++) {
        const idx = player.activePokemon[s];
        const pokemon = player.team[idx];
        if (pokemon && !pokemon.isFainted) {
          result.push({
            pokemon,
            position: { player: player.index, slot: s },
          });
        }
      }
    }
    return result;
  }

  private getActiveOpponents(player: PlayerIndex): PokemonBattleState[] {
    const opponentIndex = player === 0 ? 1 : 0;
    const opponent = this.state.players[opponentIndex];
    return opponent.activePokemon
      .map(idx => opponent.team[idx])
      .filter((p): p is PokemonBattleState => p != null && !p.isFainted);
  }

  private transitionTo(phase: BattlePhase): void {
    this.state.phase = phase;
  }

  // --- Public getters ---

  getState(): Readonly<BattleState> {
    return this.state;
  }

  getPhase(): BattlePhase {
    return this.state.phase;
  }

  getTurn(): number {
    return this.state.turn;
  }

  isOver(): boolean {
    return this.state.isOver;
  }

  getWinner(): PlayerIndex | null {
    return this.state.winner;
  }

  getPlayer(index: PlayerIndex): Readonly<PlayerState> {
    return this.state.players[index];
  }

  getField(): Readonly<FieldState> {
    return this.state.field;
  }

  getActivePokemon(player: PlayerIndex, slot: number): PokemonBattleState | null {
    const playerState = this.state.players[player];
    const teamIdx = playerState.activePokemon[slot];
    return playerState.team[teamIdx] ?? null;
  }

  on<K extends BattleEvent['kind']>(
    kind: K,
    handler: (event: Extract<BattleEvent, { kind: K }>) => void,
  ): () => void {
    return this.eventBus.on(kind, handler);
  }

  onAny(handler: (event: BattleEvent) => void): () => void {
    return this.eventBus.onAny(handler);
  }

  /**
   * Returns the available actions for a player in the current turn.
   * A UI should use this to determine what moves, switches, etc. are legal.
   */
  getAvailableActions(player: PlayerIndex): {
    slot: number;
    canMove: { moveIndex: number; moveId: string; moveName: string; moveType: string; moveTarget: string; pp: number; maxPp: number }[];
    canSwitch: { teamIndex: number; pokemonName: string; speciesId: string; currentHp: number; maxHp: number }[];
  }[] {
    const playerState = this.state.players[player];
    const result: ReturnType<BattleEngine['getAvailableActions']> = [];

    for (let s = 0; s < playerState.activePokemon.length; s++) {
      const teamIdx = playerState.activePokemon[s];
      const pokemon = playerState.team[teamIdx];
      if (!pokemon || pokemon.isFainted) continue;

      // Available moves
      const canMove: { moveIndex: number; moveId: string; moveName: string; moveType: string; moveTarget: string; pp: number; maxPp: number }[] = [];
      for (let mi = 0; mi < pokemon.moves.length; mi++) {
        const ms = pokemon.moves[mi];
        if (ms.currentPp <= 0) continue;
        if (ms.disabled) continue;
        // Choice lock: can only use the locked move
        if (pokemon.choiceLocked && ms.moveId !== pokemon.choiceLocked) continue;
        // Charge move: must continue charging
        if (pokemon.chargeMoveId && ms.moveId !== pokemon.chargeMoveId) continue;

        const moveData = getMove(ms.moveId);
        canMove.push({
          moveIndex: mi,
          moveId: ms.moveId,
          moveName: moveData.name,
          moveType: moveData.type,
          moveTarget: moveData.target,
          pp: ms.currentPp,
          maxPp: ms.maxPp,
        });
      }

      // Available switches
      const canSwitch: { teamIndex: number; pokemonName: string; speciesId: string; currentHp: number; maxHp: number }[] = [];
      for (let ti = 0; ti < playerState.team.length; ti++) {
        const teamMember = playerState.team[ti];
        if (teamMember.isFainted) continue;
        if (teamMember.isActive) continue;
        if (playerState.activePokemon.includes(ti)) continue;
        canSwitch.push({
          teamIndex: ti,
          pokemonName: getPokemonName(teamMember),
          speciesId: teamMember.species.id,
          currentHp: teamMember.currentHp,
          maxHp: teamMember.maxHp,
        });
      }

      result.push({ slot: s, canMove, canSwitch });
    }

    return result;
  }

  /**
   * Returns which player/slot pairs still need to submit a forced switch.
   */
  getPendingForcedSwitches(): { player: PlayerIndex; slot: number }[] {
    if (this.state.phase !== 'forced-switch') return [];
    return this.checkForcedSwitches();
  }

  /**
   * Submit a forfeit for a player, ending the battle immediately.
   */
  forfeit(player: PlayerIndex): BattleEvent[] {
    if (this.state.isOver) throw new Error('Battle is already over');

    this.eventBus.clearLog();
    const winner = (player === 0 ? 1 : 0) as PlayerIndex;
    this.state.isOver = true;
    this.state.winner = winner;
    this.eventBus.emit({
      kind: 'battle-end', turn: this.state.turn,
      winner, reason: 'forfeit',
    });
    this.transitionTo('battle-over');
    return this.eventBus.getLog();
  }
}
