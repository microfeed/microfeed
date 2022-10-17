module.exports = {
  "env": {
    "node": true,
    "commonjs": true,
    "es2021": true
  },
  "extends": "eslint:recommended",
  "parserOptions": {
    "ecmaVersion": 12
  },
  "rules": {},

  "overrides": [
    {
      "files": ["**/functions/**/*.js"],
      "env": {
        "node": false,
        "worker": true,
        "commonjs": true,
        "es2021": true
      },
      "parserOptions": {
        "sourceType": "module"
      },
      "globals": {
        "HTMLRewriter": "readonly"
      }
    },
    {
      "files": ["**/src/*"],
      "env": {
        "node": false,
        "worker": false,
        "browser": true,
        "commonjs": true,
        "es2021": true
      },
      "parserOptions": {
        "sourceType": "module",
        "ecmaFeatures": {
          "jsx": true
        }
      },
      "plugins": ["react"],
      "rules": {
        "react/jsx-uses-react": "error",
        "react/jsx-uses-vars": "error"
      }
    }
  ]
};
