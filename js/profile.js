let isFormChanged = false;
let isTrackingSet = false;

function setText(id, value) {
  document.getElementById(id).textContent = value ?? "—";
}

function showProfileMessage(message, isError = false) {
  const target = document.getElementById("profileMessage");
  target.textContent = message;
  target.style.color = isError ? "#b42318" : "#087443";
}

function markButtonAsSaved(buttonElement, originalText) {
  buttonElement.classList.add("saved");
  buttonElement.textContent = "Saved";

  setTimeout(() => {
    buttonElement.classList.remove("saved");
    buttonElement.textContent = originalText;
  }, 3000);
}

function showEmailChangeMessage(message, isError = false) {
  const target = document.getElementById("emailChangeMessage");
  target.textContent = message;
  target.style.color = isError ? "#b42318" : "#087443";
}

function closeEmailChangeModal() {
  document.getElementById("changeEmailModal").hidden = true;
  document.getElementById("requestEmailChangeForm").reset();
  document.getElementById("confirmEmailChangeForm").reset();
  document.getElementById("requestEmailChangeForm").hidden = false;
  document.getElementById("confirmEmailChangeForm").hidden = true;
  showEmailChangeMessage("");
}

function renderDonorLocation(donor) {
  const label = formatDonorLocationLabel(donor);
  const current = document.getElementById("donorLocationLabel");
  const input = document.getElementById("donorLocationInput");
  if (current) current.textContent = label;
  if (input && donor?.locationLabel) input.value = donor.locationLabel.split(",")[0].trim();
}

async function saveTypedDonorLocation() {
  const query = document.getElementById("donorLocationInput").value.trim();
  if (!query) {
    showProfileMessage("Type a city or address first.", true);
    return;
  }

  showProfileMessage("Looking up that location...");
  const place = await geocodeAddress(query);
  if (!place) {
    showProfileMessage("That city or address could not be found.", true);
    return;
  }

  const donor = await saveDonorCoordinates({
    latitude: place.latitude,
    longitude: place.longitude,
    locationLabel: place.label,
    locationSource: "manual",
  });
  await setShareLocationAutomatically(false);
  document.getElementById("shareLocation").checked = false;
  renderDonorLocation(donor);
  document.getElementById("donorLocationInput").value = query;
  showProfileMessage(
    `Matching location set to ${formatDonorLocationLabel(donor)}. GPS will not overwrite it until you turn auto-update back on.`,
  );
  isFormChanged = false;
}

async function saveGpsDonorLocation() {
  if (!navigator.geolocation) {
    showProfileMessage("Geolocation is not supported in this browser.", true);
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      try {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        const locationLabel = await reverseGeocode(latitude, longitude);
        const donor = await saveDonorCoordinates({
          latitude,
          longitude,
          locationLabel,
          locationSource: "gps",
        });
        renderDonorLocation(donor);
        showProfileMessage("Your GPS location was saved.");
      } catch (error) {
        showProfileMessage(error.message, true);
      }
    },
    () =>
      showProfileMessage(
        "Location permission is required to use GPS.",
        true,
      ),
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
  );
}

function trackFormChanges() {
  if (isTrackingSet) return;

  const inputs = document.querySelectorAll(
    "#profileForm input, #donorForm input",
  );
  inputs.forEach((input) => {
    input.addEventListener("input", () => {
      isFormChanged = true;
    });
    input.addEventListener("change", () => {
      isFormChanged = true;
    });
  });

  isTrackingSet = true;
}

window.addEventListener("beforeunload", (event) => {
  if (isFormChanged) {
    event.preventDefault();
    event.returnValue = "Unsaved changes";
  }
});

async function loadProfile() {
  const user = await apiFetch("/profile/me");

  document.getElementById("fullName").value = user.fullName || "";
  document.getElementById("phone").value = user.phone || "";
  document.getElementById("city").value = user.city || "";
  document.getElementById("email").value = user.email || "";
  document.getElementById("emailNotifications").checked = Boolean(
    user.emailNotifications,
  );
  document.getElementById("smsNotifications").checked = Boolean(
    user.smsNotifications,
  );

  setText("profileTitle", user.fullName);
  setText(
    "profileRole",
    user.role === "donor" ? "Active Blood Donor" : "Blood Requester",
  );
  setText("bloodType", user.bloodType);

  const dashboardLink = document.getElementById("dashboardLink");
  if (dashboardLink) {
    dashboardLink.href =
      user.role === "donor"
        ? "../html/donor-dashboard.html"
        : "../html/patient-dashboard.html";
  }

  if (user.role === "donor") {
    const donor = await apiFetch("/profile/me/donor");
    document.getElementById("donorSettings").hidden = false;
    document.getElementById("notificationRadius").value =
      donor.notificationRadiusKm;
    document.getElementById("radiusLabel").textContent =
      `${donor.notificationRadiusKm} km`;
    document.getElementById("isAvailable").checked = Boolean(donor.isAvailable);
    document.getElementById("shareLocation").checked = Boolean(
      user.shareLocationAutomatically,
    );
    renderDonorLocation(donor);
    await syncDonorLocationAutomatically(user);
    if (user.shareLocationAutomatically) {
      renderDonorLocation(await apiFetch("/profile/me/donor"));
    }
  }

  trackFormChanges();
  isFormChanged = false;
}

document.addEventListener("DOMContentLoaded", async () => {
  if (!getAccessToken() || !getCurrentUser()) {
    window.location.href = "../html/login_register.html";
    return;
  }

  try {
    await loadProfile();
  } catch (error) {
    showProfileMessage(error.message, true);
  }

  const profileForm = document.getElementById("profileForm");
  profileForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const saveBtn = profileForm.querySelector(".save-btn");
    try {
      await apiFetch("/profile/me", {
        method: "PATCH",
        body: JSON.stringify({
          fullName: document.getElementById("fullName").value.trim(),
          phone: document.getElementById("phone").value.trim() || null,
          city: document.getElementById("city").value.trim() || null,
          emailNotifications:
            document.getElementById("emailNotifications").checked,
          smsNotifications: document.getElementById("smsNotifications").checked,
        }),
      });
      showProfileMessage("Profile saved.");
      isFormChanged = false;
      markButtonAsSaved(saveBtn, "Save profile");
      await loadProfile();
    } catch (error) {
      showProfileMessage(error.message, true);
    }
  });

  document.getElementById("logoutButton")?.addEventListener("click", logout);
  document
    .getElementById("logoutButtonMobile")
    ?.addEventListener("click", logout);

  const changeEmailModal = document.getElementById("changeEmailModal");
  const requestEmailChangeForm = document.getElementById(
    "requestEmailChangeForm",
  );
  const confirmEmailChangeForm = document.getElementById(
    "confirmEmailChangeForm",
  );
  let requestedEmail = "";

  document
    .getElementById("changeEmailButton")
    ?.addEventListener("click", () => {
      changeEmailModal.hidden = false;
      document.getElementById("newEmail").focus();
    });

  document
    .getElementById("closeEmailModal")
    ?.addEventListener("click", closeEmailChangeModal);
  document
    .querySelector("[data-close-email-modal]")
    ?.addEventListener("click", closeEmailChangeModal);

  requestEmailChangeForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    requestedEmail = document.getElementById("newEmail").value.trim();
    const submitButton = requestEmailChangeForm.querySelector("button");
    submitButton.disabled = true;
    showEmailChangeMessage("");

    try {
      await apiFetch("/profile/email-change/request", {
        method: "POST",
        body: JSON.stringify({ email: requestedEmail }),
      });
      requestEmailChangeForm.hidden = true;
      confirmEmailChangeForm.hidden = false;
      document.getElementById("emailVerificationCode").focus();
      showEmailChangeMessage(
        "A verification code was sent to your new email address.",
      );
    } catch (error) {
      showEmailChangeMessage(error.message, true);
    } finally {
      submitButton.disabled = false;
    }
  });

  confirmEmailChangeForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitButton = confirmEmailChangeForm.querySelector("button");
    submitButton.disabled = true;
    showEmailChangeMessage("");

    try {
      await apiFetch("/profile/email-change/confirm", {
        method: "POST",
        body: JSON.stringify({
          email: requestedEmail,
          code: document.getElementById("emailVerificationCode").value.trim(),
        }),
      });
      document.getElementById("email").value = requestedEmail;
      showProfileMessage("Your email address was updated.");
      closeEmailChangeModal();
    } catch (error) {
      showEmailChangeMessage(error.message, true);
    } finally {
      submitButton.disabled = false;
    }
  });

  const donorForm = document.getElementById("donorForm");
  if (donorForm) {
    document
      .getElementById("notificationRadius")
      .addEventListener("input", () => {
        document.getElementById("radiusLabel").textContent =
          `${document.getElementById("notificationRadius").value} km`;
      });

    donorForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const saveBtn = donorForm.querySelector("button[type='submit']");
      try {
        await apiFetch("/profile/me/donor", {
          method: "PATCH",
          body: JSON.stringify({
            notificationRadiusKm: Number(
              document.getElementById("notificationRadius").value,
            ),
            isAvailable: document.getElementById("isAvailable").checked,
          }),
        });
        const shareAutomatically =
          document.getElementById("shareLocation").checked;
        await setShareLocationAutomatically(shareAutomatically);
        if (shareAutomatically) {
          await syncDonorLocationAutomatically({
            shareLocationAutomatically: true,
          });
          renderDonorLocation(await apiFetch("/profile/me/donor"));
        }
        showProfileMessage("Donor settings saved.");
        isFormChanged = false;
        markButtonAsSaved(saveBtn, "Save donor settings");
      } catch (error) {
        showProfileMessage(error.message, true);
      }
    });
  }

  document
    .getElementById("setTypedLocationButton")
    ?.addEventListener("click", () => {
      saveTypedDonorLocation().catch((error) =>
        showProfileMessage(error.message, true),
      );
    });

  document
    .getElementById("locationButton")
    ?.addEventListener("click", saveGpsDonorLocation);

  document
    .getElementById("donorLocationInput")
    ?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        saveTypedDonorLocation().catch((error) =>
          showProfileMessage(error.message, true),
        );
      }
    });
});
