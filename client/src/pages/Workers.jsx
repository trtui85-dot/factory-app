import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Plus, Eye, UserMinus, UserCheck, HandCoins, ArrowDownToLine, ArrowUpFromLine, Banknote, Undo2, Save, FileDown, UserCog,
} from "lucide-react";
import { http, openReceipt } from "../api";
import { Modal, Field, Confirm, Badge, Empty, Loader } from "../components/ui";
import { useToast } from "../components/toast";

export default function Workers() {
  const { t } = useTranslation();
  const toast = useToast();
  const [workers, setWorkers] = useState([]);
  const [modal, setModal] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    http.get("/api/workers").then(setWorkers).finally(() => setLoading(false)).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  return (
    <div>
      <div className="card">
        <button className="btn success" onClick={() => setModal({ type: "new" })}>
          <Plus size={16} /> {t("workers.add")}
        </button>
      </div>

      <div className="card">
        {loading ? (
          <Loader />
        ) : workers.length === 0 ? (
          <Empty text={t("app.noData")} />
        ) : (
          <table>
            <thead>
              <tr>
                <th>{t("workers.name")}</th>
                <th>{t("workers.phone")}</th>
                <th>{t("workers.workStartDate")}</th>
                <th>{t("workers.monthlySalary")}</th>
                <th>{t("workers.balance")}</th>
                <th>{t("workers.status")}</th>
                <th>{t("workers.account")}</th>
                <th>{t("app.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {workers.map((w) => (
                <tr key={w.id}>
                  <td data-label={t("workers.name")}>{w.name}</td>
                  <td data-label={t("workers.phone")}>{w.phone || "—"}</td>
                  <td data-label={t("workers.workStartDate")}>{w.workStartDate}</td>
                  <td data-label={t("workers.monthlySalary")}>{Number(w.monthlySalary).toFixed(2)}</td>
                  <td data-label={t("workers.balance")}>
                    <Badge tone={w.balance > 0 ? "amber" : "green"}>{Number(w.balance).toFixed(2)}</Badge>
                  </td>
                  <td data-label={t("workers.status")}>{w.status === "ACTIVE" ? <Badge tone="green">{t("workers.active")}</Badge> : <Badge tone="red">{t("workers.inactive")}</Badge>}</td>
                  <td data-label={t("workers.account")}>
                    <AccountBadge account={w.account} />
                  </td>
                  <td data-label={t("app.actions")}>
                    <div className="row">
                      <button className="btn small" onClick={() => setModal({ type: "detail", w })}>
                        <Eye size={14} /> {t("workers.view")}
                      </button>
                      <button className="btn small" onClick={() => setModal({ type: "account", w })}>
                        <UserCog size={14} /> {t("workers.account")}
                      </button>
                      {w.status === "ACTIVE" ? (
                        <button className="btn small danger" onClick={() => setModal({ type: "deactivate", w })}>
                          <UserMinus size={14} /> {t("workers.deactivate")}
                        </button>
                      ) : (
                        <button className="btn small success" onClick={() => http.post(`/api/workers/${w.id}/reactivate`).then(() => { toast.success(t("workers.reactivate"), w.name); load(); })}>
                          <UserCheck size={14} /> {t("workers.reactivate")}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal?.type === "new" && <WorkerForm onClose={() => setModal(null)} onDone={() => { setModal(null); load(); }} />}
      {modal?.type === "detail" && <WorkerDetail w={modal.w} onClose={() => setModal(null)} onDone={() => { setModal(null); load(); }} />}
      {modal?.type === "account" && <AccountModal w={modal.w} onClose={() => setModal(null)} onDone={() => { setModal(null); load(); }} />}
      {modal?.type === "deactivate" && (
        <Confirm
          danger
          title={t("workers.deactivate")}
          message={`${t("workers.deactivate")} — ${modal.w.name} ?`}
          onClose={() => setModal(null)}
          onConfirm={async () => {
            await http.post(`/api/workers/${modal.w.id}/deactivate`);
            toast.success(t("workers.deactivate"), modal.w.name);
            setModal(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function WorkerForm({ onClose, onDone }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [workStartDate, setWorkStartDate] = useState("");
  const [monthlySalary, setMonthlySalary] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await http.post("/api/workers", {
        name,
        phone: phone || undefined,
        workStartDate: workStartDate || undefined,
        monthlySalary: Number(monthlySalary) || 0,
      });
      toast.success(t("workers.add"), name);
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={t("workers.add")} onClose={onClose}>
      {error && <div className="error-banner">{error}</div>}
      <form onSubmit={submit}>
        <Field label={t("workers.name")} required>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field label={t("workers.phone")}>
          <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <Field label={t("workers.workStartDate")}>
          <input className="input" type="date" value={workStartDate} onChange={(e) => setWorkStartDate(e.target.value)} />
        </Field>
        <Field label={t("workers.monthlySalary")}>
          <input className="input" type="number" step="any" value={monthlySalary} onChange={(e) => setMonthlySalary(e.target.value)} />
        </Field>
        <div className="actions">
          <button type="button" className="btn" onClick={onClose}>
            {t("app.cancel")}
          </button>
          <button className="btn primary" disabled={busy}>
            {busy ? t("app.loading") : (<><Save size={15} /> {t("app.save")}</>)}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function WorkerDetail({ w, onClose, onDone }) {
  const { t } = useTranslation();
  const [worker, setWorker] = useState(w);
  const [modal, setModal] = useState(null);

  const reload = async () => {
    const d = await http.get(`/api/workers/${w.id}`);
    setWorker(d);
  };
  useEffect(() => { reload(); }, [w.id]);

  return (
    <Modal title={`${worker.name} — ${t("workers.balance")}: ${Number(worker.balance).toFixed(2)}`} onClose={onClose} width="640px">
      <div className="row" style={{ marginBottom: 12 }}>
        <button className="btn primary" onClick={() => setModal({ type: "advanceTo" })}>
          <ArrowDownToLine size={15} /> {t("workers.advanceToWorker")}
        </button>
        <button className="btn" onClick={() => setModal({ type: "advanceFrom" })}>
          <ArrowUpFromLine size={15} /> {t("workers.advanceFromWorker")}
        </button>
        <button className="btn success" onClick={() => setModal({ type: "salary" })}>
          <Banknote size={15} /> {t("workers.salaryPayment")}
        </button>
      </div>

      <h4 style={{ margin: "8px 0" }}>{t("workers.entries")}</h4>
      {worker.entries.length === 0 ? (
        <Empty text={t("app.noData")} />
      ) : (
        <table>
          <thead>
            <tr>
              <th>{t("app.date")}</th>
              <th>{t("app.type")}</th>
              <th>{t("app.amount")}</th>
              <th>{t("app.note")}</th>
              <th>{t("app.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {worker.entries.map((e) => (
              <tr key={e.id}>
                <td data-label={t("app.date")}>{new Date(e.createdAt).toLocaleString()}</td>
                <td data-label={t("app.type")}>{t(`workers.entryType.${e.type}`)}</td>
                <td data-label={t("app.amount")}>{Number(e.amount).toFixed(2)}</td>
                <td data-label={t("app.note")}>{e.note || "—"}</td>
                <td data-label={t("app.actions")}>
                  <button className="btn small" onClick={() => openReceipt("worker", e.id)}>
                    <FileDown size={14} /> PDF
                  </button>
                  <button className="btn small danger" onClick={() => setModal({ type: "reverse", entry: e })}>
                    <Undo2 size={14} /> {t("workers.reverse")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="actions">
        <button className="btn" onClick={onClose}>
          {t("app.close")}
        </button>
      </div>

      {modal && (
        <EntryModal
          worker={worker}
          modal={modal}
          onClose={() => setModal(null)}
          onDone={async () => {
            setModal(null);
            await reload();
            onDone();
          }}
        />
      )}
    </Modal>
  );
}

function EntryModal({ worker, modal, onClose, onDone }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const titles = { advanceTo: "advanceToWorker", advanceFrom: "advanceFromWorker", salary: "salaryPayment", reverse: "reverse" };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (modal.type === "advanceTo") {
        await http.post(`/api/workers/${worker.id}/advances-to-worker`, { amount: Number(amount), note: note || undefined });
      } else if (modal.type === "advanceFrom") {
        await http.post(`/api/workers/${worker.id}/advances-from-worker`, { amount: Number(amount), note: note || undefined });
      } else if (modal.type === "salary") {
        await http.post(`/api/workers/${worker.id}/salary-payments`, { amount: Number(amount), note: note || undefined });
      } else if (modal.type === "reverse") {
        await http.post(`/api/workers/${worker.id}/ledger-entries/${modal.entry.id}/reverse`, { reason: note || undefined });
      }
      toast.success(t(`workers.${titles[modal.type]}`), `${Number(amount) ? Number(amount).toFixed(2) : ""} — ${worker.name}`.trim());
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={t(`workers.${titles[modal.type]}`)} onClose={onClose}>
      {error && <div className="error-banner">{error}</div>}
      {modal.type === "reverse" ? (
        <Confirm
          title={t("workers.reverse")}
          message={t("workers.confirmReverse")}
          onClose={onClose}
          onConfirm={submit}
          danger
        />
      ) : (
        <form onSubmit={submit}>
          <Field label={t("workers.amount")} required>
            <input className="input" type="number" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </Field>
          <Field label={t("workers.note")}>
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <div className="actions">
            <button type="button" className="btn" onClick={onClose}>
              {t("app.cancel")}
            </button>
            <button className="btn primary" disabled={busy}>
              {busy ? t("app.loading") : t("app.save")}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function AccountBadge({ account }) {
  const { t } = useTranslation();
  if (!account) return <Badge>{t("workers.noAccount")}</Badge>;
  return account.isActive ? <Badge tone="green">{t("workers.accountActive")}</Badge> : <Badge tone="red">{t("workers.accountInactive")}</Badge>;
}

const ACCOUNT_MODULES = ["dashboard", "stock", "recipes", "production", "sales", "customers", "expenses", "workers"];

function AccountModal({ w, onClose, onDone }) {
  const { t } = useTranslation();
  const toast = useToast();
  const acc = w.account;
  const [phone, setPhone] = useState(acc?.phone || "");
  const [pin, setPin] = useState("");
  const [isActive, setIsActive] = useState(acc ? acc.isActive : true);
  const [perms, setPerms] = useState(() => new Set(acc?.permissions || []));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [confirmDel, setConfirmDel] = useState(false);

  const togglePerm = (key) =>
    setPerms((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!phone.trim()) return setError(t("workers.phoneRequired"));
    if (pin && !/^\d{4}$/.test(pin)) return setError(t("workers.pinInvalid"));
    if (!acc && !pin) return setError(t("workers.pinRequired"));
    setBusy(true);
    try {
      await http.post(`/api/workers/${w.id}/account`, {
        phone: phone.trim(),
        pin: pin || undefined,
        permissions: [...perms],
        isActive,
      });
      toast.success(t("workers.accountSaved"), w.name);
      onDone();
    } catch (err) {
      setError(err.status === 409 ? t("workers.phoneTaken") : err.message);
    } finally {
      setBusy(false);
    }
  };

  const del = async () => {
    setBusy(true);
    setError(null);
    try {
      await http.delete(`/api/workers/${w.id}/account`);
      toast.success(t("workers.accountDeleted"), w.name);
      onDone();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  if (confirmDel) {
    return (
      <Confirm
        danger
        title={t("workers.deleteAccount")}
        message={t("workers.confirmDeleteAccount")}
        onClose={() => setConfirmDel(false)}
        onConfirm={del}
      />
    );
  }

  return (
    <Modal title={`${acc ? t("workers.editAccount") : t("workers.createAccount")} — ${w.name}`} onClose={onClose}>
      {error && <div className="error-banner">{error}</div>}
      <form onSubmit={submit}>
        <Field label={t("workers.phone")} required>
          <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <Field label={t("workers.pin")}>
          <input className="input" type="tel" inputMode="numeric" autoComplete="off" maxLength={4} placeholder="••••" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))} />
        </Field>
        <label className="check-row">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          <span>{t("workers.accountActive")}</span>
        </label>
        <h4 className="perm-title">{t("workers.permissions")}</h4>
        <div className="perm-grid">
          {ACCOUNT_MODULES.map((m) => (
            <label className="check-row" key={m}>
              <input type="checkbox" checked={perms.has(m)} onChange={() => togglePerm(m)} />
              <span>{t(`nav.${m}`)}</span>
            </label>
          ))}
        </div>
        <div className="actions">
          {acc && (
            <button type="button" className="btn danger" onClick={() => setConfirmDel(true)}>
              {t("workers.deleteAccount")}
            </button>
          )}
          <div className="row">
            <button type="button" className="btn" onClick={onClose}>
              {t("app.cancel")}
            </button>
            <button className="btn primary" disabled={busy}>
              {busy ? t("app.loading") : (<><Save size={15} /> {t("workers.saveAccount")}</>)}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
