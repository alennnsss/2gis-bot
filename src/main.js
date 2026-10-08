import { createApp } from "vue";
import { inject } from "@vercel/analytics";
import App from "./App.vue";
import { router } from "./router.js";
import { i18n } from "./i18n.js";
import "./style.css";

inject();

createApp(App).use(router).use(i18n).mount("#app");
