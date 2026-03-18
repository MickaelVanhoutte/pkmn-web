import type { TimeSystem } from '../overworld/time-system';

export interface DebugTimeControllerComponent {
  el: HTMLElement;
  update(): void;
}

const PRESETS: Array<{ label: string; time: number }> = [
  { label: 'Dawn',  time: 0.22 },
  { label: 'Day',   time: 0.50 },
  { label: 'Dusk',  time: 0.76 },
  { label: 'Night', time: 0.92 },
];

function formatClock(norm: number): string {
  const hours = (norm * 24) % 24;
  const h = Math.floor(hours);
  const m = Math.floor((hours - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function getPeriodLabel(t: number): string {
  if (t >= 0.20 && t < 0.30) return 'Dawn';
  if (t >= 0.30 && t < 0.70) return 'Day';
  if (t >= 0.70 && t < 0.83) return 'Dusk';
  return 'Night';
}

export function createDebugTimeController(
  timeSystem: TimeSystem,
): DebugTimeControllerComponent {
  const container = document.createElement('div');
  container.className = 'debug-time-controller';

  // Toggle button
  const toggleBtn = document.createElement('button');
  toggleBtn.className = 'debug-toggle debug-time-toggle';
  toggleBtn.textContent = '\u263C'; // ☼
  toggleBtn.title = 'Debug Day/Night Cycle';

  // Panel
  const panel = document.createElement('div');
  panel.className = 'debug-panel debug-time-panel';
  panel.style.display = 'none';

  // Title
  const title = document.createElement('div');
  title.className = 'debug-title';
  title.textContent = 'Day/Night Cycle';
  panel.appendChild(title);

  // Clock display
  const clockRow = document.createElement('div');
  clockRow.className = 'debug-time-clock';
  panel.appendChild(clockRow);

  // Slider
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '0';
  slider.max = '1000';
  slider.step = '1';
  slider.className = 'debug-time-slider';
  panel.appendChild(slider);

  // Preset buttons row
  const presetRow = document.createElement('div');
  presetRow.className = 'debug-time-presets';
  for (const preset of PRESETS) {
    const btn = document.createElement('button');
    btn.className = 'debug-time-preset';
    btn.textContent = preset.label;
    btn.addEventListener('click', () => {
      timeSystem.setTimeNorm(preset.time);
      syncSlider();
    });
    presetRow.appendChild(btn);
  }
  panel.appendChild(presetRow);

  // Speed controls
  const speedRow = document.createElement('div');
  speedRow.className = 'debug-time-speed-row';

  const pauseBtn = document.createElement('button');
  pauseBtn.className = 'debug-time-preset';
  pauseBtn.textContent = '\u23F8'; // ⏸
  pauseBtn.title = 'Pause time';

  const speeds = [
    { label: '1x',  value: 1 / 60 },
    { label: '5x',  value: 5 / 60 },
    { label: '20x', value: 20 / 60 },
  ];

  speedRow.appendChild(pauseBtn);
  const speedBtns: HTMLButtonElement[] = [];
  for (const s of speeds) {
    const btn = document.createElement('button');
    btn.className = 'debug-time-preset';
    btn.textContent = s.label;
    btn.addEventListener('click', () => {
      timeSystem.setPaused(false);
      timeSystem.setSpeed(s.value);
      updateSpeedHighlight();
    });
    speedRow.appendChild(btn);
    speedBtns.push(btn);
  }
  panel.appendChild(speedRow);

  pauseBtn.addEventListener('click', () => {
    timeSystem.setPaused(!timeSystem.isPaused());
    updateSpeedHighlight();
  });

  // ── Sync helpers ──

  function syncSlider(): void {
    slider.value = String(Math.round(timeSystem.getTimeNorm() * 1000));
  }

  function updateSpeedHighlight(): void {
    const paused = timeSystem.isPaused();
    pauseBtn.classList.toggle('active', paused);
    pauseBtn.textContent = paused ? '\u25B6' : '\u23F8'; // ▶ or ⏸
    const currentSpeed = timeSystem.getSpeed();
    speedBtns.forEach((btn, i) => {
      btn.classList.toggle('active', !paused && Math.abs(currentSpeed - speeds[i].value) < 0.0001);
    });
  }

  // ── Events ──

  toggleBtn.addEventListener('click', () => {
    const isVisible = panel.style.display !== 'none';
    panel.style.display = isVisible ? 'none' : 'flex';
  });

  let dragging = false;
  slider.addEventListener('mousedown', () => { dragging = true; });
  slider.addEventListener('touchstart', () => { dragging = true; });
  slider.addEventListener('input', () => {
    const v = parseInt(slider.value, 10) / 1000;
    timeSystem.setTimeNorm(v);
  });
  const stopDrag = () => { dragging = false; };
  window.addEventListener('mouseup', stopDrag);
  window.addEventListener('touchend', stopDrag);

  // ── Update (called each frame) ──

  function update(): void {
    if (!dragging) syncSlider();
    const t = timeSystem.getTimeNorm();
    clockRow.textContent = `${formatClock(t)}  ${getPeriodLabel(t)}`;
    updateSpeedHighlight();
  }

  // ── Styling ──

  const style = document.createElement('style');
  style.textContent = `
    .debug-time-controller {
      position: fixed;
      bottom: 12px;
      right: 12px;
      z-index: 9999;
      font-family: monospace;
      font-size: 11px;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
    }
    .debug-time-controller .debug-toggle {
      background: rgba(0, 0, 0, 0.75);
      color: #0f0;
      border: 1px solid #0f0;
      padding: 4px 10px;
      cursor: pointer;
      border-radius: 4px;
      font-family: monospace;
      font-size: 14px;
    }
    .debug-time-controller .debug-toggle:hover {
      background: rgba(0, 60, 0, 0.9);
    }
    .debug-time-panel {
      display: flex;
      flex-direction: column;
      gap: 4px;
      background: rgba(0, 0, 0, 0.85);
      border: 1px solid #0f0;
      border-radius: 6px;
      padding: 8px;
      margin-bottom: 4px;
      width: 220px;
    }
    .debug-time-panel .debug-title {
      color: #0f0;
      font-weight: bold;
      text-align: center;
      font-size: 12px;
    }
    .debug-time-clock {
      color: #0f0;
      text-align: center;
      font-size: 16px;
      font-weight: bold;
      letter-spacing: 2px;
      padding: 4px 0;
    }
    .debug-time-slider {
      -webkit-appearance: none;
      width: 100%;
      height: 6px;
      background: linear-gradient(to right,
        #1a1a4a 0%, #1a1a4a 20%,
        #d4885a 25%, #d4885a 30%,
        #888 38%, #888 65%,
        #c46848 75%,
        #1a1a4a 83%, #1a1a4a 100%
      );
      border-radius: 3px;
      outline: none;
      cursor: pointer;
    }
    .debug-time-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 12px;
      height: 12px;
      background: #0f0;
      border-radius: 50%;
      cursor: grab;
    }
    .debug-time-slider::-moz-range-thumb {
      width: 12px;
      height: 12px;
      background: #0f0;
      border-radius: 50%;
      border: none;
      cursor: grab;
    }
    .debug-time-presets {
      display: flex;
      gap: 4px;
      justify-content: center;
    }
    .debug-time-speed-row {
      display: flex;
      gap: 4px;
      justify-content: center;
      border-top: 1px solid #333;
      padding-top: 4px;
    }
    .debug-time-preset {
      background: #111;
      color: #0f0;
      border: 1px solid #333;
      padding: 3px 8px;
      cursor: pointer;
      border-radius: 3px;
      font-family: monospace;
      font-size: 10px;
    }
    .debug-time-preset:hover {
      background: #0a3a0a;
      border-color: #0f0;
    }
    .debug-time-preset.active {
      background: #0a3a0a;
      border-color: #0f0;
      font-weight: bold;
    }
  `;

  container.appendChild(style);
  container.appendChild(panel);    // panel on top
  container.appendChild(toggleBtn); // toggle button below

  // Initial state
  syncSlider();
  updateSpeedHighlight();

  return { el: container, update };
}
