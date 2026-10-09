<script setup>
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import BotDemo from "./BotDemo.vue";
import AccessForm from "./AccessForm.vue";
import Icon from "./Icon.vue";

const { t } = useI18n();

const email = "sainalenkz@gmail.com";
const bot = "@newitgis_bot";
const botUrl = "https://t.me/newitgis_bot";
const mailto = computed(
  () =>
    `mailto:${email}?subject=` +
    encodeURIComponent(t("access.subject")) +
    "&body=" +
    encodeURIComponent(t("access.body"))
);

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
  { key: "nosite", cmd: "/search" },
  { key: "mobile", cmd: "/mobile" },
  { key: "crm", cmd: "/pipeline" },
  { key: "csv", cmd: "/export" },
];
const steps = ["search", "filter", "write"];
const stats = [
  ["1500", "places"],
  ["10", "limit"],
  ["4", "statuses"],
];
const faq = ["source", "cities", "limit", "privacy", "access"];

const commands = [
  ["/search кафе Алматы", "search"],
  ["/business Алматы", "business"],
  ["/pipeline", "pipeline"],
  ["/note 3 перезвонить", "note"],
  ["/mobile", "mobile"],
  ["/social", "social"],
  ["/template …", "template"],
  ["/export", "export"],
  ["/stats", "stats"],
];
</script>

<template>
  <main id="top" class="container page">
    <section class="promo-grid">
      <article class="promo">
        <div class="promo-text">
          <h1>{{ t("hero.title1") }}</h1>
          <p>{{ t("hero.text") }}</p>
          <a :href="botUrl" class="btn" target="_blank" rel="noopener">{{ t("hero.open", { bot }) }}</a>
        </div>
        <div class="promo-visual mini-chat" aria-hidden="true">
          <div class="b out">/search кафе Алматы</div>
          <div class="b in">
            <strong>1. ✅ Кафе «Пример»</strong>
            <span>📞 +7 700 000 00 01 · WhatsApp</span>
          </div>
          <div class="b in">
            <strong>2. Кофейня «Демо»</strong>
            <span>📞 +7 700 000 00 02 · WhatsApp</span>
          </div>
        </div>
      </article>
      <article class="promo dark">
        <div class="promo-text">
          <h2>{{ t("hero.title2") }}</h2>
          <p>{{ t("hero.text2") }}</p>
          <a href="#access" class="btn light">{{ t("hero.access") }}</a>
        </div>
        <div class="promo-visual" aria-hidden="true">
          <img class="bot-art" src="/bot-icon.svg" alt="" width="190" height="190" />
        </div>
      </article>
    </section>

    <section id="access" class="panel access-panel">
      <div>
        <h2 class="panel-title"><span class="dot" />{{ t("form.title") }}</h2>
        <p class="panel-note">{{ t("access.text", { bot }) }}</p>
        <AccessForm :bot="bot" :bot-url="botUrl" />
      </div>
      <div class="divider" />
      <div>
        <h2 class="panel-title"><span class="dot alt" />{{ t("access.or") }}</h2>
        <p class="panel-note">{{ email }}</p>
        <div class="contact-actions">
          <a :href="mailto" class="btn">{{ t("access.mail") }}</a>
          <button type="button" class="btn ghost" @click="copyEmail">
            {{ copied ? t("access.copied") : t("access.copy") }}
          </button>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="section-head">
        <h2>{{ t("features.title") }}</h2>
        <a href="#commands">{{ t("features.all") }}</a>
      </div>
      <div class="cards">
        <article v-for="f in features" :key="f.key" class="card">
          <h3>{{ t(`features.${f.key}.title`) }}</h3>
          <span class="tag">{{ t(`features.${f.key}.tag`) }}</span>
          <div class="card-art">
            <span class="icon-circle"><Icon :name="f.key" :size="36" /></span>
          </div>
          <p>{{ t(`features.${f.key}.text`) }}</p>
          <div class="card-foot">
            <code>{{ f.cmd }}</code>
            <a :href="botUrl" class="btn" target="_blank" rel="noopener">{{ t("features.try") }}</a>
          </div>
        </article>
      </div>
    </section>

    <section id="how" class="split">
      <div class="panel how-panel">
        <h2>{{ t("how.title") }}</h2>
        <ol class="steps">
          <li v-for="(s, i) in steps" :key="s">
            <span class="step-num">{{ i + 1 }}</span>
            <div>
              <strong>{{ t(`how.${s}.title`) }}</strong>
              <p>{{ t(`how.${s}.text`) }}</p>
            </div>
          </li>
        </ol>
        <div class="stats">
          <div v-for="[value, key] in stats" :key="key" class="stat">
            <b>{{ value }}</b>
            <span>{{ t(`how.stats.${key}`) }}</span>
          </div>
        </div>
      </div>
      <BotDemo />
    </section>

    <section id="commands" class="section">
      <div class="section-head">
        <h2>{{ t("commands.title") }}</h2>
        <span>{{ t("commands.count", { n: commands.length }) }}</span>
      </div>
      <ul class="cmd-grid" role="list">
        <li v-for="[cmd, key] in commands" :key="cmd" class="cmd">
          <code>{{ cmd }}</code>
          <span>{{ t(`commands.${key}`) }}</span>
        </li>
      </ul>
    </section>

    <section id="faq" class="section">
      <div class="section-head">
        <h2>{{ t("faq.title") }}</h2>
      </div>
      <div class="panel">
        <details v-for="q in faq" :key="q" class="faq-item">
          <summary>{{ t(`faq.${q}.q`) }}</summary>
          <p>{{ t(`faq.${q}.a`) }}</p>
        </details>
      </div>
    </section>
  </main>
</template>
