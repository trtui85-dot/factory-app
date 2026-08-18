import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Ban, Save, FileDown } from "lucide-react";
import { http, openReceipt } from "../api";
import { Modal, Field, Confirm, Badge, Empty, Loader } from "../components/ui";
import { useToast } from "../components/toast";

export default function Sales() {
  const { t } = useTranslation();
  const toast = useToast();
  const [sales, setSales] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [modal, setModal] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    Promise.all([
      http.get("/api/sales").then(setSales).catch(() => {}),
      http.get("/api/customers").then(setCustomers).catch(() => {}),
      http.get("/api/finished-products").then(setProducts).catch(() => {}),
    ]).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  return (
    <div>
      <div className="card">
        <button className="btn success" onClick={() => setModal(true)}>
          <Plus size={16} /> {t("sales.new")}
        </button>
      </div>

      <div className="card">
        {loading ? (
          <Loader />
        ) : sales.length === 0 ? (
          <Empty text={t("app.noData")} />
        ) : (
          <table>
            <thead>
              <tr>
                <th>{t("sales.date")}</th>
                <th>{t("sales.customer")}</th>
                <th>{t("sales.products")}</th>
                <th>{t("sales.total")}</th>
                <th>{t("sales.paid")}</th>
                <th>{t("sales.balance")}</th>
                <th>{t("app.status")}</th>
                <th>{t("app.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((s) => (
                <tr key={s.id}>
                  <td data-label={t("sales.date")}>{new Date(s.createdAt).toLocaleString()}</td>
                  <td data-label={t("sales.customer")}>{s.customerName ?? "—"}</td>
                  <td data-label={t("sales.products")}>{s.items.length}</td>
                  <td data-label={t("sales.total")}>{Number(s.finalTotal).toFixed(2)}</td>
                  <td data-label={t("sales.paid")}>{Number(s.amountPaid).toFixed(2)}</td>
                  <td data-label={t("sales.balance")}>{(s.finalTotal - s.amountPaid).toFixed(2)}</td>
                  <td data-label={t("app.status")}>
                    {s.status === "CORRECTED" ? <Badge tone="red">{t("sales.alreadyCorrected")}</Badge> : <Badge tone="green">{s.status}</Badge>}
                  </td>
                  <td data-label={t("app.actions")}>
                    <button className="btn small" onClick={() => openReceipt("sale", s.id)}>
                      <FileDown size={14} /> PDF
                    </button>
                    {s.status !== "CORRECTED" && (
                      <button className="btn small danger" onClick={() => setConfirm(s)}>
                        <Ban size={14} /> {t("sales.correct")}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <NewSaleModal customers={customers} products={products} onClose={() => setModal(false)} onDone={() => { setModal(false); load(); }} />
      )}
      {confirm && (
        <Confirm
          danger
          title={t("sales.correct")}
          message={t("sales.confirmCorrect")}
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            await http.post(`/api/sales/${confirm.id}/correct`);
            toast.success(t("sales.correct"), confirm.customerName ?? "");
            setConfirm(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function NewSaleModal({ customers, products, onClose, onDone }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [customerId, setCustomerId] = useState("");
  const [items, setItems] = useState([{ variantId: "", sacks: "", unitPrice: "" }]);
  const [amountPaid, setAmountPaid] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const variants = products.flatMap((p) => p.variants.map((v) => ({ ...v, productName: p.name })));

  const total = items.reduce((s, i) => s + (Number(i.sacks) || 0) * (Number(i.unitPrice) || 0), 0);

  const setItem = (i, k, v) => setItems((l) => l.map((x, idx) => (idx === i ? { ...x, [k]: v } : x)));
  const onVariantChange = (i, v) => {
    const variant = variants.find((x) => String(x.id) === String(v));
    setItems((l) => l.map((x, idx) => (idx === i ? { ...x, variantId: v, unitPrice: variant?.defaultPricePerSack ?? "" } : x)));
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await http.post("/api/sales", {
        customerId: customerId ? Number(customerId) : undefined,
        items: items.filter((i) => i.variantId).map((i) => ({ variantId: Number(i.variantId), sacks: Number(i.sacks) || 0, unitPrice: Number(i.unitPrice) || 0 })),
        amountPaid: Number(amountPaid) || 0,
        note: note || undefined,
      });
      toast.success(t("sales.new"), `${t("sales.total")}: ${total.toFixed(2)}`);
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={t("sales.new")} onClose={onClose} width="640px">
      {error && <div className="error-banner">{error}</div>}
      <form onSubmit={submit}>
        <Field label={t("sales.customer")}>
          <select className="input" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">—</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("sales.item")}>
          {items.map((it, i) => {
            const variant = variants.find((v) => String(v.id) === String(it.variantId));
            return (
              <div className="row" key={i} style={{ marginBottom: 8 }}>
                <select className="input grow" value={it.variantId} onChange={(e) => onVariantChange(i, e.target.value)} required>
                  <option value="">—</option>
                  {variants.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.productName} · {v.sackSizeKg}kg
                    </option>
                  ))}
                </select>
                <input className="input" style={{ width: 80 }} type="number" step="any" placeholder={t("sales.sacks")} value={it.sacks} onChange={(e) => setItem(i, "sacks", e.target.value)} required />
                <input className="input" style={{ width: 100 }} type="number" step="any" placeholder={t("sales.unitPrice")} value={it.unitPrice} onChange={(e) => setItem(i, "unitPrice", e.target.value)} required />
                {variant && <span className="k-sub" style={{ minWidth: 50 }}>{(Number(it.sacks) || 0) * (Number(it.unitPrice) || 0)}</span>}
                <button type="button" className="btn small danger" onClick={() => setItems((l) => l.filter((_, x) => x !== i))}>
                  ✕
                </button>
              </div>
            );
          })}
          <button type="button" className="btn small" onClick={() => setItems((l) => [...l, { variantId: "", sacks: "", unitPrice: "" }])}>
            + {t("sales.addItem")}
          </button>
        </Field>
        <div className="row">
          <div className="grow">
            <Field label={`${t("sales.total")}: ${total.toFixed(2)}`}>
              <input className="input" type="number" step="any" placeholder={t("sales.amountPaid")} value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} />
            </Field>
          </div>
          <div className="grow">
            <Field label={t("sales.note")}>
              <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
          </div>
        </div>
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
