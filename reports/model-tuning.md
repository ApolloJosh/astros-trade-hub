# Model tuning report — 2026-07-30

- Trades analyzed: 18 of 18 (fully valued)
- Median balance: 2.04 (1.0 = model matches market)
- Star-side median: 2.0402823920265782 · Prospect-package median: 4.015384615384615
- Hot Stove: 1.9/10 (Cold) — 6 trades, 56.9 value pts in last 14d

## Suggestions
- Market trades landing 104% lopsided by our values — consider LOWERING sv.tv.prospectAnchors or RAISING sv.tv.wSur (buyers' MLB pieces may be undervalued).
- Prospect-heavy packages exchange at 4.015384615384615x — adjust sv.tv.prospectAnchors DOWN.

Knobs live in config.json under sv.tv (mirror any change in Code.gs).
