import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL не задан в .env");
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "false"
    ? false
    : process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : undefined,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

export async function initDb() {
  await pool.query(`
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
  `);
}

export async function ensureUser(chatId, defaultTemplate) {
  const result = await pool.query(
    `INSERT INTO users (chat_id, template)
     VALUES ($1, $2)
     ON CONFLICT (chat_id) DO NOTHING
     RETURNING *`,
    [chatId, defaultTemplate]
  );

  if (result.rows[0]) return result.rows[0];

  return (await pool.query(
    `SELECT * FROM users WHERE chat_id = $1`,
    [chatId]
  )).rows[0];
}

export async function getSettings(chatId, defaultTemplate) {
  return ensureUser(chatId, defaultTemplate);
}

export async function updateSetting(chatId, field, value) {
  const allowed = new Set(["only_mobile", "with_social", "template"]);
  if (!allowed.has(field)) throw new Error("Недопустимая настройка");

  const result = await pool.query(
    `UPDATE users SET ${field} = $1, updated_at = NOW()
     WHERE chat_id = $2
     RETURNING *`,
    [value, chatId]
  );

  return result.rows[0];
}

export async function saveLead(lead, city, category) {
  await pool.query(
    `INSERT INTO leads
      (source_id, name, address, phone, mobile, site, kind, city, category, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
     ON CONFLICT (source_id) DO UPDATE SET
       name = EXCLUDED.name,
       address = EXCLUDED.address,
       phone = EXCLUDED.phone,
       mobile = EXCLUDED.mobile,
       site = EXCLUDED.site,
       kind = EXCLUDED.kind,
       city = EXCLUDED.city,
       category = EXCLUDED.category,
       updated_at = NOW()`,
    [
      lead.id, lead.name, lead.address, lead.phone, lead.mobile,
      lead.site, lead.kind, city, category
    ]
  );
}

export async function createSearch(chatId, city, category) {
  const result = await pool.query(
    `INSERT INTO searches (chat_id, city, category)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [chatId, city, category]
  );
  return result.rows[0].id;
}

export async function addSearchResult(searchId, sourceId, position) {
  await pool.query(
    `INSERT INTO search_results (search_id, source_id, position)
     VALUES ($1, $2, $3)
     ON CONFLICT DO NOTHING`,
    [searchId, sourceId, position]
  );
}

export async function markContacted(chatId, sourceId, contactedState) {
  if (contactedState) {
    await pool.query(
      `INSERT INTO contacted (chat_id, source_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [chatId, sourceId]
    );
  } else {
    await pool.query(
      `DELETE FROM contacted WHERE chat_id = $1 AND source_id = $2`,
      [chatId, sourceId]
    );
  }
}

export async function isContacted(chatId, sourceId) {
  const result = await pool.query(
    `SELECT 1 FROM contacted WHERE chat_id = $1 AND source_id = $2`,
    [chatId, sourceId]
  );
  return result.rowCount > 0;
}

export async function getContactedCount(chatId) {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS count FROM contacted WHERE chat_id = $1`,
    [chatId]
  );
  return result.rows[0].count;
}

export async function clearContacted(chatId) {
  await pool.query(`DELETE FROM contacted WHERE chat_id = $1`, [chatId]);
}

export async function getSearch(searchId, chatId) {
  const result = await pool.query(
    `SELECT s.id, s.city, s.category, s.created_at
     FROM searches s
     WHERE s.id = $1 AND s.chat_id = $2`,
    [searchId, chatId]
  );
  return result.rows[0] ?? null;
}

export async function getLatestSearch(chatId) {
  const result = await pool.query(
    `SELECT id, city, category, created_at
     FROM searches
     WHERE chat_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [chatId]
  );
  return result.rows[0] ?? null;
}

export async function getSearchLeads(searchId, chatId) {
  const result = await pool.query(
    `SELECT
       l.source_id AS id,
       l.name,
       l.address,
       l.phone,
       l.mobile,
       l.site,
       l.kind,
       EXISTS (
         SELECT 1 FROM contacted c
         WHERE c.chat_id = $2 AND c.source_id = l.source_id
       ) AS done
     FROM search_results sr
     JOIN searches s ON s.id = sr.search_id
     JOIN leads l ON l.source_id = sr.source_id
     WHERE sr.search_id = $1
       AND s.chat_id = $2
     ORDER BY sr.position`,
    [searchId, chatId]
  );
  return result.rows;
}

export async function getLastSearchLeads(chatId) {
  const search = await getLatestSearch(chatId);
  if (!search) return null;
  const leads = await getSearchLeads(search.id, chatId);
  return { search, leads };
}

export async function getHiddenCount(chatId, searchId) {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS count
     FROM search_results sr
     JOIN contacted c
       ON c.chat_id = $1 AND c.source_id = sr.source_id
     WHERE sr.search_id = $2`,
    [chatId, searchId]
  );
  return result.rows[0].count;
}

export async function closeDb() {
  await pool.end();
}
