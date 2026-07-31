# Model tuning report — 2026-07-31

- Trades analyzed: 20 of 20 (fully valued)
- Median balance: 2.125 (1.0 = model matches market)
- Star-side median: 2.123076923076923 · Prospect-package median: 4.769230769230769
- Hot Stove: 2.4/10 (Warming) — 8 trades, 61.2 value pts in last 14d

## Suggestions
- Market trades landing 113% lopsided by our values — consider LOWERING sv.tv.prospectAnchors or RAISING sv.tv.wSur (buyers' MLB pieces may be undervalued).
- Prospect-heavy packages exchange at 4.769230769230769x — adjust sv.tv.prospectAnchors DOWN.

Knobs live in config.json under sv.tv (mirror any change in Code.gs).
