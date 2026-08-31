# Model tuning report — 2026-08-31

- Trades analyzed: 68 of 69 (fully valued)
- Median balance: 2.31 (1.0 = model matches market)
- Star-side median: 2.30923947203017 · Prospect-package median: 1.1621621621621623
- Hot Stove: 0/10 (Cold) — 0 trades, 0 value pts in last 14d

## Suggestions
- Market trades landing 131% lopsided by our values — consider LOWERING sv.tv.prospectAnchors or RAISING sv.tv.wSur (buyers' MLB pieces may be undervalued).

Knobs live in config.json under sv.tv (mirror any change in Code.gs).
