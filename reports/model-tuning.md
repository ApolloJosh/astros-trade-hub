# Model tuning report — 2026-08-02

- Trades analyzed: 28 of 28 (fully valued)
- Median balance: 1.815 (1.0 = model matches market)
- Star-side median: 1.8183945284377252 · Prospect-package median: 3.6363636363636362
- Hot Stove: 9.7/10 (Inferno) — 15 trades, 271.5 value pts in last 14d

## Suggestions
- Market trades landing 82% lopsided by our values — consider LOWERING sv.tv.prospectAnchors or RAISING sv.tv.wSur (buyers' MLB pieces may be undervalued).
- Prospect-heavy packages exchange at 3.6363636363636362x — adjust sv.tv.prospectAnchors DOWN.

Knobs live in config.json under sv.tv (mirror any change in Code.gs).
