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
  document.getElementById("shareLocation").checked = Boolean(
    user.shareLocationAutomatically,
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
    await syncDonorLocationAutomatically(user, donor);
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
          shareLocationAutomatically:
            document.getElementById("shareLocation").checked,
        }),
      });
      showProfileMessage("Profile saved.");
      isFormChanged = false;
      markButtonAsSaved(saveBtn, "Save profile");
      await loadProfile();
      if (
        document.getElementById("shareLocation").checked &&
        getCurrentUser()?.role === "donor"
      ) {
        const donor = await apiFetch("/profile/me/donor");
        await syncDonorLocationAutomatically(
          { shareLocationAutomatically: true },
          donor,
        );
      }
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
      const saveBtn = donorForm.querySelector(".save-btn");
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
        showProfileMessage("Donor settings saved.");
        isFormChanged = false;
        markButtonAsSaved(saveBtn, "Save donor settings");
      } catch (error) {
        showProfileMessage(error.message, true);
      }
    });
  }

  document.getElementById("locationButton")?.addEventListener("click", () => {
    navigator.geolocation?.getCurrentPosition(
      async (position) => {
        try {
          await apiFetch("/profile/me/donor", {
            method: "PATCH",
            body: JSON.stringify({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            }),
          });
          showProfileMessage("Your donor location was updated.");
        } catch (error) {
          showProfileMessage(error.message, true);
        }
      },
      () =>
        showProfileMessage(
          "Location permission is required to update your donor location.",
          true,
        ),
    );
  });
});
