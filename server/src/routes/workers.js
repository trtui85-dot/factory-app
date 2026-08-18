import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "../db.js";
import { ah } from "../async.js";
import { parsePerms } from "../auth.js";

export const workersRouter = Router();

async function workerBalance(workerId) {
  const row = await db.get(
    `SELECT COALESCE(SUM(CASE WHEN type = 'ADVANCE_TO_WORKER' THEN amount ELSE 0 END), 0) AS toWorker,
            COALESCE(SUM(CASE WHEN type = 'ADVANCE_FROM_WORKER' THEN amount ELSE 0 END), 0) AS fromWorker,
            COALESCE(SUM(CASE WHEN type = 'SALARY_PAYMENT' THEN amount ELSE 0 END), 0) AS paid
     FROM worker_ledger_entries WHERE worker_id = ? AND reversed = 0`,
    workerId
  );
  return Number(row.toWorker) - Number(row.fromWorker) - Number(row.paid);
}

async function serializeWorker(w) {
  const entries = await db.all(
    "SELECT * FROM worker_ledger_entries WHERE worker_id = ? AND reversed = 0 ORDER BY created_at DESC",
    w.id
  );
  const account = await db.get(
    "SELECT id, phone, role, is_active, permissions FROM users WHERE worker_id = ?",
    w.id
  );
  return {
    id: w.id,
    name: w.name,
    phone: w.phone,
    workStartDate: w.work_start_date,
    monthlySalary: w.monthly_salary,
    status: w.status,
    balance: await workerBalance(w.id),
    account: account
      ? {
          id: account.id,
          phone: account.phone,
          role: account.role,
          isActive: !!account.is_active,
          permissions: parsePerms(account.permissions),
        }
      : null,
    entries: entries.map((e) => ({
      id: e.id,
      type: e.type,
      amount: e.amount,
      note: e.note,
      createdAt: e.created_at,
    })),
  };
}

workersRouter.get(
  "/workers",
  ah(async (req, res) => {
    const rows =
      req.user.role === "WORKER" && req.user.worker_id
        ? await db.all("SELECT * FROM workers WHERE id = ? ORDER BY name", req.user.worker_id)
        : await db.all("SELECT * FROM workers ORDER BY name");
    res.json(await Promise.all(rows.map(serializeWorker)));
  })
);

workersRouter.get(
  "/workers/:id",
  ah(async (req, res) => {
    if (req.user.role === "WORKER" && String(req.params.id) !== String(req.user.worker_id)) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Worker not found" } });
    }
    const w = await db.get("SELECT * FROM workers WHERE id = ?", req.params.id);
    if (!w) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Worker not found" } });
    res.json(await serializeWorker(w));
  })
);

workersRouter.post(
  "/workers",
  ah(async (req, res) => {
    const { name, phone, workStartDate, monthlySalary } = req.body || {};
    if (!name) return res.status(400).json({ error: { code: "INVALID_BODY", message: "name is required" } });
    const info = await db.run(
      "INSERT INTO workers (name, phone, work_start_date, monthly_salary) VALUES (?, ?, ?, ?)",
      name,
      phone || null,
      workStartDate || new Date().toISOString().slice(0, 10),
      Number(monthlySalary) || 0
    );
    res.status(201).json({ id: info.lastInsertRowid });
  })
);

workersRouter.patch(
  "/workers/:id",
  ah(async (req, res) => {
    const { name, phone, monthlySalary } = req.body || {};
    await db.run(
      "UPDATE workers SET name = COALESCE(?, name), phone = COALESCE(?, phone), monthly_salary = COALESCE(?, monthly_salary) WHERE id = ?",
      name ?? null,
      phone ?? null,
      monthlySalary != null ? Number(monthlySalary) : null,
      req.params.id
    );
    res.json({ ok: true });
  })
);

workersRouter.post(
  "/workers/:id/deactivate",
  ah(async (req, res) => {
    const info = await db.run("UPDATE workers SET status = 'INACTIVE' WHERE id = ?", req.params.id);
    if (!info.changes) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Worker not found" } });
    res.json({ ok: true });
  })
);

workersRouter.post(
  "/workers/:id/reactivate",
  ah(async (req, res) => {
    const info = await db.run("UPDATE workers SET status = 'ACTIVE' WHERE id = ?", req.params.id);
    if (!info.changes) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Worker not found" } });
    res.json({ ok: true });
  })
);

async function addEntry(t, workerId, type, amount, note) {
  await t.run("INSERT INTO worker_ledger_entries (worker_id, type, amount, note) VALUES (?, ?, ?, ?)", workerId, type, Number(amount) || 0, note || null);
}

workersRouter.post(
  "/workers/:id/advances-to-worker",
  ah(async (req, res) => {
    const { amount, note } = req.body || {};
    if (!amount) return res.status(400).json({ error: { code: "INVALID_BODY", message: "amount required" } });
    await db.tx(async (t) => {
      await addEntry(t, req.params.id, "ADVANCE_TO_WORKER", amount, note);
    });
    res.status(201).json({ balance: await workerBalance(req.params.id) });
  })
);

workersRouter.post(
  "/workers/:id/advances-from-worker",
  ah(async (req, res) => {
    const { amount, note } = req.body || {};
    if (!amount) return res.status(400).json({ error: { code: "INVALID_BODY", message: "amount required" } });
    await db.tx(async (t) => {
      await addEntry(t, req.params.id, "ADVANCE_FROM_WORKER", amount, note);
    });
    res.status(201).json({ balance: await workerBalance(req.params.id) });
  })
);

workersRouter.post(
  "/workers/:id/salary-payments",
  ah(async (req, res) => {
    const { amount, note } = req.body || {};
    if (!amount) return res.status(400).json({ error: { code: "INVALID_BODY", message: "amount required" } });
    const worker = await db.get("SELECT * FROM workers WHERE id = ?", req.params.id);
    if (!worker) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Worker not found" } });
    await db.tx(async (t) => {
      await addEntry(t, req.params.id, "SALARY_PAYMENT", amount, note);
      const cycle = await t.get("SELECT id FROM salary_cycles WHERE status = 'OPEN' ORDER BY created_at DESC LIMIT 1");
      let cycleId = cycle ? cycle.id : null;
      if (!cycleId) {
        const info = await t.run("INSERT INTO salary_cycles (period) VALUES (?)", new Date().toISOString().slice(0, 7));
        cycleId = info.lastInsertRowid;
      }
      await t.run("INSERT INTO salary_payments (worker_id, salary_cycle_id, amount, note) VALUES (?, ?, ?, ?)", worker.id, cycleId, Number(amount), note || null);
    });
    res.status(201).json({ balance: await workerBalance(req.params.id) });
  })
);

workersRouter.post(
  "/workers/:id/ledger-entries/:entryId/reverse",
  ah(async (req, res) => {
    const entry = await db.get("SELECT * FROM worker_ledger_entries WHERE id = ? AND worker_id = ?", req.params.entryId, req.params.id);
    if (!entry) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Entry not found" } });
    if (entry.reversed) return res.status(400).json({ error: { code: "ALREADY_REVERSED", message: "Entry already reversed" } });
    const { reason } = req.body || {};
    await db.run("UPDATE worker_ledger_entries SET reversed = 1, reversal_reason = ? WHERE id = ?", reason || null, entry.id);
    res.json({ balance: await workerBalance(req.params.id) });
  })
);

workersRouter.post(
  "/workers/:id/account",
  ah(async (req, res) => {
    const w = await db.get("SELECT * FROM workers WHERE id = ?", req.params.id);
    if (!w) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Worker not found" } });
    const { phone, pin, permissions, isActive } = req.body || {};
    if (!phone) return res.status(400).json({ error: { code: "INVALID_BODY", message: "phone is required" } });
    if (pin != null && !/^\d{4}$/.test(String(pin))) {
      return res.status(400).json({ error: { code: "INVALID_PIN", message: "PIN must be 4 digits" } });
    }
    const existing = await db.get("SELECT * FROM users WHERE worker_id = ?", w.id);
    const permJson = JSON.stringify(
      Array.isArray(permissions) ? permissions : existing ? parsePerms(existing.permissions) : []
    );
    const active = isActive === false ? 0 : 1;
    try {
      if (existing) {
        await db.run(
          "UPDATE users SET phone = ?, pin = COALESCE(?, pin), permissions = ?, is_active = ? WHERE id = ?",
          phone,
          pin != null ? bcrypt.hashSync(String(pin), 10) : null,
          permJson,
          active,
          existing.id
        );
      } else {
        await db.run(
          "INSERT INTO users (phone, pin, name, role, is_active, worker_id, permissions) VALUES (?, ?, ?, 'WORKER', ?, ?, ?)",
          phone,
          bcrypt.hashSync(String(pin), 10),
          w.name,
          active,
          w.id,
          permJson
        );
      }
    } catch (e) {
      if (e && (e.code === "ER_DUP_ENTRY" || e.code === "23505")) {
        return res.status(409).json({ error: { code: "PHONE_TAKEN", message: "This phone is already used by another account" } });
      }
      throw e;
    }
    res.json({ ok: true });
  })
);

workersRouter.delete(
  "/workers/:id/account",
  ah(async (req, res) => {
    const w = await db.get("SELECT * FROM workers WHERE id = ?", req.params.id);
    if (!w) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Worker not found" } });
    await db.run("DELETE FROM users WHERE worker_id = ?", w.id);
    res.json({ ok: true });
  })
);
