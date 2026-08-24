const API_URL = window.BLOODBRIDGE_API_URL || "http://18.184.13.232:5002/api";

function getAccessToken() {
  return localStorage.getItem("bloodbridge.accessToken");
}

function saveSession(session) {
  localStorage.setItem("bloodbridge.accessToken", session.accessToken);
  localStorage.setItem("bloodbridge.user", JSON.stringify(session.user));
}

function clearSession() {
  localStorage.removeItem("bloodbridge.accessToken");
  localStorage.removeItem("bloodbridge.user");
}

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem("bloodbridge.user"));
  } catch {
    return null;
  }
}

async function logout() {
  try {
    await apiFetch("/auth/logout", { method: "POST" });
  } finally {
    clearSession();
    window.location.href = "../html/login_register.html";
  }
}

async function apiFetch(path, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set("Content-Type", "application/json");

  const token = getAccessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  const payload = response.status === 204 ? null : await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401) clearSession();
    throw new Error(payload?.message || "The request could not be completed.");
  }

  return payload;
}
