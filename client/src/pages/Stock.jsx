import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, PackagePlus, PackageCheck, PackageSearch, Pencil, Trash2, Save, Search } from "lucide-react";
import { http } from "../api";
import { Modal, Field, Confirm, Badge, Empty, Loader } from "../components/ui";
import { useToast } from "../components/toast";

const UNITS = ["GRAM", "KG", "TONNE", "MILLILITRE", "LITRE", "PIECE", "BAG"];

export default function Stock() {
  const { t } = useTranslation();
  const toast = useToast();
  const [tab, setTab] = useState("raw");
  const [materials, setMaterials] = useState([]);
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [modal, setModal] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    Promise.all([
      http.get("/api/raw-materials").then(setMaterials).catch(() => {}),
      http.get("/api/finished-products").then(setProducts).catch(() => {}),
    ]).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const filteredMats = useMemo(() => {
    let list = materials;
    if (lowOnly) list = list.filter((m) => m.quantityKg <= m.minStockLevel);
    if (search) list = list.filter((m) => m.name.toLowerCase().includes(search.toLowerCase()));
    return list;
  }, [materials, search, lowOnly]);

  const unitName = (u) => t(`stock.units.${u}`, { defaultValue: u });

  return (
    <div>
      <div className="card">
        <div className="row between stock-toolbar">
          <div className="row">
            <button className={`btn ${tab === "raw" ? "primary" : ""}`} onClick={() => setTab("raw")}>
              {t("stock.tabs.rawMaterials")}
            </button>
            <button className={`btn ${tab === "products" ? "primary" : ""}`} onClick={() => setTab("products")}>
              {t("stock.tabs.finishedProducts")}
            </button>
          </div>
          <div className="row stock-filters">
            <div className="search-wrap stock-search">
              <Search size={14} className="search-ico" />
              <input className="input search-input" placeholder={t("stock.search.placeholder")} value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <button className={`btn stock-low ${lowOnly ? "primary" : ""}`} onClick={() => setLowOnly((v) => !v)}>
              <PackageSearch size={15} /> <span className="stock-low-label">{t("stock.lowStockFilter")}</span>
            </button>
          </div>
          <div className="row stock-actions">
            {tab === "raw" ? (
              <>
                <button className="btn success" onClick={() => setModal({ type: "newMaterial" })}>
                  <Plus size={16} /> {t("stock.addMaterial")}
                </button>
                <button className="btn primary" onClick={() => setModal({ type: "addStock" })}>
                  <PackagePlus size={16} /> {t("stock.addStock")}
                </button>
              </>
            ) : (
              <>
                <button className="btn success" onClick={() => setModal({ type: "newProduct" })}>
                  <Plus size={16} /> {t("stock.addProduct")}
                </button>
                <button className="btn primary" onClick={() => setModal({ type: "addProduction" })}>
                  <PackageCheck size={16} /> {t("stock.addProduction")}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {tab === "raw" ? (
        <div className="card">
          {loading ? (
            <Loader />
          ) : filteredMats.length === 0 ? (
            <Empty text={t("app.noData")} />
          ) : (
            <table>
              <thead>
                <tr>
                  <th>{t("stock.rawMaterialColumns.name")}</th>
                  <th>{t("stock.rawMaterialColumns.unit")}</th>
                  <th>{t("stock.rawMaterialColumns.quantity")}</th>
                  <th>{t("stock.rawMaterialColumns.cost")}</th>
                  <th>{t("stock.rawMaterialColumns.min")}</th>
                  <th>{t("stock.rawMaterialColumns.status")}</th>
                  <th>{t("app.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredMats.map((m) => {
                  const status = m.quantityKg <= 0 ? "out" : m.quantityKg <= m.minStockLevel ? "low" : "ok";
                  return (
                    <tr key={m.id}>
                      <td data-label={t("stock.rawMaterialColumns.name")}>{m.name}</td>
                      <td data-label={t("stock.rawMaterialColumns.unit")}>{unitName(m.unit)}</td>
                      <td data-label={t("stock.rawMaterialColumns.quantity")}>{m.quantityKg}</td>
                      <td data-label={t("stock.rawMaterialColumns.cost")}>{m.costPerKg ? Number(m.costPerKg).toFixed(2) : "—"}</td>
                      <td data-label={t("stock.rawMaterialColumns.min")}>{m.minStockLevel}</td>
                      <td data-label={t("stock.rawMaterialColumns.status")}>
                        <Badge tone={status === "ok" ? "green" : status === "low" ? "amber" : "red"}>{t(`stock.status.${status}`)}</Badge>
                      </td>
                      <td data-label={t("app.actions")}>
                        <div className="row">
                          <button className="btn small" onClick={() => setModal({ type: "editMaterial", m })}>
                            <Pencil size={14} /> {t("app.edit")}
                          </button>
                          <button className="btn small danger" onClick={() => setConfirm({ kind: "material", m })}>
                            <Trash2 size={14} /> {t("app.delete")}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <div className="card">
          {loading ? (
            <Loader />
          ) : products.length === 0 ? (
            <Empty text={t("app.noData")} />
          ) : (
            <table>
              <thead>
                <tr>
                  <th>{t("stock.productColumns.name")}</th>
                  <th>{t("stock.productColumns.variants")}</th>
                  <th>{t("stock.productColumns.stock")}</th>
                  <th>{t("stock.productColumns.price")}</th>
                  <th>{t("stock.productColumns.min")}</th>
                  <th>{t("app.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id}>
                    <td data-label={t("stock.productColumns.name")}>{p.name}</td>
                    <td data-label={t("stock.productColumns.variants")}>{p.variants.map((v) => `${v.sackSizeKg}kg`).join(", ") || "—"}</td>
                    <td data-label={t("stock.productColumns.stock")}>{p.stockSacks}</td>
                    <td data-label={t("stock.productColumns.price")}>{p.defaultPricePerSack != null ? Number(p.defaultPricePerSack).toFixed(2) : "—"}</td>
                    <td data-label={t("stock.productColumns.min")}>{p.minimumStockSacks}</td>
                    <td data-label={t("app.actions")}>
                      <div className="row">
                        <button className="btn small" onClick={() => setModal({ type: "editProduct", p })}>
                          <Pencil size={14} /> {t("app.edit")}
                        </button>
                        <button className="btn small danger" onClick={() => setConfirm({ kind: "product", p })}>
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
      )}

      {modal?.type === "newMaterial" && (
        <NewMaterialModal
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null);
            load();
          }}
        />
      )}
      {modal?.type === "addStock" && (
        <AddStockModal materials={materials} onClose={() => setModal(null)} onDone={() => { setModal(null); load(); }} />
      )}
      {modal?.type === "editMaterial" && (
        <EditMaterialModal m={modal.m} onClose={() => setModal(null)} onDone={() => { setModal(null); load(); }} />
      )}
      {modal?.type === "newProduct" && (
        <NewProductModal onClose={() => setModal(null)} onDone={() => { setModal(null); load(); }} />
      )}
      {modal?.type === "addProduction" && (
        <AddProductionModal products={products} onClose={() => setModal(null)} onDone={() => { setModal(null); load(); }} />
      )}
      {modal?.type === "editProduct" && (
        <EditProductModal p={modal.p} onClose={() => setModal(null)} onDone={() => { setModal(null); load(); }} />
      )}

      {confirm?.kind === "material" && (
        <Confirm
          danger
          title={t("stock.editMaterialTitle")}
          message={t("stock.confirmDeleteMaterial")}
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            await http.delete(`/api/raw-materials/${confirm.m.id}`);
            toast.success(t("app.delete"), confirm.m.name);
            setConfirm(null);
            load();
          }}
        />
      )}
      {confirm?.kind === "product" && (
        <Confirm
          danger
          title={t("stock.editProductTitle")}
          message={t("stock.confirmDeleteProduct")}
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            await http.delete(`/api/finished-products/${confirm.p.id}`);
            toast.success(t("app.delete"), confirm.p.name);
            setConfirm(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function NewMaterialModal({ onClose, onDone }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [form, setForm] = useState({ name: "", unit: "KG", minStockLevel: "", purchasedQuantity: "", totalPurchasePrice: "", purchaseDate: "", note: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await http.post("/api/raw-material-purchases/new-material", {
        ...form,
        minStockLevel: Number(form.minStockLevel) || 0,
        purchasedQuantity: Number(form.purchasedQuantity) || 0,
        totalPurchasePrice: Number(form.totalPurchasePrice) || 0,
        purchaseDate: form.purchaseDate || undefined,
      });
      toast.success(t("stock.addMaterial"), form.name);
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={t("stock.addMaterial")} onClose={onClose}>
      {error && <div className="error-banner">{error}</div>}
      <form onSubmit={submit}>
        <Field label={t("app.name")} required>
          <input className="input" value={form.name} onChange={set("name")} required />
        </Field>
        <Field label={t("stock.unit")}>
          <select className="input" value={form.unit} onChange={set("unit")}>
            {UNITS.map((u) => (
              <option key={u} value={u}>
                {t(`stock.units.${u}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("stock.minStockLevel")}>
          <input className="input" type="number" step="any" value={form.minStockLevel} onChange={set("minStockLevel")} />
        </Field>
        <h4 style={{ marginBottom: 8 }}>{t("stock.firstPurchaseTitle")}</h4>
        <div className="row">
          <div className="grow">
            <Field label={t("stock.purchasedQuantity")}>
              <input className="input" type="number" step="any" value={form.purchasedQuantity} onChange={set("purchasedQuantity")} />
            </Field>
          </div>
          <div className="grow">
            <Field label={t("stock.totalPurchasePrice")}>
              <input className="input" type="number" step="any" value={form.totalPurchasePrice} onChange={set("totalPurchasePrice")} />
            </Field>
          </div>
        </div>
        <Field label={t("stock.purchaseDate")}>
          <input className="input" type="date" value={form.purchaseDate} onChange={set("purchaseDate")} />
        </Field>
        <Field label={t("app.note")}>
          <input className="input" value={form.note} onChange={set("note")} />
        </Field>
        <div className="actions">
          <button type="button" className="btn" onClick={onClose}>
            {t("app.cancel")}
          </button>
          <button className="btn primary" disabled={busy}>
            {busy ? t("app.loading") : (<><Save size={15} /> {t("stock.submitCreate")}</>)}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function AddStockModal({ materials, onClose, onDone }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [form, setForm] = useState({ rawMaterialId: "", purchasedQuantity: "", unitCost: "", purchaseDate: "", note: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await http.post("/api/raw-material-purchases/add-stock", {
        rawMaterialId: Number(form.rawMaterialId),
        purchasedQuantity: Number(form.purchasedQuantity),
        unitCost: Number(form.unitCost) || 0,
        purchaseDate: form.purchaseDate || undefined,
        note: form.note || undefined,
      });
      toast.success(t("stock.addStock"), materials.find((m) => String(m.id) === String(form.rawMaterialId))?.name);
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={t("stock.addStock")} onClose={onClose}>
      {error && <div className="error-banner">{error}</div>}
      <form onSubmit={submit}>
        <Field label={t("app.name")} required>
          <select className="input" value={form.rawMaterialId} onChange={set("rawMaterialId")} required>
            <option value="">—</option>
            {materials.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("stock.purchasedQuantity")} required>
          <input className="input" type="number" step="any" value={form.purchasedQuantity} onChange={set("purchasedQuantity")} required />
        </Field>
        <Field label={t("stock.unitCost")}>
          <input className="input" type="number" step="any" value={form.unitCost} onChange={set("unitCost")} />
        </Field>
        <Field label={t("stock.purchaseDate")}>
          <input className="input" type="date" value={form.purchaseDate} onChange={set("purchaseDate")} />
        </Field>
        <Field label={t("app.note")}>
          <input className="input" value={form.note} onChange={set("note")} />
        </Field>
        <div className="actions">
          <button type="button" className="btn" onClick={onClose}>
            {t("app.cancel")}
          </button>
          <button className="btn primary" disabled={busy}>
            {busy ? t("app.loading") : (<><Save size={15} /> {t("stock.submitAddStock")}</>)}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EditMaterialModal({ m, onClose, onDone }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [name, setName] = useState(m.name);
  const [minStockLevel, setMinStockLevel] = useState(m.minStockLevel);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await http.patch(`/api/raw-materials/${m.id}`, { name, minStockLevel: Number(minStockLevel) || 0 });
      toast.success(t("app.edit"), name);
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={t("stock.editMaterialTitle")} onClose={onClose}>
      {error && <div className="error-banner">{error}</div>}
      <form onSubmit={submit}>
        <Field label={t("app.name")} required>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field label={t("stock.unit")}>
          <input className="input" value={t(`stock.units.${m.unit}`)} disabled />
          {m.purchaseCount > 0 && <small style={{ color: "var(--warning)" }}>{t("stock.unitLockedHint")}</small>}
        </Field>
        <Field label={t("stock.minStockLevel")}>
          <input className="input" type="number" step="any" value={minStockLevel} onChange={(e) => setMinStockLevel(e.target.value)} />
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

function NewProductModal({ onClose, onDone }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [form, setForm] = useState({ name: "", sackSizeKg: "", defaultPricePerSack: "", minimumStockSacks: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await http.post("/api/finished-products", {
        name: form.name,
        sackSizeKg: Number(form.sackSizeKg) || undefined,
        defaultPricePerSack: Number(form.defaultPricePerSack) || undefined,
        minimumStockSacks: Number(form.minimumStockSacks) || 0,
      });
      toast.success(t("stock.addProduct"), form.name);
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={t("stock.addProduct")} onClose={onClose}>
      {error && <div className="error-banner">{error}</div>}
      <form onSubmit={submit}>
        <Field label={t("app.name")} required>
          <input className="input" value={form.name} onChange={set("name")} required />
        </Field>
        <Field label={t("stock.sackSizeKg")} required>
          <input className="input" type="number" step="any" value={form.sackSizeKg} onChange={set("sackSizeKg")} required />
        </Field>
        <Field label={t("stock.defaultPricePerSack")}>
          <input className="input" type="number" step="any" value={form.defaultPricePerSack} onChange={set("defaultPricePerSack")} />
        </Field>
        <Field label={t("stock.minimumStockSacks")}>
          <input className="input" type="number" step="any" value={form.minimumStockSacks} onChange={set("minimumStockSacks")} />
        </Field>
        <div className="actions">
          <button type="button" className="btn" onClick={onClose}>
            {t("app.cancel")}
          </button>
          <button className="btn primary" disabled={busy}>
            {busy ? t("app.loading") : (<><Save size={15} /> {t("stock.submitCreate")}</>)}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function AddProductionModal({ products, onClose, onDone }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [form, setForm] = useState({ variantId: "", producedQuantityKg: "", producedSacks: "", totalProductionCost: "", defaultPricePerSack: "", productionDate: "", note: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const variant = products.flatMap((p) => p.variants.map((v) => ({ ...v, productName: p.name }))).find((v) => String(v.id) === String(form.variantId));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await http.post("/api/finished-products/add-production", {
        finishedProductVariantId: Number(form.variantId),
        producedQuantityKg: Number(form.producedQuantityKg) || undefined,
        producedSacks: Number(form.producedSacks) || 0,
        totalProductionCost: Number(form.totalProductionCost) || undefined,
        defaultPricePerSack: form.defaultPricePerSack ? Number(form.defaultPricePerSack) : undefined,
        productionDate: form.productionDate || undefined,
        note: form.note || undefined,
      });
      toast.success(t("stock.addProduction"), variant ? `${variant.productName} · ${variant.sackSizeKg}kg` : undefined);
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={t("stock.addProduction")} onClose={onClose}>
      {error && <div className="error-banner">{error}</div>}
      <form onSubmit={submit}>
        <Field label={t("production.product")} required>
          <select className="input" value={form.variantId} onChange={set("variantId")} required>
            <option value="">—</option>
            {products.map((p) =>
              p.variants.map((v) => (
                <option key={v.id} value={v.id}>
                  {p.name} · {v.sackSizeKg}kg
                </option>
              ))
            )}
          </select>
        </Field>
        <div className="row">
          <div className="grow">
            <Field label={t("stock.producedQuantityKg")}>
              <input className="input" type="number" step="any" value={form.producedQuantityKg} onChange={set("producedQuantityKg")} />
            </Field>
          </div>
          <div className="grow">
            <Field label={t("stock.producedSacks")} required>
              <input className="input" type="number" step="any" value={form.producedSacks} onChange={set("producedSacks")} required />
            </Field>
          </div>
        </div>
        <div className="row">
          <div className="grow">
            <Field label={t("stock.totalProductionCost")}>
              <input className="input" type="number" step="any" value={form.totalProductionCost} onChange={set("totalProductionCost")} />
            </Field>
          </div>
          <div className="grow">
            <Field label={t("stock.updateSellingPrice")}>
              <input className="input" type="number" step="any" value={form.defaultPricePerSack} placeholder={variant?.defaultPricePerSack ?? ""} onChange={set("defaultPricePerSack")} />
            </Field>
          </div>
        </div>
        <Field label={t("production.productionDate")}>
          <input className="input" type="date" value={form.productionDate} onChange={set("productionDate")} />
        </Field>
        <Field label={t("app.note")}>
          <input className="input" value={form.note} onChange={set("note")} />
        </Field>
        <div className="actions">
          <button type="button" className="btn" onClick={onClose}>
            {t("app.cancel")}
          </button>
          <button className="btn primary" disabled={busy}>
            {busy ? t("app.loading") : (<><Save size={15} /> {t("stock.submitAddProduction")}</>)}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EditProductModal({ p, onClose, onDone }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [name, setName] = useState(p.name);
  const [defaultPricePerSack, setDefaultPricePerSack] = useState(p.defaultPricePerSack ?? "");
  const [minimumStockSacks, setMinimumStockSacks] = useState(p.minimumStockSacks);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await http.patch(`/api/finished-products/${p.id}`, {
        name,
        defaultPricePerSack: defaultPricePerSack === "" ? undefined : Number(defaultPricePerSack),
        minimumStockSacks: Number(minimumStockSacks) || 0,
      });
      toast.success(t("app.edit"), name);
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={t("stock.editProductTitle")} onClose={onClose}>
      {error && <div className="error-banner">{error}</div>}
      <form onSubmit={submit}>
        <Field label={t("app.name")} required>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field label={t("stock.defaultPricePerSack")}>
          <input className="input" type="number" step="any" value={defaultPricePerSack} onChange={(e) => setDefaultPricePerSack(e.target.value)} />
        </Field>
        <Field label={t("stock.minimumStockSacks")}>
          <input className="input" type="number" step="any" value={minimumStockSacks} onChange={(e) => setMinimumStockSacks(e.target.value)} />
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
