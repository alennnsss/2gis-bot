<script setup>
import { useI18n } from "vue-i18n";

const { t } = useI18n();

const leads = [
  { n: 1, status: "✅", name: "Кафе «Пример»", address: "ул. Абая, 10", phone: "+7 700 000 00 01" },
  { n: 2, status: "", name: "Кофейня «Демо»", address: "пр. Достык, 25", phone: "+7 700 000 00 02" },
];
</script>

<template>
  <section class="block">
    <h2>{{ t("demo.title") }}</h2>
    <div class="chat" aria-hidden="true">
      <div class="chat-head">
        <img src="/bot-icon.svg" alt="" width="36" height="36" />
        <div>
          <strong>Siteless</strong>
          <span>bot</span>
        </div>
      </div>
      <div class="chat-body">
        <div class="bubble out">/search кафе Алматы</div>
        <div class="bubble in">Проверено: 214<br />Без сайта: 37<br />Только соцсети: 5</div>
        <div class="bubble in">
          <p class="muted">Страница 1/9 · найдено 42</p>
          <div v-for="lead in leads" :key="lead.n" class="lead">
            <b>{{ lead.n }}. {{ lead.status }} {{ lead.name }}</b>
            <span>{{ lead.address }}</span>
            <span>📞 {{ lead.phone }}</span>
            <span class="links">WhatsApp · 🌐 проверить сайт</span>
          </div>
          <div class="kb">
            <span>✅ 1</span><span>📩 2</span><span>📩 3</span><span>📩 4</span><span>📩 5</span>
          </div>
          <div class="kb"><span>Вперёд ▶</span></div>
        </div>
      </div>
    </div>
    <p class="demo-caption">{{ t("demo.caption") }}</p>
  </section>
</template>
