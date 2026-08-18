import { useCallback, useEffect, useRef, useState } from "react";

function isStandalone() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [ready, setReady] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [standalone] = useState(isStandalone);
  const promptRef = useRef(null);

  useEffect(() => {
    const onBeforeInstallPrompt = (e) => {
      e.preventDefault();
      promptRef.current = e;
      setDeferredPrompt(e);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    setReady(true);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    const p = promptRef.current;
    if (!p) return false;
    p.prompt();
    try {
      const choice = await p.userChoice;
      if (choice?.outcome === "accepted") {
        setInstalled(true);
        return true;
      }
    } catch {}
    setDeferredPrompt(null);
    promptRef.current = null;
    return false;
  }, []);

  const acknowledge = useCallback(() => setAcknowledged(true), []);

  const needsGate = ready && !standalone && !(installed && acknowledged);

  return { needsGate, deferredPrompt, installed, install, acknowledge, standalone };
}
