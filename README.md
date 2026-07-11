# The Ledger

A nonprofit trustworthiness rating system. The Ledger helps people evaluate and compare nonprofit organizations by scoring them on trustworthiness signals, so donors can make more informed giving decisions.

## What it does

The Ledger presents an interface for searching nonprofit organizations and viewing a trustworthiness score for each one. The scoring draws on publicly available signals about how organizations operate. For a full breakdown of how scores are calculated, see [METHODOLOGY.md](METHODOLOGY.md).

## Project structure

- `the-ledger-index.html` — Standalone version of the site. Open this file in a browser to run The Ledger locally with no build step.
- `src/nonprofit-trust-index.jsx` — The React source component for the app.
- `METHODOLOGY.md` — Explains how trustworthiness scores are calculated.

## Running locally

Open `the-ledger-index.html` directly in your browser to try the standalone site. No installation or build is required.

## Methodology

The Ledger scores each organization on program spending, fundraising cost, executive pay, foundation asset payout, independent audit, and filing history. See [METHODOLOGY.md](METHODOLOGY.md) for the benchmarks and formula.

## Roadmap

- [x] Add a methodology page explaining how scores are calculated.
- [ ] Improve search performance.
- [ ] Integrate full IRS e-file data so real organizations receive complete scoring.

## License

No license specified yet.
