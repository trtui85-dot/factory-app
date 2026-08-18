import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Coins, Eye, Pencil, Trash2, Save, FileDown } from "lucide-react";
import { http, openReceipt } from "../api";
import { Modal, Field, Confirm, Badge, Empty, Loader } from "../components/ui";
import { useToast } from "../components/toast";

export default function Customers() {
  const { t } = useTranslation();
  const toast = useToast();
  const [customers, setCustomers] = useState([]);
  const [modal, setModal] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    http.get("/api/customers").then(setCustomers).finally(() => setLoading(false)).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  return (
    <div>
      <div className="card">
        <button className="btn success" onClick={() => setModal({ type: "new" })}>
          <Plus size={16} /> {t("customers.add")}
        </button>
      </div>

      <div className="card">
        {loading ? (
          <Loader />
        ) : customers.length === 0 ? (
          <Empty text={t("app.noData")} />
        ) : (
          <table>
            <thead>
              <tr>
                <th>{t("app.name")}</th>
                <th>{t("app.phone")}</th>
                <th>{t("customers.balance")}</th>
                <th>{t("app.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id}>
                  <td data-label={t("app.name")}>{c.name}</td>
                  <td data-label={t("app.phone")}>{c.phone || "—"}</td>
                  <td data-label={t("customers.balance")}>
                    <Badge tone={c.balance > 0 ? "amber" : "green"}>{Number(c.balance).toFixed(2)}</Badge>
                  </td>
                  <td data-label={t("app.actions")}>
                    <div className="row">
                      <button className="btn small success" onClick={() => setModal({ type: "payment", c })}>
                        <Coins size={14} /> {t("customers.payment")}
                      </button>
                      <button className="btn small" onClick={() => setModal({ type: "statement", c })}>
                        <Eye size={14} /> {t("customers.statement")}
                      </button>
                      <button className="btn small" onClick={() => setModal({ type: "edit", c })}>
                        <Pencil size={14} /> {t("app.edit")}
                      </button>
                      <button className="btn small danger" onClick={() => setConfirm(c)}>
                        <Trash2 size={14} /> {t("app.delete")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal?.type === "new" && (
        <CustomerForm onClose={() => setModal(null)} onDone={() => { setModal(null); load(); }} />
      )}
      {modal?.type === "edit" && (
        <CustomerForm c={modal.c} onClose={() => setModal(null)} onDone={() => { setModal(null); load(); }} />
      )}
      {modal?.type === "payment" && (
        <PaymentModal c={modal.c} onClose={() => setModal(null)} onDone={() => { setModal(null); load(); }} />
      )}
      {modal?.type === "statement" && (
        <StatementModal c={modal.c} onClose={() => setModal(null)} />
      )}

      {confirm && (
        <Confirm
          danger
          title={t("customers.title")}
          message={t("customers.confirmDelete")}
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            await http.delete(`/api/customers/${confirm.id}`);
            toast.success(t("app.delete"), confirm.name);
            setConfirm(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function CustomerForm({ c, onClose, onDone }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [name, setName] = useState(c?.name || "");
  const [phone, setPhone] = useState(c?.phone || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = { name, phone: phone || undefined };
      if (c) {
        await http.patch(`/api/customers/${c.id}`, body);
        toast.success(t("app.edit"), name);
      } else {
        await http.post("/api/customers", body);
        toast.success(t("customers.add"), name);
      }
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={c ? t("customers.edit") : t("customers.add")} onClose={onClose}>
      {error && <div className="error-banner">{error}</div>}
      <form onSubmit={submit}>
        <Field label={t("app.name")} required>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field label={t("app.phone")}>
          <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
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

function PaymentModal({ c, onClose, onDone }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await http.post("/api/customer-payments", {
        customerId: c.id,
        amount: Number(amount),
        reference: reference || undefined,
        note: note || undefined,
      });
      toast.success(t("customers.paymentTitle"), `${t("app.amount")}: ${Number(amount).toFixed(2)} — ${c.name}`);
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={`${t("customers.paymentTitle")} — ${c.name}`} onClose={onClose}>
      {error && <div className="error-banner">{error}</div>}
      <form onSubmit={submit}>
        <Field label={t("app.amount")} required>
          <input className="input" type="number" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </Field>
        <Field label={t("customers.reference")}>
          <input className="input" value={reference} onChange={(e) => setReference(e.target.value)} />
        </Field>
        <Field label={t("customers.note")}>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
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

function StatementModal({ c, onClose }) {
  const { t } = useTranslation();
  const [history, setHistory] = useState(null);
  useEffect(() => {
    http.get(`/api/customers/${c.id}/statement`).then((d) => setHistory(d.history)).catch(() => setHistory([]));
  }, [c.id]);

  return (
    <Modal title={`${t("customers.statementTitle")} — ${c.name}`} onClose={onClose}>
      {!history && <Loader />}
      {history && history.length === 0 && <Empty text={t("app.noData")} />}
      {history && history.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>{t("customers.columns.date")}</th>
              <th>{t("customers.columns.operation")}</th>
              <th>{t("customers.columns.amount")}</th>
              <th>{t("customers.columns.balanceAfter")}</th>
              <th>PDF</th>
            </tr>
          </thead>
          <tbody>
            {history.map((h) => (
              <tr key={`${h.id}-${h.operation}`}>
                <td data-label={t("customers.columns.date")}>{new Date(h.date).toLocaleString()}</td>
                <td data-label={t("customers.columns.operation")}>{t(`customers.operation.${h.operation}`)}</td>
                <td data-label={t("customers.columns.amount")}>{Number(h.amount).toFixed(2)}</td>
                <td data-label={t("customers.columns.balanceAfter")}>{Number(h.balanceAfter).toFixed(2)}</td>
                <td data-label="PDF">
                  <button className="btn small" onClick={() => openReceipt(h.operation === "SALE" ? "sale" : "payment", h.id)}>
                    <FileDown size={14} /> PDF
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
    </Modal>
  );
}
