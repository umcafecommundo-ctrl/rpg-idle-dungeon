// Música e sons ambientes procedurais (Web Audio, sem arquivos). Placeholder: uma melodia lenta por mapa + ruído + eventos.
interface Cfg {
  root: number; scale: number[]; beat: number; wave: OscillatorType; mg: number; bass: number;
  noise: { type: BiquadFilterType; f: number; q: number; g: number };
  event: 'bird' | 'drip' | 'bell' | 'none'; evGap: [number, number]; rest: number;
}
const MAJ = [0, 2, 4, 7, 9, 12, 14], MIN = [0, 3, 5, 7, 10, 12, 15], PHR = [0, 1, 5, 7, 8, 12, 13];
const SCENES: Record<string, Cfg> = {
  cidade: { root: 261.6, scale: MAJ, beat: 420, wave: 'triangle', mg: 0.05, bass: 0.05, noise: { type: 'lowpass', f: 500, q: 0.5, g: 0.012 }, event: 'bird', evGap: [4, 9], rest: 0.25 },
  floresta: { root: 196, scale: MAJ, beat: 700, wave: 'sine', mg: 0.06, bass: 0.045, noise: { type: 'bandpass', f: 900, q: 0.4, g: 0.03 }, event: 'bird', evGap: [2, 6], rest: 0.35 },
  cripta: { root: 110, scale: PHR, beat: 1100, wave: 'sine', mg: 0.05, bass: 0.07, noise: { type: 'lowpass', f: 180, q: 1, g: 0.07 }, event: 'drip', evGap: [2.5, 6], rest: 0.5 },
  default: { root: 130.8, scale: MIN, beat: 900, wave: 'triangle', mg: 0.045, bass: 0.06, noise: { type: 'lowpass', f: 300, q: 0.7, g: 0.05 }, event: 'drip', evGap: [3, 8], rest: 0.45 },
};

class AudioEngine {
  private ctx: AudioContext | null = null; private master!: GainNode;
  private enabled = true; private scene = ''; private timers: number[] = [];
  private noiseSrc: AudioBufferSourceNode | null = null; private noiseGain: GainNode | null = null;
  private note = 2;

  unlock() {
    if (!this.ctx) {
      try { const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext; this.ctx = new AC(); } catch { return; }
      this.master = this.ctx.createGain(); this.master.gain.value = this.enabled ? 0.8 : 0; this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    if (this.scene && !this.timers.length) this.start();
  }
  setEnabled(on: boolean) {
    this.enabled = on;
    if (this.ctx) { this.master.gain.setTargetAtTime(on ? 0.8 : 0, this.ctx.currentTime, 0.15); }
  }
  setScene(id: string) {
    if (id === this.scene) return;
    this.scene = id; this.stop();
    if (this.ctx) this.start();
  }
  private stop() {
    this.timers.forEach((t) => clearTimeout(t)); this.timers = [];
    if (this.noiseGain && this.ctx) this.noiseGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
    const n = this.noiseSrc; if (n) setTimeout(() => { try { n.stop(); } catch { /* */ } }, 800);
    this.noiseSrc = null;
  }
  private cfg(): Cfg { return SCENES[this.scene] ?? SCENES.default; }
  private start() {
    const c = this.ctx!, cfg = this.cfg();
    // ruído filtrado (vento/ambiente)
    const buf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate); const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
    const f = c.createBiquadFilter(); f.type = cfg.noise.type; f.frequency.value = cfg.noise.f; f.Q.value = cfg.noise.q;
    const g = c.createGain(); g.gain.value = 0; g.gain.setTargetAtTime(cfg.noise.g, c.currentTime, 0.6);
    const lfo = c.createOscillator(); lfo.frequency.value = 0.15; const lg = c.createGain(); lg.gain.value = cfg.noise.g * 0.5; lfo.connect(lg); lg.connect(g.gain); lfo.start();
    src.connect(f); f.connect(g); g.connect(this.master); src.start();
    this.noiseSrc = src; this.noiseGain = g;
    const beat = () => {
      if (!this.ctx) return;
      const cf = this.cfg();
      const step = this.note;
      this.note = Math.max(0, Math.min(cf.scale.length - 1, step + Math.floor(Math.random() * 5) - 2));
      if (Math.random() > cf.rest) this.tone(cf.root * Math.pow(2, cf.scale[this.note] / 12) * 2, 0.9, cf.mg, cf.wave);
      if (this.beatN++ % 8 === 0) this.tone(cf.root / 2, cf.beat * 7 / 1000, cf.bass, 'sine');
      this.timers.push(window.setTimeout(beat, cf.beat));
    };
    const ev = () => {
      if (!this.ctx) return; const cf = this.cfg(); this.event(cf.event);
      this.timers.push(window.setTimeout(ev, (cf.evGap[0] + Math.random() * (cf.evGap[1] - cf.evGap[0])) * 1000));
    };
    this.beatN = 0; beat(); this.timers.push(window.setTimeout(ev, 1500));
  }
  private beatN = 0;
  private tone(freq: number, dur: number, gain: number, wave: OscillatorType) {
    const c = this.ctx!; const o = c.createOscillator(), g = c.createGain();
    o.type = wave; o.frequency.value = freq;
    g.gain.setValueAtTime(0, c.currentTime); g.gain.linearRampToValueAtTime(gain, c.currentTime + 0.04); g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    o.connect(g); g.connect(this.master); o.start(); o.stop(c.currentTime + dur + 0.05);
  }
  private event(kind: Cfg['event']) {
    const c = this.ctx!; const t = c.currentTime;
    if (kind === 'bird') {
      const n = 2 + Math.floor(Math.random() * 3); const base = 2200 + Math.random() * 1500;
      for (let i = 0; i < n; i++) { const o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; const s = t + i * 0.11; o.frequency.setValueAtTime(base, s); o.frequency.exponentialRampToValueAtTime(base * (1.3 + Math.random() * 0.4), s + 0.07); g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(0.03, s + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, s + 0.09); o.connect(g); g.connect(this.master); o.start(s); o.stop(s + 0.1); }
    } else if (kind === 'drip') {
      const o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(1400, t); o.frequency.exponentialRampToValueAtTime(500, t + 0.12); g.gain.setValueAtTime(0.05, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25); o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.3);
    } else if (kind === 'bell') {
      this.tone(880, 2, 0.03, 'sine'); this.tone(1320, 1.5, 0.015, 'sine');
    }
  }
}
export const audio = new AudioEngine();
