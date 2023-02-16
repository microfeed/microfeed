const {exec} = require('child_process');

const {MICROFEED_VERSION} = require('../common-src/Version');

exec(`yarn version ${MICROFEED_VERSION}`, (error, stdout, stderr) => {
  if (error) {
    console.log(error);
    console.log('exit.');
  } else {
    if (stdout) {
      console.log(`stdout - \n${stdout}`);
    }
    if (stderr) {
      console.log(`stderr - \n${stderr}`);
    }
    console.log(`Updated package.json version to ${MICROFEED_VERSION}.`);
  }
});
