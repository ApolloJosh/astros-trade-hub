# Model tuning report — 2026-07-30

- Trades analyzed: 19 of 19 (fully valued)
- Median balance: 1.85 (1.0 = model matches market)
- Star-side median: 1.846153846153846 · Prospect-package median: 4.0346153846153845
- Hot Stove: 2.1/10 (Warming) — 7 trades, 59.3 value pts in last 14d

## Suggestions
- Market trades landing 85% lopsided by our values — consider LOWERING sv.tv.prospectAnchors or RAISING sv.tv.wSur (buyers' MLB pieces may be undervalued).
- Prospect-heavy packages exchange at 4.0346153846153845x — adjust sv.tv.prospectAnchors DOWN.

Knobs live in config.json under sv.tv (mirror any change in Code.gs).
