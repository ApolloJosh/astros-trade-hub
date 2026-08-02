# Model tuning report — 2026-08-02

- Trades analyzed: 27 of 27 (fully valued)
- Median balance: 1.83 (1.0 = model matches market)
- Star-side median: 1.8333333333333335 · Prospect-package median: 2.7777777777777777
- Hot Stove: 9/10 (Inferno) — 14 trades, 252.4 value pts in last 14d

## Suggestions
- Market trades landing 83% lopsided by our values — consider LOWERING sv.tv.prospectAnchors or RAISING sv.tv.wSur (buyers' MLB pieces may be undervalued).
- Prospect-heavy packages exchange at 2.7777777777777777x — adjust sv.tv.prospectAnchors DOWN.

Knobs live in config.json under sv.tv (mirror any change in Code.gs).
