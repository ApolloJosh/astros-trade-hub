# Model tuning report — 2026-08-09

- Trades analyzed: 69 of 69 (fully valued)
- Median balance: 1.91 (1.0 = model matches market)
- Star-side median: 1.9062499999999998 · Prospect-package median: 1.0262626262626262
- Hot Stove: 10/10 (Inferno) — 52 trades, 907.6 value pts in last 14d

## Suggestions
- Market trades landing 91% lopsided by our values — consider LOWERING sv.tv.prospectAnchors or RAISING sv.tv.wSur (buyers' MLB pieces may be undervalued).

Knobs live in config.json under sv.tv (mirror any change in Code.gs).
