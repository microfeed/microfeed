ALTER TABLE api_keys
ADD COLUMN scopes TEXT NOT NULL DEFAULT 'content:read content:write';
