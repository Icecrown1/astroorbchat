CREATE TABLE IF NOT EXISTS mobile_link_codes (
  user_id varchar(255) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  digest varchar(64) NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL
);
