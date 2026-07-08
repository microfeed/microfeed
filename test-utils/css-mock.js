// Webpack/the app bundler handles `.css` imports (e.g. cropperjs/dist/cropper.min.css
// pulled in by AdminImageUploaderApp). Jest has no CSS loader configured, so any
// test that transitively imports a .css file fails to parse it as JS. This stub
// stands in for that side-effect-only import.
module.exports = {};
