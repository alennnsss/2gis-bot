<script setup>
import { ref } from "vue";
import { useI18n } from "vue-i18n";

const props = defineProps({ bot: String, botUrl: String });
const { t } = useI18n();

const telegram = ref("");
const niche = ref("");
const website = ref("");
const state = ref("idle");

async function submit() {
  state.value = "sending";
  try {
    const response = await fetch("/api/request-access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        telegram: telegram.value,
        niche: niche.value,
        website: website.value,
      }),
    });
    state.value = response.ok ? "sent" : "error";
  } catch {
    state.value = "error";
  }
}
</script>

<template>
  <div v-if="state === 'sent'" class="form-done" role="status">
    <p>{{ t("form.sent", { bot: props.bot }) }}</p>
    <a :href="props.botUrl" class="btn" target="_blank" rel="noopener">{{ t("access.openBot") }}</a>
  </div>

  <form v-else class="access-form" @submit.prevent="submit">
    <label>
      <span>{{ t("form.telegram") }}</span>
      <input
        v-model="telegram"
        type="text"
        required
        placeholder="@username"
        pattern="@?[A-Za-z0-9_]{5,32}"
        :title="t('form.telegramHint')"
        autocomplete="username"
      />
    </label>
    <label>
      <span>{{ t("form.niche") }}</span>
      <input v-model="niche" type="text" maxlength="300" :placeholder="t('form.nichePlaceholder')" />
    </label>
    <input v-model="website" class="hp" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" />
    <button type="submit" class="btn" :disabled="state === 'sending'">
      {{ state === "sending" ? t("form.sending") : t("form.submit") }}
    </button>
    <p v-if="state === 'error'" class="form-error" role="alert">{{ t("form.error") }}</p>
  </form>
</template>
