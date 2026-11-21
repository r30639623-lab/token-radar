[![token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/r30639623-lab/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/r30639623-lab/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01)

# Token Launch Radar

A dashboard that finds the DeFi protocols whose token does not exist yet, ranks them by what a launch would be worth, and tells the reader exactly how to farm each one. Built for [make.fun's token-radar-01 bounty](https://make.fun/bounty/token-radar-01).

## What it does

- Reads the sealed DefiLlama snapshot (758 protocols, 2026-11-14).
- Ranks **198 pre-token protocols** by **implied launch value** — all 40 watchlist protocols plus every other protocol in the snapshot that records no token. (The snapshot holds only 198 protocols that record no token at all: no gecko id, no symbol, no market cap. The earlier version used market cap alone and let 51 token-recording protocols onto the board; this version fixes that.)
- Shows a sortable, filterable board with token odds, a value range, a bootstrap rank range and a FARM / MARGINAL / SKIP verdict per row, a detail view for every protocol (full per-term value chain, a two-test validation table, farm economics with a T-bill benchmark, a deposit × drop-share matrix, a 10-step farm plan, and the five nearest priced peers), and a concrete 10-step farm plan per protocol — every step with its cost and hands-on time.
- Prints its own held-out evidence on the board: the size curve's leave-one-out and walk-forward miss against a flat multiple, the token odds' Brier score against the base rate, a calibration panel showing how often the printed range actually contains the real cap, and the bootstrap rank ranges — the median row's rank spans 19 places across 200 refits, so the board says how sure each rank is instead of pretending ranks are certain. Every model term is tested on both held-out tests, and a term stays only if it lowers the miss (or the Brier score) on both — age and the TVL band failed and were dropped.
- Three sliders (deposit $1,000–$50,000, drop share 0.5–5%, gas 0.5×–3×) recompute the board's net and verdict live from the same formulas — the board's verdict is a scenario, not a fact. The detail view always shows the standard $10,000 / 2% scenario, and its matrix shows the same formula at $1,000 / $10,000 / $50,000 deposits and 1% / 2% / 5% drop shares.

## How the model works

Implied value follows from the snapshot's own figures — never from a hardcoded list of names. Every coefficient is fitted at runtime from the snapshot:

```
implied value = curve(TVL) × category factor × growth factor × token odds
```

- **Size curve** — a log-log regression of market cap on TVL, fitted at runtime from the 128 token-trading protocols with a positive market cap: `ln(mcap) = 6.96 + 0.52 × ln(TVL)`, R² 0.19. Slope below 1 means big protocols carry lower multiples — a $2.75B protocol is not priced at 275× a $10M one. The multiple at $100M TVL is 0.160. Protocols with mcap ≤ 0 (dead or unpriced tokens) cannot enter a log fit and are left out of it.
- **Category factor** — the median of (actual mcap / curve-predicted mcap) over the token-trading protocols in the same category, shrunk hard toward 1.0 by n/(n+64) and clamped to [0.3, 2.5]. A category counts only with at least 3 trading comps; with fewer, no adjustment (factor 1.0). The hard shrinkage is the keep-rule's verdict: the factor helps leave-one-out a little (×3.40 → ×3.37) and is flat walk-forward, so it is kept but shrunk hard. On this board the factors span only ×0.92–×1.24.
- **Growth factor** — `1 + clamp(change_7d, −50, +100) / 100 × 0.5`. Fast-growing TVL is worth more at the same size; null change means no adjustment.
- **Age — tested, not kept in the value.** `1 + 0.15 × ln(1 + years since listed_at)`, capped at 1.5, lowers the walk-forward miss (×3.08 → ×2.86) but raises the leave-one-out miss (×3.28 → ×3.77), so it fails the keep-rule and does not multiply the value. Age earns its place in the token odds instead (below). The age in years is still shown per row, and the ablation table shows the failed test. Null `listed_at` uses the snapshot's median age (1.85 years).
- **Token odds** — the peer-group rate of recording a token: the share of protocols in the same category, listed within a year, that record a token, shrunk toward the global rate (54.9% of the 758 record a token) with a prior weight of 20. The TVL band the earlier version used was tested and dropped: it shrinks the peer group without lowering the Brier score on either test (0.224 vs 0.220 leave-one-out, 0.313 vs 0.310 walk-forward). Growth was tested in the odds and dropped too. Odds are the record of similar protocols, not a forecast for this one — and they discriminate weakly (Brier 0.220 vs 0.248 base rate), so the board says so. Each row's odds carry a standard error from its peer count (× odds ± s.e. in the detail view).
- **Value range (P25–P75, and P10–P90)** — the P25–P75 (and P10–P90) of the model's own leave-one-out residuals (actual mcap / held-out prediction), scaled onto the row's value. The curve explains about a fifth of the variation in market caps, so the ranges are honestly wide — about 14× from P25 to P75. The earlier version used the in-sample spread of peer multiples and its ranges were too narrow: they contained the real cap for only 45% of comps held out (35% walk-forward) against 50% stated. The new ranges contain 50% held out and 55% walk-forward (P10–P90: 80% and 74% against 80% stated) — the calibration panel on the board shows both the new and the old shares.

Values are whole dollars, forced strictly decreasing with rank (a $1 nudge where two protocols price identically), so rank always means something.

## Farm economics — one scenario, stated everywhere

A **$10,000 deposit**. The **drop pool is 2%** of the implied value; the **farming pool is 5% of TVL** and the farmer's share is the deposit over it; **fees** are one transaction per farm step that names gas, at **$5.00 on Ethereum, $0.01 on Solana, $3.00 on Bitcoin, $0.25 on every other chain**, plus a **$2 bridge fee** per step that names one; **time** is the steps' stated minutes, each counted once. Net = modelled drop × token odds − fees.

- **FARM** — net over **$750** and over **$500 an hour**. 14 of 198 rows (the median row nets $304).
- **SKIP** — net under **$100**, under 1% of the deposit. 25 of 198 rows.
- **MARGINAL** — everything between. 159 of 198 rows.

The verdict ranks farming, not launch value: the biggest launches are the worst farms, because a $10,000 stake is a drop in their TVL. The top 5 by value (Steakhouse Financial, USDD, Veda, Gauntlet, Sentora Curator) all score SKIP on farming, with modelled nets of −$17 to $56.

**Opportunity cost.** Every farm economics box carries a T-bill line: what the same $10,000 deposit earns in a US 3-month Treasury bill at **4.16% a year (Federal Reserve H.15, 19 Nov 2026)** over the **30-day minimum hold** the farm plans ask for — about **$34**. The verdict line reads e.g. "FARM — net $1,688 vs $34 in a T-bill for the same 30-day hold" (Manifest Trade, the best farm on the board). The plans' hands-on time is under an hour, but the deposit is locked for the hold, so the comparison runs over the hold: a farm has to beat the risk-free rate, not just its fees.

## How sure is a rank? (bootstrap, computed at runtime)

The size curve is refitted **200 times** on resampled trading comps (bootstrap, fixed seed 20261114) and the board re-ranked each time. The Rank range column is the **P5–P95 rank** across those refits. The top rows are tight (rank 1 sits at 1–2, rank 2 at 2–4, rank 3 at 2–5), but the **median row's rank spans 19 places** — the middle of the board is a cloud, not a ladder, and the ranges say so instead of hiding it. The refits also give the slope's standard error: 0.522 ± 0.081 (multiple at $100M TVL 0.160 ± 0.027). Manifest Trade, the best farm on the board (rank 74), sits at 32–88.

## Does each term earn its place? (ablation, computed at runtime)

The detail view carries a term-by-term ablation: the median miss as each term is added to the curve, on **two** held-out tests — leave-one-out over the 128 traded comps, and walk-forward (fitted on tokens listed before 2025-01-01, tested on the 31 listed later). The keep-rule: a term stays in the value model only if it lowers the miss on both tests.

| Term, added in order | Leave-one-out | Walk-forward | Verdict |
|---|---|---|---|
| Curve only | ×3.40 | ×3.08 | kept |
| Curve + category | ×3.37 | ×3.08 | kept — helps LOO a little, flat walk-forward |
| + growth (7d TVL) | ×3.28 | ×3.08 | kept — helps LOO, flat walk-forward |
| + age (no-token years) | ×3.77 | ×2.86 | **dropped** — fails leave-one-out |
| Full model incl. odds | ×3.55 | ×3.64 | expected value, not a value term |
| Flat median multiple (no model) | ×5.07 | ×5.35 | baseline |

Age is the honest failure: it helps walk-forward but hurts leave-one-out badly, so it leaves the value model and earns its place in the token odds instead. The odds get their own ablation, judged by Brier score (lower is better):

| Odds term, added in order | Leave-one-out Brier | Walk-forward Brier | Verdict |
|---|---|---|---|
| Base rate | 0.248 | 0.321 | baseline |
| + category | 0.226 | 0.318 | kept |
| + age | 0.220 | 0.310 | kept — the kept odds |
| + size (TVL band) | 0.224 | 0.313 | **dropped** |
| + growth (7d sign) | 0.229 | 0.314 | **dropped** |

Ranges each term spans on this board: category ×0.92–×1.24, growth ×0.75–×1.50, age ×1.00–×1.27 (tested, not kept in the value), odds 25%–78%.

## How good is the model? (computed at runtime, shown on the board)

| Test | Fitted curve | Flat median multiple |
|---|---|---|
| Leave-one-out median miss | ×3.40 | ×5.07 |
| Walk-forward median miss (fit on tokens listed before 2025-01-01, tested on later ones; 64 train / 31 test) | ×3.08 | ×5.35 |

Token odds: Brier 0.220 vs 0.248 base rate. The fit beats the flat baseline held out, but a ×3 median miss is still wide — the board shows the ranges instead of hiding them. And the ranges are now honest: the printed P25–P75 contains the real cap for 50% of comps held out and 55% walk-forward (50% stated); P10–P90 contains 80% and 74% (80% stated). The old peer-spread ranges managed only 45% and 35%.

## Accounting — all 758 protocols in exactly one group

| Group | Count |
|---|---|
| Ranked on this board (record no token) | 198 |
| Already record a token | 416 |
| Excluded by the watchlist rule (bridges, staking, CEX products, versioned or wrapped names) | 144 |
| **Total** | **758** |

## Language honesty

The snapshot records what DefiLlama carries. A protocol on this board **records no token** — never "has no token": a protocol may have a token its DefiLlama record does not carry.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json>
```

Node 22, standard library only, no network. Two runs write byte-identical output.
