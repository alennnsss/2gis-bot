import { Bot, InlineKeyboard, InputFile } from "grammy";
import "dotenv/config";

import {
  initDb,
  closeDb,
  getSettings,
  updateSetting,
  saveSearchWithLeads,
  setLeadStatus,
  setLeadNote,
  getContactedIds,
  getStatusCounts,
  getPipeline,
  clearContacted,
  getSearch,
  getLatestSearch,
  getSearchLeads,
  getLastSearchLeads,
  takeSearchSlot,
  getSearchesToday,
  getAccess,
  requestAccess,
  setAccessStatus,
  listAccess,
} from "./db.js";

const API_TOKEN = process.env.API_TOKEN;
const GEOAPIFY_KEY = process.env.GEOAPIFY_KEY;
const OWNER_ID = Number(process.env.OWNER_ID);
const MAX_PLACES = Number(process.env.MAX_PLACES) || 1500;
const MAX_PLACES_KZ = Number(process.env.MAX_PLACES_KZ) || 3000;
const DEFAULT_CITY = process.env.DEFAULT_CITY || "Алматы";
const PAGE_SIZE = 5;
// Лимит поисков в сутки для одобренных пользователей (на владельца не действует).
const DAILY_SEARCH_LIMIT = Number(process.env.DAILY_SEARCH_LIMIT) || 10;

// Статусы компании в CRM. Кнопка с номером переключает их по кругу.
const STATUSES = {
  contacted: { icon: "✅", label: "написал" },
  replied: { icon: "💬", label: "ответил" },
  client: { icon: "🤝", label: "клиент" },
  rejected: { icon: "❌", label: "отказ" },
};
const STATUS_CYCLE = [null, "contacted", "replied", "client", "rejected"];

function nextStatus(status) {
  const index = STATUS_CYCLE.indexOf(status ?? null);
  return STATUS_CYCLE[(index + 1) % STATUS_CYCLE.length];
}

const DEFAULT_TEMPLATE =
  "Здравствуйте! Увидел {name} на карте. Могу сделать сайт под ваш бизнес, интересно?";

if (!API_TOKEN) {
  throw new Error("API_TOKEN не задан в .env");
}

if (!GEOAPIFY_KEY) {
  throw new Error("GEOAPIFY_KEY не задан в .env");
}

if (!Number.isSafeInteger(OWNER_ID) || OWNER_ID <= 0) {
  throw new Error("OWNER_ID должен быть вашим числовым Telegram ID");
}

const bot = new Bot(API_TOKEN);

const CATEGORIES = {
  кафе: "catering.cafe",
  кофейня: "catering.cafe",
  ресторан: "catering.restaurant",
  бар: "catering.bar",
  фастфуд: "catering.fast_food",
  парикмахерская: "service.beauty.hairdresser",
  "салон красоты": "service.beauty",
  аптека: "healthcare.pharmacy",
  отель: "accommodation.hotel",
  фитнес: "sport.fitness",
  автосервис: "service.vehicle",
  магазин: "commercial",
  офис: "office",
  образование: "education",
  бизнес:
    "catering,service.beauty,service.vehicle,sport,accommodation,healthcare",
  все:
    "catering,commercial,service,office,healthcare,education,accommodation,sport,entertainment,leisure,tourism,pet,childcare,rental,production",
};

const SOCIAL = [
  "instagram.com",
  "t.me",
  "telegram.me",
  "facebook.com",
  "fb.com",
  "vk.com",
  "wa.me",
  "taplink.cc",
  "linktr.ee",
  "tiktok.com",
];

const sessions = new Map();
const busy = new Set();

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function isSocial(link) {
  try {
    // В OSM ссылки часто без схемы: "instagram.com/cafe".
    const withScheme = /^[a-z][a-z\d+.-]*:\/\//i.test(link)
      ? link
      : `https://${link}`;

    const host = new URL(withScheme)
      .hostname
      .replace(/^www\./, "")
      .toLowerCase();

    return SOCIAL.some(
      (domain) => host === domain || host.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}

// Казахстан (+7 70x/747/77x) и Россия (+7 9xx).
function isMobile(phone) {
  return /^\+7(70[0-8]|747|77[1-8]|9\d\d)/.test(phone);
}

function parseOnePhone(value) {
  if (value == null) return null;

  const text = String(value);

  const match = text.match(/\+?\d[\d\s\-‒()]{8,}/);

  let digits = (match ? match[0] : text).replace(/\D/g, "");

  if (digits.length === 11 && digits.startsWith("8")) {
    digits = "7" + digits.slice(1);
  }

  if (digits.length === 10) {
    digits = "7" + digits;
  }

  if (digits.length !== 11 || !digits.startsWith("7")) {
    return null;
  }

  return "+" + digits;
}

function cleanPhone(raw) {
  const values = Array.isArray(raw) ? raw.flat(Infinity) : [raw];

  const phones = values
    .filter(Boolean)
    .flatMap((value) => String(value).split(/[;,]/))
    .map(parseOnePhone)
    .filter(Boolean);

  const unique = [...new Set(phones)];

  return unique.find(isMobile) ?? unique[0] ?? null;
}

function buildWa(lead, template) {
  if (!lead.mobile || !lead.phone) {
    return null;
  }

  const text = template.replaceAll("{name}", lead.name);

  return `https://wa.me/${lead.phone.slice(1)}?text=${encodeURIComponent(
    text
  )}`;
}

function buildCheckUrl(name, city) {
  const query = `"${name}" ${city} официальный сайт`;

  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

async function getJson(url) {
  const response = await fetch(url);

  const text = await response.text();

  let data;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      `Geoapify вернул некорректный ответ (${response.status})`
    );
  }

  if (!response.ok) {
    throw new Error(
      data.message ??
        data.error ??
        `Geoapify вернул код ${response.status}`
    );
  }

  return data;
}

async function fetchPlaces(category, placeId, total) {
  const groups = category
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

  const perGroup = Math.ceil(total / groups.length);

  const features = [];

  let failed = 0;
  let lastError = null;

  for (const group of groups) {
    try {
      for (let offset = 0; offset < perGroup; offset += 100) {
        const size = Math.min(100, perGroup - offset);

        const url = new URL(
          "https://api.geoapify.com/v2/places"
        );

        url.searchParams.set("categories", group);
        url.searchParams.set("filter", `place:${placeId}`);
        url.searchParams.set("conditions", "named");
        url.searchParams.set("lang", "ru");
        url.searchParams.set("limit", String(size));
        url.searchParams.set("offset", String(offset));
        url.searchParams.set("apiKey", GEOAPIFY_KEY);

        const data = await getJson(url);

        const items = data.features ?? [];

        features.push(...items);

        if (items.length < size) {
          break;
        }
      }
    } catch (error) {
      failed++;
      lastError = error;

      console.warn(
        `Группа «${group}» пропущена: ${error.message}`
      );
    }
  }

  // Если не сработала ни одна группа (неверный ключ, лимит и т.п.),
  // это ошибка, а не «ничего не найдено».
  if (failed === groups.length && lastError) {
    throw lastError;
  }

  return features;
}

const COUNTRY_NAME = "Казахстан";

const COUNTRY_ALIASES = new Set([
  "казахстан",
  "весь казахстан",
  "по всему казахстану",
  "кз",
  "kz",
  "рк",
]);

const KZ_REGIONS = [
  ["Астана", "city"],
  ["Алматы", "city"],
  ["Шымкент", "city"],
  ["Абайская область", "state"],
  ["Акмолинская область", "state"],
  ["Актюбинская область", "state"],
  ["Алматинская область", "state"],
  ["Атырауская область", "state"],
  ["Восточно-Казахстанская область", "state"],
  ["Жамбылская область", "state"],
  ["Жетысуская область", "state"],
  ["Западно-Казахстанская область", "state"],
  ["Карагандинская область", "state"],
  ["Костанайская область", "state"],
  ["Кызылординская область", "state"],
  ["Мангистауская область", "state"],
  ["Павлодарская область", "state"],
  ["Северо-Казахстанская область", "state"],
  ["Туркестанская область", "state"],
  ["Улытауская область", "state"],
];

const regionCache = new Map();

function isWholeCountry(city) {
  return COUNTRY_ALIASES.has(
    city.trim().toLowerCase().replace(/\s+/g, " ")
  );
}

async function geocodePlace(text, type) {
  const geocode = new URL(
    "https://api.geoapify.com/v1/geocode/search"
  );

  geocode.searchParams.set("text", text);
  // Без type=city первым результатом может оказаться улица или здание.
  geocode.searchParams.set("type", type);
  geocode.searchParams.set("bias", "countrycode:kz");
  geocode.searchParams.set("format", "json");
  geocode.searchParams.set("apiKey", GEOAPIFY_KEY);

  const geo = await getJson(geocode);

  return geo.results?.[0]?.place_id ?? null;
}

async function resolvePlaces(city) {
  if (!isWholeCountry(city)) {
    const placeId = await geocodePlace(city, "city");

    if (!placeId) {
      throw new Error(`Город «${city}» не найден`);
    }

    return [placeId];
  }

  const ids = [];

  for (const [name, type] of KZ_REGIONS) {
    if (!regionCache.has(name)) {
      const placeId = await geocodePlace(name, type);

      if (!placeId) {
        console.warn(`Регион «${name}» не найден, пропускаю`);
        continue;
      }

      regionCache.set(name, placeId);
    }

    ids.push(regionCache.get(name));
  }

  if (ids.length === 0) {
    throw new Error("Не удалось определить регионы Казахстана");
  }

  return ids;
}

async function search(chatId, category, city) {
  const placeIds = await resolvePlaces(city);

  const limit = isWholeCountry(city)
    ? MAX_PLACES_KZ
    : MAX_PLACES;

  const perPlace = Math.ceil(limit / placeIds.length);

  const features = [];

  let failed = 0;
  let lastError = null;

  for (const placeId of placeIds) {
    try {
      features.push(
        ...(await fetchPlaces(category, placeId, perPlace))
      );
    } catch (error) {
      failed++;
      lastError = error;

      console.warn(`Регион пропущен: ${error.message}`);
    }
  }

  if (failed === placeIds.length && lastError) {
    throw lastError;
  }

  const settings = await getSettings(
    chatId,
    DEFAULT_TEMPLATE
  );

  const contactedIds = await getContactedIds(chatId);

  const leads = [];
  const seen = new Set();
  let hidden = 0;

  for (const feature of features) {
    const properties = feature.properties ?? {};

    const sourceId = properties.place_id;

    if (
      !properties.name ||
      !sourceId ||
      seen.has(sourceId)
    ) {
      continue;
    }

    seen.add(sourceId);

    const phone = cleanPhone([
      properties.contact?.phone,
      properties.contact?.phone_other,
    ]);

    const sites = [
      properties.website,
      properties.contact?.website,
    ]
      .flat(Infinity)
      .filter(Boolean)
      .map(String);

    const hasRealWebsite = sites.some(
      (site) => !isSocial(site)
    );

    if (hasRealWebsite) {
      continue;
    }

    // Ищем компании с телефоном — и без сайта, и только с соцсетью.
    if (!phone) {
      continue;
    }

    let kind;
    let site = null;

    if (sites.length === 0) {
      kind = "noSite";
    } else {
      kind = "social";
      site = sites.find(isSocial) ?? sites[0];
    }

    if (kind === "social" && !settings.with_social) {
      continue;
    }

    const mobile = isMobile(phone);

    if (settings.only_mobile && !mobile) {
      continue;
    }

    // Уже отмеченные «написал» в новых поисках не показываем.
    if (contactedIds.has(sourceId)) {
      hidden++;
      continue;
    }

    const lead = {
      id: sourceId,
      name: String(properties.name),
      address: String(
        properties.address_line2 ??
          properties.address_line1 ??
          ""
      ),
      phone,
      mobile,
      site,
      kind,
      done: false,
    };

    leads.push(lead);
  }

  leads.sort(
    (a, b) => Number(b.mobile) - Number(a.mobile)
  );

  return {
    leads,
    total: seen.size,
    hidden,
  };
}

// Категорию сравниваем в нижнем регистре,
// а город оставляем как ввёл пользователь.
function parseQuery(text = "") {
  const original = text.trim();
  const normalized = original.toLowerCase();

  if (!normalized) {
    return {
      cat: "",
      city: DEFAULT_CITY,
    };
  }

  if (normalized.includes(",")) {
    const [category, ...rest] = original.split(",");

    return {
      cat: category.trim().toLowerCase(),
      city: rest.join(",").trim() || DEFAULT_CITY,
    };
  }

  const keys = Object.keys(CATEGORIES).sort(
    (a, b) => b.length - a.length
  );

  const key = keys.find(
    (candidate) =>
      normalized === candidate ||
      normalized.startsWith(`${candidate} `)
  );

  if (key) {
    return {
      cat: key,
      city:
        original.slice(key.length).trim() ||
        DEFAULT_CITY,
    };
  }

  const [first, ...rest] = original.split(/\s+/);

  return {
    cat: first.toLowerCase(),
    city: rest.join(" ") || DEFAULT_CITY,
  };
}


// Текст одной компании. Ссылка «проверить сайт» строится заново,
// потому что в БД она не хранится.
function leadText(
  lead,
  number,
  template,
  city
) {
  const lines = [
    `<b>${number}. ${
      lead.status ? `${STATUSES[lead.status].icon} ` : ""
    }${esc(lead.name)}</b>`,
  ];

  if (lead.address) {
    lines.push(esc(lead.address));
  }

  if (lead.phone) {
    lines.push(
      `📞 ${esc(lead.phone)}${
        lead.mobile
          ? ""
          : " (городской, только звонок)"
      }`
    );
  }

  if (lead.site) {
    lines.push(
      `Соцсеть: ${esc(lead.site)}`
    );
  }

  if (lead.note) {
    lines.push(`📝 ${esc(lead.note)}`);
  }

  const links = [];

  /*
   * WhatsApp
   */
  const wa = buildWa(
    lead,
    template
  );

  if (wa) {
    links.push(
      `<a href="${esc(
        wa
      )}">WhatsApp</a>`
    );
  }

  const checkUrl = buildCheckUrl(
    lead.name,
    city
  );

  links.push(
    `<a href="${esc(
      checkUrl
    )}">🌐 проверить сайт</a>`
  );

  lines.push(
    links.join(" · ")
  );

  return lines.join("\n");
}


function renderPage(chatId, session) {
  const settingsPromise =
    getSettings(
      chatId,
      DEFAULT_TEMPLATE
    );

  return settingsPromise.then(
    (settings) => {
      const pages = Math.max(
        1,
        Math.ceil(
          session.leads.length /
            PAGE_SIZE
        )
      );

      session.page = Math.min(
        Math.max(
          session.page,
          0
        ),
        pages - 1
      );

      const start =
        session.page * PAGE_SIZE;

      const slice =
        session.leads.slice(
          start,
          start + PAGE_SIZE
        );

      const text =
        `Страница ${
          session.page + 1
        }/${pages} · найдено ${
          session.leads.length
        }\n` +
        `Кнопка с номером меняет статус: 📩 → ✅ написал → 💬 ответил → 🤝 клиент → ❌ отказ.\n` +
        `Заметка: /note номер текст\n\n` +
        slice
          .map(
            (lead, index) =>
              leadText(
                lead,
                start + index + 1,
                settings.template,
                session.city
              )
          )
          .join("\n\n");

      const keyboard =
        new InlineKeyboard();

      /*
       * Кнопки "написал"
       */
      slice.forEach(
        (lead, index) => {
          keyboard.text(
            `${
              lead.status
                ? STATUSES[lead.status].icon
                : "📩"
            } ${
              start + index + 1
            }`,
            `done:${session.searchId}:${
              start + index
            }`
          );
        }
      );

      keyboard.row();

      /*
       * Навигация по страницам
       */
      if (session.page > 0) {
        keyboard.text(
          "◀ Назад",
          `page:${session.searchId}:${
            session.page - 1
          }`
        );
      }

      if (
        session.page <
        pages - 1
      ) {
        keyboard.text(
          "Вперёд ▶",
          `page:${session.searchId}:${
            session.page + 1
          }`
        );
      }

      return {
        text,
        keyboard,
      };
    }
  );
}


async function showPage(
  ctx,
  session,
  edit = false
) {
  const {
    text,
    keyboard,
  } = await renderPage(
    ctx.chat.id,
    session
  );

  const options =
    pageOptions(keyboard);

  if (!edit) {
    const message =
      await ctx.reply(
        text,
        options
      );

    // Запоминаем сообщение, чтобы /clear мог его перерисовать.
    session.messageId =
      message.message_id;

    return;
  }

  session.messageId =
    ctx.callbackQuery?.message
      ?.message_id ??
    session.messageId;

  try {
    await ctx.editMessageText(
      text,
      options
    );
  } catch (error) {
    ignoreNotModified(error);
  }
}


function pageOptions(keyboard) {
  return {
    parse_mode: "HTML",
    reply_markup: keyboard,
    link_preview_options: {
      is_disabled: true,
    },
  };
}


function ignoreNotModified(error) {
  if (
    !String(error)
      .toLowerCase()
      .includes("not modified")
  ) {
    throw error;
  }
}


/*
 * Перерисовать последнее сообщение с результатами
 * (например, после /clear).
 */
async function redrawPage(
  api,
  chatId,
  session
) {
  if (!session.messageId) {
    return;
  }

  const {
    text,
    keyboard,
  } = await renderPage(
    chatId,
    session
  );

  try {
    await api.editMessageText(
      chatId,
      session.messageId,
      text,
      pageOptions(keyboard)
    );
  } catch (error) {
    // Сообщение могло быть удалено или слишком старое —
    // это не повод ронять команду.
    console.warn(
      "Не удалось перерисовать страницу:",
      error.message ?? error
    );
  }
}


/*
 * Сессия для кнопки.
 * В callback_data лежит searchId, поэтому кнопка
 * из старого сообщения работает со своим поиском,
 * а не с тем, что сейчас в памяти.
 */
async function getSessionFor(
  chatId,
  searchId
) {
  const current =
    sessions.get(chatId);

  if (
    current &&
    current.searchId === searchId
  ) {
    return current;
  }

  const session =
    await loadSession(
      chatId,
      searchId
    );

  if (session) {
    sessions.set(
      chatId,
      session
    );
  }

  return session;
}


async function loadSession(
  chatId,
  searchId
) {
  const search =
    await getSearch(
      searchId,
      chatId
    );

  if (!search) {
    return null;
  }

  const leads =
    await getSearchLeads(
      searchId,
      chatId
    );

  return {
    searchId: Number(
      searchId
    ),
    city: search.city,
    category:
      search.category,
    leads,
    page: 0,
  };
}


const HELP =
  "Поиск компаний без сайта и с телефоном.\n\n" +
  "/search кафе Алматы — поиск по категории\n" +
  "/search все Алматы — все категории\n" +
  "/business Алматы — основные категории\n" +
  "/categories — список категорий\n" +
  "/social — вкл/выкл компании только с соцсетью\n" +
  "/mobile — вкл/выкл только мобильные номера\n" +
  "/export — выгрузить последний результат в CSV\n" +
  "/template текст — изменить текст WhatsApp\n" +
  "/note номер текст — заметка к компании\n" +
  "/pipeline — компании в работе и воронка\n" +
  "/stats — статистика и настройки\n" +
  "/clear — сбросить все статусы и заметки\n" +
  "/last — восстановить последний поиск после перезапуска";

const HELP_OWNER =
  HELP +
  "\n\nТолько для владельца:\n" +
  "/search кафе Казахстан — по всему Казахстану (все области)\n" +
  "/users — заявки и пользователи\n" +
  "/revoke ID — закрыть доступ";

function isOwner(ctx) {
  return ctx.from?.id === OWNER_ID;
}

function ownerOnly(handler) {
  return (ctx) =>
    isOwner(ctx)
      ? handler(ctx)
      : ctx.reply("Команда только для владельца.");
}

function userLabel(row) {
  return (
    esc(row.first_name || "Без имени") +
    (row.username ? ` (@${esc(row.username)})` : "")
  );
}

function accessKeyboard(userId) {
  return new InlineKeyboard()
    .text("✅ Одобрить", `access:ok:${userId}`)
    .text("❌ Отклонить", `access:no:${userId}`);
}

const REQUEST_KEYBOARD = new InlineKeyboard().text(
  "Запросить доступ",
  "access:request"
);

/*
 * Доступ: владелец и одобренные пользователи.
 * Остальным бот предлагает отправить заявку, владелец одобряет её кнопкой.
 * Пользователи работают только в личке: их данные привязаны к chat_id.
 */
bot.use(async (ctx, next) => {
  if (isOwner(ctx)) {
    return next();
  }

  if (!ctx.from || ctx.chat?.type !== "private") {
    return;
  }

  const access = await getAccess(ctx.from.id);

  if (
    access?.status === "approved" ||
    ctx.callbackQuery?.data === "access:request"
  ) {
    return next();
  }

  if (ctx.callbackQuery) {
    return ctx.answerCallbackQuery({
      text: "Нет доступа.",
      show_alert: true,
    });
  }

  if (access?.status === "pending") {
    return ctx.reply("Заявка на рассмотрении. Я напишу, когда доступ откроют.");
  }

  return ctx.reply(
    (access?.status === "rejected"
      ? "В доступе отказано. Повторную заявку можно отправить через сутки.\n\n"
      : "Siteless — бот для поиска компаний без сайта.\n\n") +
      "Бот закрытый: нажмите кнопку, и владелец получит заявку.",
    { reply_markup: REQUEST_KEYBOARD }
  );
});


bot.callbackQuery("access:request", async (ctx) => {
  const access = await getAccess(ctx.from.id);

  if (isOwner(ctx) || access?.status === "approved") {
    return ctx.answerCallbackQuery({ text: "Доступ уже открыт. /help" });
  }

  const created = await requestAccess(
    ctx.from.id,
    ctx.from.username,
    ctx.from.first_name
  );

  if (!created) {
    return ctx.answerCallbackQuery({
      text:
        access?.status === "pending"
          ? "Заявка уже отправлена."
          : "Повторную заявку можно отправить через сутки после отказа.",
      show_alert: true,
    });
  }

  try {
    await ctx.api.sendMessage(
      OWNER_ID,
      `Заявка на доступ\n${userLabel(created)}\nID: <code>${created.user_id}</code>`,
      { parse_mode: "HTML", reply_markup: accessKeyboard(created.user_id) }
    );
  } catch (error) {
    console.error("Не удалось отправить заявку владельцу:", error);
  }

  await ctx.answerCallbackQuery();
  await ctx.reply("Заявка отправлена. Я напишу, когда доступ откроют.");
});


bot.callbackQuery(/^access:(ok|no):(\d+)$/, async (ctx) => {
  // Одобренные пользователи проходят общую проверку, поэтому проверяем владельца здесь.
  if (!isOwner(ctx)) {
    return ctx.answerCallbackQuery({ text: "Нет доступа.", show_alert: true });
  }

  const userId = Number(ctx.match[2]);
  const approved = ctx.match[1] === "ok";
  const row = await setAccessStatus(userId, approved ? "approved" : "rejected");

  if (!row) {
    return ctx.answerCallbackQuery({ text: "Заявка не найдена.", show_alert: true });
  }

  try {
    await ctx.editMessageText(
      `${userLabel(row)}\nID: <code>${row.user_id}</code>\n\n` +
        (approved ? "✅ Доступ открыт" : "❌ Отклонено"),
      { parse_mode: "HTML" }
    );
  } catch (error) {
    ignoreNotModified(error);
  }

  // Пользователь мог заблокировать бота — это не ошибка для владельца.
  await ctx.api
    .sendMessage(
      userId,
      approved
        ? "Доступ открыт! Список команд: /help"
        : "К сожалению, в доступе отказано."
    )
    .catch((error) =>
      console.warn("Не удалось уведомить пользователя:", error.message)
    );

  await ctx.answerCallbackQuery({ text: approved ? "Одобрено" : "Отклонено" });
});


bot.command(
  "users",
  ownerOnly(async (ctx) => {
    const rows = await listAccess();

    if (rows.length === 0) {
      return ctx.reply("Заявок и пользователей пока нет.");
    }

    const pending = rows.filter((row) => row.status === "pending");
    const approved = rows.filter((row) => row.status === "approved");

    const line = (row) => `${userLabel(row)} — <code>${row.user_id}</code>`;

    await ctx.reply(
      `Пользователи: ${approved.length}\n` +
        approved.map(line).join("\n") +
        (pending.length
          ? `\n\nЗаявки: ${pending.length} (кнопки ниже)`
          : "") +
        "\n\nЗакрыть доступ: /revoke ID",
      { parse_mode: "HTML" }
    );

    for (const row of pending.slice(0, 10)) {
      await ctx.reply(`Заявка: ${line(row)}`, {
        parse_mode: "HTML",
        reply_markup: accessKeyboard(row.user_id),
      });
    }
  })
);


bot.command(
  "revoke",
  ownerOnly(async (ctx) => {
    const userId = Number(ctx.match.trim());

    if (!Number.isSafeInteger(userId) || userId <= 0) {
      return ctx.reply("Пример: /revoke 123456789 (ID есть в /users)");
    }

    const row = await setAccessStatus(userId, "rejected");

    await ctx.reply(
      row ? "Доступ закрыт." : "Такого пользователя нет в списке."
    );
  })
);


bot.command(
  "id",
  (ctx) =>
    ctx.reply(
      `Твой ID: ${ctx.from.id}`
    )
);


bot.command(
  ["start", "help"],
  (ctx) =>
    ctx.reply(isOwner(ctx) ? HELP_OWNER : HELP)
);


bot.command(
  "categories",
  (ctx) =>
    ctx.reply(
      "Категории: " +
        Object.keys(
          CATEGORIES
        ).join(", ")
    )
);


async function handleSearch(
  ctx,
  categoryName,
  cityRaw
) {
  const chatId =
    ctx.chat.id;

  const cityInput =
    (cityRaw ||
      DEFAULT_CITY).trim();

  const wholeCountry =
    isWholeCountry(cityInput);

  const city = wholeCountry
    ? COUNTRY_NAME
    : cityInput;

  const category =
    CATEGORIES[
      categoryName
    ];

  if (!category) {
    return ctx.reply(
      "Не знаю такую категорию. Список: /categories"
    );
  }

  if (busy.has(chatId)) {
    return ctx.reply(
      "Поиск уже идёт, подожди."
    );
  }

  busy.add(chatId);

  try {
    if (!isOwner(ctx)) {
      if (wholeCountry) {
        return ctx.reply(
          "Поиск по всему Казахстану доступен только владельцу. Укажи город."
        );
      }

      if (!(await takeSearchSlot(chatId, DAILY_SEARCH_LIMIT))) {
        return ctx.reply(
          `Лимит ${DAILY_SEARCH_LIMIT} поисков в день исчерпан. Попробуй завтра.`
        );
      }
    }

    await ctx.reply(
      `Ищу: ${categoryName}, ${city}...` +
        (wholeCountry
          ? "\nИщу по всем областям, это может занять пару минут."
          : "")
    );

    const {
      leads,
      total,
      hidden,
    } = await search(
      chatId,
      category,
      city
    );

    // Пустой поиск не сохраняем, иначе он «затирает»
    // предыдущий результат для /last, /stats и /export.
    if (leads.length === 0) {
      return ctx.reply(
        `Проверено: ${total}. Подходящих новых компаний нет.` +
          (hidden
            ? `\nСкрыто уже обработанных: ${hidden}.`
            : "") +
          "\n\nМожно включить компании только с соцсетью: /social"
      );
    }

    const searchId =
      await saveSearchWithLeads(
        chatId,
        city,
        categoryName,
        leads
      );

    const session =
      await loadSession(
        chatId,
        searchId
      );

    if (!session) {
      throw new Error(
        "Не удалось загрузить сохранённый поиск"
      );
    }

    sessions.set(
      chatId,
      session
    );

    const noSite =
      leads.filter(
        (lead) =>
          lead.kind ===
          "noSite"
      ).length;

    await ctx.reply(
      `Проверено: ${total}\n` +
        `Без сайта: ${noSite}\n` +
        `Только соцсети: ${
          leads.length -
          noSite
        }\n` +
        (hidden
          ? `Скрыто уже обработанных: ${hidden}\n`
          : "") +
        `\nИсточник данных: Geoapify/OpenStreetMap.\n` +
        `Ссылка «проверить сайт» открывает поиск официального сайта компании.`
    );

    await showPage(
      ctx,
      session
    );
  } catch (error) {
    console.error(error);

    await ctx.reply(
      `Ошибка: ${error.message}`
    );
  } finally {
    busy.delete(chatId);
  }
}
bot.command("search", async (ctx) => {
  const { cat, city } = parseQuery(ctx.match);

  if (!cat) {
    return ctx.reply(
      "Пример: /search кафе Алматы"
    );
  }

  startSearch(
    ctx,
    cat,
    city
  );
});


bot.command("business", (ctx) => {
  startSearch(
    ctx,
    "бизнес",
    ctx.match.trim() ||
      DEFAULT_CITY
  );
});


/*
 * grammY обрабатывает обновления по одному.
 * Если ждать поиск прямо в обработчике, бот «замирает»
 * на всё время поиска (кнопки не отвечают).
 * Поэтому поиск запускаем в фоне, а от повторного
 * запуска защищает busy.
 */
function startSearch(
  ctx,
  categoryName,
  city
) {
  handleSearch(
    ctx,
    categoryName,
    city
  ).catch((error) =>
    console.error(
      "Ошибка поиска:",
      error
    )
  );
}


bot.command("last", async (ctx) => {
  const result =
    await getLastSearchLeads(
      ctx.chat.id
    );

  if (
    !result ||
    result.leads.length === 0
  ) {
    return ctx.reply(
      "Сохранённого результата нет."
    );
  }

  const session = {
    searchId: Number(
      result.search.id
    ),
    city: result.search.city,
    category:
      result.search.category,
    leads: result.leads,
    page: 0,
  };

  sessions.set(
    ctx.chat.id,
    session
  );

  await showPage(
    ctx,
    session
  );
});
bot.callbackQuery(
  /^page:(\d+):(\d+)$/,
  async (ctx) => {
    const session =
      await getSessionFor(
        ctx.chat.id,
        Number(ctx.match[1])
      );

    if (!session) {
      return ctx.answerCallbackQuery(
        {
          text:
            "Результаты устарели. Используй /last.",
          show_alert: true,
        }
      );
    }

    session.page = Number(
      ctx.match[2]
    );

    await showPage(
      ctx,
      session,
      true
    );

    await ctx.answerCallbackQuery();
  }
);


/*
 * Кнопка с номером: переключает статус компании по кругу
 */
bot.callbackQuery(
  /^done:(\d+):(\d+)$/,
  async (ctx) => {
    const chatId =
      ctx.chat.id;

    const session =
      await getSessionFor(
        chatId,
        Number(ctx.match[1])
      );

    if (!session) {
      return ctx.answerCallbackQuery(
        {
          text:
            "Результаты устарели. Используй /last.",
          show_alert: true,
        }
      );
    }

    const index = Number(
      ctx.match[2]
    );

    const lead =
      session.leads[index];

    if (!lead) {
      return ctx.answerCallbackQuery();
    }

    const status = nextStatus(lead.status);

    // Сначала пишем в БД, и только при успехе меняем память —
    // иначе отметка в памяти разойдётся с базой.
    try {
      await setLeadStatus(
        chatId,
        lead.id,
        status
      );
    } catch (error) {
      console.error(error);

      return ctx.answerCallbackQuery(
        {
          text:
            "Не удалось сохранить отметку, попробуй ещё раз.",
          show_alert: true,
        }
      );
    }

    lead.status = status;
    lead.done = Boolean(status);

    // Снятие отметки удаляет и заметку.
    if (!status) {
      lead.note = null;
    }

    await showPage(
      ctx,
      session,
      true
    );

    await ctx.answerCallbackQuery(
      {
        text: status
          ? `Статус: ${STATUSES[status].label}`
          : "Отметка снята",
      }
    );
  }
);


/*
 * Кнопки старого формата (без searchId) и прочие
 * неизвестные нажатия — отвечаем, чтобы кнопка не «крутилась».
 */
bot.on(
  "callback_query:data",
  (ctx) =>
    ctx.answerCallbackQuery(
      {
        text:
          "Кнопка устарела. Используй /last.",
        show_alert: true,
      }
    )
);


/*
 * Текущий поиск: из памяти, а после перезапуска — последний из БД.
 */
async function currentSession(chatId) {
  const current = sessions.get(chatId);

  if (current) {
    return current;
  }

  const result = await getLastSearchLeads(chatId);

  if (!result) {
    return null;
  }

  const session = {
    searchId: Number(result.search.id),
    city: result.search.city,
    category: result.search.category,
    leads: result.leads,
    page: 0,
  };

  sessions.set(chatId, session);

  return session;
}


/*
 * Экспорт CSV
 */
bot.command(
  "export",
  async (ctx) => {
    const session =
      await currentSession(
        ctx.chat.id
      );

    if (
      !session ||
      session.leads.length === 0
    ) {
      return ctx.reply(
        "Сначала сделай поиск."
      );
    }

    const settings =
      await getSettings(
        ctx.chat.id,
        DEFAULT_TEMPLATE
      );

    const quote = (value) =>
      `"${String(
        value ?? ""
      ).replaceAll(
        '"',
        '""'
      )}"`;

    const rows = [
      [
        "Название",
        "Адрес",
        "Телефон",
        "Тип",
        "Соцсеть",
        "WhatsApp",
        "Статус",
        "Заметка",
      ],
    ];

    for (const lead of session.leads) {
      rows.push([
        lead.name,
        lead.address,
        lead.phone ?? "",
        lead.kind === "noSite"
          ? "без сайта"
          : "только соцсеть",
        lead.site ?? "",
        buildWa(
          lead,
          settings.template
        ) ?? "",
        lead.status
          ? STATUSES[lead.status].label
          : "",
        lead.note ?? "",
      ]);
    }

    const csv =
      "\uFEFF" +
      rows
        .map((row) =>
          row
            .map(quote)
            .join(";")
        )
        .join("\n");

    await ctx.replyWithDocument(
      new InputFile(
        Buffer.from(
          csv,
          "utf8"
        ),
        "leads.csv"
      )
    );
  }
);


/*
 * Заметка к компании из последнего списка
 */
bot.command("note", async (ctx) => {
  const chatId = ctx.chat.id;
  const match = ctx.match.trim().match(/^(\d+)\s*([\s\S]*)$/);

  if (!match) {
    return ctx.reply(
      "Пример: /note 3 перезвонить в понедельник\n" +
        "Номер — из последнего списка. /note 3 без текста удаляет заметку."
    );
  }

  const session = await currentSession(chatId);

  if (!session) {
    return ctx.reply("Сначала сделай поиск.");
  }

  const lead = session.leads[Number(match[1]) - 1];

  if (!lead) {
    return ctx.reply(`Компании с номером ${match[1]} нет в последнем списке.`);
  }

  const note = match[2].trim();

  if (note.length > 500) {
    return ctx.reply("Слишком длинно. Максимум 500 символов.");
  }

  if (!note && !lead.note) {
    return ctx.reply("У этой компании нет заметки.");
  }

  lead.status = await setLeadNote(chatId, lead.id, note || null);
  lead.note = note || null;
  lead.done = true;

  await redrawPage(ctx.api, chatId, session);

  await ctx.reply(
    note ? `Заметка сохранена: ${lead.name}` : "Заметка удалена."
  );
});


/*
 * Воронка и компании в работе
 */
bot.command("pipeline", async (ctx) => {
  const counts = await getStatusCounts(ctx.chat.id);
  const rows = await getPipeline(ctx.chat.id);

  const funnel = Object.entries(STATUSES)
    .map(([key, { icon, label }]) => `${icon} ${label}: ${counts[key] ?? 0}`)
    .join("\n");

  const list = rows
    .map(
      (row) =>
        `${STATUSES[row.status].icon} <b>${esc(row.name)}</b>` +
        (row.phone ? ` · ${esc(row.phone)}` : "") +
        (row.note ? `\n📝 ${esc(row.note)}` : "")
    )
    .join("\n\n");

  await ctx.reply(
    `<b>Воронка</b>\n${funnel}` +
      (list
        ? `\n\n<b>В работе</b>\n${list}`
        : "\n\nКомпаний со статусом «ответил» или «клиент» пока нет."),
    { parse_mode: "HTML" }
  );
});


/*
 * Только мобильные номера
 */
bot.command(
  "mobile",
  async (ctx) => {
    const settings =
      await getSettings(
        ctx.chat.id,
        DEFAULT_TEMPLATE
      );

    const updated =
      await updateSetting(
        ctx.chat.id,
        "only_mobile",
        !settings.only_mobile
      );

    await ctx.reply(
      updated.only_mobile
        ? "Включено: только мобильные номера."
        : "Выключено: показываю и городские номера."
    );
  }
);


/*
 * Показывать компании
 * только с соцсетями
 */
bot.command(
  "social",
  async (ctx) => {
    const settings =
      await getSettings(
        ctx.chat.id,
        DEFAULT_TEMPLATE
      );

    const updated =
      await updateSetting(
        ctx.chat.id,
        "with_social",
        !settings.with_social
      );

    await ctx.reply(
      updated.with_social
        ? "Включено: компании только с соцсетью тоже показываются."
        : "Выключено: компании только с соцсетью скрываются."
    );
  }
);


/*
 * Изменение шаблона WhatsApp
 */
bot.command(
  "template",
  async (ctx) => {
    const settings =
      await getSettings(
        ctx.chat.id,
        DEFAULT_TEMPLATE
      );

    const text =
      ctx.match.trim();

    if (!text) {
      return ctx.reply(
        `Текущий шаблон:\n${settings.template}\n\n` +
          "Изменить: /template Ваш текст. {name} заменится на название компании."
      );
    }

    if (text.length > 500) {
      return ctx.reply(
        "Слишком длинно. Максимум 500 символов."
      );
    }

    await updateSetting(
      ctx.chat.id,
      "template",
      text
    );

    await ctx.reply(
      "Шаблон сохранён."
    );
  }
);


/*
 * Статистика
 */
bot.command(
  "stats",
  async (ctx) => {
    const settings =
      await getSettings(
        ctx.chat.id,
        DEFAULT_TEMPLATE
      );

    const latest =
      await getLatestSearch(
        ctx.chat.id
      );

    const counts =
      await getStatusCounts(
        ctx.chat.id
      );

    const marked = Object.values(
      counts
    ).reduce((sum, count) => sum + count, 0);

    const usage = isOwner(ctx)
      ? ""
      : `Поисков сегодня: ${await getSearchesToday(
          ctx.chat.id
        )}/${DAILY_SEARCH_LIMIT}\n`;

    await ctx.reply(
      `Компаний с отметкой: ${marked} (подробно: /pipeline)\n` +
        usage +
        `Только мобильные: ${
          settings.only_mobile
            ? "да"
            : "нет"
        }\n` +
        `Показывать соцсети: ${
          settings.with_social
            ? "да"
            : "нет"
        }\n` +
        (
          latest
            ? `Последний поиск: ${latest.city}, ${latest.category}`
            : "Поиска пока не было"
        )
    );
  }
);


bot.command(
  "clear",
  async (ctx) => {
    await clearContacted(
      ctx.chat.id
    );

    const session =
      sessions.get(
        ctx.chat.id
      );

    if (session) {
      session.leads.forEach(
        (lead) => {
          lead.done = false;
          lead.status = null;
          lead.note = null;
        }
      );

      // Убираем ✅ и в уже показанном сообщении.
      await redrawPage(
        ctx.api,
        ctx.chat.id,
        session
      );
    }

    await ctx.reply(
      "Все статусы и заметки сброшены."
    );
  }
);



bot.catch((error) => {
  console.error(
    "Ошибка бота:",
    error.error ?? error
  );
});


/*
 * Корректное завершение
 */
async function shutdown(
  signal
) {
  console.log(
    `${signal}: завершаю работу...`
  );

  // bot.stop() подтверждает offset последнего обновления,
  // иначе после перезапуска оно может обработаться повторно.
  try {
    await bot.stop();
  } catch (error) {
    console.error(error);
  }

  await closeDb();

  process.exit(0);
}

process.once(
  "SIGINT",
  () => shutdown("SIGINT")
);

process.once(
  "SIGTERM",
  () => shutdown("SIGTERM")
);


/*
 * Запуск базы данных
 */
await initDb();


/*
 * Команды Telegram-бота
 */
const COMMANDS = [
  { command: "search", description: "Поиск компаний" },
  { command: "business", description: "Основные категории бизнеса" },
  { command: "pipeline", description: "Компании в работе" },
  { command: "note", description: "Заметка к компании" },
  { command: "social", description: "Показывать соцсети" },
  { command: "mobile", description: "Только мобильные номера" },
  { command: "export", description: "Выгрузить CSV" },
  { command: "template", description: "Текст WhatsApp" },
  { command: "stats", description: "Статистика" },
  { command: "clear", description: "Сбросить статусы" },
  { command: "last", description: "Восстановить последний поиск" },
  { command: "categories", description: "Список категорий" },
];

await bot.api.setMyCommands(COMMANDS);

// Владельцу в меню видны и админские команды.
await bot.api
  .setMyCommands(
    [
      ...COMMANDS,
      { command: "users", description: "Заявки и пользователи" },
      { command: "revoke", description: "Закрыть доступ" },
    ],
    { scope: { type: "chat", chat_id: OWNER_ID } }
  )
  .catch((error) =>
    console.warn("Не удалось задать меню владельца:", error.message)
  );


bot.start({
  onStart: () =>
    console.log(
      "Бот запущен"
    ),
});