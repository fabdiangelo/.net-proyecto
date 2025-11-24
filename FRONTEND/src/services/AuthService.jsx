/* eslint-disable react-refresh/only-export-components */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import * as signalR from "@microsoft/signalr";

const AuthContext = createContext(null);

// Base de la API (cambiable por env)
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "";

// Origin real (por si el env trae /api)
export const API_ORIGIN = (() => {
  try {
    return new URL(API_BASE_URL).origin;
  } catch (e) {
    console.warn("API_ORIGIN fallback because API_BASE_URL is not a full URL:", e);
    return API_BASE_URL;
  }
})();

// ✅ browser id key + helper
export const BROWSER_ID_KEY = "e_browser_id";

// eslint-disable-next-line react-refresh/only-export-components
export const getBrowserId = () => {
  try {
    if (typeof window === "undefined") return "server";
    let id = localStorage.getItem(BROWSER_ID_KEY);
    if (!id) {
      id = crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
      localStorage.setItem(BROWSER_ID_KEY, id);
    }
    return id;
  } catch (e) {
    console.warn("getBrowserId fallback:", e);
    return `${Date.now()}-${Math.random()}`;
  }
};

// ⬇⬇⬇  EXPORTAMOS toApi para reutilizarlo
// eslint-disable-next-line react-refresh/only-export-components
export const toApi = (p = "") => {
  const clean = p.startsWith("/") ? p : `/${p}`;
  const apiPath = clean.startsWith("/api/") ? clean : `/api${clean}`;
  return `${API_BASE_URL}${apiPath}`;
};

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const connRef = useRef(null);

  const setErrorFromCatch = (err) => {
    console.error(err);
    const msg = err?.message || String(err) || "Error desconocido";
    setError(msg.replace('{"error":"', "").replace('"}', ""));
  };

  // GET /api/usuarios/me
  const fetchMe = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(toApi("/usuarios/me"), {
        method: "GET",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "X-Device-Id": getBrowserId(),
        },
      });

      if (res.status === 204 || res.status === 401) {
        setUser(null);
        setLoading(false);
        return null;
      }

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Unexpected /me response: ${res.status} ${txt}`);
      }

      const data = await res.json();
      setUser(data);
      setLoading(false);
      return data;
    } catch (err) {
      console.error("fetchMe error:", err);
      setUser(null);
      setLoading(false);
      return null;
    }
  }, []);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  // POST /api/usuarios/registro
  const register = useCallback(
    async (body = {}) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(toApi("/usuarios/registro"), {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const txt = await res.text();
          throw new Error(txt || `Register failed: ${res.status}`);
        }

        await fetchMe();
        return true;
      } catch (err) {
        console.error("register error:", err);
        setErrorFromCatch(err);
        setLoading(false);
        return false;
      }
    },
    [fetchMe]
  );

  // POST /api/usuarios/login
  const login = useCallback(
    async (body = {}) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(toApi("/usuarios/login"), {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const txt = await res.text();
          throw new Error(txt || `Login failed: ${res.status}`);
        }

        await fetchMe();
        return true;
      } catch (err) {
        console.error("login error:", err);
        setErrorFromCatch(err);
        setLoading(false);
        return false;
      }
    },
    [fetchMe]
  );

  // POST /api/usuarios/logout
  const logout = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(toApi("/usuarios/logout"), {
        method: "POST",
        credentials: "include",
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `Logout failed: ${res.status}`);
      }

      setUser(null);
      await fetchMe();
      return true;
    } catch (err) {
      console.error("logout error:", err);
      setErrorFromCatch(err);
      return false;
    } finally {
      setLoading(false);
    }
  }, [fetchMe]);

  // ---------- SignalR: dispositivos hub ----------
  useEffect(() => {
    if (!user) return;

    const browserId = getBrowserId();
    let stopped = false;

    const start = async () => {
      const conn = new signalR.HubConnectionBuilder()
        .withUrl(`${API_ORIGIN}/hubs/dispositivos?browserId=${browserId}`, {
          withCredentials: true,
        })
        .withAutomaticReconnect()
        .build();

      conn.on("DispositivoRevocado", async (payload) => {
        if (payload?.huellaDispositivo === browserId) {
          localStorage.removeItem(BROWSER_ID_KEY);
          await logout();
          window.location.href = "/login";
        }
      });

      try {
        await conn.start();
        if (!stopped) {
          connRef.current = conn;
          console.log("[SignalR] connected dispositivos hub", browserId);
        }
      } catch (e) {
        console.error("[SignalR] dispositivos hub connect error", e);
      }
    };

    start();

    return () => {
      stopped = true;
      const c = connRef.current;
      connRef.current = null;
      if (c) {
        c.stop().catch((e) =>
          console.error("[SignalR] stop error (ignored):", e)
        );
      }
    };
  }, [user, logout]);

  const value = {
    user,
    loading,
    error,
    refetchUser: fetchMe,
    register,
    login,
    logout,
    setUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

// eslint-disable-next-line react-refresh/only-export-components
export function ProtectedRoute({ children, fallback = null }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return fallback;
  return children;
}
