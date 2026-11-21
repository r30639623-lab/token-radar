[![token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/r30639623-lab/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/r30639623-lab/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01)

# Token Launch Radar

A dashboard that finds the DeFi protocols whose token does not exist yet, ranks them by what a launch would be worth, and tells the reader exactly how to farm each one. Built for [make.fun's token-radar-01 bounty](https://make.fun/bounty/token-radar-01).

## What it does

- Reads the sealed DefiLlama snapshot (758 protocols, 2026-11-14).
- Ranks **198 pre-token protocols** by **implied launch value** — all 40 watchlist protocols plus every other protocol in the snapshot that records no token. (The snapshot holds only 198 protocols that record no token at all: no gecko id, no symbol, no market cap. The earlier version used market cap alone and let 51 token-recording protocols onto the board; this version fixes that.)
- Shows a sortable, filterable board with token odds, a value range, a bootstrap rank range and a FARM / MARGINAL / SKIP verdict per row, a detail view for every protocol (full value breakdown, a term-by-term validation table, farm economics with a T-bill benchmark, a deposit × drop-share matrix, farm plan, and the five nearest priced peers), and a concrete 6-step farm plan per protocol with costs and times.
- Prints its own held-out evidence on the board: the size curve's leave-one-out and walk-forward miss against a flat multiple, the token odds' Brier score against the base rate, and the bootstrap rank ranges — the median row's rank spans 53 places across 200 refits, so the board says how sure each rank is instead of pretending ranks are certain.
- Three sliders (deposit $1,000–$50,000, drop share 0.5–5%, gas 0.5×–3×) recompute the board's net and verdict live from the same formulas — the board's verdict is a scenario, not a fact. The detail view always shows the standard $10,000 / 2% scenario, and its matrix shows the same formula at $1,000 / $10,000 / $50,000 deposits and 1% / 2% / 5% drop shares.

## How the model works

Implied value follows from the snapshot's own figures — never from a hardcoded list of names. Every coefficient is fitted at runtime from the snapshot:

```
implied value = curve(TVL) × category factor × growth factor × age factor × token odds
```

- **Size curve** — a log-log regression of market cap on TVL, fitted at runtime from the 128 token-trading protocols with a positive market cap: `ln(mcap) = 6.96 + 0.52 × ln(TVL)`, R² 0.19. Slope below 1 means big protocols carry lower multiples — a $2.75B protocol is not priced at 275× a $10M one. The multiple at $100M TVL is 0.160. Protocols with mcap ≤ 0 (dead or unpriced tokens) cannot enter a log fit and are left out of it.
- **Category factor** — the median of (actual mcap / curve-predicted mcap) over the token-trading protocols in the same category, shrunk toward 1.0 by n/(n+8) and clamped to [0.3, 2.5]. A category counts only with at least 3 trading comps; with fewer, no adjustment (factor 1.0). Shrinkage keeps one outlier category from pricing a whole group at fantasy levels.
- **Growth factor** — `1 + clamp(change_7d, −50, +100) / 100 × 0.5`. Fast-growing TVL is worth more at the same size; null change means no adjustment.
- **Age factor** — `1 + 0.15 × ln(1 + years since listed_at)`, capped at 1.5. A protocol that has run for years with no token has more pent-up launch value. Null `listed_at` uses the snapshot's median age (1.85 years).
- **Token odds** — the peer-group rate of recording a token: the share of protocols in the same category, listed within a year and within one decade of TVL, that record a token, shrunk toward the global rate (54.9% of the 758 record a token) with a prior weight of 20. Odds are the record of similar protocols, not a forecast for this one — and they discriminate weakly (Brier 0.224 vs 0.248 base rate), so the board says so.
- **Value range (P25–P75)** — the spread of peer multiples (mcap / curve-predicted) in the row's category, else the global spread, scaled onto the row's value. The curve explains about a fifth of the variation in market caps, so the ranges are honestly wide.

Values are whole dollars, forced strictly decreasing with rank (a $1 nudge where two protocols price identically), so rank always means something.

## Farm economics — one scenario, stated everywhere

A **$10,000 deposit**. The **drop pool is 2%** of the implied value; the **farming pool is 5% of TVL** and the farmer's share is the deposit over it; **fees** are one transaction per farm step that names gas, at **$5.00 on Ethereum, $0.01 on Solana, $3.00 on Bitcoin, $0.25 on every other chain**; **time** is the steps' stated minutes, each counted once. Net = modelled drop × token odds − fees.

- **FARM** — net over **$750** and over **$500 an hour**: the top decile of modelled nets under this scenario (the median row nets $322). 20 of 198 rows.
- **SKIP** — net under **$100**, under 1% of the deposit. 17 of 198 rows.
- **MARGINAL** — everything between. 161 of 198 rows.

The verdict ranks farming, not launch value: the biggest launches are the worst farms, because a $10,000 stake is a drop in their TVL. The top 5 by value (Steakhouse Financial, Sentora Curator, Veda, Gauntlet, USDD) all score SKIP on farming, with modelled nets of $11–$75.

**Opportunity cost.** Every farm economics box carries a T-bill line: what the same $10,000 deposit earns in a US 3-month Treasury bill at **4.16% a year (Federal Reserve H.15, 19 Nov 2026)** over the **30-day minimum hold** the farm plans ask for — about **$34**. The verdict line reads e.g. "FARM — net $1,857 vs $34 in a T-bill for the same 30-day hold". The plans' hands-on time is under an hour, but the deposit is locked for the hold, so the comparison runs over the hold: a farm has to beat the risk-free rate, not just its fees.

## How sure is a rank? (bootstrap, computed at runtime)

The size curve is refitted **200 times** on resampled trading comps (bootstrap, fixed seed 20261114) and the board re-ranked each time. The Rank range column is the **P5–P95 rank** across those refits. The top rows are tight (rank 1 sits at 1–2, rank 2 at 2–3, rank 3 at 3–7), but the **median row's rank spans 53 places** — the middle of the board is a cloud, not a ladder, and the ranges say so instead of hiding it. Manifest Trade, the best farm on the board (rank 68), sits at 17–128.

## Does each term earn its place? (ablation, computed at runtime)

The detail view carries a term-by-term ablation: the leave-one-out median miss as each term is added to the curve, over the 128 traded comps.

| Term, added in order | Leave-one-out miss | Verdict |
|---|---|---|
| Curve only | ×3.40 | kept — improves the miss |
| Curve + category | ×3.77 | no help — kept for its reason, not for prediction |
| + growth (7d TVL) | ×3.63 | helps a little |
| + age (no-token years) | ×3.78 | no help — kept for its reason, not for prediction |
| Full model incl. odds | ×3.67 | helps a little |
| Flat median multiple (no model) | ×5.07 | baseline |

Only the curve itself improves the held-out miss. The category factor, growth and age terms do not — they are kept for stated economic reasons (the category factor prices business-model differences, growth and age are launch-timing signals), and the table says so rather than hiding it. Token odds are judged by their Brier score (0.224 vs 0.248), not by this miss: they convert the if-launches value into an expected value, so they cannot improve a miss measured against market caps. Ranges each term spans on this board: category ×0.67–×2.44, growth ×0.75–×1.50, age ×1.00–×1.27, odds 27%–77%.

## How good is the model? (computed at runtime, shown on the board)

| Test | Fitted curve | Flat median multiple |
|---|---|---|
| Leave-one-out median miss | ×3.40 | ×5.07 |
| Walk-forward median miss (fit on tokens listed before 2025-01-01, tested on later ones; 64 train / 31 test) | ×3.08 | ×5.35 |

Token odds: Brier 0.224 vs 0.248 base rate. The fit beats the flat baseline held out, but a ×3 median miss is still wide — the board shows the ranges instead of hiding them.

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
