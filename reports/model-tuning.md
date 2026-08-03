# Model tuning report — 2026-08-03

- Trades analyzed: 30 of 30 (fully valued)
- Median balance: 1.82 (1.0 = model matches market)
- Star-side median: 1.8192640692640694 · Prospect-package median: 1.50625
- Hot Stove: 10/10 (Inferno) — 16 trades, 295.3 value pts in last 14d

## Suggestions
- Market trades landing 82% lopsided by our values — consider LOWERING sv.tv.prospectAnchors or RAISING sv.tv.wSur (buyers' MLB pieces may be undervalued).
- Prospect-heavy packages exchange at 1.50625x — adjust sv.tv.prospectAnchors DOWN.

Knobs live in config.json under sv.tv (mirror any change in Code.gs).
