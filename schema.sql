CREATE TABLE IF NOT EXISTS users (
  chat_id BIGINT PRIMARY KEY,
  only_mobile BOOLEAN NOT NULL DEFAULT FALSE,
  with_social BOOLEAN NOT NULL DEFAULT FALSE,
  template TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS leads (
  source_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  phone TEXT,
  mobile BOOLEAN NOT NULL DEFAULT FALSE,
  site TEXT,
  kind TEXT NOT NULL,
  city TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS searches (
  id BIGSERIAL PRIMARY KEY,
  chat_id BIGINT NOT NULL REFERENCES users(chat_id) ON DELETE CASCADE,
  city TEXT NOT NULL,
  category TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS search_results (
  search_id BIGINT NOT NULL REFERENCES searches(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL REFERENCES leads(source_id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  PRIMARY KEY (search_id, source_id)
);

CREATE INDEX IF NOT EXISTS idx_searches_chat_created
  ON searches(chat_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_search_results_search_position
  ON search_results(search_id, position);

CREATE TABLE IF NOT EXISTS contacted (
  chat_id BIGINT NOT NULL REFERENCES users(chat_id) ON DELETE CASCADE,
  source_id TEXT NOT NULL REFERENCES leads(source_id) ON DELETE CASCADE,
  contacted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (chat_id, source_id)
);

ALTER TABLE contacted
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'contacted'
    CHECK (status IN ('contacted', 'replied', 'client', 'rejected'));
ALTER TABLE contacted ADD COLUMN IF NOT EXISTS note TEXT;

CREATE TABLE IF NOT EXISTS access (
  user_id BIGINT PRIMARY KEY,
  username TEXT,
  first_name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS search_usage (
  chat_id BIGINT NOT NULL,
  day DATE NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (chat_id, day)
);
