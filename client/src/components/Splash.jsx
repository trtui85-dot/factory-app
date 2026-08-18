import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

export default function Splash({ onDone }) {
  const { t } = useTranslation();
  const [pct, setPct] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const doneRef = useRef(false);

  useEffect(() => {
    const start = Date.now();
    const dur = 2000;
    let raf;
    const tick = () => {
      const elapsed = Date.now() - start;
      const tt = Math.min(1, elapsed / dur);
      const eased = 1 - Math.pow(1 - tt, 2);
      const v = Math.round(eased * 100);
      setPct(v);
      if (tt < 1) {
        raf = requestAnimationFrame(tick);
      } else if (!doneRef.current) {
        doneRef.current = true;
        setLeaving(true);
        setTimeout(onDone, 500);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [onDone]);

  return (
    <div className={`splash-wrap ${leaving ? "splash-leave" : ""}`}>
      <div className="splash-blob sb1" />
      <div className="splash-blob sb2" />
      <div className="splash-center">
        <div className="splash-logo">
          <img src="/logousigne.png" alt="logo" />
        </div>
        <h1 className="splash-title">{t("app.title")}</h1>
      </div>
      <div className="splash-bottom">
        <div className="splash-bar">
          <div className="splash-bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="splash-pct">{pct}%</div>
      </div>
    </div>
  );
}
