# The Ledger — Nonprofit Trust Index

Trust scores for U.S. nonprofits, computed transparently from their own IRS Form 990 filings.

**Live demo:** _add your Netlify or GitHub Pages URL here_

## What it does

Every U.S. tax-exempt organization must file IRS Form 990, publicly disclosing its
revenue, expenses, assets, and executive compensation. The Ledger reads those
filings and scores each organization out of 10 — starting every org at 10.00 and
deducting points only for what its own reported numbers show. Every deduction is
itemized on screen, so anyone can see exactly why an organization scored what it did.

The app has two modes:

- **Demo ledger** — eight fictional archetype organizations used to tune the
  scoring formula.
- **Live IRS data** — searches ~1.8M real organizations through ProPublica's
  Nonprofit Explorer API and scores their latest extracted filing.

## How the scoring works

Operating charities and private foundations are scored on different tracks,
because they work differently — a grantmaking foundation with 5 employees and a
billion dollars is not automatically suspicious; what matters is whether the
money goes out the door.

**Operating charities (Form 990)**
- Program spending: at least 75% of expenses should reach programs
- Fundraising cost: no more than $0.15 spent per $1 raised
- Executive pay relative to organization size
- Whether funds are being deployed or accumulating

**Private foundations (Form 990-PF)**
- Asset payout vs. the 5% annual minimum distribution the IRS requires
- Executive pay relative to organization size

**Both**
- Filing recency and history

Metrics not available in the public summary feed (program expense split,
fundraising costs, staff counts) are shown as "N/A — not in feed" and are
never deducted. Missing data never lowers a score.

## Data source & credits

All data comes from [ProPublica's Nonprofit Explorer API](https://projects.propublica.org/nonprofits/api),
which publishes data from the IRS's releases of Form 990 filings. Use of that
API is subject to ProPublica's Data Terms of Use. This project is not
affiliated with ProPublica or the IRS.

## Disclaimer

Scores are generated mechanically from figures organizations report on their
own IRS filings, using the published formulas above. A score is not an
accusation of wrongdoing; it is an arithmetic summary of public disclosures.
Filings can be a year or more old by the time the IRS releases them. Always
review an organization's actual Form 990 (linked on each score page) before
drawing conclusions.

## Running & deploying

The site is a single static file — no build step, no server.

- **Locally:** open `index.html` in a browser.
- **GitHub Pages:** Settings → Pages → deploy from the `main` branch.
- **Netlify:** drag the folder onto [app.netlify.com/drop](https://app.netlify.com/drop),
  or connect this repo for automatic deploys.

`src/nonprofit-trust-index.jsx` is the editable React source; `index.html` is
the self-contained version that runs in the browser.
