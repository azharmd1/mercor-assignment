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

export default function retrieve(jobConfig, topN = 10) {
  const candidates = loadSample();
  const jobTextParts = [];
  if (jobConfig) {
    if (jobConfig.title) jobTextParts.push(jobConfig.title);
    if (jobConfig.description) jobTextParts.push(jobConfig.description);
    if (Array.isArray(jobConfig.hard_criteria)) jobTextParts.push(jobConfig.hard_criteria.join(' '));
    if (Array.isArray(jobConfig.soft_criteria)) jobTextParts.push(jobConfig.soft_criteria.join(' '));
  }
  const jtxt = normalize(jobTextParts.join(' '));
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
