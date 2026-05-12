-- Subscription plan values update — free rides aur discount revise kiye
UPDATE subscription_plans SET free_rides_per_month = 0, ride_discount_percent = 3  WHERE slug = 'basic-pass';
UPDATE subscription_plans SET free_rides_per_month = 2, ride_discount_percent = 5  WHERE slug = 'prime-pass';
UPDATE subscription_plans SET free_rides_per_month = 4, ride_discount_percent = 8  WHERE slug = 'elite-pass';
UPDATE subscription_plans SET free_rides_per_month = 2, ride_discount_percent = 10 WHERE slug = 'annual-pass';
