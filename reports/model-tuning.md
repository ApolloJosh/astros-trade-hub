# Model tuning report — 2026-11-08

- Trades analyzed: 74 of 74 (fully valued)
- Median balance: 1.9449999999999998 (1.0 = model matches market)
- Star-side median: 1.945906432748538 · Prospect-package median: 1.3199999999999998
- Hot Stove: 1/10 (Cold) — 4 trades, 8.4 value pts in last 14d

## Suggestions
- Market trades landing 94% lopsided by our values — consider LOWERING sv.tv.prospectAnchors or RAISING sv.tv.wSur (buyers' MLB pieces may be undervalued).
- Prospect-heavy packages exchange at 1.3199999999999998x — adjust sv.tv.prospectAnchors DOWN.

Knobs live in config.json under sv.tv (mirror any change in Code.gs).
