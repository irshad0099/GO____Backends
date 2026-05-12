ALTER TABLE socket_logs ADD COLUMN IF NOT EXISTS direction VARCHAR(3);
COMMENT ON COLUMN socket_logs.direction IS 'in = client->server, out = server->client';
