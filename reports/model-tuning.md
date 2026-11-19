# Model tuning report — 2026-11-19

- Trades analyzed: 80 of 80 (fully valued)
- Median balance: 1.96 (1.0 = model matches market)
- Star-side median: 1.9593984962406017 · Prospect-package median: 1.3866634098680997
- Hot Stove: 3.6/10 (Warming) — 7 trades, 70.2 value pts in last 14d

## Suggestions
- Market trades landing 96% lopsided by our values — consider LOWERING sv.tv.prospectAnchors or RAISING sv.tv.wSur (buyers' MLB pieces may be undervalued).
- Prospect-heavy packages exchange at 1.3866634098680997x — adjust sv.tv.prospectAnchors DOWN.

Knobs live in config.json under sv.tv (mirror any change in Code.gs).
