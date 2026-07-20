# Historical trade calibration — 2026-07-20

Window: last 12 months · 146 trades found · 135 fully valued at time of trade.
Assumption: real trades are roughly balanced, so a healthy median is ~1.0-1.2.

- **Median ratio (bigger/smaller side): 1.73**
- **Established-players-only trades (cleanest signal): median 2.045 across 12**
- Trades our model calls near-fair (≤1.25x): 23%

## By archetype
- Rentals (≤1.5y control): n=69, median 1.66
- Controlled (≥4y): n=131, median 1.75
- Closers (10+ SV): n=7, median 2.1
- Prospects / rookies: n=123, median 1.71
- MiLB-only (level-adjusted): n=115, median 1.71
- Ranked prospects: n=0, median n/a
- MLB-only trades: n=135, median 1.73
- Pitchers: n=118, median 1.72
- Hitters: n=103, median 1.77

## Most lopsided by our math (best tuning clues)
- 2025-07-31 · **11.14x** — New York Yankees got 73.5 (José Caballero 73.5) vs Tampa Bay Rays 6.6 (Everson Pereira 6.6)
- 2025-07-31 · **10.27x** — Houston Astros got 64.7 (Carlos Correa 64.7) vs Minnesota Twins 6.3 (Matt Mikulski 6.3)
- 2026-01-28 · **8.53x** — Colorado Rockies got 98.1 (TJ Rumfield 98.1) vs New York Yankees 11.5 (Angel Chivilli 11.5)
- 2026-03-04 · **7.15x** — Pittsburgh Pirates got 63.6 (Tyler Callihan 63.6) vs Cincinnati Reds 8.9 (Kyle Nicolas 8.9)
- 2026-03-28 · **6.19x** — Washington Nationals got 74.3 (Curtis Mead 74.3) vs Chicago White Sox 12 (Boston Smith 12)
- 2026-01-10 · **5.71x** — Colorado Rockies got 68.5 (Jake McCarthy 68.5) vs Arizona Diamondbacks 12 (Josh Grosz 12)
- 2025-07-31 · **5.59x** — Toronto Blue Jays got 67.1 (Shane Bieber 67.1) vs Cleveland Guardians 12 (Khal Stephen 12)
- 2025-07-31 · **5.08x** — Philadelphia Phillies got 61 (Matt Manning 61) vs Detroit Tigers 12 (Josueth Quinonez 12)

## Suggestions
- Median real trade reads 1.73x lopsided — the model systematically OVERVALUES whatever tends to land on the heavier side. Check the buckets below for which archetype.
- Rentals (≤1.5y control): median 1.66 across 69 trades — likely OVERvalued by the model.
- Controlled (≥4y): median 1.75 across 131 trades — likely OVERvalued by the model.
- Closers (10+ SV): median 2.1 across 7 trades — likely OVERvalued by the model.
- Prospects / rookies: median 1.71 across 123 trades — likely OVERvalued by the model.
- MiLB-only (level-adjusted): median 1.71 across 115 trades — likely OVERvalued by the model.
- MLB-only trades: median 1.73 across 135 trades — likely OVERvalued by the model.
- Pitchers: median 1.72 across 118 trades — likely OVERvalued by the model.
- Hitters: median 1.77 across 103 trades — likely OVERvalued by the model.

Caveats: salaries at trade time are service-time estimates, prospect ranks as of the trade aren't applied, and players with no MLB record are skipped — so prospect-heavy deals read light here.
Knobs live in config.json under sv.tv (mirror any change in Code.gs).
