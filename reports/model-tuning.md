# Model tuning report — 2026-08-03

- Trades analyzed: 55 of 56 (fully valued)
- Median balance: 1.84 (1.0 = model matches market)
- Star-side median: 1.8354430379746836 · Prospect-package median: 1.1476190476190478
- Hot Stove: 10/10 (Inferno) — 42 trades, 804.5 value pts in last 14d

## Suggestions
- Market trades landing 84% lopsided by our values — consider LOWERING sv.tv.prospectAnchors or RAISING sv.tv.wSur (buyers' MLB pieces may be undervalued).

Knobs live in config.json under sv.tv (mirror any change in Code.gs).
