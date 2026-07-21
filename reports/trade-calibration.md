# Historical trade calibration — 2026-07-21

Window: last 24 months · 252 trades found · 230 fully valued at time of trade.
Assumption: real trades are roughly balanced, so a healthy median is ~1.0-1.2.

- **TALENT-FOR-TALENT (real piece both sides — the deals that SHOULD be even):**
  **median 1.3 across 23 trades · 61% within 1.5x**
- Established-players-only: median 2.21 across 33
- All trades (includes salary dumps & depth swaps, which are genuinely lopsided): median 1.84
- Trades our model calls near-fair (≤1.25x): 19%

## By archetype (each trade counted once, by its headliner)
- Rental headliner: n=88, median 1.7149999999999999
- Prospect headliner: n=71, median 2.03
- Controlled headliner (≥4y): n=34, median 2.395
- Mid-control headliner: n=27, median 1.8
- Closer headliner: n=10, median 1.36

## Highest values we assigned — do these pass the eye test?
- Kyle Harrison — **113.4** (P, $2.0M/yr est)
- Jhoan Duran — **110.2** (P, closer, $2.0M/yr est)
- Mason Miller — **101.2** (P, closer, $0.8M/yr est)
- Zach Eflin — **90** (P, rental, $4.0M/yr)
- Jeffrey Springs — **89.7** (P, rental, $4.0M/yr)
- Rafael Devers — **89** (1B, $26.9M/yr)
- TJ Rumfield — **88.2** (1B, $0.8M/yr est)
- Quinn Priester — **84.8** (P, $0.8M/yr)
- Stephen Kolek — **79.8** (P, $0.8M/yr est)
- Mike Sirota — **73.1** (CF, prospect A+)
- Isaac Paredes — **70.6** (3B, rental, $9.3M/yr)
- Grayson Rodriguez — **69.8** (P, $0.8M/yr est)
- Blaze Alexander — **69.8** (3B, $0.8M/yr est)
- Leo De Vries — **69.7** (SS, prospect AA)
- Luis Peralta — **68.6** (P, rental, $0.1M/yr)

## Most lopsided by our math (best tuning clues)
- 2025-07-31 · **18.7x** — Houston Astros got 61.7 (Carlos Correa 61.7) vs Minnesota Twins 3.3 (Matt Mikulski 3.3)
- 2025-04-07 · **18.43x** — Milwaukee Brewers got 84.8 (Quinn Priester 84.8) vs Boston Red Sox 4.6 (Yophery Rodriguez 4.6)
- 2025-06-02 · **17.25x** — Los Angeles Dodgers got 55.2 (Will Klein 55.2) vs Seattle Mariners 3.2 (Joe Jacques 3.2)
- 2025-07-31 · **15.72x** — New York Yankees got 56.6 (José Caballero 56.6) vs Tampa Bay Rays 3.6 (Everson Pereira 3.6)
- 2026-01-28 · **10.38x** — Colorado Rockies got 88.2 (TJ Rumfield 88.2) vs New York Yankees 8.5 (Angel Chivilli 8.5)
- 2025-07-30 · **9.81x** — Pittsburgh Pirates got 36.3 (Taylor Rogers 13.4, Sammy Stafura 22.9) vs Cincinnati Reds 3.7 (Ke'Bryan Hayes 3.7)
- 2026-03-04 · **9.6x** — Pittsburgh Pirates got 43.2 (Tyler Callihan 43.2) vs Cincinnati Reds 4.5 (Kyle Nicolas 4.5)
- 2025-07-31 · **9.05x** — San Diego Padres got 49.8 (Jorge Quintana 27.7, Nestor Cortes 22.1) vs Milwaukee Brewers 5.5 (Brandon Lockridge 5.5)

## Suggestions
- Talent-for-talent median 1.3 — the model is pricing real swaps well. This is the number that matters.
- All-trades median 1.84 is expected to run high: salary dumps and depth swaps are lopsided in talent by design.
- Rental headliner: median 1.7149999999999999 across 88 trades — likely OVERvalued by the model.
- Prospect headliner: median 2.03 across 71 trades — likely OVERvalued by the model.
- Controlled headliner (≥4y): median 2.395 across 34 trades — likely OVERvalued by the model.
- Mid-control headliner: median 1.8 across 27 trades — likely OVERvalued by the model.
- Closer headliner: median 1.36 across 10 trades — likely OVERvalued by the model.

Caveats: salaries at trade time are service-time estimates (so big-contract penalties don't fire — Correa reads far higher here than on the site), prospect ranks are current-day not as-of-trade, and minor leaguers are valued from their MiLB line.
Prospect rank lookups available: 900 org + 100 top-100 (matched by name).
Knobs live in config.json under sv.tv (mirror any change in Code.gs).
