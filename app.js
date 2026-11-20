/**
 * app.js
 * Main application controller — wires together all modules:
 *   AudioEngine  (audio.js)
 *   TestEngine   (test.js)
 *   Audiogram    (audiogram.js)
 *   ReportEngine (report.js)
 */

(function () {
  'use strict';

  // ── DOM references ───────────────────────────────────────────────────────────
  const screens = {
    welcome: document.getElementById('screen-welcome'),
    volume:  document.getElementById('screen-volume'),
    test:    document.getElementById('screen-test'),
    results: document.getElementById('screen-results'),
  };

  const el = {
    btnStartVolCheck:  document.getElementById('btn-start-volume-check'),
    btnPlayCalib:      document.getElementById('btn-play-calibration'),
    btnStopCalib:      document.getElementById('btn-stop-calibration'),
    btnConfirmVolume:  document.getElementById('btn-confirm-volume'),
    testStatusLabel:   document.getElementById('test-status-label'),
    testStepLabel:     document.getElementById('test-step-label'),
    progressBar:       document.getElementById('progress-bar'),
    toneResponseArea:  document.getElementById('tone-response-area'),
    btnHear:           document.getElementById('btn-hear'),
    audiogramCanvas:   document.getElementById('audiogram-canvas'),
    aiReportLoading:   document.getElementById('ai-report-loading'),
    aiReportContent:   document.getElementById('ai-report-content'),
    btnDownload:       document.getElementById('btn-download-audiogram'),
    btnRetake:         document.getElementById('btn-retake'),
  };

  // ── Utility ──────────────────────────────────────────────────────────────────
  function showScreen(name) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[name].classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function formatFreq(hz) {
    return hz >= 1000 ? (hz / 1000) + ' kHz' : hz + ' Hz';
  }

  function earLabel(ear) {
    return ear === 'left' ? 'Left Ear 👂' : 'Right Ear 👂';
  }

  // ── Screen: Welcome → Volume Check ──────────────────────────────────────────
  el.btnStartVolCheck.addEventListener('click', () => {
    showScreen('volume');
  });

  // ── Screen: Volume Check ─────────────────────────────────────────────────────
  el.btnPlayCalib.addEventListener('click', () => {
    AudioEngine.play(1000, 60, 'both'); // 1 kHz reference tone
    el.btnPlayCalib.disabled  = true;
    el.btnStopCalib.disabled  = false;
  });

  el.btnStopCalib.addEventListener('click', () => {
    AudioEngine.stop();
    el.btnPlayCalib.disabled  = false;
    el.btnStopCalib.disabled  = true;
  });

  el.btnConfirmVolume.addEventListener('click', () => {
    AudioEngine.stop();
    el.btnPlayCalib.disabled  = false;
    el.btnStopCalib.disabled  = true;
    startTest();
  });

  // ── Screen: Test ─────────────────────────────────────────────────────────────
  function startTest() {
    showScreen('test');
    el.toneResponseArea.classList.remove('hidden');
    el.testStatusLabel.textContent = 'Starting test…';

    // Initialise audiogram (draw empty axes now so the canvas is ready)
    Audiogram.init(el.audiogramCanvas);

    TestEngine.run(
      el.btnHear,
      onTestProgress,
      onTestComplete
    );
  }

  function onTestProgress(stepIndex, totalSteps, ear, freq) {
    const pct = Math.round((stepIndex / totalSteps) * 100);
    el.progressBar.style.width = pct + '%';
    el.testStatusLabel.textContent =
      `Testing ${earLabel(ear)} — ${formatFreq(freq)}`;
    el.testStepLabel.textContent =
      `Step ${stepIndex + 1} of ${totalSteps}`;
  }

  function onTestComplete(thresholds) {
    // Hide response button, update progress to 100%
    el.toneResponseArea.classList.add('hidden');
    el.progressBar.style.width   = '100%';
    el.testStatusLabel.textContent = '✅ Test complete! Generating your results…';

    // Brief pause, then show results
    setTimeout(() => {
      showScreen('results');
      Audiogram.render(thresholds);
      generateReport(thresholds);
    }, 800);
  }

  // ── "I Hear It" button visual feedback ───────────────────────────────────────
  el.btnHear.addEventListener('pointerdown', () => {
    el.btnHear.classList.add('pressed');
  });
  el.btnHear.addEventListener('pointerup',   () => {
    el.btnHear.classList.remove('pressed');
  });
  el.btnHear.addEventListener('pointerleave', () => {
    el.btnHear.classList.remove('pressed');
  });

  // ── Report generation ────────────────────────────────────────────────────────
  function generateReport(thresholds) {
    el.aiReportLoading.classList.remove('hidden');
    el.aiReportContent.classList.add('hidden');

    ReportEngine.generate(thresholds, (html) => {
      el.aiReportLoading.classList.add('hidden');
      el.aiReportContent.innerHTML = html;
      el.aiReportContent.classList.remove('hidden');
    });
  }

  // ── Download audiogram ────────────────────────────────────────────────────────
  el.btnDownload.addEventListener('click', () => {
    const dataUrl = Audiogram.exportPNG();
    const a = document.createElement('a');
    a.href     = dataUrl;
    a.download = 'audiogram.png';
    a.click();
  });

  // ── Retake test ───────────────────────────────────────────────────────────────
  el.btnRetake.addEventListener('click', () => {
    AudioEngine.stop();
    el.aiReportContent.innerHTML = '';
    el.aiReportContent.classList.add('hidden');
    el.aiReportLoading.classList.add('hidden');
    el.progressBar.style.width = '0%';
    showScreen('welcome');
  });

})();
