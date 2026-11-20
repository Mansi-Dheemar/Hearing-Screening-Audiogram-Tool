# 🎧 AI Hearing Screening Tool

A free, browser-native, AI-assisted pure-tone hearing screening tool — no installation, no specialised hardware required.

## Features

- Pure-tone audiometry across **6 standard audiometric frequencies** (250 Hz – 8 kHz)
- Independent **left and right ear** testing with stereo isolation
- **Descending volume-step protocol** for threshold detection
- **Real-time audiogram** rendered on HTML5 Canvas (WHO grade shading included)
- **AI-generated report** via Google Gemini API with WHO grade classification
- **Graceful fallback** to local rule-based classification if Gemini is unavailable
- Fully responsive — works on desktop and mobile
- Zero dependencies — pure HTML / CSS / JavaScript

## Project Structure

```
HearingScreeningTool/
├── index.html      — Main UI, screens, Canvas element, medical disclaimer
├── style.css       — Responsive styling (dark/light safe, mobile-ready)
├── audio.js        — Web Audio API tone generation module
├── test.js         — Descending threshold detection protocol
├── audiogram.js    — HTML5 Canvas audiogram renderer
├── report.js       — Google Gemini AI report + local fallback
└── app.js          — Main controller, wires all modules together
```

## Setup

### 1. Add your Gemini API key

Open `report.js` and replace `YOUR_GEMINI_API_KEY_HERE` with a real key:

```js
const GEMINI_API_KEY = 'YOUR_GEMINI_API_KEY_HERE';
```

Get a free key at: https://aistudio.google.com/app/apikey

> **No key?** The tool still works — it falls back to a built-in rule-based WHO classification.

### 2. Run locally

Simply open `index.html` in a modern browser. No build step needed.

```bash
# Optional: serve with a local dev server to avoid CORS issues with Gemini API
npx serve .
# or
python -m http.server 8080
```

### 3. Deploy to Vercel

```bash
npm i -g vercel
vercel
```

## How It Works

1. **Volume Check** — User sets a comfortable headphone volume using a 1 kHz reference tone.
2. **Test** — 12 frequency/ear combinations tested. Each starts at 70 dB HL and steps down in 10 dB increments. The user presses "I Hear It" when they detect the tone. Threshold = lowest level heard.
3. **Audiogram** — Thresholds plotted live on a canvas using standard audiometric symbols (× for left, ○ for right).
4. **AI Report** — Threshold data serialised and sent to Gemini with the WHO grading table embedded in the prompt. Response rendered inline.

## Medical Disclaimer

This tool is a **screening aid only** and is not a substitute for a clinical diagnosis by a qualified audiologist. Results should not be used for medical decision-making.

## Technology Stack

| Layer           | Technology                        |
|-----------------|-----------------------------------|
| Audio Engine    | Web Audio API (browser-native)    |
| Visualisation   | HTML5 Canvas API                  |
| AI Interpretation | Google Gemini API (free tier)   |
| Deployment      | Vercel                            |
| Languages       | HTML5, CSS3, Vanilla JavaScript   |

## WHO Hearing Loss Grading Scale

| Grade    | Threshold (dB HL) | Description                            |
|----------|-------------------|----------------------------------------|
| Normal   | 0 – 25            | No significant impairment              |
| Mild     | 26 – 40           | Difficulty with soft/distant speech    |
| Moderate | 41 – 60           | Difficulty following conversation      |
| Severe   | 61 – 80           | Little speech understood unaided       |
| Profound | > 80              | Little or no residual hearing          |

## References

- Margolis & Saly (2007) — Internet-based audiometry reliability
- Shetty & Hegde (2019) — SVM audiogram classification
- Patro, Panda & Hota (2021) — Deep learning audiogram classification
- World Health Organization (2021) — World Report on Hearing
- W3C Web Audio API Specification (2023)
