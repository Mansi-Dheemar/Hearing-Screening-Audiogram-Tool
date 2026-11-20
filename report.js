/**
 * report.js
 * AI report generation via Google Gemini API.
 *
 * Sends the full 12-value threshold set to Gemini along with the WHO grading table.
 * Falls back to a local rule-based classification if the API call fails.
 */

const ReportEngine = (() => {

  // ── WHO grading table ────────────────────────────────────────────────────────
  const WHO_GRADES = [
    { label: 'Normal',   min: -Infinity, max: 25  },
    { label: 'Mild',     min: 25,        max: 40  },
    { label: 'Moderate', min: 40,        max: 60  },
    { label: 'Severe',   min: 60,        max: 80  },
    { label: 'Profound', min: 80,        max: Infinity },
  ];

  // ── Gemini API config ─────────────────────────────────────────────────────────
  const GEMINI_API_KEY = 'YOUR_GEMINI_API_KEY_HERE';
  const GEMINI_ENDPOINT =
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent`;

  // ── Groq API config (fallback if Gemini fails) ────────────────────────────────
  const GROQ_API_KEY  = 'YOUR_GROQ_API_KEY_HERE';
  const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
  const GROQ_MODEL    = 'qwen/qwen3.8-27b';

  // ── Helper: average threshold across tested frequencies (PTA) ────────────────
  function pta(earData) {
    // Standard 4-frequency PTA: 500, 1000, 2000, 4000 Hz
    const ptaFreqs = [500, 1000, 2000, 4000];
    const values   = ptaFreqs.map(f => earData[f]).filter(v => v !== undefined);
    if (!values.length) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  function whoGrade(avgDb) {
    for (const g of WHO_GRADES) {
      if (avgDb >= g.min && avgDb < g.max) return g.label;
    }
    return 'Profound';
  }

  // ── Loss pattern detection (flat / high-frequency / low-frequency) ───────────
  function lossPattern(earData) {
    const low  = ((earData[250] ?? 0) + (earData[500] ?? 0)) / 2;
    const high = ((earData[4000] ?? 0) + (earData[8000] ?? 0)) / 2;
    const diff = high - low;
    if (diff > 20)  return 'high-frequency sloping';
    if (diff < -20) return 'low-frequency rising';
    return 'flat / uniform';
  }

  // ── Fallback: local rule-based report ────────────────────────────────────────
  function localReport(thresholds) {
    const ears = ['left', 'right'];
    const lines = [];

    ears.forEach(ear => {
      const data  = thresholds[ear];
      const avg   = pta(data);
      const grade = whoGrade(avg);
      const pattern = lossPattern(data);

      lines.push(`<h3>${ear.charAt(0).toUpperCase() + ear.slice(1)} Ear</h3>`);
      lines.push(`<p><strong>WHO Grade:</strong> ${grade} (average PTA: ${avg.toFixed(1)} dB HL)</p>`);
      lines.push(`<p><strong>Loss Pattern:</strong> ${pattern}</p>`);

      if (grade === 'Normal') {
        lines.push(`<p>Your ${ear} ear thresholds are within the normal range. No intervention is currently indicated. Continue protecting your hearing from excessive noise exposure.</p>`);
      } else if (grade === 'Mild') {
        lines.push(`<p>Your ${ear} ear shows mild hearing loss. You may find it difficult to follow soft speech in noisy environments. Consider consulting an audiologist for a full clinical evaluation, particularly if this affects daily communication.</p>`);
      } else if (grade === 'Moderate') {
        lines.push(`<p>Your ${ear} ear shows moderate hearing loss. Following normal conversation may be difficult without amplification. A clinical audiological assessment is strongly recommended.</p>`);
      } else if (grade === 'Severe') {
        lines.push(`<p>Your ${ear} ear shows severe hearing loss. Little speech is understood without amplification. Please consult a licensed audiologist as soon as possible to discuss hearing-aid options and further evaluation.</p>`);
      } else {
        lines.push(`<p>Your ${ear} ear shows profound hearing loss. Urgent referral to an audiologist or ENT specialist is recommended to discuss all available management options, including hearing aids or cochlear implant candidacy.</p>`);
      }
    });

    lines.push(`<p class="report-disclaimer">⚠️ This is an automated screening result, not a clinical diagnosis. Please consult a qualified audiologist to confirm these findings.</p>`);
    return lines.join('\n');
  }

  // ── Build the Gemini prompt ───────────────────────────────────────────────────
  function buildPrompt(thresholds) {
    const freqs = [250, 500, 1000, 2000, 4000, 8000];

    const tableRows = freqs.map(f =>
      `| ${f} Hz | ${thresholds.left[f] ?? 'N/A'} dB HL | ${thresholds.right[f] ?? 'N/A'} dB HL |`
    ).join('\n');

    return `You are an expert audiologist assistant. Analyse the following pure-tone audiometry screening results and produce a clear, personalised hearing health report.

## Threshold Data
| Frequency | Left Ear | Right Ear |
|-----------|----------|-----------|
${tableRows}

## WHO Hearing Loss Grading Scale (for reference)
| Grade    | Threshold Range   | Description                                      |
|----------|-------------------|--------------------------------------------------|
| Normal   | 0 – 25 dB HL      | No significant impairment                        |
| Mild     | 26 – 40 dB HL     | Difficulty with soft or distant speech           |
| Moderate | 41 – 60 dB HL     | Difficulty following normal conversation         |
| Severe   | 61 – 80 dB HL     | Little speech understood without amplification   |
| Profound | Above 80 dB HL    | Little or no residual hearing                    |

## Instructions
Please produce a report with the following structure, formatted in HTML:

1. A <h3> heading for each ear (Left Ear, Right Ear).
2. For each ear: state the WHO grade, the 4-frequency pure-tone average (PTA at 500, 1000, 2000, 4000 Hz), and the pattern of hearing loss (flat, high-frequency sloping, or low-frequency rising).
3. A short plain-language paragraph (2–4 sentences) explaining what the result means for that person's daily life.
4. A clear, evidence-based recommendation — including whether the person should consult a licensed audiologist, and with what urgency.
5. End with a brief overall summary paragraph.
6. Use a warm, reassuring, non-alarmist tone throughout.
7. Include a final disclaimer paragraph in a <p class="report-disclaimer"> tag stating this is a screening tool only and is not a substitute for clinical diagnosis.

Output ONLY the HTML content (no markdown fences, no \`\`\`html wrapper).`;
  }

  // ── Gemini API call ──────────────────────────────────────────────────────────
  async function callGemini(thresholds) {
    const response = await fetch(GEMINI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(thresholds) }] }]
      })
    });
    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(`Gemini error: ${response.status} — ${errBody?.error?.message || 'unknown'}`);
    }
    const data = await response.json();
    const html = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!html || !html.trim()) throw new Error('Empty response from Gemini');
    return html;
  }

  // ── Groq API call (fallback) ─────────────────────────────────────────────────
  async function callGroq(thresholds) {
    const response = await fetch(GROQ_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: 'user', content: buildPrompt(thresholds) }],
        temperature: 0.7,
        max_tokens: 1500,
      })
    });
    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(`Groq error: ${response.status} — ${errBody?.error?.message || 'unknown'}`);
    }
    const data = await response.json();
    const html = data?.choices?.[0]?.message?.content;
    if (!html || !html.trim()) throw new Error('Empty response from Groq');
    return html;
  }

  // ── Main generate function: Gemini → Groq → Local ───────────────────────────
  async function generate(thresholds, onHTML) {
    // 1️⃣ Try Gemini first
    if (GEMINI_API_KEY && GEMINI_API_KEY !== 'YOUR_GEMINI_API_KEY_HERE') {
      try {
        const html = await callGemini(thresholds);
        console.log('✅ Report generated via Gemini');
        onHTML(html);
        return;
      } catch (err) {
        console.warn('⚠️ Gemini failed, trying Groq...', err.message);
      }
    }

    // 2️⃣ Try Groq as fallback
    if (GROQ_API_KEY && GROQ_API_KEY !== 'YOUR_GROQ_API_KEY_HERE') {
      try {
        const html = await callGroq(thresholds);
        console.log('✅ Report generated via Groq (fallback)');
        onHTML(html);
        return;
      } catch (err) {
        console.warn('⚠️ Groq also failed, using local report...', err.message);
      }
    }

    // 3️⃣ Local fallback
    console.warn('⚠️ All AI providers failed, using local report');
    onHTML(localReport(thresholds));
  }

  return { generate };
})();
