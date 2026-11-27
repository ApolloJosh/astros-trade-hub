# Model tuning report — 2026-11-27

- Trades analyzed: 85 of 85 (fully valued)
- Median balance: 1.98 (1.0 = model matches market)
- Star-side median: 1.9782608695652175 · Prospect-package median: 1.3820224719101124
- Hot Stove: 1.3/10 (Cold) — 11 trades, 90.6 value pts in last 14d

## Suggestions
- Market trades landing 98% lopsided by our values — consider LOWERING sv.tv.prospectAnchors or RAISING sv.tv.wSur (buyers' MLB pieces may be undervalued).
- Prospect-heavy packages exchange at 1.3820224719101124x — adjust sv.tv.prospectAnchors DOWN.

Knobs live in config.json under sv.tv (mirror any change in Code.gs).
