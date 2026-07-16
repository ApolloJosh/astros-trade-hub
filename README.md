# BTD Trade Hub

League-wide MLB trade values, a live trade feed with value math, and the Astros mock trade
builder — for the Beyond the Diamond podcast. Static site on GitHub Pages, data rebuilt
automatically by a GitHub Action from the MLB Stats API + the podcast's Google Sheet.

## One-time setup

1. Create a new GitHub repo (e.g. `astros-trade-hub`) and push this folder:
   ```bash
   git init && git add -A && git commit -m "initial"
   git branch -M main
   git remote add origin https://github.com/<you>/astros-trade-hub.git
   git push -u origin main
   ```
2. Repo **Settings → Pages** → Source: **GitHub Actions**.
3. Repo **Settings → Actions → General** → Workflow permissions: **Read and write**.
4. **Actions** tab → "Build data & deploy" → **Run workflow**. First run takes ~20–40 min
   (it values ~1,200+ players). The site then lives at `https://<you>.github.io/astros-trade-hub/`.

The Action runs daily at ~6am CT. Near the deadline, edit the cron in
`.github/workflows/build.yml` (e.g. `0 */2 * * *` for every 2 hours).

## What's inside

| Piece | What it does |
|---|---|
| `src/engine.js` | The valuation model (WAR proxy → career-weighted projection → surplus $ → **Trade Value 1–150**, calibrated to Josh's manual values). Parity-tested against the Apps Script version. |
| `src/build-data.js` | Values every 40-man player + every ranked prospect in the league; pulls Astros Fits + Payroll from the published Google Sheet. |
| `src/transactions.js` | Reads MLB's official trade log → `feed.json` (every trade as a value equation) and flags traded players (excluded from the builder, badged everywhere). |
| `src/calibrate.js` | Compares real trades to our values → market temperature + knob suggestions (never auto-tunes; you review and edit `config.json`). |
| `docs/` | The site: hub, trade builder, trade feed, Astros fits. |
| `config.json` | Every model knob. The Trade Value section is `sv.tv`. |

## Updating prospect rankings

No public API exists for MLB Pipeline lists, so rankings are checked-in JSON.
When Pipeline re-ranks, paste the numbered list:
```bash
node src/parse-rankings.js dodgers 119   # then paste the list, Ctrl-D
node src/parse-rankings.js top100        # for the overall Top 100
```
Commit the resulting file in `data-sources/rankings/`. Players get `Org #N` badges;
Top-100 guys get `MLB #N` badges and stronger value anchors.

## Salary accuracy

There's no public salary API, so league-wide contracts are estimated from service time
(pre-arb ≈ league min, arb ≈ modeled). For players where exact money matters, add
overrides in `data-sources/salaries-manual.json`:
```json
{ "545361": { "salaryM": 40.0, "control": 2.5 } }
```
The Astros' own boards use real Spotrac figures via the Google Sheet.

## The Google Sheet still matters

The sheet remains the curation layer: the Hitters/Pitchers tabs feed the **Astros Possible
Fits** board, and the Payroll tab feeds the luxury-tax math. Edit there; the next build
picks it up. The Apps Script tracker keeps working independently.

## Calibrating from the market

After trades happen, `docs/data/calibration.json` (and the Trade Feed page) shows the
median balance of real trades by our values. 1.0 = the model prices the market perfectly.
The suggestions tell you which `config.json` knob to nudge — commit the change and the
next build re-values everyone.
