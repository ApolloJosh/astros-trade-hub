# Model tuning report — 2026-08-11

- Trades analyzed: 69 of 69 (fully valued)
- Median balance: 1.83 (1.0 = model matches market)
- Star-side median: 1.8333333333333335 · Prospect-package median: 1.0112626304115664
- Hot Stove: 8/10 (Inferno) — 52 trades, 900.7 value pts in last 14d

## Suggestions
- Market trades landing 83% lopsided by our values — consider LOWERING sv.tv.prospectAnchors or RAISING sv.tv.wSur (buyers' MLB pieces may be undervalued).

Knobs live in config.json under sv.tv (mirror any change in Code.gs).
