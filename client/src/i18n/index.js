import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import fr from "./fr.json";
import ar from "./ar.json";

const saved = localStorage.getItem("factory_lang");
const initial = ["fr", "ar"].includes(saved) ? saved : "fr";

i18n.use(initReactI18next).init({
  resources: { fr: { translation: fr }, ar: { translation: ar } },
  lng: initial,
  fallbackLng: "fr",
  interpolation: { escapeValue: false },
});

export const setLang = (lng) => {
  i18n.changeLanguage(lng);
  localStorage.setItem("factory_lang", lng);
  document.documentElement.lang = lng;
  document.documentElement.dir = lng === "ar" ? "rtl" : "ltr";
};

setLang(i18n.language);

export default i18n;
