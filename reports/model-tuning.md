# Model tuning report — 2026-08-12

- Trades analyzed: 68 of 69 (fully valued)
- Median balance: 1.835 (1.0 = model matches market)
- Star-side median: 1.8344444444444443 · Prospect-package median: 0.9107142857142857
- Hot Stove: 6.4/10 (Hot) — 51 trades, 919.2 value pts in last 14d

## Suggestions
- Market trades landing 84% lopsided by our values — consider LOWERING sv.tv.prospectAnchors or RAISING sv.tv.wSur (buyers' MLB pieces may be undervalued).

Knobs live in config.json under sv.tv (mirror any change in Code.gs).
