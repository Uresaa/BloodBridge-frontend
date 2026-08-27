const API_URL = window.BLOODBRIDGE_API_URL
  || (["localhost", "127.0.0.1"].includes(window.location.hostname)
    ? "http://18.184.13.232:5002/api"
    : "/api");

const COGNITO_CONFIG = Object.freeze({
  region: "eu-central-1",
  userPoolId: "eu-central-1_8WaMQ2ZIJ",
  clientId: "2ocr3d0esgbj2tbmivav9ttnv7",
});

const COGNITO_ENDPOINT = `https://cognito-idp.${COGNITO_CONFIG.region}.amazonaws.com/`;

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

async function syncDonorLocationAutomatically(user) {
  if (!user?.shareLocationAutomatically || !navigator.geolocation) {
    return false;
  }

  try {
    const position = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000,
      });
    });
    await apiFetch("/profile/me/donor", {
      method: "PATCH",
      body: JSON.stringify({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      }),
    });

    return true;
  } catch (error) {
    
    console.warn("Unable to synchronise donor location automatically.", error);
    return false;
  }
}
