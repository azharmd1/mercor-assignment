export default function parseProfile(profile) {
  // Ensure fields exist and normalize to expected shape
  const id = profile.id || "unknown";
  const name = profile.name || "Unnamed";
  const experience = Array.isArray(profile.experience) ? profile.experience : [];
  const education = Array.isArray(profile.education) ? profile.education : [];
  const summary = profile.summary || `${name} - no summary provided`;
  const rerankSummary = profile.rerankSummary || summary;

  return {
    id,
    name,
    experience,
    education,
    summary,
    rerankSummary
  };
}
