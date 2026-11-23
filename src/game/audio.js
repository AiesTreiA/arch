/**
 * audio.js — Motor de Audio Acústico Orgánico y Música Ambiental Cinemática (No-MIDI).
 *
 * Prohibido el uso de secuencias MIDI cuadradas, bips chiptune o arpegios robóticos.
 * Utiliza:
 *  - Síntesis por Modelado Físico (Karplus-Strong / Waveguide) para cuerdas griegas pulsadas (Kithara / Lira de Apolo).
 *  - Reverberación por Convolución (ConvolverNode) con respuesta al impulso (Impulse Response) estereofónica
 *    de caverna/templo de mármol para profundidad espacial cinemática.
 *  - Drones orquestales orgánicos con síntesis aditiva armónica, filtros paso-bajo resonantes,
 *    modulación lenta de fase/vibrato (LFOs inarmónicos) y coros etéreos formánticos.
 *  - Efectos de sonido (SFX) físicos multicapa: transitorios de impacto, resonancia metálica inarmónica
 *    (bronce/acero), formantes de aire/fuego, y texturas granulares (piedra, cerámica, hojas, agua).
 */

export class ArchAudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.reverbNode = null;
    this.reverbGain = null;

    this.enabled = true;
    this.muted = false;
    this.musicVolume = 0.55;
    this.sfxVolume = 0.78;
    this.currentTheme = null;
    this.isPlayingMusic = false;

    this._droneNodes = [];
    this._musicTimer = null;
    this._noiseBuffer = null;
    this._pinkNoiseBuffer = null;
    this._lastFootstepTs = 0;

    try {
      if (typeof localStorage !== 'undefined') {
        const savedMute = localStorage.getItem('arch_audio_muted');
        if (savedMute === '1') this.muted = true;
        const savedMusicVol = parseFloat(localStorage.getItem('arch_music_vol'));
        if (!Number.isNaN(savedMusicVol)) this.musicVolume = Math.max(0, Math.min(1, savedMusicVol));
        const savedSfxVol = parseFloat(localStorage.getItem('arch_sfx_vol'));
        if (!Number.isNaN(savedSfxVol)) this.sfxVolume = Math.max(0, Math.min(1, savedSfxVol));
      }
    } catch {
      // Ignorar en entornos sin localStorage
    }
  }

  /** Inicializa el AudioContext bajo interacción del usuario (política de autoplay). */
  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return true;
    }

    const AudioCtx =
      typeof window !== 'undefined' ? window.AudioContext || window.webkitAudioContext : null;
    if (!AudioCtx) {
      this.enabled = false;
      return false;
    }

    try {
      this.ctx = new AudioCtx();

      // Compresor / Limitador suave de masterización para evitar saturación y dar calidez analógica
      const compressor = this.ctx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-16, this.ctx.currentTime);
      compressor.knee.setValueAtTime(18, this.ctx.currentTime);
      compressor.ratio.setValueAtTime(3.5, this.ctx.currentTime);
      compressor.attack.setValueAtTime(0.008, this.ctx.currentTime);
      compressor.release.setValueAtTime(0.24, this.ctx.currentTime);
      compressor.connect(this.ctx.destination);

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : 0.9, this.ctx.currentTime);
      this.masterGain.connect(compressor);

      // Bus de Reverberación por Convolución (Acústica de Templo / Caverna Estigia)
      this.reverbNode = this.ctx.createConvolver();
      this.reverbNode.buffer = this._createTempleImpulseResponse(3.4, 2.3);
      this.reverbGain = this.ctx.createGain();
      this.reverbGain.gain.setValueAtTime(0.48, this.ctx.currentTime);
      this.reverbNode.connect(this.reverbGain);
      this.reverbGain.connect(this.masterGain);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.setValueAtTime(this.musicVolume, this.ctx.currentTime);
      this.musicGain.connect(this.masterGain);
      this.musicGain.connect(this.reverbNode);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
      this.sfxGain.connect(this.masterGain);

      // Envío parcial de SFX a la reverberación del templo para realismo espacial
      this.sfxReverbSend = this.ctx.createGain();
      this.sfxReverbSend.gain.setValueAtTime(0.28, this.ctx.currentTime);
      this.sfxGain.connect(this.sfxReverbSend);
      this.sfxReverbSend.connect(this.reverbNode);

      this._noiseBuffer = this._createWhiteNoiseBuffer(2.0);
      this._pinkNoiseBuffer = this._createPinkNoiseBuffer(3.0);

      if (this.currentTheme && !this.isPlayingMusic) {
        this._startThemeEngine(this.currentTheme);
      }
      return true;
    } catch (e) {
      this.enabled = false;
      return false;
    }
  }

  /** Construye un Impulse Response estéreo rico y difuso (cámara de mármol y caverna). */
  _createTempleImpulseResponse(duration = 3.2, decay = 2.2) {
    const rate = this.ctx.sampleRate;
    const length = Math.floor(rate * duration);
    const impulse = this.ctx.createBuffer(2, length, rate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    let lpL = 0;
    let lpR = 0;
    for (let i = 0; i < length; i++) {
      const t = i / rate;
      // Reflexiones tempranas de piedra + cola difusa con absorción natural de agudos
      const env = Math.pow(1 - i / length, decay) * Math.exp(-t * 0.85);
      const damp = Math.max(0.12, 1 - (i / length) * 0.78);
      const rawL = (Math.random() * 2 - 1) * env;
      const rawR = (Math.random() * 2 - 1) * env;
      lpL = lpL + damp * (rawL - lpL);
      lpR = lpR + damp * (rawR - lpR);
      left[i] = lpL * 0.55;
      right[i] = lpR * 0.55;
    }
    return impulse;
  }

  _createWhiteNoiseBuffer(seconds = 2.0) {
    const rate = this.ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = this.ctx.createBuffer(1, len, rate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buf;
  }

  /** Ruido rosa (-3dB/octava) con sonoridad orgánica de viento, aliento, agua y fuego. */
  _createPinkNoiseBuffer(seconds = 3.0) {
    const rate = this.ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = this.ctx.createBuffer(1, len, rate);
    const data = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.045;
      b6 = white * 0.115926;
    }
    return buf;
  }

  /**
   * Síntesis por Modelado Físico Karplus-Strong mejorada:
   * Simula una cuerda real de Kithara / Lira griega pulsada con los dedos,
   * con resonancia de caja de madera y amortiguación natural de armónicos.
   */
  pluckKitharaString(freq, duration = 3.4, volume = 0.22, pan = 0, brightness = 0.58) {
    if (!this.ctx || this.muted) return;
    const rate = this.ctx.sampleRate;
    const totalSamples = Math.floor(rate * duration);
    const period = Math.max(8, Math.round(rate / freq));
    const buffer = this.ctx.createBuffer(1, totalSamples, rate);
    const out = buffer.getChannelData(0);

    // Línea de retardo (Waveguide) excitada con un pulso suave de dedo (no diente de sierra duro)
    const ring = new Float32Array(period);
    let prev = 0;
    for (let i = 0; i < period; i++) {
      // Forma de excitación orgánica: seno fundamental + textura de yema de dedo filtrada
      const phase = (i / period) * Math.PI * 2;
      const bodyShape = Math.sin(phase) * 0.55 + Math.sin(phase * 2) * 0.25;
      const noise = (Math.random() * 2 - 1) * 0.45;
      prev = prev + brightness * (noise - prev);
      ring[i] = bodyShape + prev;
    }

    let idx = 0;
    let lastSample = 0;
    const damping = 0.9962; // Decaimiento natural cálido
    const stretch = 0.5 + (1 - brightness) * 0.28;

    for (let i = 0; i < totalSamples; i++) {
      const curr = ring[idx];
      const nextIdx = (idx + 1) % period;
      const next = ring[nextIdx];
      // Filtro de bucle paso-bajo de fase suave (simula absorción del puente de madera)
      const filtered = (curr * stretch + next * (1 - stretch)) * damping;
      ring[idx] = filtered;
      // Suavizado de ataque de primeros 3ms para evitar clics digitales
      const attackEnv = Math.min(1, i / (rate * 0.004));
      out[i] = (curr * 0.8 + lastSample * 0.2) * attackEnv;
      lastSample = curr;
      idx = nextIdx;
    }

    const src = this.ctx.createBufferSource();
    src.buffer = buffer;

    // Resonancia de cuerpo acústico (caja de resonancia de tortuga/madera de la lira)
    const bodyResonator = this.ctx.createBiquadFilter();
    bodyResonator.type = 'peaking';
    bodyResonator.frequency.setValueAtTime(240, this.ctx.currentTime);
    bodyResonator.Q.setValueAtTime(2.2, this.ctx.currentTime);
    bodyResonator.gain.setValueAtTime(4.5, this.ctx.currentTime);

    const warmthFilter = this.ctx.createBiquadFilter();
    warmthFilter.type = 'lowpass';
    warmthFilter.frequency.setValueAtTime(2400, this.ctx.currentTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0008, this.ctx.currentTime + duration);

    if (typeof this.ctx.createStereoPanner === 'function') {
      const panner = this.ctx.createStereoPanner();
      panner.pan.setValueAtTime(Math.max(-0.85, Math.min(0.85, pan)), this.ctx.currentTime);
      src.connect(bodyResonator);
      bodyResonator.connect(warmthFilter);
      warmthFilter.connect(panner);
      panner.connect(gain);
    } else {
      src.connect(bodyResonator);
      bodyResonator.connect(warmthFilter);
      warmthFilter.connect(gain);
    }

    gain.connect(this.musicGain);
    src.start();
  }

  /**
   * Reproduce una nota de Aulos / Flauta de Pan orgánica o Cello/Coro con ataque lento y vibrato humano,
   * para melodías atmosféricas espaciadas (nunca MIDI).
   */
  playOrganicVoice(freq, duration = 4.5, volume = 0.11, timbre = 'choir') {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;

    const voiceGain = this.ctx.createGain();
    voiceGain.gain.setValueAtTime(0.0001, now);
    voiceGain.gain.linearRampToValueAtTime(volume, now + duration * 0.32);
    voiceGain.gain.exponentialRampToValueAtTime(0.0005, now + duration);

    // Filtro formántico cálido con barrido orgánico lento
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    const cutoff = timbre === 'cello' ? freq * 3.8 : timbre === 'flute' ? freq * 2.8 : 950;
    filter.frequency.setValueAtTime(cutoff * 0.65, now);
    filter.frequency.linearRampToValueAtTime(cutoff, now + duration * 0.45);
    filter.frequency.linearRampToValueAtTime(cutoff * 0.55, now + duration);
    filter.Q.setValueAtTime(1.8, now);

    // Vibrato humano expresivo (5.2 Hz con entrada gradual)
    const vibOsc = this.ctx.createOscillator();
    const vibGain = this.ctx.createGain();
    vibOsc.frequency.setValueAtTime(4.8 + Math.random() * 0.7, now);
    vibGain.gain.setValueAtTime(0.01, now);
    vibGain.gain.linearRampToValueAtTime(freq * 0.0075, now + duration * 0.5);
    vibOsc.connect(vibGain);
    vibOsc.start(now);
    vibOsc.stop(now + duration + 0.1);

    // Osciladores desfasados para grosor coral / cuerdas frotadas
    const detunes = [-7, 0, 7];
    for (const det of detunes) {
      const osc = this.ctx.createOscillator();
      osc.type = timbre === 'flute' ? 'triangle' : 'sawtooth';
      osc.frequency.setValueAtTime(freq, now);
      osc.detune.setValueAtTime(det + (Math.random() - 0.5) * 3, now);
      vibGain.connect(osc.frequency);
      osc.connect(filter);
      osc.start(now);
      osc.stop(now + duration + 0.1);
    }

    // Soplo de aire sutil si es flauta de Pan / Aulos
    if (timbre === 'flute' && this._pinkNoiseBuffer) {
      const breath = this.ctx.createBufferSource();
      breath.buffer = this._pinkNoiseBuffer;
      breath.loop = true;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(freq * 2, now);
      bp.Q.setValueAtTime(4.0, now);
      const bGain = this.ctx.createGain();
      bGain.gain.setValueAtTime(0.08, now);
      breath.connect(bp);
      bp.connect(bGain);
      bGain.connect(filter);
      breath.start(now);
      breath.stop(now + duration);
    }

    filter.connect(voiceGain);
    voiceGain.connect(this.musicGain);
  }

  /** Percusión ceremonial profunda (Tympanon griego / Tambor ritual del Tártaro). */
  playRitualDrum(freq = 58, volume = 0.24) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * 1.9, now);
    osc.frequency.exponentialRampToValueAtTime(freq, now + 0.09);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.68, now + 1.4);

    const sub = this.ctx.createOscillator();
    sub.type = 'triangle';
    sub.frequency.setValueAtTime(freq, now);
    sub.frequency.exponentialRampToValueAtTime(freq * 0.5, now + 1.1);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(190, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 1.5);

    osc.connect(filter);
    sub.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);

    osc.start(now);
    sub.start(now);
    osc.stop(now + 1.55);
    sub.stop(now + 1.55);
  }

  /**
   * Cambia el paisaje musical según el bioma/piso actual:
   *  - 'overworld': Hélade / Ribera del Aqueronte (Modo Dórico en Re, Kithara acústica, brisa mediterránea, flauta de Pan).
   *  - 'underworld': Templos del Inframundo (Modo Frigio Dominante / Eólico en Re, drones de violonchelo sombrío, liras lejanas).
   *  - 'boss': Trono del Tártaro / Hades (Tambores rituales profundos, coro abisal y tensión épica).
   */
  setMusicTheme(theme = 'overworld') {
    if (this.currentTheme === theme && this.isPlayingMusic) return;
    this.currentTheme = theme;
    if (!this.ctx) return;
    this._startThemeEngine(theme);
  }

  _stopCurrentMusic() {
    if (this._musicTimer) {
      clearTimeout(this._musicTimer);
      this._musicTimer = null;
    }
    const now = this.ctx ? this.ctx.currentTime : 0;
    for (const node of this._droneNodes) {
      try {
        if (node.gain) {
          node.gain.gain.cancelScheduledValues(now);
          node.gain.gain.setValueAtTime(node.gain.gain.value || 0.01, now);
          node.gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
        }
        setTimeout(() => {
          try {
            node.src?.stop?.();
            node.src?.disconnect?.();
          } catch {}
        }, 1300);
      } catch {}
    }
    this._droneNodes = [];
    this.isPlayingMusic = false;
  }

  _startThemeEngine(theme) {
    if (!this.ctx) return;
    this._stopCurrentMusic();
    this.isPlayingMusic = true;
    const now = this.ctx.currentTime;

    // 1. Lecho continuo de Drone Orquestal + Textura Ambiental Orgánica
    const baseFreq = theme === 'boss' ? 55.0 : 73.42; // A1 (55Hz) o D2 (73.42Hz)
    const fifthFreq = baseFreq * 1.498; // Quinta justa orgánica

    for (const [idx, f] of [baseFreq, fifthFreq].entries()) {
      const osc = this.ctx.createOscillator();
      osc.type = idx === 0 ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(f, now);

      // LFO lento para modulación orgánica del timbre (respiración del drone)
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      lfo.frequency.setValueAtTime(0.09 + idx * 0.04, now);
      lfoGain.gain.setValueAtTime(85, now);
      lfo.connect(lfoGain);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(theme === 'overworld' ? 230 : 175, now);
      filter.Q.setValueAtTime(2.0, now);
      lfoGain.connect(filter.frequency);

      const g = this.ctx.createGain();
      const targetVol = idx === 0 ? 0.075 : 0.045;
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(targetVol, now + 2.5);

      osc.connect(filter);
      filter.connect(g);
      g.connect(this.musicGain);

      osc.start(now);
      lfo.start(now);
      this._droneNodes.push({ src: osc, gain: g }, { src: lfo });
    }

    // Textura de brisa / aire cavernoso con ruido rosa filtrado
    if (this._pinkNoiseBuffer) {
      const windSrc = this.ctx.createBufferSource();
      windSrc.buffer = this._pinkNoiseBuffer;
      windSrc.loop = true;

      const windFilter = this.ctx.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.setValueAtTime(theme === 'overworld' ? 420 : 210, now);
      windFilter.Q.setValueAtTime(1.4, now);

      const windLfo = this.ctx.createOscillator();
      const windLfoGain = this.ctx.createGain();
      windLfo.frequency.setValueAtTime(0.07, now);
      windLfoGain.gain.setValueAtTime(140, now);
      windLfo.connect(windLfoGain);
      windLfoGain.connect(windFilter.frequency);

      const windGain = this.ctx.createGain();
      windGain.gain.setValueAtTime(0.0001, now);
      windGain.gain.linearRampToValueAtTime(theme === 'overworld' ? 0.065 : 0.085, now + 2.5);

      windSrc.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(this.musicGain);

      windSrc.start(now);
      windLfo.start(now);
      this._droneNodes.push({ src: windSrc, gain: windGain }, { src: windLfo });
    }

    // 2. Generador de Frases Acústicas Humanizadas (No-MIDI: rubato libre, intervalos modales griegos antiguos)
    // Escala Dórica Griega en Re (D, E, F, G, A, B, C, D) vs Frigia/Hijaz del Tártaro (D, Eb, F#, G, A, Bb, C, D)
    const dorianScale = [146.83, 164.81, 174.61, 196.00, 220.00, 246.94, 261.63, 293.66, 329.63, 349.23, 392.00, 440.00];
    const phrygianScale = [146.83, 155.56, 185.00, 196.00, 220.00, 233.08, 261.63, 293.66, 311.13, 369.99, 392.00];
    const bossScale = [110.00, 116.54, 138.59, 146.83, 164.81, 174.61, 220.00, 233.08, 277.18, 293.66];

    let phraseIndex = 0;
    const scheduleNextPhrase = () => {
      if (!this.isPlayingMusic || this.currentTheme !== theme) return;
      if (!this.muted && this.ctx && this.ctx.state === 'running') {
        const scale = theme === 'overworld' ? dorianScale : theme === 'boss' ? bossScale : phrygianScale;

        // Pulsación orgánica de Kithara (acorde arpegiado con dedos o frase contemplativa)
        const noteCount = theme === 'boss' ? 3 : 2 + (phraseIndex % 3);
        const baseIdx = Math.floor(Math.random() * (scale.length - 4));
        const intervals = [0, 2, 4, 3];

        for (let i = 0; i < noteCount; i++) {
          const noteIdx = Math.min(scale.length - 1, baseIdx + intervals[i % intervals.length]);
          const freq = scale[noteIdx];
          // Rubato humano: tiempos irregulares naturales (jamás cuantizados a grilla MIDI)
          const humanDelayMs = i * (290 + Math.random() * 240) + Math.random() * 85;
          const pan = (Math.random() - 0.5) * 0.9;
          const brightness = theme === 'overworld' ? 0.62 : 0.44;
          setTimeout(() => {
            if (!this.isPlayingMusic || this.currentTheme !== theme) return;
            this.pluckKitharaString(freq, 3.8, 0.16 + Math.random() * 0.05, pan, brightness);
          }, humanDelayMs);
        }

        // Voz melódica lenta ocasional (Flauta de Pan en superficie, Cello/Coro en Inframundo)
        if (phraseIndex % 2 === 1) {
          const voiceFreq = scale[Math.min(scale.length - 1, baseIdx + 2)];
          const timbre = theme === 'overworld' ? 'flute' : theme === 'boss' ? 'choir' : 'cello';
          setTimeout(() => {
            if (!this.isPlayingMusic || this.currentTheme !== theme) return;
            this.playOrganicVoice(voiceFreq, 4.8, 0.075, timbre);
          }, 550);
        }

        // Pulso de Tympanon ritual profundo en templos o combate contra Hades
        if (theme === 'boss' || (theme === 'underworld' && phraseIndex % 2 === 0)) {
          this.playRitualDrum(theme === 'boss' ? 52 : 62, theme === 'boss' ? 0.25 : 0.14);
          if (theme === 'boss') {
            setTimeout(() => {
              if (this.isPlayingMusic && this.currentTheme === 'boss') {
                this.playRitualDrum(65, 0.18);
              }
            }, 680);
          }
        }

        phraseIndex++;
      }

      const nextWait =
        theme === 'boss'
          ? 2400 + Math.random() * 700
          : theme === 'overworld'
          ? 3400 + Math.random() * 1400
          : 3900 + Math.random() * 1600;
      this._musicTimer = setTimeout(scheduleNextPhrase, nextWait);
    };

    this._musicTimer = setTimeout(scheduleNextPhrase, 400);
  }

  toggleMute(forceState = null) {
    this.init();
    this.muted = typeof forceState === 'boolean' ? forceState : !this.muted;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('arch_audio_muted', this.muted ? '1' : '0');
      }
    } catch {}
    if (this.ctx && this.masterGain) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setTargetAtTime(this.muted ? 0 : 0.9, now, 0.05);
    }
    return this.muted;
  }

  setVolumes({ music = this.musicVolume, sfx = this.sfxVolume } = {}) {
    this.musicVolume = Math.max(0, Math.min(1, music));
    this.sfxVolume = Math.max(0, Math.min(1, sfx));
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('arch_music_vol', String(this.musicVolume));
        localStorage.setItem('arch_sfx_vol', String(this.sfxVolume));
      }
    } catch {}
    if (this.ctx) {
      const now = this.ctx.currentTime;
      this.musicGain?.gain.setTargetAtTime(this.musicVolume, now, 0.04);
      this.sfxGain?.gain.setTargetAtTime(this.sfxVolume, now, 0.04);
    }
  }

  // ============================================================================
  // EFECTOS DE SONIDO ACÚSTICOS Y FÍSICOS (SFX)
  // ============================================================================

  /** Pasos orgánicos diferenciados por superficie (piedra, hierba, arena, agua). */
  playFootstep(surface = 'stone') {
    if (!this.ctx || this.muted || !this._pinkNoiseBuffer) return;
    const nowMs = performance.now();
    if (nowMs - this._lastFootstepTs < 240) return;
    this._lastFootstepTs = nowMs;

    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this._pinkNoiseBuffer;
    src.playbackRate.setValueAtTime(0.85 + Math.random() * 0.3, now);

    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    if (surface === 'water' || surface === 'shallow_water') {
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(680 + Math.random() * 180, now);
      filter.Q.setValueAtTime(2.5, now);
      gain.gain.setValueAtTime(0.11, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    } else if (surface === 'grass' || surface === 'meadow') {
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1250 + Math.random() * 250, now);
      filter.Q.setValueAtTime(1.8, now);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    } else {
      // Piedra / Mármol: golpe seco grave + roce corto
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(360 + Math.random() * 90, now);
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
    }

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    src.start(now, Math.random() * 1.5, 0.18);
  }

  /** Tajo de arma en el aire (Whoosh aerodinámico + resonancia metálica de hoja o cuerda de arco). */
  playAttackSwing({ classId = 'hoplita', comboStep = 0, isBow = false } = {}) {
    this.init();
    if (!this.ctx || this.muted || !this._pinkNoiseBuffer) return;
    const now = this.ctx.currentTime;

    if (isBow || classId === 'arquera') {
      // Soltado de cuerda de arco tensa (vibración elástica Karplus-Strong corta + silbido de flecha)
      this.pluckKitharaString(185 + comboStep * 18, 0.32, 0.24, 0, 0.75);
      const air = this.ctx.createBufferSource();
      air.buffer = this._pinkNoiseBuffer;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(1600, now);
      bp.frequency.exponentialRampToValueAtTime(3200, now + 0.11);
      bp.Q.setValueAtTime(3.2, now);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.18, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
      air.connect(bp);
      bp.connect(g);
      g.connect(this.sfxGain);
      air.start(now, 0.2, 0.15);
      return;
    }

    // Desplazamiento de aire (Whoosh físico con barrido de formante según paso del combo)
    const air = this.ctx.createBufferSource();
    air.buffer = this._pinkNoiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    const baseF = comboStep === 2 ? 320 : comboStep === 1 ? 460 : 390;
    filter.frequency.setValueAtTime(baseF * 1.8, now);
    filter.frequency.exponentialRampToValueAtTime(baseF * 0.55, now + 0.19);
    filter.Q.setValueAtTime(2.4, now);

    const airGain = this.ctx.createGain();
    airGain.gain.setValueAtTime(0.001, now);
    airGain.gain.linearRampToValueAtTime(comboStep === 2 ? 0.34 : 0.24, now + 0.035);
    airGain.gain.exponentialRampToValueAtTime(0.001, now + 0.21);

    air.connect(filter);
    filter.connect(airGain);
    airGain.connect(this.sfxGain);
    air.start(now, Math.random() * 1.2, 0.24);

    // Brillo metálico sutil del bronce al cortar el viento
    this._playMetallicResonance(comboStep === 2 ? 620 : 780, 0.14, 0.055);
  }

  /** Síntesis modal inarmónica para resonancia real de bronce, espadas, escudos y monedas. */
  _playMetallicResonance(baseFreq, duration = 0.35, volume = 0.12) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    // Ratios modales inarmónicos de placa/hoja de bronce (no múltiplos enteros)
    const ratios = [1.0, 1.58, 2.24, 2.91, 3.67];
    for (let i = 0; i < ratios.length; i++) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq * ratios[i], now);

      const g = this.ctx.createGain();
      const partialVol = (volume / (i + 1)) * 0.85;
      const partialDecay = duration / (1 + i * 0.45);
      g.gain.setValueAtTime(partialVol, now);
      g.gain.exponentialRampToValueAtTime(0.0004, now + partialDecay);

      osc.connect(g);
      g.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + partialDecay + 0.02);
    }
  }

  /** Impacto físico contra enemigo (transitorio contundente + resonancia de armadura/carne). */
  playHitImpact({ isCrit = false, blocked = false } = {}) {
    this.init();
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;

    if (blocked) {
      // Bloqueo con Escudo Aspis de bronce: clang metálico resonante + golpe grave
      this._playMetallicResonance(480, 0.42, 0.22);
      this._playMetallicResonance(710, 0.28, 0.14);
      this._playPhysicalThud(110, 0.18, 0.28);
      return;
    }

    // Golpe físico de cuerpo
    this._playPhysicalThud(isCrit ? 88 : 125, isCrit ? 0.24 : 0.14, isCrit ? 0.42 : 0.28);

    // Chispazo de bronce/acero
    this._playMetallicResonance(isCrit ? 920 : 660, isCrit ? 0.38 : 0.18, isCrit ? 0.18 : 0.09);

    // Textura de desgarro / crujido corto
    if (this._whiteNoiseBuffer || this._noiseBuffer) {
      const crunch = this.ctx.createBufferSource();
      crunch.buffer = this._noiseBuffer;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(isCrit ? 1450 : 980, now);
      bp.Q.setValueAtTime(1.8, now);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(isCrit ? 0.26 : 0.15, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + (isCrit ? 0.14 : 0.08));
      crunch.connect(bp);
      bp.connect(g);
      g.connect(this.sfxGain);
      crunch.start(now, Math.random(), 0.15);
    }
  }

  _playPhysicalThud(startFreq = 120, duration = 0.16, volume = 0.3) {
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(startFreq * 1.6, now);
    osc.frequency.exponentialRampToValueAtTime(34, now + duration);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(volume, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  /** Efectos acústicos dedicados para las habilidades de las 7 clases. */
  playSkillCast(type = 'lightning') {
    this.init();
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;

    if (type === 'lightning' || type === 'sentinel_burst') {
      // Trueno real de Zeus: estallido de arco eléctrico + retumbo atmosférico grave
      if (this._noiseBuffer) {
        const crack = this.ctx.createBufferSource();
        crack.buffer = this._noiseBuffer;
        const hp = this.ctx.createBiquadFilter();
        hp.type = 'bandpass';
        hp.frequency.setValueAtTime(2200, now);
        hp.frequency.exponentialRampToValueAtTime(420, now + 0.35);
        hp.Q.setValueAtTime(1.5, now);
        const cg = this.ctx.createGain();
        cg.gain.setValueAtTime(0.38, now);
        cg.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
        crack.connect(hp);
        hp.connect(cg);
        cg.connect(this.sfxGain);
        crack.start(now, 0, 0.4);
      }
      this._playPhysicalThud(75, 0.55, 0.45);
    } else if (type === 'whirlwind' || type === 'erinias_slash') {
      // Ciclón de espadas cortando el aire
      this.playAttackSwing({ comboStep: 2 });
      setTimeout(() => this.playAttackSwing({ comboStep: 1 }), 110);
      setTimeout(() => this.playAttackSwing({ comboStep: 2 }), 220);
    } else if (type === 'shield_slam' || type === 'earth_shatter') {
      // Impacto sísmico de Égida / Cólera de Gea
      this._playPhysicalThud(68, 0.65, 0.52);
      this._playMetallicResonance(340, 0.5, 0.22);
      if (this._pinkNoiseBuffer) {
        const rumble = this.ctx.createBufferSource();
        rumble.buffer = this._pinkNoiseBuffer;
        const lp = this.ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(240, now);
        const rg = this.ctx.createGain();
        rg.gain.setValueAtTime(0.42, now);
        rg.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        rumble.connect(lp);
        lp.connect(rg);
        rg.connect(this.sfxGain);
        rumble.start(now, 0, 0.65);
      }
    } else if (type === 'shout' || type === 'licaon_roar') {
      // Rugido formántico de guerra / Lobo de Licaón
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(type === 'licaon_roar' ? 145 : 115, now);
      osc.frequency.exponentialRampToValueAtTime(68, now + 0.55);

      const formant1 = this.ctx.createBiquadFilter();
      formant1.type = 'bandpass';
      formant1.frequency.setValueAtTime(620, now);
      formant1.frequency.exponentialRampToValueAtTime(340, now + 0.55);
      formant1.Q.setValueAtTime(3.2, now);

      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.32, now + 0.06);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.58);

      osc.connect(formant1);
      formant1.connect(g);
      g.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.6);
    } else if (type === 'solar_nova') {
      // Acorde luminoso de lira + campana solar
      this.pluckKitharaString(293.66, 1.8, 0.2, -0.3, 0.72);
      this.pluckKitharaString(440.00, 1.8, 0.2, 0.3, 0.75);
      this._playMetallicResonance(880, 0.7, 0.12);
    } else {
      // Lanza de Caronte / Condena de Átropos / Flecha Lunar
      this.playAttackSwing({ isBow: type === 'lunar_arrow' || type === 'salva' });
      this._playMetallicResonance(540, 0.4, 0.14);
    }
  }

  /** Ruptura física de vasija de cerámica (fragmentos de terracota). */
  playPotBreak() {
    this.init();
    if (!this.ctx || this.muted) return;
    this._playPhysicalThud(160, 0.11, 0.22);
    // Múltiples fragmentos cerámicos resonantes
    const shardFreqs = [1180, 1540, 1920, 2450];
    shardFreqs.forEach((f, idx) => {
      setTimeout(() => {
        this._playMetallicResonance(f, 0.12, 0.08);
      }, idx * 24);
    });
  }

  /** Corte de arbusto / follaje mediterráneo. */
  playBushCut() {
    this.init();
    if (!this.ctx || this.muted || !this._pinkNoiseBuffer) return;
    const now = this.ctx.currentTime;
    const rustle = this.ctx.createBufferSource();
    rustle.buffer = this._pinkNoiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1850, now);
    bp.Q.setValueAtTime(2.0, now);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.22, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    rustle.connect(bp);
    bp.connect(g);
    g.connect(this.sfxGain);
    rustle.start(now, 0.4, 0.2);
  }

  /** Tintineo físico de Dracmas de Oro, Frasco de Ambrosía o Reliquia. */
  playLootPickup(kind = 'gold', rarity = 'common') {
    this.init();
    if (!this.ctx || this.muted) return;
    if (kind === 'gold') {
      // Tintineo metálico de monedas de oro reales
      this._playMetallicResonance(2150, 0.18, 0.11);
      setTimeout(() => this._playMetallicResonance(2680, 0.22, 0.12), 55);
    } else if (kind === 'potion') {
      // Cristal y líquido
      this._playMetallicResonance(1420, 0.22, 0.1);
      this.pluckKitharaString(587.33, 0.6, 0.14, 0, 0.65);
    } else {
      // Reliquia o Arma: acorde de Kithara según rareza
      const base = rarity === 'unique' ? 440 : rarity === 'rare' ? 392 : 329.63;
      this.pluckKitharaString(base, 1.4, 0.2, -0.2, 0.7);
      if (rarity === 'unique' || rarity === 'rare') {
        setTimeout(() => this.pluckKitharaString(base * 1.5, 1.8, 0.22, 0.2, 0.78), 110);
      }
    }
  }

  /** Fanfarria acústica con Lira de Apolo y tambor ceremonial (Subida de nivel, Hazaña, Altar, Victoria). */
  playFanfare(kind = 'levelup') {
    this.init();
    if (!this.ctx || this.muted) return;
    const chords =
      kind === 'victory'
        ? [293.66, 369.99, 440.00, 587.33, 739.99]
        : kind === 'shrine' || kind === 'fairy'
        ? [329.63, 440.00, 523.25, 659.25]
        : [293.66, 440.00, 587.33];

    if (kind === 'levelup' || kind === 'victory') {
      this.playRitualDrum(58, 0.28);
    }
    chords.forEach((freq, idx) => {
      setTimeout(() => {
        this.pluckKitharaString(freq, 2.8, 0.22, (idx - 1.5) * 0.25, 0.74);
      }, idx * 125);
    });
  }

  /** Muerte de enemigo o colapso de jefe. */
  playEnemyDeath({ isBoss = false, kind = 'skeleton' } = {}) {
    this.init();
    if (!this.ctx || this.muted) return;
    if (isBoss) {
      this.playRitualDrum(46, 0.42);
      this._playPhysicalThud(62, 0.85, 0.48);
      this._playMetallicResonance(280, 0.7, 0.2);
    } else if (kind === 'skeleton') {
      // Colapso de huesos y escudo de bronce
      this._playMetallicResonance(510, 0.2, 0.11);
      this._playPhysicalThud(140, 0.14, 0.2);
    } else {
      this._playPhysicalThud(105, 0.22, 0.26);
    }
  }
}

export const archAudio = new ArchAudioEngine();
