<script setup>
import { useI18n } from "vue-i18n";
import { setLocale } from "../i18n.js";
import Icon from "./Icon.vue";

const { t, locale } = useI18n();

function toggleLocale() {
  setLocale(locale.value === "ru" ? "en" : "ru");
}
</script>

<template>
  <header class="header">
    <div class="container header-inner">
      <RouterLink to="/" class="logo">Siteless</RouterLink>
      <nav class="nav-pill" :aria-label="t('nav.label')">
        <RouterLink :to="{ path: '/', hash: '#how' }">{{ t("nav.how") }}</RouterLink>
        <RouterLink :to="{ path: '/', hash: '#commands' }">{{ t("nav.commands") }}</RouterLink>
        <RouterLink :to="{ path: '/', hash: '#faq' }">{{ t("nav.faq") }}</RouterLink>
        <RouterLink :to="{ path: '/', hash: '#access' }">{{ t("nav.access") }}</RouterLink>
        <RouterLink to="/about">{{ t("nav.about") }}</RouterLink>
      </nav>
      <div class="header-actions">
        <a class="icon-btn" href="https://t.me/newitgis_bot" target="_blank" rel="noopener" :aria-label="t('nav.bot')" :title="t('nav.bot')">
          <Icon name="telegram" />
        </a>
        <RouterLink class="icon-btn show-sm" to="/about" :aria-label="t('nav.about')" :title="t('nav.about')">
          <Icon name="user" />
        </RouterLink>
        <button type="button" class="icon-btn" :aria-label="t('nav.lang')" :title="t('nav.lang')" @click="toggleLocale">
          {{ locale === "ru" ? "EN" : "RU" }}
        </button>
      </div>
    </div>
  </header>
</template>
