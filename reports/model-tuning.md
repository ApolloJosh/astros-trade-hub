# Model tuning report — 2026-09-22

- Trades analyzed: 69 of 70 (fully valued)
- Median balance: 1.9 (1.0 = model matches market)
- Star-side median: 1.8958333333333333 · Prospect-package median: 1.2789290267743305
- Hot Stove: 0/10 (Cold) — 0 trades, 0 value pts in last 14d

## Suggestions
- Market trades landing 90% lopsided by our values — consider LOWERING sv.tv.prospectAnchors or RAISING sv.tv.wSur (buyers' MLB pieces may be undervalued).
- Prospect-heavy packages exchange at 1.2789290267743305x — adjust sv.tv.prospectAnchors DOWN.

Knobs live in config.json under sv.tv (mirror any change in Code.gs).
