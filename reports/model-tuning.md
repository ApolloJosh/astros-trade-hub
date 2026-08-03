# Model tuning report — 2026-08-03

- Trades analyzed: 29 of 29 (fully valued)
- Median balance: 1.81 (1.0 = model matches market)
- Star-side median: 1.8051948051948052 · Prospect-package median: 1.50625
- Hot Stove: 10/10 (Inferno) — 15 trades, 293.2 value pts in last 14d

## Suggestions
- Market trades landing 81% lopsided by our values — consider LOWERING sv.tv.prospectAnchors or RAISING sv.tv.wSur (buyers' MLB pieces may be undervalued).
- Prospect-heavy packages exchange at 1.50625x — adjust sv.tv.prospectAnchors DOWN.

Knobs live in config.json under sv.tv (mirror any change in Code.gs).
