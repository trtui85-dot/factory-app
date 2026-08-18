import pg from "pg";
const { Pool } = pg;

const DB_URL = process.env.DATABASE_URL || "postgresql://factory_manager_user:apDO6DzshNP0oLCKmACPunlg53BX0W97@dpg-da2crt15efls73a0lhn0-a/factory_manager";
console.log("DB_URL present:", !!process.env.DATABASE_URL);

const pool = new Pool({
  connectionString: DB_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
});

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  phone VARCHAR(50) NOT NULL UNIQUE,
  pin VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'SUPERVISOR',
  is_active SMALLINT NOT NULL DEFAULT 1,
  worker_id INT NULL,
  permissions TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS raw_materials (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  unit VARCHAR(20) NOT NULL DEFAULT 'KG',
  min_stock_level DOUBLE PRECISION NOT NULL DEFAULT 0,
  quantity_kg DOUBLE PRECISION NOT NULL DEFAULT 0,
  cost_per_kg DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS raw_material_purchases (
  id SERIAL PRIMARY KEY,
  raw_material_id INT NOT NULL REFERENCES raw_materials(id),
  purchased_quantity DOUBLE PRECISION NOT NULL,
  unit_cost DOUBLE PRECISION NOT NULL,
  total_purchase_price DOUBLE PRECISION NOT NULL,
  purchase_date TIMESTAMP NOT NULL DEFAULT NOW(),
  note TEXT
);

CREATE TABLE IF NOT EXISTS finished_products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  unit VARCHAR(20) NOT NULL DEFAULT 'PIECE',
  sack_size_kg DOUBLE PRECISION,
  default_price_per_sack DOUBLE PRECISION,
  minimum_stock_sacks DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS finished_product_variants (
  id SERIAL PRIMARY KEY,
  finished_product_id INT NOT NULL REFERENCES finished_products(id) ON DELETE CASCADE,
  sack_size_kg DOUBLE PRECISION NOT NULL,
  default_price_per_sack DOUBLE PRECISION,
  minimum_stock_sacks DOUBLE PRECISION NOT NULL DEFAULT 0,
  stock_sacks DOUBLE PRECISION NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS recipes (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  finished_product_id INT NOT NULL REFERENCES finished_products(id),
  target_output_kg DOUBLE PRECISION NOT NULL,
  notes TEXT,
  ingredients TEXT NOT NULL,
  is_active SMALLINT NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS production_batches (
  id SERIAL PRIMARY KEY,
  finished_product_id INT NOT NULL REFERENCES finished_products(id),
  finished_product_variant_id INT NOT NULL REFERENCES finished_product_variants(id),
  recipe_id INT REFERENCES recipes(id),
  status VARCHAR(20) NOT NULL DEFAULT 'RUNNING',
  expected_output_kg DOUBLE PRECISION,
  batch_date TIMESTAMP NOT NULL DEFAULT NOW(),
  notes TEXT,
  consumptions TEXT NOT NULL,
  actual_output_kg DOUBLE PRECISION,
  sacks_produced DOUBLE PRECISION,
  kg_damaged DOUBLE PRECISION,
  declared_waste DOUBLE PRECISION,
  waste_reason TEXT,
  total_production_cost DOUBLE PRECISION,
  default_price_per_sack DOUBLE PRECISION,
  production_date TIMESTAMP,
  cancellation_reason TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  balance DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sales (
  id SERIAL PRIMARY KEY,
  customer_id INT REFERENCES customers(id),
  items TEXT NOT NULL,
  final_total DOUBLE PRECISION NOT NULL,
  amount_paid DOUBLE PRECISION NOT NULL DEFAULT 0,
  note TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED',
  corrected_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customer_payments (
  id SERIAL PRIMARY KEY,
  customer_id INT NOT NULL REFERENCES customers(id),
  amount DOUBLE PRECISION NOT NULL,
  reference VARCHAR(255),
  note TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS expenses (
  id SERIAL PRIMARY KEY,
  category VARCHAR(100) NOT NULL,
  amount DOUBLE PRECISION NOT NULL,
  reference VARCHAR(255),
  description TEXT,
  cancelled_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  work_start_date DATE NOT NULL,
  monthly_salary DOUBLE PRECISION NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS worker_ledger_entries (
  id SERIAL PRIMARY KEY,
  worker_id INT NOT NULL REFERENCES workers(id),
  type VARCHAR(40) NOT NULL,
  amount DOUBLE PRECISION NOT NULL,
  note TEXT,
  reversed SMALLINT NOT NULL DEFAULT 0,
  reversal_reason TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS salary_cycles (
  id SERIAL PRIMARY KEY,
  period VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS salary_payments (
  id SERIAL PRIMARY KEY,
  worker_id INT NOT NULL REFERENCES workers(id),
  salary_cycle_id INT NOT NULL REFERENCES salary_cycles(id),
  amount DOUBLE PRECISION NOT NULL,
  note TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
`;

let initialized = false;

async function ensure() {
  if (initialized) return;
  await pool.query(SCHEMA);

  const { rows: cols } = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'users'`
  );
  const names = cols.map((c) => c.column_name);
  if (!names.includes("worker_id")) {
    await pool.query("ALTER TABLE users ADD COLUMN worker_id INT NULL");
  }
  if (!names.includes("permissions")) {
    await pool.query("ALTER TABLE users ADD COLUMN permissions TEXT NULL");
  }

  initialized = true;
}

export async function initDb() {
  await ensure();
}

const toPgDate = (v) => {
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) {
      return d.toISOString().replace("T", " ").replace("Z", "");
    }
  }
  return v;
};

function convertPlaceholders(sql) {
  let idx = 0;
  return sql.replace(/\?/g, () => `$${++idx}`);
}

function convertMySQLtoPG(sql) {
  let s = sql;
  s = s.replace(/CURDATE\(\)/g, "CURRENT_DATE");
  s = s.replace(/DATE_SUB\(CURRENT_DATE,\s*INTERVAL\s+(\d+)\s+DAY\)/g, "(CURRENT_DATE - INTERVAL '$1 days')");
  s = s.replace(/DATE_FORMAT\(([^,]+),\s*'([^']+)'\)/g, (_, expr, fmt) => {
    const pgFmt = fmt.replace(/%Y/g, "YYYY").replace(/%m/g, "MM").replace(/%d/g, "DD").replace(/%H/g, "HH24").replace(/%i/g, "MI").replace(/%s/g, "SS");
    return `TO_CHAR(${expr}, '${pgFmt}')`;
  });
  s = s.replace(/YEAR\(CURRENT_DATE\)/g, "EXTRACT(YEAR FROM CURRENT_DATE)::int");
  s = s.replace(/DATE\(([^)]+)\)/g, "$1::date");
  return s;
}

function isInsert(sql) {
  return /^\s*INSERT\s+INTO/i.test(sql);
}

const exec = async (conn, mode, sql, params) => {
  const normalized = (params || []).map(toPgDate);
  const converted = convertMySQLtoPG(sql);

  if (mode === "run" && isInsert(converted)) {
    const withReturning = converted.replace(/;?\s*$/, "") + " RETURNING id";
    const pgSql = convertPlaceholders(withReturning);
    const result = await conn.query(pgSql, normalized);
    return { lastInsertRowid: result.rows?.[0]?.id, changes: result.rowCount };
  }

  const pgSql = convertPlaceholders(converted);
  const result = await conn.query(pgSql, normalized);

  if (mode === "get") return result.rows?.[0];
  if (mode === "all") return result.rows || [];
  return { lastInsertRowid: result.rows?.[0]?.id, changes: result.rowCount };
};

const bindTx = (conn) => ({
  all: (sql, ...p) => exec(conn, "all", sql, p),
  get: (sql, ...p) => exec(conn, "get", sql, p),
  run: (sql, ...p) => exec(conn, "run", sql, p),
});

export const db = {
  async all(sql, ...params) {
    await ensure();
    return exec(pool, "all", sql, params);
  },
  async get(sql, ...params) {
    await ensure();
    return exec(pool, "get", sql, params);
  },
  async run(sql, ...params) {
    await ensure();
    return exec(pool, "run", sql, params);
  },
  async tx(fn) {
    await ensure();
    const conn = await pool.connect();
    try {
      await conn.query("BEGIN");
      const result = await fn(bindTx(conn));
      await conn.query("COMMIT");
      return result;
    } catch (e) {
      try { await conn.query("ROLLBACK"); } catch {}
      throw e;
    } finally {
      conn.release();
    }
  },
};
