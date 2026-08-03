# Model tuning report — 2026-08-03

- Trades analyzed: 28 of 28 (fully valued)
- Median balance: 1.815 (1.0 = model matches market)
- Star-side median: 1.8181818181818181 · Prospect-package median: 2.571306818181818
- Hot Stove: 9.8/10 (Inferno) — 14 trades, 269.8 value pts in last 14d

## Suggestions
- Market trades landing 82% lopsided by our values — consider LOWERING sv.tv.prospectAnchors or RAISING sv.tv.wSur (buyers' MLB pieces may be undervalued).
- Prospect-heavy packages exchange at 2.571306818181818x — adjust sv.tv.prospectAnchors DOWN.

Knobs live in config.json under sv.tv (mirror any change in Code.gs).
