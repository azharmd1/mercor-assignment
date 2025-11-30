import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

const configsDir = path.resolve('configs');
const outDir = path.resolve('output/submissions');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

async function callEvaluateRemote(configPath, objectIds) {
  const url = 'https://mercor-dev--search-eng-interview.modal.run/evaluate';
  const body = {
    config_path: path.basename(configPath),
    object_ids: objectIds
  };
  const headers = {
    'Content-Type': 'application/json',
  };
  if (process.env.AUTH_EMAIL) headers['Authorization'] = process.env.AUTH_EMAIL;

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });
  return res.json();
}

async function main() {
  // choose retriever implementation: TPUF-backed if API key present, otherwise local
  let retrieve;
  if (process.env.TURBOPUFFER_API_KEY) {
    try {
      const mod = await import('./services/retriever_tpuf.js');
      retrieve = mod.default;
    } catch (e) {
      console.warn('Failed to import TPUF retriever, falling back to local:', e && e.message ? e.message : e);
      const mod = await import('./services/retriever.js');
      retrieve = mod.default;
    }
  } else {
    const mod = await import('./services/retriever.js');
    retrieve = mod.default;
  }
  const files = fs.readdirSync(configsDir).filter(f => f.endsWith('.yml'));

  for (const f of files) {
    const cfgPath = path.join(configsDir, f);
    const raw = fs.readFileSync(cfgPath, 'utf8');
    const force = process.env.FORCE_SUBMIT_EMPTY === 'true';
    if ((!raw || raw.trim().length === 0) && !force) {
      console.log('Skipping empty config', f);
      continue;
    }
    const jobConfig = raw && raw.trim().length > 0 ? yaml.load(raw) : { title: path.basename(f), description: '' };
    console.log('Retrieving for', f);
    const candidates = await retrieve(jobConfig, 10);

    // Evaluate + rerank locally before submission
    // Import evaluator and reranker dynamically
    const evalMod = await import('./services/evaluator.js');
    const rerankMod = await import('./services/reranker.js');
    const evaluate = evalMod.default;
    const rerank = rerankMod.default;

    // Run evaluator for each candidate (returns score and matched_skills)
    const evaluations = [];
    for (const c of candidates) {
      const evalRes = await evaluate(c, jobConfig);
      evaluations.push({ id: c._id, evaluation: evalRes });
    }

    // Run reranker (OpenAI or fallback) to get scores for candidates
    const rerankResults = await rerank(jobConfig, candidates);
    const rerankMap = new Map(rerankResults.map(r => [String(r.id), r.score]));

    // Combine scores: weighted average (0.6 eval, 0.4 rerank)
    const combined = candidates.map(c => {
      const evalObj = evaluations.find(e => String(e.id) === String(c._id));
      const evalScore = evalObj && typeof evalObj.evaluation?.score === 'number' ? evalObj.evaluation.score : 0;
      const rerScore = rerankMap.has(String(c._id)) ? rerankMap.get(String(c._id)) : 0;
      const final_score = Math.min(1, +(0.6 * evalScore + 0.4 * rerScore).toFixed(3));
      return { ...c, evaluation: evalObj ? evalObj.evaluation : null, rerank_score: rerScore, final_score };
    });

    // Sort by final_score descending
    combined.sort((a, b) => (b.final_score || 0) - (a.final_score || 0));
    const objectIds = combined.map(c => c._id);

    // Write submission file
    const outPath = path.join(outDir, `${f}.json`);
    fs.writeFileSync(outPath, JSON.stringify({ config: f, object_ids: objectIds, candidates: combined }, null, 2));
    console.log('Wrote', outPath, '->', objectIds.length, 'candidates');

    if (process.env.EVAL_REMOTE === 'true') {
      if (!process.env.AUTH_EMAIL) {
        console.warn('EVAL_REMOTE=true but AUTH_EMAIL not set — skipping remote eval call');
      } else {
        try {
          const resp = await callEvaluateRemote(f, objectIds);
          fs.writeFileSync(path.join(outDir, `${f}.response.json`), JSON.stringify(resp, null, 2));
          console.log('Remote eval response saved for', f);
        } catch (e) {
          console.error('Remote eval failed for', f, e && e.stack ? e.stack : e);
        }
      }
    }
  }

  console.log('All done — submissions in', outDir);
}

main().catch(e => { console.error(e && e.stack ? e.stack : e); process.exit(1); });
