# Model tuning report — 2026-08-01

- Trades analyzed: 21 of 21 (fully valued)
- Median balance: 2.04 (1.0 = model matches market)
- Star-side median: 2.0384615384615383 · Prospect-package median: 6.2
- Hot Stove: 2.4/10 (Warming) — 8 trades, 63.4 value pts in last 14d

## Suggestions
- Market trades landing 104% lopsided by our values — consider LOWERING sv.tv.prospectAnchors or RAISING sv.tv.wSur (buyers' MLB pieces may be undervalued).
- Prospect-heavy packages exchange at 6.2x — adjust sv.tv.prospectAnchors DOWN.

Knobs live in config.json under sv.tv (mirror any change in Code.gs).
