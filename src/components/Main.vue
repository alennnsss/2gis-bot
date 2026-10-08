<script setup>
import { ref } from "vue";

const email = "sainalenkz@gmail.com";
const botUrl = "https://t.me/newitgis_bot";
const mailto =
  `mailto:${email}?subject=` +
  encodeURIComponent("Доступ к боту Siteless") +
  "&body=" +
  encodeURIComponent("Здравствуйте! Хочу получить доступ к боту Siteless.\n\nМой Telegram: @\nГород / ниша: ");

const copied = ref(false);

async function copyEmail() {
  try {
    await navigator.clipboard.writeText(email);
    copied.value = true;
    setTimeout(() => (copied.value = false), 2000);
  } catch {
    // буфер обмена недоступен — остаётся ссылка mailto
  }
}

const features = [
  { title: "Без сайта", text: "Только компании с телефоном и без настоящего сайта" },
  { title: "Мобильные", text: "Фильтр мобильных номеров KZ и RU — сразу в WhatsApp" },
  { title: "Весь Казахстан", text: "Поиск по городу или сразу по 20 регионам страны" },
  { title: "CSV", text: "Экспорт найденных лидов в Excel одной командой" },
];

const steps = [
  { title: "Ищете", text: "Пишете боту категорию и город, например «кафе Алматы»." },
  { title: "Фильтруете", text: "Бот отбрасывает компании с сайтом и без телефона, мобильные номера идут первыми." },
  { title: "Пишете", text: "Ссылка на WhatsApp с вашим шаблоном. Отметка «написал» скрывает компанию из следующих поисков." },
];

const commands = [
  ["/search кафе Алматы", "поиск по категории и городу"],
  ["/search кафе Казахстан", "поиск по всей стране"],
  ["/business Алматы", "основные категории бизнеса"],
  ["/mobile", "только мобильные номера"],
  ["/social", "показывать компании с одной соцсетью"],
  ["/template <текст>", "шаблон сообщения для WhatsApp"],
  ["/export", "выгрузка в CSV"],
  ["/last", "открыть последний поиск"],
  ["/stats", "статистика и настройки"],
];
</script>

<template>
  <main id="top" class="container page">
    <section class="hero">
      <div class="badge">Telegram-бот для поиска лидов</div>
      <h1>Siteless</h1>
      <p>
        Находит компании, у которых нет сайта, но есть телефон. Готовый список
        клиентов для веб-студий и фрилансеров: с WhatsApp-ссылками,
        отметками «написал» и экспортом в CSV.
      </p>
      <div class="buttons">
        <a :href="botUrl" class="btn" target="_blank" rel="noopener">Открыть @newitgis_bot</a>
        <a href="#access" class="btn secondary">Получить доступ</a>
      </div>
    </section>

    <section class="grid">
      <article v-for="f in features" :key="f.title" class="card">
        <strong>{{ f.title }}</strong>
        <span>{{ f.text }}</span>
      </article>
    </section>

    <section id="how" class="block">
      <h2>Как это работает</h2>
      <ol class="steps">
        <li v-for="(s, i) in steps" :key="s.title">
          <span class="step-num">{{ i + 1 }}</span>
          <div>
            <strong>{{ s.title }}</strong>
            <p>{{ s.text }}</p>
          </div>
        </li>
      </ol>
    </section>

    <section id="commands" class="block">
      <h2>Команды бота</h2>
      <ul class="commands">
        <li v-for="[cmd, desc] in commands" :key="cmd">
          <code>{{ cmd }}</code>
          <span>{{ desc }}</span>
        </li>
      </ul>
    </section>

    <section id="access" class="block access">
      <h2>Получить доступ</h2>
      <p>
        Бот закрытый: работает только для одобренных пользователей.
        Напишите на почту, укажите свой Telegram, и я открою доступ к @newitgis_bot.
      </p>
      <div class="email-row">
        <a :href="mailto" class="btn">Написать на {{ email }}</a>
        <button type="button" class="btn secondary" @click="copyEmail">
          {{ copied ? "Скопировано" : "Скопировать email" }}
        </button>
        <a :href="botUrl" class="btn secondary" target="_blank" rel="noopener">Открыть бота в Telegram</a>
      </div>
    </section>
  </main>
</template>
