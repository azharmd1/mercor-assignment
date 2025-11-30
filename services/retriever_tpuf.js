import fs from 'fs';
import path from 'path';

function normalize(txt) {
  return (txt || '').toLowerCase().replace(/[^a-z0-9&+\-\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function loadSample() {
  const p = path.resolve('tpuf_sample.json');
  const raw = fs.readFileSync(p, 'utf8');
  return JSON.parse(raw);
}

export default async function retrieveTpuf(jobConfig, topN = 10) {
  const tpufKey = process.env.TURBOPUFFER_API_KEY;
  const endpoint = process.env.TURBOPUFFER_ENDPOINT || 'https://api.turbopuffer.io/v1/search';

  const jobTextParts = [];
  if (jobConfig) {
    if (jobConfig.title) jobTextParts.push(jobConfig.title);
    if (jobConfig.description) jobTextParts.push(jobConfig.description);
    if (Array.isArray(jobConfig.hard_criteria)) jobTextParts.push(jobConfig.hard_criteria.join(' '));
    if (Array.isArray(jobConfig.soft_criteria)) jobTextParts.push(jobConfig.soft_criteria.join(' '));
  }
  const query = normalize(jobTextParts.join(' '));

  // Try to compute an embedding for the job text (prefer OpenAI if available)
  let embedding = null;
  try {
    if (process.env.OAI_KEY) {
      const embRes = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OAI_KEY}`
        },
        body: JSON.stringify({ model: 'text-embedding-3-small', input: query })
      });
      if (embRes.ok) {
        const embData = await embRes.json();
        embedding = embData.data && embData.data[0] && embData.data[0].embedding;
      } else {
        console.warn('OpenAI embedding request failed:', embRes.status, await embRes.text());
      }
    }
  } catch (e) {
    console.warn('Embedding generation failed (OpenAI):', e && e.message ? e.message : e);
  }

  if (tpufKey) {
    try {
      const body = embedding ? { vector: embedding, top_k: topN } : { query, top_k: topN };
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tpufKey}`
        },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        console.warn('TPUF remote retrieval failed:', res.status, await res.text());
      } else {
        const data = await res.json();
        const hits = data.candidates || data.hits || data.results || [];
        if (Array.isArray(hits) && hits.length > 0) {
          return hits.slice(0, topN).map(h => ({ _id: h._id || h.id || h._id_str || null, ...h }));
        }
      }
    } catch (e) {
      console.warn('TPUF remote retrieval error, falling back to local sample:', e && e.message ? e.message : e);
    }
  }

  // fallback to local
  const candidates = loadSample();
  const jtxt = query;
  const jtokens = new Set(jtxt.split(' ').filter(Boolean));

  const scored = candidates.map(c => {
    const ctxt = normalize(c.rerankSummary || '');
    const ctokens = new Set(ctxt.split(' ').filter(Boolean));
    let overlap = 0;
    for (const t of jtokens) if (ctokens.has(t)) overlap++;
    return { candidate: c, score: overlap };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topN).map(s => s.candidate);
}
