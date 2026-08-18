import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Pencil, Trash2, Save } from "lucide-react";
import { http } from "../api";
import { Modal, Field, Confirm, Empty, Loader } from "../components/ui";
import { useToast } from "../components/toast";

export default function Recipes() {
  const { t } = useTranslation();
  const toast = useToast();
  const [recipes, setRecipes] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [products, setProducts] = useState([]);
  const [modal, setModal] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    Promise.all([
      http.get("/api/recipes").then(setRecipes).catch(() => {}),
      http.get("/api/raw-materials").then(setMaterials).catch(() => {}),
      http.get("/api/finished-products").then(setProducts).catch(() => {}),
    ]).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  return (
    <div>
      <div className="card">
        <div className="row between">
          <button className="btn success" onClick={() => setModal({ type: "new" })}>
            <Plus size={16} /> {t("recipes.add")}
          </button>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <Loader />
        ) : recipes.length === 0 ? (
          <Empty text={t("app.noData")} />
        ) : (
          <table>
            <thead>
              <tr>
                <th>{t("recipes.name")}</th>
                <th>{t("recipes.productName")}</th>
                <th>{t("recipes.targetOutputKg")}</th>
                <th>{t("recipes.ingredients")}</th>
                <th>{t("app.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {recipes.map((r) => (
                <tr key={r.id}>
                  <td data-label={t("recipes.name")}>{r.name}</td>
                  <td data-label={t("recipes.productName")}>{r.product_name}</td>
                  <td data-label={t("recipes.targetOutputKg")}>{r.target_output_kg}</td>
                  <td data-label={t("recipes.ingredients")}>{r.ingredients.length}</td>
                  <td data-label={t("app.actions")}>
                    <div className="row">
                      <button className="btn small" onClick={() => setModal({ type: "edit", r })}>
                        <Pencil size={14} /> {t("app.edit")}
                      </button>
                      <button className="btn small danger" onClick={() => setConfirm(r)}>
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

      {(modal?.type === "new" || modal?.type === "edit") && (
        <RecipeModal r={modal.r} products={products} materials={materials} onClose={() => setModal(null)} onDone={() => { setModal(null); load(); }} />
      )}

      {confirm && (
        <Confirm
          danger
          title={t("recipes.title")}
          message={t("recipes.confirmDelete")}
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            await http.delete(`/api/recipes/${confirm.id}`);
            toast.success(t("app.delete"), confirm.name);
            setConfirm(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function RecipeModal({ r, products, materials, onClose, onDone }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [name, setName] = useState(r?.name || "");
  const [finishedProductId, setFinishedProductId] = useState(r?.finished_product_id || "");
  const [targetOutputKg, setTargetOutputKg] = useState(r?.target_output_kg ?? "");
  const [notes, setNotes] = useState(r?.notes || "");
  const [ingredients, setIngredients] = useState(r?.ingredients?.map((i) => ({ ...i })) || []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const setIng = (i, k, v) => setIngredients((list) => list.map((item, idx) => (idx === i ? { ...item, [k]: v } : item)));
  const matName = (id) => materials.find((m) => m.id === id)?.name || `#${id}`;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const body = { name, finishedProductId: Number(finishedProductId), targetOutputKg: Number(targetOutputKg) || 0, notes: notes || undefined, ingredients: ingredients.filter((i) => i.rawMaterialId) };
    try {
      if (r) {
        await http.patch(`/api/recipes/${r.id}`, body);
        toast.success(t("app.edit"), name);
      } else {
        await http.post("/api/recipes", body);
        toast.success(t("recipes.add"), name);
      }
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={r ? t("recipes.edit") : t("recipes.add")} onClose={onClose}>
      {error && <div className="error-banner">{error}</div>}
      <form onSubmit={submit}>
        <Field label={t("recipes.name")} required>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field label={t("recipes.product")} required>
          <select className="input" value={finishedProductId} onChange={(e) => setFinishedProductId(e.target.value)} required>
            <option value="">—</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("recipes.targetOutputKg")}>
          <input className="input" type="number" step="any" value={targetOutputKg} onChange={(e) => setTargetOutputKg(e.target.value)} />
        </Field>
        <Field label={t("recipes.ingredients")}>
          {ingredients.map((ing, i) => (
            <div className="row" key={i} style={{ marginBottom: 8 }}>
              <select className="input grow" value={ing.rawMaterialId || ""} onChange={(e) => setIng(i, "rawMaterialId", Number(e.target.value))}>
                <option value="">—</option>
                {materials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
              <input className="input" style={{ width: 100 }} type="number" step="any" placeholder={t("recipes.quantity")} value={ing.quantity ?? ""} onChange={(e) => setIng(i, "quantity", Number(e.target.value))} />
              <button type="button" className="btn small danger" onClick={() => setIngredients((l) => l.filter((_, x) => x !== i))}>
                ✕
              </button>
            </div>
          ))}
          <button type="button" className="btn small" onClick={() => setIngredients((l) => [...l, { rawMaterialId: "", quantity: 0 }])}>
            + {t("recipes.addIngredient")}
          </button>
        </Field>
        <Field label={t("recipes.notes")}>
          <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
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
