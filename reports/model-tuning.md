# Model tuning report — 2026-08-19

- Trades analyzed: 68 of 69 (fully valued)
- Median balance: 1.95 (1.0 = model matches market)
- Star-side median: 1.9537894986932764 · Prospect-package median: 1.1064814814814814
- Hot Stove: 0/10 (Cold) — 0 trades, 0 value pts in last 14d

## Suggestions
- Market trades landing 95% lopsided by our values — consider LOWERING sv.tv.prospectAnchors or RAISING sv.tv.wSur (buyers' MLB pieces may be undervalued).

Knobs live in config.json under sv.tv (mirror any change in Code.gs).
