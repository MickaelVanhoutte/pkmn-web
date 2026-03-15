import { el, clearChildren } from '../util/dom';
import { getSpriteUrl } from '../util/sprite-url';
import { getTypeColor, getTypeTextColor } from '../util/type-colors';
import { getAllSpecies } from '@/data/pokemon-registry';
import { getMove } from '@/data/move-registry';
import type { PokemonSpecies, PokemonConfig } from '@/types/pokemon';
import type { BattleConfig } from '@/types/battle';
import type { TypeName, BattleFormat, MoveId, StatName } from '@/types/common';
import type { MoveData } from '@/types/move';
import type { NavigateFn } from '../main';

interface SelectedPokemon {
  species: PokemonSpecies;
  selectedMoves: MoveId[];
}

const STAT_NAMES: StatName[] = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
const STAT_LABELS: Record<StatName, string> = {
  hp: 'HP',
  atk: 'ATK',
  def: 'DEF',
  spa: 'SPA',
  spd: 'SPD',
  spe: 'SPE',
};

const MAX_TEAM_SIZE = 6;
const MAX_MOVES = 4;
const LEVEL = 50;

export function showTeamSelect(
  container: HTMLElement,
  navigate: NavigateFn,
  params: { format: BattleFormat },
): () => void {
  const allSpecies = getAllSpecies();
  const selected = new Map<string, SelectedPokemon>();
  let configuredId: string | null = null;

  // ── Header ──
  const headerTitle = el('span', { class: 'team-select-title' }, ['SELECT YOUR TEAM']);
  const headerSubtitle = el('span', { class: 'team-select-subtitle' }, [
    params.format.toUpperCase(),
  ]);
  const header = el('div', { class: 'team-select-header' }, [headerTitle, headerSubtitle]);

  // ── Pokemon grid ──
  const grid = el('div', { class: 'pokemon-grid' });
  const gridWrapper = el('div', { class: 'pokemon-grid-wrapper' }, [grid]);

  function renderGrid(): void {
    clearChildren(grid);
    for (const species of allSpecies) {
      const isSelected = selected.has(species.id);
      const isFull = selected.size >= MAX_TEAM_SIZE && !isSelected;

      const sprite = document.createElement('img');
      sprite.className = 'card-sprite';
      sprite.src = getSpriteUrl(species.id, 'front');
      sprite.alt = species.name;

      const typeBadges = species.types.map((t) => {
        const badge = el('span', { class: `type-badge ${t}` }, [t.toUpperCase()]);
        badge.style.backgroundColor = getTypeColor(t);
        badge.style.color = getTypeTextColor(t);
        return badge;
      });

      const bst = STAT_NAMES.reduce((sum, s) => sum + species.baseStats[s], 0);

      const card = el('div', {
        class: `pokemon-card${isSelected ? ' selected' : ''}${isFull ? ' disabled' : ''}`,
        'data-id': species.id,
      }, [
        sprite,
        el('span', { class: 'card-name' }, [species.name]),
        el('div', { class: 'card-types' }, typeBadges),
        el('span', { class: 'card-stats' }, [`BST: ${bst}`]),
      ]);

      card.addEventListener('click', () => {
        if (isFull) return;
        togglePokemon(species);
      });

      grid.appendChild(card);
    }
  }

  // ── Config panel ──
  const configPanel = el('div', { class: 'team-config' });

  function renderConfigEmpty(): void {
    clearChildren(configPanel);
    configPanel.appendChild(
      el('div', { class: 'config-empty' }, ['Click a Pokemon to add it to your team']),
    );
  }

  function renderConfig(species: PokemonSpecies, entry: SelectedPokemon): void {
    clearChildren(configPanel);

    // Header with sprite, name, types
    const configSprite = document.createElement('img');
    configSprite.className = 'config-sprite';
    configSprite.src = getSpriteUrl(species.id, 'front');
    configSprite.alt = species.name;

    const configTypeBadges = species.types.map((t) => {
      const badge = el('span', { class: `type-badge ${t}` }, [t.toUpperCase()]);
      badge.style.backgroundColor = getTypeColor(t);
      badge.style.color = getTypeTextColor(t);
      return badge;
    });

    // Stat bars
    const statRows: HTMLElement[] = [];
    for (const stat of STAT_NAMES) {
      const value = species.baseStats[stat];
      const pct = Math.min(100, (value / 255) * 100);
      const fill = el('div', { class: 'stat-bar-fill' });
      fill.style.width = `${pct}%`;

      statRows.push(
        el('span', { class: 'stat-label' }, [STAT_LABELS[stat]]),
        el('div', { class: 'stat-bar-container' }, [fill]),
        el('span', { class: 'stat-value' }, [String(value)]),
      );
    }

    const configStats = el('div', { class: 'config-stats' }, statRows);

    const configInfo = el('div', {}, [
      el('div', { class: 'config-name' }, [species.name]),
      el('div', { class: 'config-types' }, configTypeBadges),
      configStats,
    ]);

    const configHeader = el('div', { class: 'config-header' }, [configSprite, configInfo]);

    // Move selection section
    const moveSelectTitle = el('div', { class: 'move-select-title' }, [
      `MOVES (${entry.selectedMoves.length}/${MAX_MOVES})`,
    ]);

    // Selected move slots
    const moveSlots = el('div', { class: 'move-select-slots' });
    for (let i = 0; i < MAX_MOVES; i++) {
      const moveId = entry.selectedMoves[i];
      if (moveId) {
        const moveData = getMove(moveId);
        const slot = el('span', { class: 'move-slot' }, [moveData.name]);
        slot.style.backgroundColor = getTypeColor(moveData.type as TypeName);
        slot.style.color = getTypeTextColor(moveData.type as TypeName);
        slot.style.cursor = 'pointer';
        slot.addEventListener('click', () => {
          entry.selectedMoves.splice(i, 1);
          renderConfig(species, entry);
          updateBattleButton();
        });
        moveSlots.appendChild(slot);
      } else {
        moveSlots.appendChild(el('span', { class: 'move-slot empty' }, ['---']));
      }
    }

    // Available moves list
    const moveOptionsList = el('div', { class: 'move-options-list' });
    for (const moveId of species.learnableMoves) {
      let moveData: MoveData;
      try {
        moveData = getMove(moveId);
      } catch {
        continue;
      }

      const isChosen = entry.selectedMoves.includes(moveId);
      const isMovesFull = entry.selectedMoves.length >= MAX_MOVES && !isChosen;

      const typeBadge = el('span', { class: `type-badge ${moveData.type}` }, [
        moveData.type.toUpperCase(),
      ]);
      typeBadge.style.backgroundColor = getTypeColor(moveData.type as TypeName);
      typeBadge.style.color = getTypeTextColor(moveData.type as TypeName);

      const categoryBadge = el('span', { class: `move-option-category ${moveData.category}` }, [
        moveData.category.toUpperCase(),
      ]);

      const powerText =
        moveData.power != null ? String(moveData.power) : '--';

      const option = el('div', {
        class: `move-option${isChosen ? ' selected' : ''}${isMovesFull ? ' disabled' : ''}`,
      }, [
        el('span', { class: 'move-option-name' }, [moveData.name]),
        el('div', { class: 'move-option-info' }, [
          typeBadge,
          el('span', { class: 'move-option-power' }, [powerText]),
          categoryBadge,
        ]),
      ]);

      option.addEventListener('click', () => {
        if (isMovesFull && !isChosen) return;
        if (isChosen) {
          const idx = entry.selectedMoves.indexOf(moveId);
          if (idx >= 0) entry.selectedMoves.splice(idx, 1);
        } else {
          entry.selectedMoves.push(moveId);
        }
        renderConfig(species, entry);
        updateBattleButton();
      });

      moveOptionsList.appendChild(option);
    }

    const moveSelect = el('div', { class: 'move-select' }, [
      moveSelectTitle,
      moveSlots,
      moveOptionsList,
    ]);

    configPanel.appendChild(configHeader);
    configPanel.appendChild(moveSelect);
  }

  // ── Team preview bar ──
  const teamSlots = el('div', { class: 'team-slots' });

  const battleBtn = el('button', { class: 'start-battle-btn', disabled: '' }, ['BATTLE!']);
  battleBtn.addEventListener('click', () => startBattle());

  const teamPreview = el('div', { class: 'team-preview' }, [
    el('span', { class: 'team-preview-label' }, ['TEAM']),
    teamSlots,
    battleBtn,
  ]);

  function renderTeamPreview(): void {
    clearChildren(teamSlots);

    for (const [, entry] of selected) {
      const sprite = document.createElement('img');
      sprite.className = 'team-slot-sprite';
      sprite.src = getSpriteUrl(entry.species.id, 'front');
      sprite.alt = entry.species.name;

      const removeBtn = el('button', { class: 'team-slot-remove' }, ['x']);
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        selected.delete(entry.species.id);
        if (configuredId === entry.species.id) {
          configuredId = null;
          renderConfigEmpty();
        }
        refresh();
      });

      const slot = el('div', { class: 'team-slot' }, [
        sprite,
        el('span', { class: 'team-slot-name' }, [entry.species.name]),
        removeBtn,
      ]);

      slot.addEventListener('click', () => {
        configuredId = entry.species.id;
        renderConfig(entry.species, entry);
      });

      teamSlots.appendChild(slot);
    }

    // Empty slots
    const emptyCount = MAX_TEAM_SIZE - selected.size;
    for (let i = 0; i < emptyCount; i++) {
      teamSlots.appendChild(el('div', { class: 'team-slot empty' }, [
        el('span', { class: 'team-slot-name' }, ['---']),
      ]));
    }
  }

  function updateBattleButton(): void {
    // At least 1 pokemon with at least 1 move
    let ready = false;
    for (const [, entry] of selected) {
      if (entry.selectedMoves.length > 0) {
        ready = true;
        break;
      }
    }
    if (selected.size === 0) ready = false;

    if (ready) {
      battleBtn.removeAttribute('disabled');
      battleBtn.classList.add('ready');
    } else {
      battleBtn.setAttribute('disabled', '');
      battleBtn.classList.remove('ready');
    }
  }

  function togglePokemon(species: PokemonSpecies): void {
    if (selected.has(species.id)) {
      selected.delete(species.id);
      if (configuredId === species.id) {
        configuredId = null;
        renderConfigEmpty();
      }
    } else {
      if (selected.size >= MAX_TEAM_SIZE) return;
      // Auto-assign first 4 moves
      const autoMoves = species.learnableMoves.slice(0, MAX_MOVES);
      selected.set(species.id, { species, selectedMoves: [...autoMoves] });
      configuredId = species.id;
      renderConfig(species, selected.get(species.id)!);
    }
    refresh();
  }

  function refresh(): void {
    renderGrid();
    renderTeamPreview();
    updateBattleButton();
  }

  // ── AI team generation ──
  function generateAiTeam(): PokemonConfig[] {
    const playerIds = new Set(selected.keys());
    const available = allSpecies.filter((s) => !playerIds.has(s.id));

    // If not enough unique pokemon, allow duplicates from full pool
    const pool = available.length >= 3 ? available : allSpecies;

    // Shuffle pool
    const shuffled = [...pool].sort(() => Math.random() - 0.5);

    const teamSize = 3 + Math.floor(Math.random() * 4); // 3-6
    const aiTeam: PokemonConfig[] = [];

    for (let i = 0; i < Math.min(teamSize, shuffled.length); i++) {
      const species = shuffled[i];
      // Pick up to 4 random moves
      const moveCandidates = [...species.learnableMoves].sort(() => Math.random() - 0.5);
      const moveIds = moveCandidates.slice(0, MAX_MOVES);

      aiTeam.push({
        speciesId: species.id,
        level: LEVEL,
        abilityId: species.possibleAbilities[0],
        moveIds,
      });
    }

    return aiTeam;
  }

  function startBattle(): void {
    // Build player team
    const playerTeam: PokemonConfig[] = [];
    for (const [, entry] of selected) {
      if (entry.selectedMoves.length === 0) continue;
      playerTeam.push({
        speciesId: entry.species.id,
        level: LEVEL,
        abilityId: entry.species.possibleAbilities[0],
        moveIds: [...entry.selectedMoves],
      });
    }

    if (playerTeam.length === 0) return;

    const aiTeam = generateAiTeam();

    const config: BattleConfig = {
      format: params.format,
      seed: Math.floor(Math.random() * 100000),
      players: [
        { name: 'Player', team: playerTeam },
        { name: 'CPU', team: aiTeam },
      ],
    };

    navigate('battle', { config });
  }

  // ── Assemble layout ──
  const body = el('div', { class: 'team-select-body' }, [gridWrapper, configPanel]);

  const wrapper = el('div', { class: 'team-select-container' }, [
    header,
    body,
    teamPreview,
  ]);

  container.appendChild(wrapper);

  // Initial render
  renderGrid();
  renderConfigEmpty();
  renderTeamPreview();
  updateBattleButton();

  return () => {
    // No timers or external listeners to clean up
  };
}
