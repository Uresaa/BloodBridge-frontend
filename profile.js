function setText(id, value) { document.getElementById(id).textContent = value ?? "—"; }

function showProfileMessage(message, isError = false) {
  const target = document.getElementById("profileMessage");
  target.textContent = message;
  target.style.color = isError ? "#b42318" : "#087443";
}

async function loadProfile() {
  const user = await apiFetch("/profile/me");
  document.getElementById("fullName").value = user.fullName || "";
  document.getElementById("phone").value = user.phone || "";
  document.getElementById("city").value = user.city || "";
  document.getElementById("email").value = user.email || "";
  document.getElementById("emailNotifications").checked = user.emailNotifications;
  document.getElementById("smsNotifications").checked = user.smsNotifications;
  document.getElementById("shareLocation").checked = user.shareLocationAutomatically;
  setText("profileTitle", user.fullName);
  setText("profileRole", user.role === "donor" ? "Active Blood Donor" : "Blood Requester");
  setText("bloodType", user.bloodType);
  document.getElementById("dashboardLink").href = user.role === "donor" ? "donor-dashboard.html" : "patient-dashboard.html";
  if (user.role !== "donor") return;
  const donor = await apiFetch("/profile/me/donor");
  document.getElementById("donorSettings").hidden = false;
  document.getElementById("notificationRadius").value = donor.notificationRadiusKm;
  document.getElementById("radiusLabel").textContent = `${donor.notificationRadiusKm} km`;
  document.getElementById("isAvailable").checked = donor.isAvailable;
}

document.addEventListener("DOMContentLoaded", async () => {
  if (!getAccessToken() || !getCurrentUser()) return void (window.location.href = "login_register.html");
  try { await loadProfile(); } catch (error) { showProfileMessage(error.message, true); }
  document.getElementById("profileForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await apiFetch("/profile/me", { method: "PATCH", body: JSON.stringify({ fullName: fullName.value.trim(), phone: phone.value.trim() || null, city: city.value.trim() || null, emailNotifications: emailNotifications.checked, smsNotifications: smsNotifications.checked, shareLocationAutomatically: shareLocation.checked }) });
      showProfileMessage("Profile saved.");
      await loadProfile();
    } catch (error) { showProfileMessage(error.message, true); }
  });
  document.getElementById("logoutButton").addEventListener("click", logout);
  const donorForm = document.getElementById("donorForm");
  if (!donorForm) return;
  document.getElementById("notificationRadius").addEventListener("input", () => { document.getElementById("radiusLabel").textContent = `${document.getElementById("notificationRadius").value} km`; });
  donorForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await apiFetch("/profile/me/donor", { method: "PATCH", body: JSON.stringify({ notificationRadiusKm: Number(notificationRadius.value), isAvailable: isAvailable.checked }) });
      showProfileMessage("Donor settings saved.");
    } catch (error) { showProfileMessage(error.message, true); }
  });
  document.getElementById("locationButton").addEventListener("click", () => navigator.geolocation?.getCurrentPosition(async (position) => {
    try {
      await apiFetch("/profile/me/donor", { method: "PATCH", body: JSON.stringify({ latitude: position.coords.latitude, longitude: position.coords.longitude }) });
      showProfileMessage("Your donor location was updated.");
    } catch (error) { showProfileMessage(error.message, true); }
  }, () => showProfileMessage("Location permission is required to update your donor location.", true)));
});
