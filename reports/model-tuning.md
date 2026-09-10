# Model tuning report — 2026-09-10

- Trades analyzed: 69 of 70 (fully valued)
- Median balance: 1.91 (1.0 = model matches market)
- Star-side median: 1.907046476761619 · Prospect-package median: 1.0072815533980581
- Hot Stove: 0.1/10 (Cold) — 1 trades, 1 value pts in last 14d

## Suggestions
- Market trades landing 91% lopsided by our values — consider LOWERING sv.tv.prospectAnchors or RAISING sv.tv.wSur (buyers' MLB pieces may be undervalued).

Knobs live in config.json under sv.tv (mirror any change in Code.gs).
