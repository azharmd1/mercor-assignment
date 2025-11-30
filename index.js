import fs from "fs";
import path from "path";
import runQuery from "./pipeline/runQuery.js";

// Path for profiles
const PROFILE_PATH = "./example_profile.json";

// Load example profile
const profileData = JSON.parse(fs.readFileSync(PROFILE_PATH, "utf8"));

// Load all YAML config files
const configDir = "./configs";
const configFiles = fs.readdirSync(configDir).filter(f => f.endsWith(".yml"));

async function run() {
  console.log("---- Running Mercor Assignment Pipeline ----\n");

  if (configFiles.length === 0) {
    console.log("No .yml config files found in ./configs — nothing to run.");
    return;
  }

  for (const file of configFiles) {
    const fullPath = path.join(configDir, file);

    console.log(`\n>>> Running for config: ${file}`);

    const result = await runQuery({
      profile: profileData,
      configPath: fullPath
    });

    console.log("Output:\n", JSON.stringify(result, null, 2));
    console.log("-----------------------------------------------------");
  }
}

run();
