# Model tuning report — 2026-07-21

- Trades analyzed: 14 of 14 (fully valued)
- Median balance: 4.8100000000000005 (1.0 = model matches market)
- Star-side median: 4.807692307692308 · Prospect-package median: 12.1
- Hot Stove: 1.5/10 (Cold) — 5 trades, 38 value pts in last 14d

## Suggestions
- Market trades landing 381% lopsided by our values — consider LOWERING sv.tv.prospectAnchors or RAISING sv.tv.wSur (buyers' MLB pieces may be undervalued).
- Prospect-heavy packages exchange at 12.1x — adjust sv.tv.prospectAnchors DOWN.

Knobs live in config.json under sv.tv (mirror any change in Code.gs).
