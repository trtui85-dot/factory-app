import { authRouter, authRequired, requireModule, requireAdmin } from "./auth.js";
import { rawMaterialsRouter } from "./routes/rawMaterials.js";
import { productsRouter } from "./routes/products.js";
import { recipesRouter } from "./routes/recipes.js";
import { productionRouter } from "./routes/production.js";
import { customersRouter } from "./routes/customers.js";
import { salesRouter } from "./routes/sales.js";
import { expensesRouter } from "./routes/expenses.js";
import { workersRouter } from "./routes/workers.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { assistantRouter } from "./routes/assistant.js";

export function registerRoutes(app) {
  app.use("/api/auth", authRouter);
  app.use("/api", authRequired, requireModule("stock", "/raw-materials"), rawMaterialsRouter);
  app.use("/api", authRequired, requireModule("stock", "/finished-products"), productsRouter);
  app.use("/api", authRequired, requireModule("recipes", "/recipes"), recipesRouter);
  app.use("/api", authRequired, requireModule("production", "/production"), productionRouter);
  app.use("/api", authRequired, requireModule("customers", "/customers"), customersRouter);
  app.use("/api", authRequired, requireModule("sales", "/sales"), salesRouter);
  app.use("/api", authRequired, requireModule("expenses", "/expenses"), expensesRouter);
  app.use("/api", authRequired, requireModule("workers", "/workers"), workersRouter);
  app.use("/api", authRequired, requireModule("dashboard", "/dashboard"), dashboardRouter);
  app.use("/api", authRequired, requireAdmin("/assistant"), assistantRouter);

  app.use("/api", (req, res) => {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found" } });
  });
}
