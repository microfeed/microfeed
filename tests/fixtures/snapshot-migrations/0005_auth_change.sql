ALTER TABLE fixture_auth_user ADD COLUMN role TEXT;

UPDATE fixture_auth_user
SET role = 'administrator'
WHERE id = 'owner';
