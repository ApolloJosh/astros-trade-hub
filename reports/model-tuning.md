# Model tuning report — 2026-11-18

- Trades analyzed: 79 of 79 (fully valued)
- Median balance: 1.95 (1.0 = model matches market)
- Star-side median: 1.9473684210526316 · Prospect-package median: 1.3866634098680997
- Hot Stove: 3.8/10 (Warming) — 6 trades, 68.3 value pts in last 14d

## Suggestions
- Market trades landing 95% lopsided by our values — consider LOWERING sv.tv.prospectAnchors or RAISING sv.tv.wSur (buyers' MLB pieces may be undervalued).
- Prospect-heavy packages exchange at 1.3866634098680997x — adjust sv.tv.prospectAnchors DOWN.

Knobs live in config.json under sv.tv (mirror any change in Code.gs).
