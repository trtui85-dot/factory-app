import { Router } from "express";
import { db } from "../db.js";
import { ah } from "../async.js";

export const customersRouter = Router();

async function recalcBalance(customerId) {
  const row = await db.get(
    `SELECT COALESCE((SELECT SUM(final_total - amount_paid) FROM sales WHERE customer_id = ? AND status != 'CORRECTED'), 0) -
            COALESCE((SELECT SUM(amount) FROM customer_payments WHERE customer_id = ?), 0) AS bal`,
    customerId,
    customerId
  );
  const bal = Number(row.bal) || 0;
  await db.run("UPDATE customers SET balance = ? WHERE id = ?", bal, customerId);
  return bal;
}

customersRouter.get(
  "/customers",
  ah(async (req, res) => {
    const rows = await db.all("SELECT * FROM customers ORDER BY name");
    res.json(rows);
  })
);

customersRouter.post(
  "/customers",
  ah(async (req, res) => {
    const { name, phone } = req.body || {};
    if (!name) return res.status(400).json({ error: { code: "INVALID_BODY", message: "name is required" } });
    const info = await db.run("INSERT INTO customers (name, phone) VALUES (?, ?)", name, phone || null);
    res.status(201).json({ id: info.lastInsertRowid });
  })
);

customersRouter.patch(
  "/customers/:id",
  ah(async (req, res) => {
    const { name, phone } = req.body || {};
    await db.run(
      "UPDATE customers SET name = COALESCE(?, name), phone = COALESCE(?, phone) WHERE id = ?",
      name ?? null,
      phone ?? null,
      req.params.id
    );
    res.json({ ok: true });
  })
);

customersRouter.delete(
  "/customers/:id",
  ah(async (req, res) => {
    await db.run("DELETE FROM customers WHERE id = ?", req.params.id);
    res.json({ ok: true });
  })
);

customersRouter.get(
  "/customers/:id/statement",
  ah(async (req, res) => {
    const id = req.params.id;
    const sales = await db.all(
      "SELECT id, created_at AS date, 'SALE' AS type, final_total AS amount FROM sales WHERE customer_id = ? AND status != 'CORRECTED'",
      id
    );
    const payments = await db.all(
      "SELECT id, created_at AS date, 'PAYMENT' AS type, -amount AS amount FROM customer_payments WHERE customer_id = ?",
      id
    );
    const entries = [...sales, ...payments].sort((a, b) => String(a.date).localeCompare(String(b.date)));
    let balance = 0;
    const history = entries.map((e) => {
      balance += Number(e.amount);
      return { id: e.id, date: e.date, operation: e.type, amount: e.amount, balanceAfter: balance };
    });
    res.json({ history });
  })
);

customersRouter.post(
  "/customer-payments",
  ah(async (req, res) => {
    const { customerId, amount, reference, note } = req.body || {};
    if (!customerId || !amount)
      return res.status(400).json({ error: { code: "INVALID_BODY", message: "customerId and amount required" } });
    await db.run(
      "INSERT INTO customer_payments (customer_id, amount, reference, note) VALUES (?, ?, ?, ?)",
      customerId,
      Number(amount),
      reference || null,
      note || null
    );
    res.status(201).json({ balance: await recalcBalance(customerId) });
  })
);
