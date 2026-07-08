// Cloudflare Pages' build treats `.html` imports as raw strings (used by
// edge-src/models/Theme.js for Mustache templates). Jest has no such loader
// configured, so any test that transitively imports Theme.js fails to parse
// the .html file as JS. This stub stands in for that raw-string import.
module.exports = "";
