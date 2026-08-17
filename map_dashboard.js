function calculateDistanceKM(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return (R * c).toFixed(1);
}

function createCustomIcon(iconClass, color) {
  return L.divIcon({
    className: "custom-map-pin",
    html: `
      <div style="
        background-color: ${color};
        width: 36px;
        height: 36px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        display: flex;
        align-items: center;
        justify-content: center;
        border: 2px solid #ffffff;
        box-shadow: 0 4px 10px rgba(0,0,0,0.3);
      ">
        <i class="${iconClass}" style="
          transform: rotate(45deg);
          color: white;
          font-size: 16px;
        "></i>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -36]
  });
}

async function fetchAndHighlightNearestLocation(map, centerLat, centerLng) {
  showToast("Searching local health centers & Red Cross...");

  try {
    const endpoints = [
      `https://nominatim.openstreetmap.org/search?format=json&q=hospital&lat=${centerLat}&lon=${centerLng}&bounded=1&viewbox=${centerLng - 0.25},${centerLat + 0.25},${centerLng + 0.25},${centerLat - 0.25}&limit=10`,
      `https://nominatim.openstreetmap.org/search?format=json&q=clinic&lat=${centerLat}&lon=${centerLng}&bounded=1&viewbox=${centerLng - 0.25},${centerLat + 0.25},${centerLng + 0.25},${centerLat - 0.25}&limit=10`,
      `https://nominatim.openstreetmap.org/search?format=json&q=blood+bank&lat=${centerLat}&lon=${centerLng}&bounded=1&viewbox=${centerLng - 0.25},${centerLat + 0.25},${centerLng + 0.25},${centerLat - 0.25}&limit=10`,
      `https://nominatim.openstreetmap.org/search?format=json&q=QKMF&lat=${centerLat}&lon=${centerLng}&bounded=1&viewbox=${centerLng - 0.25},${centerLat + 0.25},${centerLng + 0.25},${centerLat - 0.25}&limit=5`,
      `https://nominatim.openstreetmap.org/search?format=json&q=Kryqi+i+Kuq&lat=${centerLat}&lon=${centerLng}&bounded=1&viewbox=${centerLng - 0.25},${centerLat + 0.25},${centerLng + 0.25},${centerLat - 0.25}&limit=5`
    ];

    const responses = await Promise.all(
      endpoints.map((url) =>
        fetch(url, { headers: { "User-Agent": "BloodBridgeAppGlobal/1.0" } })
          .then((r) => r.json())
          .catch(() => [])
      )
    );

    const rawList = responses.flat();
    const uniqueFacilities = [];
    const seenIds = new Set();

    rawList.forEach((item) => {
      if (item && item.place_id && !seenIds.has(item.place_id)) {
        seenIds.add(item.place_id);
        uniqueFacilities.push(item);
      }
    });

    let nearestFacility = null;
    let minDistance = Infinity;

    uniqueFacilities.forEach((item) => {
      const lat = parseFloat(item.lat);
      const lng = parseFloat(item.lon);
      const name = item.display_name.split(",")[0];

      if (lat && lng) {
        const dist = parseFloat(calculateDistanceKM(centerLat, centerLng, lat, lng));

        if (dist < minDistance) {
          minDistance = dist;
          nearestFacility = { name, dist, lat, lng };
        }

        L.marker([lat, lng], {
          icon: createCustomIcon("fa-solid fa-hospital", "#1b3b4f")
        })
          .addTo(map)
          .bindPopup(`<b>${name}</b><br>Distance: ${dist} km`);
      }
    });

    if (nearestFacility) {
      L.polyline(
        [
          [centerLat, centerLng],
          [nearestFacility.lat, nearestFacility.lng]
        ],
        {
          color: "#e63946",
          weight: 3,
          dashArray: "6, 8",
          opacity: 0.9
        }
      ).addTo(map);

      const nearestMarker = L.marker([nearestFacility.lat, nearestFacility.lng], {
        icon: createCustomIcon("fa-solid fa-square-h", "#e63946")
      }).addTo(map);

      nearestMarker
        .bindPopup(`
          <div style="font-family: sans-serif; text-align: center;">
            <span style="background: #e63946; color: white; padding: 3px 8px; font-size: 11px; font-weight: bold; border-radius: 4px;">NEAREST REPORTING LOCATION</span>
            <h4 style="margin: 8px 0 4px 0; color: #1d3557;">${nearestFacility.name}</h4>
            <p style="margin: 0; color: #e63946; font-weight: bold; font-size: 13px;">Distance: ${nearestFacility.dist} km away</p>
          </div>
        `)
        .openPopup();

      showToast(`Nearest Facility Found: "${nearestFacility.name}" (${nearestFacility.dist} km away)`);
    } else {
      showToast("No medical centers found in immediate radius.");
    }
  } catch (err) {
    console.error("Error fetching reporting locations:", err);
    showToast("Could not load facilities. Please refresh.");
  }
}

async function initBloodBridgeMap() {
  const urlParams = new URLSearchParams(window.location.search);
  const locationName = urlParams.get("location") || "";
  const urgency = urlParams.get("urgency") || "Normal";
  const bloodType = urlParams.get("bloodType") || "A+";
  const units = urlParams.get("units") || 1;

  let targetLat = parseFloat(urlParams.get("lat"));
  let targetLng = parseFloat(urlParams.get("lng"));

 
  if (locationName && locationName.trim() !== "" && locationName !== "Reporting Location") {
    try {
      showToast(`Locating "${locationName}"...`);
      const geoRes = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationName)}&limit=1`,
        { headers: { "User-Agent": "BloodBridgeAppGlobal/1.0" } }
      );
      const geoData = await geoRes.json();

      if (geoData && geoData.length > 0) {
        
        targetLat = parseFloat(geoData[0].lat);
        targetLng = parseFloat(geoData[0].lon);
      }
    } catch (e) {
      console.error("Geocoding failed:", e);
    }
  }

 
  if (isNaN(targetLat) || isNaN(targetLng)) {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setupMapWithCoordinates(pos.coords.latitude, pos.coords.longitude, locationName, urgency, bloodType, units, true);
      }, () => {
        setupMapWithCoordinates(42.6667, 21.1667, locationName, urgency, bloodType, units, false); 
      });
      return;
    } else {
      targetLat = 42.6667;
      targetLng = 21.1667;
    }
  }

  setupMapWithCoordinates(targetLat, targetLng, locationName, urgency, bloodType, units, false);
}

async function setupMapWithCoordinates(lat, lng, locationName, urgency, bloodType, units, isUserLocation) {
  
  const map = L.map("interactiveMap").setView([lat, lng], 12);

  L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; CARTO'
  }).addTo(map);

  if (isUserLocation) {
    L.marker([lat, lng], {
      icon: createCustomIcon("fa-solid fa-user-large", "#1d3557")
    })
      .addTo(map)
      .bindPopup("<b>📍 Your Current Location</b>")
      .openPopup();
  } else {
    let markerColor = "#6c757d"; 
    if (urgency.toLowerCase() === "critical") markerColor = "#e63946";
    else if (urgency.toLowerCase() === "urgent") markerColor = "#ff9f1c";

    const requestMarker = L.marker([lat, lng], {
      icon: createCustomIcon("fa-solid fa-droplet", markerColor)
    }).addTo(map);

    requestMarker.bindPopup(`
      <div style="font-family: sans-serif;">
        <strong style="color:${markerColor}; font-size:14px;">${urgency.toUpperCase()} BLOOD REQUEST</strong>
        <p style="margin: 4px 0; color: #1d3557;"><b>Type:</b> ${bloodType} (${units} Bags)</p>
        <p style="margin: 4px; color: #e63946;"><b>Location:</b> ${locationName || "Specified Location"}</p>
      </div>
    `).openPopup();
  }

  await fetchAndHighlightNearestLocation(map, lat, lng);
}

function showToast(message) {
  const toast = document.createElement("div");
  toast.innerText = message;
  toast.style.cssText =
    "position:fixed; bottom:30px; left:50%; transform:translateX(-50%); background:#1d3557; color:white; padding:12px 24px; border-radius:30px; z-index:1000; font-weight:600; box-shadow:0 4px 15px rgba(0,0,0,0.2); font-family:sans-serif;";
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

window.addEventListener("DOMContentLoaded", initBloodBridgeMap);