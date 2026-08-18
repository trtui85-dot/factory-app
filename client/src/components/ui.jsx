import { X } from "lucide-react";
import { useTranslation } from "react-i18next";

export function Modal({ title, onClose, children, width }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={width ? { maxWidth: width } : undefined} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="close">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, children, required }) {
  return (
    <div className="field">
      <label>
        {label}
        {required ? " *" : ""}
      </label>
      {children}
    </div>
  );
}

export function Confirm({ title, message, onConfirm, onClose, danger }) {
  const { t } = useTranslation();
  return (
    <Modal title={title || t("app.confirm")} onClose={onClose}>
      <p style={{ marginTop: 0 }}>{message}</p>
      <div className="actions">
        <button className="btn" onClick={onClose}>
          {t("app.cancel")}
        </button>
        <button className={`btn ${danger ? "danger solid" : "primary"}`} onClick={onConfirm}>
          {t("app.confirm")}
        </button>
      </div>
    </Modal>
  );
}

export function Badge({ tone, children }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

export function Empty({ text }) {
  return <div className="empty">{text}</div>;
}

export function Loader({ text }) {
  const { t } = useTranslation();
  return (
    <div className="loader-wrap">
      <span className="dots">
        <span className="dot" />
        <span className="dot" />
      </span>
      <p>{text || t("app.loading")}</p>
    </div>
  );
}

export function PageLoader() {
  return (
    <div className="page-loader">
      <Loader />
    </div>
  );
}
