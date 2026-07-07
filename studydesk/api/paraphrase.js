// api/paraphrase.js
// Deploy this on Vercel (or similar). It runs on the SERVER, so your
// OPENAI_API_KEY environment variable is never exposed to the browser.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text, style } = req.body || {};

  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'Missing "text" in request body' });
  }

  const STYLE_MAP = {
    standard: 'Rewrite the following text in a clear and natural way, same meaning but different wording. Preserve the full length and all the original content/details — do not summarize or cut anything out.',
    formal: 'Rewrite in a formal academic tone suitable for essays. Preserve the full length and all the original content/details — do not summarize or cut anything out.',
    simple: 'Rewrite in very simple, easy language. Preserve the full length and all the original content/details — do not summarize or cut anything out.',
    creative: 'Rewrite in a creative, vivid and engaging way. Preserve the full length and all the original content/details — do not summarize or cut anything out.',
    shorter: 'Rewrite as a concise summary, keeping only the most important points.'
  };

  const instruction = STYLE_MAP[style] || STYLE_MAP.standard;

  try {
    const apiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: `${instruction}\n\nText:\n${text}\n\nRespond ONLY with the paraphrased text — no preamble, no notes, no markdown formatting, nothing else.`
          }
        ]
      })
    });

    if (!apiRes.ok) {
      const errBody = await apiRes.text().catch(() => '');
      console.error('OpenAI API error:', apiRes.status, errBody);
      return res.status(502).json({ error: 'AI service error', status: apiRes.status });
    }

    const data = await apiRes.json();
    const result = data.choices?.[0]?.message?.content?.trim();

    if (!result) {
      return res.status(502).json({ error: 'Empty response from AI' });
    }

    return res.status(200).json({ result });
  } catch (e) {
    console.error('Paraphrase proxy error:', e);
    return res.status(500).json({ error: 'Server error' });
  }
}
