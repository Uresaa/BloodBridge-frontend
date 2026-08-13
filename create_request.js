document.addEventListener("DOMContentLoaded", function () {
  let selectedBloodType = "";
  
  const bloodGridItems = document.querySelectorAll("#bloodTypeGrid .grid-item");
  const urgencyCards = document.querySelectorAll(".urgency-card");
  const unitInput = document.getElementById("unitCount");
  const locationInput = document.getElementById("locationInput");
  
  const livePreviewCard = document.getElementById("livePreviewCard");
  const previewBadge = document.getElementById("previewBadge");
  const previewBloodBadge = document.getElementById("previewBloodBadge");
  const previewLocationName = document.getElementById("previewLocationName");
  const previewUnitLabel = document.getElementById("previewUnitLabel");

  bloodGridItems.forEach(item => {
    item.addEventListener("click", function() {
      bloodGridItems.forEach(i => i.classList.remove("selected"));
      this.classList.add("selected");
      selectedBloodType = this.getAttribute("data-value");
      document.getElementById("bloodTypeError").innerText = "";
      updateLivePreviewCard();
    });
  });

  urgencyCards.forEach(card => {
    const radio = card.querySelector("input[type='radio']");
    card.addEventListener("click", function() {
      urgencyCards.forEach(c => c.classList.remove("active"));
      this.classList.add("active");
      radio.checked = true;
      document.getElementById("urgencyError").innerText = "";
      updateLivePreviewCard();
    });
  });

  document.getElementById("incrementUnits").addEventListener("click", () => {
    unitInput.value = parseInt(unitInput.value) + 1;
    updateLivePreviewCard();
  });

  document.getElementById("decrementUnits").addEventListener("click", () => {
    if (parseInt(unitInput.value) > 1) {
      unitInput.value = parseInt(unitInput.value) - 1;
      updateLivePreviewCard();
    }
  });

  locationInput.addEventListener("input", () => {
    previewLocationName.innerText = locationInput.value.trim() || "No Location Set";
  });

  function updateLivePreviewCard() {
    previewBloodBadge.innerText = selectedBloodType || "?";
    livePreviewCard.className = "request-preview-card";
    previewBadge.className = "badge";

    const activeRadio = document.querySelector("input[name='urgency']:checked");
    const urgencyVal = activeRadio ? activeRadio.value : "Normal";

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
    previewUnitLabel.innerText = `${unitInput.value} Unit${unitInput.value > 1 ? 's' : ''} required • Just now`;
  }

  //Geocoding i sakte per lokacionin
  document.getElementById("bloodRequestForm").addEventListener("submit", async function(e) {
    e.preventDefault();
    let valid = true;

    const activeRadio = document.querySelector("input[name='urgency']:checked");

    if(!selectedBloodType) {
      document.getElementById("bloodTypeError").innerText = "Please specify a required blood classification type.";
      valid = false;
    }
    if(!activeRadio) {
      document.getElementById("urgencyError").innerText = "Urgency parameter level selection is mandatory.";
      valid = false;
    }
    if(locationInput.value.trim() === "") {
      document.getElementById("locationError").innerText = "Please detail target location establishment facility name.";
      valid = false;
    }

    if(valid) {
      const locationText = locationInput.value.trim();
      const urgencyVal = activeRadio.value;

      try {
        // Kerkojme koordinatat reale gjeografike nepermjet API-se se OpenStreetMap
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationText)}`);
        const data = await response.json();

        let lat, lng;

        if (data && data.length > 0) {
          // Marrja e koordinatave te sakta reale
          lat = parseFloat(data[0].lat);
          lng = parseFloat(data[0].lon);
        } else {
          // Fallback te koordinatat e Prishtines vetem nese lokacioni nuk gjendet fare ne harte
          lat = 42.6667;
          lng = 21.1667;
        }

        const bloodRequest = await apiFetch("/blood-requests", {
          method: "POST",
          body: JSON.stringify({
            bloodType: selectedBloodType,
            unitsNeeded: Number(unitInput.value),
            urgency: urgencyVal.toLowerCase(),
            hospitalName: locationText,
            latitude: lat,
            longitude: lng,
            notes: document.getElementById("additionalDetails").value.trim(),
          }),
        });
        const queryParams = `?lat=${lat}&lng=${lng}&success=true&urgency=${urgencyVal}&location=${encodeURIComponent(locationText)}&requestId=${encodeURIComponent(bloodRequest.id)}`;
        window.location.href = "confirmation.html" + queryParams;

      } catch (error) {
        console.error("Request Error:", error);
        document.getElementById("locationError").innerText = error.message;
      }
    }
  });
});
