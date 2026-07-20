# Historical trade calibration — 2026-07-20

Window: last 12 months · 146 trades found · 135 fully valued at time of trade.
Assumption: real trades are roughly balanced, so a healthy median is ~1.0-1.2.

- **Median ratio (bigger/smaller side): 1.85**
- **Established-players-only trades (cleanest signal): median 2.465 across 12**
- Trades our model calls near-fair (≤1.25x): 19%

## By archetype (each trade counted once, by its headliner)
- Rental headliner: n=48, median 1.5750000000000002
- Prospect headliner: n=47, median 2.14
- Controlled headliner (≥4y): n=19, median 2.87
- Mid-control headliner: n=14, median 1.8
- Closer headliner: n=7, median 1.35

## Highest values we assigned — do these pass the eye test?
- Kyle Harrison — **111.2** (P)
- Jhoan Duran — **108.9** (P, closer)
- Mason Miller — **100.5** (P, closer)
- TJ Rumfield — **86.8** (1B)
- Stephen Kolek — **79.3** (P)
- Grayson Rodriguez — **69.8** (P)
- Leo De Vries — **69.7** (SS, prospect AA)
- Blaze Alexander — **68.9** (3B)
- Shane Bieber — **64.1** (P, rental)
- Isaac Collins — **64** (LF)
- Carlos Correa — **61.7** (SS, rental)
- David Bednar — **60.7** (P, closer, rental)
- Jake McCarthy — **60** (CF, rental)
- Curtis Mead — **57.7** (3B)
- José Caballero — **56.2** (SS)

## Most lopsided by our math (best tuning clues)
- 2025-07-31 · **18.7x** — Houston Astros got 61.7 (Carlos Correa 61.7) vs Minnesota Twins 3.3 (Matt Mikulski 3.3)
- 2025-07-31 · **15.61x** — New York Yankees got 56.2 (José Caballero 56.2) vs Tampa Bay Rays 3.6 (Everson Pereira 3.6)
- 2026-01-28 · **10.21x** — Colorado Rockies got 86.8 (TJ Rumfield 86.8) vs New York Yankees 8.5 (Angel Chivilli 8.5)
- 2025-07-30 · **9.81x** — Pittsburgh Pirates got 36.3 (Taylor Rogers 13.4, Sammy Stafura 22.9) vs Cincinnati Reds 3.7 (Ke'Bryan Hayes 3.7)
- 2026-03-04 · **9.6x** — Pittsburgh Pirates got 43.2 (Tyler Callihan 43.2) vs Cincinnati Reds 4.5 (Kyle Nicolas 4.5)
- 2025-07-31 · **9.05x** — San Diego Padres got 49.8 (Jorge Quintana 27.7, Nestor Cortes 22.1) vs Milwaukee Brewers 5.5 (Brandon Lockridge 5.5)
- 2026-01-07 · **8.49x** — Miami Marlins got 63.7 (Edgardo De Leon 12, Owen Caissie 33.7, Cristian Hernández 18) vs Chicago Cubs 7.5 (Edward Cabrera 7.5)
- 2025-07-31 · **8x** — Colorado Rockies got 38.4 (Ben Shields 12, Roc Riggio 26.4) vs New York Yankees 4.8 (Jake Bird 4.8)

## Suggestions
- Median real trade reads 1.85x lopsided — the model systematically OVERVALUES whatever tends to land on the heavier side. Check the buckets below for which archetype.
- Rental headliner: median 1.5750000000000002 across 48 trades — likely OVERvalued by the model.
- Prospect headliner: median 2.14 across 47 trades — likely OVERvalued by the model.
- Controlled headliner (≥4y): median 2.87 across 19 trades — likely OVERvalued by the model.
- Mid-control headliner: median 1.8 across 14 trades — likely OVERvalued by the model.

Caveats: salaries at trade time are service-time estimates (so big-contract penalties don't fire — Correa reads far higher here than on the site), prospect ranks are current-day not as-of-trade, and minor leaguers are valued from their MiLB line.
Prospect rank lookups available: 900 org + 100 top-100 (matched by name).
Knobs live in config.json under sv.tv (mirror any change in Code.gs).
