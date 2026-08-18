import { Router } from "express";
import { db } from "../db.js";
import { ah } from "../async.js";

export const productsRouter = Router();

async function serializeProduct(p) {
  const variants = await db.all(
    "SELECT * FROM finished_product_variants WHERE finished_product_id = ? ORDER BY id",
    p.id
  );
  const stockSacks = variants.reduce((s, v) => s + Number(v.stock_sacks), 0);
  return {
    id: p.id,
    name: p.name,
    unit: p.unit,
    sackSizeKg: p.sack_size_kg,
    defaultPricePerSack: p.default_price_per_sack,
    minimumStockSacks: p.minimum_stock_sacks,
    stockSacks,
    variants: variants.map((v) => ({
      id: v.id,
      sackSizeKg: v.sack_size_kg,
      defaultPricePerSack: v.default_price_per_sack,
      minimumStockSacks: v.minimum_stock_sacks,
      stockSacks: v.stock_sacks,
    })),
  };
}

productsRouter.get(
  "/finished-products",
  ah(async (req, res) => {
    const rows = await db.all("SELECT * FROM finished_products ORDER BY name");
    res.json(await Promise.all(rows.map(serializeProduct)));
  })
);

productsRouter.post(
  "/finished-products",
  ah(async (req, res) => {
    const { name, sackSizeKg, unit = "PIECE", defaultPricePerSack, minimumStockSacks = 0 } = req.body || {};
    if (!name) return res.status(400).json({ error: { code: "INVALID_BODY", message: "name is required" } });
    const pid = await db.tx(async (t) => {
      const info = await t.run(
        "INSERT INTO finished_products (name, unit, sack_size_kg, default_price_per_sack, minimum_stock_sacks) VALUES (?, ?, ?, ?, ?)",
        name,
        unit,
        sackSizeKg != null ? Number(sackSizeKg) : null,
        defaultPricePerSack != null ? Number(defaultPricePerSack) : null,
        Number(minimumStockSacks) || 0
      );
      const productId = info.lastInsertRowid;
      if (sackSizeKg != null) {
        await t.run(
          "INSERT INTO finished_product_variants (finished_product_id, sack_size_kg, default_price_per_sack, minimum_stock_sacks) VALUES (?, ?, ?, ?)",
          productId,
          Number(sackSizeKg),
          defaultPricePerSack != null ? Number(defaultPricePerSack) : null,
          Number(minimumStockSacks) || 0
        );
      }
      return productId;
    });
    res.status(201).json({ id: pid });
  })
);

productsRouter.post(
  "/finished-products/:id/variants",
  ah(async (req, res) => {
    const product = await db.get("SELECT * FROM finished_products WHERE id = ?", req.params.id);
    if (!product) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Product not found" } });
    const { sackSizeKg, defaultPricePerSack, minimumStockSacks = 0 } = req.body || {};
    if (!sackSizeKg) return res.status(400).json({ error: { code: "INVALID_BODY", message: "sackSizeKg is required" } });
    const info = await db.run(
      "INSERT INTO finished_product_variants (finished_product_id, sack_size_kg, default_price_per_sack, minimum_stock_sacks) VALUES (?, ?, ?, ?)",
      product.id,
      Number(sackSizeKg),
      defaultPricePerSack != null ? Number(defaultPricePerSack) : null,
      Number(minimumStockSacks) || 0
    );
    res.status(201).json({ id: info.lastInsertRowid });
  })
);

productsRouter.patch(
  "/finished-products/:id",
  ah(async (req, res) => {
    const product = await db.get("SELECT * FROM finished_products WHERE id = ?", req.params.id);
    if (!product) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Product not found" } });
    const { name, defaultPricePerSack, minimumStockSacks } = req.body || {};
    await db.run(
      "UPDATE finished_products SET name = COALESCE(?, name), default_price_per_sack = COALESCE(?, default_price_per_sack), minimum_stock_sacks = COALESCE(?, minimum_stock_sacks) WHERE id = ?",
      name ?? null,
      defaultPricePerSack != null ? Number(defaultPricePerSack) : null,
      minimumStockSacks != null ? Number(minimumStockSacks) : null,
      req.params.id
    );
    res.json({ ok: true });
  })
);

productsRouter.delete(
  "/finished-products/:id",
  ah(async (req, res) => {
    await db.tx(async (t) => {
      await t.run("DELETE FROM recipes WHERE finished_product_id = ?", req.params.id);
      await t.run("DELETE FROM production_batches WHERE finished_product_id = ?", req.params.id);
      await t.run("DELETE FROM finished_product_variants WHERE finished_product_id = ?", req.params.id);
      await t.run("DELETE FROM finished_products WHERE id = ?", req.params.id);
    });
    res.json({ ok: true });
  })
);

productsRouter.delete(
  "/finished-products/variants/:id",
  ah(async (req, res) => {
    const info = await db.run("DELETE FROM finished_product_variants WHERE id = ?", req.params.id);
    if (!info.changes) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Variant not found" } });
    res.json({ ok: true });
  })
);

productsRouter.post(
  "/finished-products/add-production",
  ah(async (req, res) => {
    const { finishedProductVariantId, producedQuantityKg, producedSacks, totalProductionCost, defaultPricePerSack, productionDate, note } = req.body || {};
    const variant = await db.get("SELECT * FROM finished_product_variants WHERE id = ?", finishedProductVariantId);
    if (!variant) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Variant not found" } });
    await db.tx(async (t) => {
      await t.run(
        "UPDATE finished_product_variants SET stock_sacks = stock_sacks + ? WHERE id = ?",
        Number(producedSacks) || 0,
        variant.id
      );
      if (defaultPricePerSack != null) {
        await t.run(
          "UPDATE finished_product_variants SET default_price_per_sack = ? WHERE id = ?",
          Number(defaultPricePerSack),
          variant.id
        );
      }
      await t.run(
        "INSERT INTO production_batches (finished_product_id, finished_product_variant_id, status, actual_output_kg, sacks_produced, total_production_cost, default_price_per_sack, production_date, notes, batch_date) VALUES (?, ?, 'COMPLETED', ?, ?, ?, ?, ?, ?, NOW())",
        variant.finished_product_id,
        variant.id,
        producedQuantityKg != null ? Number(producedQuantityKg) : null,
        Number(producedSacks) || 0,
        totalProductionCost != null ? Number(totalProductionCost) : null,
        defaultPricePerSack != null ? Number(defaultPricePerSack) : null,
        productionDate || null,
        note || null
      );
    });
    res.status(201).json({ ok: true });
  })
);

productsRouter.get(
  "/finished-products/:id/variants",
  ah(async (req, res) => {
    const variants = await db.all(
      "SELECT * FROM finished_product_variants WHERE finished_product_id = ? ORDER BY id",
      req.params.id
    );
    res.json(
      variants.map((v) => ({
        id: v.id,
        sackSizeKg: v.sack_size_kg,
        defaultPricePerSack: v.default_price_per_sack,
        minimumStockSacks: v.minimum_stock_sacks,
        stockSacks: v.stock_sacks,
      }))
    );
  })
);
