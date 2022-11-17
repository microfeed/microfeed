const https = require('https');

const {VarsReader} = require('./lib/utils');

class InitProject {
  constructor() {
    this.currentEnv = 'production';
    this.v = new VarsReader(this.currentEnv);
  }

  _getCurrentProject(data, onProjectExists, onCreateProject) {

    const options = {
      port: 443,
      hostname: 'api.cloudflare.com',
      path: `/client/v4/accounts/${this.v.get('CLOUDFLARE_ACCOUNT_ID')}/pages/projects/${this.v.get('CLOUDFLARE_PROJECT_NAME')}`,
      headers: {
        'Authorization': `Bearer ${this.v.get('CLOUDFLARE_API_TOKEN')}`,
        'Content-Type': 'application/json',
      },
      method: 'GET',
    };

    https.get(options, (res) => {
      if (res.statusCode === 404) {
        onCreateProject();
        return;
      }
      // console.log('headers:', res.headers);

      let body = '';
      res.on('data', (d) => {
        body += d;
      });
      res.on('end', function () {
        try {
          let json = JSON.parse(body);
          onProjectExists(json);
        } catch (error) {
          console.error(error.message);
          process.exit(1);
        }
      });
    }).on('error', (e) => {
      console.error(e);
    });
  }

  _createProject(data, onSuccess) {
    const options = {
      hostname: 'api.cloudflare.com',
      port: 443,
      path: `/client/v4/accounts/${this.v.get('CLOUDFLARE_ACCOUNT_ID')}/pages/projects/`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.v.get('CLOUDFLARE_API_TOKEN')}`,
        'Content-Type': 'application/json',
        'Content-Length': data.length,
      },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (d) => {
        body += d;
      });
      res.on("end", () => {
        try {
          let json = JSON.parse(body);
          onSuccess(json);
        } catch (error) {
          console.error(error.message);
          process.exit(1);
        }
      });
    });

    req.on('error', (e) => {
      console.error(e);
      process.exit(1);
    });
    req.write(data)
    req.end();
  }

  run() {
    console.log(`Init project ${this.v.get('CLOUDFLARE_PROJECT_NAME')} [${this.currentEnv}]...`);
    this._getCurrentProject({}, (json) => {
      console.log(`${this.v.get('CLOUDFLARE_PROJECT_NAME')} exists.`);
      console.log(json);
    }, () => {
      console.log(`Creating project: ${this.v.get('CLOUDFLARE_PROJECT_NAME')}...`)
      const data = JSON.stringify({
        'subdomain': this.v.get('CLOUDFLARE_PROJECT_NAME'),
        'production_branch': this.v.get('PRODUCTION_BRANCH'),
        'name': this.v.get('CLOUDFLARE_PROJECT_NAME'),
      });
      this._createProject(data, () => {
        console.log('Project created!')
      });
    });
  }
}

const initProject = new InitProject();
initProject.run();
