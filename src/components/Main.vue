<script setup>
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import BotDemo from "./BotDemo.vue";
import AccessForm from "./AccessForm.vue";

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

// тексты — в src/i18n.js, здесь только ключи
const features = ["nosite", "mobile", "crm", "csv"];
const steps = ["search", "filter", "write"];
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
    <section class="hero">
      <div class="badge">{{ t("hero.badge") }}</div>
      <h1>Siteless</h1>
      <p>{{ t("hero.text") }}</p>
      <div class="buttons">
        <a :href="botUrl" class="btn" target="_blank" rel="noopener">{{ t("hero.open", { bot }) }}</a>
        <a href="#access" class="btn secondary">{{ t("hero.access") }}</a>
      </div>
    </section>

    <section class="grid">
      <article v-for="f in features" :key="f" class="card">
        <strong>{{ t(`features.${f}.title`) }}</strong>
        <span>{{ t(`features.${f}.text`) }}</span>
      </article>
    </section>

    <BotDemo />

    <section id="how" class="block">
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
    </section>

    <section id="commands" class="block">
      <h2>{{ t("commands.title") }}</h2>
      <ul class="commands">
        <li v-for="[cmd, key] in commands" :key="cmd">
          <code>{{ cmd }}</code>
          <span>{{ t(`commands.${key}`) }}</span>
        </li>
      </ul>
    </section>

    <section id="faq" class="block">
      <h2>{{ t("faq.title") }}</h2>
      <details v-for="q in faq" :key="q" class="faq-item">
        <summary>{{ t(`faq.${q}.q`) }}</summary>
        <p>{{ t(`faq.${q}.a`) }}</p>
      </details>
    </section>

    <section id="access" class="block access">
      <h2>{{ t("access.title") }}</h2>
      <p>{{ t("access.text", { bot }) }}</p>
      <AccessForm :bot="bot" :bot-url="botUrl" />
      <p class="access-or">{{ t("access.or") }}</p>
      <div class="email-row">
        <a :href="mailto" class="btn">{{ t("access.write", { email }) }}</a>
        <button type="button" class="btn secondary" @click="copyEmail">
          {{ copied ? t("access.copied") : t("access.copy") }}
        </button>
      </div>
    </section>
  </main>
</template>
