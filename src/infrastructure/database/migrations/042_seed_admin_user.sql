-- Seed admin user
INSERT INTO users (phone_number, full_name, role, is_verified, is_active)
VALUES ('9999999999', 'GO Mobility Admin', 'admin', true, true)
ON CONFLICT (phone_number) DO NOTHING;