# Model tuning report — 2026-10-30

- Trades analyzed: 71 of 71 (fully valued)
- Median balance: 1.94 (1.0 = model matches market)
- Star-side median: 1.9444444444444444 · Prospect-package median: 1.3820224719101124
- Hot Stove: 0.6/10 (Cold) — 1 trades, 1.9 value pts in last 14d

## Suggestions
- Market trades landing 94% lopsided by our values — consider LOWERING sv.tv.prospectAnchors or RAISING sv.tv.wSur (buyers' MLB pieces may be undervalued).
- Prospect-heavy packages exchange at 1.3820224719101124x — adjust sv.tv.prospectAnchors DOWN.

Knobs live in config.json under sv.tv (mirror any change in Code.gs).
