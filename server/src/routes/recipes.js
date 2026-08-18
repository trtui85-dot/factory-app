import { Router } from "express";
import { db } from "../db.js";
import { ah } from "../async.js";

export const recipesRouter = Router();

const parseIngredients = (ingredients) => {
  if (!Array.isArray(ingredients)) return [];
  return ingredients.map((i) => ({
    rawMaterialId: i.rawMaterialId ?? i.raw_material_id,
    quantity: Number(i.quantity) || 0,
  }));
};

recipesRouter.get(
  "/recipes",
  ah(async (req, res) => {
    const rows = await db.all(
      `SELECT r.*, fp.name AS product_name FROM recipes r
       JOIN finished_products fp ON fp.id = r.finished_product_id
       ORDER BY r.created_at DESC`
    );
    res.json(rows.map((r) => ({ ...r, ingredients: JSON.parse(r.ingredients || "[]"), active: !!r.is_active })));
  })
);

recipesRouter.post(
  "/recipes",
  ah(async (req, res) => {
    const { name, finishedProductId, targetOutputKg, notes, ingredients = [] } = req.body || {};
    if (!name || !finishedProductId)
      return res.status(400).json({ error: { code: "INVALID_BODY", message: "name and finishedProductId required" } });
    const info = await db.run(
      "INSERT INTO recipes (name, finished_product_id, target_output_kg, notes, ingredients) VALUES (?, ?, ?, ?, ?)",
      name,
      finishedProductId,
      Number(targetOutputKg) || 0,
      notes || null,
      JSON.stringify(parseIngredients(ingredients))
    );
    res.status(201).json({ id: info.lastInsertRowid });
  })
);

recipesRouter.patch(
  "/recipes/:id",
  ah(async (req, res) => {
    const recipe = await db.get("SELECT * FROM recipes WHERE id = ?", req.params.id);
    if (!recipe) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Recipe not found" } });
    const { targetOutputKg, notes, ingredients, isActive } = req.body || {};
    await db.run(
      "UPDATE recipes SET target_output_kg = COALESCE(?, target_output_kg), notes = COALESCE(?, notes), ingredients = COALESCE(?, ingredients), is_active = COALESCE(?, is_active) WHERE id = ?",
      targetOutputKg != null ? Number(targetOutputKg) : null,
      notes ?? null,
      ingredients ? JSON.stringify(parseIngredients(ingredients)) : null,
      isActive != null ? (isActive ? 1 : 0) : null,
      req.params.id
    );
    res.json({ ok: true });
  })
);

recipesRouter.delete(
  "/recipes/:id",
  ah(async (req, res) => {
    const info = await db.run("DELETE FROM recipes WHERE id = ?", req.params.id);
    if (!info.changes) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Recipe not found" } });
    res.json({ ok: true });
  })
);
