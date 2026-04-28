# WuwaProbs

A vanilla HTML/CSS/JavaScript probability simulator for a dual-banner gacha model (character + weapon), with pity, 50/50 state, 4★ logic, coral economy, ordered wishlist simulation, and a resource pull estimator page.

## Pages

- `index.html` — Main probability calculator
- `estimate.html` — Pull conversion estimator (tides + astrites)

## Features

- Dual-banner simulation with independent pity state
- Character 50/50 + guarantee state transitions
- Weapon featured-only 5★ flow
- 4★ pity + configurable rate-up behavior
- Coral generation + optional coral-to-pull recursion
- Monte Carlo probability outputs (P10 / mean / P90, completion curve, table)
- Resource breakdown and debug trace
- Local storage persistence per page

## Tech Stack

- Pure HTML
- Pure CSS
- Pure JavaScript
- Lucide icons (CDN)

No framework, no build step, no bundler.

## Run

Open `index.html` directly, or serve the folder with any static server.

Example:

```bash
python -m http.server 8080
```

Then open:

- `http://localhost:8080/index.html`
- `http://localhost:8080/estimate.html`

## Data Source Note

All hardcoded constants in this project were derived from **wuwatracker.com** manually,

## Files

- `index.html` — main UI
- `script.js` — main simulation engine
- `estimate.html` — estimator UI
- `estimate.js` — estimator logic
- `style.css` — shared styling
- `icons/` — image assets

## Disclaimer

This tool is a simulation/estimation utility. Results are probabilistic and should be interpreted as modeled outcomes, not guaranteed in-game results.

## Behind the scenes

You can find more details about the math and algorithim [here](./In_Detail.md)
