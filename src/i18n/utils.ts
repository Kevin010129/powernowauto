import en from "./en.json" with { type: "json" };
import zh from "./zh.json" with { type: "json" };

const translations = { en, zh };

export function getLangFromUrl(url: URL): string {
  const [, first] = url.pathname.split("/");
  if (first === "en") return "en";
  return "zh";
}

export function useTranslations(lang: string) {
  const raw = lang === "zh" ? zh : en;

  return {
    t(key: string): string {
      const keys = key.split(".");
      let result: any = raw;
      for (const k of keys) {
        if (result === undefined || result === null) return key;
        result = result[k];
      }
      return typeof result === "string" ? result : key;
    },
    lang,
  };
}

export function getLocalePaths(lang: string, pathname: string) {
  const clean = pathname.replace(/^\/(zh|en)\/?/, "/") || "/";
  return [
    { lang: "zh", path: clean === "/" ? "/" : clean },
    { lang: "en", path: "/en" + (clean === "/" ? "/" : clean) },
  ];
}
