# The pocket model

The dashboard's central number — **"how much should be in this pocket right
now"** — uses a _sinking-fund_ model. This document explains it with the worked
example the implementation is tested against
([`app/lib/pockets.test.ts`](../app/lib/pockets.test.ts)).

## The rule

You refill each pocket once a month, on its **refill day**. On every refill you
set aside, for each active subscription, its **monthly-equivalent**:

```
monthlyEquivalent = round(amountPerCharge / intervalMonths)
```

So a 120.00 EUR/year subscription contributes 10.00 EUR every month; a 9.99
EUR/month subscription contributes 9.99. When a charge lands, that
subscription's set-aside money leaves the pocket.

Therefore the amount that _should_ be sitting in the pocket for one subscription
is what has accumulated since its **last charge** — where a charge dated **today**
counts as still upcoming (it may not have cleared yet), so the money for it should
still be in the pocket:

```
contribution = min(
  monthlyEquivalent × (refills strictly after the last charge before today, up to and including today),
  amountPerCharge          // never hold more than one full charge
)
```

and a pocket's expected balance is the sum of `contribution` over its active
subscriptions. The **monthly refill** you actually transfer is the sum of the
`monthlyEquivalent`s — constant from month to month in steady state.

If a subscription has not had its first charge yet, accumulation is assumed to
have started one interval before it (`firstBillingDate − intervalMonths`) — i.e.
the model assumes you have been saving toward that first charge. For a brand-new
subscription you have _not_ been saving for, set its first billing date to the
upcoming charge.

## Marking a charge paid

The date rule can only guess. When a charge has actually gone through — it
cleared early, or the billing date shifted — hit **"mark paid"** next to it in
the dashboard's "Charges before the next refill" list. That records the
`(subscription, scheduled date)` in `charge_payments`, and the accumulation
window jumps forward to that charge: the subscription's set-aside drops to zero
straight away instead of waiting for the calendar. **"undo"** removes the record.
Only the imminent (today-or-later) occurrence is affected; stale records do
nothing and can be left alone.

## Worked example

Today is **15 August 2026**. Refill day is the **10th**. One EUR pocket:

| Sub | Amount     | Interval | Billing day | First billing date |
| --- | ---------- | -------- | ----------- | ------------------ |
| A   | 10.00 EUR  | monthly  | 1           | 2026-01-01         |
| B   | 20.00 EUR  | monthly  | 30          | 2026-01-30         |
| C   | 120.00 EUR | yearly   | 15          | 2025-09-15         |

**A** — last charge 1 Aug. One refill since (10 Aug). `min(1 × 10.00, 10.00)` =
**10.00**.

**B** — last charge 30 Jul. One refill since (10 Aug). `min(1 × 20.00, 20.00)` =
**20.00**.

**C** — monthly-equivalent 10.00. Last charge 15 Sep 2025. Refills since then up
to 15 Aug 2026: 10 Oct … 10 Aug = **11**. `min(11 × 10.00, 120.00)` = **110.00**.

**Expected pocket balance = 10 + 20 + 110 = 140.00 EUR.**
**Monthly refill = 10 + 20 + 10 = 40.00 EUR.**

Checkpoints the tests also pin:

- **10 Sep 2026** (just after that month's refill): C has had its 12th refill →
  120.00; pocket = **150.00 EUR**.
- **16 Sep 2026** (C charged on the 15th): C resets to 0; pocket = **30.00 EUR**.

## Why this model

The just-in-time alternative — refill only what will be charged before the next
refill — makes refills lurch every time an annual renewal comes due and leaves
the pocket near zero the rest of the time. The sinking fund keeps the monthly
transfer flat and the pocket balance meaningful, which is what makes "does my
real Revolut balance match?" a useful check. See
[`docs/DECISIONS.md`](DECISIONS.md).
