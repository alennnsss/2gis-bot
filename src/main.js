import { createApp } from "vue";
import "./style.css";

const App = {
  template: `
    <main class="page">
      <section class="hero">
        <div class="badge">Telegram Lead Finder</div>
        <h1>Lead Finder Bot</h1>
        <p>
          Поиск компаний без обычного сайта с сохранением лидов,
          настроек и истории в PostgreSQL.
        </p>
        <div class="buttons">
          <a href="https://t.me/" target="_blank" rel="noreferrer">Telegram</a>
          <a class="secondary" href="https://github.com/" target="_blank" rel="noreferrer">GitHub</a>
        </div>
      </section>

      <section class="grid">
        <article><strong>PostgreSQL</strong><span>Отдельная база данных</span></article>
        <article><strong>Geoapify</strong><span>Поиск организаций</span></article>
        <article><strong>WhatsApp</strong><span>Готовые ссылки для связи</span></article>
        <article><strong>CSV</strong><span>Экспорт найденных лидов</span></article>
      </section>

      <section class="commands">
        <h2>Команды бота</h2>
        <code>/search кафе Алматы</code>
        <code>/business Алматы</code>
        <code>/export</code>
        <code>/last</code>
        <code>/stats</code>
      </section>
    </main>
  `
};

createApp(App).mount("#app");
