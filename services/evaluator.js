// Job-aware local evaluator stub (ESM)
export default async function evaluate(parsedProfile, jobConfig) {
  // Build job and profile text
  const jobTextParts = [];
  if (jobConfig) {
    if (jobConfig.title) jobTextParts.push(jobConfig.title);
    if (jobConfig.description) jobTextParts.push(jobConfig.description);
    if (Array.isArray(jobConfig.hard_criteria)) jobTextParts.push(jobConfig.hard_criteria.join(' '));
    if (Array.isArray(jobConfig.soft_criteria)) jobTextParts.push(jobConfig.soft_criteria.join(' '));
  }
  const jobText = jobTextParts.join(' ').toLowerCase();
  const profileText = [parsedProfile.summary, parsedProfile.rerankSummary, (parsedProfile.experience || []).join(' '), (parsedProfile.education || []).join(' ')].join(' ').toLowerCase();

  // Simple domain detection from title/description
  function detectDomain(text) {
    if (!text) return 'general';
    if (/\b(lawyer|law|legal|jd|attorney|counsel|m&a|merger|acquisitions|corporate)\b/i.test(text)) return 'legal';
    if (/\b(data scientist|data science|machine learning|ml|statistics|deep learning|nlp)\b/i.test(text)) return 'data';
    if (/\b(engineer|developer|javascript|node|backend|frontend|api|microservice|devops)\b/i.test(text)) return 'engineering';
    return 'general';
  }

  const domain = detectDomain(`${jobConfig?.title || ''} ${jobConfig?.description || ''}`);

  // Domain-specific keyword whitelists (small curated lists)
  const domainKeywords = {
    legal: [
      'm&a','merger','mergers','acquisition','acquisitions','due diligence','due-diligence','contract','contracts',
      'negotiation','negotiations','compliance','regulatory','corporate','securities','litigation','transaction','drafting',
      'counsel','counseling','jd'
    ],
    data: [
      'machine learning','ml','python','statistics','data','feature engineering','model','deep learning','nlp','analysis'
    ],
    engineering: [
      'javascript','node','python','backend','api','microservice','microservices','cloud','aws','gcp','docker','kubernetes'
    ],
    general: []
  };

  const keywords = domainKeywords[domain] || [];

  // Match keywords verbatim (support multi-word keywords); return only domain keywords
  const matched = [];
  for (const kw of keywords) {
    const k = kw.toLowerCase();
    // normalize spacing and punctuation for matching
    const safeProfile = profileText.replace(/[^a-z0-9&+\-\s]/g, ' ');
    if (safeProfile.includes(k)) matched.push(k);
    else {
      // allow fuzzy match for ampersands or slashes (e.g., M&A written as 'M and A')
      const alt = k.replace(/&/g, ' and ').replace(/\-/g, ' ').replace(/\//g, ' ');
      if (safeProfile.includes(alt)) matched.push(k);
    }
  }

  // If domain is legal, require at least one matched legal keyword to award any score
  let score = 0.0;
  if (domain === 'legal') {
    score = matched.length > 0 ? +(matched.length / keywords.length).toFixed(2) : 0.0;
  } else if (keywords.length > 0) {
    score = matched.length > 0 ? +(matched.length / keywords.length).toFixed(2) : 0.0;
  } else {
    // fallback: simple token-based match (filter stopwords)
    const stopwords = new Set(['the','and','for','with','that','this','from','have','has','had','are','was','were','will','would','could','should','a','an','in','on','of','to','by','as','at','is','be','or','it','its','their','they','them','these','those','which','years','year','experience','expertise','strong','skills','work','working']);
    const tokens = Array.from(new Set((jobText.match(/\b[a-z]{3,}\b/g) || []))).filter(t => !stopwords.has(t));
    for (const t of tokens) if (profileText.includes(t)) matched.push(t);
    score = tokens.length > 0 ? +(matched.length / tokens.length).toFixed(2) : 0.0;
  }

  const evaluation = {
    id: parsedProfile.id,
    matched_skills: matched.slice(0, 20),
    details: {
      experience_years: parsedProfile.experience.length || 0,
      education: parsedProfile.education || []
    },
    score
  };

  console.log('Evaluation result:', evaluation);
  return evaluation;
}
