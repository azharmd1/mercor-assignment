const fs = require("fs");
const yaml = require("js-yaml");

function loadYaml(path) {
  const file = fs.readFileSync(path, "utf8");
  return yaml.load(file);
}

module.exports = { loadYaml };
