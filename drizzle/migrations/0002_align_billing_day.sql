-- billing_day is now always the day-of-month of first_billing_date (the form no
-- longer has a separate field). Realign any rows where a mistyped day drifted
-- from the anchor date — otherwise a charge computed one day before the anchor
-- gets filtered out and the schedule looks a full interval into the future.

UPDATE subscriptions
SET billing_day = CAST(strftime('%d', first_billing_date) AS INTEGER)
WHERE billing_day <> CAST(strftime('%d', first_billing_date) AS INTEGER);
