import { Router } from "express";
import { db } from "../db.js";
import { ah } from "../async.js";

export const salesRouter = Router();

async function serializeSale(s) {
  const customer = s.customer_id ? await db.get("SELECT name FROM customers WHERE id = ?", s.customer_id) : null;
  const items = await Promise.all(
    JSON.parse(s.items || "[]").map(async (i) => {
      const v = i.variantId ? await db.get("SELECT * FROM finished_product_variants WHERE id = ?", i.variantId) : null;
      const p = v ? await db.get("SELECT name FROM finished_products WHERE id = ?", v.finished_product_id) : null;
      return {
        variantId: i.variantId,
        productName: p?.name,
        sackSizeKg: v?.sack_size_kg,
        sacks: i.sacks,
        unitPrice: i.unitPrice,
        total: Number(i.sacks) * Number(i.unitPrice),
      };
    })
  );
  return {
    id: s.id,
    customerId: s.customer_id,
    customerName: customer?.name || null,
    items,
    finalTotal: s.final_total,
    amountPaid: s.amount_paid,
    note: s.note,
    status: s.status,
    correctedAt: s.corrected_at,
    createdAt: s.created_at,
  };
}

salesRouter.get(
  "/sales",
  ah(async (req, res) => {
    const rows = await db.all("SELECT * FROM sales ORDER BY created_at DESC");
    res.json(await Promise.all(rows.map(serializeSale)));
  })
);

salesRouter.post(
  "/sales",
  ah(async (req, res) => {
    const { customerId, items = [], amountPaid = 0, finalTotal, note } = req.body || {};
    if (!Array.isArray(items) || items.length === 0)
      return res.status(400).json({ error: { code: "INVALID_BODY", message: "items required" } });
    const total = finalTotal != null ? Number(finalTotal) : items.reduce((s, i) => s + Number(i.sacks) * Number(i.unitPrice), 0);
    const paid = Number(amountPaid) || 0;
    const saleId = await db.tx(async (t) => {
      const info = await t.run(
        "INSERT INTO sales (customer_id, items, final_total, amount_paid, note) VALUES (?, ?, ?, ?, ?)",
        customerId || null,
        JSON.stringify(items),
        total,
        paid,
        note || null
      );
      const sid = info.lastInsertRowid;
      if (customerId) {
        await t.run("UPDATE customers SET balance = balance + ? WHERE id = ?", total - paid, customerId);
      }
      for (const i of items) {
        if (i.variantId) {
          await t.run(
            "UPDATE finished_product_variants SET stock_sacks = GREATEST(0, stock_sacks - ?) WHERE id = ?",
            Number(i.sacks) || 0,
            i.variantId
          );
        }
      }
      return sid;
    });
    res.status(201).json({ id: saleId });
  })
);

salesRouter.post(
  "/sales/:id/correct",
  ah(async (req, res) => {
    const sale = await db.get("SELECT * FROM sales WHERE id = ?", req.params.id);
    if (!sale) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Sale not found" } });
    if (sale.status === "CORRECTED")
      return res.status(400).json({ error: { code: "ALREADY_CORRECTED", message: "Sale already corrected" } });
    await db.tx(async (t) => {
      await t.run("UPDATE sales SET status = 'CORRECTED', corrected_at = NOW() WHERE id = ?", req.params.id);
      if (sale.customer_id) {
        await t.run("UPDATE customers SET balance = balance - ? WHERE id = ?", sale.final_total - sale.amount_paid, sale.customer_id);
      }
      for (const i of JSON.parse(sale.items || "[]")) {
        if (i.variantId) {
          await t.run(
            "UPDATE finished_product_variants SET stock_sacks = stock_sacks + ? WHERE id = ?",
            Number(i.sacks) || 0,
            i.variantId
          );
        }
      }
    });
    res.json({ ok: true });
  })
);
