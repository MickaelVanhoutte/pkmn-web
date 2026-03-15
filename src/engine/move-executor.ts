import type {
  PokemonBattleState, BattlePosition, MoveData, TypeName,
  Weather, BattleFormat, MajorStatus,
} from '../types';
import type { FieldState, PlayerState, SideState } from '../types/battle';
import { STATUS_STAT_REDUCTION } from '../types/common';
import { getMove } from '../data/move-registry';
import { calculateDamage, getWeatherModifier, getCriticalHitStage } from './damage-calc';
import { getStatStageMultiplier, getAccuracyEvasionMultiplier } from '../utils/stat-calc';
import {
  applyDamage, applyHeal, setStatus, getPokemonName,
  addVolatileStatus, hasVolatileStatus, removeVolatileStatus,
} from '../model/pokemon';
import { getSide, getOpposingSide } from '../model/field';
import { StatusProcessor } from './status-processor';
import { AbilityDispatcher } from './ability-dispatcher';
import { HazardProcessor } from './hazard-processor';
import { WeatherProcessor } from './weather-processor';
import type { SwitchProcessor } from './switch-processor';
import type { EventBus } from '../events/event-bus';
import type { SeededRNG } from './rng';

export class MoveExecutor {
  private switchProcessor: SwitchProcessor | null = null;

  constructor(
    private eventBus: EventBus,
    private rng: SeededRNG,
    private statusProcessor: StatusProcessor,
    private abilityDispatcher: AbilityDispatcher,
    private hazardProcessor: HazardProcessor,
    private weatherProcessor: WeatherProcessor,
  ) {}

  setSwitchProcessor(sp: SwitchProcessor): void {
    this.switchProcessor = sp;
  }

  executeMove(
    user: PokemonBattleState,
    userPosition: BattlePosition,
    targets: { pokemon: PokemonBattleState; position: BattlePosition }[],
    moveIndex: number,
    field: FieldState,
    players: [PlayerState, PlayerState],
    format: BattleFormat,
    turn: number,
  ): void {
    const moveState = user.moves[moveIndex];
    if (!moveState || moveState.currentPp <= 0) {
      this.eventBus.emit({ kind: 'fail', turn, user: userPosition, reason: 'No PP left!' });
      return;
    }

    const moveData = getMove(moveState.moveId);

    // Charge move: check if this is the charge turn or execution turn
    const hasChargeEffect = moveData.effects.some(e => e.type === 'charge-turn');
    if (hasChargeEffect && !hasVolatileStatus(user, 'chargeMove')) {
      // Solar Beam skips charge in Sun
      const skipCharge = moveData.id === 'solar-beam' && field.weather === 'sun';

      if (!skipCharge) {
        // Charge turn: deduct PP, set charge state, return
        moveState.currentPp--;
        addVolatileStatus(user, 'chargeMove');
        user.chargeMoveId = moveData.id;
        user.chargeMoveTargetPos = targets.length > 0 ? targets[0].position : null;

        // Fly: set semi-invulnerable during charge
        if (moveData.id === 'fly') {
          addVolatileStatus(user, 'semiInvulnerable');
        }

        this.eventBus.emit({
          kind: 'move-use', turn, user: userPosition,
          moveName: moveData.name, moveId: moveData.id,
          moveType: moveData.type, targets: targets.map(t => t.position),
        });
        this.eventBus.emit({
          kind: 'charging', turn, user: userPosition,
          moveName: moveData.name, moveId: moveData.id,
        });
        user.lastMoveUsed = moveData.id;
        return;
      }
      // skipCharge: fall through to execute immediately (still deduct PP below)
    }
    // Execution turn: clear charge state, proceed normally
    const isChargeExecutionTurn = hasVolatileStatus(user, 'chargeMove');
    if (isChargeExecutionTurn) {
      removeVolatileStatus(user, 'chargeMove');
      removeVolatileStatus(user, 'semiInvulnerable');
      user.chargeMoveId = null;
      user.chargeMoveTargetPos = null;
    }

    // Deduct PP:
    // - Normal moves: always deduct
    // - Charge moves on execution turn: already deducted during charge turn, skip
    // - Charge moves that skip charge (e.g. Solar Beam in Sun): deduct here since charge turn was skipped
    if (!isChargeExecutionTurn) {
      moveState.currentPp--;
    }

    // Pressure: extra PP deduction (max 1 extra regardless of number of Pressure targets)
    const hasPressureTarget = targets.some(t => t.pokemon.ability === 'pressure' && !t.pokemon.isFainted);
    if (hasPressureTarget) {
      moveState.currentPp = Math.max(0, moveState.currentPp - 1);
    }

    // Emit move use
    this.eventBus.emit({
      kind: 'move-use',
      turn,
      user: userPosition,
      moveName: moveData.name,
      moveId: moveData.id,
      moveType: moveData.type,
      targets: targets.map(t => t.position),
    });

    // Handle self-targeting moves
    if (moveData.target === 'self') {
      this.executeSelfMove(user, userPosition, moveData, field, turn);
      user.lastMoveUsed = moveData.id;
      return;
    }

    // Handle field-targeting moves (weather)
    if (moveData.target === 'all-field') {
      this.executeFieldMove(moveData, field, turn);
      user.lastMoveUsed = moveData.id;
      return;
    }

    // Handle side-targeting moves (hazards)
    if (moveData.target === 'foe-side') {
      this.executeSideMove(userPosition, moveData, field, turn);
      user.lastMoveUsed = moveData.id;
      return;
    }

    // Handle ally-side targeting moves (screens)
    if (moveData.target === 'ally-side') {
      this.executeAllySideMove(userPosition, moveData, field, turn);
      user.lastMoveUsed = moveData.id;
      return;
    }

    const isSpread = ['all-adjacent-foes', 'all-adjacent'].includes(moveData.target);
    const hitCount = this.getHitCount(moveData);

    // Execute against each target (multi-hit wraps around)
    let actualHits = 0;
    for (let hit = 0; hit < hitCount; hit++) {
      let anyHit = false;
      for (const target of targets) {
        if (target.pokemon.isFainted) continue;

        this.executeMoveAgainstTarget(
          user, userPosition, target.pokemon, target.position,
          moveData, field, players, format, isSpread, turn,
          hit > 0, // skipAccuracyCheck: subsequent hits auto-land
        );
        anyHit = true;
      }
      if (!anyHit) break; // All targets fainted
      actualHits++;
    }

    if (hitCount > 1) {
      for (const target of targets) {
        this.eventBus.emit({ kind: 'multi-hit-complete', turn, target: target.position, hitCount: actualHits });
      }
    }

    // Life Orb recoil: once per move use, only if the move dealt damage
    if (user.item === 'life-orb' && actualHits > 0 && !user.isFainted) {
      const recoil = Math.max(1, Math.floor(user.maxHp / 10));
      const recoilActual = applyDamage(user, recoil);
      if (recoilActual > 0) {
        this.eventBus.emit({
          kind: 'damage', turn, target: userPosition,
          amount: recoilActual, currentHp: user.currentHp, maxHp: user.maxHp,
          source: 'recoil',
        });
        if (user.isFainted) {
          this.eventBus.emit({ kind: 'faint', turn, target: userPosition, pokemonName: getPokemonName(user) });
        }
      }
    }

    user.lastMoveUsed = moveData.id;

    // Choice item locking
    if (user.item && ['choice-band', 'choice-specs', 'choice-scarf'].includes(user.item)) {
      user.choiceLocked = moveData.id;
    }
  }

  private executeMoveAgainstTarget(
    user: PokemonBattleState,
    userPos: BattlePosition,
    target: PokemonBattleState,
    targetPos: BattlePosition,
    move: MoveData,
    field: FieldState,
    players: [PlayerState, PlayerState],
    format: BattleFormat,
    isSpread: boolean,
    turn: number,
    skipAccuracyCheck: boolean = false,
  ): void {
    // Semi-invulnerable check (Fly charge turn)
    if (hasVolatileStatus(target, 'semiInvulnerable')) {
      this.eventBus.emit({ kind: 'miss', turn, user: userPos, target: targetPos, moveId: move.id });
      return;
    }

    // Check protect
    if (hasVolatileStatus(target, 'protect') && move.flags.isProtectable) {
      this.eventBus.emit({ kind: 'fail', turn, user: userPos, reason: `${getPokemonName(target)} protected itself!` });
      return;
    }

    // Ability: onTryHit (e.g., Levitate, Water Absorb)
    const tryHitResults = this.abilityDispatcher.dispatch('onTryHit', target, targetPos, {
      source: target,
      move,
      target: user,
    }, turn);
    const shouldBlock = tryHitResults.some(r => r.action === 'prevent' || r.action === 'heal');
    if (shouldBlock) {
      for (const r of tryHitResults) {
        if (r.action === 'heal') {
          const healed = applyHeal(target, r.amount);
          if (healed > 0) {
            this.eventBus.emit({
              kind: 'heal', turn, target: targetPos,
              amount: healed, currentHp: target.currentHp, maxHp: target.maxHp,
              source: 'ability',
            });
          }
        }
      }
      this.eventBus.emit({ kind: 'immunity', turn, target: targetPos, reason: `${getPokemonName(target)}'s ${target.ability}!` });
      return;
    }

    // Accuracy check (for moves with accuracy, skip for subsequent multi-hit)
    if (move.accuracy !== null && !skipAccuracyCheck) {
      // Weather-accuracy overrides
      let weatherAccOverride: number | null = null;
      if (field.weather === 'rain' && (move.id === 'thunder' || move.id === 'hurricane')) {
        weatherAccOverride = 100; // Never miss in rain
      } else if (field.weather === 'sun' && (move.id === 'thunder' || move.id === 'hurricane')) {
        weatherAccOverride = 50; // 50% accuracy in sun
      } else if (field.weather === 'hail' && move.id === 'blizzard') {
        weatherAccOverride = 100; // Never miss in hail
      }

      const baseAcc = weatherAccOverride ?? move.accuracy;
      const accStage = user.statStages.accuracy;
      const evaStage = target.statStages.evasion;
      const accMult = getAccuracyEvasionMultiplier(accStage);
      const evaMult = getAccuracyEvasionMultiplier(-evaStage);
      const finalAcc = baseAcc * accMult * evaMult;

      if (!this.rng.chance(finalAcc)) {
        this.eventBus.emit({ kind: 'miss', turn, user: userPos, target: targetPos, moveId: move.id });
        return;
      }
    }

    // Substitute blocks status moves (except sound-based)
    if (move.category === 'status' && hasVolatileStatus(target, 'substitute') && !move.sound) {
      this.eventBus.emit({ kind: 'substitute-blocked', turn, target: targetPos });
      return;
    }

    // Status moves
    if (move.category === 'status') {
      this.applyMoveEffects(user, userPos, target, targetPos, move, 0, field, players, turn);
      return;
    }

    // Calculate damage
    const damageResult = this.calculateMoveDamage(
      user, target, targetPos, move, field, format, isSpread, turn,
    );

    if (damageResult.effectiveness === 0) {
      this.eventBus.emit({ kind: 'immunity', turn, target: targetPos, reason: "It doesn't affect " + getPokemonName(target) + '...' });
      return;
    }

    // Sturdy check
    if (target.ability === 'sturdy' && target.currentHp === target.maxHp && damageResult.damage >= target.currentHp) {
      damageResult.damage = target.currentHp - 1;
      this.eventBus.emit({
        kind: 'ability-activate', turn, pokemon: targetPos,
        abilityId: target.ability, abilityName: 'Sturdy',
        message: `${getPokemonName(target)} hung on using Sturdy!`,
      });
    }

    // Focus Sash check (same as Sturdy but consumes the item)
    if (target.item === 'focus-sash' && target.currentHp === target.maxHp && damageResult.damage >= target.currentHp) {
      damageResult.damage = target.currentHp - 1;
      target.item = null;
      this.eventBus.emit({
        kind: 'item-used', turn, player: targetPos.player,
        itemId: 'focus-sash', itemName: 'Focus Sash', target: targetPos,
      });
    }

    // Multiscale
    const defenderDamageMod = this.abilityDispatcher.getModifier('modifyDamage', target, {
      source: target,
      move,
      damage: damageResult.damage,
    });
    if (defenderDamageMod !== 1) {
      damageResult.damage = Math.max(1, Math.floor(damageResult.damage * defenderDamageMod));
    }

    if (damageResult.isCritical) {
      this.eventBus.emit({ kind: 'critical-hit', turn, target: targetPos });
    }

    if (damageResult.effectivenessLabel !== 'neutral') {
      this.eventBus.emit({
        kind: 'type-effectiveness', turn, target: targetPos,
        effectiveness: damageResult.effectivenessLabel,
      });
    }

    // Substitute damage interception (sound-based moves bypass substitute)
    const hitSubstitute = hasVolatileStatus(target, 'substitute') && !move.sound;

    if (hitSubstitute) {
      // Damage goes to substitute
      const subDamage = Math.min(damageResult.damage, target.substituteHp);
      target.substituteHp -= subDamage;

      this.eventBus.emit({
        kind: 'damage', turn, target: targetPos,
        amount: subDamage, currentHp: target.currentHp, maxHp: target.maxHp,
        source: 'move',
      });

      if (target.substituteHp <= 0) {
        target.substituteHp = 0;
        removeVolatileStatus(target, 'substitute');
        this.eventBus.emit({ kind: 'substitute-broken', turn, target: targetPos });
      }

      // No secondary effects, no contact abilities through substitute
      return;
    }

    // Apply damage directly
    const actual = applyDamage(target, damageResult.damage);

    this.eventBus.emit({
      kind: 'damage', turn, target: targetPos,
      amount: actual, currentHp: target.currentHp, maxHp: target.maxHp,
      source: 'move',
    });

    // Check move-based status curing (e.g., water move cures burn)
    this.statusProcessor.checkMoveCure(target, move.type, targetPos, turn);

    // Apply secondary effects
    this.applyMoveEffects(user, userPos, target, targetPos, move, actual, field, players, turn);

    // onBeingHit abilities (Static, etc.)
    if (move.contact && !target.isFainted) {
      const hitResults = this.abilityDispatcher.dispatch('onBeingHit', target, targetPos, {
        source: target,
        target: user,
        move,
      }, turn);

      for (const r of hitResults) {
        if (r.action === 'inflict-status' && !user.isFainted && !user.status) {
          if (this.rng.chance(30)) {
            const didApply = setStatus(user, r.status);
            if (didApply) {
              this.eventBus.emit({
                kind: 'status-applied', turn, target: userPos,
                status: r.status, pokemonName: getPokemonName(user),
              });
            }
          }
        }
      }
    }

    // Check faint
    if (target.isFainted) {
      this.eventBus.emit({
        kind: 'faint', turn, target: targetPos,
        pokemonName: getPokemonName(target),
      });
    }

    // Life Orb recoil is handled in executeMove after all hits/targets
  }

  private calculateMoveDamage(
    user: PokemonBattleState,
    target: PokemonBattleState,
    targetPos: BattlePosition,
    move: MoveData,
    field: FieldState,
    format: BattleFormat,
    isSpread: boolean,
    turn: number,
  ): { damage: number; effectiveness: number; effectivenessLabel: 'immune' | 'not-very-effective' | 'neutral' | 'super-effective'; isCritical: boolean } {
    const isPhysical = move.category === 'physical';
    const atkStat = isPhysical ? 'atk' : 'spa';
    const defStat = isPhysical ? 'def' : 'spd';

    // Critical hit check
    let critStage = 0;
    if (hasVolatileStatus(user, 'focusEnergy')) critStage += 2;
    const critChance = getCriticalHitStage(critStage);
    const isCritical = this.rng.next() < critChance;

    // Get attack stat with stages
    let atkStage = isCritical ? Math.max(0, user.statStages[atkStat]) : user.statStages[atkStat];
    let attack = Math.floor(user.calculatedStats[atkStat] * getStatStageMultiplier(atkStage));

    // Get defense stat with stages
    let defStage = isCritical ? Math.min(0, target.statStages[defStat]) : target.statStages[defStat];
    let defense = Math.floor(target.calculatedStats[defStat] * getStatStageMultiplier(defStage));

    // Status stat reductions
    if (user.status && user.status !== 'sleep') {
      const reduction = STATUS_STAT_REDUCTION[user.status];
      if (reduction === atkStat) {
        attack = Math.floor(attack * 0.5);
      }
    }
    if (target.status && target.status !== 'sleep') {
      const reduction = STATUS_STAT_REDUCTION[target.status];
      if (reduction === defStat) {
        defense = Math.floor(defense * 0.5);
      }
    }

    // Ability modifiers on attack
    const atkAbilityMod = this.abilityDispatcher.getModifier(
      isPhysical ? 'modifyAtk' : 'modifySpa', user,
      { source: user, move, weather: field.weather },
    );
    attack = Math.floor(attack * atkAbilityMod);

    // Ability modifiers on defense
    const defAbilityMod = this.abilityDispatcher.getModifier(
      isPhysical ? 'modifyDef' : 'modifySpd', target,
      { source: target, move, weather: field.weather },
    );
    defense = Math.floor(defense * defAbilityMod);

    // Speed ability modifier for weather (chlorophyll, swift swim)
    // Not needed here, used in turn order

    // Sandstorm SpDef boost for Rock types
    if (field.weather === 'sandstorm' && !isPhysical) {
      const targetTypes = target.species.types as TypeName[];
      if (targetTypes.includes('rock')) {
        defense = Math.floor(defense * 1.5);
      }
    }

    // Screen damage reduction (crits bypass screens)
    let screenMod = 1.0;
    if (!isCritical) {
      const targetSide = getSide(field, targetPos.player);
      if (isPhysical && targetSide.reflect > 0) {
        screenMod = format === 'doubles' ? 2 / 3 : 0.5;
      } else if (!isPhysical && targetSide.lightScreen > 0) {
        screenMod = format === 'doubles' ? 2 / 3 : 0.5;
      }
    }

    // Terrain damage modifier
    let terrainMod = 1.0;
    if (field.terrain) {
      const userGrounded = this.isGrounded(user);
      const targetGrounded = this.isGrounded(target);
      if (field.terrain === 'electric' && move.type === 'electric' && userGrounded) {
        terrainMod = 1.3;
      } else if (field.terrain === 'grassy' && move.type === 'grass' && userGrounded) {
        terrainMod = 1.3;
      } else if (field.terrain === 'psychic' && move.type === 'psychic' && userGrounded) {
        terrainMod = 1.3;
      } else if (field.terrain === 'misty' && move.type === 'dragon' && targetGrounded) {
        terrainMod = 0.5;
      }
    }

    // STAB
    const userTypes = user.species.types as TypeName[];
    const stab = userTypes.includes(move.type);

    // Choice Band/Specs stat boost
    if (user.item === 'choice-band' && isPhysical) {
      attack = Math.floor(attack * 1.5);
    } else if (user.item === 'choice-specs' && !isPhysical) {
      attack = Math.floor(attack * 1.5);
    }

    // Ability damage modifier (Blaze, Technician, etc.)
    const abilityDamageMod = this.abilityDispatcher.getModifier('modifyDamage', user, {
      source: user,
      target,
      move,
      weather: field.weather,
    });

    // Life Orb damage boost
    const lifeOrbMod = user.item === 'life-orb' ? 1.3 : 1.0;

    // Effective power adjustments
    let effectivePower = move.power ?? 0;

    // Solar Beam halved power in Rain, Sandstorm, Hail
    if (move.id === 'solar-beam' && field.weather && ['rain', 'sandstorm', 'hail'].includes(field.weather)) {
      effectivePower = Math.floor(effectivePower / 2);
    }

    // Grassy Terrain halves Earthquake/Bulldoze power against grounded targets
    if (field.terrain === 'grassy' && move.type === 'ground' && move.category !== 'status') {
      if (this.isGrounded(target)) {
        effectivePower = Math.floor(effectivePower / 2);
      }
    }

    return calculateDamage({
      level: user.config.level,
      power: effectivePower,
      attack: Math.max(1, attack),
      defense: Math.max(1, defense),
      stab,
      moveType: move.type,
      defenderTypes: target.species.types as TypeName[],
      isCritical,
      weather: field.weather,
      isDoubles: format === 'doubles',
      isSpread,
      randomFactor: this.rng.damageRoll(),
      otherModifiers: abilityDamageMod * screenMod * terrainMod * lifeOrbMod,
    });
  }


  private executeSelfMove(
    user: PokemonBattleState,
    userPos: BattlePosition,
    move: MoveData,
    field: FieldState,
    turn: number,
  ): void {
    for (const effect of move.effects) {
      if (effect.target !== 'self') continue;
      if (!this.rng.chance(effect.chance)) continue;

      switch (effect.type) {
        case 'protect': {
          // Consecutive-use failure: 1/(3^n) chance of success on nth consecutive use
          const protectChance = Math.pow(3, -user.consecutiveProtectUse) * 100;
          if (!this.rng.chance(protectChance)) {
            user.consecutiveProtectUse++;
            this.eventBus.emit({ kind: 'fail', turn, user: userPos, reason: 'But it failed!' });
            break;
          }
          user.consecutiveProtectUse++;
          addVolatileStatus(user, 'protect');
          this.eventBus.emit({ kind: 'message', turn, text: `${getPokemonName(user)} protected itself!` });
          break;
        }

        case 'heal': {
          const amount = Math.floor(user.maxHp * (effect.value ?? 50) / 100);
          const healed = applyHeal(user, amount);
          if (healed > 0) {
            this.eventBus.emit({
              kind: 'heal', turn, target: userPos,
              amount: healed, currentHp: user.currentHp, maxHp: user.maxHp,
              source: 'move',
            });
          }
          break;
        }

        case 'stat-change':
          if (effect.stat && effect.value) {
            this.applyStatChange(user, userPos, effect.stat, effect.value, turn);
          }
          break;

        case 'substitute': {
          if (hasVolatileStatus(user, 'substitute')) {
            this.eventBus.emit({ kind: 'fail', turn, user: userPos, reason: `${getPokemonName(user)} already has a substitute!` });
            break;
          }
          const cost = Math.floor(user.maxHp / 4);
          if (user.currentHp <= cost) {
            this.eventBus.emit({ kind: 'fail', turn, user: userPos, reason: `${getPokemonName(user)} is too weak to make a substitute!` });
            break;
          }
          applyDamage(user, cost);
          user.substituteHp = cost;
          addVolatileStatus(user, 'substitute');
          this.eventBus.emit({ kind: 'substitute-created', turn, target: userPos, hpCost: cost });
          break;
        }
      }
    }
  }

  private executeFieldMove(move: MoveData, field: FieldState, turn: number): void {
    for (const effect of move.effects) {
      if (effect.type === 'set-weather' && effect.weather) {
        this.weatherProcessor.setWeather(
          field,
          effect.weather as Weather,
          5,
          turn,
        );
      }
      if (effect.type === 'set-terrain' && effect.terrain) {
        field.terrain = effect.terrain as any;
        field.terrainTurnsRemaining = 5;
        this.eventBus.emit({
          kind: 'terrain-set', turn,
          terrain: field.terrain!,
          turns: 5,
        });
      }
    }
  }

  private executeSideMove(
    userPos: BattlePosition,
    move: MoveData,
    field: FieldState,
    turn: number,
  ): void {
    const targetSideIndex = userPos.player === 0 ? 1 : 0;
    const targetSide = getSide(field, targetSideIndex as 0 | 1);

    for (const effect of move.effects) {
      if (effect.type === 'set-hazard' && effect.hazard) {
        this.hazardProcessor.setHazard(targetSide, effect.hazard, targetSideIndex as 0 | 1, turn);
      }
    }
  }

  private executeAllySideMove(
    userPos: BattlePosition,
    move: MoveData,
    field: FieldState,
    turn: number,
  ): void {
    const side = getSide(field, userPos.player);

    for (const effect of move.effects) {
      if (effect.type === 'set-screen' && effect.screen) {
        if (side[effect.screen] > 0) {
          this.eventBus.emit({ kind: 'fail', turn, user: userPos, reason: 'The screen is already active!' });
          return;
        }
        side[effect.screen] = 5;
        this.eventBus.emit({
          kind: 'screen-set', turn,
          side: userPos.player,
          screen: effect.screen,
          turns: 5,
        });
      }
    }
  }

  private applyMoveEffects(
    user: PokemonBattleState,
    userPos: BattlePosition,
    target: PokemonBattleState,
    targetPos: BattlePosition,
    move: MoveData,
    damageDealt: number,
    field: FieldState,
    players: [PlayerState, PlayerState],
    turn: number,
  ): void {
    // Serene Grace doubles secondary effect chances
    const chanceMultiplier = user.ability === 'serene-grace' ? 2 : 1;

    for (const effect of move.effects) {
      const adjustedChance = Math.min(100, effect.chance * chanceMultiplier);
      if (!this.rng.chance(adjustedChance)) continue;

      const effectTarget = effect.target === 'self' ? user : target;
      const effectTargetPos = effect.target === 'self' ? userPos : targetPos;

      switch (effect.type) {
        case 'inflict-status':
          if (effect.status && !effectTarget.isFainted) {
            // Misty Terrain blocks status for grounded pokemon
            if (field.terrain === 'misty' && this.isGrounded(effectTarget)) {
              this.eventBus.emit({ kind: 'fail', turn, user: userPos, reason: `The Misty Terrain prevents status conditions!` });
              break;
            }
            // Electric Terrain prevents sleep on grounded pokemon
            if (field.terrain === 'electric' && effect.status === 'sleep' && this.isGrounded(effectTarget)) {
              this.eventBus.emit({ kind: 'fail', turn, user: userPos, reason: `The Electric Terrain prevents sleep!` });
              break;
            }
            // Type immunities for status
            const targetTypes = effectTarget.species.types as TypeName[];
            if (effect.status === 'burn' && targetTypes.includes('fire')) break;
            if (effect.status === 'paralysis' && targetTypes.includes('electric')) break;
            if (effect.status === 'poison' && (targetTypes.includes('poison') || targetTypes.includes('steel'))) break;
            if (effect.status === 'freeze' && targetTypes.includes('ice')) break;

            const didApply = setStatus(effectTarget, effect.status);
            if (didApply) {
              this.eventBus.emit({
                kind: 'status-applied', turn, target: effectTargetPos,
                status: effect.status, pokemonName: getPokemonName(effectTarget),
              });
            }
          }
          break;

        case 'stat-change':
          if (effect.stat && effect.value && !effectTarget.isFainted) {
            // Check Clear Body
            if (effect.value < 0 && this.abilityDispatcher.shouldPrevent('onStatChange', effectTarget, {
              source: effectTarget,
              statChange: { stat: effect.stat, stages: effect.value },
            })) {
              this.eventBus.emit({ kind: 'message', turn, text: `${getPokemonName(effectTarget)}'s ${effectTarget.ability} prevents stat reduction!` });
              break;
            }
            this.applyStatChange(effectTarget, effectTargetPos, effect.stat, effect.value, turn);
          }
          break;

        case 'recoil':
          if (damageDealt > 0 && effect.value) {
            const recoil = Math.max(1, Math.floor(damageDealt * effect.value / 100));
            const actual = applyDamage(user, recoil);
            this.eventBus.emit({
              kind: 'damage', turn, target: userPos,
              amount: actual, currentHp: user.currentHp, maxHp: user.maxHp,
              source: 'recoil',
            });
            if (user.isFainted) {
              this.eventBus.emit({ kind: 'faint', turn, target: userPos, pokemonName: getPokemonName(user) });
            }
          }
          break;

        case 'drain':
          if (damageDealt > 0 && effect.value) {
            const drain = Math.max(1, Math.floor(damageDealt * effect.value / 100));
            const healed = applyHeal(user, drain);
            if (healed > 0) {
              this.eventBus.emit({
                kind: 'heal', turn, target: userPos,
                amount: healed, currentHp: user.currentHp, maxHp: user.maxHp,
                source: 'drain',
              });
            }
          }
          break;

        case 'flinch':
          if (!effectTarget.isFainted) {
            // Inner Focus prevents flinch
            if (effectTarget.ability === 'inner-focus') break;
            addVolatileStatus(effectTarget, 'flinch');
          }
          break;

        case 'clear-hazards': {
          const userSide = getSide(field, userPos.player);
          this.hazardProcessor.clearHazards(userSide, userPos.player, turn);
          break;
        }

        case 'set-weather':
          if (effect.weather) {
            this.weatherProcessor.setWeather(field, effect.weather as Weather, 5, turn);
          }
          break;

        case 'set-hazard':
          if (effect.hazard) {
            const side = getOpposingSide(field, userPos.player);
            const oppPlayer = (userPos.player === 0 ? 1 : 0) as 0 | 1;
            this.hazardProcessor.setHazard(side, effect.hazard, oppPlayer, turn);
          }
          break;

        case 'heal':
          if (effect.value) {
            const amount = Math.floor(effectTarget.maxHp * effect.value / 100);
            const healed = applyHeal(effectTarget, amount);
            if (healed > 0) {
              this.eventBus.emit({
                kind: 'heal', turn, target: effectTargetPos,
                amount: healed, currentHp: effectTarget.currentHp, maxHp: effectTarget.maxHp,
                source: 'move',
              });
            }
          }
          break;

        case 'force-switch':
          if (!effectTarget.isFainted && this.switchProcessor) {
            // Blocked by substitute (except sound-based moves)
            if (hasVolatileStatus(effectTarget, 'substitute') && !move.sound) {
              this.eventBus.emit({ kind: 'substitute-blocked', turn, target: effectTargetPos });
              break;
            }
            const targetPlayer = players[effectTargetPos.player];
            const opponents = players[effectTargetPos.player === 0 ? 1 : 0].team
              .filter(p => p.isActive && !p.isFainted);
            const switched = this.switchProcessor.forceRandomSwitch(
              targetPlayer, effectTargetPos.slot, field, opponents, this.rng, turn,
            );
            if (switched) {
              this.eventBus.emit({
                kind: 'force-switch', turn, target: effectTargetPos,
                reason: move.name,
              });
            } else {
              this.eventBus.emit({ kind: 'fail', turn, user: userPos, reason: 'But it failed!' });
            }
          }
          break;

        case 'inflict-confusion':
          if (!effectTarget.isFainted && !hasVolatileStatus(effectTarget, 'confusion')) {
            if (hasVolatileStatus(effectTarget, 'substitute') && effect.target === 'target') {
              this.eventBus.emit({ kind: 'substitute-blocked', turn, target: effectTargetPos });
              break;
            }
            // Misty Terrain prevents confusion on grounded pokemon
            if (field.terrain === 'misty' && this.isGrounded(effectTarget)) {
              this.eventBus.emit({ kind: 'fail', turn, user: userPos, reason: `The Misty Terrain prevents confusion!` });
              break;
            }
            addVolatileStatus(effectTarget, 'confusion');
            effectTarget.confusionTurns = 2 + Math.floor(this.rng.next() * 4); // 2-5 turns
            this.eventBus.emit({
              kind: 'confusion-start', turn, target: effectTargetPos,
              pokemonName: getPokemonName(effectTarget),
            });
          }
          break;
      }
    }
  }

  private getHitCount(move: MoveData): number {
    for (const effect of move.effects) {
      if (effect.type === 'multi-hit') {
        // Distribution: 2 hits (35%), 3 hits (35%), 4 hits (15%), 5 hits (15%)
        const roll = this.rng.next() * 100;
        if (roll < 35) return 2;
        if (roll < 70) return 3;
        if (roll < 85) return 4;
        return 5;
      }
      if (effect.type === 'fixed-multi-hit') {
        return effect.hits ?? 2;
      }
    }
    return 1;
  }

  executePursuitHit(
    user: PokemonBattleState,
    userPos: BattlePosition,
    target: PokemonBattleState,
    targetPos: BattlePosition,
    move: MoveData,
    field: FieldState,
    players: [PlayerState, PlayerState],
    format: BattleFormat,
    turn: number,
  ): void {
    this.executeMoveAgainstTarget(
      user, userPos, target, targetPos,
      move, field, players, format, false, turn, false,
    );
  }

  private isGrounded(pokemon: PokemonBattleState): boolean {
    return !pokemon.species.types.includes('flying') && pokemon.ability !== 'levitate';
  }

  private applyStatChange(
    pokemon: PokemonBattleState,
    position: BattlePosition,
    stat: string,
    stages: number,
    turn: number,
  ): void {
    const statKey = stat as keyof typeof pokemon.statStages;
    const old = pokemon.statStages[statKey];
    const newVal = Math.max(-6, Math.min(6, old + stages));

    if (newVal === old) {
      this.eventBus.emit({
        kind: 'message', turn,
        text: stages > 0
          ? `${getPokemonName(pokemon)}'s ${stat} won't go any higher!`
          : `${getPokemonName(pokemon)}'s ${stat} won't go any lower!`,
      });
      return;
    }

    pokemon.statStages[statKey] = newVal;
    this.eventBus.emit({
      kind: 'stat-change', turn, target: position,
      stat: statKey, stages, currentStage: newVal,
      pokemonName: getPokemonName(pokemon),
    });
  }
}
