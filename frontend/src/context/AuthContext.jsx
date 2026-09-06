import { createContext, useContext, useState } from "react";
import { AUTH_STORAGE_KEY, request } from "../api/client.js";
import { buildProfileForm } from "../utils/profile.js";
import { resolveEntitlements } from "../utils/plan.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(AUTH_STORAGE_KEY) || "");
  const [user, setUser] = useState(null);
  const [profileForm, setProfileForm] = useState(buildProfileForm(null));

  function syncProfileForm(nextUser) {
    setProfileForm(buildProfileForm(nextUser));
  }

  function saveAuth(authData) {
    localStorage.setItem(AUTH_STORAGE_KEY, authData.token);
    setToken(authData.token);
    setUser(authData.user);
    syncProfileForm(authData.user);
  }

  function clearAuth() {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setToken("");
    setUser(null);
    syncProfileForm(null);
  }

  async function apiFetch(path, options = {}) {
    return request(path, {
      ...options,
      token,
      onUnauthorized: clearAuth,
    });
  }

  // Derived from the user payload, so every place that already calls setUser gets
  // fresh entitlements for free.
  const entitlements = resolveEntitlements(user);

  const value = {
    token,
    user,
    entitlements,
    setUser,
    profileForm,
    setProfileForm,
    syncProfileForm,
    saveAuth,
    clearAuth,
    apiFetch,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
