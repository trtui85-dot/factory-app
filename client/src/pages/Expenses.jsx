import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Ban, Save, FileDown } from "lucide-react";
import { http, openReceipt } from "../api";
import { Modal, Field, Confirm, Badge, Empty, Loader } from "../components/ui";
import { useToast } from "../components/toast";

export default function Expenses() {
  const { t } = useTranslation();
  const toast = useToast();
  const [expenses, setExpenses] = useState([]);
  const [modal, setModal] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    http.get("/api/expenses").then(setExpenses).finally(() => setLoading(false)).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  return (
    <div>
      <div className="card">
        <button className="btn success" onClick={() => setModal(true)}>
          <Plus size={16} /> {t("expenses.add")}
        </button>
      </div>

      <div className="card">
        {loading ? (
          <Loader />
        ) : expenses.length === 0 ? (
          <Empty text={t("app.noData")} />
        ) : (
          <table>
            <thead>
              <tr>
                <th>{t("expenses.date")}</th>
                <th>{t("expenses.category")}</th>
                <th>{t("expenses.amount")}</th>
                <th>{t("expenses.reference")}</th>
                <th>{t("expenses.description")}</th>
                <th>{t("app.status")}</th>
                <th>{t("app.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => (
                <tr key={e.id}>
                  <td data-label={t("expenses.date")}>{new Date(e.created_at).toLocaleString()}</td>
                  <td data-label={t("expenses.category")}>{e.category}</td>
                  <td data-label={t("expenses.amount")}>{Number(e.amount).toFixed(2)}</td>
                  <td data-label={t("expenses.reference")}>{e.reference || "—"}</td>
                  <td data-label={t("expenses.description")}>{e.description || "—"}</td>
                  <td data-label={t("app.status")}>{e.cancelled ? <Badge tone="red">{t("expenses.cancelled")}</Badge> : <Badge tone="green">{t("app.status")}</Badge>}</td>
                  <td data-label={t("app.actions")}>
                    <button className="btn small" onClick={() => openReceipt("expense", e.id)}>
                      <FileDown size={14} /> PDF
                    </button>
                    {!e.cancelled && (
                      <button className="btn small danger" onClick={() => setConfirm(e)}>
                        <Ban size={14} /> {t("expenses.cancel")}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && <ExpenseModal onClose={() => setModal(false)} onDone={() => { setModal(false); load(); }} />}
      {confirm && (
        <Confirm
          danger
          title={t("expenses.cancel")}
          message={t("expenses.confirmCancel")}
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            await http.post(`/api/expenses/${confirm.id}/cancel`);
            toast.success(t("expenses.cancel"), confirm.category);
            setConfirm(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function ExpenseModal({ onClose, onDone }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await http.post("/api/expenses", {
        category,
        amount: Number(amount),
        reference: reference || undefined,
        description: description || undefined,
      });
      toast.success(t("expenses.add"), `${category}: ${Number(amount).toFixed(2)}`);
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={t("expenses.add")} onClose={onClose}>
      {error && <div className="error-banner">{error}</div>}
      <form onSubmit={submit}>
        <Field label={t("expenses.category")} required>
          <input className="input" value={category} onChange={(e) => setCategory(e.target.value)} required />
        </Field>
        <Field label={t("expenses.amount")} required>
          <input className="input" type="number" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </Field>
        <Field label={t("expenses.reference")}>
          <input className="input" value={reference} onChange={(e) => setReference(e.target.value)} />
        </Field>
        <Field label={t("expenses.description")}>
          <textarea className="input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
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
