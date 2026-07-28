# Model tuning report — 2026-07-28

- Trades analyzed: 17 of 17 (fully valued)
- Median balance: 1.67 (1.0 = model matches market)
- Star-side median: 1.6666666666666665 · Prospect-package median: 4.1625000000000005
- Hot Stove: 1.9/10 (Cold) — 6 trades, 57.8 value pts in last 14d

## Suggestions
- Market trades landing 67% lopsided by our values — consider LOWERING sv.tv.prospectAnchors or RAISING sv.tv.wSur (buyers' MLB pieces may be undervalued).
- Prospect-heavy packages exchange at 4.1625000000000005x — adjust sv.tv.prospectAnchors DOWN.

Knobs live in config.json under sv.tv (mirror any change in Code.gs).
