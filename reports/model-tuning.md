# Model tuning report — 2026-11-23

- Trades analyzed: 85 of 85 (fully valued)
- Median balance: 1.97 (1.0 = model matches market)
- Star-side median: 1.9714285714285715 · Prospect-package median: 1.3820224719101124
- Hot Stove: 3.2/10 (Warming) — 11 trades, 91.1 value pts in last 14d

## Suggestions
- Market trades landing 97% lopsided by our values — consider LOWERING sv.tv.prospectAnchors or RAISING sv.tv.wSur (buyers' MLB pieces may be undervalued).
- Prospect-heavy packages exchange at 1.3820224719101124x — adjust sv.tv.prospectAnchors DOWN.

Knobs live in config.json under sv.tv (mirror any change in Code.gs).
