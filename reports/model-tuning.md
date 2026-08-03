# Model tuning report — 2026-08-03

- Trades analyzed: 40 of 40 (fully valued)
- Median balance: 1.8450000000000002 (1.0 = model matches market)
- Star-side median: 1.8484848484848484 · Prospect-package median: 0.9486301369863014
- Hot Stove: 10/10 (Inferno) — 26 trades, 440.9 value pts in last 14d

## Suggestions
- Market trades landing 85% lopsided by our values — consider LOWERING sv.tv.prospectAnchors or RAISING sv.tv.wSur (buyers' MLB pieces may be undervalued).

Knobs live in config.json under sv.tv (mirror any change in Code.gs).
