import { Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "./auth";
import { usePwaInstall } from "./usePwaInstall";
import Layout from "./components/Layout";
import InstallScreen from "./components/InstallScreen";
import Splash from "./components/Splash";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Stock from "./pages/Stock";
import Recipes from "./pages/Recipes";
import Production from "./pages/Production";
import Sales from "./pages/Sales";
import Customers from "./pages/Customers";
import Expenses from "./pages/Expenses";
import Workers from "./pages/Workers";
import { PageLoader } from "./components/ui";

function Protected({ children }) {
  const { user, ready } = useAuth();
  if (!ready) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const { user, ready } = useAuth();
  const pwa = usePwaInstall();
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    if (!ready || pwa.needsGate || splashDone) return;
    const t = setTimeout(() => setSplashDone(true), 2500);
    return () => clearTimeout(t);
  }, [ready, pwa.needsGate, splashDone]);

  if (!ready) return <PageLoader />;
  if (pwa.needsGate) return <InstallScreen pwa={pwa} />;
  if (!splashDone) return <Splash onDone={() => setSplashDone(true)} />;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/stock" element={<Stock />} />
        <Route path="/recipes" element={<Recipes />} />
        <Route path="/production" element={<Production />} />
        <Route path="/sales" element={<Sales />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/expenses" element={<Expenses />} />
        <Route path="/workers" element={<Workers />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
