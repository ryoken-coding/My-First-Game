// Subtle synthesized sound effects (no audio files). Respects mute and volume.
type Sfx = 'hit' | 'hurt' | 'cast' | 'pickup' | 'ok' | 'fail' | 'ui' | 'levelup' | 'step' | 'discover' | 'dodge';

export class Audio2 {
  private ctx: AudioContext | null = null;
  muted = false;
  volume = 0.6;
  available = true;

  private ensure(): AudioContext | null {
    if (!this.available) return null;
    if (!this.ctx) {
      try {
        const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.ctx = new Ctor();
      } catch {
        this.available = false;
        return null;
      }
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  /** Unlocks audio after the first user gesture (browser autoplay policy). */
  unlock(): void {
    this.ensure();
  }

  play(name: Sfx): void {
    if (this.muted) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.value = this.volume * 0.18;
    master.connect(ctx.destination);
    const tone = (freq: number, t0: number, dur: number, type: OscillatorType = 'sine', endFreq?: number): void => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, now + t0);
      if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, now + t0 + dur);
      g.gain.setValueAtTime(0.0001, now + t0);
      g.gain.exponentialRampToValueAtTime(1, now + t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, now + t0 + dur);
      o.connect(g).connect(master);
      o.start(now + t0);
      o.stop(now + t0 + dur + 0.02);
    };
    switch (name) {
      case 'hit': tone(220, 0, 0.12, 'square', 90); break;
      case 'hurt': tone(160, 0, 0.2, 'sawtooth', 70); break;
      case 'cast': tone(480, 0, 0.25, 'triangle', 980); break;
      case 'pickup': tone(660, 0, 0.1); tone(990, 0.08, 0.12); break;
      case 'ok': tone(523, 0, 0.12); tone(784, 0.1, 0.18); break;
      case 'fail': tone(220, 0, 0.18, 'triangle', 165); break;
      case 'ui': tone(700, 0, 0.04, 'triangle'); break;
      case 'levelup': tone(440, 0, 0.14); tone(554, 0.12, 0.14); tone(659, 0.24, 0.3); break;
      case 'step': tone(120, 0, 0.04, 'triangle'); break;
      case 'discover': tone(880, 0, 0.1); tone(1175, 0.1, 0.2); break;
      case 'dodge': tone(600, 0, 0.12, 'sine', 300); break;
    }
    setTimeout(() => master.disconnect(), 800);
  }
}
