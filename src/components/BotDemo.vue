<script setup>
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";

const { t } = useI18n();

const PAGE_SIZE = 3;
const STATUSES = {
  contacted: { icon: "✅", label: "написал" },
  replied: { icon: "💬", label: "ответил" },
  client: { icon: "🤝", label: "клиент" },
  rejected: { icon: "❌", label: "отказ" },
};
const CYCLE = [null, "contacted", "replied", "client", "rejected"];

const leads = ref([
  { name: "Кафе «Пример»", address: "ул. Абая, 10", phone: "+7 700 000 00 01", mobile: true, status: "contacted" },
  { name: "Кофейня «Демо»", address: "пр. Достык, 25", phone: "+7 700 000 00 02", mobile: true, status: null },
  { name: "Пекарня «Образец»", address: "ул. Сатпаева, 5", phone: "+7 727 000 00 03", mobile: false, status: null },
  { name: "Барбершоп «Тест»", address: "ул. Жандосова, 40", phone: "+7 700 000 00 04", mobile: true, status: null },
  { name: "Цветы «Макет»", address: "ул. Толе би, 77", phone: "+7 700 000 00 05", mobile: true, status: null },
  { name: "Автомойка «Шаблон»", address: "пр. Райымбека, 120", phone: "+7 727 000 00 06", mobile: false, status: null },
]);

const page = ref(0);
const pages = Math.ceil(leads.value.length / PAGE_SIZE);
const start = computed(() => page.value * PAGE_SIZE);
const slice = computed(() => leads.value.slice(start.value, start.value + PAGE_SIZE));

const toast = ref("");
let toastTimer;

function notify(text) {
  toast.value = text;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toast.value = ""), 1600);
}

function cycle(lead) {
  const next = CYCLE[(CYCLE.indexOf(lead.status) + 1) % CYCLE.length];
  lead.status = next;
  notify(next ? `Статус: ${STATUSES[next].label}` : "Отметка снята");
}
</script>

<template>
  <div class="panel">
    <h2>{{ t("demo.title") }}</h2>
    <p class="panel-note">{{ t("demo.hint") }}</p>
    <div class="chat">
      <div class="chat-head">
        <img src="/bot-icon.svg" alt="" width="36" height="36" />
        <div>
          <strong>Siteless</strong>
          <span>bot</span>
        </div>
      </div>
      <div class="chat-body">
        <div class="bubble out">/search кафе Алматы</div>
        <div class="bubble in">Проверено: 48<br />Без сайта: 5<br />Только соцсети: 1</div>
        <div class="bubble in">
          <p class="muted">Страница {{ page + 1 }}/{{ pages }} · найдено {{ leads.length }}</p>
          <div v-for="(lead, i) in slice" :key="lead.name" class="lead">
            <b>{{ start + i + 1 }}. {{ lead.status ? STATUSES[lead.status].icon : "" }} {{ lead.name }}</b>
            <span>{{ lead.address }}</span>
            <span>📞 {{ lead.phone }}{{ lead.mobile ? "" : " (городской, только звонок)" }}</span>
            <span class="links">{{ lead.mobile ? "WhatsApp · " : "" }}🌐 проверить сайт</span>
          </div>
          <div class="kb">
            <button
              v-for="(lead, i) in slice"
              :key="lead.name"
              type="button"
              :aria-label="t('demo.statusBtn', { n: start + i + 1 })"
              @click="cycle(lead)"
            >
              {{ lead.status ? STATUSES[lead.status].icon : "📩" }} {{ start + i + 1 }}
            </button>
          </div>
          <div class="kb">
            <button v-if="page > 0" type="button" @click="page--">◀ Назад</button>
            <button v-if="page < pages - 1" type="button" @click="page++">Вперёд ▶</button>
          </div>
        </div>
        <Transition name="toast">
          <div v-if="toast" class="chat-toast" role="status">{{ toast }}</div>
        </Transition>
      </div>
    </div>
  </div>
</template>
