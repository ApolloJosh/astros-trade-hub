# Model tuning report — 2026-07-21

- Trades analyzed: 14 of 14 (fully valued)
- Median balance: 1.6949999999999998 (1.0 = model matches market)
- Star-side median: 1.695692883895131 · Prospect-package median: 4.322222222222222
- Hot Stove: 1.3/10 (Cold) — 5 trades, 13.4 value pts in last 14d

## Suggestions
- Market trades landing 69% lopsided by our values — consider LOWERING sv.tv.prospectAnchors or RAISING sv.tv.wSur (buyers' MLB pieces may be undervalued).
- Prospect-heavy packages exchange at 4.322222222222222x — adjust sv.tv.prospectAnchors DOWN.

Knobs live in config.json under sv.tv (mirror any change in Code.gs).
