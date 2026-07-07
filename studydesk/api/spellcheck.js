// api/spellcheck.js
// Deploy this on Vercel (or similar). It runs on the SERVER, so your
// OPENAI_API_KEY environment variable is never exposed to the browser.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text } = req.body || {};

  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'Missing "text" in request body' });
  }

  const prompt = `You are a spell checker. Find every misspelled word in the text below. Return ONLY valid JSON in exactly this shape, with no markdown fences, no preamble, no explanation:
{"fixed":"the fully corrected text","errors":[{"wrong":"misspeled","correct":"misspelled"}]}

If there are no errors, return {"fixed":"<original text unchanged>","errors":[]}.

Text to check:
${text}`;

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
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!apiRes.ok) {
      const errBody = await apiRes.text().catch(() => '');
      console.error('OpenAI API error:', apiRes.status, errBody);
      return res.status(502).json({ error: 'AI service error', status: apiRes.status });
    }

    const data = await apiRes.json();
    let raw = data.choices?.[0]?.message?.content?.trim();

    if (!raw) {
      return res.status(502).json({ error: 'Empty response from AI' });
    }

    raw = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) raw = jsonMatch[0];

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (parseErr) {
      console.error('Failed to parse AI JSON:', raw);
      return res.status(502).json({ error: 'Could not parse AI response' });
    }

    const errors = Array.isArray(parsed.errors) ? parsed.errors : [];
    const fixed = typeof parsed.fixed === 'string' ? parsed.fixed : text;

    return res.status(200).json({ fixed, errors });
  } catch (e) {
    console.error('Spellcheck proxy error:', e);
    return res.status(500).json({ error: 'Server error' });
  }
}
