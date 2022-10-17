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
  "rules": {
    "react/jsx-uses-react": "error",
    "react/jsx-uses-vars": "error"
  },

  "overrides": [
    {
      "files": ["**/functions/**/*.{js,jsx}", "**/edge-src/**/*.{js,jsx}"],
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
      },
      "plugins": ["react"],
      "rules": {}
    },
    {
      "files": ["**/client-src/**/*.{js,jsx}"],
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
      }
    }
  ]
};
