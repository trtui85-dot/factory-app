import { Router } from "express";
import { db } from "../db.js";
import { ah } from "../async.js";

export const rawMaterialsRouter = Router();

const MAT_QRY = `
SELECT rm.*,
  (SELECT COUNT(*) FROM raw_material_purchases rp WHERE rp.raw_material_id = rm.id) AS purchase_count
FROM raw_materials rm
`;

rawMaterialsRouter.get(
  "/raw-materials",
  ah(async (req, res) => {
    const rows = await db.all(MAT_QRY);
    res.json(
      rows.map((r) => ({
        id: r.id,
        name: r.name,
        unit: r.unit,
        minStockLevel: r.min_stock_level,
        quantityKg: r.quantity_kg,
        costPerKg: r.cost_per_kg,
        purchaseCount: r.purchase_count,
      }))
    );
  })
);

rawMaterialsRouter.post(
  "/raw-materials",
  ah(async (req, res) => {
    const { name, unit = "KG", minStockLevel = 0 } = req.body || {};
    if (!name) return res.status(400).json({ error: { code: "INVALID_BODY", message: "name is required" } });
    const info = await db.run(
      "INSERT INTO raw_materials (name, unit, min_stock_level) VALUES (?, ?, ?)",
      name,
      unit,
      Number(minStockLevel) || 0
    );
    res.status(201).json({ id: info.lastInsertRowid });
  })
);

rawMaterialsRouter.post(
  "/raw-material-purchases/new-material",
  ah(async (req, res) => {
    const { name, unit = "KG", minStockLevel = 0, purchasedQuantity = 0, totalPurchasePrice = 0, purchaseDate, note } =
      req.body || {};
    if (!name) return res.status(400).json({ error: { code: "INVALID_BODY", message: "name is required" } });
    const qty = Number(purchasedQuantity) || 0;
    const total = Number(totalPurchasePrice) || 0;
    const unitCost = qty > 0 ? total / qty : 0;
    const id = await db.tx(async (t) => {
      const info = await t.run(
        "INSERT INTO raw_materials (name, unit, min_stock_level, quantity_kg, cost_per_kg) VALUES (?, ?, ?, ?, ?)",
        name,
        unit,
        Number(minStockLevel) || 0,
        qty,
        unitCost
      );
      const matId = info.lastInsertRowid;
      await t.run(
        "INSERT INTO raw_material_purchases (raw_material_id, purchased_quantity, unit_cost, total_purchase_price, purchase_date, note) VALUES (?, ?, ?, ?, ?, ?)",
        matId,
        qty,
        unitCost,
        total,
        purchaseDate || new Date().toISOString(),
        note || null
      );
      return matId;
    });
    res.status(201).json({ id });
  })
);

rawMaterialsRouter.post(
  "/raw-material-purchases/add-stock",
  ah(async (req, res) => {
    const { rawMaterialId, purchasedQuantity, unitCost, purchaseDate, note } = req.body || {};
    if (!rawMaterialId || !purchasedQuantity)
      return res.status(400).json({ error: { code: "INVALID_BODY", message: "rawMaterialId and purchasedQuantity required" } });
    const mat = await db.get("SELECT * FROM raw_materials WHERE id = ?", rawMaterialId);
    if (!mat) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Material not found" } });
    const qty = Number(purchasedQuantity) || 0;
    const cost = Number(unitCost) || 0;
    const total = qty * cost;
    await db.tx(async (t) => {
      await t.run(
        "INSERT INTO raw_material_purchases (raw_material_id, purchased_quantity, unit_cost, total_purchase_price, purchase_date, note) VALUES (?, ?, ?, ?, ?, ?)",
        rawMaterialId,
        qty,
        cost,
        total,
        purchaseDate || new Date().toISOString(),
        note || null
      );
      const newQty = Number(mat.quantity_kg) + qty;
      const newCost = newQty > 0 ? (Number(mat.quantity_kg) * Number(mat.cost_per_kg) + total) / newQty : cost;
      await t.run("UPDATE raw_materials SET quantity_kg = ?, cost_per_kg = ? WHERE id = ?", newQty, newCost, rawMaterialId);
    });
    res.json({ ok: true });
  })
);

rawMaterialsRouter.patch(
  "/raw-materials/:id",
  ah(async (req, res) => {
    const mat = await db.get("SELECT * FROM raw_materials WHERE id = ?", req.params.id);
    if (!mat) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Material not found" } });
    const { name, unit, minStockLevel } = req.body || {};
    const hist = await db.get(
      "SELECT COUNT(*) AS c FROM raw_material_purchases WHERE raw_material_id = ?",
      req.params.id
    );
    const hasHistory = Number(hist.c) > 0;
    if (unit && unit !== mat.unit && hasHistory)
      return res.status(400).json({ error: { code: "UNIT_LOCKED", message: "Unit cannot be changed after purchases" } });
    await db.run(
      "UPDATE raw_materials SET name = COALESCE(?, name), unit = COALESCE(?, unit), min_stock_level = COALESCE(?, min_stock_level) WHERE id = ?",
      name ?? null,
      unit ?? null,
      minStockLevel != null ? Number(minStockLevel) : null,
      req.params.id
    );
    res.json({ ok: true });
  })
);

rawMaterialsRouter.delete(
  "/raw-materials/:id",
  ah(async (req, res) => {
    await db.tx(async (t) => {
      await t.run("DELETE FROM raw_material_purchases WHERE raw_material_id = ?", req.params.id);
      await t.run("DELETE FROM raw_materials WHERE id = ?", req.params.id);
    });
    res.json({ ok: true });
  })
);
