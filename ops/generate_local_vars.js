const fs = require('fs');
const {VarsReader} = require('./lib/utils');

const v = new VarsReader('development');

const filename = '.dev.vars';
let textData = '';
const flattened = v.flattenVars();
Object.keys(flattened).forEach((k) => {
  textData += `${k} = "${flattened[k]}"\n`;
});
fs.writeFile(filename, textData, function (err) {
  if (err) {
    console.log(err);
    process.exit(1);
  }
  console.log(`${filename} has been updated!`);
});
