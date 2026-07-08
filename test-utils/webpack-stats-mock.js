// functions/webpack-stats.json is a webpack BundleTracker artifact generated
// by `yarn build`. It's gitignored and never produced in the test environment
// (CI runs `yarn test` with no prior build step). This stub stands in for it
// so tests that transitively import HtmlHeader can run without a real build.
module.exports = {
  status: "done",
  chunks: {},
};
