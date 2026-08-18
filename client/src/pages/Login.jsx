import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Phone, Languages, Loader2, LogIn } from "lucide-react";
import { useAuth } from "../auth";
import { setLang } from "../i18n";

function PinInput({ value, onChange, inputRef }) {
  return (
    <div className="pin-wrap">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className={`pin-box ${value[i] ? "filled" : ""} ${value.length === i ? "active" : ""}`}>
          {value[i] && <span className="pin-dot" />}
        </div>
      ))}
      <input
        ref={inputRef}
        className="pin-hidden"
        type="tel"
        inputMode="numeric"
        autoComplete="off"
        value={value}
        maxLength={4}
        required
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 4))}
      />
    </div>
  );
}

export default function Login() {
  const { t, i18n } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const pinRef = useRef(null);
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e, pinOverride) => {
    if (e) e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(phone, pinOverride ?? pin);
      navigate("/");
    } catch (err) {
      setError(err.code === "NETWORK_ERROR" || err.status === 0 ? t("login.network") : t("login.error"));
    } finally {
      setBusy(false);
    }
  };

  const onPhoneChange = (e) => {
    const v = e.target.value.replace(/\D/g, "").slice(0, 8);
    setPhone(v);
    if (v.length === 8) pinRef.current?.focus();
  };

  const onPinChange = (v) => {
    setPin(v);
    if (v.length === 4) submit(null, v);
  };

  const toggleLang = () => setLang(i18n.language === "fr" ? "ar" : "fr");

  return (
    <div className="login-wrap">
      <div className="login-blob b1" />
      <div className="login-blob b2" />
      <div className="login-blob b3" />
      <div className="login-card">
        <div className="login-head">
          <div className="login-logo">
            <img src="/logousigne.png" alt="logo" className="login-logo-img" />
          </div>
          <div className="login-titles">
            <h1>{t("app.title")}</h1>
            <p className="sub">{t("login.title")}</p>
          </div>
          <button className="chip lang-chip" onClick={toggleLang} title="Language">
            <Languages size={14} />
            {i18n.language === "fr" ? "العربية" : "Français"}
          </button>
        </div>

        {error && <div className="error-banner">{error}</div>}

        <form onSubmit={submit} className="login-form">
          <div className="field">
            <label>{t("login.phone")}</label>
            <div className="input-icon">
              <Phone size={16} />
              <input className="input" inputMode="numeric" maxLength={8} autoComplete="username" autoFocus value={phone} onChange={onPhoneChange} required />
            </div>
          </div>
          <div className="field">
            <label>{t("login.pin")}</label>
            <PinInput value={pin} onChange={onPinChange} inputRef={pinRef} />
          </div>
          <button className="btn primary login-btn" disabled={busy}>
            {busy ? <Loader2 size={16} className="spin" /> : <LogIn size={16} />}
            {busy ? t("app.loading") : t("login.submit")}
          </button>
        </form>
      </div>
    </div>
  );
}
