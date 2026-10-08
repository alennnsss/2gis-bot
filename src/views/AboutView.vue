<script setup>
import { useI18n } from "vue-i18n";

const { t } = useI18n();
const github = "https://github.com/alennnsss";
</script>

<template>
  <main class="container page">
    <section class="hero about">
      <div class="about-text">
        <div class="badge">{{ t("about.title") }}</div>
        <h1>Sain Alen</h1>
        <p>{{ t("about.text") }}</p>
        <div class="buttons">
          <a :href="github" class="btn" target="_blank" rel="noopener">{{ t("about.github") }}</a>
        </div>
      </div>
      <figure class="about-photo">
        <img src="/sain-alen.jpg" :alt="t('about.photo')" width="720" height="1280" />
        <figcaption>{{ t("about.photo") }}</figcaption>
      </figure>
    </section>
  </main>
</template>
