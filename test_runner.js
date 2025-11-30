import fs from 'fs';
import path from 'path';
import runQuery from './pipeline/runQuery.js';

const configsDir = './configs';
const configFiles = fs.readdirSync(configsDir).filter(f => f.endsWith('.yml'));

const profiles = [
  './example_profile.json',
  './example_profile_junior.json',
  './example_profile_senior_ds.json'
];

async function runAll() {
  for (const profilePath of profiles) {
    const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
    console.log('\n==== Running for profile:', profile.name, `(${profile.id})`,'====\n');

    for (const cfg of configFiles) {
      const fullPath = path.join(configsDir, cfg);
      console.log(`>>> Config: ${cfg}`);
      try {
        const result = await runQuery({ profile, configPath: fullPath });
        console.log('Output:\n', JSON.stringify(result, null, 2));
      } catch (e) {
        console.error('Error running', cfg, e && e.stack ? e.stack : e);
      }
      console.log('-----------------------------------------------------');
    }
  }
}

runAll().catch(e => { console.error(e && e.stack ? e.stack : e); process.exit(1); });
