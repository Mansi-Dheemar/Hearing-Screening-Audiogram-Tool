/**
 * test.js
 * Descending volume-step threshold detection protocol.
 *
 * For each frequency × ear combination:
 *  1. Start at START_DB_HL and play the tone.
 *  2. While the user holds the "I Hear It" button → they can hear it.
 *  3. On release (or if they never pressed) → step DOWN by STEP_DB.
 *  4. When user stops responding for a full presentation → step UP by STEP_UP_DB to confirm.
 *  5. Threshold = the lowest level at which the user responded.
 *  6. A random pre-tone delay (0.5–1.5 s) prevents anticipatory clicks.
 *
 * Produces a thresholds object: { left: {250:val, 500:val, …}, right: {…} }
 */

const TestEngine = (() => {
  const FREQUENCIES   = AudioEngine.FREQUENCIES;   // [250,500,1000,2000,4000,8000]
  const START_DB_HL   = 70;   // Start well above threshold
  const MIN_DB_HL     = -10;  // Don't go below this
  const MAX_DB_HL     = 100;
  const STEP_DOWN     = 10;   // dB step down while user responds
  const STEP_UP       = 5;    // dB step up after first miss
  const TONE_DURATION = 1500; // ms — how long each tone presentation lasts

  let thresholds = { left: {}, right: {} };
  let onProgress = null;  // callback(currentStep, totalSteps, ear, freq)
  let onComplete = null;  // callback(thresholds)
  let hearBtn    = null;

  // Build the full test sequence: left ear first, then right ear
  function buildSequence() {
    const seq = [];
    ['left', 'right'].forEach(ear => {
      FREQUENCIES.forEach(freq => {
        seq.push({ ear, freq });
      });
    });
    return seq;
  }

  function randomDelay(min = 500, max = 1500) {
    return Math.floor(Math.random() * (max - min)) + min;
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Run one frequency/ear pair through the descending protocol.
   * Returns the measured threshold in dB HL.
   */
  async function measureThreshold(freq, ear) {
    let level = START_DB_HL;
    let threshold = null;
    let consecutiveMisses = 0;

    // We need at least 2 confirmations at the same level to accept a threshold
    let confirmLevel = null;
    let confirmCount = 0;

    while (true) {
      // Clamp
      level = Math.min(MAX_DB_HL, Math.max(MIN_DB_HL, level));

      // Random pre-tone delay to prevent anticipatory responses
      await sleep(randomDelay(500, 1500));

      // Play tone
      AudioEngine.play(freq, level, ear);

      // Wait for user to press+hold button or let TONE_DURATION elapse
      const heard = await waitForResponse(TONE_DURATION);

      AudioEngine.stop();

      if (heard) {
        threshold = level;           // candidate threshold
        consecutiveMisses = 0;

        if (confirmLevel === level) {
          confirmCount++;
          if (confirmCount >= 1) {
            // Confirmed — threshold found
            break;
          }
        } else {
          confirmLevel = level;
          confirmCount = 1;
        }

        level -= STEP_DOWN;          // Step down after hearing

      } else {
        consecutiveMisses++;
        confirmLevel = null;
        confirmCount = 0;

        if (threshold !== null) {
          // Already had a response; step up to re-confirm
          level += STEP_UP;
          if (level > threshold + STEP_DOWN) {
            // Exceeded range — accept last confirmed threshold
            break;
          }
        } else {
          // No response yet — step down further (shouldn't normally happen at START_DB)
          level -= STEP_DOWN;
        }

        // Hard floor — user cannot hear at any level
        if (level <= MIN_DB_HL && threshold === null) {
          threshold = MAX_DB_HL; // Record as profound loss
          break;
        }
      }

      // Safety: avoid infinite loops
      if (level > MAX_DB_HL) { threshold = threshold ?? MAX_DB_HL; break; }
    }

    return threshold ?? MAX_DB_HL;
  }

  /**
   * Returns a Promise<boolean> that resolves to:
   *   true  — if the user pressed+held the button during the window
   *   false — if the tone window elapsed without a press
   */
  function waitForResponse(durationMs) {
    return new Promise(resolve => {
      let responded = false;

      const onDown = () => {
        responded = true;
      };

      hearBtn.addEventListener('pointerdown', onDown);

      setTimeout(() => {
        hearBtn.removeEventListener('pointerdown', onDown);
        resolve(responded);
      }, durationMs);
    });
  }

  /**
   * Run the complete test sequence.
   * @param {HTMLElement} btn         - The "I Hear It" button element
   * @param {function} progressCb     - (stepIndex, totalSteps, ear, freq) => void
   * @param {function} completeCb     - (thresholds) => void
   */
  async function run(btn, progressCb, completeCb) {
    hearBtn    = btn;
    onProgress = progressCb;
    onComplete = completeCb;
    thresholds = { left: {}, right: {} };

    const sequence = buildSequence();
    const total    = sequence.length;

    for (let i = 0; i < total; i++) {
      const { ear, freq } = sequence[i];
      onProgress(i, total, ear, freq);
      const threshold = await measureThreshold(freq, ear);
      thresholds[ear][freq] = threshold;
    }

    AudioEngine.stop();
    onComplete(thresholds);
  }

  return { run };
})();
