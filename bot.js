import { Bot, InlineKeyboard, InputFile } from "grammy";
import "dotenv/config";

import {
  initDb,
  pool,
  getSettings,
  updateSetting,
  saveLead,
  createSearch,
  addSearchResult,
  markContacted,
  getContactedCount,
  clearContacted,
  getSearch,
  getLatestSearch,
  getSearchLeads,
  getLastSearchLeads,
  getHiddenCount,
} from "./db.js";

const API_TOKEN = process.env.API_TOKEN;
const GEOAPIFY_KEY = process.env.GEOAPIFY_KEY;
const OWNER_ID = Number(process.env.OWNER_ID);
const MAX_PLACES = Number(process.env.MAX_PLACES) || 1500;
const DEFAULT_CITY = process.env.DEFAULT_CITY || "Алматы";
const PAGE_SIZE = 5;

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
    const host = new URL(link)
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

function isMobile(phone) {
  return /^\+7(70[0-8]|747|77[1-8])/.test(phone);
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

/*
 * ВАЖНО:
 * Эта функция теперь всегда создаёт ссылку заново.
 *
 * Поэтому даже если lead.check отсутствует в PostgreSQL,
 * кнопка "проверить сайт" всё равно будет работать.
 */
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
      console.warn(
        `Группа «${group}» пропущена: ${error.message}`
      );
    }
  }

  return features;
}

async function search(chatId, categoryName, category, city) {
  const geocode = new URL(
    "https://api.geoapify.com/v1/geocode/search"
  );

  geocode.searchParams.set("text", city);
  geocode.searchParams.set("bias", "countrycode:kz");
  geocode.searchParams.set("format", "json");
  geocode.searchParams.set("apiKey", GEOAPIFY_KEY);

  const geo = await getJson(geocode);

  const place = geo.results?.[0];

  if (!place) {
    throw new Error(`Город «${city}» не найден`);
  }

  const features = await fetchPlaces(
    category,
    place.place_id,
    MAX_PLACES
  );

  const settings = await getSettings(
    chatId,
    DEFAULT_TEMPLATE
  );

  const leads = [];
  const seen = new Set();

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

    let kind;
    let site = null;

    if (sites.length === 0) {
      if (!phone) {
        continue;
      }

      kind = "noSite";
    } else {
      kind = "social";
      site = sites.find(isSocial) ?? sites[0];
    }

    if (kind === "social" && !settings.with_social) {
      continue;
    }

    const mobile = phone ? isMobile(phone) : false;

    if (settings.only_mobile && !mobile) {
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

      // Ссылка создаётся здесь.
      // Но ниже мы также создаём её при отображении,
      // поэтому отсутствие check в БД больше не проблема.
      check: buildCheckUrl(
        String(properties.name),
        city
      ),

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
  };
}

async function saveSearch(chatId, city, categoryName, leads) {
  const searchId = await createSearch(
    chatId,
    city,
    categoryName
  );

  for (let index = 0; index < leads.length; index++) {
    const lead = leads[index];

    await saveLead(
      lead,
      city,
      categoryName
    );

    await addSearchResult(
      searchId,
      lead.id,
      index
    );
  }

  return searchId;
}
function parseQuery(text = "") {
  const normalized = text.trim().toLowerCase();

  if (!normalized) {
    return {
      cat: "",
      city: DEFAULT_CITY,
    };
  }

  if (normalized.includes(",")) {
    const [category, ...rest] = normalized.split(",");

    return {
      cat: category.trim(),
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
        normalized.slice(key.length).trim() ||
        DEFAULT_CITY,
    };
  }

  const [first, ...rest] = normalized.split(/\s+/);

  return {
    cat: first,
    city: rest.join(" ") || DEFAULT_CITY,
  };
}


/*
 * Формируем текст одной компании.
 *
 * Раньше здесь было:
 *
 *   lead.check
 *
 * Но после загрузки компании из PostgreSQL
 * этого поля могло уже не быть.
 *
 * Теперь ссылка всегда строится через buildCheckUrl().
 */
function leadText(
  lead,
  number,
  template,
  city
) {
  const lines = [
    `<b>${number}. ${
      lead.done ? "✅ " : ""
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

  /*
   * Проверка сайта.
   *
   * Даже если lead.check отсутствует,
   * ссылка всё равно будет создана.
   */
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
        `Кнопка с номером отмечает «написал».\n\n` +
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
              lead.done
                ? "✅"
                : "📩"
            } ${
              start + index + 1
            }`,
            `done:${
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
          `page:${
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
          `page:${
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

  const options = {
    parse_mode: "HTML",
    reply_markup: keyboard,
    link_preview_options: {
      is_disabled: true,
    },
  };

  if (!edit) {
    await ctx.reply(
      text,
      options
    );

    return;
  }

  try {
    await ctx.editMessageText(
      text,
      options
    );
  } catch (error) {
    if (
      !String(error)
        .toLowerCase()
        .includes("not modified")
    ) {
      throw error;
    }
  }
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
  "/stats — статистика и настройки\n" +
  "/clear — сбросить отметки «написал»\n" +
  "/last — восстановить последний поиск после перезапуска";


/*
 * Доступ только владельцу.
 */
bot.use(
  async (ctx, next) => {
    if (
      ctx.from?.id !==
      OWNER_ID
    ) {
      return ctx.reply?.(
        "Нет доступа."
      );
    }

    await next();
  }
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
    ctx.reply(HELP)
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

  const city =
    (cityRaw ||
      DEFAULT_CITY).trim();

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
    await ctx.reply(
      `Ищу: ${categoryName}, ${city}...`
    );

    const {
      leads,
      total,
    } = await search(
      chatId,
      categoryName,
      category,
      city
    );

    const searchId =
      await saveSearch(
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

    if (
      !session ||
      session.leads.length === 0
    ) {
      const hidden =
        await getHiddenCount(
          chatId,
          searchId
        );

      return ctx.reply(
        `Проверено: ${total}. Подходящих новых компаний нет.` +
          (hidden
            ? `\nСкрыто уже обработанных: ${hidden}.`
            : "") +
          "\n\nМожно включить компании только с соцсетью: /social"
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
        }\n\n` +
        `Источник данных: Geoapify/OpenStreetMap.\n` +
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

  await handleSearch(
    ctx,
    cat,
    city
  );
});


bot.command("business", (ctx) =>
  handleSearch(
    ctx,
    "бизнес",
    ctx.match.trim() ||
      DEFAULT_CITY
  )
);


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


/*
 * Переключение страницы
 */
bot.callbackQuery(
  /^page:(\d+)$/,
  async (ctx) => {
    const session =
      sessions.get(
        ctx.chat.id
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
      ctx.match[1]
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
 * Кнопка "написал"
 */
bot.callbackQuery(
  /^done:(\d+)$/,
  async (ctx) => {
    const chatId =
      ctx.chat.id;

    const session =
      sessions.get(chatId);

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
      ctx.match[1]
    );

    const lead =
      session.leads[index];

    if (!lead) {
      return ctx.answerCallbackQuery();
    }

    lead.done = !lead.done;

    await markContacted(
      chatId,
      lead.id,
      lead.done
    );

    await showPage(
      ctx,
      session,
      true
    );

    await ctx.answerCallbackQuery(
      {
        text: lead.done
          ? "Отмечено"
          : "Отметка снята",
      }
    );
  }
);


/*
 * Экспорт CSV
 */
bot.command(
  "export",
  async (ctx) => {
    let session =
      sessions.get(
        ctx.chat.id
      );

    if (!session) {
      const result =
        await getLastSearchLeads(
          ctx.chat.id
        );

      if (result) {
        session = {
          searchId: Number(
            result.search.id
          ),
          city:
            result.search.city,
          category:
            result.search.category,
          leads:
            result.leads,
          page: 0,
        };
      }
    }

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
        "Написал",
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
        lead.done
          ? "да"
          : "",
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

    const contacted =
      await getContactedCount(
        ctx.chat.id
      );

    await ctx.reply(
      `Отмечено «написал»: ${contacted}\n` +
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


/*
 * Сброс отметок
 */
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
        }
      );
    }

    await ctx.reply(
      "Все отметки «написал» сброшены."
    );
  }
);


/*
 * Обработка ошибок
 */
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

  await pool.end();

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
await bot.api.setMyCommands([
  {
    command: "search",
    description:
      "Поиск компаний",
  },
  {
    command: "business",
    description:
      "Основные категории бизнеса",
  },
  {
    command: "social",
    description:
      "Показывать соцсети",
  },
  {
    command: "mobile",
    description:
      "Только мобильные номера",
  },
  {
    command: "export",
    description:
      "Выгрузить CSV",
  },
  {
    command: "template",
    description:
      "Текст WhatsApp",
  },
  {
    command: "stats",
    description:
      "Статистика",
  },
  {
    command: "clear",
    description:
      "Сбросить отметки",
  },
  {
    command: "last",
    description:
      "Восстановить последний поиск",
  },
  {
    command: "categories",
    description:
      "Список категорий",
  },
]);



bot.start({
  onStart: () =>
    console.log(
      "Бот запущен"
    ),
});