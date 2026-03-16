import { el } from '../util/dom';

export interface FieldStatusChipComponent {
  el: HTMLElement;
  setWeather(weather: string | null): void;
  setTerrain(terrain: string | null): void;
}

interface WeatherDisplay {
  label: string;
  icon: string;
  colorClass: string;
}

interface TerrainDisplay {
  label: string;
  icon: string;
  colorClass: string;
}

const WEATHER_DISPLAY: Record<string, WeatherDisplay> = {
  rain:      { label: 'Rain',      icon: '🌧', colorClass: 'chip-rain' },
  sun:       { label: 'Sun',       icon: '☀️', colorClass: 'chip-sun' },
  sandstorm: { label: 'Sandstorm', icon: '🏜', colorClass: 'chip-sandstorm' },
  hail:      { label: 'Hail',      icon: '❄', colorClass: 'chip-hail' },
};

const TERRAIN_DISPLAY: Record<string, TerrainDisplay> = {
  electric: { label: 'Electric',  icon: '⚡', colorClass: 'chip-electric' },
  grassy:   { label: 'Grassy',    icon: '🌿', colorClass: 'chip-grassy' },
  psychic:  { label: 'Psychic',   icon: '🔮', colorClass: 'chip-psychic' },
  misty:    { label: 'Misty',     icon: '🌫', colorClass: 'chip-misty' },
};

export function createFieldStatusChip(): FieldStatusChipComponent {
  const weatherChip = el('div', { class: 'field-chip' });
  weatherChip.style.display = 'none';

  const terrainChip = el('div', { class: 'field-chip' });
  terrainChip.style.display = 'none';

  const container = el('div', { class: 'field-status-chips' }, [weatherChip, terrainChip]);

  return {
    el: container,

    setWeather(weather: string | null) {
      if (!weather) {
        weatherChip.style.display = 'none';
        weatherChip.className = 'field-chip';
        return;
      }
      const display = WEATHER_DISPLAY[weather];
      if (!display) {
        weatherChip.style.display = 'none';
        return;
      }
      weatherChip.className = `field-chip ${display.colorClass}`;
      weatherChip.textContent = `${display.icon} ${display.label}`;
      weatherChip.style.display = '';
    },

    setTerrain(terrain: string | null) {
      if (!terrain) {
        terrainChip.style.display = 'none';
        terrainChip.className = 'field-chip';
        return;
      }
      const display = TERRAIN_DISPLAY[terrain];
      if (!display) {
        terrainChip.style.display = 'none';
        return;
      }
      terrainChip.className = `field-chip ${display.colorClass}`;
      terrainChip.textContent = `${display.icon} ${display.label}`;
      terrainChip.style.display = '';
    },
  };
}
