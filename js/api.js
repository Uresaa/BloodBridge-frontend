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
    const error = new Error(payload?.message || "The request could not be completed.");
    error.statusCode = response.status;
    throw error;
  }

  return payload;
}

async function cognitoRequest(action, payload) {
  const response = await fetch(COGNITO_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-amz-json-1.1",
      "X-Amz-Target": `AWSCognitoIdentityProviderService.${action}`,
    },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.message || "Cognito authentication could not be completed.");
    error.code = body.__type?.split("#").pop();
    throw error;
  }
  return body;
}

async function cognitoLogin(email, password) {
  let result = await cognitoRequest("InitiateAuth", {
    AuthFlow: "USER_PASSWORD_AUTH",
    ClientId: COGNITO_CONFIG.clientId,
    AuthParameters: { USERNAME: email.trim().toLowerCase(), PASSWORD: password },
  });

  if (result.ChallengeName === "NEW_PASSWORD_REQUIRED") {
    const newPassword = window.prompt("Cognito requires a new password for this account. Enter it now:");
    if (!newPassword) throw new Error("A new Cognito password is required before you can continue.");
    result = await cognitoRequest("RespondToAuthChallenge", {
      ClientId: COGNITO_CONFIG.clientId,
      ChallengeName: "NEW_PASSWORD_REQUIRED",
      Session: result.Session,
      ChallengeResponses: { USERNAME: email.trim().toLowerCase(), NEW_PASSWORD: newPassword },
    });
  }

  const accessToken = result.AuthenticationResult?.AccessToken;
  if (!accessToken) throw new Error("Cognito did not return an access token.");
  return accessToken;
}

async function cognitoConfirmSignUp(email, confirmationCode) {
  return cognitoRequest("ConfirmSignUp", {
    ClientId: COGNITO_CONFIG.clientId,
    Username: email.trim().toLowerCase(),
    ConfirmationCode: confirmationCode.trim(),
  });
}