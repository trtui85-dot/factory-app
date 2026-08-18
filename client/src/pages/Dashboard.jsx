import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Boxes, ShoppingCart, HandCoins, Wallet, Factory, Users, HardHat, AlertTriangle,
} from "lucide-react";
import { http } from "../api";
import { Loader } from "../components/ui";

const PERIODS = ["today", "week", "month", "year"];

const KPI_ICONS = {
  stockValue: Boxes,
  sales: ShoppingCart,
  payments: HandCoins,
  expenses: Wallet,
  production: Factory,
  customerDebt: Users,
  workerDebt: HardHat,
  lowStockMaterials: AlertTriangle,
  lowStockProducts: AlertTriangle,
};

const KPI_TONES = {
  stockValue: "blue",
  sales: "indigo",
  payments: "green",
  expenses: "red",
  production: "violet",
  customerDebt: "amber",
  workerDebt: "amber",
  lowStockMaterials: "amber",
  lowStockProducts: "amber",
};

export default function Dashboard() {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [period, setPeriod] = useState("month");

  useEffect(() => {
    http.get(`/api/dashboard?period=${period}`).then(setData).catch(() => {});
  }, [period]);

  const fmt = (v) => (v == null ? "0" : Number(v).toLocaleString());

  const kpis = data
    ? [
        { key: "stockValue", label: t("dashboard.stockValue"), value: fmt(data.stockValue) },
        { key: "sales", label: t("dashboard.sales"), value: fmt(data.sales.total), sub: `${data.sales.count} ${t("dashboard.salesCount")}` },
        { key: "payments", label: t("dashboard.payments"), value: fmt(data.payments.total), sub: `${data.payments.count}` },
        { key: "expenses", label: t("dashboard.expenses"), value: fmt(data.expenses.total) },
        { key: "production", label: t("dashboard.production"), value: fmt(data.production.sacks), sub: `${data.production.batches} ${t("dashboard.batches")}` },
        { key: "customerDebt", label: t("dashboard.customerDebt"), value: fmt(data.customerDebt) },
        { key: "workerDebt", label: t("dashboard.workerDebt"), value: fmt(data.workerDebt) },
        { key: "lowStockMaterials", label: t("dashboard.lowStockMaterials"), value: fmt(data.lowStockMaterials) },
        { key: "lowStockProducts", label: t("dashboard.lowStockProducts"), value: fmt(data.lowStockProducts) },
      ]
    : [];

  return (
    <div>
      <div className="row between" style={{ marginBottom: 16 }}>
        <div className="row">
          <img src="/logousigne.png" alt="logo" className="dash-logo" />
          <div className="row">
            {PERIODS.map((p) => (
              <button key={p} className={`btn small ${period === p ? "primary" : ""}`} onClick={() => setPeriod(p)}>
                {t(`dashboard.period.${p}`)}
              </button>
            ))}
          </div>
        </div>
      </div>
      {!data && <div className="card"><Loader /></div>}
      <div className="kpis">
        {kpis.map((k, i) => {
          const Icon = KPI_ICONS[k.key];
          return (
            <div className={`kpi tone-${KPI_TONES[k.key]}`} key={i}>
              <div className="k-label">
                <Icon size={14} />
                {k.label}
              </div>
              <div className="k-value">{k.value}</div>
              {k.sub && <div className="k-sub">{k.sub}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
