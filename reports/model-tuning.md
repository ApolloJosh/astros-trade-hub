# Model tuning report — 2026-07-22

- Trades analyzed: 14 of 14 (fully valued)
- Median balance: 1.705 (1.0 = model matches market)
- Star-side median: 1.7020484171322159 · Prospect-package median: 4.423809523809524
- Hot Stove: 1.3/10 (Cold) — 5 trades, 13.4 value pts in last 14d

## Suggestions
- Market trades landing 71% lopsided by our values — consider LOWERING sv.tv.prospectAnchors or RAISING sv.tv.wSur (buyers' MLB pieces may be undervalued).
- Prospect-heavy packages exchange at 4.423809523809524x — adjust sv.tv.prospectAnchors DOWN.

Knobs live in config.json under sv.tv (mirror any change in Code.gs).
