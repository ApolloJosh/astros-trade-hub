# Model tuning report — 2026-08-01

- Trades analyzed: 22 of 22 (fully valued)
- Median balance: 1.875 (1.0 = model matches market)
- Star-side median: 1.8763736263736264 · Prospect-package median: 6.2
- Hot Stove: 2.7/10 (Warming) — 9 trades, 72.2 value pts in last 14d

## Suggestions
- Market trades landing 88% lopsided by our values — consider LOWERING sv.tv.prospectAnchors or RAISING sv.tv.wSur (buyers' MLB pieces may be undervalued).
- Prospect-heavy packages exchange at 6.2x — adjust sv.tv.prospectAnchors DOWN.

Knobs live in config.json under sv.tv (mirror any change in Code.gs).
