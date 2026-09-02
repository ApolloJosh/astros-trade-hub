# Model tuning report — 2026-09-02

- Trades analyzed: 69 of 70 (fully valued)
- Median balance: 2.18 (1.0 = model matches market)
- Star-side median: 2.1818181818181817 · Prospect-package median: 1.0522648083623694
- Hot Stove: 0.6/10 (Cold) — 1 trades, 1 value pts in last 14d

## Suggestions
- Market trades landing 118% lopsided by our values — consider LOWERING sv.tv.prospectAnchors or RAISING sv.tv.wSur (buyers' MLB pieces may be undervalued).

Knobs live in config.json under sv.tv (mirror any change in Code.gs).
