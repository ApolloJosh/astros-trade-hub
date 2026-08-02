# Model tuning report — 2026-08-02

- Trades analyzed: 25 of 25 (fully valued)
- Median balance: 1.97 (1.0 = model matches market)
- Star-side median: 1.9687499999999998 · Prospect-package median: 4.25
- Hot Stove: 6.3/10 (Hot) — 12 trades, 110.5 value pts in last 14d

## Suggestions
- Market trades landing 97% lopsided by our values — consider LOWERING sv.tv.prospectAnchors or RAISING sv.tv.wSur (buyers' MLB pieces may be undervalued).
- Prospect-heavy packages exchange at 4.25x — adjust sv.tv.prospectAnchors DOWN.

Knobs live in config.json under sv.tv (mirror any change in Code.gs).
