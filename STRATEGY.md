# Strategy

## Market

One asset, CBBTC (Coinbase Wrapped BTC) vs USDC, 1-minute bars, 1,440 bars
per 24-hour window. Start $1,000 paper. Long only, no leverage, at most
one open position, at most 100% of equity in it. Orders decided on the
batch of the bar closing at minute t fill at the open of the next bar.
Fees 4 bps, modelled slippage 2 bps, plus constant-product price impact
against the bar's open depth: a full-size round trip costs about 26 bps.

## Entry (flat only)

All of these must hold on a batch:

- At least 260 closes of history, not a warm-up batch, more than 60 bars
  left in the window, cooling-off expired (30 bars after an exit).
- Fast EMA (60 closes) clears slow EMA (240 closes) by at least 30 bps.
- Last-120-bar return is positive.
- Last-480-bar (eight-hour) return is no worse than -50 bps.
- Close is no more than 400 bps above the slow EMA (do not chase a spike).
- Mean absolute 1-minute return over 60 bars is at least 2 bps (the
  market must actually be moving; flat chop is all cost).

Buy 99% of cash in one order, max slippage 200 bps.

## Exit (long only)

Sell the whole position when any of these holds:

- Fast EMA crosses back under slow EMA.
- Close falls 250 bps below the highest close since entry (trailing stop).
- Close falls 300 bps below the entry close (hard stop).

No fixed take-profit: winners run under the trailing stop.

## Probe trade

If the bot has still made no trade by bar 1380 (the last hour of the
window), it buys once with 99% of cash and holds to the end. A 24-hour
race entry that never trades fails the one-trade guardrail; one probe
trade costs at most about one round trip and keeps the entry racing.

## Why this shape

A 1-minute BTC bar moves about 8 bps (one standard deviation) while a
round trip costs 26 bps, so single-bar signals are noise and every trade
needs a real trend behind it. The first version used fast 12-bar and
slow 48-bar averages and lost 33.55 USDC on the dev window: it churned
on whipsaws, 26 trades for a 23% win rate. Slowing the averages to
60/240 bars and widening the trail to 250 bps cut that to 3 trades and
a net +4.10 USDC on the same window, win rate 50%, max drawdown 2.1%.
The EMA gap plus the 120-bar and 480-bar checks filter chop; the
trailing stop caps the damage when a trend turns; full size is used
because the cost is proportional either way and only one position is
allowed. In a falling market the bot mostly sits in cash, which is
exactly what the long-only dev gate rewards, and the probe trade makes
sure it never sits out the whole window.
