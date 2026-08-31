const API_URL = window.BLOODBRIDGE_API_URL
  || (["localhost", "127.0.0.1"].includes(window.location.hostname)
    ? "http://localhost:5000/api"
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

function mergeStoredUser(partial) {
  const current = getCurrentUser() || {};
  localStorage.setItem("bloodbridge.user", JSON.stringify({ ...current, ...partial }));
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

function formatDonorLocationLabel(donor) {
  if (donor?.locationLabel) {
    return donor.locationLabel.split(",")[0].trim() || donor.locationLabel;
  }
  if (donor?.latitude != null && donor?.longitude != null) {
    return `${Number(donor.latitude).toFixed(3)}, ${Number(donor.longitude).toFixed(3)}`;
  }
  return "Not set";
}

async function geocodeAddress(query) {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`,
  );
  const data = await response.json();
  if (!Array.isArray(data) || !data[0]) return null;
  return {
    latitude: Number(data[0].lat),
    longitude: Number(data[0].lon),
    label: String(data[0].display_name || query).slice(0, 200),
  };
}

async function reverseGeocode(latitude, longitude) {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
    );
    const data = await response.json();
    const address = data.address || {};
    return (
      address.city ||
      address.town ||
      address.village ||
      address.municipality ||
      data.display_name ||
      "GPS location"
    ).slice(0, 200);
  } catch {
    return "GPS location";
  }
}

async function saveDonorCoordinates({ latitude, longitude, locationLabel, locationSource }) {
  const coordinates = await apiFetch("/profile/me/donor", {
    method: "PATCH",
    body: JSON.stringify({ latitude, longitude }),
  });
  if (locationLabel === undefined && locationSource === undefined) {
    return coordinates;
  }
  try {
    return await apiFetch("/profile/me/donor", {
      method: "PATCH",
      body: JSON.stringify({ locationLabel, locationSource }),
    });
  } catch {
    return { ...coordinates, locationLabel, locationSource };
  }
}

async function setShareLocationAutomatically(enabled) {
  const user = await apiFetch("/profile/me", {
    method: "PATCH",
    body: JSON.stringify({ shareLocationAutomatically: enabled }),
  });
  mergeStoredUser({ shareLocationAutomatically: user.shareLocationAutomatically });
  return user;
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
    const latitude = position.coords.latitude;
    const longitude = position.coords.longitude;
    const locationLabel = await reverseGeocode(latitude, longitude);
    await saveDonorCoordinates({
      latitude,
      longitude,
      locationLabel,
      locationSource: "gps",
    });

    return true;
  } catch (error) {
    console.warn("Unable to synchronise donor location automatically.", error);
    return false;
  }
}
