# WuwaProbs Mathematical Model (Detailed)

This document describes the implemented simulation model and statistical outputs in detail.

> **Source note:** all hardcoded constants were derived from **wuwatracker.com**.

---

## 1) State Space

Each Monte Carlo run tracks:

- Character 5★ pity `p5c`
- Weapon 5★ pity `p5w`
- Character 4★ pity `p4c`
- Weapon 4★ pity `p4w`
- Character guarantee flag `G` (`false` = normal 50/50, `true` = guaranteed featured next)
- Resources:
  - Radiant tides `R`
  - Forging tides `F`
  - Astrite-converted tides `A = floor(astrites / 160)`
  - Corals `C`
- Dupe counters (for coral payout tiers)
- Ordered wishlist index `k`

The run terminates when:

1. Wishlist is fully completed, or
2. No token can be consumed for the current banner.

---

## 2) 5★ Probability Curve

Let `p` be pity after increment (1-indexed pull count since last 5★).

- Base: `P(5★ | p < 66) = 0.008`
- Soft pity:
  - 66: 0.05
  - 67: 0.09
  - 68: 0.13
  - 69: 0.16
  - 70: 0.20
  - 71: 0.29
  - 72: 0.36
  - 73: 0.44
  - 74: 0.51
  - 75: 0.61
  - 76: 0.72
  - 77: 0.77
  - 78: 0.81
  - 79: 0.86
  - 80: 1.00 (hard pity)

So, at each pull, the simulation samples:

`U ~ Uniform(0, 1)` and 5★ occurs iff `U < chance(p)`.

---

## 3) Character 50/50 and Guarantee Transition

On character 5★:

- If `G = true`, result is featured and `G := false`.
- If `G = false`, featured with probability 0.5, otherwise lose 50/50 and set `G := true`.

State transition summary:

- Lose 50/50: `G: false -> true`
- Guaranteed featured consumed: `G: true -> false`
- Normal featured win: `G` remains `false`

Weapon banner has no 50/50 state; 5★ is treated as featured outcome for wishlist progression.

---

## 4) 4★ Process

For current banner pity `p4`:

- Increment to `p4 + 1`
- 4★ occurs if `p4 + 1 >= 10` OR `U < 0.06`
- 5★, when it occurs, resets `p4` to 0

### 4★ outcome mode

Two modes exist:

1. **Equal-odds mode** (used when advanced defaults are enabled or rate-up selection is incomplete):
   - Outcome sampled uniformly from 12 characters + 1 weapon bucket
2. **Configured rate-up mode**:
   - Character context uses configured 4★ rate-up split
   - Weapon context uses the implemented weapon-side split model

---

## 5) Coral Economy

### 5★ coral rewards

- First 7 copies: +15
- 8th+ copies: +40
- Character 50/50 loss bonus: +30

### 4★ coral rewards

- Character first 7 copies: +3
- Character 8th+ copies: +8
- 4★ weapon: +3

---

## 6) Coral Recursion

When enabled, coral conversion uses:

`new_tides = floor(C / 8)`  
`C := C - 8 * new_tides`

Converted tides are added to the active banner resource pool (radiant for character context, forging for weapon context).

Conversion is repeatedly applied during run progression until no further conversion is possible for current state.

---

## 7) Resource Consumption Priority

Character pull token priority:

1. Radiant tides
2. Astrite tides
3. Coral-converted radiant tides (if enabled)

Weapon pull token priority:

1. Forging tides
2. Astrite tides
3. Coral-converted forging tides (if enabled)

---

## 8) Wishlist Completion Logic

Wishlist is an ordered sequence `W = [w1, w2, ..., wn]`, `wi in {character, weapon}`.

At index `k`, simulator pulls only on banner `wk` until a qualifying featured 5★ hit is obtained for that step, then increments `k := k + 1`.

Completion occurs when `k = n`.

---

## 9) Worst-Case Thresholds

Displayed worst-case pull thresholds are deterministic upper-bound style estimates based on pity and banner logic.

For character steps with normal state, threshold includes loss-then-guaranteed path:

`(80 - current_character_pity) + 80`

For guaranteed state:

`80 - current_character_pity`

Weapon:

`80 - current_weapon_pity`

Cumulative threshold is the running sum across ordered wishlist steps.

---

## 10) Monte Carlo Engine

For input state `S` and iteration index `i`:

- Seed = hash(`JSON.stringify(S)`) mixed with `i`
- PRNG = deterministic xorshift-style generator

Thus output is reproducible for identical input state and iteration count.

Iterations default to 10,000+.

---

## 11) Output Statistics

### Completion distribution

From successful-run pull counts:

- P10: 10th percentile (nearest-rank discrete quantile)
- P50: median
- P90: 90th percentile
- Mean: arithmetic mean

### Curve

For each pull count `x` up to max plotted domain:

`curve(x) = completed_by_x / iterations`

### Per-item probabilities

For wishlist index `j`:

- Joint probability: `P(complete up to j)`
- Marginal acquisition: conditional progression ratio from prior step counts

---

## 12) Resource Breakdown Semantics

Two aggregations are tracked:

- **Avg per run** = total metric / iterations
- **Total (all runs)** = sum across all Monte Carlo runs

This is why totals can be very large while average remains intuitive.

The closer the `Avg per run` values to `Total (all runs) / iterations` the more accurate it is.

---

## 13) Estimator Page (`estimate.html`)

Estimator is intentionally simplified to pull conversion context:

- Inputs: target banner, radiant tides, forging tides, astrites, iterations
- Outputs: P10 / Avg / P75 / P90 for total usable pulls in that context

No coral input is included there by design.

---

## 14) Implementation Scope and Limits

- Simulation is discrete-time, pull-by-pull.
- Model outputs are estimates from finite Monte Carlo sampling.
- Statistical variance decreases as iterations increase.

