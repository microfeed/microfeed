module.exports = {
  transform: {
    "^.+\\.(t|j)sx?$": ["@swc/jest"],
  },
  moduleNameMapper: {
    "\\.html$": "<rootDir>/test-utils/html-mock.js",
    "\\.css$": "<rootDir>/test-utils/css-mock.js",
    "^react-drag-drop-files$": "<rootDir>/test-utils/react-drag-drop-files-mock.jsx",
  },
  testPathIgnorePatterns: [
    "/node_modules/",
    "<rootDir>/.claude/",
  ],
  modulePathIgnorePatterns: [
    "<rootDir>/.claude/",
  ],
  // Default stays "node" so the backend suite is unaffected. React component
  // test files opt into jsdom individually via a per-file docblock:
  //   /** @jest-environment jsdom */
  setupFilesAfterEnv: [
    "@testing-library/jest-dom",
    "<rootDir>/test-utils/jsdom-prosemirror-polyfills.js",
  ],
};
