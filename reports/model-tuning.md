# Model tuning report — 2026-07-27

- Trades analyzed: 17 of 17 (fully valued)
- Median balance: 1.75 (1.0 = model matches market)
- Star-side median: 1.75 · Prospect-package median: 4.16
- Hot Stove: 1.9/10 (Cold) — 6 trades, 57.8 value pts in last 14d

## Suggestions
- Market trades landing 75% lopsided by our values — consider LOWERING sv.tv.prospectAnchors or RAISING sv.tv.wSur (buyers' MLB pieces may be undervalued).
- Prospect-heavy packages exchange at 4.16x — adjust sv.tv.prospectAnchors DOWN.

Knobs live in config.json under sv.tv (mirror any change in Code.gs).
