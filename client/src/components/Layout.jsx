import { useState } from "react";
import { useTranslation } from "react-i18next";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Package, ClipboardList, Factory, ShoppingCart,
  Users, Wallet, HardHat, LogOut, Languages, Menu, MoreHorizontal,
} from "lucide-react";
import { useAuth } from "../auth";
import { setLang } from "../i18n";


const NAV = [
  { to: "/", key: "dashboard", icon: LayoutDashboard },
  { to: "/stock", key: "stock", icon: Package },
  { to: "/recipes", key: "recipes", icon: ClipboardList },
  { to: "/production", key: "production", icon: Factory },
  { to: "/sales", key: "sales", icon: ShoppingCart },
  { to: "/customers", key: "customers", icon: Users },
  { to: "/expenses", key: "expenses", icon: Wallet },
  { to: "/workers", key: "workers", icon: HardHat },
];

export default function Layout() {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [more, setMore] = useState(false);

  const isWorker = user?.role === "WORKER";
  const allowed = new Set(isWorker ? user?.permissions || [] : []);
  const nav = isWorker ? NAV.filter((n) => allowed.has(n.key)) : NAV;

  const closeAll = () => {
    setOpen(false);
    setMore(false);
  };

  const toggleLang = () => setLang(i18n.language === "fr" ? "ar" : "fr");

  const onLogout = async () => {
    await logout();
    navigate("/login");
  };

  const titleKey = nav.find((n) => n.to === location.pathname)?.key || "dashboard";

  return (
    <div className="app">
      <div className={`sidebar-overlay ${open ? "show" : ""}`} onClick={() => setOpen(false)} />
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="brand">
          <span className="brand-logo">
            <img src="/logousigne.png" alt="logo" />
          </span>
          {t("app.title")}
        </div>
        <nav>
          {nav.map((n) => {
            const Icon = n.icon;
            return (
              <NavLink key={n.to} to={n.to} end={n.to === "/"} onClick={() => setOpen(false)}>
                <Icon size={18} />
                <span>{t(`nav.${n.key}`)}</span>
              </NavLink>
            );
          })}
        </nav>
        <div className="side-foot">
          <button className="btn ghost" onClick={onLogout}>
            <LogOut size={16} /> {t("nav.logout")}
          </button>
        </div>
      </aside>

      <div className="content">
        <div className="topbar">
          <div className="row">
            <button className="icon-btn mobile-menu" onClick={() => setOpen(true)} aria-label="menu">
              <Menu size={20} />
            </button>
            <h1>{t(`nav.${titleKey}`)}</h1>
          </div>
          <div className="row">
            <button className="chip" onClick={toggleLang}>
              <Languages size={14} />
              {i18n.language === "fr" ? "العربية" : "Français"}
            </button>
            <span className="chip user-chip">
              {user?.name} · {isWorker ? t("workers.roleWorker") : user?.role}
            </span>
            <button className="icon-btn mobile-only logout" onClick={onLogout} aria-label="logout">
              <LogOut size={18} />
            </button>
          </div>
        </div>

        <Outlet />

        <footer className="app-footer">
          <span className="app-footer-name">Solutions Informatiques Rapides</span>
          <a className="app-footer-link" href="https://siir.xo.je" target="_blank" rel="noopener noreferrer">
            SIR.MR
          </a>
        </footer>

        <nav className="bottom-nav">
          {nav.slice(0, 3).map((n) => {
            const Icon = n.icon;
            return (
              <NavLink key={n.to} to={n.to} end={n.to === "/"} onClick={closeAll}>
                <Icon size={22} />
                <span>{t(`nav.${n.key}`)}</span>
              </NavLink>
            );
          })}
          <button className={`plus-btn ${more ? "active" : ""}`} onClick={() => setMore((m) => !m)}>
            <MoreHorizontal size={22} />
            <span>{t("nav.more")}</span>
          </button>
        </nav>

        <div className={`nav-more-backdrop ${more ? "show" : ""}`} onClick={() => setMore(false)} />
        <div className={`nav-more-menu ${more ? "show" : ""}`}>
          {nav.slice(3).map((n) => {
            const Icon = n.icon;
            return (
              <NavLink key={n.to} to={n.to} end={n.to === "/"} onClick={closeAll}>
                <Icon size={17} />
                <span>{t(`nav.${n.key}`)}</span>
              </NavLink>
            );
          })}
        </div>
      </div>
    </div>
  );
}
