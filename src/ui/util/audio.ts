class AudioManager {
  private cache: Map<string, HTMLAudioElement> = new Map();
  private _muted: boolean = false;
  private _volume: number = 1;

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
      this.cache.set(path, audio);
    }
    return audio;
  }

  private async play(path: string): Promise<void> {
    try {
      const source = this.getOrLoad(path);
      const clone = source.cloneNode(true) as HTMLAudioElement;
      clone.volume = this._muted ? 0 : this._volume;
      await clone.play();
    } catch {
      // Fail silently if audio file not found or playback fails
    }
  }

  async playCry(speciesId: string): Promise<void> {
    await this.play(`./audio/cries/${speciesId}.mp3`);
  }

  async playMoveSfx(moveName: string): Promise<void> {
    await this.play(`./audio/move-effects/${moveName}.mp3`);
  }

  setVolume(v: number): void {
    this._volume = Math.max(0, Math.min(1, v));
  }

  toggleMute(): void {
    this._muted = !this._muted;
  }
}

export const audioManager = new AudioManager();
