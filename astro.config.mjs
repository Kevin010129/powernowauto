// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import sitemap from "@astrojs/sitemap";
import alpinejs from "@astrojs/alpinejs";

export default defineConfig({
  site: "https://powernowauto.pages.dev",
  integrations: [sitemap({
    i18n: {
      defaultLocale: "zh",
      locales: { zh: "zh-CN", en: "en-US" },
    },
  }), alpinejs()],
  vite: {
    plugins: [tailwindcss()],
  },
  i18n: {
    defaultLocale: "zh",
    locales: ["zh", "en"],
    routing: {
      prefixDefaultLocale: false,
    },
  },
});
