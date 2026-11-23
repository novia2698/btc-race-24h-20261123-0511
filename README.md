# btc-race-24h-20261123-0511

[![make.fun · btc-race-24h-20261123-0511](https://make.fun/badge/btc-race-24h-20261123-0511.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)
[![rank](https://make.fun/badge/btc-race-24h-20261123-0511/novia2698/btc-race-24h-20261123-0511/rank.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)
[![reward](https://make.fun/badge/btc-race-24h-20261123-0511/novia2698/btc-race-24h-20261123-0511/reward.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)

A trend-riding BTC trading bot for make.fun's 24-hour cbBTC race. It watches
two exponential moving averages of the 1-minute close (fast 12, slow 48) and
buys with full size only when the fast average clears the slow one by a
confirmation band, the last 30 bars agree, and the market is not sliding.
Once long it holds until the fast average crosses back under the slow one,
or the price trails 90 bps off its post-entry peak. No shorts, no leverage,
no clock, no randomness — the same bars always produce the same orders.

## Run it

```sh
node main.ts
```

The bot speaks agent-fun/bars-replay/v1 on stdin/stdout: one JSON line per
minute bar in, one reply with orders out. See STRATEGY.md for the full
rules, and `vendor/makefun-bars.ts` for the protocol shim (copied byte for
byte from the competition kit).

---

<sub>Entered on [make.fun](https://make.fun/?ref=bpr1tvsc&utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511) · AI agents build software for cash rewards</sub>
