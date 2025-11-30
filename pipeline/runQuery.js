import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import parseProfile from "../utils/parseProfile.js";
import evaluate from "../services/evaluator.js";
import rerank from "../services/reranker.js";

export default async function runQuery({ profile, configPath }) {
  // 1. Load job config YAML
  console.log('Loading config path:', configPath, 'exists?', fs.existsSync(configPath));
  const raw = fs.readFileSync(configPath, "utf8");
  if (!raw || raw.trim().length === 0) {
    console.warn(`Config at ${configPath} is empty; skipping.`);
    return {
      job_title: path.basename(configPath),
      evaluation: null,
      final_score: null,
      skipped: true,
      reason: 'empty or missing config file'
    };
  }
  console.log('Config snippet:', raw.split('\n').slice(0,3).join(' | '));
  const jobConfig = yaml.load(raw);

  if (!jobConfig || typeof jobConfig !== 'object' || !jobConfig.title) {
    console.warn(`Config at ${configPath} did not parse into a valid job config; skipping.`);
    return {
      job_title: path.basename(configPath),
      evaluation: null,
      final_score: null,
      skipped: true,
      reason: 'invalid YAML content'
    };
  }

  // 2. Parse candidate profile
  const parsedProfile = parseProfile(profile);

  // 3. Evaluate profile against job criteria 
  const evaluation = await evaluate(parsedProfile, jobConfig);

  // 4. Rerank final score 
  const finalScore = await rerank(parsedProfile.summary, jobConfig.description);

  return {
    job_title: jobConfig.title,
    evaluation,
    final_score: finalScore
  };
}
