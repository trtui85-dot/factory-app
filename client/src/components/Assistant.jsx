import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles, Send, X, Bot } from "lucide-react";
import { http } from "../api";

const SUGGESTIONS = [
  "assistant.suggestSales",
  "assistant.suggestCreateProduct",
  "assistant.suggestLowStock",
  "assistant.suggestDebts",
];

export default function Assistant() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    const check = () => {
      const covered =
        !!document.querySelector(".modal-backdrop") ||
        !!document.querySelector(".nav-more-menu.show");
      setHidden(covered);
      if (covered) setOpen(false);
    };
    check();
    const mo = new MutationObserver(check);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading, open]);

  if (hidden) return null;

  const send = async (raw) => {
    const text = (raw ?? input).trim();
    if (!text || loading) return;
    const history = messages.filter((m) => m.role === "user" || m.role === "assistant");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setLoading(true);
    try {
      const data = await http.post("/api/assistant/chat", { message: text, history });
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply || "…" }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: err?.data?.message || err?.message || "Erreur" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const onKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <>
      <button
        className={`assistant-fab ${open ? "open" : ""}`}
        onClick={() => setOpen((o) => !o)}
        aria-label={t("assistant.title")}
      >
        {open ? <X size={22} /> : <Sparkles size={22} />}
      </button>

      {open && (
        <div className="assistant-panel">
          <div className="assistant-head">
            <div className="assistant-head-brand">
              <span className="assistant-avatar">
                <Bot size={18} />
              </span>
              <div>
                <strong>{t("assistant.title")}</strong>
                <span className="assistant-sub">{t("assistant.subtitle")}</span>
              </div>
            </div>
            <button className="icon-btn" onClick={() => setOpen(false)} aria-label={t("app.close")}>
              <X size={18} />
            </button>
          </div>

          <div className="assistant-body">
            {messages.length === 0 && (
              <div className="assistant-empty">
                <span className="assistant-empty-ico">
                  <Sparkles size={20} />
                </span>
                <p>{t("assistant.welcome")}</p>
                <div className="assistant-chips">
                  {SUGGESTIONS.map((k) => (
                    <button key={k} className="chip" onClick={() => send(t(k))}>
                      {t(k)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`assistant-msg ${m.role}`}>
                {m.role === "assistant" && (
                  <span className="assistant-msg-avatar">
                    <Bot size={13} />
                  </span>
                )}
                <div className="assistant-bubble">{m.content}</div>
              </div>
            ))}

            {loading && (
              <div className="assistant-msg assistant">
                <span className="assistant-msg-avatar">
                  <Bot size={13} />
                </span>
                <div className="assistant-bubble assistant-typing">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div className="assistant-foot">
            <textarea
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKey}
              placeholder={t("assistant.placeholder")}
            />
            <button
              className="btn primary assistant-send"
              onClick={() => send()}
              disabled={loading || !input.trim()}
              aria-label="send"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
