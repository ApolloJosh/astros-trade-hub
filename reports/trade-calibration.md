# Historical trade calibration — 2026-07-20

Window: last 12 months · 146 trades found · 135 fully valued at time of trade.
Assumption: real trades are roughly balanced, so a healthy median is ~1.0-1.2.

- **TALENT-FOR-TALENT (real piece both sides — the deals that SHOULD be even):**
  **median 1.71 across 13 trades · 46% within 1.5x**
- Established-players-only: median 2.4400000000000004 across 12
- All trades (includes salary dumps & depth swaps, which are genuinely lopsided): median 1.85
- Trades our model calls near-fair (≤1.25x): 18%

## By archetype (each trade counted once, by its headliner)
- Rental headliner: n=48, median 1.5750000000000002
- Prospect headliner: n=47, median 2.14
- Controlled headliner (≥4y): n=19, median 2.87
- Mid-control headliner: n=14, median 1.8
- Closer headliner: n=7, median 1.35

## Highest values we assigned — do these pass the eye test?
- Kyle Harrison — **113.4** (P, $2.0M/yr est)
- Jhoan Duran — **110.2** (P, closer, $2.0M/yr est)
- Mason Miller — **101.2** (P, closer, $0.8M/yr est)
- TJ Rumfield — **88.2** (1B, $0.8M/yr est)
- Stephen Kolek — **79.8** (P, $0.8M/yr est)
- Grayson Rodriguez — **69.8** (P, $0.8M/yr est)
- Blaze Alexander — **69.8** (3B, $0.8M/yr est)
- Leo De Vries — **69.7** (SS, prospect AA)
- Isaac Collins — **64.8** (LF, $0.8M/yr est)
- Shane Bieber — **64.1** (P, rental)
- Carlos Correa — **61.7** (SS, rental)
- David Bednar — **60.7** (P, closer, rental)
- Jake McCarthy — **60.4** (CF, rental, $2.0M/yr est)
- Curtis Mead — **59.3** (3B, $2.0M/yr est)
- José Caballero — **56.6** (SS, $0.8M/yr est)

## Most lopsided by our math (best tuning clues)
- 2025-07-31 · **18.7x** — Houston Astros got 61.7 (Carlos Correa 61.7) vs Minnesota Twins 3.3 (Matt Mikulski 3.3)
- 2025-07-31 · **15.72x** — New York Yankees got 56.6 (José Caballero 56.6) vs Tampa Bay Rays 3.6 (Everson Pereira 3.6)
- 2026-01-28 · **10.38x** — Colorado Rockies got 88.2 (TJ Rumfield 88.2) vs New York Yankees 8.5 (Angel Chivilli 8.5)
- 2025-07-30 · **9.81x** — Pittsburgh Pirates got 36.3 (Taylor Rogers 13.4, Sammy Stafura 22.9) vs Cincinnati Reds 3.7 (Ke'Bryan Hayes 3.7)
- 2026-03-04 · **9.6x** — Pittsburgh Pirates got 43.2 (Tyler Callihan 43.2) vs Cincinnati Reds 4.5 (Kyle Nicolas 4.5)
- 2025-07-31 · **9.05x** — San Diego Padres got 49.8 (Jorge Quintana 27.7, Nestor Cortes 22.1) vs Milwaukee Brewers 5.5 (Brandon Lockridge 5.5)
- 2026-01-07 · **8.49x** — Miami Marlins got 63.7 (Edgardo De Leon 12, Owen Caissie 33.7, Cristian Hernández 18) vs Chicago Cubs 7.5 (Edward Cabrera 7.5)
- 2025-07-31 · **8x** — Colorado Rockies got 38.4 (Ben Shields 12, Roc Riggio 26.4) vs New York Yankees 4.8 (Jake Bird 4.8)

## Suggestions
- Talent-for-talent median 1.71 — the SPREAD between good and mediocre players is too wide. Lower sv.tv.gamma (flattens the curve) and/or raise sv.tv.floor.
- All-trades median 1.85 is expected to run high: salary dumps and depth swaps are lopsided in talent by design.
- Rental headliner: median 1.5750000000000002 across 48 trades — likely OVERvalued by the model.
- Prospect headliner: median 2.14 across 47 trades — likely OVERvalued by the model.
- Controlled headliner (≥4y): median 2.87 across 19 trades — likely OVERvalued by the model.
- Mid-control headliner: median 1.8 across 14 trades — likely OVERvalued by the model.

Caveats: salaries at trade time are service-time estimates (so big-contract penalties don't fire — Correa reads far higher here than on the site), prospect ranks are current-day not as-of-trade, and minor leaguers are valued from their MiLB line.
Prospect rank lookups available: 900 org + 100 top-100 (matched by name).
Knobs live in config.json under sv.tv (mirror any change in Code.gs).
