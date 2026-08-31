document.addEventListener("DOMContentLoaded", function () {
  if (!getAccessToken() || !getCurrentUser()) {
    window.location.href = "../html/login_register.html";
    return;
  }

  let selectedBloodType = "";
  let userLat = null;
  let userLng = null;

  const bloodGridItems = document.querySelectorAll("#bloodTypeGrid .grid-item");
  const urgencyCards = document.querySelectorAll(".urgency-card");
  const unitInput = document.getElementById("unitCount");
  const incrementBtn = document.getElementById("incrementUnits");
  const decrementBtn = document.getElementById("decrementUnits");

  const locationInput = document.getElementById("locationInput");
  const btnGeolocate = document.getElementById("btnGeolocate");
  const locationError = document.getElementById("locationError");

  const livePreviewCard = document.getElementById("livePreviewCard");
  const previewBadge = document.getElementById("previewBadge");
  const previewBloodBadge = document.getElementById("previewBloodBadge");
  const previewLocationName = document.getElementById("previewLocationName");
  const previewUnitLabel = document.getElementById("previewUnitLabel");

  bloodGridItems.forEach((item) => {
    item.addEventListener("click", function () {
      bloodGridItems.forEach((i) => i.classList.remove("selected"));
      this.classList.add("selected");

      selectedBloodType = this.getAttribute("data-value") || this.innerText.trim();
      const errorElem = document.getElementById("bloodTypeError");
      if (errorElem) errorElem.innerText = "";

      updateLivePreviewCard();
    });
  });

  if (incrementBtn) {
    incrementBtn.addEventListener("click", function (e) {
      e.preventDefault();
      let val = parseInt(unitInput.value) || 1;
      if (val < 25) {
        unitInput.value = val + 1;
        updateLivePreviewCard();
      }
    });
  }

  if (decrementBtn) {
    decrementBtn.addEventListener("click", function (e) {
      e.preventDefault();
      let val = parseInt(unitInput.value) || 1;
      if (val > 1) {
        unitInput.value = val - 1;
        updateLivePreviewCard();
      }
    });
  }

  urgencyCards.forEach((card) => {
    const radio = card.querySelector("input[type='radio']");
    card.addEventListener("click", function () {
      urgencyCards.forEach((c) => c.classList.remove("active"));
      this.classList.add("active");
      if (radio) radio.checked = true;

      const errorElem = document.getElementById("urgencyError");
      if (errorElem) errorElem.innerText = "";

      updateLivePreviewCard();
    });
  });

  if (locationInput) {
    locationInput.addEventListener("input", function () {
      const textVal = this.value.trim();
      userLat = null; 
      userLng = null;

      if (previewLocationName) {
        previewLocationName.innerText = textVal || "No Location Set";
      }
      if (textVal && locationError) {
        locationError.innerText = "";
      }
    });
  }

  if (btnGeolocate) {
    btnGeolocate.addEventListener("click", function (e) {
      e.preventDefault();

      if (!navigator.geolocation) {
        if (locationError) locationError.innerText = "Geolocation is not supported by your browser.";
        return;
      }

      locationInput.value = "Detecting GPS location...";

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          userLat = position.coords.latitude;
          userLng = position.coords.longitude;

          try {
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${userLat}&lon=${userLng}`
            );
            const data = await response.json();
            const placeName =
              data.address.hospital ||
              data.address.clinic ||
              data.address.city ||
              data.address.town ||
              data.address.village ||
              "Current Location";

            locationInput.value = placeName;
            if (previewLocationName) previewLocationName.innerText = placeName;
            if (locationError) locationError.innerText = "";
          } catch (err) {
            locationInput.value = `${userLat.toFixed(4)}, ${userLng.toFixed(4)}`;
          }
        },
        (error) => {
          userLat = null;
          userLng = null;
          locationInput.value = "";
          if (locationError) {
            locationError.innerText = "GPS access denied. Please type location manually.";
          }
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    });
  }

  async function geocodeLocationName(locationText) {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationText)}`
      );
      const data = await res.json();
      if (data && data.length > 0) {
        return {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon)
        };
      }
    } catch (e) {
      console.error("Geocoding failed:", e);
    }
    return null;
  }

  function updateLivePreviewCard() {
    if (!livePreviewCard) return;

    if (previewBloodBadge) {
      previewBloodBadge.innerText = selectedBloodType || "?";
    }

    const activeRadio = document.querySelector("input[name='urgency']:checked");
    const urgencyVal = activeRadio ? activeRadio.value : "Normal";

    livePreviewCard.className = "request-preview-card";
    if (previewBadge) {
      previewBadge.className = "badge";

      if (urgencyVal === "Critical") {
        livePreviewCard.classList.add("border-critical");
        previewBadge.classList.add("badge-critical");
        previewBadge.innerText = "CRITICAL";
      } else if (urgencyVal === "Urgent") {
        livePreviewCard.classList.add("border-urgent");
        previewBadge.classList.add("badge-urgent");
        previewBadge.innerText = "URGENT";
      } else {
        livePreviewCard.classList.add("border-normal");
        previewBadge.classList.add("badge-normal");
        previewBadge.innerText = "NORMAL";
      }
    }

    const units = unitInput ? unitInput.value : 1;
    if (previewUnitLabel) {
      previewUnitLabel.innerText = `${units} Unit${units > 1 ? "s" : ""} required • Just now`;
    }
  }

  const form = document.getElementById("bloodRequestForm");
  if (form) {
    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      let valid = true;

      const activeRadio = document.querySelector("input[name='urgency']:checked");
      const locationText = locationInput ? locationInput.value.trim() : "";

      if (!selectedBloodType) {
        const errorElem = document.getElementById("bloodTypeError");
        if (errorElem) errorElem.innerText = "Please select a required blood type.";
        valid = false;
      }

      if (!activeRadio) {
        const errorElem = document.getElementById("urgencyError");
        if (errorElem) errorElem.innerText = "Please select an urgency level.";
        valid = false;
      }

      if (!locationText) {
        if (locationError) locationError.innerText = "Please detect location or type it manually.";
        valid = false;
      }

      if (valid) {
        let finalLat = userLat;
        let finalLng = userLng;

        if (!finalLat || !finalLng) {
         const coords = await geocodeLocationName(locationText);
          if (coords) {
            finalLat = coords.lat;
            finalLng = coords.lng;
          } else {
            finalLat = 42.6667;
            finalLng = 21.1667;
            if (locationError) {
              locationError.innerText = "Couldn't pinpoint that exact address — using an approximate location for now.";
            }
          }
        }

        const submitButton = form.querySelector('button[type="submit"]');
        const originalButtonText = submitButton.textContent;
        submitButton.disabled = true;
        submitButton.textContent = "Submitting request…";

        try {
          const request = await apiFetch("/blood-requests", {
            method: "POST",
            body: JSON.stringify({
              bloodType: selectedBloodType,
              unitsNeeded: Number(unitInput.value),
              urgency: activeRadio.value.toLowerCase(),
              hospitalName: locationText,
              latitude: finalLat,
              longitude: finalLng,
              notes: document.getElementById("additionalDetails")?.value.trim() || "",
            }),
          });
          const queryParams = `?lat=${finalLat}&lng=${finalLng}&urgency=${activeRadio.value}&location=${encodeURIComponent(
            locationText
          )}&bloodType=${encodeURIComponent(selectedBloodType)}&units=${unitInput.value}&requestId=${encodeURIComponent(request.id)}`;
          window.location.href = "../html/confirmation.html" + queryParams;
        } catch (error) {
          if (locationError) locationError.innerText = error.message || "Unable to create the blood request.";
          submitButton.disabled = false;
          submitButton.textContent = originalButtonText;
        }
      }
    });
  }
});
