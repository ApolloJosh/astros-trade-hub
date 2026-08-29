# Model tuning report — 2026-08-29

- Trades analyzed: 68 of 69 (fully valued)
- Median balance: 2.2750000000000004 (1.0 = model matches market)
- Star-side median: 2.274490516545601 · Prospect-package median: 1.015267175572519
- Hot Stove: 0/10 (Cold) — 0 trades, 0 value pts in last 14d

## Suggestions
- Market trades landing 128% lopsided by our values — consider LOWERING sv.tv.prospectAnchors or RAISING sv.tv.wSur (buyers' MLB pieces may be undervalued).

Knobs live in config.json under sv.tv (mirror any change in Code.gs).
