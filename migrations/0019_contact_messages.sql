-- Personal-site contact form: public submissions saved for the site owner.
-- The public form accepts name, email, and message; the Admin inbox lists
-- submissions and lets the owner mark them read or delete them.

CREATE TABLE IF NOT EXISTS contact_messages (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'read')),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS contact_messages_status
ON contact_messages (status);
CREATE INDEX IF NOT EXISTS contact_messages_created_at
ON contact_messages (created_at);
