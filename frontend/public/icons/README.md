PWA app icons (a white map pin on the GradFix brand background):

- `icon-192.png` (192×192)
- `icon-512.png` (512×512)

Referenced by the PWA manifest in `vite.config.js`. These are generated, dependency-free, by
`node scripts/generate-icons.mjs` — re-run that script to regenerate them (e.g. after a brand change).
