const fs = require('fs');
const toml = require('toml');

class VarsReader {
  constructor(currentEnv, varsFilePath = '.vars.toml') {
    const varsBuffer = fs.readFileSync(varsFilePath);
    this.data = toml.parse(varsBuffer);
    this.currentEnv = currentEnv;
  }

  get(key, defaultValue = null) {
    return this.data[this.currentEnv][key] || this.data[key] || defaultValue;
  }
}

module.exports = {
  VarsReader,
};
