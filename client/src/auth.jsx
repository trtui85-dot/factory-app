import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, http, setAccessToken, onAuthError } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    http.post("/api/auth/refresh", {})
      .then((d) => active && (setAccessToken(d.token), setUser(d.user)))
      .catch(() => {})
      .finally(() => active && setReady(true));
    return () => (active = false);
  }, []);

  const login = useCallback(async (phone, pin) => {
    const d = await http.post("/api/auth/login", { phone, pin });
    setAccessToken(d.token);
    setUser(d.user);
    return d.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await http.post("/api/auth/logout");
    } catch {}
    setAccessToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    onAuthError(() => setUser(null));
  }, []);

  return (
    <AuthContext.Provider value={{ user, ready, login, logout }}>{children}</AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
