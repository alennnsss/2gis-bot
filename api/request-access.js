// Vercel-функция: заявка с сайта уходит владельцу в Telegram.
// Нужны переменные API_TOKEN и OWNER_ID в настройках проекта Vercel.

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false });
  }

  const { telegram = "", niche = "", website = "" } = req.body ?? {};

  // Скрытое поле: его заполняют только боты.
  if (website) {
    return res.status(200).json({ ok: true });
  }

  const username = String(telegram).trim().replace(/^@/, "");

  if (!/^[A-Za-z0-9_]{5,32}$/.test(username)) {
    return res.status(400).json({ ok: false, error: "telegram" });
  }

  const nicheText = String(niche).trim().slice(0, 300);
  const { API_TOKEN, OWNER_ID } = process.env;

  if (!API_TOKEN || !OWNER_ID) {
    console.error("API_TOKEN или OWNER_ID не заданы в Vercel");
    return res.status(500).json({ ok: false });
  }

  const text =
    `Заявка с сайта: @${esc(username)}\n` +
    (nicheText ? `Город / ниша: ${esc(nicheText)}\n` : "") +
    "\nКогда человек откроет бота и нажмёт «Запросить доступ», придут кнопки «Одобрить» / «Отклонить».";

  const response = await fetch(
    `https://api.telegram.org/bot${API_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: OWNER_ID, text, parse_mode: "HTML" }),
    }
  );

  if (!response.ok) {
    console.error("Telegram ответил", response.status);
    return res.status(502).json({ ok: false });
  }

  return res.status(200).json({ ok: true });
}
