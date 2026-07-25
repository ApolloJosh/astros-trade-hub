# Model tuning report — 2026-07-25

- Trades analyzed: 15 of 15 (fully valued)
- Median balance: 1.75 (1.0 = model matches market)
- Star-side median: 1.75 · Prospect-package median: 3.5143939393939396
- Hot Stove: 1.1/10 (Cold) — 4 trades, 9.2 value pts in last 14d

## Suggestions
- Market trades landing 75% lopsided by our values — consider LOWERING sv.tv.prospectAnchors or RAISING sv.tv.wSur (buyers' MLB pieces may be undervalued).
- Prospect-heavy packages exchange at 3.5143939393939396x — adjust sv.tv.prospectAnchors DOWN.

Knobs live in config.json under sv.tv (mirror any change in Code.gs).
