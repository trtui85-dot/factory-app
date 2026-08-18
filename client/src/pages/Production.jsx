import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Play, CheckCircle2, Ban, Save, FileDown } from "lucide-react";
import { http, openReceipt } from "../api";
import { Modal, Field, Confirm, Badge, Empty, Loader } from "../components/ui";
import { useToast } from "../components/toast";

export default function Production() {
  const { t } = useTranslation();
  const toast = useToast();
  const [batches, setBatches] = useState([]);
  const [products, setProducts] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [modal, setModal] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    Promise.all([
      http.get("/api/production-batches").then(setBatches).catch(() => {}),
      http.get("/api/finished-products").then(setProducts).catch(() => {}),
      http.get("/api/recipes").then(setRecipes).catch(() => {}),
      http.get("/api/raw-materials").then(setMaterials).catch(() => {}),
    ]).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const statusTone = { RUNNING: "blue", COMPLETED: "green", CANCELLED: "red" };

  return (
    <div>
      <div className="card">
        <button className="btn success" onClick={() => setModal({ type: "start" })}>
          <Play size={16} /> {t("production.startTitle")}
        </button>
      </div>

      <div className="card">
        {loading ? (
          <Loader />
        ) : batches.length === 0 ? (
          <Empty text={t("app.noData")} />
        ) : (
          <table>
            <thead>
              <tr>
                <th>{t("production.product")}</th>
                <th>{t("production.batchDate")}</th>
                <th>{t("production.expectedOutputKg")}</th>
                <th>{t("production.actualOutputKg")}</th>
                <th>{t("production.sacksProduced")}</th>
                <th>{t("app.status")}</th>
                <th>{t("app.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.id}>
                  <td data-label={t("production.product")}>{b.finishedProductName}</td>
                  <td data-label={t("production.batchDate")}>{new Date(b.batchDate).toLocaleString()}</td>
                  <td data-label={t("production.expectedOutputKg")}>{b.expectedOutputKg ?? "—"}</td>
                  <td data-label={t("production.actualOutputKg")}>{b.actualOutputKg ?? "—"}</td>
                  <td data-label={t("production.sacksProduced")}>{b.sacksProduced ?? "—"}</td>
                  <td data-label={t("app.status")}>
                    <Badge tone={statusTone[b.status]}>{t(`production.status.${b.status}`)}</Badge>
                  </td>
                  <td data-label={t("app.actions")}>
                    <div className="row">
                      <button className="btn small" onClick={() => openReceipt("production", b.id)}>
                        <FileDown size={14} /> PDF
                      </button>
                      {b.status === "RUNNING" && (
                        <button className="btn small success" onClick={() => setModal({ type: "complete", b })}>
                          <CheckCircle2 size={14} /> {t("production.complete")}
                        </button>
                      )}
                      {b.status === "RUNNING" && (
                        <button className="btn small danger" onClick={() => setConfirm(b)}>
                          <Ban size={14} /> {t("production.cancel")}
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

      {modal?.type === "start" && (
        <StartBatchModal products={products} recipes={recipes} materials={materials} onClose={() => setModal(null)} onDone={() => { setModal(null); load(); }} />
      )}
      {modal?.type === "complete" && (
        <CompleteBatchModal b={modal.b} materials={materials} onClose={() => setModal(null)} onDone={() => { setModal(null); load(); }} />
      )}
      {confirm && (
        <Confirm
          danger
          title={t("production.cancel")}
          message={t("production.confirmCancel")}
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            await http.post(`/api/production-batches/${confirm.id}/cancel`, { reason: t("app.cancel") });
            toast.success(t("production.cancel"), confirm.finishedProductName);
            setConfirm(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function StartBatchModal({ products, recipes, materials, onClose, onDone }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [form, setForm] = useState({ productId: "", variantId: "", recipeId: "", expectedOutputKg: "", batchDate: "", notes: "" });
  const [consumptions, setConsumptions] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const variants = products.flatMap((p) => p.variants.map((v) => ({ ...v, productId: p.id, productName: p.name })));

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const setRecipe = (e) => {
    const rid = e.target.value;
    setForm((f) => ({ ...f, recipeId: rid }));
    const rec = recipes.find((r) => String(r.id) === String(rid));
    if (rec) {
      setConsumptions(rec.ingredients.map((i) => ({ rawMaterialId: i.rawMaterialId, quantityKg: i.quantity })));
    }
  };

  const setCons = (i, k, v) => setConsumptions((l) => l.map((c, x) => (x === i ? { ...c, [k]: v } : c)));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await http.post("/api/production-batches", {
        finishedProductId: Number(form.productId),
        finishedProductVariantId: Number(form.variantId),
        recipeId: form.recipeId ? Number(form.recipeId) : undefined,
        expectedOutputKg: form.expectedOutputKg ? Number(form.expectedOutputKg) : undefined,
        batchDate: form.batchDate || undefined,
        notes: form.notes || undefined,
        consumptions: consumptions.filter((c) => c.rawMaterialId),
      });
      toast.success(t("production.startTitle"), variants.find((v) => String(v.id) === String(form.variantId))?.productName);
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={t("production.startTitle")} onClose={onClose}>
      {error && <div className="error-banner">{error}</div>}
      <form onSubmit={submit}>
        <Field label={t("production.product")} required>
          <select className="input" value={form.productId} onChange={(e) => { set("productId")(e); setForm((f) => ({ ...f, variantId: "" })); }} required>
            <option value="">—</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("production.variant")} required>
          <select className="input" value={form.variantId} onChange={set("variantId")} required>
            <option value="">—</option>
            {variants.filter((v) => String(v.productId) === String(form.productId)).map((v) => (
              <option key={v.id} value={v.id}>
                {v.sackSizeKg}kg
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("production.recipe")}>
          <select className="input" value={form.recipeId} onChange={setRecipe}>
            <option value="">—</option>
            {recipes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="row">
          <div className="grow">
            <Field label={t("production.expectedOutputKg")}>
              <input className="input" type="number" step="any" value={form.expectedOutputKg} onChange={set("expectedOutputKg")} />
            </Field>
          </div>
          <div className="grow">
            <Field label={t("production.batchDate")}>
              <input className="input" type="date" value={form.batchDate} onChange={set("batchDate")} />
            </Field>
          </div>
        </div>
        <Field label={t("production.consumptions")}>
          {consumptions.map((c, i) => (
            <div className="row" key={i} style={{ marginBottom: 8 }}>
              <select className="input grow" value={c.rawMaterialId || ""} onChange={(e) => setCons(i, "rawMaterialId", Number(e.target.value))}>
                <option value="">—</option>
                {materials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
              <input className="input" style={{ width: 100 }} type="number" step="any" placeholder={t("production.quantity")} value={c.quantityKg ?? ""} onChange={(e) => setCons(i, "quantityKg", Number(e.target.value))} />
              <button type="button" className="btn small danger" onClick={() => setConsumptions((l) => l.filter((_, x) => x !== i))}>
                ✕
              </button>
            </div>
          ))}
          <button type="button" className="btn small" onClick={() => setConsumptions((l) => [...l, { rawMaterialId: "", quantityKg: 0 }])}>
            + {t("production.addMaterial")}
          </button>
        </Field>
        <Field label={t("production.notes")}>
          <textarea className="input" rows={2} value={form.notes} onChange={set("notes")} />
        </Field>
        <div className="actions">
          <button type="button" className="btn" onClick={onClose}>
            {t("app.cancel")}
          </button>
          <button className="btn primary" disabled={busy}>
            {busy ? t("app.loading") : (<><Play size={15} /> {t("production.start")}</>)}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function CompleteBatchModal({ b, materials, onClose, onDone }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [form, setForm] = useState({ actualOutputKg: b.expectedOutputKg ?? "", sacksProduced: "", kgDamaged: "", declaredWaste: "", wasteReason: "", totalProductionCost: "" });
  const [consumptions, setConsumptions] = useState(b.consumptions.map((c) => ({ rawMaterialId: c.rawMaterialId, quantityKg: c.quantityKg })));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setCons = (i, k, v) => setConsumptions((l) => l.map((c, x) => (x === i ? { ...c, [k]: v } : c)));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await http.post(`/api/production-batches/${b.id}/complete`, {
        actualOutputKg: form.actualOutputKg ? Number(form.actualOutputKg) : undefined,
        sacksProduced: Number(form.sacksProduced) || 0,
        kgDamaged: form.kgDamaged ? Number(form.kgDamaged) : undefined,
        declaredWaste: form.declaredWaste ? Number(form.declaredWaste) : undefined,
        wasteReason: form.wasteReason || undefined,
        totalProductionCost: form.totalProductionCost ? Number(form.totalProductionCost) : undefined,
        consumptions: consumptions.filter((c) => c.rawMaterialId),
      });
      toast.success(t("production.completeTitle"), b.finishedProductName);
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={t("production.completeTitle")} onClose={onClose}>
      {error && <div className="error-banner">{error}</div>}
      <form onSubmit={submit}>
        <div className="row">
          <div className="grow">
            <Field label={t("production.actualOutputKg")}>
              <input className="input" type="number" step="any" value={form.actualOutputKg} onChange={set("actualOutputKg")} />
            </Field>
          </div>
          <div className="grow">
            <Field label={t("production.sacksProduced")} required>
              <input className="input" type="number" step="any" value={form.sacksProduced} onChange={set("sacksProduced")} required />
            </Field>
          </div>
        </div>
        <div className="row">
          <div className="grow">
            <Field label={t("production.kgDamaged")}>
              <input className="input" type="number" step="any" value={form.kgDamaged} onChange={set("kgDamaged")} />
            </Field>
          </div>
          <div className="grow">
            <Field label={t("production.declaredWaste")}>
              <input className="input" type="number" step="any" value={form.declaredWaste} onChange={set("declaredWaste")} />
            </Field>
          </div>
        </div>
        <Field label={t("production.wasteReason")}>
          <input className="input" value={form.wasteReason} onChange={set("wasteReason")} />
        </Field>
        <Field label={t("production.totalCost")}>
          <input className="input" type="number" step="any" value={form.totalProductionCost} onChange={set("totalProductionCost")} />
        </Field>
        <Field label={t("production.consumptions")}>
          {consumptions.map((c, i) => (
            <div className="row" key={i} style={{ marginBottom: 8 }}>
              <select className="input grow" value={c.rawMaterialId || ""} onChange={(e) => setCons(i, "rawMaterialId", Number(e.target.value))}>
                <option value="">—</option>
                {materials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
              <input className="input" style={{ width: 100 }} type="number" step="any" placeholder={t("production.quantity")} value={c.quantityKg ?? ""} onChange={(e) => setCons(i, "quantityKg", Number(e.target.value))} />
              <button type="button" className="btn small danger" onClick={() => setConsumptions((l) => l.filter((_, x) => x !== i))}>
                ✕
              </button>
            </div>
          ))}
          <button type="button" className="btn small" onClick={() => setConsumptions((l) => [...l, { rawMaterialId: "", quantityKg: 0 }])}>
            + {t("production.addMaterial")}
          </button>
        </Field>
        <div className="actions">
          <button type="button" className="btn" onClick={onClose}>
            {t("app.cancel")}
          </button>
          <button className="btn success" disabled={busy}>
            {busy ? t("app.loading") : (<><CheckCircle2 size={15} /> {t("production.complete")}</>)}
          </button>
        </div>
      </form>
    </Modal>
  );
}
