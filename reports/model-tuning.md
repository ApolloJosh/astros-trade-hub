# Model tuning report — 2026-07-26

- Trades analyzed: 16 of 16 (fully valued)
- Median balance: 1.71 (1.0 = model matches market)
- Star-side median: 1.7083333333333333 · Prospect-package median: 4.21
- Hot Stove: 1.6/10 (Cold) — 5 trades, 56.7 value pts in last 14d

## Suggestions
- Market trades landing 71% lopsided by our values — consider LOWERING sv.tv.prospectAnchors or RAISING sv.tv.wSur (buyers' MLB pieces may be undervalued).
- Prospect-heavy packages exchange at 4.21x — adjust sv.tv.prospectAnchors DOWN.

Knobs live in config.json under sv.tv (mirror any change in Code.gs).
