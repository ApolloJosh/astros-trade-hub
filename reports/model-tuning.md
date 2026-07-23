# Model tuning report — 2026-07-23

- Trades analyzed: 15 of 15 (fully valued)
- Median balance: 1.67 (1.0 = model matches market)
- Star-side median: 1.6666666666666665 · Prospect-package median: 5.083333333333334
- Hot Stove: 1.6/10 (Cold) — 6 trades, 15.6 value pts in last 14d

## Suggestions
- Market trades landing 67% lopsided by our values — consider LOWERING sv.tv.prospectAnchors or RAISING sv.tv.wSur (buyers' MLB pieces may be undervalued).
- Prospect-heavy packages exchange at 5.083333333333334x — adjust sv.tv.prospectAnchors DOWN.

Knobs live in config.json under sv.tv (mirror any change in Code.gs).
