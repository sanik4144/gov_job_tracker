export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
export const AUTH_STORAGE_KEY = "gov-job-tracker-auth";

export async function request(path, { token, onUnauthorized, ...options } = {}) {
  const headers = {
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));

  if (response.status === 401) {
    onUnauthorized?.();
    throw new Error(data.message || data.error || "Please log in again");
  }

  if (!response.ok) {
    const error = new Error(data.message || data.error || "Request failed");
    // 402 means "you may, if you pay". Carrying the details onto the error lets any
    // caller offer an upgrade instead of showing a generic failure.
    error.status = response.status;
    error.code = data.code || null;
    error.feature = data.feature ?? null;
    error.limit = data.limit ?? null;
    error.upgradeTo = data.upgradeTo || null;
    error.isPlanLimit = response.status === 402;
    throw error;
  }

  return data;
}
