function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));
}

function formatDate(value) {
  return value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";
}

function requestCard(request, action = "") {
  return `<article class="request-card"><div class="left"><div class="blood-circle">${escapeHtml(request.bloodType)}</div><div><h3>${escapeHtml(request.hospitalName || "Blood request")}</h3><p>${Number(request.unitsNeeded)} unit(s) · ${formatDate(request.createdAt)}</p></div></div><div class="right"><span class="${escapeHtml(request.urgency)}">${escapeHtml(request.urgency)}</span>${action}</div></article>`;
}

function donorOfferCard(offer) {
  const request = offer.request;
  return `<article class="request-card"><div class="left"><div class="blood-circle">${escapeHtml(request.bloodType)}</div><div><h3>Compatible blood request</h3><p>${Number(request.unitsNeeded)} unit(s) · ${escapeHtml(request.urgency)} · ${Number(offer.distanceKm).toFixed(1)} km away</p><p>Expires ${formatDate(offer.expiresAt)}</p></div></div><div class="right"><button data-offer-id="${escapeHtml(offer.id)}" class="accept-button">I'm interested</button><button data-offer-id="${escapeHtml(offer.id)}" class="details-button decline-button">Decline</button></div></article>`;
}

function showError(error) {
  const element = document.getElementById("pageMessage");
  element.textContent = error.message || "Unable to load data.";
  element.hidden = false;
}

async function loadPatientDashboard() {
  const user = await apiFetch("/profile/me");
  document.getElementById("welcomeName").textContent = user.fullName;
  const response = await apiFetch("/blood-requests/mine?limit=50");
  const requests = response.items;
  document.getElementById("requestList").innerHTML = requests.length
    ? requests.map((request) => requestCard(request, `<button data-request-id="${request.id}" class="details-button">View responses</button>`)).join("")
    : "<p>You have not created any blood requests yet.</p>";
  document.getElementById("totalRequests").textContent = requests.length;
  document.getElementById("activeRequests").textContent = requests.filter((request) => ["open", "matched"].includes(request.status)).length;
  document.getElementById("matchedRequests").textContent = requests.filter((request) => request.status === "matched").length;
  document.querySelectorAll(".details-button").forEach((button) => button.addEventListener("click", () => loadResponses(button.dataset.requestId)));
}

async function loadResponses(requestId) {
  const responses = await apiFetch(`/blood-requests/${requestId}/responses`);
  const target = document.getElementById("responses");
  target.hidden = false;
  target.innerHTML = `<h2>Donor responses</h2>${responses.length ? responses.map((response) => `<div class="activity-card"><div><h3>${response.donor ? escapeHtml(response.donor.fullName) : "Donor"} — ${escapeHtml(response.status)}</h3><p>${response.donor?.phone ? `Phone: ${escapeHtml(response.donor.phone)}` : "Contact details become visible once accepted."}</p>${response.status === "interested" ? `<button data-response-id="${response.id}" class="accept-button">Accept donor</button>` : ""}${response.status === "accepted" ? `<button data-response-id="${response.id}" class="complete-button">Confirm donation</button>` : ""}</div></div>`).join("") : "<p>No donor has accepted this offer yet.</p>"}`;
  target.scrollIntoView({ behavior: "smooth", block: "start" });
  target.querySelectorAll(".accept-button").forEach((button) => button.addEventListener("click", async () => {
    try {
      await apiFetch(`/blood-requests/${requestId}/responses/${button.dataset.responseId}`, { method: "PATCH", body: JSON.stringify({ status: "accepted" }) });
      await loadResponses(requestId);
      await loadPatientDashboard();
    } catch (error) { showError(error); }
  }));
  target.querySelectorAll(".complete-button").forEach((button) => button.addEventListener("click", async () => {
    const units = Number(window.prompt("How many units were donated?", "1"));
    if (!Number.isInteger(units) || units < 1) return;
    try {
      await apiFetch(`/blood-requests/${requestId}/responses/${button.dataset.responseId}/complete`, { method: "POST", body: JSON.stringify({ unitsDonated: units }) });
      await loadResponses(requestId);
      await loadPatientDashboard();
    } catch (error) { showError(error); }
  }));
}

async function loadDonorDashboard({ syncLocation = false } = {}) {
  const [user, profile] = await Promise.all([
    apiFetch("/profile/me"), apiFetch("/profile/me/donor"),
  ]);
  if (syncLocation) await syncDonorLocationAutomatically(user, profile);
  const offers = await apiFetch("/donor-offers/me");
  document.getElementById("welcomeName").textContent = user.fullName;
  document.getElementById("availability").textContent = profile.isAvailable ? "Available" : "Unavailable";
  document.getElementById("radius").textContent = `${profile.notificationRadiusKm} km`;
  document.getElementById("requestList").innerHTML = offers.length
    ? offers.map(donorOfferCard).join("")
    : "<p>No active matching offers right now.</p>";
  document.getElementById("openRequests").textContent = offers.length;
  document.querySelectorAll(".accept-button").forEach((button) => button.addEventListener("click", async () => {
    try {
      await apiFetch(`/donor-offers/${button.dataset.offerId}/accept`, { method: "POST" });
      await loadDonorDashboard();
    } catch (error) { showError(error); }
  }));
  document.querySelectorAll(".decline-button").forEach((button) => button.addEventListener("click", async () => {
    try {
      await apiFetch(`/donor-offers/${button.dataset.offerId}/decline`, { method: "POST" });
      await loadDonorDashboard();
    } catch (error) { showError(error); }
  }));
}

document.addEventListener("DOMContentLoaded", async () => {
  if (!getAccessToken() || !getCurrentUser()) {
    window.location.href = "../html/login_register.html";
    return;
  }
  document.getElementById("logoutButton").addEventListener("click", logout);
  document.getElementById("logoutButtonMobile")?.addEventListener("click", logout);
  try {
    if (document.body.dataset.role === "patient") await loadPatientDashboard();
    else {
      await loadDonorDashboard({ syncLocation: true });
      window.setInterval(() => {
        loadDonorDashboard().catch(showError);
      }, 15000);
    }
  } catch (error) { showError(error); }
});
