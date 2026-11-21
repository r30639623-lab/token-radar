[![token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/r30639623-lab/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/r30639623-lab/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01)

# Token Launch Radar

A dashboard that finds the DeFi protocols whose token does not exist yet, ranks them by what a launch would be worth, and tells the reader exactly how to farm each one. Built for [make.fun's token-radar-01 bounty](https://make.fun/bounty/token-radar-01).

## What it does

- Reads the sealed DefiLlama snapshot (758 protocols, 2026-11-14).
- Ranks **198 pre-token protocols** by **implied launch value** — all 40 watchlist protocols plus every other protocol in the snapshot that records no token. (The snapshot holds only 198 protocols that record no token at all: no gecko id, no symbol, no market cap. The earlier version used market cap alone and let 51 token-recording protocols onto the board; this version fixes that.)
- Shows a sortable, filterable board with token odds, a value range and a FARM / MARGINAL / SKIP verdict per row, a detail view for every protocol (full value breakdown, farm economics, farm plan, and the five nearest priced peers), and a concrete 6-step farm plan per protocol with costs and times.
- Prints its own held-out evidence on the board: the size curve's leave-one-out and walk-forward miss against a flat multiple, and the token odds' Brier score against the base rate.

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
