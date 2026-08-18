import { Router } from "express";
import { db } from "../db.js";
import { ah } from "../async.js";

export const productionRouter = Router();

async function serializeBatch(b) {
  const consumptions = JSON.parse(b.consumptions || "[]");
  const items = await Promise.all(
    consumptions.map(async (c) => {
      const mat = await db.get("SELECT name FROM raw_materials WHERE id = ?", c.rawMaterialId);
      return {
        rawMaterialId: c.rawMaterialId,
        quantityKg: c.quantityKg,
        rawMaterialName: mat?.name || null,
      };
    })
  );
  const product = await db.get("SELECT name FROM finished_products WHERE id = ?", b.finished_product_id);
  return {
    id: b.id,
    finishedProductId: b.finished_product_id,
    finishedProductName: product?.name,
    finishedProductVariantId: b.finished_product_variant_id,
    recipeId: b.recipe_id,
    status: b.status,
    expectedOutputKg: b.expected_output_kg,
    batchDate: b.batch_date,
    notes: b.notes,
    consumptions: items,
    actualOutputKg: b.actual_output_kg,
    sacksProduced: b.sacks_produced,
    kgDamaged: b.kg_damaged,
    declaredWaste: b.declared_waste,
    wasteReason: b.waste_reason,
    totalProductionCost: b.total_production_cost,
    defaultPricePerSack: b.default_price_per_sack,
    productionDate: b.production_date,
    cancellationReason: b.cancellation_reason,
    createdAt: b.created_at,
  };
}

productionRouter.get(
  "/production-batches",
  ah(async (req, res) => {
    const { status } = req.query;
    let q = "SELECT * FROM production_batches";
    const params = [];
    if (status) {
      q += " WHERE status = ?";
      params.push(status);
    }
    q += " ORDER BY created_at DESC";
    const rows = await db.all(q, ...params);
    res.json(await Promise.all(rows.map(serializeBatch)));
  })
);

productionRouter.post(
  "/production-batches",
  ah(async (req, res) => {
    const { finishedProductId, finishedProductVariantId, recipeId, expectedOutputKg, batchDate, notes, consumptions = [] } =
      req.body || {};
    if (!finishedProductId || !finishedProductVariantId)
      return res.status(400).json({ error: { code: "INVALID_BODY", message: "finishedProductId and finishedProductVariantId required" } });
    const info = await db.run(
      "INSERT INTO production_batches (finished_product_id, finished_product_variant_id, recipe_id, status, expected_output_kg, batch_date, notes, consumptions) VALUES (?, ?, ?, 'RUNNING', ?, ?, ?, ?)",
      finishedProductId,
      finishedProductVariantId,
      recipeId || null,
      expectedOutputKg != null ? Number(expectedOutputKg) : null,
      batchDate || new Date().toISOString(),
      notes || null,
      JSON.stringify(consumptions)
    );
    res.status(201).json({ id: info.lastInsertRowid });
  })
);

productionRouter.post(
  "/production-batches/:id/complete",
  ah(async (req, res) => {
    const batch = await db.get("SELECT * FROM production_batches WHERE id = ?", req.params.id);
    if (!batch) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Batch not found" } });
    const { actualOutputKg, sacksProduced, kgDamaged, declaredWaste, wasteReason, totalProductionCost, defaultPricePerSack, consumptions } = req.body || {};
    await db.tx(async (t) => {
      await t.run(
        "UPDATE production_batches SET status = 'COMPLETED', actual_output_kg = ?, sacks_produced = ?, kg_damaged = ?, declared_waste = ?, waste_reason = ?, total_production_cost = ?, default_price_per_sack = COALESCE(?, default_price_per_sack), consumptions = COALESCE(?, consumptions) WHERE id = ?",
        actualOutputKg != null ? Number(actualOutputKg) : null,
        Number(sacksProduced) || 0,
        kgDamaged != null ? Number(kgDamaged) : null,
        declaredWaste != null ? Number(declaredWaste) : null,
        wasteReason || null,
        totalProductionCost != null ? Number(totalProductionCost) : null,
        defaultPricePerSack != null ? Number(defaultPricePerSack) : null,
        consumptions ? JSON.stringify(consumptions) : null,
        req.params.id
      );
      const sacks = Number(sacksProduced) || 0;
      if (sacks > 0) {
        await t.run(
          "UPDATE finished_product_variants SET stock_sacks = stock_sacks + ? WHERE id = ?",
          sacks,
          batch.finished_product_variant_id
        );
      }
      for (const c of consumptions || []) {
        const qty = Number(c.quantityKg) || 0;
        if (qty > 0) {
          await t.run(
            "UPDATE raw_materials SET quantity_kg = GREATEST(0, quantity_kg - ?) WHERE id = ?",
            qty,
            c.rawMaterialId
          );
        }
      }
    });
    res.json({ ok: true });
  })
);

productionRouter.post(
  "/production-batches/:id/cancel",
  ah(async (req, res) => {
    const batch = await db.get("SELECT * FROM production_batches WHERE id = ?", req.params.id);
    if (!batch) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Batch not found" } });
    const { reason } = req.body || {};
    await db.run(
      "UPDATE production_batches SET status = 'CANCELLED', cancellation_reason = ? WHERE id = ?",
      reason || null,
      req.params.id
    );
    res.json({ ok: true });
  })
);
