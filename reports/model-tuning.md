# Model tuning report — 2026-11-13

- Trades analyzed: 74 of 74 (fully valued)
- Median balance: 1.96 (1.0 = model matches market)
- Star-side median: 1.9593984962406017 · Prospect-package median: 1.3820224719101124
- Hot Stove: 0.3/10 (Cold) — 3 trades, 6.5 value pts in last 14d

## Suggestions
- Market trades landing 96% lopsided by our values — consider LOWERING sv.tv.prospectAnchors or RAISING sv.tv.wSur (buyers' MLB pieces may be undervalued).
- Prospect-heavy packages exchange at 1.3820224719101124x — adjust sv.tv.prospectAnchors DOWN.

Knobs live in config.json under sv.tv (mirror any change in Code.gs).
