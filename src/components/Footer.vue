<script setup>
import { useI18n } from "vue-i18n";

const { t } = useI18n();
const year = new Date().getFullYear();
</script>

<template>
  <footer class="footer">
    <div class="container footer-top">
      <div class="footer-brand">
        <RouterLink to="/" class="logo">Siteless</RouterLink>
        <p>{{ t("footer.tagline") }}</p>
      </div>
      <div class="footer-cols">
        <div>
          <h3>{{ t("footer.bot") }}</h3>
          <ul>
            <li><RouterLink :to="{ path: '/', hash: '#how' }">{{ t("nav.how") }}</RouterLink></li>
            <li><RouterLink :to="{ path: '/', hash: '#commands' }">{{ t("nav.commands") }}</RouterLink></li>
            <li><RouterLink :to="{ path: '/', hash: '#faq' }">{{ t("nav.faq") }}</RouterLink></li>
          </ul>
        </div>
        <div>
          <h3>{{ t("footer.project") }}</h3>
          <ul>
            <li><RouterLink to="/about">{{ t("nav.about") }}</RouterLink></li>
          </ul>
        </div>
        <div>
          <h3>{{ t("footer.contact") }}</h3>
          <ul>
            <li><a href="https://t.me/newitgis_bot" target="_blank" rel="noopener">Telegram</a></li>
            <li><a href="mailto:sainalenkz@gmail.com">Email</a></li>
          </ul>
        </div>
      </div>
    </div>
    <div class="container footer-bottom">
      <span>© {{ year }} Siteless · Sain Alen</span>
      <span>{{ t("footer.data") }}</span>
    </div>
  </footer>
</template>
