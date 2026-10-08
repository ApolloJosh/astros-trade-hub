# Model tuning report — 2026-10-08

- Trades analyzed: 70 of 70 (fully valued)
- Median balance: 1.885 (1.0 = model matches market)
- Star-side median: 1.8884625831862012 · Prospect-package median: 1.3820224719101124
- Hot Stove: 0/10 (Cold) — 0 trades, 0 value pts in last 14d

## Suggestions
- Market trades landing 89% lopsided by our values — consider LOWERING sv.tv.prospectAnchors or RAISING sv.tv.wSur (buyers' MLB pieces may be undervalued).
- Prospect-heavy packages exchange at 1.3820224719101124x — adjust sv.tv.prospectAnchors DOWN.

Knobs live in config.json under sv.tv (mirror any change in Code.gs).
