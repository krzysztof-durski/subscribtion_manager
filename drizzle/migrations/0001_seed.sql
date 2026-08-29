-- Seed data: the three starting currencies and the single settings row.
-- Exchange rates are placeholders — set the real ones in the Settings page.

INSERT INTO currencies (code, name, symbol, rate_to_base, is_base, sort_order) VALUES
  ('PLN', 'Polish zloty', 'zł', 1,    1, 0),
  ('EUR', 'Euro',         '€',  4.30, 0, 1),
  ('USD', 'US dollar',    '$',  4.00, 0, 2);

INSERT INTO settings
  (id, base_currency_code, default_refill_day, timezone, monthly_income_minor, monthly_food_minor)
VALUES
  (1, 'PLN', 11, 'Europe/Warsaw', 0, 0);
