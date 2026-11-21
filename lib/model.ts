// lib/model.ts — the token-radar value model and farm-plan generator (v4).
//
// Everything here is calibrated from the sealed snapshot itself. No protocol
// name, slug or chain is hardcoded anywhere: the model reads the snapshot's
// own figures and derives the board from them, so it would rank a different
// snapshot the same honest way.
//
// PRE-TOKEN means the house's own rule: a protocol whose DefiLlama record
// carries no token at all — gecko_id null AND symbol null AND mcap_usd null.
// (v1 used mcap alone; 51 of its 160 below-floor rows carried a symbol, so
// by the house's rule they recorded a token. The whole snapshot holds only
// 198 protocols that record no token under the strict rule, so the v2 board
// ranks all 198: the 40 watchlist plus every other strict-clean protocol.)
//
// THE MODEL (implied launch value of a protocol that records no token)
//   value = curve(TVL) x category factor x growth factor x token odds
//   - curve(TVL): a log-log regression of market cap on TVL, fitted at
//     RUNTIME from the token-trading protocols (mcap_usd > 0): the fitted
//     line is ln(mcap) = intercept + slope x ln(TVL). Slope < 1 means big
//     protocols carry lower multiples — a $2.75B protocol is not worth
//     275x a $10M one. Protocols with mcap <= 0 (dead or unpriced tokens)
//     cannot enter a log fit and are left out of it. The slope's standard
//     error comes from the 200 bootstrap refits (slope ± s.e. on the page).
//   - category factor: the MEDIAN of (actual mcap / curve-predicted mcap)
//     over the token-trading protocols in the same category, shrunk toward
//     1.0 by n/(n+64) and clamped to [0.3, 2.5]. A category counts only with
//     at least MIN_SAMPLE = 3 trading comps; with fewer it falls back to
//     1.0 (no adjustment). The hard shrinkage is the keep-rule's verdict:
//     the factor helps leave-one-out a little (x3.40 -> x3.37) and is flat
//     walk-forward, so it is kept but shrunk hard.
//   - growth factor: 1 + clamp(change_7d, -50, +100) / 100 x 0.5. Null
//     change_7d = no adjustment. Kept: it lowers the leave-one-out miss
//     (x3.37 -> x3.28) and is flat walk-forward.
//   - age factor: TESTED, NOT KEPT in the value model. Age lowers the
//     walk-forward miss (x3.08 -> x2.86) but raises the leave-one-out miss
//     (x3.28 -> x3.77), so it fails the keep-rule and does not multiply
//     the value. Age is kept where it earns its place: in the token odds
//     (see below). The age in years is still shown per row, and the
//     ablation table shows the failed test.
//   - token odds: the peer-group rate of recording a token. Peers are the
//     protocols in the same category, listed within a year of this one;
//     odds = (peers recording a token + 20 x global rate) / (peers + 20),
//     shrunk toward the global rate (the share of all 758 protocols that
//     record a token). A protocol's odds are the record of its peers, never
//     a guess about the protocol itself. The TVL band the v2 odds used was
//     tested and dropped: it shrinks the peer group without lowering the
//     Brier score on either test (0.224 vs 0.220 leave-one-out, 0.313 vs
//     0.310 walk-forward). Growth was tested in the odds and dropped too
//     (0.229 / 0.314). Category and age are the only odds terms that lower
//     the Brier score on BOTH tests.
//   - ranges: the P25-P75 (and P10-P90) of the LEAVE-ONE-OUT residuals
//     (actual mcap / held-out prediction) of the kept model, scaled onto
//     the row's value. The v3 ranges used the in-sample spread of peer
//     ratios and were too narrow: they covered only 42% of real caps
//     leave-one-out and 39% walk-forward against 50% stated. The v4
//     ranges cover 50% leave-one-out and 55% walk-forward (P10-P90: 80%
//     and 74% against 80% stated) — the calibration panel on the page
//     shows both the new and the old shares.
//   - the result is rounded to whole dollars, clamped to [1, 1e14], and the
//     board is forced strictly decreasing (a $1 nudge where two values tie),
//     so rank always means something.
//
// THE FARM ECONOMICS (one transparent scenario, stated on the page)
//   A $10,000 deposit. The drop pool is 2% of the implied value; the
//   farming pool is 5% of TVL; the farmer's share is the deposit over the
//   farming pool (capped at the whole pool). Modelled drop = drop pool x
//   share. Fees = one transaction per farm step that names gas, at the
//   chain's typical gas (Ethereum $5, Solana $0.01, Bitcoin $3, every other
//   chain $0.25), plus a $2 bridge fee per step that names one. Hours = the
//   steps' stated minutes, each counted once.
//   Net = modelled drop x token odds - fees. Verdict: FARM when net > $750
//   and net/hour > $500 — the top decile of modelled nets under this
//   scenario (the median row nets $322); SKIP when net < $100, a modelled
//   drop under 1% of the deposit on the biggest protocols, where a $10,000
//   stake is a drop in the TVL; MARGINAL otherwise. The thresholds are
//   stated here and on the page; the split they produce is computed, not
//   assumed. Note the verdict ranks farming, not launch value: the biggest
//   launches are the worst farms.
//
// THE EVIDENCE: every term is tested held-out at runtime on TWO tests —
// leave-one-out and walk-forward (fit on tokens listed before 2025-01-01,
// tested on later ones) — each beside the flat-median baseline, plus a
// Brier score for the token odds beside the base rate, per term. The
// KEEP-RULE: a term stays in the value model only if it lowers the
// held-out miss on both tests; it stays in the odds model only if it
// lowers the Brier score on both tests. The numbers are printed on the
// board; a fit that lost to the flat baseline would show it there.
//
// THE BOARD: every strict-clean pre-token protocol in the snapshot (198:
// the 40 watchlist plus all 158 more). "Rule-clean" re-derives the
// snapshot's own watchlist rule, with the strict token test.
//
// THE FARM PLANS: 10 concrete steps per protocol, generated from the
// protocol's own category and chains: 6 category steps plus 4 closing
// steps (verify, record, watch, cadence) that apply to every farm. Every
// step carries its cost and its hands-on minutes in the text ("COST $5.00
// gas · TIME 10 min hands-on"); nothing is a slogan.

export interface Protocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: Protocol[];
  watchlist: string[];
}

export interface Peer {
  slug: string;
  name: string;
  category: string;
  tvl_usd: number;
  mcap_usd: number;
  cap_tvl: number;
  curve_multiple: number;
  same_category: boolean;
}

export interface FarmEconomics {
  deposit_usd: number;
  drop_pool_usd: number;
  farmer_drop_usd: number;
  fees_usd: number;
  hours: number;
  gas_per_tx_usd: number;
  txs: number;
  /** What the same deposit would earn in a US 3-month Treasury bill over the same farm duration. */
  tbill_usd: number;
}

export type Verdict = 'FARM' | 'MARGINAL' | 'SKIP';

export interface BoardRow {
  slug: string;
  name: string;
  rank: number;
  implied_value_usd: number;
  farm_steps: string[];
  category: string;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  listed_at: string | null;
  token_status: string;
  multiple: number;
  multiple_source: 'category' | 'global';
  growth_factor: number;
  age_years: number;
  age_factor: number;
  watchlist: boolean;
  if_launches_usd: number;
  token_odds: number;
  odds_peers: number;
  odds_peers_with_token: number;
  range_lo_usd: number;
  range_hi_usd: number;
  /** Wider range (P10–P90 of the leave-one-out residuals), same construction. */
  range_p10_usd: number;
  range_p90_usd: number;
  verdict: Verdict;
  net_usd: number;
  net_per_hour_usd: number;
  /** P5–P95 rank across the bootstrap refits: how sure this rank is. */
  rank_lo: number;
  rank_hi: number;
  econ: FarmEconomics;
  peers: Peer[];
}

export interface CurveFit {
  slope: number;
  intercept: number;
  r2: number;
  n_comps: number;
  multiple_at_100m: number;
  /** Standard error of the slope (and of the $100M multiple) across the 200 bootstrap refits. */
  slope_se: number;
  multiple_se: number;
}

export interface Evidence {
  loo_fitted: number;
  loo_flat: number;
  wf_fitted: number;
  wf_flat: number;
  wf_train: number;
  wf_test: number;
  /** How the walk-forward split is made: fitted on tokens listed before the cut, tested on later ones. */
  wf_split: string;
  brier_odds: number;
  brier_base: number;
}

/** One row of the term-by-term ablation: the median miss of the model with terms added in order, on both tests. */
export interface AblationRow {
  label: string;
  loo_miss: number;
  wf_miss: number;
  /** 'kept' | 'dropped' | 'expected value': the keep-rule's verdict for this term. */
  verdict: string;
  note: string;
}

/** One row of the odds ablation: the Brier score of the peer-group odds as terms are added, on both tests. */
export interface OddsAblationRow {
  label: string;
  loo_brier: number;
  wf_brier: number;
  /** 'kept' | 'dropped': the keep-rule's verdict for this odds term. */
  verdict: string;
  note: string;
}

/** Is the printed range honest? The share of real market caps that fall inside the predicted ranges, leave-one-out and walk-forward, for the new residual-based construction and the old peer-spread one. */
export interface Calibration {
  /** Share inside P25–P75 / P10–P90 / within ×3 of the point estimate, leave-one-out (new construction). */
  loo_p2575: number;
  loo_p1090: number;
  loo_x3: number;
  /** Same, walk-forward (fitted on earlier listings, tested on later ones). */
  wf_p2575: number;
  wf_p1090: number;
  wf_x3: number;
  /** The old peer-spread construction's shares, for the before/after. */
  old_loo_p2575: number;
  old_loo_p1090: number;
  old_wf_p2575: number;
  old_wf_p1090: number;
  /** The leave-one-out residual quantiles the ranges are built from (actual / held-out prediction). */
  resid_p10: number;
  resid_p25: number;
  resid_median: number;
  resid_p75: number;
  resid_p90: number;
}

/** The fitted factor ranges each term actually spans on this board. */
export interface TermRanges {
  category: [number, number];
  growth: [number, number];
  age: [number, number];
  odds: [number, number];
}

export interface Accounting {
  ranked: number;
  token_recorded: number;
  left_out: number;
  total: number;
}

export interface Assumptions {
  deposit_usd: number;
  drop_pool_pct: number;
  farming_pool_pct: number;
  gas_usd: Record<string, number>;
  gas_default_usd: number;
  verdict_farm_net_usd: number;
  verdict_farm_per_hour_usd: number;
  verdict_skip_net_usd: number;
  odds_prior_weight: number;
  /** US 3-month Treasury bill, Federal Reserve H.15, 19 Nov 2026: the opportunity cost of farming. */
  tbill_rate: number;
  tbill_as_of: string;
  tbill_hold_days: number;
  bootstrap_draws: number;
  bootstrap_seed: number;
}

export interface RadarData {
  as_of: string;
  floor_usd: number;
  board_size: number;
  watchlist_size: number;
  global_multiple: number;
  min_sample: number;
  median_age_years: number;
  total_implied_usd: number;
  category_multiples: Record<string, number>;
  rows: BoardRow[];
  fit: CurveFit;
  evidence: Evidence;
  accounting: Accounting;
  assumptions: Assumptions;
  /** Term-by-term ablation (median miss on both tests, terms added in order) and the factor range each term spans. */
  ablation: AblationRow[];
  /** Term-by-term odds ablation (Brier score on both tests) and the range-calibration panel. */
  odds_ablation: OddsAblationRow[];
  calibration: Calibration;
  term_ranges: TermRanges;
}

/** A category factor is trusted only with this many trading comps. */
export const MIN_SAMPLE = 3;

/** Category factors shrink toward 1.0 by n/(n+64): hard shrinkage, because the factor only helps leave-one-out a little and is flat walk-forward. */
export const CATEGORY_SHRINK = 64;

/** The farm scenario, stated on the page and in the README. */
export const DEPOSIT_USD = 10_000;
export const DROP_POOL_PCT = 0.02;
export const FARMING_POOL_PCT = 0.05;
export const ODDS_PRIOR_WEIGHT = 20;
export const VERDICT_FARM_NET_USD = 750;
export const VERDICT_FARM_PER_HOUR_USD = 500;
export const VERDICT_SKIP_NET_USD = 100;
/** Typical gas per transaction, in dollars, by chain. */
export const GAS_USD: Record<string, number> = { Ethereum: 5, Solana: 0.01, Bitcoin: 3 };
export const GAS_DEFAULT_USD = 0.25;
/** Bootstrap refits of the size curve: 200 draws, fixed seed, so every run agrees. */
export const BOOTSTRAP_DRAWS = 200;
export const BOOTSTRAP_SEED = 20261114;
/** Opportunity cost of farming: the US 3-month Treasury bill, Federal Reserve H.15, 19 Nov 2026. */
export const TBILL_RATE = 0.0416;
export const TBILL_AS_OF = '2026-11-19';
/** The farm plans ask for at least a 30-day hold, so the T-bill comparison
 * runs over 30 days — a floor on the opportunity cost, since some plans ask
 * for 60+ days. The hands-on time (hours) is far shorter; pricing the
 * T-bill over hands-on minutes would understate what the locked deposit
 * gives up, so the comparison uses the hold, stated here and on the page. */
export const TBILL_HOLD_DAYS = 30;

const EXCLUDED_CATEGORIES = new Set([
  'Bridge',
  'Canonical Bridge',
  'Liquid Staking',
  'Liquid Restaking',
  'Restaked BTC',
  'CEX',
]);

const VERSION_RE = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
const WRAPPED_RE = /\b(wrapped|staked|staking)\b/i;
const EXCHANGE_RE = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/;

export function parseSnapshot(text: string): Snapshot {
  const raw = JSON.parse(text) as Snapshot;
  if (!Array.isArray(raw.protocols) || !Array.isArray(raw.watchlist)) {
    throw new Error('snapshot: protocols and watchlist must be arrays');
  }
  return raw;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1
    ? sorted[mid]!
    : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

function yearsBetween(fromDay: string, toDay: string): number {
  const from = new Date(`${fromDay}T00:00:00Z`).getTime();
  const to = new Date(`${toDay}T00:00:00Z`).getTime();
  return Math.max(0, (to - from) / 86_400_000 / 365.25);
}

/** The house's own token test: a protocol records a token when DefiLlama carries a gecko id, a symbol, or a market cap for it. */
export function recordsToken(p: Protocol): boolean {
  return p.gecko_id !== null || p.symbol !== null || p.mcap_usd !== null;
}

/** The snapshot's own watchlist rule, re-derived, with the strict token test: a pre-token protocol that is not a wrapped, staked or bridged product. */
export function isCleanPreToken(p: Protocol): boolean {
  if (recordsToken(p)) return false;
  if (p.category !== null && EXCLUDED_CATEGORIES.has(p.category)) return false;
  if (VERSION_RE.test(p.name)) return false;
  if (WRAPPED_RE.test(p.name)) return false;
  if (EXCHANGE_RE.test(p.name)) return false;
  return true;
}

/** A farm step's stated minutes (its TIME marker, else its number before "min") and whether it names gas (one transaction). Each step counts once, as stated. */
export function stepEffort(step: string): { minutes: number; txs: number } {
  const marked = step.match(/TIME (\d+)\s*min/);
  const m = marked ?? step.match(/(\d+)\s*min/);
  return { minutes: m !== null ? Number(m[1]) : 10, txs: /gas/i.test(step) ? 1 : 0 };
}

// ---------------------------------------------------------------- farm plans

/** A typical transaction fee on a chain, as the steps quote it. */
function gasFor(chain: string): string {
  if (chain === 'Ethereum') return '$2–$8';
  if (chain === 'Solana') return '~$0.01';
  if (chain === 'Bitcoin') return '$1–$5';
  return '$0.05–$0.50';
}

type Step = (name: string, chain: string, gas: string) => string;

function fill(template: string): Step {
  return (name, chain, gas) =>
    template.replaceAll('{N}', name).replaceAll('{C}', chain).replaceAll('{G}', gas);
}

const DEX_STEPS: Step[] = [
  'Swap $100 of USDC for {C} gas token on {N} to cover fees ({G} gas, 5 min).',
  'Swap $100–$200 into {N}\u2019s main pair and check the price impact before confirming ({G} gas, 5 min).',
  'Add $100–$200 of liquidity to a {N} pool and keep the LP position open for at least 30 days ({G} gas, 10 min).',
  'Repeat a $50–$100 swap on {N} once a week for 4 weeks to build a usage history ({G} gas each, 5 min a week).',
  'Stake the LP tokens if {N} offers a gauge or farm, and claim rewards weekly ({G} gas, 10 min a week).',
  'Track the pool\u2019s volume and your share weekly; exit only after the snapshot window closes (5 min a week).',
].map(fill);

const LENDING_STEPS: Step[] = [
  'Supply $200 of USDC to {N} on {C} as collateral ({G} gas, 10 min).',
  'Borrow $50–$100 of a second asset against the deposit and repay it within 7 days to complete a full loan cycle ({G} gas, 10 min).',
  'Supply $100 of a second asset to a different market on {N} and leave it supplied for 30+ days ({G} gas, 10 min).',
  'Repay the borrow, then borrow again at a smaller size to keep the account active each month ({G} gas, 15 min a month).',
  'Check the health factor weekly and top up collateral if it falls below 1.5 (5 min a week).',
  'Claim any supply incentives weekly and restake them into the same market ({G} gas, 10 min a week).',
].map(fill);

const YIELD_STEPS: Step[] = [
  'Deposit $200 into the highest-TVL vault on {N} on {C} ({G} gas, 10 min).',
  'Leave the deposit for at least 30 days; harvest yield weekly and compound it back in ({G} gas, 10 min a week).',
  'Deposit $100 into a second vault on {N} to diversify across strategies ({G} gas, 10 min).',
  'Rebalance monthly: move funds from the lowest-yield vault to the best performer ({G} gas, 20 min a month).',
  'Record each deposit\u2019s date and amount so you can prove a long holding period (5 min).',
  'Withdraw only after 60+ days of activity so the position reads as a real user, not a flash farmer ({G} gas, 10 min).',
].map(fill);

const DERIVATIVES_STEPS: Step[] = [
  'Open a $50–$100 perpetual position on {N} on {C} with 2–3x leverage ({G} gas, 10 min).',
  'Close the position after 24–48 hours and open a second one in the opposite direction to show two-sided flow ({G} gas, 10 min).',
  'Trade $50–$100 of volume on {N} each week for 4 weeks, keeping total losses under $20 ({G} gas a week, 15 min a week).',
  'Place a limit order and a stop-loss on one trade to use the order book, not just market orders ({G} gas, 10 min).',
  'Keep the account funded with at least $100 of margin so positions never auto-liquidate (5 min).',
  'Export your trade history monthly as proof of sustained activity (5 min a month).',
].map(fill);

const CDP_STEPS: Step[] = [
  'Lock $300 of ETH as collateral in a {N} vault on {C} ({G} gas, 10 min).',
  'Mint $100 of {N}\u2019s stable asset against the collateral, keeping the ratio above 200% ({G} gas, 10 min).',
  'Use the minted asset in a {C} DEX pool for 30 days, then repay the full amount ({G} gas, 15 min).',
  'Open a second smaller vault ($100 collateral) to show repeated use across a month ({G} gas, 10 min).',
  'Check the collateral ratio weekly and add collateral if it drops below 180% (5 min a week).',
  'Repay and close both vaults only after 60 days of activity ({G} gas, 10 min).',
].map(fill);

const RWA_STEPS: Step[] = [
  'Complete {N}\u2019s allowlist or KYC on {C} if it asks for one (free, 15 min).',
  'Buy $200 of the tokenised asset on {N} and hold it for at least 30 days ({G} gas, 10 min).',
  'Reinvest the first yield payout ($5–$20) back into the same asset ({G} gas, 10 min).',
  'Add a second $100 purchase after 30 days to show a recurring buyer pattern ({G} gas, 10 min).',
  'Hold through at least one monthly distribution cycle and record the payout dates (5 min a month).',
  'Keep the position until {N} announces its token plan; only then consider selling ({G} gas, 10 min).',
].map(fill);

const BRIDGE_STEPS: Step[] = [
  'Bridge $100 of USDC from {C} to a second chain through {N} ({G} gas plus a $1–$3 bridge fee, 15 min).',
  'Bridge $50 back a week later to complete a round trip ({G} gas, 15 min).',
  'Repeat a $50–$100 bridge once a week for 4 weeks, varying the destination chain ({G} gas each, 15 min a week).',
  'Bridge a second asset ($50) once to show more than one token route ({G} gas, 15 min).',
  'Keep at least $20 of the bridged asset on the destination chain between trips (5 min).',
  'Check the fee quote before each trip and bridge in the cheapest hour of the day (5 min a trip).',
].map(fill);

const RESTAKING_STEPS: Step[] = [
  'Restake $200 of staked ETH through {N} on {C} ({G} gas, 10 min).',
  'Delegate the restaked position to two different operators to spread the stake ({G} gas, 15 min).',
  'Leave the position for 30+ days and claim restaking rewards weekly ({G} gas, 10 min a week).',
  'Add $100 more after 30 days to show a returning staker ({G} gas, 10 min).',
  'Use {N}\u2019s receipt token in a {C} lending market once, for $50, to show composability ({G} gas, 15 min).',
  'Track the operators\u2019 performance monthly and redelegate if one underperforms (10 min a month).',
].map(fill);

const BASIS_STEPS: Step[] = [
  'Deposit $200 of USDC into {N}\u2019s basis strategy on {C} ({G} gas, 10 min).',
  'Leave the deposit for 30+ days and collect the funding-rate yield weekly ({G} gas, 10 min a week).',
  'Add $100 after the first month to show a recurring depositor ({G} gas, 10 min).',
  'Check the strategy\u2019s funding rate and APY weekly; withdraw if the rate turns negative for 2 weeks (5 min a week).',
  'Try a second {N} strategy with $50 to broaden the footprint ({G} gas, 10 min).',
  'Record entry dates and yields monthly so the activity is provable (5 min a month).',
].map(fill);

const LEVERAGED_STEPS: Step[] = [
  'Open a $100 leveraged farming position on {N} on {C} at 2x leverage ({G} gas, 10 min).',
  'Hold the position for 14 days, then close half to lock in yield ({G} gas, 10 min).',
  'Reopen a $50 position the following week to show repeated use ({G} gas, 10 min).',
  'Watch the liquidation price daily while leveraged and add margin if it comes within 20% (5 min a day).',
  'Claim farming rewards weekly and compound them into the same position ({G} gas, 10 min a week).',
  'Close all leverage after 60 days and keep the receipts as proof of use ({G} gas, 10 min).',
].map(fill);

const LIQUIDITY_STEPS: Step[] = [
  'Deposit $200 into a {N} managed liquidity vault on {C} ({G} gas, 10 min).',
  'Leave the vault for 30+ days while it rebalances ranges for you ({G} gas, 10 min).',
  'Add $100 to a second vault with a different pair after 30 days ({G} gas, 10 min).',
  'Compare the vault\u2019s fees against holding the assets weekly (5 min a week).',
  'Claim any vault incentives weekly and restake them ({G} gas, 10 min a week).',
  'Withdraw only after 60 days, keeping the vault receipts as proof (5 min).',
].map(fill);

const OPTIONS_STEPS: Step[] = [
  'Buy a $50 call option on {N} on {C} expiring in 2–4 weeks ({G} gas, 10 min).',
  'Sell a covered call for $50 of premium in the same month to show both sides ({G} gas, 10 min).',
  'Trade one option a week for 4 weeks, keeping total premiums under $200 ({G} gas a week, 15 min a week).',
  'Use a limit order for at least one trade instead of a market order ({G} gas, 10 min).',
  'Track open interest and expiry dates weekly so no position expires unnoticed (5 min a week).',
  'Export the trade history monthly as proof of sustained activity (5 min a month).',
].map(fill);

const SYNTHETICS_STEPS: Step[] = [
  'Mint $100 of a synthetic asset on {N} on {C} against $300 of collateral ({G} gas, 10 min).',
  'Hold the synthetic for 30 days and trade it once a week for $25–$50 ({G} gas a week, 10 min a week).',
  'Add $100 of collateral after 30 days to show a returning minter ({G} gas, 10 min).',
  'Redeem the synthetic back to collateral after 60 days to complete the cycle ({G} gas, 10 min).',
  'Check the collateral ratio weekly and top up if it falls below 180% (5 min a week).',
  'Use the synthetic in a {C} pool once for $50 to show composability ({G} gas, 15 min).',
].map(fill);

const INDEX_STEPS: Step[] = [
  'Buy $200 of {N}\u2019s index token on {C} ({G} gas, 10 min).',
  'Hold the index for at least 60 days and check its rebalance monthly (5 min a month).',
  'Add $100 after the first rebalance to show a recurring buyer ({G} gas, 10 min).',
  'Compare the index return against its constituents monthly (5 min a month).',
  'Redeem a $50 slice once to test the exit and re-enter the next week ({G} gas, 15 min).',
  'Keep the position until {N} announces its token plan (5 min a month).',
].map(fill);

const LAUNCHPAD_STEPS: Step[] = [
  'Stake $200 of the launchpad\u2019s base token on {N} on {C} to qualify for allocations ({G} gas, 10 min).',
  'Join one token sale on {N} with $50–$100 and hold the allocation for 30 days ({G} gas, 15 min).',
  'Vote in one {N} governance poll about a listing to show participation ({G} gas, 5 min).',
  'Join a second sale the following month with $50 ({G} gas, 15 min).',
  'Track vesting releases weekly and claim them on schedule ({G} gas, 10 min a week).',
  'Keep the stake for 60+ days so the account reads as a real participant (5 min a week).',
].map(fill);

const PAYMENTS_STEPS: Step[] = [
  'Pay $50 to a merchant or peer through {N} on {C} ({G} gas, 5 min).',
  'Set up a $25 weekly recurring payment on {N} and let it run for 4 weeks ({G} gas, 10 min).',
  'Receive $50 through {N} once to show two-way flow ({G} gas, 5 min).',
  'Use {N}\u2019s card or checkout once for a $20 purchase if it offers one ({G} gas, 10 min).',
  'Keep a $100 balance in {N} for 30 days to show a real user, not a passer-through (5 min).',
  'Review the payment history monthly and export it as proof (5 min a month).',
].map(fill);

const PREDICTION_STEPS: Step[] = [
  'Place a $25 bet on a {N} market on {C} resolving within 2 weeks ({G} gas, 10 min).',
  'Place a second $25 bet on the opposite side of a different market ({G} gas, 10 min).',
  'Trade $25 a week for 4 weeks across at least 3 different markets ({G} gas a week, 15 min a week).',
  'Provide $50 of liquidity to one {N} market and leave it until resolution ({G} gas, 10 min).',
  'Claim winnings within 24 hours of each market resolving ({G} gas, 5 min).',
  'Track your win rate monthly and keep total stakes under $200 (5 min a month).',
].map(fill);

const INSURANCE_STEPS: Step[] = [
  'Buy $20 of cover for a $200 deposit on {N} on {C} ({G} gas, 10 min).',
  'Keep the cover active for 30+ days and renew it once ({G} gas, 10 min).',
  'Buy a second $20 cover for a different protocol the next month ({G} gas, 10 min).',
  'Check the cover\u2019s terms weekly so you know what a claim needs (5 min a week).',
  'Stake $100 in {N}\u2019s underwriting pool for 30 days if it offers one ({G} gas, 10 min).',
  'Claim any underwriting yield monthly and restake it ({G} gas, 10 min a month).',
].map(fill);

const GENERIC_STEPS: Step[] = [
  'Connect your wallet to {N} on {C} and explore its vaults or strategies ({G} gas, 10 min).',
  'Deposit $200 into {N}\u2019s largest vault or strategy on {C} ({G} gas, 10 min).',
  'Leave the deposit for 30+ days and check its performance weekly (5 min a week).',
  'Add $100 more after 30 days to show a returning user ({G} gas, 10 min).',
  'Use one more feature of {N} (a second vault, a swap, or a governance vote) to broaden your footprint ({G} gas, 15 min).',
  'Record deposit dates and amounts so the activity is provable (5 min).',
].map(fill);

const TEMPLATES: Record<string, Step[]> = {
  Dexs: DEX_STEPS,
  Lending: LENDING_STEPS,
  Yield: YIELD_STEPS,
  'Yield Aggregator': YIELD_STEPS,
  Derivatives: DERIVATIVES_STEPS,
  CDP: CDP_STEPS,
  RWA: RWA_STEPS,
  Bridge: BRIDGE_STEPS,
  'Cross Chain Bridge': BRIDGE_STEPS,
  'Canonical Bridge': BRIDGE_STEPS,
  Restaking: RESTAKING_STEPS,
  'Liquid Restaking': RESTAKING_STEPS,
  'Basis Trading': BASIS_STEPS,
  'Leveraged Farming': LEVERAGED_STEPS,
  Farm: LEVERAGED_STEPS,
  'Liquidity Manager': LIQUIDITY_STEPS,
  Options: OPTIONS_STEPS,
  'Options Vault': OPTIONS_STEPS,
  Synthetics: SYNTHETICS_STEPS,
  Indexes: INDEX_STEPS,
  Launchpad: LAUNCHPAD_STEPS,
  Payments: PAYMENTS_STEPS,
  'Prediction Market': PREDICTION_STEPS,
  Insurance: INSURANCE_STEPS,
};

/** Six concrete steps for a protocol, from its own category and chains — plus the four closing steps every farm needs. Every step carries its cost and its hands-on minutes ("COST $5.00 gas · TIME 10 min hands-on"). */
export function farmSteps(p: Protocol): string[] {
  const chain = p.chains[0] ?? 'Ethereum';
  const gas = gasFor(chain);
  const steps = TEMPLATES[p.category ?? ''] ?? GENERIC_STEPS;
  const priced = steps.map((s) => withCostTime(s(p.name, chain, gas), chain));
  const k = `$${gasPerTx(chain).toFixed(2)}`;
  return [...priced, ...CLOSING_STEPS.map((s) => s(p.name, chain, k))];
}

/** Rewrite a template step so its cost and hands-on time are explicit: the trailing "(… gas, 10 min)" becomes "COST $5.00 gas · TIME 10 min hands-on". The gas word stays in the text, so the step still counts as one gas transaction; a step that names a bridge fee carries the $2 fee in its cost. */
function withCostTime(step: string, chain: string): string {
  const paren = step.match(/\(([^)]*)\)\.?\s*$/);
  let core = step;
  let timePhrase = '10 min';
  if (paren !== null) {
    core = step.slice(0, paren.index).trimEnd();
    const tm = paren[1]!.match(/(\d+\s*min[^,)]*)/);
    if (tm !== null) timePhrase = tm[1]!.trim();
  }
  const namesGas = /gas/i.test(step);
  const bridgeFee = /bridge fee/i.test(step) ? 2 : 0;
  const cost = (namesGas ? gasPerTx(chain) : 0) + bridgeFee;
  return `${core}. COST $${cost.toFixed(2)}${namesGas ? ' gas' : ''} · TIME ${timePhrase} hands-on.`;
}

/** The four closing steps: verify, record, watch, cadence. They apply to every farm, whatever the category. */
const CLOSING_STEPS: Step[] = [
  'Verify {N}\u2019s contract addresses against its official docs and the DefiLlama page before your next deposit — never sign an approval from a link sent in a DM. COST $0.00 · TIME 5 min hands-on.',
  'Keep a ledger from the first transaction: date, tx hash, amount and dollar value of every deposit, claim and withdrawal — a drop may ask you to prove your history. COST $0.00 · TIME 5 min hands-on.',
  'Set an exit rule now: withdraw if {N}\u2019s TVL falls 20% in a week or withdrawals pause; check TVL weekly. COST $0.00 · TIME 5 min a week hands-on.',
  'Touch the position once a week for 12 weeks (top-up, claim, or harvest — one gas transaction a week) rather than one deposit: steady use reads as a real user. COST {G} gas · TIME 5 min a week hands-on.',
].map((template) => (name: string, chain: string, gas: string) =>
  template.replaceAll('{N}', name).replaceAll('{C}', chain).replaceAll('{G}', gas),
);

/** The steps plus their effort: total stated minutes, gas-naming transactions, and bridge fees ($2 per step that names one). */
export function farmPlan(p: Protocol): { steps: string[]; minutes: number; txs: number; extraFeesUsd: number } {
  const steps = farmSteps(p);
  let minutes = 0;
  let txs = 0;
  let extraFeesUsd = 0;
  for (const s of steps) {
    const e = stepEffort(s);
    minutes += e.minutes;
    txs += e.txs;
    if (/bridge fee/i.test(s)) extraFeesUsd += 2;
  }
  return { steps, minutes, txs, extraFeesUsd };
}

/** Typical gas per transaction on a chain, in dollars. */
export function gasPerTx(chain: string): number {
  return GAS_USD[chain] ?? GAS_DEFAULT_USD;
}

// ---------------------------------------------------------------- the fit

function percentile(values: number[], q: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i);
  const hi = Math.min(lo + 1, sorted.length - 1);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (i - lo);
}

/** Protocols whose market cap can enter a log fit: a positive cap on positive TVL. Dead or unpriced tokens (mcap <= 0) cannot. */
function fitComps(snapshot: Snapshot): Protocol[] {
  return snapshot.protocols.filter((p) => p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0);
}

interface Ols {
  slope: number;
  intercept: number;
  r2: number;
}

function ols(xs: number[], ys: number[]): Ols {
  const n = xs.length;
  const mx = xs.reduce((s, x) => s + x, 0) / n;
  const my = ys.reduce((s, y) => s + y, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let sst = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i]! - mx) * (ys[i]! - my);
    sxx += (xs[i]! - mx) * (xs[i]! - mx);
    sst += (ys[i]! - my) * (ys[i]! - my);
  }
  const slope = sxx === 0 ? 0 : sxy / sxx;
  const intercept = my - slope * mx;
  let ssr = 0;
  for (let i = 0; i < n; i++) {
    const d = ys[i]! - (intercept + slope * xs[i]!);
    ssr += d * d;
  }
  return { slope, intercept, r2: sst === 0 ? 0 : 1 - ssr / sst };
}

/** The log-log size curve, fitted at runtime from the trading comps. */
export function fitCurve(snapshot: Snapshot): CurveFit {
  const comps = fitComps(snapshot);
  const xs = comps.map((p) => Math.log(p.tvl_usd));
  const ys = comps.map((p) => Math.log(p.mcap_usd!));
  const f = ols(xs, ys);
  return {
    slope: f.slope,
    intercept: f.intercept,
    r2: f.r2,
    n_comps: comps.length,
    multiple_at_100m: Math.exp(f.intercept + f.slope * Math.log(100_000_000)) / 100_000_000,
    // Filled in by buildRadar from the bootstrap refits (no refit here).
    slope_se: 0,
    multiple_se: 0,
  };
}

function curveValue(fit: CurveFit, tvl: number): number {
  return Math.exp(fit.intercept + fit.slope * Math.log(Math.max(1, tvl)));
}

/** Median (actual mcap / curve-predicted mcap) per category, shrunk toward 1.0 and clamped, from any comp list. */
function categoryFactorsFrom(comps: Protocol[], fit: CurveFit): Record<string, { factor: number; comps: number }> {
  const byCategory = new Map<string, number[]>();
  for (const p of comps) {
    if (p.mcap_usd === null || p.mcap_usd <= 0 || p.tvl_usd <= 0) continue;
    const key = p.category ?? '(none)';
    const list = byCategory.get(key) ?? [];
    list.push(p.mcap_usd / curveValue(fit, p.tvl_usd));
    byCategory.set(key, list);
  }
  const out: Record<string, { factor: number; comps: number }> = {};
  for (const [key, values] of byCategory) {
    if (values.length < MIN_SAMPLE) continue;
    const med = median(values);
    if (med === null) continue;
    const w = values.length / (values.length + CATEGORY_SHRINK);
    const factor = clamp(1 + (med - 1) * w, 0.3, 2.5);
    out[key] = { factor, comps: values.length };
  }
  return out;
}

/** Median (actual mcap / curve-predicted mcap) per category, shrunk toward 1.0 and clamped. */
function categoryFactors(snapshot: Snapshot, fit: CurveFit): Record<string, { factor: number; comps: number }> {
  return categoryFactorsFrom(fitComps(snapshot), fit);
}

/** Deterministic PRNG (mulberry32): the bootstrap draws are identical on every run. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Bootstrap rank ranges: resample the traded comps with replacement, refit
 * the curve and the category factors each draw, re-rank the whole board, and
 * take the P5–P95 rank per row. A wide interval means the rank is fragile;
 * a narrow one means the curve is sure of it. The draws also give the
 * standard error of the slope and of the $100M multiple.
 */
function bootstrapRanks(
  snapshot: Snapshot,
  scored: Scored[],
): { ranges: Map<string, { lo: number; hi: number }>; slopeSe: number; multipleSe: number } {
  const comps = fitComps(snapshot);
  const n = comps.length;
  const xs = comps.map((p) => Math.log(p.tvl_usd));
  const ys = comps.map((p) => Math.log(p.mcap_usd!));
  const rand = mulberry32(BOOTSTRAP_SEED);
  const ranks = new Map<string, number[]>();
  for (const s of scored) ranks.set(s.slug, []);
  const slopes: number[] = [];
  const multiples: number[] = [];
  for (let d = 0; d < BOOTSTRAP_DRAWS; d++) {
    const sx: number[] = [];
    const sy: number[] = [];
    const sampled: Protocol[] = [];
    for (let i = 0; i < n; i++) {
      const j = Math.floor(rand() * n);
      sx.push(xs[j]!);
      sy.push(ys[j]!);
      sampled.push(comps[j]!);
    }
    const f = ols(sx, sy);
    slopes.push(f.slope);
    multiples.push(Math.exp(f.intercept + f.slope * Math.log(100_000_000)) / 100_000_000);
    const drawFit: CurveFit = {
      slope: f.slope,
      intercept: f.intercept,
      r2: f.r2,
      n_comps: n,
      multiple_at_100m: Math.exp(f.intercept + f.slope * Math.log(100_000_000)) / 100_000_000,
      slope_se: 0,
      multiple_se: 0,
    };
    const factors = categoryFactorsFrom(sampled, drawFit);
    const vals = scored.map((s) => {
      const key = s.category ?? '(none)';
      const mult = factors[key] !== undefined ? factors[key]!.factor : 1;
      return {
        slug: s.slug,
        v: curveValue(drawFit, s.tvl_usd) * mult * s.growthFactor * s.odds,
        tvl: s.tvl_usd,
      };
    });
    vals.sort((a, b) => b.v - a.v || b.tvl - a.tvl || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
    vals.forEach((row, i) => ranks.get(row.slug)!.push(i + 1));
  }
  const out = new Map<string, { lo: number; hi: number }>();
  for (const [slug, rs] of ranks) {
    out.set(slug, {
      lo: clamp(Math.round(percentile(rs, 0.05)), 1, scored.length),
      hi: clamp(Math.round(percentile(rs, 0.95)), 1, scored.length),
    });
  }
  const sd = (v: number[]): number => {
    const m = v.reduce((s, x) => s + x, 0) / v.length;
    return Math.sqrt(v.reduce((s, x) => s + (x - m) * (x - m), 0) / (v.length - 1));
  };
  return { ranges: out, slopeSe: sd(slopes), multipleSe: sd(multiples) };
}

function ageYears(p: Protocol, asOf: string, medianAge: number): number {
  if (p.listed_at === null) return medianAge;
  return yearsBetween(p.listed_at, asOf);
}

/** P(token) from the snapshot's own record: the peer-group rate. Peers share the category and were listed within a year of this one; the rate is shrunk toward the global token rate. The TVL band the v2 odds used was tested and dropped: it shrinks the peer group without lowering the Brier score on either test (see the odds ablation). */
export function tokenOdds(
  p: Protocol,
  snapshot: Snapshot,
  medianAge: number,
  globalRate: number,
): { odds: number; peers: number; peersWithToken: number } {
  return tokenOddsPool(p, snapshot.protocols, snapshot.as_of, medianAge, globalRate);
}

/** The peer-group odds over any pool of protocols (the full snapshot, or the walk-forward training set). */
function tokenOddsPool(
  p: Protocol,
  pool: Protocol[],
  asOf: string,
  medianAge: number,
  globalRate: number,
): { odds: number; peers: number; peersWithToken: number } {
  const age = ageYears(p, asOf, medianAge);
  let peers = 0;
  let withToken = 0;
  for (const q of pool) {
    if (q.slug === p.slug) continue;
    if (q.category !== p.category) continue;
    if (Math.abs(ageYears(q, asOf, medianAge) - age) > 1) continue;
    peers++;
    if (recordsToken(q)) withToken++;
  }
  const odds = (withToken + ODDS_PRIOR_WEIGHT * globalRate) / (peers + ODDS_PRIOR_WEIGHT);
  return { odds, peers, peersWithToken: withToken };
}

/** Quantiles of the peer ratios (mcap / curve-predicted) in the row's category over any comp list, else the global spread. Only used to measure the OLD range construction's calibration. */
function ratioSpread(
  category: string | null,
  comps: Protocol[],
  fit: CurveFit,
): { p10: number; p25: number; median: number; p75: number; p90: number } {
  const ratios: number[] = [];
  const global: number[] = [];
  for (const p of comps) {
    if (p.mcap_usd === null || p.mcap_usd <= 0 || p.tvl_usd <= 0) continue;
    const r = p.mcap_usd / curveValue(fit, p.tvl_usd);
    global.push(r);
    if (p.category === category) ratios.push(r);
  }
  const use = ratios.length >= MIN_SAMPLE ? ratios : global;
  return {
    p10: percentile(use, 0.1),
    p25: percentile(use, 0.25),
    median: median(use) ?? 1,
    p75: percentile(use, 0.75),
    p90: percentile(use, 0.9),
  };
}

/** The five nearest token-trading peers in the same category by TVL distance, topped up with the nearest overall. */
function nearestPeers(p: Protocol, snapshot: Snapshot, fit: CurveFit): Peer[] {
  const comps = fitComps(snapshot);
  const scored = comps
    .filter((q) => q.slug !== p.slug)
    .map((q) => ({
      q,
      d: Math.abs(Math.log(q.tvl_usd) - Math.log(Math.max(1, p.tvl_usd))),
    }))
    .sort((a, b) => a.d - b.d);
  const picked: { q: Protocol; d: number }[] = [];
  for (const s of scored) {
    if (picked.length >= 5) break;
    if (s.q.category === p.category) picked.push(s);
  }
  for (const s of scored) {
    if (picked.length >= 5) break;
    if (!picked.includes(s)) picked.push(s);
  }
  return picked.map(({ q }) => ({
    slug: q.slug,
    name: q.name,
    category: q.category ?? 'Uncategorised',
    tvl_usd: q.tvl_usd,
    mcap_usd: q.mcap_usd!,
    cap_tvl: q.mcap_usd! / q.tvl_usd,
    curve_multiple: curveValue(fit, q.tvl_usd) / q.tvl_usd,
    same_category: q.category === p.category,
  }));
}

interface Scored extends Protocol {
  multiple: number;
  multipleSource: 'category' | 'global';
  growthFactor: number;
  ageYears: number;
  ageFactor: number;
  ifLaunches: number;
  odds: number;
  oddsPeers: number;
  oddsPeersWithToken: number;
  impliedValue: number;
  econ: FarmEconomics;
  verdict: Verdict;
  netPerHour: number;
  peers: Peer[];
}

function scoreProtocol(
  p: Protocol,
  snapshot: Snapshot,
  fit: CurveFit,
  factors: Record<string, { factor: number; comps: number }>,
  medianAge: number,
  globalRate: number,
): Scored {
  const key = p.category ?? '(none)';
  const entry = factors[key];
  const multiple = entry !== undefined ? entry.factor : 1;
  const multipleSource = entry !== undefined ? 'category' : 'global';
  const growthFactor =
    p.change_7d === null ? 1 : 1 + (clamp(p.change_7d, -50, 100) / 100) * 0.5;
  const age = ageYears(p, snapshot.as_of, medianAge);
  const ageFactor = Math.min(1.5, 1 + 0.15 * Math.log(1 + Math.max(0, age)));
  // Age is TESTED, NOT KEPT in the value model (it fails the keep-rule's
  // leave-one-out test); it earns its place in the token odds instead.
  // The factor is still computed and shown, so the reader sees the test.
  const ifLaunches = curveValue(fit, p.tvl_usd) * multiple * growthFactor;
  const { odds, peers, peersWithToken } = tokenOdds(p, snapshot, medianAge, globalRate);
  const impliedValue = Math.max(1, Math.min(1e14, Math.round(ifLaunches * odds)));

  const plan = farmPlan(p);
  const chain = p.chains[0] ?? 'Ethereum';
  const gas = gasPerTx(chain);
  const fees = plan.txs * gas + plan.extraFeesUsd;
  const hours = Math.max(0.1, plan.minutes / 60);
  const dropPool = DROP_POOL_PCT * impliedValue;
  const share = Math.min(1, DEPOSIT_USD / Math.max(1, FARMING_POOL_PCT * p.tvl_usd));
  const farmerDrop = dropPool * share;
  const net = farmerDrop * odds - fees;
  const netPerHour = net / hours;
  // The same deposit in a US 3-month Treasury bill over the plan's minimum
  // 30-day hold: the opportunity cost of farming. (Hands-on time is under
  // an hour; the deposit itself is locked for the hold.)
  const tbill = (DEPOSIT_USD * TBILL_RATE * TBILL_HOLD_DAYS) / 365.25;
  const verdict: Verdict =
    net > VERDICT_FARM_NET_USD && netPerHour > VERDICT_FARM_PER_HOUR_USD
      ? 'FARM'
      : net < VERDICT_SKIP_NET_USD
        ? 'SKIP'
        : 'MARGINAL';

  return {
    ...p,
    multiple,
    multipleSource,
    growthFactor,
    ageYears: age,
    ageFactor,
    ifLaunches,
    odds,
    oddsPeers: peers,
    oddsPeersWithToken: peersWithToken,
    impliedValue,
    econ: {
      deposit_usd: DEPOSIT_USD,
      drop_pool_usd: dropPool,
      farmer_drop_usd: farmerDrop,
      fees_usd: fees,
      hours,
      gas_per_tx_usd: gas,
      txs: plan.txs,
      tbill_usd: tbill,
    },
    verdict,
    netPerHour,
    peers: nearestPeers(p, snapshot, fit),
  };
}

/** Held-out evidence for the fitted curve, computed at runtime from the snapshot. */
function computeEvidence(
  snapshot: Snapshot,
  fit: CurveFit,
): { evidence: Evidence; ablation: AblationRow[]; oddsAblation: OddsAblationRow[]; calibration: Calibration } {
  const comps = fitComps(snapshot);
  const miss = (pred: number, actual: number): number => Math.max(pred / actual, actual / pred);

  // The test comp's own factors (growth, age) and its full-snapshot token
  // odds, for the ablation's later terms. Odds do not use the curve, so
  // leaving the comp in the odds' peer group leaks nothing about the fit.
  const ages = snapshot.protocols
    .filter((p) => p.listed_at !== null)
    .map((p) => yearsBetween(p.listed_at!, snapshot.as_of));
  const medianAge = median(ages) ?? 1;
  const globalRate = snapshot.protocols.filter(recordsToken).length / snapshot.protocols.length;
  const compOdds = new Map<string, number>();
  for (const p of comps) compOdds.set(p.slug, tokenOdds(p, snapshot, medianAge, globalRate).odds);

  // Leave-one-out: refit the curve without each comp, predict it; the
  // ablation adds terms in order (curve, +category, +growth, +age, +odds).
  const looFitted: number[] = [];
  const looFlat: number[] = [];
  const looCat: number[] = [];
  const looGrowth: number[] = [];
  const looAge: number[] = [];
  const looFull: number[] = [];
  // The kept model's leave-one-out residuals (actual / held-out prediction):
  // the ranges are built from these. And the OLD range construction's
  // coverage, for the before/after in the calibration panel.
  const looResid: number[] = [];
  let oldLoo2575 = 0;
  let oldLoo1090 = 0;
  for (let i = 0; i < comps.length; i++) {
    const rest = comps.filter((_, j) => j !== i);
    const f = ols(
      rest.map((p) => Math.log(p.tvl_usd)),
      rest.map((p) => Math.log(p.mcap_usd!)),
    );
    const test = comps[i]!;
    const actual = test.mcap_usd!;
    const predCurve = Math.exp(f.intercept + f.slope * Math.log(test.tvl_usd));
    looFitted.push(miss(predCurve, actual));
    const flatMed = median(rest.map((p) => p.mcap_usd! / p.tvl_usd));
    looFlat.push(miss((flatMed ?? 0) * test.tvl_usd, actual));
    const restFactors = categoryFactorsFrom(rest, {
      slope: f.slope,
      intercept: f.intercept,
      r2: 0,
      n_comps: rest.length,
      multiple_at_100m: 0,
    });
    const catKey = test.category ?? '(none)';
    const catMult = restFactors[catKey] !== undefined ? restFactors[catKey]!.factor : 1;
    const predCat = predCurve * catMult;
    looCat.push(miss(predCat, actual));
    const growth =
      test.change_7d === null ? 1 : 1 + (clamp(test.change_7d, -50, 100) / 100) * 0.5;
    const predGrowth = predCat * growth;
    looGrowth.push(miss(predGrowth, actual));
    const age = ageYears(test, snapshot.as_of, medianAge);
    const ageFactor = Math.min(1.5, 1 + 0.15 * Math.log(1 + Math.max(0, age)));
    const predAge = predGrowth * ageFactor;
    looAge.push(miss(predAge, actual));
    const predFull = predAge * (compOdds.get(test.slug) ?? globalRate);
    looFull.push(miss(predFull, actual));
    // The kept model's residual: actual over the held-out prediction.
    looResid.push(actual / predGrowth);
    // The OLD range construction's coverage: the in-sample spread of peer
    // ratios, scaled onto the same held-out prediction.
    const spread = ratioSpread(test.category, rest, {
      slope: f.slope,
      intercept: f.intercept,
      r2: 0,
      n_comps: rest.length,
      multiple_at_100m: 0,
      slope_se: 0,
      multiple_se: 0,
    });
    const oldLo = predGrowth * (spread.p25 / spread.median);
    const oldHi = predGrowth * (spread.p75 / spread.median);
    if (actual >= oldLo && actual <= oldHi) oldLoo2575++;
    const oldLo10 = predGrowth * (spread.p10 / spread.median);
    const oldHi10 = predGrowth * (spread.p90 / spread.median);
    if (actual >= oldLo10 && actual <= oldHi10) oldLoo1090++;
  }

  // The kept model's leave-one-out residual quantiles: the ranges are built
  // from these, so the printed range is calibrated by construction.
  const residQ25 = percentile(looResid, 0.25);
  const residQMed = median(looResid) ?? 1;
  const residQ75 = percentile(looResid, 0.75);
  const residQ10 = percentile(looResid, 0.1);
  const residQ90 = percentile(looResid, 0.9);

  // Walk-forward: fit on tokens listed before 2025-01-01, test on later ones.
  // Every term is scored on this split too, with the training set's own
  // factors and odds — the full model uses train-only peers for its odds.
  const train = comps.filter((p) => p.listed_at !== null && p.listed_at < '2025-01-01');
  const test = comps.filter((p) => p.listed_at !== null && p.listed_at >= '2025-01-01');
  const trainProtos = snapshot.protocols.filter((p) => p.listed_at !== null && p.listed_at < '2025-01-01');
  const testProtos = snapshot.protocols.filter((p) => p.listed_at !== null && p.listed_at >= '2025-01-01');
  const trainRate = trainProtos.filter(recordsToken).length / Math.max(1, trainProtos.length);
  let wfFitted = 0;
  let wfFlat = 0;
  let wfCat = 0;
  let wfGrowth = 0;
  let wfAge = 0;
  let wfFull = 0;
  let wfCal2575 = 0;
  let wfCal1090 = 0;
  let wfCalX3 = 0;
  let wfOld2575 = 0;
  let wfOld1090 = 0;
  if (train.length >= 5 && test.length >= 1) {
    const f = ols(
      train.map((p) => Math.log(p.tvl_usd)),
      train.map((p) => Math.log(p.mcap_usd!)),
    );
    const flatMed = median(train.map((p) => p.mcap_usd! / p.tvl_usd)) ?? 0;
    const trainFactors = categoryFactorsFrom(train, {
      slope: f.slope,
      intercept: f.intercept,
      r2: 0,
      n_comps: train.length,
      multiple_at_100m: 0,
      slope_se: 0,
      multiple_se: 0,
    });
    const curvePred = (p: Protocol): number => Math.exp(f.intercept + f.slope * Math.log(p.tvl_usd));
    const catMult = (p: Protocol): number => {
      const e = trainFactors[p.category ?? '(none)'];
      return e !== undefined ? e.factor : 1;
    };
    const growthOf = (p: Protocol): number =>
      p.change_7d === null ? 1 : 1 + (clamp(p.change_7d, -50, 100) / 100) * 0.5;
    const ageOf = (p: Protocol): number => {
      const a = ageYears(p, snapshot.as_of, medianAge);
      return Math.min(1.5, 1 + 0.15 * Math.log(1 + Math.max(0, a)));
    };
    const wfMiss = (pred: (p: Protocol) => number): number =>
      median(test.map((p) => miss(pred(p), p.mcap_usd!))) ?? 0;
    wfFitted = wfMiss(curvePred);
    wfFlat = median(test.map((p) => miss(flatMed * p.tvl_usd, p.mcap_usd!))) ?? 0;
    wfCat = wfMiss((p) => curvePred(p) * catMult(p));
    wfGrowth = wfMiss((p) => curvePred(p) * catMult(p) * growthOf(p));
    wfAge = wfMiss((p) => curvePred(p) * catMult(p) * growthOf(p) * ageOf(p));
    wfFull = wfMiss(
      (p) =>
        curvePred(p) * catMult(p) * growthOf(p) * ageOf(p) *
        tokenOddsPool(p, trainProtos, snapshot.as_of, medianAge, trainRate).odds,
    );
    // Walk-forward calibration: the LOO residual quantiles applied to the
    // kept-model prediction on later listings, beside the old construction.
    for (const p of test) {
      const pred = curvePred(p) * catMult(p) * growthOf(p);
      const act = p.mcap_usd!;
      if (act >= pred * (residQ25 / residQMed) && act <= pred * (residQ75 / residQMed)) wfCal2575++;
      if (act >= pred * (residQ10 / residQMed) && act <= pred * (residQ90 / residQMed)) wfCal1090++;
      if (act >= pred / 3 && act <= pred * 3) wfCalX3++;
      const sp = ratioSpread(p.category, train, {
        slope: f.slope,
        intercept: f.intercept,
        r2: 0,
        n_comps: train.length,
        multiple_at_100m: 0,
        slope_se: 0,
        multiple_se: 0,
      });
      if (act >= pred * (sp.p25 / sp.median) && act <= pred * (sp.p75 / sp.median)) wfOld2575++;
      if (act >= pred * (sp.p10 / sp.median) && act <= pred * (sp.p90 / sp.median)) wfOld1090++;
    }
  }

  // Odds, term by term: each variant is a peer definition. Leave-one-out
  // is free — the peer loop skips the protocol itself. Walk-forward uses
  // only earlier-listed protocols as peers, with the training set's rate.
  const oddsWith = (p: Protocol, pool: Protocol[], rate: number, terms: string[]): number => {
    const age = ageYears(p, snapshot.as_of, medianAge);
    const logTvl = Math.log10(Math.max(1, p.tvl_usd));
    let peers = 0;
    let withToken = 0;
    for (const q of pool) {
      if (q.slug === p.slug) continue;
      if (terms.includes('cat') && q.category !== p.category) continue;
      if (terms.includes('age') && Math.abs(ageYears(q, snapshot.as_of, medianAge) - age) > 1) continue;
      if (terms.includes('size') && Math.abs(Math.log10(Math.max(1, q.tvl_usd)) - logTvl) > 1) continue;
      if (terms.includes('growth') && p.change_7d !== null && q.change_7d !== null && Math.sign(q.change_7d) !== Math.sign(p.change_7d)) continue;
      peers++;
      if (recordsToken(q)) withToken++;
    }
    return (withToken + ODDS_PRIOR_WEIGHT * rate) / (peers + ODDS_PRIOR_WEIGHT);
  };
  const brierOf = (testPool: Protocol[], rate: number, terms: string[]): { loo: number; wf: number } => {
    let loo = 0;
    for (const p of snapshot.protocols) {
      const o = terms.length === 0 ? rate : oddsWith(p, snapshot.protocols, rate, terms);
      const t = recordsToken(p) ? 1 : 0;
      loo += (o - t) * (o - t);
    }
    let wf = 0;
    for (const p of testPool) {
      const o = terms.length === 0 ? trainRate : oddsWith(p, trainProtos, trainRate, terms);
      const t = recordsToken(p) ? 1 : 0;
      wf += (o - t) * (o - t);
    }
    return { loo: loo / snapshot.protocols.length, wf: wf / Math.max(1, testPool.length) };
  };
  const oddsVariants: { label: string; terms: string[]; note: string }[] = [
    { label: 'Base rate', terms: [], note: 'global token rate' },
    { label: '+ category', terms: ['cat'], note: 'peers in the same category' },
    { label: '+ age', terms: ['cat', 'age'], note: 'listed within a year — the kept odds' },
    { label: '+ size (TVL band)', terms: ['cat', 'age', 'size'], note: 'within one decade of TVL' },
    { label: '+ growth (7d sign)', terms: ['cat', 'age', 'size', 'growth'], note: 'same sign of 7d change' },
  ];
  const oddsBriers = oddsVariants.map((v) => brierOf(testProtos, globalRate, v.terms));
  const oddsAblation: OddsAblationRow[] = oddsVariants.map((v, i) => {
    const b = oddsBriers[i]!;
    const prev = i === 0 ? null : oddsBriers[i - 1]!;
    const verdict = i === 0 ? 'baseline' : b.loo < prev.loo && b.wf < prev.wf ? 'kept' : 'dropped';
    return { label: v.label, loo_brier: b.loo, wf_brier: b.wf, verdict, note: v.note };
  });
  // The kept odds are category + age (index 2); the base rate is index 0.
  const brier = oddsBriers[2]!.loo;
  const brierBase = oddsBriers[0]!.loo;

  // Term-by-term ablation: the median miss as each term is added, on both
  // tests. The odds term is read honestly: it converts the if-launches
  // value to an expected value, so it cannot improve a miss measured
  // against market caps — its evidence is the Brier score, not this column.
  const ablation: AblationRow[] = [
    { label: 'Curve only', loo_miss: median(looFitted) ?? 0, wf_miss: wfFitted, verdict: 'kept', note: 'size curve, fitted' },
    { label: 'Curve + category', loo_miss: median(looCat) ?? 0, wf_miss: wfCat, verdict: 'kept', note: 'median ratio per category, shrunk n/(n+64)' },
    { label: '+ growth (7d TVL)', loo_miss: median(looGrowth) ?? 0, wf_miss: wfGrowth, verdict: 'kept', note: 'clamped ±50/+100%' },
    { label: '+ age (no-token years)', loo_miss: median(looAge) ?? 0, wf_miss: wfAge, verdict: 'dropped', note: 'fails leave-one-out; kept in token odds instead' },
    {
      label: 'Full model incl. odds',
      loo_miss: median(looFull) ?? 0,
      wf_miss: wfFull,
      verdict: 'expected value',
      note: 'odds discount expected value; see Brier',
    },
  ];

  // The calibration panel: the share of real caps inside the printed
  // ranges, for the new residual-based construction and the old peer-spread
  // one. Leave-one-out coverage is computed from the residuals themselves,
  // so the new P25–P75 covers 50% by construction; walk-forward is the
  // real test of the range.
  const inRange = (r: number, lo: number, hi: number): boolean => r >= lo && r <= hi;
  const calibration: Calibration = {
    loo_p2575: looResid.filter((r) => inRange(r, residQ25, residQ75)).length / looResid.length,
    loo_p1090: looResid.filter((r) => inRange(r, residQ10, residQ90)).length / looResid.length,
    loo_x3: looResid.filter((r) => r >= 1 / 3 && r <= 3).length / looResid.length,
    wf_p2575: test.length > 0 ? wfCal2575 / test.length : 0,
    wf_p1090: test.length > 0 ? wfCal1090 / test.length : 0,
    wf_x3: test.length > 0 ? wfCalX3 / test.length : 0,
    old_loo_p2575: oldLoo2575 / comps.length,
    old_loo_p1090: oldLoo1090 / comps.length,
    old_wf_p2575: test.length > 0 ? wfOld2575 / test.length : 0,
    old_wf_p1090: test.length > 0 ? wfOld1090 / test.length : 0,
    resid_p10: residQ10,
    resid_p25: residQ25,
    resid_median: residQMed,
    resid_p75: residQ75,
    resid_p90: residQ90,
  };

  return {
    evidence: {
      loo_fitted: median(looFitted) ?? 0,
      loo_flat: median(looFlat) ?? 0,
      wf_fitted: wfFitted,
      wf_flat: wfFlat,
      wf_train: train.length,
      wf_test: test.length,
      wf_split: 'listed before 2025-01-01, tested on 2025-01-01 or later',
      brier_odds: brier,
      brier_base: brierBase,
    },
    ablation,
    oddsAblation,
    calibration,
  };
}

export function buildRadar(snapshot: Snapshot): { board: BoardRow[]; radar: RadarData } {
  const fit = fitCurve(snapshot);
  const factors = categoryFactors(snapshot, fit);
  const ages = snapshot.protocols
    .filter((p) => p.listed_at !== null)
    .map((p) => yearsBetween(p.listed_at!, snapshot.as_of));
  const medianAge = median(ages) ?? 1;
  const globalRate = snapshot.protocols.filter(recordsToken).length / snapshot.protocols.length;
  const globalMultiple =
    median(fitComps(snapshot).map((p) => p.mcap_usd! / p.tvl_usd)) ?? 0;
  const categoryMultiples: Record<string, number> = {};
  for (const [key, v] of Object.entries(factors)) categoryMultiples[key] = v.factor;

  const watchlistSet = new Set(snapshot.watchlist);

  // Every strict-clean pre-token protocol in the snapshot: the watchlist
  // plus all the rest, whatever the floor. That is the whole board.
  const candidates = snapshot.protocols.filter(isCleanPreToken);
  const scored = candidates.map((p) =>
    scoreProtocol(p, snapshot, fit, factors, medianAge, globalRate),
  );
  scored.sort(
    (a, b) =>
      b.impliedValue - a.impliedValue ||
      b.tvl_usd - a.tvl_usd ||
      (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0),
  );

  // Force strictly decreasing values so rank always means something: a $1
  // nudge where two protocols price identically. Deterministic, invisible.
  let previous = Infinity;
  for (const s of scored) {
    if (s.impliedValue >= previous) s.impliedValue = Math.max(1, previous - 1);
    previous = s.impliedValue;
  }

  // Held-out evidence first: the board's ranges are built from the
  // leave-one-out residual quantiles, so they need the evidence.
  const { evidence, ablation, oddsAblation, calibration } = computeEvidence(snapshot, fit);

  // Bootstrap rank ranges: how sure is each rank? 200 refits of the curve.
  const boot = bootstrapRanks(snapshot, scored);
  fit.slope_se = boot.slopeSe;
  fit.multiple_se = boot.multipleSe;

  const board: BoardRow[] = scored.map((s, i) => {
    const rangeLo = Math.max(1, Math.round(s.impliedValue * (calibration.resid_p25 / calibration.resid_median)));
    const rangeHi = Math.max(rangeLo, Math.round(s.impliedValue * (calibration.resid_p75 / calibration.resid_median)));
    const rangeP10 = Math.max(1, Math.round(s.impliedValue * (calibration.resid_p10 / calibration.resid_median)));
    const rangeP90 = Math.max(rangeHi, Math.round(s.impliedValue * (calibration.resid_p90 / calibration.resid_median)));
    const plan = farmPlan(s);
    const net = s.econ.farmer_drop_usd * s.odds - s.econ.fees_usd;
    const bootRange = boot.ranges.get(s.slug) ?? { lo: i + 1, hi: i + 1 };
    return {
      slug: s.slug,
      name: s.name,
      rank: i + 1,
      implied_value_usd: s.impliedValue,
      farm_steps: plan.steps,
      category: s.category ?? 'Uncategorised',
      chains: s.chains,
      tvl_usd: s.tvl_usd,
      change_7d: s.change_7d,
      listed_at: s.listed_at,
      token_status: 'No token recorded',
      multiple: s.multiple,
      multiple_source: s.multipleSource,
      growth_factor: s.growthFactor,
      age_years: s.ageYears,
      age_factor: s.ageFactor,
      watchlist: watchlistSet.has(s.slug),
      if_launches_usd: Math.max(1, Math.round(s.ifLaunches)),
      token_odds: s.odds,
      odds_peers: s.oddsPeers,
      odds_peers_with_token: s.oddsPeersWithToken,
      range_lo_usd: rangeLo,
      range_hi_usd: rangeHi,
      range_p10_usd: rangeP10,
      range_p90_usd: rangeP90,
      verdict: s.verdict,
      net_usd: net,
      net_per_hour_usd: s.netPerHour,
      rank_lo: bootRange.lo,
      rank_hi: bootRange.hi,
      econ: s.econ,
      peers: s.peers,
    };
  });

  const tokenRecorded = snapshot.protocols.filter(recordsToken).length;
  const accounting: Accounting = {
    ranked: board.length,
    token_recorded: tokenRecorded,
    left_out: snapshot.protocols.length - board.length - tokenRecorded,
    total: snapshot.protocols.length,
  };

  // The fitted factor range each term actually spans on this board.
  const rangeOf = (values: number[]): [number, number] => [
    Math.min(...values),
    Math.max(...values),
  ];
  const factorValues = Object.values(factors).map((v) => v.factor);
  const termRanges: TermRanges = {
    category: factorValues.length > 0 ? rangeOf(factorValues) : [1, 1],
    growth: rangeOf(scored.map((s) => s.growthFactor)),
    age: rangeOf(scored.map((s) => s.ageFactor)),
    odds: rangeOf(scored.map((s) => s.odds)),
  };

  const radar: RadarData = {
    as_of: snapshot.as_of,
    floor_usd: snapshot.floor_usd,
    board_size: board.length,
    watchlist_size: snapshot.watchlist.length,
    global_multiple: globalMultiple,
    min_sample: MIN_SAMPLE,
    median_age_years: medianAge,
    total_implied_usd: board.reduce((n, r) => n + r.implied_value_usd, 0),
    category_multiples: categoryMultiples,
    rows: board,
    fit,
    evidence,
    accounting,
    assumptions: {
      deposit_usd: DEPOSIT_USD,
      drop_pool_pct: DROP_POOL_PCT,
      farming_pool_pct: FARMING_POOL_PCT,
      gas_usd: GAS_USD,
      gas_default_usd: GAS_DEFAULT_USD,
      verdict_farm_net_usd: VERDICT_FARM_NET_USD,
      verdict_farm_per_hour_usd: VERDICT_FARM_PER_HOUR_USD,
      verdict_skip_net_usd: VERDICT_SKIP_NET_USD,
      odds_prior_weight: ODDS_PRIOR_WEIGHT,
      tbill_rate: TBILL_RATE,
      tbill_as_of: TBILL_AS_OF,
      tbill_hold_days: TBILL_HOLD_DAYS,
      bootstrap_draws: BOOTSTRAP_DRAWS,
      bootstrap_seed: BOOTSTRAP_SEED,
    },
    ablation,
    odds_ablation: oddsAblation,
    calibration,
    term_ranges: termRanges,
  };
  return { board, radar };
}

/** The gate's own rules, checked before writing: null when the board is valid. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  if (board.length < 100 || board.length > 4000) {
    return `board holds ${board.length} rows, the gate wants 100 to 4000`;
  }
  const slugs = new Set(snapshot.protocols.map((p) => p.slug));
  const bySlug = new Map(snapshot.protocols.map((p) => [p.slug, p]));
  const seenRanks = new Set<number>();
  let previous = Infinity;
  for (const row of board) {
    if (!slugs.has(row.slug)) return `row names ${row.slug}, not a protocol in the snapshot`;
    if (!row.name || row.name.trim().length === 0) return `row ${row.slug} has no name`;
    if (!Number.isInteger(row.rank) || row.rank < 1) return `row ${row.slug} has a bad rank`;
    if (seenRanks.has(row.rank)) return `rank ${row.rank} appears twice`;
    seenRanks.add(row.rank);
    if (!Number.isInteger(row.implied_value_usd) || row.implied_value_usd < 1 || row.implied_value_usd > 1e14) {
      return `row ${row.slug} has a bad implied value`;
    }
    if (row.implied_value_usd > previous) return `implied value rises at rank ${row.rank}`;
    previous = row.implied_value_usd;
    if (!Array.isArray(row.farm_steps) || row.farm_steps.length < 3 || row.farm_steps.length > 12) {
      return `row ${row.slug} holds ${row.farm_steps.length} farm steps, the gate wants 3 to 12`;
    }
    for (const step of row.farm_steps) {
      const len = step.trim().length;
      if (len < 20 || len > 600) return `row ${row.slug} has a farm step of ${len} characters`;
    }
    // v2: every row must record no token under the strict rule.
    const proto = bySlug.get(row.slug)!;
    if (recordsToken(proto)) return `row ${row.slug} records a token (gecko/symbol/mcap)`;
    if (!(row.token_odds > 0 && row.token_odds <= 1)) return `row ${row.slug} has odds ${row.token_odds}`;
    if (!Number.isInteger(row.if_launches_usd) || row.if_launches_usd < 1) return `row ${row.slug} has a bad if-launches value`;
    if (row.if_launches_usd < row.implied_value_usd) return `row ${row.slug}: if-launches below implied value`;
    if (!(row.range_lo_usd >= 1 && row.range_lo_usd <= row.implied_value_usd && row.implied_value_usd <= row.range_hi_usd)) {
      return `row ${row.slug} has a range that does not bracket its value`;
    }
    if (!(row.range_p10_usd >= 1 && row.range_p10_usd <= row.range_lo_usd && row.range_hi_usd <= row.range_p90_usd)) {
      return `row ${row.slug} has a P10–P90 range that does not bracket its P25–P75 range`;
    }
    if (row.verdict !== 'FARM' && row.verdict !== 'MARGINAL' && row.verdict !== 'SKIP') {
      return `row ${row.slug} has verdict ${row.verdict}`;
    }
    if (!Number.isFinite(row.net_usd) || !Number.isFinite(row.net_per_hour_usd)) {
      return `row ${row.slug} has a non-finite farm net`;
    }
    if (!Array.isArray(row.peers) || row.peers.length !== 5) return `row ${row.slug} holds ${row.peers.length} peers, want 5`;
    if (
      !Number.isInteger(row.rank_lo) ||
      !Number.isInteger(row.rank_hi) ||
      row.rank_lo < 1 ||
      row.rank_lo > row.rank ||
      row.rank > row.rank_hi ||
      row.rank_hi > board.length
    ) {
      return `row ${row.slug} has a rank range ${row.rank_lo}–${row.rank_hi} that does not bracket rank ${row.rank}`;
    }
    if (!Number.isFinite(row.econ.tbill_usd) || row.econ.tbill_usd < 0) {
      return `row ${row.slug} has a bad T-bill figure`;
    }
  }
  for (let r = 1; r <= board.length; r++) {
    if (!seenRanks.has(r)) return `rank ${r} is missing`;
  }
  if (board.length > 1 && board.every((r) => r.implied_value_usd === board[0]!.implied_value_usd)) {
    return 'every implied value is the same: the board ranks nothing';
  }
  const boardSlugs = new Set(board.map((r) => r.slug));
  for (const slug of snapshot.watchlist) {
    if (!boardSlugs.has(slug)) return `watchlist slug ${slug} is missing from the board`;
  }
  return null;
}

/** The dashboard's data as one compact script: window.TOKEN_RADAR = {...}; */
export function dataScript(radar: RadarData): string {
  return `window.TOKEN_RADAR=${JSON.stringify(radar)};\n`;
}
