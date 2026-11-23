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

- At least 60 closes of history, not a warm-up batch, more than 40 bars
  left in the window, cooling-off expired (10 bars after an exit).
- Fast EMA (12 closes) clears slow EMA (48 closes) by at least 6 bps.
- Last-30-bar return is positive.
- Last-240-bar (four-hour) return is no worse than -100 bps.
- Close is no more than 200 bps above the slow EMA (do not chase a spike).
- Mean absolute 1-minute return over 60 bars is at least 3 bps (the
  market must actually be moving; flat chop is all cost).

Buy 99% of cash in one order, max slippage 200 bps.

## Exit (long only)

Sell the whole position when any of these holds:

- Fast EMA crosses back under slow EMA.
- Close falls 90 bps below the highest close since entry (trailing stop).
- Close falls 150 bps below the entry close (hard stop).

No fixed take-profit: winners run under the trailing stop.

## Why this shape

A 1-minute BTC bar moves about 8 bps (one standard deviation) while a
round trip costs 26 bps, so single-bar signals are noise and every trade
needs a real trend behind it. The EMA gap plus the 30-bar and 240-bar
checks filter chop; the trailing stop caps the damage when a trend turns;
full size is used because the cost is proportional either way and only
one position is allowed. In a falling market the bot sits in cash, which
is exactly what the long-only dev gate rewards.
