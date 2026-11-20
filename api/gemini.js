export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
  }

  const GEMINI_ENDPOINT =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent';

  try {
    const { prompt } = req.body;
    const response = await fetch(GEMINI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      }),
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      return res.status(response.status).json({ error: errBody?.error?.message || 'Gemini API error' });
    }

    const data = await response.json();
    const html = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!html || !html.trim()) {
      return res.status(500).json({ error: 'Empty response from Gemini' });
    }

    return res.status(200).json({ html });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
