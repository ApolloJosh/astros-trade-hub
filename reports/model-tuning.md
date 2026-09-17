# Model tuning report — 2026-09-17

- Trades analyzed: 69 of 70 (fully valued)
- Median balance: 1.86 (1.0 = model matches market)
- Star-side median: 1.864864864864865 · Prospect-package median: 1.2425925925925925
- Hot Stove: 0/10 (Cold) — 0 trades, 0 value pts in last 14d

## Suggestions
- Market trades landing 86% lopsided by our values — consider LOWERING sv.tv.prospectAnchors or RAISING sv.tv.wSur (buyers' MLB pieces may be undervalued).

Knobs live in config.json under sv.tv (mirror any change in Code.gs).
