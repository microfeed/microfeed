# Develop the bundled Podcast theme

This format-v2 package is generated from `src/`. Edit the independent templates, Tailwind CSS, fixture, or TypeScript sources, then run `yarn workspace @microfeed/podcast-theme-source build`, `validate`, and `test`. Increment the immutable manifest version before changing released package bytes.

The installable package has eight generated text slots, one declared preview fixture, and no binary assets. Do not hand-edit generated root templates and do not add image, audio, or video files.

## Fixture media

All media is loaded from direct HTTPS royalty-free sources:

- [Microphone 1.jpg](https://commons.wikimedia.org/wiki/File:Microphone_1.jpg) — CC0 1.0.
- [Swale.ogg](https://commons.wikimedia.org/wiki/File:Swale.ogg) — CC0 1.0.
- [RunningWater.webm](https://commons.wikimedia.org/wiki/File:RunningWater.webm) — CC0 1.0.
- [Architecture photography.jpg](https://commons.wikimedia.org/wiki/File:Architecture_photography.jpg) — CC0 1.0.
- [A lush verdant landscape.jpg](https://commons.wikimedia.org/wiki/File:A_lush_verdant_landscape.jpg) — CC0 1.0.

Keep future preview media remote, directly addressable, royalty-free, and documented here. Never commit media binaries to a bundled theme.
