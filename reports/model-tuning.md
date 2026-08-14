# Model tuning report — 2026-08-14

- Trades analyzed: 68 of 69 (fully valued)
- Median balance: 1.92 (1.0 = model matches market)
- Star-side median: 1.9221311475409837 · Prospect-package median: 0.9815668202764978
- Hot Stove: 4/10 (Warming) — 49 trades, 922.1 value pts in last 14d

## Suggestions
- Market trades landing 92% lopsided by our values — consider LOWERING sv.tv.prospectAnchors or RAISING sv.tv.wSur (buyers' MLB pieces may be undervalued).

Knobs live in config.json under sv.tv (mirror any change in Code.gs).
