
class AudioService {
  private ctx: AudioContext | null = null;

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  private createOscillator(freq: number, type: OscillatorType = 'sine', duration: number = 0.5, volume: number = 0.1) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    
    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  playGem(combo: number) {
    const baseFreq = 440;
    const freq = baseFreq * Math.pow(1.05946, (combo % 12) * 2);
    this.createOscillator(freq, 'triangle', 0.2, 0.08);
  }

  playPowerUp() {
    this.createOscillator(300, 'square', 0.1, 0.1);
    setTimeout(() => this.createOscillator(600, 'square', 0.3, 0.1), 100);
  }

  playQuizCorrect() {
    this.createOscillator(523.25, 'sine', 0.2, 0.1);
    setTimeout(() => this.createOscillator(659.25, 'sine', 0.2, 0.1), 100);
    setTimeout(() => this.createOscillator(783.99, 'sine', 0.4, 0.1), 200);
  }

  playQuizWrong() {
    this.createOscillator(180, 'sawtooth', 0.6, 0.1);
  }

  playGachaStart() {
    this.createOscillator(110, 'square', 1.0, 0.05);
  }

  playGachaReveal(rarity: string) {
    const freqs = [523.25, 659.25, 783.99, 1046.50];
    freqs.forEach((f, i) => {
      setTimeout(() => this.createOscillator(f, 'sine', 0.8, 0.15), i * 50);
    });
    if (rarity === 'SSR') {
      setTimeout(() => {
        this.createOscillator(1318.51, 'sine', 1.5, 0.2);
      }, 400);
    }
  }

  playEnding() {
    const melody = [523, 587, 659, 698, 783, 880, 987, 1046];
    melody.forEach((f, i) => {
      setTimeout(() => this.createOscillator(f, 'sine', 1.0, 0.1), i * 200);
    });
  }
}

export const audioService = new AudioService();
