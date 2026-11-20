/**
 * audio.js
 * Web Audio API — pure-tone generation module.
 * Generates calibrated sine-wave tones at standard audiometric frequencies
 * with stereo panning (left / right ear isolation) and linear fade-in / fade-out
 * to eliminate audible clicks.
 */

const AudioEngine = (() => {
  // Standard audiometric frequencies (Hz)
  const FREQUENCIES = [250, 500, 1000, 2000, 4000, 8000];

  // dB HL → Web Audio gainValue conversion.
  // We treat 0 dB HL as a reference gain of 1.0 and map linearly in dB space.
  // Starting level for threshold search is 70 dB HL (gain ≈ 3162).
  // Minimum testable level is −10 dB HL (gain ≈ 0.316).
  const DB_REF = 0;       // 0 dB HL reference
  const DB_RANGE = 110;   // covers −10 … 100 dB HL

  function dbHLtoGain(dbHL) {
    // Map dB HL to a 0…1 gain value bounded to [0.0001, 1.0]
    // 70 dB HL → gain = 1.0 (max comfortable starting level)
    const normalised = (dbHL - (-10)) / DB_RANGE; // 0 … 1
    return Math.max(0.00001, Math.min(1.0, normalised));
  }

  let ctx = null;
  let currentNodes = null; // { osc, gainNode, panner }

  function getContext() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    // iOS / Chrome: resume if suspended
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  /**
   * Play a pure tone.
   * @param {number} frequency  - Hz (one of FREQUENCIES)
   * @param {number} dbHL       - dB HL level (−10 … 100)
   * @param {'left'|'right'|'both'} ear
   * @param {number} [fadeDuration=0.05] - seconds for fade-in and fade-out ramp
   */
  function play(frequency, dbHL, ear, fadeDuration = 0.05) {
    stop(); // always stop any current tone first

    const context = getContext();
    const now = context.currentTime;

    const osc = context.createOscillator();
    const gainNode = context.createGain();
    const panner = context.createStereoPanner
      ? context.createStereoPanner()
      : context.createPanner();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, now);

    const targetGain = dbHLtoGain(dbHL);

    // Linear fade-in to avoid click
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(targetGain, now + fadeDuration);

    // Stereo pan
    let panValue = 0;
    if (ear === 'left') panValue = -1;
    if (ear === 'right') panValue = 1;

    if (context.createStereoPanner) {
      panner.pan.setValueAtTime(panValue, now);
    } else {
      // Legacy PannerNode fallback
      panner.setPosition(panValue, 0, 1 - Math.abs(panValue));
    }

    osc.connect(gainNode);
    gainNode.connect(panner);
    panner.connect(context.destination);

    osc.start(now);

    currentNodes = { osc, gainNode, panner };
  }

  /**
   * Stop the currently playing tone with a short fade-out to prevent clicks.
   * @param {number} [fadeDuration=0.05]
   */
  function stop(fadeDuration = 0.05) {
    if (!currentNodes) return;
    const context = getContext();
    const now = context.currentTime;
    const { osc, gainNode } = currentNodes;
    gainNode.gain.setValueAtTime(gainNode.gain.value, now);
    gainNode.gain.linearRampToValueAtTime(0, now + fadeDuration);
    osc.stop(now + fadeDuration + 0.01);
    currentNodes = null;
  }

  return { play, stop, FREQUENCIES, dbHLtoGain };
})();
