# Model tuning report — 2026-09-07

- Trades analyzed: 69 of 70 (fully valued)
- Median balance: 1.96 (1.0 = model matches market)
- Star-side median: 1.9584615384615385 · Prospect-package median: 1.063613231552163
- Hot Stove: 0.2/10 (Cold) — 1 trades, 1 value pts in last 14d

## Suggestions
- Market trades landing 96% lopsided by our values — consider LOWERING sv.tv.prospectAnchors or RAISING sv.tv.wSur (buyers' MLB pieces may be undervalued).

Knobs live in config.json under sv.tv (mirror any change in Code.gs).
