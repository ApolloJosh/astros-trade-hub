# Model tuning report — 2026-08-02

- Trades analyzed: 26 of 26 (fully valued)
- Median balance: 1.8199999999999998 (1.0 = model matches market)
- Star-side median: 1.8177083333333333 · Prospect-package median: 3.693965517241379
- Hot Stove: 8.2/10 (Inferno) — 13 trades, 236.2 value pts in last 14d

## Suggestions
- Market trades landing 82% lopsided by our values — consider LOWERING sv.tv.prospectAnchors or RAISING sv.tv.wSur (buyers' MLB pieces may be undervalued).
- Prospect-heavy packages exchange at 3.693965517241379x — adjust sv.tv.prospectAnchors DOWN.

Knobs live in config.json under sv.tv (mirror any change in Code.gs).
