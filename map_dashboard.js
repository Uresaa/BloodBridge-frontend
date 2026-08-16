function mapText(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
}

async function initBloodBridgeMap() {
  const parameters = new URLSearchParams(window.location.search);
  let lat = Number(parameters.get("lat"));
  let lng = Number(parameters.get("lng"));
  let urgency = parameters.get("urgency") || "normal";
  let locationName = parameters.get("location") || "Requested location";
  const requestId = parameters.get("requestId");
  if (requestId && getAccessToken()) {
    try {
      const request = await apiFetch(`/blood-requests/${encodeURIComponent(requestId)}`);
      lat = Number(request.latitude);
      lng = Number(request.longitude);
      urgency = request.urgency;
      locationName = request.hospitalName;
    } catch (error) {
      console.warn("Could not refresh request from API", error);
    }
  }
  const hasLocation = Number.isFinite(lat) && Number.isFinite(lng);
  const map = L.map("interactiveMap").setView(hasLocation ? [lat, lng] : [42.6667, 21.1667], hasLocation ? 15 : 13);
  L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", { attribution: "&copy; OpenStreetMap contributors &copy; CARTO" }).addTo(map);
  if (!hasLocation) return;
  const color = urgency.toLowerCase() === "critical" ? "#e63946" : urgency.toLowerCase() === "urgent" ? "#ff9f1c" : "#6c757d";
  L.circleMarker([lat, lng], { radius: 12, fillColor: color, color: "#fff", weight: 3, fillOpacity: .9 })
    .addTo(map)
    .bindPopup(`<strong style="color:${color}">${mapText(urgency).toUpperCase()} REQUEST</strong><br>${mapText(locationName)}`)
    .openPopup();
}

window.addEventListener("DOMContentLoaded", initBloodBridgeMap);
