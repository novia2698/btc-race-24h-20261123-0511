// Trend rider for cbBTC on 1-minute bars (agent-fun/bars-replay/v1).
//
// Idea: ride medium-term momentum and cut losers fast. The bot watches two
// exponential moving averages of the close (fast 12 bars, slow 48 bars) and
// only buys when the fast average sits clearly above the slow one, the last
// 30 bars agree with the direction, and the market is not in a steep
// four-hour slide. Once long, it holds until the fast average crosses back
// under the slow one or the price pulls back 90 bps from the best close
// seen since entry. Every trade is a full-size round trip (about 26 bps in
// fees, slippage and impact), so entries demand a confirmed trend, not a
// single noisy bar, and a short cooling-off period after each exit keeps
// the bot from churning on whipsaws.
//
// Only the standard library and the vendored kit shim are used. No clock,
// no environment, no randomness: the same bars always produce the same
// orders, so the two graded executions agree byte for byte.

import { runBars } from './vendor/makefun-bars.ts';
import type { BarsState, Batch } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';

// Strategy knobs, all in basis points unless noted.
const FAST_SPAN = 12;
const SLOW_SPAN = 48;
const ENTRY_GAP_BPS = 6; // fast must clear slow by this much to buy
const TRAIL_BPS = 90; // sell when close falls this far below the peak since entry
const HARD_STOP_BPS = 150; // sell when close falls this far below entry cost
const OVEREXTENDED_BPS = 200; // do not chase a close this far above the slow average
const MIN_HISTORY_BARS = 60; // bars of closes before the first entry
const COOLDOWN_BARS = 10; // bars to wait after an exit before re-entering
const MIN_BARS_LEFT = 40; // stop opening new trades this close to the end
const SHORT_WINDOW = 30; // bars for the short momentum check
const REGIME_WINDOW = 240; // bars for the four-hour regime check
const REGIME_FLOOR_BPS = -100; // skip entries in a steep four-hour slide
const VOL_WINDOW = 60; // bars for the volatility floor
const VOL_FLOOR_BPS = 3; // skip entries when 1-minute moves average less than this
const BUY_FRACTION_NUM = 99n; // spend 99% of cash, keeping a hair for fees
const BUY_FRACTION_DEN = 100n;
const MAX_SLIPPAGE_BPS = 200; // guard against gap opens at the next bar

interface Ruler {
  closes: number[];
  fast: number | null;
  slow: number | null;
  peakSinceEntry: number | null;
  entryCost: number | null;
  cooldownUntilSeq: number;
  trades: number;
}

function ema(prev: number | null, price: number, span: number): number {
  const k = 2 / (span + 1);
  return prev === null ? price : prev + k * (price - prev);
}

function makeRuler(): Ruler {
  return {
    closes: [],
    fast: null,
    slow: null,
    peakSinceEntry: null,
    entryCost: null,
    cooldownUntilSeq: -1,
    trades: 0,
  };
}

function meanAbsReturn(closes: number[], window: number): number {
  const n = closes.length;
  const start = Math.max(1, n - window);
  let sum = 0;
  let count = 0;
  for (let i = start; i < n; i++) {
    sum += Math.abs(closes[i] / closes[i - 1] - 1);
    count++;
  }
  return count === 0 ? 0 : (sum / count) * 10000;
}

function windowReturnBps(closes: number[], window: number): number {
  const n = closes.length;
  if (n <= window) return 0;
  return (closes[n - 1] / closes[n - 1 - window] - 1) * 10000;
}

await runBars({
  onBatch(state: BarsState, batch: Batch) {
    const ruler: Ruler = (state as unknown as { __ruler?: Ruler }).__ruler ?? makeRuler();
    (state as unknown as { __ruler?: Ruler }).__ruler = ruler;

    const bar = batch.bars.find((b) => b.symbol === SYMBOL);
    if (bar === undefined) return [];
    const close = Number(bar.c) / 100000; // price_scale 5: raw units to USDC

    ruler.closes.push(close);
    ruler.fast = ema(ruler.fast, close, FAST_SPAN);
    ruler.slow = ema(ruler.slow, close, SLOW_SPAN);

    const held = state.positions.get(SYMBOL);
    const qty = held === undefined ? 0n : held.qty;
    const inPosition = qty > 0n;

    if (inPosition) {
      if (ruler.peakSinceEntry === null || close > ruler.peakSinceEntry) {
        ruler.peakSinceEntry = close;
      }
      const peak = ruler.peakSinceEntry;
      const cost = ruler.entryCost;
      const crossedBack = ruler.fast !== null && ruler.slow !== null && ruler.fast < ruler.slow;
      const trailedOff = peak !== null && (peak - close) / peak * 10000 >= TRAIL_BPS;
      const stoppedOut = cost !== null && (cost - close) / cost * 10000 >= HARD_STOP_BPS;
      if (crossedBack || trailedOff || stoppedOut) {
        const reason = crossedBack ? 'cross-back' : trailedOff ? 'trailing-stop' : 'hard-stop';
        console.error(`seq ${batch.seq}: sell ${qty} @ ${close.toFixed(2)} (${reason})`);
        ruler.peakSinceEntry = null;
        ruler.entryCost = null;
        ruler.cooldownUntilSeq = batch.seq + COOLDOWN_BARS;
        ruler.trades++;
        return [{ side: 'sell', symbol: SYMBOL, qty, max_slippage_bps: MAX_SLIPPAGE_BPS }];
      }
      return [];
    }

    // Flat: look for an entry.
    if (state.warmingUp) return [];
    if (ruler.closes.length < MIN_HISTORY_BARS) return [];
    if (batch.seq >= 1440 - MIN_BARS_LEFT) return [];
    if (batch.seq <= ruler.cooldownUntilSeq) return [];
    if (ruler.fast === null || ruler.slow === null) return [];

    const gapBps = (ruler.fast - ruler.slow) / ruler.slow * 10000;
    const overextendedBps = (close - ruler.slow) / ruler.slow * 10000;
    const shortBps = windowReturnBps(ruler.closes, SHORT_WINDOW);
    const regimeBps = windowReturnBps(ruler.closes, REGIME_WINDOW);
    const volBps = meanAbsReturn(ruler.closes, VOL_WINDOW);

    const trendOk = gapBps >= ENTRY_GAP_BPS;
    const momentumOk = shortBps > 0;
    const regimeOk = regimeBps >= REGIME_FLOOR_BPS;
    const notChasing = overextendedBps <= OVEREXTENDED_BPS;
    const liquidEnough = volBps >= VOL_FLOOR_BPS;

    if (trendOk && momentumOk && regimeOk && notChasing && liquidEnough) {
      const cash = state.cash;
      if (cash <= 0n) return [];
      const notional = (cash * BUY_FRACTION_NUM) / BUY_FRACTION_DEN;
      console.error(`seq ${batch.seq}: buy ${notional} @ ${close.toFixed(2)} (gap ${gapBps.toFixed(1)}bps, 30b ${shortBps.toFixed(1)}bps)`);
      ruler.entryCost = close;
      ruler.peakSinceEntry = close;
      ruler.trades++;
      return [{ side: 'buy', symbol: SYMBOL, notional_quote_units: notional, max_slippage_bps: MAX_SLIPPAGE_BPS }];
    }
    return [];
  },
});
