// Web Audio 引擎声 / 音效（惰性初始化，用户首次交互后生效）

export function createAudio() {
  const api = {
    ctx: null,
    engineOsc: null,
    engineGain: null,
    master: null,

    init() {
      if (this.ctx) return;
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.5;
        this.master.connect(this.ctx.destination);
        // 引擎：锯齿波 + 低通
        this.engineOsc = this.ctx.createOscillator();
        this.engineOsc.type = 'sawtooth';
        this.engineOsc.frequency.value = 60;
        const lp = this.ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 700;
        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.value = 0;
        this.engineOsc.connect(lp);
        lp.connect(this.engineGain);
        this.engineGain.connect(this.master);
        this.engineOsc.start();
      } catch (e) {
        /* 忽略音频错误 */
      }
    },

    setEngine(speedFrac, on) {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const target = on ? 70 + speedFrac * 220 : 50;
      const vol = on ? 0.06 + speedFrac * 0.1 : 0;
      this.engineOsc.frequency.setTargetAtTime(target, t, 0.08);
      this.engineGain.gain.setTargetAtTime(vol, t, 0.08);
    },

    blip(freq, dur, type, vol) {
      if (!this.ctx) return;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type || 'square';
      o.frequency.value = freq;
      g.gain.value = vol || 0.2;
      o.connect(g);
      g.connect(this.master);
      const t = this.ctx.currentTime;
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.start(t);
      o.stop(t + dur);
    },

    boost() { this.blip(900, 0.25, 'sawtooth', 0.18); },
    count() { this.blip(440, 0.18, 'square', 0.22); },
    go() { this.blip(880, 0.4, 'square', 0.26); },
    lap() {
      this.blip(660, 0.12, 'square', 0.2);
      setTimeout(() => this.blip(880, 0.16, 'square', 0.2), 110);
    }
  };
  return api;
}
