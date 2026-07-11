# Methodology

This document explains how The Ledger calculates a nonprofit's trustworthiness score. The goal is transparency: anyone should be able to see exactly which signals move a score up or down, and why.

## The score in brief

Every organization starts at a perfect **10 out of 10**. The Ledger then checks a set of trustworthiness signals drawn from an organization's finances and filings. Each signal that falls short of its benchmark subtracts a penalty from the starting 10. The final score is the remaining value, rounded to one decimal place and never allowed to drop below zero:

```
score = max(0, round((10 - total_penalties) * 10) / 10)
```

A higher score means fewer red flags. A perfect 10 means every signal met its benchmark.

## Data sources

The Ledger operates in two modes:

- **Live mode** pulls organization data from the ProPublica Nonprofit Explorer API, which is built on IRS Form 990 filings. No API key is required.
- **Demo mode** uses a set of fictional organizations so the scoring algorithm can be demonstrated and tuned without depending on a live network connection.

The signals and benchmarks described below apply to both modes.

## The signals

### 1. Program spending

**What it measures:** the share of total expenses that goes toward the organization's programs, rather than overhead.

- Ratio = program expenses / total expenses
- Benchmark: at least **75%** of expenses reach programs
- Penalty if below benchmark: `min(3, (0.75 - ratio) * 12)` points

This is the most heavily weighted signal (up to a 3-point penalty), reflecting how central program spending is to a charity's purpose.

### 2. Fundraising cost

**What it measures:** how much the organization spends to raise each dollar of contributions.

- Ratio = fundraising costs / contributions raised
- Benchmark: no more than **$0.15** spent per $1 raised
- Penalty if above benchmark: `min(2.5, (ratio - 0.15) * 9)` points

### 3. Executive pay

**What it measures:** the CEO's compensation relative to the organization's total expenses.

- Ratio = CEO compensation / total expenses
- If no compensated executive is reported, no penalty applies.
- Benchmark: CEO pay is no more than **2%** of total expenses
- Penalty if above benchmark: `min(2, (ratio - 0.02) * 30 + (ceo_comp > $600,000 ? 0.5 : 0))` points

An additional half-point is added when reported CEO pay exceeds $600,000, flagging unusually high absolute compensation.

### 4. Foundation asset payout

**What it measures (foundations only):** whether a grantmaking foundation distributes enough of its assets each year.

- Benchmark: payout rate of at least **5%** of assets, the IRS minimum for private foundations
- Falling below the 5% minimum incurs a penalty.

This signal applies only to organizations classified as foundations.

### 5. Independent audit

**What it measures:** whether the organization has audited financial statements on file.

- Audited financials on file: no penalty
- No independent audit reported: **0.75** point penalty

### 6. Filing history

**What it measures:** whether the organization filed its IRS Form 990 on time.

- Form 990 filed on time: no penalty
- Late or amended Form 990 filing: **0.75** point penalty

## How penalties combine

The penalties from every applicable signal are summed into a single `total_penalties` value, which is then subtracted from the starting score of 10. Because program spending, fundraising cost, and executive pay each carry the largest possible penalties, they have the greatest influence on a final score, while audit and filing signals act as smaller adjustments.

## Limitations

The score is a summary of publicly reported signals, not a definitive judgment of an organization's quality or impact. Reported figures can lag, contain errors, or omit context, and a good score does not guarantee good outcomes any more than a lower score proves wrongdoing. Donors should treat The Ledger as one input among several.
