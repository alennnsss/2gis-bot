<script setup>
import { useI18n } from "vue-i18n";
import Icon from "../components/Icon.vue";

const { t } = useI18n();
const github = "https://github.com/alennnsss";
const linkedin = "https://kz.linkedin.com/in/alen-sain-1917973a2";
</script>

<template>
  <main class="container page">
    <section class="about">
      <div class="promo dark about-photo">
        <img src="/sain-alen.jpg" :alt="t('about.photo')" width="720" height="1280" />
      </div>
      <div class="panel about-info">
        <span class="tag">{{ t("about.title") }}</span>
        <h1>Sain Alen</h1>
        <p>{{ t("about.text") }}</p>
        <div class="about-links">
          <a :href="github" class="btn" target="_blank" rel="noopener">
            <Icon name="github" :size="20" />
            {{ t("about.github") }}
          </a>
          <a :href="linkedin" class="btn light" target="_blank" rel="noopener">
            <Icon name="linkedin" :size="18" />
            LinkedIn
          </a>
        </div>
      </div>
    </section>
  </main>
</template>
