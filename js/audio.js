// d:\truco\js\audio.js
// Síntese procedural de efeitos sonoros com Web Audio API (sem dependências externas)

class TrucoAudio {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.muted = false;
    this.volume = 0.7;
  }

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.ctx = new AudioContext();
        this.masterGain = this.ctx.createGain();
        this.masterGain.connect(this.ctx.destination);
        this.masterGain.gain.value = this.muted ? 0 : this.volume;
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  unlock() {
    this.init();
    if (this.ctx?.state === 'suspended') {
      return this.ctx.resume().catch(() => {});
    }
    return Promise.resolve();
  }

  playCardSlide() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    // Ruído branco filtrado simulando o atrito da carta de papelão no feltro
    const bufferSize = this.ctx.sampleRate * 0.12;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.25));
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1400, this.ctx.currentTime);
    filter.Q.setValueAtTime(2.0, this.ctx.currentTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.12);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    noise.start();
  }

  playCardDeal(pitchMod = 1.0) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const bufferSize = Math.floor(this.ctx.sampleRate * 0.10);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.22));
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    const baseFreq = 1500 * (0.9 + pitchMod * 0.2);
    filter.frequency.setValueAtTime(baseFreq, this.ctx.currentTime);
    filter.Q.setValueAtTime(2.4, this.ctx.currentTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.35, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.005, this.ctx.currentTime + 0.10);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    noise.start();
  }

  playCardCollect() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    // Efeito suave de varredura/recolhimento de cartas no feltro
    const duration = 0.35;
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const progress = i / bufferSize;
      const envelope = Math.sin(progress * Math.PI) * Math.exp(-progress * 1.5);
      data[i] = (Math.random() * 2 - 1) * envelope;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(900, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(1400, this.ctx.currentTime + duration * 0.5);
    filter.frequency.exponentialRampToValueAtTime(800, this.ctx.currentTime + duration);
    filter.Q.setValueAtTime(1.8, this.ctx.currentTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.01, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.4, this.ctx.currentTime + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    noise.start();
  }

  playCardShuffle() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const flickCount = 20;
    const duration = 0.85;

    // Sequência de micro-estalidos de cartas intercalando (riffle shuffle)
    for (let i = 0; i < flickCount; i++) {
      const flickTime = now + (i / flickCount) * (duration - 0.15) + (Math.random() * 0.008);
      const flickBufSize = Math.floor(this.ctx.sampleRate * 0.025);
      const buf = this.ctx.createBuffer(1, flickBufSize, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let j = 0; j < flickBufSize; j++) {
        d[j] = (Math.random() * 2 - 1) * Math.exp(-j / (flickBufSize * 0.3));
      }

      const src = this.ctx.createBufferSource();
      src.buffer = buf;

      const flt = this.ctx.createBiquadFilter();
      flt.type = 'bandpass';
      flt.frequency.setValueAtTime(1300 + Math.random() * 900, flickTime);
      flt.Q.setValueAtTime(2.2, flickTime);

      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.22 + Math.random() * 0.12, flickTime);
      g.gain.exponentialRampToValueAtTime(0.005, flickTime + 0.025);

      src.connect(flt);
      flt.connect(g);
      g.connect(this.masterGain);
      src.start(flickTime);
    }

    // Estalo e batida de alinhamento final do maço (tap no feltro)
    const tapTime = now + duration;
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180, tapTime);
    osc.frequency.exponentialRampToValueAtTime(45, tapTime + 0.12);

    oscGain.gain.setValueAtTime(0.35, tapTime);
    oscGain.gain.exponentialRampToValueAtTime(0.001, tapTime + 0.12);

    osc.connect(oscGain);
    oscGain.connect(this.masterGain);
    osc.start(tapTime);
    osc.stop(tapTime + 0.13);
  }

  playTableThump() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    // Batida forte na mesa (Truco!)
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(160, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(35, this.ctx.currentTime + 0.28);

    gain.gain.setValueAtTime(0.8, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.3);

    // Eco sutil de impacto
    setTimeout(() => {
      if (this.muted || !this.ctx) return;
      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(90, this.ctx.currentTime);
      osc2.frequency.exponentialRampToValueAtTime(25, this.ctx.currentTime + 0.2);
      gain2.gain.setValueAtTime(0.5, this.ctx.currentTime);
      gain2.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);
      osc2.connect(gain2);
      gain2.connect(this.masterGain);
      osc2.start();
      osc2.stop(this.ctx.currentTime + 0.2);
    }, 90);
  }

  playWinChime() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const notes = [523.25, 659.25, 783.99, 1046.50]; // Acorde C Maior alegre
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime + idx * 0.08);

      gain.gain.setValueAtTime(0.3, this.ctx.currentTime + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + idx * 0.08 + 0.4);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(this.ctx.currentTime + idx * 0.08);
      osc.stop(this.ctx.currentTime + idx * 0.08 + 0.45);
    });
  }

  playCangaBell() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    // Som de suspense para canga/empate
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(260, this.ctx.currentTime + 0.4);

    gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.5);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.5);
  }

  playNotification() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  playCountdownTick(secondsRemaining) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const progress = (10 - secondsRemaining) / 9;
    const duration = 0.16 - progress * 0.08;
    const startTime = this.ctx.currentTime;
    const frequency = 420 + progress * 360;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(frequency, startTime);
    gain.gain.setValueAtTime(0.22, startTime);
    gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(startTime);
    osc.stop(startTime + duration);
  }

  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, Number(volume) || 0));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, 0.03);
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : this.volume, this.ctx.currentTime, 0.03);
    }
  }

  playTimeoutWarning() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const startTime = this.ctx.currentTime;
    [180, 120].forEach((frequency, index) => {
      const noteStart = startTime + index * 0.16;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(frequency, noteStart);
      gain.gain.setValueAtTime(0.3, noteStart);
      gain.gain.exponentialRampToValueAtTime(0.01, noteStart + 0.14);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(noteStart);
      osc.stop(noteStart + 0.14);
    });
  }
}

class TrucoMusic {
  constructor() {
    this.ctx = null;
    this.audio = null;
    this.source = null;
    this.gain = null;
    this.muted = false;
    this.playing = false;
    this.trackIndex = -1;
    this.startPromise = null;
    this.trackGains = [];
    this.volume = 0.16;
    this.tracks = Array.from({ length: 17 }, (_, index) => `music/music${String(index).padStart(2, '0')}.mp3`);
  }

  async start() {
    if (this.muted || this.playing) return;
    if (this.startPromise) return this.startPromise;

    this.startPromise = this._start().finally(() => {
      this.startPromise = null;
    });
    return this.startPromise;
  }

  async _start() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!this.audio) {
      this.audio = new Audio();
      this.audio.preload = 'auto';
      this.audio.playsInline = true;
      this.audio.setAttribute('playsinline', '');
      this.audio.addEventListener('ended', () => this.playNext());
    }

    if (!this.ctx && AudioContext) {
      try {
        this.ctx = new AudioContext();
        this.source = this.ctx.createMediaElementSource(this.audio);
        this.gain = this.ctx.createGain();
        this.source.connect(this.gain);
        this.gain.connect(this.ctx.destination);
      } catch (_) {
        this.ctx = null;
        this.source = null;
        this.gain = null;
      }
    }

    if (this.ctx?.state === 'suspended') {
      await this.ctx.resume().catch(() => {});
    }
    if (this.trackIndex < 0) {
      this.shuffleTracks();
      this.trackIndex = 0;
      this.audio.src = this.tracks[this.trackIndex];
        if (this.gain) {
          this.gain.gain.setValueAtTime((this.trackGains[this.trackIndex] || 1) * this.volume, this.ctx.currentTime);
        } else {
          this.audio.volume = this.volume;
      }
      this.audio.play().then(() => {
        this.playing = true;
      }).catch((error) => {
        this.playing = false;
        this.lastPlayError = error;
      });
    }
    if (!this.ctx) {
      this.trackGains = this.tracks.map(() => 1);
      return;
    }
    if (!this.trackGains.length) {
      await this.analyzeTracks();
      if (this.playing && !this.muted) {
        this.gain.gain.setTargetAtTime(this.trackGains[this.trackIndex] * 0.16, this.ctx.currentTime, 0.03);
      }
      return;
    }
    await this.playNext();
  }

  async analyzeTracks() {
    const cached = window.localStorage.getItem('trucoMusicGainsV1');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed && !Array.isArray(parsed) && this.tracks.every(track => Number.isFinite(parsed[track]))) {
          this.trackGains = this.tracks.map(track => parsed[track]);
          return;
        }
      } catch (_) {
        window.localStorage.removeItem('trucoMusicGainsV1');
      }
    }

    const targetDb = -20;
    this.trackGains = [];
    for (const track of this.tracks) {
      try {
        const response = await fetch(track);
        const buffer = await this.ctx.decodeAudioData(await response.arrayBuffer());
        let sumSquares = 0;
        let sampleCount = 0;
        for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
          const samples = buffer.getChannelData(channel);
          for (let index = 0; index < samples.length; index++) {
            sumSquares += samples[index] * samples[index];
          }
          sampleCount += samples.length;
        }
        const rms = Math.max(Math.sqrt(sumSquares / sampleCount), 0.00001);
        const rmsDb = 20 * Math.log10(rms);
          this.trackGains.push(Math.min(4, Math.pow(10, (targetDb - rmsDb) / 20)));
      } catch (_) {
        this.trackGains.push(1);
      }
    }
    const gainsByTrack = this.tracks.reduce((gains, track, index) => {
      gains[track] = this.trackGains[index];
      return gains;
    }, {});
    window.localStorage.setItem('trucoMusicGainsV1', JSON.stringify(gainsByTrack));
  }

  shuffleTracks() {
    for (let index = this.tracks.length - 1; index > 0; index--) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [this.tracks[index], this.tracks[swapIndex]] = [this.tracks[swapIndex], this.tracks[index]];
      if (this.trackGains.length === this.tracks.length) {
        [this.trackGains[index], this.trackGains[swapIndex]] = [this.trackGains[swapIndex], this.trackGains[index]];
      }
    }
  }

  async playNext() {
    if (!this.audio || this.muted) return;
    this.trackIndex = (this.trackIndex + 1) % this.tracks.length;
    this.audio.src = this.tracks[this.trackIndex];
      if (this.gain) {
        this.gain.gain.setValueAtTime((this.trackGains[this.trackIndex] || 1) * this.volume, this.ctx.currentTime);
      } else {
        this.audio.volume = this.volume;
    }
    try {
      await this.audio.play();
      this.playing = true;
    } catch (_) {
      this.playing = false;
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.gain && this.ctx) {
      this.gain.gain.setTargetAtTime(muted ? 0 : (this.trackGains[this.trackIndex] || 1) * this.volume, this.ctx.currentTime, 0.03);
    } else if (this.audio) {
      this.audio.muted = muted;
    }
    if (!muted) this.start();
  }

  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, Number(volume) || 0));
    if (this.gain && this.ctx && this.trackIndex >= 0) {
      this.gain.gain.setTargetAtTime(this.muted ? 0 : (this.trackGains[this.trackIndex] || 1) * this.volume, this.ctx.currentTime, 0.03);
    } else if (this.audio) {
      this.audio.volume = this.volume;
    }
  }
}

window.TrucoAudio = new TrucoAudio();
window.TrucoMusic = new TrucoMusic();
