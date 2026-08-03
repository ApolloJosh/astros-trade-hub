# Model tuning report — 2026-08-03

- Trades analyzed: 37 of 38 (fully valued)
- Median balance: 1.83 (1.0 = model matches market)
- Star-side median: 1.8333333333333335 · Prospect-package median: 0.9486301369863014
- Hot Stove: 10/10 (Inferno) — 24 trades, 423.9 value pts in last 14d

## Suggestions
- Market trades landing 83% lopsided by our values — consider LOWERING sv.tv.prospectAnchors or RAISING sv.tv.wSur (buyers' MLB pieces may be undervalued).

Knobs live in config.json under sv.tv (mirror any change in Code.gs).
