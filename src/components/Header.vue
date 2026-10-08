<script setup>
import { useI18n } from "vue-i18n";
import { setLocale } from "../i18n.js";

const { t, locale } = useI18n();
</script>

<template>
  <header class="header">
    <div class="container header-inner">
      <RouterLink to="/" class="logo">
        <img src="/bot-icon.svg" alt="" width="32" height="32" />
        <span>Siteless</span>
      </RouterLink>
      <nav class="nav">
        <RouterLink :to="{ path: '/', hash: '#how' }">{{ t("nav.how") }}</RouterLink>
        <RouterLink :to="{ path: '/', hash: '#commands' }">{{ t("nav.commands") }}</RouterLink>
        <RouterLink :to="{ path: '/', hash: '#faq' }">{{ t("nav.faq") }}</RouterLink>
        <RouterLink to="/about">{{ t("nav.about") }}</RouterLink>
        <RouterLink :to="{ path: '/', hash: '#access' }" class="nav-cta">{{ t("nav.access") }}</RouterLink>
        <div class="lang" role="group" aria-label="Language">
          <button
            v-for="l in ['ru', 'en']"
            :key="l"
            type="button"
            :class="{ active: locale === l }"
            :aria-pressed="locale === l"
            @click="setLocale(l)"
          >
            {{ l.toUpperCase() }}
          </button>
        </div>
      </nav>
    </div>
  </header>
</template>
