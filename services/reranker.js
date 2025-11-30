// OpenAI-based reranker with fallback
export default async function rerankCandidates(jobConfig, candidates) {
  // candidates: array of objects with at least {_id, rerankSummary}
  // Try to use OpenAI chat completions to score each candidate between 0 and 1.
  if (process.env.OAI_KEY) {
    try {
      const prompt = `You are a scoring assistant. Given the job description and candidate summaries, return a JSON array of objects with fields {"id": "<candidate id>", "score": <number 0-1>} representing how well each candidate matches the job. Return ONLY valid JSON.

Job description:\n${jobConfig.title || ''}\n${jobConfig.description || ''}\n\nCandidates:\n${candidates.map(c => `ID: ${c._id}\\nSummary: ${c.rerankSummary || ''}`).join('\n\n')}`;

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OAI_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0
        })
      });

      if (!res.ok) {
        console.warn('OpenAI reranker call failed:', res.status, await res.text());
        throw new Error('OpenAI failed');
      }

      const data = await res.json();
      const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
      if (!content) throw new Error('No content from OpenAI');

      // Try parsing JSON from the response
      let json;
      try {
        json = JSON.parse(content);
      } catch (e) {
        // Attempt to extract JSON substring
        const m = content.match(/\{[\s\S]*\}/m) || content.match(/\[[\s\S]*\]/m);
        if (m) json = JSON.parse(m[0]);
        else throw e;
      }

      // Map to scores for our candidate ids
      const map = new Map();
      if (Array.isArray(json)) {
        for (const item of json) {
          if (item && item.id != null && typeof item.score === 'number') map.set(String(item.id), Math.max(0, Math.min(1, item.score)));
        }
      }

      // Return scores aligned with candidates order, fallback to 0 if missing
      return candidates.map(c => ({ id: c._id, score: map.has(String(c._id)) ? map.get(String(c._id)) : 0 }));
    } catch (e) {
      console.warn('Reranker error, falling back to heuristic:', e && e.message ? e.message : e);
    }
  }

  // Fallback heuristic: keyword overlap between job description and candidate summary
  const jobText = `${jobConfig.title || ''} ${jobConfig.description || ''}`.toLowerCase();
  const keywords = Array.from(new Set((jobText.match(/\b[a-z]{3,}\b/g) || []))).slice(0, 40);
  const scores = candidates.map(c => {
    const text = (c.rerankSummary || '').toLowerCase();
    let matched = 0;
    for (const k of keywords) if (text.includes(k)) matched++;
    const score = keywords.length > 0 ? +(matched / keywords.length).toFixed(2) : 0;
    return { id: c._id, score };
  });
  return scores;
}
