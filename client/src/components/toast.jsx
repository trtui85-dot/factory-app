import { createContext, useCallback, useContext, useRef, useState } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

const ToastContext = createContext(null);

let successAudio = null;
function playSuccessSound() {
  try {
    if (!successAudio) successAudio = new Audio("/sonsucces.mp3");
    successAudio.currentTime = 0;
    successAudio.volume = 0.7;
    successAudio.play().catch(() => {});
  } catch {}
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const dismiss = useCallback((id) => {
    setToasts((list) => list.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    clearTimeout(timers.current[id]);
    timers.current[id] = setTimeout(() => {
      setToasts((list) => list.filter((t) => t.id !== id));
      delete timers.current[id];
    }, 420);
  }, []);

  const push = useCallback(
    (type, title, detail) => {
      const id = Date.now() + Math.random();
      if (type === "success") playSuccessSound();
      setToasts((list) => [...list, { id, type, title, detail, leaving: false }]);
      timers.current[id] = setTimeout(() => dismiss(id), 4000);
    },
    [dismiss]
  );

  const toast = {
    success: (title, detail) => push("success", title, detail),
    error: (title, detail) => push("error", title, detail),
    info: (title, detail) => push("info", title, detail),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toast-container">
        {toasts.map((t) => (
          <ToastItem key={t.id} t={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ t, onDismiss }) {
  const start = useRef(null);
  const [dy, setDy] = useState(0);

  const onPointerDown = (e) => {
    start.current = { y: e.clientY, swiped: false };
  };

  const onPointerMove = (e) => {
    if (!start.current) return;
    const delta = e.clientY - start.current.y;
    if (delta < 0) {
      start.current.swiped = true;
      start.current.dy = Math.max(delta, -90);
      setDy(start.current.dy);
    }
  };

  const onPointerUp = () => {
    if (start.current?.swiped && start.current.dy <= -45) {
      onDismiss();
    }
    start.current = null;
    setDy(0);
  };

  return (
    <div
      className={`toast ${t.type} ${t.leaving ? "leaving" : ""}`}
      style={{ transform: `translateY(${dy}px)` }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {t.type === "success" ? (
        <CheckCircle2 size={18} className="toast-ico" />
      ) : t.type === "error" ? (
        <AlertCircle size={18} className="toast-ico" />
      ) : (
        <Info size={18} className="toast-ico" />
      )}
      <div className="toast-body">
        <div className="toast-title">{t.title}</div>
        {t.detail && <div className="toast-detail">{t.detail}</div>}
      </div>
      <button className="toast-close" onClick={onDismiss} aria-label="close">
        <X size={14} />
      </button>
      <span className="toast-progress" />
    </div>
  );
}

export const useToast = () => useContext(ToastContext);
