module.exports = {
  "env": {
    "node": true,
    "commonjs": true,
    "es2021": true
  },
  "extends": "eslint:recommended",
  "parserOptions": {
    "ecmaVersion": 2021,
    "sourceType": "module",
    "ecmaFeatures": {
      "jsx": true
    }
  },
  "rules": {
    "react/jsx-uses-react": "error",
    "react/jsx-uses-vars": "error"
  },
  "plugins": ["react"],
  "overrides": [
    {
      "files": ["**/functions/**/*.{js,jsx}", "**/edge-src/**/*.{js,jsx}"],
      "env": {
        "node": false,
        "worker": true,
      },
      "globals": {
        "HTMLRewriter": "readonly"
      },
    },
    {
      "files": ["**/client-src/**/*.{js,jsx}"],
      "env": {
        "node": false,
        "worker": false,
        "browser": true,
      },
    }
  ]
};
