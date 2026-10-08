<script setup>
import { useI18n } from "vue-i18n";

const { t } = useI18n();
const year = new Date().getFullYear();
</script>

<template>
  <footer class="footer">
    <div class="container footer-inner">
      <span>© {{ year }} Siteless · Sain Alen</span>
      <span>{{ t("footer.data") }}</span>
      <a href="mailto:sainalenkz@gmail.com">sainalenkz@gmail.com</a>
    </div>
  </footer>
</template>
