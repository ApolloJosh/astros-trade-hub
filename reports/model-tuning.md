# Model tuning report — 2026-07-21

- Trades analyzed: 9 of 14 (fully valued)
- Median balance: 4.29 (1.0 = model matches market)
- Star-side median: 4.285714285714286 · Prospect-package median: 10
- Hot Stove: 1.3/10 (Cold) — 5 trades, 8.3 value pts in last 14d

## Suggestions
- Market trades landing 329% lopsided by our values — consider LOWERING sv.tv.prospectAnchors or RAISING sv.tv.wSur (buyers' MLB pieces may be undervalued).
- Prospect-heavy packages exchange at 10x — adjust sv.tv.prospectAnchors DOWN.

Knobs live in config.json under sv.tv (mirror any change in Code.gs).
