import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Languages, Download, CheckCircle2, Smartphone, RefreshCw } from "lucide-react";
import { setLang } from "../i18n";
import { useToast } from "./toast";

const FEATURES = ["stock", "production", "sales", "expenses", "workers"];

export default function InstallScreen({ pwa }) {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const toggleLang = () => setLang(i18n.language === "fr" ? "ar" : "fr");
  const isIos = typeof window !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);

  const doInstall = async () => {
    setBusy(true);
    const ok = await pwa.install();
    setBusy(false);
    if (ok) toast.success(t("install.installed"), t("install.installedHint"));
  };

  const retry = () => window.location.reload();

  return (
    <div className="login-wrap install-wrap">
      <div className="login-blob b1" />
      <div className="login-blob b2" />
      <div className="login-blob b3" />
      <div className="login-card install-card">
        <div className="login-head">
          <button className="chip lang-chip" onClick={toggleLang} title="Language">
            <Languages size={14} />
            {i18n.language === "fr" ? "العربية" : "Français"}
          </button>
          <div className="login-logo install-logo">
            <img src="/logousigne.png" alt="logo" />
          </div>
          <h1>{t("app.title")}</h1>
          <p className="sub">{t("install.tagline")}</p>
        </div>

        <ul className="install-feats">
          {FEATURES.map((f) => (
            <li key={f}>
              <CheckCircle2 size={16} className="install-feat-ico" />
              {t(`install.features.${f}`)}
            </li>
          ))}
        </ul>

        {pwa.installed ? (
          <div className="install-success">
            <div className="install-done">
              <CheckCircle2 size={20} />
              <span>{t("install.installed")}</span>
            </div>
            <p className="install-hint">{t("install.installedHint")}</p>
            <button className="btn primary install-btn" onClick={pwa.acknowledge}>
              <Smartphone size={17} />
              {t("install.openApp")}
            </button>
          </div>
        ) : pwa.deferredPrompt ? (
          <button className="btn primary install-btn" disabled={busy} onClick={doInstall}>
            <Download size={17} />
            {busy ? t("install.installing") : t("install.install")}
          </button>
        ) : isIos ? (
          <div className="install-ios">
            <Smartphone size={16} />
            <span>{t("install.ios")}</span>
          </div>
        ) : (
          <div className="install-ios">
            <Smartphone size={16} />
            <span>{t("install.waiting")}</span>
            <button className="install-retry" onClick={retry} title={t("install.retry")}>
              <RefreshCw size={13} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
