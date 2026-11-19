// WebAudio synth sounds for Solmar Bay. No audio files, everything synthesized.
export class Sfx {
  constructor() {
    this.ctx = null; this.muted = false; this.engineOsc = null; this.engineGain = null;
    this.sirenOn = false; this.sirenTimer = 0; this.flybyAt = -999;
  }
  ensure() {
    if (!this.ctx) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
      } catch { return; }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }
  toggleMute() { this.muted = !this.muted; return this.muted; }
  tone(freq, dur, type, vol, slideTo) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
    o.type = type || 'square'; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(vol || 0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.ctx.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }
  noise(dur, vol, low) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime; const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = low || 1200;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.ctx.destination); src.start(t);
  }
  shoot() { this.noise(0.09, 0.25, 3000); this.tone(220, 0.08, 'square', 0.1, 60); }
  crash() { this.noise(0.25, 0.3, 500); this.tone(90, 0.2, 'sawtooth', 0.14, 40); }
  explosion() { this.noise(0.7, 0.4, 350); this.tone(60, 0.6, 'sine', 0.3, 28); }
  pickup() { this.tone(520, 0.12, 'sine', 0.14, 780); }
  coin() { this.tone(880, 0.09, 'sine', 0.14); setTimeout(() => this.tone(1320, 0.14, 'sine', 0.14), 70); }
  missionStart() { [392, 523, 659].forEach((f, i) => setTimeout(() => this.tone(f, 0.16, 'triangle', 0.15), i * 110)); }
  missionDone() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone(f, 0.2, 'triangle', 0.16), i * 120)); }
  fare() { this.tone(660, 0.1, 'sine', 0.13); setTimeout(() => this.tone(880, 0.12, 'sine', 0.13), 90); }
  denied() { this.tone(160, 0.18, 'square', 0.12, 110); }
  flyby() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(140, t);
    o.frequency.linearRampToValueAtTime(520, t + 0.9);
    o.frequency.linearRampToValueAtTime(110, t + 2.2);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.16, t + 0.9);
    g.gain.linearRampToValueAtTime(0.0001, t + 2.2);
    o.connect(g); g.connect(this.ctx.destination); o.start(t); o.stop(t + 2.3);
    this.noise(2.0, 0.08, 900);
  }
  engine(on, ratio) {
    if (!this.ctx || this.muted) { if (this.engineOsc) { try { this.engineOsc.stop(); } catch {} this.engineOsc = null; } return; }
    if (!on) { if (this.engineOsc) { try { this.engineOsc.stop(); } catch {} this.engineOsc = null; } return; }
    if (!this.engineOsc) {
      this.engineOsc = this.ctx.createOscillator(); this.engineGain = this.ctx.createGain();
      this.engineOsc.type = 'sawtooth'; this.engineGain.gain.value = 0.03;
      const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700;
      this.engineOsc.connect(f); f.connect(this.engineGain); this.engineGain.connect(this.ctx.destination);
      this.engineOsc.start();
    }
    const t = this.ctx.currentTime;
    this.engineOsc.frequency.setTargetAtTime(55 + ratio * 165, t, 0.08);
    this.engineGain.gain.setTargetAtTime(0.02 + ratio * 0.05, t, 0.1);
  }
  sirenTick(dt, active) {
    if (!active) { this.sirenOn = false; return; }
    this.sirenTimer -= dt;
    if (this.sirenTimer <= 0) { this.sirenTimer = 0.42; this.sirenOn = !this.sirenOn; this.tone(this.sirenOn ? 740 : 560, 0.38, 'sine', 0.045); }
  }
}
