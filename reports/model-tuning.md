# Model tuning report — 2026-08-01

- Trades analyzed: 23 of 23 (fully valued)
- Median balance: 2 (1.0 = model matches market)
- Star-side median: 2 · Prospect-package median: 4.825
- Hot Stove: 3/10 (Warming) — 10 trades, 81.5 value pts in last 14d

## Suggestions
- Market trades landing 100% lopsided by our values — consider LOWERING sv.tv.prospectAnchors or RAISING sv.tv.wSur (buyers' MLB pieces may be undervalued).
- Prospect-heavy packages exchange at 4.825x — adjust sv.tv.prospectAnchors DOWN.

Knobs live in config.json under sv.tv (mirror any change in Code.gs).
