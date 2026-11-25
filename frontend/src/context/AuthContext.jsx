import { useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest, clearCsrf } from "../services/apiClient";
import { adoptAccountProjects, leaveAccount } from "../services/schemaRepository";
import { AuthContext } from "./AuthContextCore";

const SESSION_KEY = "schevo.has_session";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [workspace, setWorkspace] = useState(null);
  const [status, setStatus] = useState("loading");

  const refresh = useCallback(async () => {
    // If no prior session exists in localStorage, skip /auth/me to avoid 401 console noise on initial load
    const hasSession = typeof window !== "undefined" && window.localStorage?.getItem(SESSION_KEY) === "true";
    if (!hasSession) {
      leaveAccount();
      clearCsrf();
      setUser(null);
      setWorkspace(null);
      setStatus("anonymous");
      return null;
    }

    try {
      const session = await apiRequest("/api/v1/auth/me");
      if (!session?.user) {
        if (typeof window !== "undefined") window.localStorage?.removeItem(SESSION_KEY);
        leaveAccount();
        clearCsrf();
        setUser(null);
        setWorkspace(null);
        setStatus("anonymous");
        return null;
      }
      const projects = await apiRequest("/api/v1/projects");
      adoptAccountProjects(projects.projects, session.user.id);
      setUser(session.user);
      setWorkspace(session.workspace);
      setStatus("ready");
      return session.user;
    } catch {
      if (typeof window !== "undefined") window.localStorage?.removeItem(SESSION_KEY);
      leaveAccount();
      clearCsrf();
      setUser(null);
      setWorkspace(null);
      setStatus("anonymous");
      return null;
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { refresh(); }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const logout = useCallback(async () => {
    try {
      await apiRequest("/api/v1/auth/logout", { method: "POST", body: {} });
    } catch {
      /* local sign-out still clears the visible session */
    }
    if (typeof window !== "undefined") window.localStorage?.removeItem(SESSION_KEY);
    leaveAccount();
    clearCsrf();
    setUser(null);
    setWorkspace(null);
    setStatus("anonymous");
  }, []);

  const value = useMemo(() => ({ user, workspace, status, refresh, logout, setUser }), [user, workspace, status, refresh, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
