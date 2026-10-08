import { createI18n } from "vue-i18n";

const messages = {
  ru: {
    nav: {
      how: "Как работает",
      commands: "Команды",
      about: "О нас",
      access: "Получить доступ",
    },
    hero: {
      badge: "Telegram-бот для поиска лидов",
      text: "Находит компании, у которых нет сайта, но есть телефон. Готовый список клиентов для веб-студий и фрилансеров: с WhatsApp-ссылками, отметками «написал» и экспортом в CSV.",
      open: "Открыть {bot}",
      access: "Получить доступ",
    },
    features: {
      nosite: { title: "Без сайта", text: "Только компании с телефоном и без настоящего сайта" },
      mobile: { title: "Мобильные", text: "Фильтр мобильных номеров KZ и RU — сразу в WhatsApp" },
      country: { title: "Весь Казахстан", text: "Поиск по городу или сразу по 20 регионам страны" },
      csv: { title: "CSV", text: "Экспорт найденных лидов в Excel одной командой" },
    },
    how: {
      title: "Как это работает",
      search: { title: "Ищете", text: "Пишете боту категорию и город, например «кафе Алматы»." },
      filter: { title: "Фильтруете", text: "Бот отбрасывает компании с сайтом и без телефона, мобильные номера идут первыми." },
      write: { title: "Пишете", text: "Ссылка на WhatsApp с вашим шаблоном. Отметка «написал» скрывает компанию из следующих поисков." },
    },
    commands: {
      title: "Команды бота",
      search: "поиск по категории и городу",
      country: "поиск по всей стране",
      business: "основные категории бизнеса",
      mobile: "только мобильные номера",
      social: "показывать компании с одной соцсетью",
      template: "шаблон сообщения для WhatsApp",
      export: "выгрузка в CSV",
      last: "открыть последний поиск",
      stats: "статистика и настройки",
    },
    access: {
      title: "Получить доступ",
      text: "Бот закрытый: работает только для одобренных пользователей. Напишите на почту, укажите свой Telegram, и я открою доступ к {bot}.",
      write: "Написать на {email}",
      copy: "Скопировать email",
      copied: "Скопировано",
      openBot: "Открыть бота в Telegram",
      subject: "Доступ к боту Siteless",
      body: "Здравствуйте! Хочу получить доступ к боту Siteless.\n\nМой Telegram: \nГород / ниша: ",
    },
    about: {
      title: "О нас",
      text: "Меня зовут Sain Alen. Я разрабатываю Siteless — Telegram-бота, который помогает находить клиентов без сайта.",
      github: "Мой GitHub",
    },
    footer: {
      data: "Данные: Geoapify / OpenStreetMap",
    },
  },
  en: {
    nav: {
      how: "How it works",
      commands: "Commands",
      about: "About us",
      access: "Get access",
    },
    hero: {
      badge: "Telegram bot for lead generation",
      text: "Finds businesses that have a phone number but no website. A ready-made client list for web studios and freelancers, with WhatsApp links, “contacted” marks and CSV export.",
      open: "Open {bot}",
      access: "Get access",
    },
    features: {
      nosite: { title: "No website", text: "Only businesses with a phone and without a real website" },
      mobile: { title: "Mobile", text: "Filter KZ and RU mobile numbers — straight to WhatsApp" },
      country: { title: "All of Kazakhstan", text: "Search a city or all 20 regions of the country at once" },
      csv: { title: "CSV", text: "Export found leads to Excel with one command" },
    },
    how: {
      title: "How it works",
      search: { title: "Search", text: "Send the bot a category and a city, e.g. “кафе Алматы”." },
      filter: { title: "Filter", text: "The bot drops businesses with a website or without a phone; mobile numbers come first." },
      write: { title: "Reach out", text: "A WhatsApp link with your template. The “contacted” mark hides the business from future searches." },
    },
    commands: {
      title: "Bot commands",
      search: "search by category and city",
      country: "search the whole country",
      business: "main business categories",
      mobile: "mobile numbers only",
      social: "show businesses with social media only",
      template: "WhatsApp message template",
      export: "export to CSV",
      last: "open the last search",
      stats: "stats and settings",
    },
    access: {
      title: "Get access",
      text: "The bot is private and works only for approved users. Email me with your Telegram username and I will give you access to {bot}.",
      write: "Email {email}",
      copy: "Copy email",
      copied: "Copied",
      openBot: "Open the bot in Telegram",
      subject: "Access to the Siteless bot",
      body: "Hi! I would like to get access to the Siteless bot.\n\nMy Telegram: \nCity / niche: ",
    },
    about: {
      title: "About us",
      text: "My name is Sain Alen. I build Siteless — a Telegram bot that helps you find clients without a website.",
      github: "My GitHub",
      photo: "Sain Alen as a kid",
    },
    footer: {
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

export function setLocale(locale) {
  i18n.global.locale.value = locale;
  document.documentElement.lang = locale;
  try {
    localStorage.setItem("locale", locale);
  } catch {
    // localStorage недоступен
  }
}

document.documentElement.lang = i18n.global.locale.value;
