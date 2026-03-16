class AudioManager {
  private cache: Map<string, HTMLAudioElement> = new Map();
  private _muted: boolean = false;
  private _volume: number = 1;
  private _musicVolume: number = 0.4;
  private musicEl: HTMLAudioElement | null = null;
  private musicEndHandler: (() => void) | null = null;
  private fadeInterval: ReturnType<typeof setInterval> | null = null;
  private crossfadeTimer: ReturnType<typeof setTimeout> | null = null;
  private crossfadeInterval: ReturnType<typeof setInterval> | null = null;

  get muted(): boolean {
    return this._muted;
  }

  get volume(): number {
    return this._volume;
  }

  private getOrLoad(path: string): HTMLAudioElement {
    let audio = this.cache.get(path);
    if (!audio) {
      audio = new Audio(path);
      audio.preload = 'auto';
      this.cache.set(path, audio);
    }
    return audio;
  }

  private ensureLoaded(audio: HTMLAudioElement): Promise<void> {
    if (audio.readyState >= 3) return Promise.resolve(); // HAVE_FUTURE_DATA or better
    return new Promise((resolve) => {
      audio.addEventListener('canplaythrough', () => resolve(), { once: true });
      audio.addEventListener('error', () => resolve(), { once: true });
    });
  }

  private async play(path: string): Promise<void> {
    try {
      const source = this.getOrLoad(path);
      await this.ensureLoaded(source);
      const clone = source.cloneNode(true) as HTMLAudioElement;
      clone.volume = this._muted ? 0 : this._volume;
      await clone.play();
    } catch {
      // Fail silently if audio file not found or playback fails
    }
  }

  /** Play audio and return a Promise that resolves when the audio finishes playing. */
  private async playUntilEnd(path: string): Promise<void> {
    try {
      const source = this.getOrLoad(path);
      await this.ensureLoaded(source);
      const clone = source.cloneNode(true) as HTMLAudioElement;
      clone.volume = this._muted ? 0 : this._volume;
      await clone.play();
      // Wait for the audio to finish
      await new Promise<void>((resolve) => {
        clone.addEventListener('ended', () => resolve(), { once: true });
        clone.addEventListener('error', () => resolve(), { once: true });
      });
    } catch {
      // Fail silently
    }
  }

  async playCry(speciesId: string): Promise<void> {
    await this.play(`./audio/cries/${speciesId}.mp3`);
  }

  async playMoveSfx(moveName: string): Promise<void> {
    await this.play(`./audio/move-effects/${moveName}.mp3`);
  }

  /** Play move SFX and resolve when the audio finishes. */
  playMoveSfxFullDuration(moveName: string): Promise<void> {
    return this.playUntilEnd(`./audio/move-effects/${moveName}.mp3`);
  }

  /** Play move SFX part and resolve when the audio finishes. */
  playMoveSfxPartFullDuration(moveName: string, part: number): Promise<void> {
    return this.playUntilEnd(`./audio/move-effects/${moveName} part ${part}.mp3`);
  }

  async playMoveSfxPart(moveName: string, part: number): Promise<void> {
    await this.play(`./audio/move-effects/${moveName} part ${part}.mp3`);
  }

  /** Get the file path for a move SFX. */
  getMoveSfxPath(moveName: string, part?: number): string {
    return part !== undefined
      ? `./audio/move-effects/${moveName} part ${part}.mp3`
      : `./audio/move-effects/${moveName}.mp3`;
  }

  /** Preload an audio file and return its duration in ms. Returns 0 on failure. */
  async getAudioDuration(path: string): Promise<number> {
    try {
      const source = this.getOrLoad(path);
      await this.ensureLoaded(source);
      return (source.duration || 0) * 1000;
    } catch {
      return 0;
    }
  }

  playUiSfx(name: string): void {
    this.play(`./audio/ui/${name}.wav`);
  }

  /** Preload audio files so they're ready for instant playback. */
  preload(paths: string[]): void {
    for (const path of paths) {
      this.getOrLoad(path); // Creates Audio element with preload='auto'
    }
  }

  /** Preload cries for a list of species IDs. */
  preloadCries(speciesIds: string[]): void {
    this.preload(speciesIds.map(id => `./audio/cries/${id}.mp3`));
  }

  // ---- Music ----

  playMusic(path: string, loop = false): void {
    this.cleanupMusic();
    const el = new Audio(path);
    el.preload = 'auto';
    el.loop = loop;
    el.volume = this._muted ? 0 : this._musicVolume;
    this.musicEl = el;
    el.play().catch(() => {});
  }

  chainMusic(introPath: string, loopPath: string, crossfadeMs = 2000): void {
    this.cleanupMusic();
    const intro = new Audio(introPath);
    intro.preload = 'auto';
    intro.volume = this._muted ? 0 : this._musicVolume;
    this.musicEl = intro;

    const startCrossfade = () => {
      if (this.musicEl !== intro) return;

      // Create loop track, start at 0 volume, fade in
      const loop = new Audio(loopPath);
      loop.preload = 'auto';
      loop.loop = true;
      loop.volume = 0;
      loop.play().catch(() => {});

      const targetVol = this._muted ? 0 : this._musicVolume;
      const steps = 20;
      const stepMs = crossfadeMs / steps;
      let step = 0;
      this.crossfadeInterval = setInterval(() => {
        step++;
        const progress = step / steps;
        // Fade out intro, fade in loop
        intro.volume = Math.max(0, targetVol * (1 - progress));
        loop.volume = targetVol * progress;
        if (step >= steps) {
          if (this.crossfadeInterval) clearInterval(this.crossfadeInterval);
          this.crossfadeInterval = null;
          intro.pause();
          this.musicEl = loop;
        }
      }, stepMs);
    };

    // Wait for metadata to know duration, then schedule crossfade
    const scheduleCrossfade = () => {
      if (this.musicEl !== intro) return;
      const fadeStart = Math.max(0, (intro.duration * 1000) - crossfadeMs);
      this.crossfadeTimer = setTimeout(startCrossfade, fadeStart);
    };

    if (intro.duration && isFinite(intro.duration)) {
      intro.play().catch(() => {});
      scheduleCrossfade();
    } else {
      intro.addEventListener('loadedmetadata', () => {
        scheduleCrossfade();
      }, { once: true });
      intro.play().catch(() => {});
    }

    // Fallback: if intro ends before crossfade completes, ensure loop is playing
    const onIntroEnd = () => {
      if (this.musicEl === intro) {
        this.musicEl = null;
        this.playMusic(loopPath, true);
      }
    };
    intro.addEventListener('ended', onIntroEnd, { once: true });
    this.musicEndHandler = () => intro.removeEventListener('ended', onIntroEnd);
  }

  stopMusic(fadeMs = 0): void {
    if (!this.musicEl) return;
    if (fadeMs <= 0) {
      this.cleanupMusic();
      return;
    }
    const el = this.musicEl;
    const startVol = el.volume;
    const steps = 20;
    const stepMs = fadeMs / steps;
    let step = 0;
    this.fadeInterval = setInterval(() => {
      step++;
      el.volume = Math.max(0, startVol * (1 - step / steps));
      if (step >= steps) {
        this.cleanupMusic();
      }
    }, stepMs);
  }

  private cleanupMusic(): void {
    if (this.fadeInterval) {
      clearInterval(this.fadeInterval);
      this.fadeInterval = null;
    }
    if (this.crossfadeTimer) {
      clearTimeout(this.crossfadeTimer);
      this.crossfadeTimer = null;
    }
    if (this.crossfadeInterval) {
      clearInterval(this.crossfadeInterval);
      this.crossfadeInterval = null;
    }
    if (this.musicEndHandler) {
      this.musicEndHandler();
      this.musicEndHandler = null;
    }
    if (this.musicEl) {
      this.musicEl.pause();
      this.musicEl.currentTime = 0;
      this.musicEl = null;
    }
  }

  // ---- Volume / mute ----

  setVolume(v: number): void {
    this._volume = Math.max(0, Math.min(1, v));
  }

  setMusicVolume(v: number): void {
    this._musicVolume = Math.max(0, Math.min(1, v));
    if (this.musicEl) {
      this.musicEl.volume = this._muted ? 0 : this._musicVolume;
    }
  }

  toggleMute(): void {
    this._muted = !this._muted;
    if (this.musicEl) {
      this.musicEl.volume = this._muted ? 0 : this._musicVolume;
    }
  }
}

export const audioManager = new AudioManager();
