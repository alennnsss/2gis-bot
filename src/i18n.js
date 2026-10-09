import { createI18n } from "vue-i18n";

const messages = {
  ru: {
    meta: {
      title: "Siteless — лиды без сайта",
    },
    nav: {
      how: "Как работает",
      commands: "Команды",
      faq: "FAQ",
      about: "О нас",
      access: "Доступ",
      label: "Разделы",
      bot: "Открыть бота",
      lang: "Сменить язык",
    },
    hero: {
      title1: "Лиды без сайта за минуту",
      text: "Находит компании, у которых нет сайта, но есть телефон. Готовый список клиентов для веб-студий и фрилансеров: с WhatsApp-ссылками, статусами и экспортом в CSV.",
      open: "Открыть {bot}",
      title2: "Мини-CRM для веб-студий",
      text2: "Статусы, заметки и экспорт в CSV — вся работа с клиентами в одном Telegram-чате.",
      access: "Получить доступ",
    },
    features: {
      title: "Возможности",
      all: "Все команды",
      try: "Попробовать",
      nosite: { title: "Без сайта", tag: "Поиск", text: "Только компании с телефоном и без настоящего сайта" },
      mobile: { title: "Мобильные", tag: "Фильтр", text: "Фильтр мобильных номеров KZ и RU — сразу в WhatsApp" },
      crm: { title: "Мини-CRM", tag: "Воронка", text: "Статусы «написал → ответил → клиент» и заметки к компаниям" },
      csv: { title: "CSV", tag: "Экспорт", text: "Экспорт найденных лидов в Excel одной командой" },
    },
    demo: {
      title: "Как это выглядит",
      hint: "Нажимайте на кнопки — они работают так же, как в боте.",
      statusBtn: "Изменить статус компании {n}",
    },
    how: {
      title: "Как это работает",
      search: { title: "Ищете", text: "Пишете боту категорию и город, например «кафе Алматы»." },
      filter: { title: "Фильтруете", text: "Бот отбрасывает компании с сайтом и без телефона, мобильные номера идут первыми." },
      write: { title: "Ведёте", text: "Пишете в WhatsApp по шаблону и отмечаете статус: написал, ответил, клиент или отказ." },
      stats: { places: "компаний за один поиск", limit: "поисков в день", statuses: "статуса в мини-CRM" },
    },
    commands: {
      title: "Команды бота",
      count: "{n} команд",
      search: "поиск по категории и городу",
      business: "основные категории бизнеса",
      pipeline: "компании в работе и воронка",
      note: "заметка к компании",
      mobile: "только мобильные номера",
      social: "показывать компании с одной соцсетью",
      template: "шаблон сообщения для WhatsApp",
      export: "выгрузка в CSV",
      stats: "статистика и настройки",
    },
    access: {
      title: "Получить доступ",
      text: "Бот закрытый. Оставьте заявку, затем откройте {bot} и нажмите «Запросить доступ» — после одобрения бот пришлёт сообщение.",
      or: "Или напишите на почту",
      mail: "Написать письмо",
      copy: "Скопировать email",
      copied: "Скопировано",
      openBot: "Открыть бота в Telegram",
      subject: "Доступ к боту Siteless",
      body: "Здравствуйте! Хочу получить доступ к боту Siteless.\n\nМой Telegram: \nГород / ниша: ",
    },
    form: {
      title: "Заявка на доступ",
      telegram: "Ваш Telegram",
      telegramHint: "Username без пробелов, от 5 символов",
      niche: "Город и ниша (необязательно)",
      nichePlaceholder: "Алматы, сайты для кафе",
      submit: "Отправить заявку",
      sending: "Отправляю…",
      sent: "Заявка отправлена! Теперь откройте {bot} и нажмите «Запросить доступ».",
      error: "Не получилось отправить заявку. Напишите на почту, ответим так же быстро.",
    },
    faq: {
      title: "Частые вопросы",
      source: { q: "Откуда берутся компании?", a: "Из Geoapify и OpenStreetMap. Бот оставляет только компании с телефоном и без своего сайта. Контакты заполнены не у всех, поэтому часть компаний на карте в выдачу не попадает." },
      cities: { q: "По каким городам можно искать?", a: "По любому городу. Лучше всего бот знает Казахстан: Алматы, Астана, Шымкент и другие." },
      limit: { q: "Сколько поисков можно делать?", a: "До 10 поисков в день. Один поиск — одна категория в одном городе, до 1500 компаний." },
      privacy: { q: "Кто видит мои статусы и заметки?", a: "Только вы. История поисков, статусы и заметки у каждого пользователя свои." },
      access: { q: "Сколько ждать доступа?", a: "Заявки проверяются вручную, обычно в течение дня. Когда доступ откроют, бот напишет сам." },
    },
    about: {
      title: "О нас",
      text: "Меня зовут Sain Alen. Я разрабатываю Siteless — Telegram-бота, который помогает находить клиентов без сайта.",
      github: "Мой GitHub",
      photo: "Фото Sain Alen",
    },
    footer: {
      tagline: "Находим компании без сайта, чтобы вы находили клиентов.",
      bot: "Бот",
      project: "Проект",
      contact: "Связь",
      data: "Данные: Geoapify / OpenStreetMap",
    },
  },
  en: {
    meta: {
      title: "Siteless — leads without a website",
    },
    nav: {
      how: "How it works",
      commands: "Commands",
      faq: "FAQ",
      about: "About us",
      access: "Access",
      label: "Sections",
      bot: "Open the bot",
      lang: "Switch language",
    },
    hero: {
      title1: "Leads without a website in a minute",
      text: "Finds businesses that have a phone number but no website. A ready-made client list for web studios and freelancers, with WhatsApp links, statuses and CSV export.",
      open: "Open {bot}",
      title2: "A mini CRM for web studios",
      text2: "Statuses, notes and CSV export — all your client work in one Telegram chat.",
      access: "Get access",
    },
    features: {
      title: "Features",
      all: "All commands",
      try: "Try it",
      nosite: { title: "No website", tag: "Search", text: "Only businesses with a phone and without a real website" },
      mobile: { title: "Mobile", tag: "Filter", text: "Filter KZ and RU mobile numbers — straight to WhatsApp" },
      crm: { title: "Mini CRM", tag: "Funnel", text: "“Contacted → replied → client” statuses and notes for each business" },
      csv: { title: "CSV", tag: "Export", text: "Export found leads to Excel with one command" },
    },
    demo: {
      title: "What it looks like",
      hint: "Tap the buttons — they work just like in the bot (which replies in Russian).",
      statusBtn: "Change the status of business {n}",
    },
    how: {
      title: "How it works",
      search: { title: "Search", text: "Send the bot a category and a city, e.g. “кафе Алматы”." },
      filter: { title: "Filter", text: "The bot drops businesses with a website or without a phone; mobile numbers come first." },
      write: { title: "Follow up", text: "Message them on WhatsApp with your template and track the status: contacted, replied, client or declined." },
      stats: { places: "businesses per search", limit: "searches per day", statuses: "statuses in the mini CRM" },
    },
    commands: {
      title: "Bot commands",
      count: "{n} commands",
      search: "search by category and city",
      business: "main business categories",
      pipeline: "businesses in progress and funnel",
      note: "add a note to a business",
      mobile: "mobile numbers only",
      social: "show businesses with social media only",
      template: "WhatsApp message template",
      export: "export to CSV",
      stats: "stats and settings",
    },
    access: {
      title: "Get access",
      text: "The bot is private. Leave a request, then open {bot} and tap “Запросить доступ” (Request access) — the bot will message you once you are approved.",
      or: "Or email me",
      mail: "Send an email",
      copy: "Copy email",
      copied: "Copied",
      openBot: "Open the bot in Telegram",
      subject: "Access to the Siteless bot",
      body: "Hi! I would like to get access to the Siteless bot.\n\nMy Telegram: \nCity / niche: ",
    },
    form: {
      title: "Access request",
      telegram: "Your Telegram",
      telegramHint: "Username without spaces, at least 5 characters",
      niche: "City and niche (optional)",
      nichePlaceholder: "Almaty, websites for cafes",
      submit: "Send request",
      sending: "Sending…",
      sent: "Request sent! Now open {bot} and tap “Запросить доступ” (Request access).",
      error: "Could not send the request. Please email me instead — I reply just as fast.",
    },
    faq: {
      title: "FAQ",
      source: { q: "Where do the businesses come from?", a: "From Geoapify and OpenStreetMap. The bot keeps only businesses with a phone and without their own website. Not every place has contacts filled in, so some businesses on the map are skipped." },
      cities: { q: "Which cities can I search?", a: "Any city. The bot works best for Kazakhstan: Almaty, Astana, Shymkent and others." },
      limit: { q: "How many searches can I run?", a: "Up to 10 searches a day. One search is one category in one city, up to 1,500 businesses." },
      privacy: { q: "Who can see my statuses and notes?", a: "Only you. Search history, statuses and notes are separate for every user." },
      access: { q: "How long does approval take?", a: "Requests are reviewed manually, usually within a day. The bot will message you once access is granted." },
    },
    about: {
      title: "About us",
      text: "My name is Sain Alen. I build Siteless — a Telegram bot that helps you find clients without a website.",
      github: "My GitHub",
      photo: "Sain Alen as a kid",
    },
    footer: {
      tagline: "We find businesses without a website so you can find clients.",
      bot: "Bot",
      project: "Project",
      contact: "Contact",
      data: "Data: Geoapify / OpenStreetMap",
    },
  },
};

function savedLocale() {
  try {
    const saved = localStorage.getItem("locale");
    if (saved in messages) return saved;
  } catch {
    // localStorage недоступен
  }
  return navigator.language?.startsWith("ru") ? "ru" : "en";
}

export const i18n = createI18n({
  legacy: false,
  locale: savedLocale(),
  fallbackLocale: "ru",
  messages,
});

function applyLocale(locale) {
  document.documentElement.lang = locale;
  document.title = messages[locale].meta.title;
}

export function setLocale(locale) {
  i18n.global.locale.value = locale;
  applyLocale(locale);
  try {
    localStorage.setItem("locale", locale);
  } catch {
    // localStorage недоступен
  }
}

applyLocale(i18n.global.locale.value);
