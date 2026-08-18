import { Router } from "express";
import { db } from "../db.js";
import { ah } from "../async.js";

export const dashboardRouter = Router();

const DATE_SQL = {
  today: "CURDATE() = DATE(created_at)",
  week: "DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)",
  month: "DATE_FORMAT(created_at, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')",
  year: "YEAR(created_at) = YEAR(CURDATE())",
};

dashboardRouter.get(
  "/dashboard",
  ah(async (req, res) => {
    const period = req.query.period in DATE_SQL ? req.query.period : "month";
    const where = DATE_SQL[period];

    const matValue = await db.get("SELECT COALESCE(SUM(quantity_kg * cost_per_kg), 0) AS v FROM raw_materials");
    const prodValue = await db.get(
      "SELECT COALESCE(SUM(stock_sacks * COALESCE(default_price_per_sack, 0)), 0) AS v FROM finished_product_variants"
    );
    const stockValue = Number(matValue.v) + Number(prodValue.v);

    const sales = await db.get(`SELECT COALESCE(SUM(final_total), 0) AS total, COUNT(*) AS count FROM sales WHERE status != 'CORRECTED' AND ${where}`);
    const expenses = await db.get(`SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count FROM expenses WHERE cancelled_at IS NULL AND ${where}`);
    const payments = await db.get(`SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count FROM customer_payments WHERE ${where}`);
    const production = await db.get(`SELECT COALESCE(SUM(sacks_produced), 0) AS sacks, COUNT(*) AS batches FROM production_batches WHERE status = 'COMPLETED' AND ${where}`);

    const lowStock = await db.get("SELECT COUNT(*) AS c FROM raw_materials WHERE quantity_kg <= min_stock_level");
    const lowSack = await db.get("SELECT COUNT(*) AS c FROM finished_product_variants WHERE stock_sacks <= minimum_stock_sacks");

    const customerDebt = await db.get("SELECT COALESCE(SUM(balance), 0) AS total FROM customers WHERE balance > 0");
    const workerDebt = await db.get(
      `SELECT COALESCE(SUM(CASE WHEN type = 'ADVANCE_TO_WORKER' THEN amount WHEN type = 'ADVANCE_FROM_WORKER' THEN -amount ELSE 0 END), 0) AS total FROM worker_ledger_entries WHERE reversed = 0`
    );

    res.json({
      period,
      stockValue,
      lowStockMaterials: lowStock.c,
      lowStockProducts: lowSack.c,
      sales: { total: sales.total, count: sales.count },
      expenses: { total: expenses.total, count: expenses.count },
      payments: { total: payments.total, count: payments.count },
      production: { sacks: production.sacks, batches: production.batches },
      customerDebt: customerDebt.total,
      workerDebt: workerDebt.total,
    });
  })
);
