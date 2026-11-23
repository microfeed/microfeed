ALTER TABLE oauth_access_token ADD COLUMN resource TEXT;
ALTER TABLE oauth_refresh_token ADD COLUMN resource TEXT;
