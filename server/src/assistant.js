import { config } from "./config.js";
import { db } from "./db.js";

const DATE_SQL = {
  today: "CURDATE() = DATE(created_at)",
  week: "DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)",
  month: "DATE_FORMAT(created_at, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')",
  year: "YEAR(created_at) = YEAR(CURDATE())",
};

const periodWhere = (period) => (period in DATE_SQL ? DATE_SQL[period] : DATE_SQL.month);

const SYSTEM = `Tu es l'assistant intelligent du système de gestion d'une usine (farine, sacs), développé par SIR Solutions Informatique Rapide, une société de services informatiques basée en Mauritanie qui conçoit et entraîne des modèles d'intelligence artificielle.
Tu réponds TOUJOURS en français, de façon claire, structurée et concise.
- Précise à l'utilisateur que tu es l'assistant IA développé par SIR Solutions Informatique Rapide (surtout lors de la première interaction de la conversation), puis réponds à sa demande.
- Tu as accès à des outils qui lisent et modifient les données de l'usine.
- Pour CRÉER quelque chose (produit, matière première, client, facture/vente, paiement, dépense), utilise l'outil correspondant et confirme ensuite à l'utilisateur ce qui a été créé (nom, id, montants).
- Pour ANALYSER les données (tableau de bord, rapports de ventes, créances clients, dépenses, stock), utilise les outils de lecture puis présente un résumé chiffré et des recommandations simples.
- Les montants sont en ouguiya mauritanienne (MRU).
- Si une information manque (ex: client inconnu, variante inconnue), demande-la ou propose un choix, ne devine jamais un id.
- Reste poli et professionnel.`;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "get_dashboard",
      description: "Obtenir le tableau de bord (KPIs) de l'usine pour une période.",
      parameters: {
        type: "object",
        properties: {
          period: { type: "string", enum: ["today", "week", "month", "year"], description: "Période (défaut: month)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_products",
      description: "Lister les produits finis avec variantes, stock en sacs et prix.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "list_materials",
      description: "Lister les matières premières (stock, coût, statut).",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "list_customers",
      description: "Lister les clients avec leur solde (créance).",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "list_sales",
      description: "Lister les ventes (factures) d'une période.",
      parameters: {
        type: "object",
        properties: {
          period: { type: "string", enum: ["today", "week", "month", "year"] },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_expenses",
      description: "Lister les dépenses d'une période.",
      parameters: {
        type: "object",
        properties: {
          period: { type: "string", enum: ["today", "week", "month", "year"] },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_workers",
      description: "Lister les ouvriers avec salaire et solde.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "list_production",
      description: "Lister les lots de production.",
      parameters: {
        type: "object",
        properties: {
          period: { type: "string", enum: ["today", "week", "month", "year"] },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_customer_statement",
      description: "Relevé (historique) d'un client : ventes et paiements.",
      parameters: {
        type: "object",
        properties: {
          customerId: { type: "integer", description: "ID du client" },
        },
        required: ["customerId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "sales_report",
      description: "Rapport de ventes d'une période : total, par produit (top produits), par client, créances.",
      parameters: {
        type: "object",
        properties: {
          period: { type: "string", enum: ["today", "week", "month", "year"] },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "expense_report",
      description: "Rapport des dépenses d'une période, groupé par catégorie.",
      parameters: {
        type: "object",
        properties: {
          period: { type: "string", enum: ["today", "week", "month", "year"] },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "inventory_report",
      description: "Rapport de stock : valeur totale, produits/matières en rupture ou stock faible.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "create_product",
      description: "Créer un produit fini (avec une variante de sac).",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Nom du produit" },
          sackSizeKg: { type: "number", description: "Taille du sac en kg" },
          defaultPricePerSack: { type: "number", description: "Prix par sac (MRU)" },
          minimumStockSacks: { type: "number", description: "Stock minimum en sacs" },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_material",
      description: "Créer une matière première (avec quantité et coût).",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Nom de la matière" },
          unit: { type: "string", description: "Unité: KG, L, PIECE..." },
          quantityKg: { type: "number", description: "Quantité en stock" },
          totalPurchasePrice: { type: "number", description: "Coût total d'achat (MRU)" },
          minStockLevel: { type: "number", description: "Stock minimum" },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_customer",
      description: "Créer un client.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Nom du client" },
          phone: { type: "string", description: "Téléphone" },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_sale",
      description: "Créer une vente / facture. items = [{variantId, sacks, unitPrice}]. Le total est calculé automatiquement.",
      parameters: {
        type: "object",
        properties: {
          customerId: { type: "integer", description: "ID du client (facultatif)" },
          items: {
            type: "array",
            description: "Lignes de la facture",
            items: {
              type: "object",
              properties: {
                variantId: { type: "integer", description: "ID de la variante du produit" },
                sacks: { type: "number", description: "Nombre de sacs" },
                unitPrice: { type: "number", description: "Prix unitaire par sac (MRU)" },
              },
              required: ["variantId", "sacks", "unitPrice"],
            },
          },
          amountPaid: { type: "number", description: "Montant payé maintenant (MRU)" },
          note: { type: "string", description: "Note" },
        },
        required: ["items"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "record_payment",
      description: "Enregistrer un paiement d'un client (réduction de sa créance).",
      parameters: {
        type: "object",
        properties: {
          customerId: { type: "integer", description: "ID du client" },
          amount: { type: "number", description: "Montant payé (MRU)" },
          reference: { type: "string", description: "Référence" },
          note: { type: "string", description: "Note" },
        },
        required: ["customerId", "amount"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "record_expense",
      description: "Enregistrer une dépense.",
      parameters: {
        type: "object",
        properties: {
          category: { type: "string", description: "Catégorie (ex: Électricité, Transport...)" },
          amount: { type: "number", description: "Montant (MRU)" },
          reference: { type: "string", description: "Référence" },
          description: { type: "string", description: "Description" },
        },
        required: ["category", "amount"],
      },
    },
  },
];

/* ---------- Read handlers ---------- */

async function get_dashboard({ period = "month" } = {}) {
  const where = periodWhere(period);
  const matValue = await db.get("SELECT COALESCE(SUM(quantity_kg * cost_per_kg), 0) AS v FROM raw_materials");
  const prodValue = await db.get("SELECT COALESCE(SUM(stock_sacks * COALESCE(default_price_per_sack, 0)), 0) AS v FROM finished_product_variants");
  const sales = await db.get(`SELECT COALESCE(SUM(final_total), 0) AS total, COUNT(*) AS count FROM sales WHERE status != 'CORRECTED' AND ${where}`);
  const expenses = await db.get(`SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count FROM expenses WHERE cancelled_at IS NULL AND ${where}`);
  const payments = await db.get(`SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count FROM customer_payments WHERE ${where}`);
  const production = await db.get(`SELECT COALESCE(SUM(sacks_produced), 0) AS sacks, COUNT(*) AS batches FROM production_batches WHERE status = 'COMPLETED' AND ${where}`);
  const lowStock = await db.get("SELECT COUNT(*) AS c FROM raw_materials WHERE quantity_kg <= min_stock_level");
  const lowSack = await db.get("SELECT COUNT(*) AS c FROM finished_product_variants WHERE stock_sacks <= minimum_stock_sacks");
  const customerDebt = await db.get("SELECT COALESCE(SUM(balance), 0) AS total FROM customers WHERE balance > 0");
  return {
    period,
    stockValue: Number(matValue.v) + Number(prodValue.v),
    lowStockMaterials: lowStock.c,
    lowStockProducts: lowSack.c,
    sales: { total: sales.total, count: sales.count },
    expenses: { total: expenses.total, count: expenses.count },
    payments: { total: payments.total, count: payments.count },
    production: { sacks: production.sacks, batches: production.batches },
    customerDebt: customerDebt.total,
  };
}

async function list_products() {
  const rows = await db.all("SELECT * FROM finished_products ORDER BY name");
  return Promise.all(
    rows.map(async (p) => {
      const variants = await db.all("SELECT id, sack_size_kg, default_price_per_sack, stock_sacks, minimum_stock_sacks FROM finished_product_variants WHERE finished_product_id = ? ORDER BY id", p.id);
      return { id: p.id, name: p.name, unit: p.unit, variants: variants.map((v) => ({ id: v.id, sackSizeKg: v.sack_size_kg, pricePerSack: v.default_price_per_sack, stockSacks: v.stock_sacks, minStockSacks: v.minimum_stock_sacks })) };
    })
  );
}

async function list_materials() {
  const rows = await db.all("SELECT * FROM raw_materials ORDER BY name");
  return rows.map((m) => ({ id: m.id, name: m.name, unit: m.unit, quantityKg: m.quantity_kg, costPerKg: m.cost_per_kg, minStockLevel: m.min_stock_level, low: Number(m.quantity_kg) <= Number(m.min_stock_level) }));
}

async function list_customers() {
  const rows = await db.all("SELECT * FROM customers ORDER BY name");
  return rows.map((c) => ({ id: c.id, name: c.name, phone: c.phone, balance: c.balance }));
}

async function list_sales({ period = "month" } = {}) {
  const where = periodWhere(period);
  const rows = await db.all(
    `SELECT s.id, s.customer_id, c.name AS customer_name, s.final_total, s.amount_paid, s.status, s.created_at
     FROM sales s LEFT JOIN customers c ON c.id = s.customer_id
     WHERE s.status != 'CORRECTED' AND ${where} ORDER BY s.created_at DESC LIMIT 200`
  );
  return rows.map((s) => ({ id: s.id, customer: s.customer_name || "Comptoir", total: s.final_total, paid: s.amount_paid, balance: Number(s.final_total) - Number(s.amount_paid), date: s.created_at }));
}

async function list_expenses({ period = "month" } = {}) {
  const where = periodWhere(period);
  const rows = await db.all(`SELECT id, category, amount, reference, description, created_at FROM expenses WHERE cancelled_at IS NULL AND ${where} ORDER BY created_at DESC LIMIT 200`);
  return rows.map((e) => ({ id: e.id, category: e.category, amount: e.amount, reference: e.reference, description: e.description, date: e.created_at }));
}

async function list_workers() {
  const rows = await db.all("SELECT * FROM workers ORDER BY name");
  return Promise.all(
    rows.map(async (w) => {
      const bal = await db.get("SELECT COALESCE(SUM(CASE WHEN type = 'ADVANCE_TO_WORKER' THEN amount WHEN type = 'ADVANCE_FROM_WORKER' THEN -amount ELSE 0 END), 0) AS t FROM worker_ledger_entries WHERE worker_id = ? AND reversed = 0", w.id);
      return { id: w.id, name: w.name, phone: w.phone, monthlySalary: w.monthly_salary, status: w.status, balance: bal.t };
    })
  );
}

async function list_production({ period = "month" } = {}) {
  const where = periodWhere(period);
  const rows = await db.all(
    `SELECT b.id, b.status, b.actual_output_kg, b.sacks_produced, b.total_production_cost, b.created_at, p.name AS product_name
     FROM production_batches b JOIN finished_products p ON p.id = b.finished_product_id
     WHERE ${where} ORDER BY b.created_at DESC LIMIT 200`
  );
  return rows.map((b) => ({ id: b.id, product: b.product_name, status: b.status, actualOutputKg: b.actual_output_kg, sacksProduced: b.sacks_produced, cost: b.total_production_cost, date: b.created_at }));
}

async function get_customer_statement({ customerId } = {}) {
  if (!customerId) return { error: "customerId requis" };
  const sales = await db.all("SELECT id, created_at AS date, 'SALE' AS type, final_total AS amount FROM sales WHERE customer_id = ? AND status != 'CORRECTED'", customerId);
  const payments = await db.all("SELECT id, created_at AS date, 'PAYMENT' AS type, -amount AS amount FROM customer_payments WHERE customer_id = ?", customerId);
  const entries = [...sales, ...payments].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  let balance = 0;
  const history = entries.map((e) => {
    balance += Number(e.amount);
    return { id: e.id, operation: e.type, amount: e.amount, balanceAfter: Number(balance.toFixed(2)) };
  });
  return { customerId, history };
}

async function sales_report({ period = "month" } = {}) {
  const where = periodWhere(period);
  const sales = await db.all(`SELECT * FROM sales WHERE status != 'CORRECTED' AND ${where}`);
  const byProduct = {};
  const byCustomer = {};
  let grandTotal = 0;
  let grandPaid = 0;
  for (const s of sales) {
    grandTotal += Number(s.final_total) || 0;
    grandPaid += Number(s.amount_paid) || 0;
    const cname = s.customer_id
      ? (await db.get("SELECT name FROM customers WHERE id = ?", s.customer_id))?.name || "Inconnu"
      : "Comptoir";
    byCustomer[cname] = (byCustomer[cname] || 0) + (Number(s.final_total) || 0);
    for (const it of JSON.parse(s.items || "[]")) {
      const v = await db.get("SELECT finished_product_id, sack_size_kg FROM finished_product_variants WHERE id = ?", it.variantId);
      const pname = v ? (await db.get("SELECT name FROM finished_products WHERE id = ?", v.finished_product_id))?.name || "Produit" : "Produit";
      const key = `${pname} (${v?.sack_size_kg ?? "?"} kg)`;
      byProduct[key] = (byProduct[key] || 0) + (Number(it.sacks) || 0) * (Number(it.unitPrice) || 0);
    }
  }
  const topProducts = Object.entries(byProduct).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, total]) => ({ name, total }));
  const topCustomers = Object.entries(byCustomer).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, total]) => ({ name, total }));
  return {
    period,
    count: sales.length,
    totalSales: Number(grandTotal.toFixed(2)),
    totalPaid: Number(grandPaid.toFixed(2)),
    totalBalance: Number((grandTotal - grandPaid).toFixed(2)),
    topProducts,
    topCustomers,
  };
}

async function expense_report({ period = "month" } = {}) {
  const where = periodWhere(period);
  const rows = await db.all(`SELECT category, COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count FROM expenses WHERE cancelled_at IS NULL AND ${where} GROUP BY category ORDER BY total DESC`);
  return { period, categories: rows };
}

async function inventory_report() {
  const matValue = await db.get("SELECT COALESCE(SUM(quantity_kg * cost_per_kg), 0) AS v FROM raw_materials");
  const prodValue = await db.get("SELECT COALESCE(SUM(stock_sacks * COALESCE(default_price_per_sack, 0)), 0) AS v FROM finished_product_variants");
  const lowMats = await db.all("SELECT id, name, quantity_kg, min_stock_level FROM raw_materials WHERE quantity_kg <= min_stock_level");
  const lowProds = await db.all(
    "SELECT v.id, p.name, v.sack_size_kg, v.stock_sacks, v.minimum_stock_sacks FROM finished_product_variants v JOIN finished_products p ON p.id = v.finished_product_id WHERE v.stock_sacks <= v.minimum_stock_sacks"
  );
  return {
    stockValue: Number(matValue.v) + Number(prodValue.v),
    materialsValue: matValue.v,
    productsValue: prodValue.v,
    lowStockMaterials: lowMats,
    lowStockProducts: lowProds,
  };
}

/* ---------- Write handlers ---------- */

async function create_product({ name, sackSizeKg, defaultPricePerSack, minimumStockSacks = 0 } = {}) {
  if (!name) return { error: "Le nom du produit est requis." };
  const pid = await db.tx(async (t) => {
    const info = await t.run(
      "INSERT INTO finished_products (name, unit, sack_size_kg, default_price_per_sack, minimum_stock_sacks) VALUES (?, 'PIECE', ?, ?, ?)",
      name,
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
  return { ok: true, id: pid, name };
}

async function create_material({ name, unit = "KG", quantityKg = 0, totalPurchasePrice = 0, minStockLevel = 0 } = {}) {
  if (!name) return { error: "Le nom de la matière est requis." };
  const qty = Number(quantityKg) || 0;
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
      "INSERT INTO raw_material_purchases (raw_material_id, purchased_quantity, unit_cost, total_purchase_price) VALUES (?, ?, ?, ?)",
      matId,
      qty,
      unitCost,
      total
    );
    return matId;
  });
  return { ok: true, id, name, quantityKg: qty, costPerKg: unitCost };
}

async function create_customer({ name, phone } = {}) {
  if (!name) return { error: "Le nom du client est requis." };
  const info = await db.run("INSERT INTO customers (name, phone) VALUES (?, ?)", name, phone || null);
  return { ok: true, id: info.lastInsertRowid, name };
}

async function create_sale({ customerId, items = [], amountPaid = 0, note } = {}) {
  if (!Array.isArray(items) || items.length === 0) return { error: "La facture doit contenir au moins une ligne." };
  const total = items.reduce((s, i) => s + Number(i.sacks) * Number(i.unitPrice), 0);
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
        await t.run("UPDATE finished_product_variants SET stock_sacks = GREATEST(0, stock_sacks - ?) WHERE id = ?", Number(i.sacks) || 0, i.variantId);
      }
    }
    return sid;
  });
  return { ok: true, saleId, total: Number(total.toFixed(2)), amountPaid: paid, balance: Number((total - paid).toFixed(2)) };
}

async function record_payment({ customerId, amount, reference, note } = {}) {
  if (!customerId || !amount) return { error: "customerId et amount sont requis." };
  await db.run(
    "INSERT INTO customer_payments (customer_id, amount, reference, note) VALUES (?, ?, ?, ?)",
    customerId,
    Number(amount),
    reference || null,
    note || null
  );
  const row = await db.get(
    `SELECT COALESCE((SELECT SUM(final_total - amount_paid) FROM sales WHERE customer_id = ? AND status != 'CORRECTED'), 0) -
            COALESCE((SELECT SUM(amount) FROM customer_payments WHERE customer_id = ?), 0) AS bal`,
    customerId,
    customerId
  );
  const bal = Number(row.bal) || 0;
  await db.run("UPDATE customers SET balance = ? WHERE id = ?", bal, customerId);
  return { ok: true, amount: Number(amount), newBalance: bal };
}

async function record_expense({ category, amount, reference, description } = {}) {
  if (!category || !amount) return { error: "category et amount sont requis." };
  const info = await db.run(
    "INSERT INTO expenses (category, amount, reference, description) VALUES (?, ?, ?, ?)",
    category,
    Number(amount),
    reference || null,
    description || null
  );
  return { ok: true, id: info.lastInsertRowid, category, amount: Number(amount) };
}

const HANDLERS = {
  get_dashboard,
  list_products,
  list_materials,
  list_customers,
  list_sales,
  list_expenses,
  list_workers,
  list_production,
  get_customer_statement,
  sales_report,
  expense_report,
  inventory_report,
  create_product,
  create_material,
  create_customer,
  create_sale,
  record_payment,
  record_expense,
};

/* ---------- Groq client ---------- */

async function groqChat(messages, tools) {
  let lastErr = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 1500 * attempt));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 90000);
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.groqApiKey}`,
        },
        body: JSON.stringify({
          model: config.groqModel,
          messages,
          tools,
          tool_choice: "auto",
          temperature: 0.3,
          max_tokens: 900,
        }),
      });
      if (res.status === 429 || res.status >= 500) {
        const body = await res.text();
        const m = body.match(/in ([\d.]+)s/i);
        lastErr = new Error(`Groq API ${res.status}: ${body.slice(0, 200)}`);
        if (m) {
          const wait = Math.min(Number(m[1]) + 1, 30);
          await new Promise((r) => setTimeout(r, wait * 1000));
          continue;
        }
        throw lastErr;
      }
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Groq API ${res.status}: ${body.slice(0, 300)}`);
      }
      const data = await res.json();
      return data.choices?.[0]?.message || { content: "" };
    } catch (e) {
      if (e.name === "AbortError") throw new Error("Groq API: délai dépassé");
      lastErr = e;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr || new Error("Groq API: échec après plusieurs tentatives");
}

export async function runAssistant({ message, history = [] } = {}) {
  if (!config.groqApiKey) {
    return "L'assistant IA n'est pas configuré : la clé API Groq manque sur le serveur.";
  }
  const messages = [
    { role: "system", content: SYSTEM },
    ...(Array.isArray(history) ? history : [])
      .slice(-10)
      .filter((h) => h && (h.role === "user" || h.role === "assistant") && typeof h.content === "string")
      .map((h) => ({ role: h.role, content: h.content })),
    { role: "user", content: String(message || "") },
  ];

  let guard = 0;
  while (guard++ < 8) {
    const msg = await groqChat(messages, TOOLS);
    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      return msg.content || "Je n'ai rien à répondre.";
    }
    messages.push(msg);
    for (const tc of msg.tool_calls) {
      const name = tc.function?.name;
      let args = {};
      try {
        args = JSON.parse(tc.function?.arguments || "{}");
      } catch {}
      let out;
      try {
        const fn = HANDLERS[name];
        out = fn ? await fn(args) : { error: `Outil inconnu: ${name}` };
      } catch (e) {
        out = { error: String(e?.message || e) };
      }
      messages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(out).slice(0, 6000) });
    }
  }
  return "Nombre maximal d'étapes atteint. Reformulez votre demande.";
}
