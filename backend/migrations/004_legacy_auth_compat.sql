ALTER TABLE users ADD COLUMN IF NOT EXISTS name varchar(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name text;

UPDATE users
SET name = COALESCE(NULLIF(name, ''), NULLIF(display_name, ''), email),
    display_name = COALESCE(NULLIF(display_name, ''), NULLIF(name, ''), email);

ALTER TABLE users ALTER COLUMN name SET NOT NULL;
ALTER TABLE users ALTER COLUMN display_name SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_idx ON users (LOWER(email));
