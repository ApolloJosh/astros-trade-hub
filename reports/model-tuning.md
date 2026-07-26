# Model tuning report — 2026-07-26

- Trades analyzed: 16 of 16 (fully valued)
- Median balance: 1.955 (1.0 = model matches market)
- Star-side median: 1.9530346820809248 · Prospect-package median: 4.21
- Hot Stove: 1.4/10 (Cold) — 5 trades, 23.1 value pts in last 14d

## Suggestions
- Market trades landing 96% lopsided by our values — consider LOWERING sv.tv.prospectAnchors or RAISING sv.tv.wSur (buyers' MLB pieces may be undervalued).
- Prospect-heavy packages exchange at 4.21x — adjust sv.tv.prospectAnchors DOWN.

Knobs live in config.json under sv.tv (mirror any change in Code.gs).
