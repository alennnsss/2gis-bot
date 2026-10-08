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

    -- CRM: статус компании и заметка. Старые отметки становятся «написал».
    ALTER TABLE contacted
      ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'contacted'
        CHECK (status IN ('contacted', 'replied', 'client', 'rejected'));
    ALTER TABLE contacted ADD COLUMN IF NOT EXISTS note TEXT;

    -- Заявки на доступ и одобренные пользователи (владелец здесь не хранится).
    CREATE TABLE IF NOT EXISTS access (
      user_id BIGINT PRIMARY KEY,
      username TEXT,
      first_name TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected')),
      requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      decided_at TIMESTAMPTZ
    );

    -- Сколько поисков пользователь сделал за день (для лимита).
    CREATE TABLE IF NOT EXISTS search_usage (
      chat_id BIGINT NOT NULL,
      day DATE NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (chat_id, day)
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

// Сохраняет поиск и все его компании одной транзакцией:
// при ошибке не остаётся «полусохранённого» поиска.
// city/category у компании — где её нашли впервые, поэтому при повторной
// встрече они не перезаписываются (данные конкретного поиска лежат в searches).
export async function saveSearchWithLeads(chatId, city, category, leads) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const search = await client.query(
      `INSERT INTO searches (chat_id, city, category)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [chatId, city, category]
    );
    const searchId = search.rows[0].id;

    await client.query(
      `INSERT INTO leads
        (source_id, name, address, phone, mobile, site, kind, city, category, updated_at)
       SELECT u.source_id, u.name, u.address, u.phone, u.mobile, u.site, u.kind,
              $8, $9, NOW()
       FROM unnest($1::text[], $2::text[], $3::text[], $4::text[],
                   $5::boolean[], $6::text[], $7::text[])
         AS u(source_id, name, address, phone, mobile, site, kind)
       ON CONFLICT (source_id) DO UPDATE SET
         name = EXCLUDED.name,
         address = EXCLUDED.address,
         phone = EXCLUDED.phone,
         mobile = EXCLUDED.mobile,
         site = EXCLUDED.site,
         kind = EXCLUDED.kind,
         updated_at = NOW()`,
      [
        leads.map((l) => l.id),
        leads.map((l) => l.name),
        leads.map((l) => l.address),
        leads.map((l) => l.phone),
        leads.map((l) => l.mobile),
        leads.map((l) => l.site),
        leads.map((l) => l.kind),
        city,
        category,
      ]
    );

    await client.query(
      `INSERT INTO search_results (search_id, source_id, position)
       SELECT $1, u.source_id, (u.ord - 1)::int
       FROM unnest($2::text[]) WITH ORDINALITY AS u(source_id, ord)
       ON CONFLICT DO NOTHING`,
      [searchId, leads.map((l) => l.id)]
    );

    await client.query("COMMIT");

    return searchId;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

// status = null снимает отметку целиком (вместе с заметкой).
export async function setLeadStatus(chatId, sourceId, status) {
  if (status) {
    await pool.query(
      `INSERT INTO contacted (chat_id, source_id, status)
       VALUES ($1, $2, $3)
       ON CONFLICT (chat_id, source_id) DO UPDATE SET status = EXCLUDED.status`,
      [chatId, sourceId, status]
    );
  } else {
    await pool.query(
      `DELETE FROM contacted WHERE chat_id = $1 AND source_id = $2`,
      [chatId, sourceId]
    );
  }
}

// Заметка без отметки невозможна: если компании ещё нет в contacted,
// она получает статус «написал».
export async function setLeadNote(chatId, sourceId, note) {
  const result = await pool.query(
    `INSERT INTO contacted (chat_id, source_id, note)
     VALUES ($1, $2, $3)
     ON CONFLICT (chat_id, source_id) DO UPDATE SET note = EXCLUDED.note
     RETURNING status`,
    [chatId, sourceId, note]
  );
  return result.rows[0].status;
}

export async function getContactedIds(chatId) {
  const result = await pool.query(
    `SELECT source_id FROM contacted WHERE chat_id = $1`,
    [chatId]
  );
  return new Set(result.rows.map((row) => row.source_id));
}

export async function getStatusCounts(chatId) {
  const result = await pool.query(
    `SELECT status, COUNT(*)::int AS count
     FROM contacted WHERE chat_id = $1
     GROUP BY status`,
    [chatId]
  );
  return Object.fromEntries(result.rows.map((row) => [row.status, row.count]));
}

// Компании в работе: ответили или уже клиенты, свежие сверху.
export async function getPipeline(chatId, limit = 30) {
  const result = await pool.query(
    `SELECT l.name, l.phone, l.mobile, c.status, c.note
     FROM contacted c
     JOIN leads l ON l.source_id = c.source_id
     WHERE c.chat_id = $1 AND c.status IN ('replied', 'client')
     ORDER BY c.status = 'client' DESC, c.contacted_at DESC
     LIMIT $2`,
    [chatId, limit]
  );
  return result.rows;
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
       c.status,
       c.note,
       (c.source_id IS NOT NULL) AS done
     FROM search_results sr
     JOIN searches s ON s.id = sr.search_id
     JOIN leads l ON l.source_id = sr.source_id
     LEFT JOIN contacted c ON c.chat_id = $2 AND c.source_id = l.source_id
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

// Сутки считаем по времени Алматы.
const TODAY = `(NOW() AT TIME ZONE 'Asia/Almaty')::date`;

// Атомарно засчитывает поиск. Возвращает false, если лимит на сегодня исчерпан.
export async function takeSearchSlot(chatId, limit) {
  const result = await pool.query(
    `INSERT INTO search_usage (chat_id, day, count)
     VALUES ($1, ${TODAY}, 1)
     ON CONFLICT (chat_id, day) DO UPDATE SET count = search_usage.count + 1
       WHERE search_usage.count < $2
     RETURNING count`,
    [chatId, limit]
  );
  return result.rowCount > 0;
}

export async function getSearchesToday(chatId) {
  const result = await pool.query(
    `SELECT count FROM search_usage WHERE chat_id = $1 AND day = ${TODAY}`,
    [chatId]
  );
  return result.rows[0]?.count ?? 0;
}

export async function getAccess(userId) {
  const result = await pool.query(
    `SELECT * FROM access WHERE user_id = $1`,
    [userId]
  );
  return result.rows[0] ?? null;
}

// Новая заявка или повторная — не раньше чем через сутки после отказа.
// Одобренного не трогаем.
// Возвращает строку, если заявка действительно создана (её надо показать владельцу).
export async function requestAccess(userId, username, firstName) {
  const result = await pool.query(
    `INSERT INTO access (user_id, username, first_name)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id) DO UPDATE SET
       username = EXCLUDED.username,
       first_name = EXCLUDED.first_name,
       status = 'pending',
       requested_at = NOW(),
       decided_at = NULL
       WHERE access.status = 'rejected'
         AND access.decided_at < NOW() - INTERVAL '1 day'
     RETURNING *`,
    [userId, username ?? null, firstName ?? ""]
  );
  return result.rows[0] ?? null;
}

export async function setAccessStatus(userId, status) {
  const result = await pool.query(
    `UPDATE access SET status = $2, decided_at = NOW()
     WHERE user_id = $1
     RETURNING *`,
    [userId, status]
  );
  return result.rows[0] ?? null;
}

export async function listAccess() {
  const result = await pool.query(
    `SELECT * FROM access
     WHERE status IN ('pending', 'approved')
     ORDER BY status = 'pending' DESC, requested_at DESC`
  );
  return result.rows;
}

export async function closeDb() {
  await pool.end();
}
