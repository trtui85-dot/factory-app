import { Router } from "express";
import { db } from "../db.js";
import { ah } from "../async.js";

export const expensesRouter = Router();

expensesRouter.get(
  "/expenses",
  ah(async (req, res) => {
    const rows = await db.all("SELECT * FROM expenses ORDER BY created_at DESC");
    res.json(rows.map((e) => ({ ...e, cancelled: !!e.cancelled_at })));
  })
);

expensesRouter.post(
  "/expenses",
  ah(async (req, res) => {
    const { category, amount, reference, description } = req.body || {};
    if (!category || !amount)
      return res.status(400).json({ error: { code: "INVALID_BODY", message: "category and amount required" } });
    const info = await db.run(
      "INSERT INTO expenses (category, amount, reference, description) VALUES (?, ?, ?, ?)",
      category,
      Number(amount),
      reference || null,
      description || null
    );
    res.status(201).json({ id: info.lastInsertRowid });
  })
);

expensesRouter.post(
  "/expenses/:id/cancel",
  ah(async (req, res) => {
    const exp = await db.get("SELECT * FROM expenses WHERE id = ?", req.params.id);
    if (!exp) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Expense not found" } });
    if (exp.cancelled_at) return res.status(400).json({ error: { code: "ALREADY_CANCELLED", message: "Expense already cancelled" } });
    await db.run("UPDATE expenses SET cancelled_at = NOW() WHERE id = ?", req.params.id);
    res.json({ ok: true });
  })
);
