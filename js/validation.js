document.addEventListener("DOMContentLoaded", function () {
  const loginCard = document.getElementById("loginCard");
  const registerCard = document.getElementById("registerCard");
  const showRegister = document.getElementById("showRegister");
  const showLogin = document.getElementById("showLogin");

  showRegister.addEventListener("click", function (e) {
    e.preventDefault();
    loginCard.classList.add("hidden");
    registerCard.classList.remove("hidden");
    resetErrors();
  });

  showLogin.addEventListener("click", function (e) {
    e.preventDefault();
    registerCard.classList.add("hidden");
    loginCard.classList.remove("hidden");
    resetErrors();
  });

  // Regular Expressions
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const passwordRegex = /^(?=.*[A-Z])(?=.*\d).{8,}$/;


  // LOGIN VALIDATION
  const loginForm = document.getElementById("loginForm");

  loginForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    let isValid = true;
    resetErrors();

    const email = document.getElementById("loginEmail");
    const password = document.getElementById("loginPassword");

    if (email.value.trim() === "") {
      showError(email, "loginEmailError", "Email is required.");
      isValid = false;
    } else if (!emailRegex.test(email.value.trim())) {
      showError(
        email,
        "loginEmailError",
        "Please enter a valid email address.",
      );
      isValid = false;
    }

    if (password.value.trim() === "") {
      showError(password, "loginPasswordError", "Password is required.");
      isValid = false;
    }

    if (isValid) {
      try {
        const accessToken = await cognitoLogin(email.value, password.value);
        localStorage.setItem("bloodbridge.accessToken", accessToken);
        let user;
        try {
          user = await apiFetch("/profile/me");
        } catch (error) {
          if (error.statusCode !== 403) throw error;
          localStorage.setItem("bloodbridge.cognitoProfilePending", "true");
          loginCard.classList.add("hidden");
          registerCard.classList.remove("hidden");
          document.querySelector("#registerCard h2").textContent = "Complete Your BloodBridge Profile";
          document.querySelector("#registerCard > p").textContent = "Your Cognito login is verified. Add your profile details once to finish connecting it.";
          return;
        }
        const session = { accessToken, user };
        saveSession(session);
        window.location.href = session.user.role === "donor" ? "../html/donor-dashboard.html" : "../html/patient-dashboard.html";
      } catch (error) {
        showError(password, "loginPasswordError", error.message);
      }
    }
  });

  // REGISTER VALIDATION
  const registerForm = document.getElementById("registerForm");

  registerForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    let isValid = true;
    const cognitoProfilePending = localStorage.getItem("bloodbridge.cognitoProfilePending") === "true";
    resetErrors();

    const fullName = document.getElementById("fullName");
    const email = document.getElementById("registerEmail");
    const bloodType = document.getElementById("bloodType");
    const role = document.getElementById("role");
    const password = document.getElementById("registerPassword");
    const confirmPassword = document.getElementById("confirmPassword");
   
    if (fullName.value.trim().length < 2) {
      showError(fullName, "fullNameError", "Please enter your full name.");
      isValid = false;
    }

    if (email.value.trim() === "") {
      showError(email, "registerEmailError", "Email is required.");
      isValid = false;
    } else if (!emailRegex.test(email.value.trim())) {
      showError(
        email,
        "registerEmailError",
        "Please enter a valid email address.",
      );
      isValid = false;
    }

    if (bloodType.value === "") {
      showError(bloodType, "bloodTypeError", "Please select your blood type.");
      isValid = false;
    }

    if (role.value === "") {
      showError(role, "roleError", "Please select a role.");
      isValid = false;
    }

    if (!cognitoProfilePending) {
      if (password.value.trim() === "") {
        showError(password, "registerPasswordError", "Password is required.");
        isValid = false;
      } else if (!passwordRegex.test(password.value)) {
        showError(
          password,
          "registerPasswordError",
          "Password must contain at least 8 characters, one uppercase letter and one number.",
        );
        isValid = false;
      }

      if (confirmPassword.value.trim() === "") {
        showError(
          confirmPassword,
          "confirmPasswordError",
          "Please confirm your password.",
        );
        isValid = false;
      } else if (password.value !== confirmPassword.value) {
        showError(
          confirmPassword,
          "confirmPasswordError",
          "Passwords do not match.",
        );
        isValid = false;
      }
    }

    if (isValid) {
      try {
        if (cognitoProfilePending) {
          const user = await apiFetch("/auth/cognito/sync", {
            method: "POST",
            body: JSON.stringify({ fullName: fullName.value.trim(), bloodType: bloodType.value, email: email.value.trim() }),
          });
          const accessToken = localStorage.getItem("bloodbridge.accessToken");
          localStorage.removeItem("bloodbridge.cognitoProfilePending");
          saveSession({ accessToken, user: user.user });
          window.location.href = user.user.role === "donor" ? "../html/donor-dashboard.html" : "../html/patient-dashboard.html";
          return;
        }

        const registration = await apiFetch("/auth/cognito/register", {
          method: "POST",
          body: JSON.stringify({
            fullName: fullName.value.trim(), email: email.value.trim(), bloodType: bloodType.value,
            role: role.value, password: password.value,
          }),
        });
        const confirmationCode = window.prompt("Cognito sent a confirmation code to your email. Enter that code:");
        if (!confirmationCode) throw new Error("Enter the Cognito confirmation code to finish registration.");
        await cognitoConfirmSignUp(email.value, confirmationCode);
        window.alert(registration.message || "Account confirmed. You can now log in.");
        registerCard.classList.add("hidden");
        loginCard.classList.remove("hidden");
      } catch (error) {
        showError(email, "registerEmailError", error.message);
      }
    }
  });


  // Helper Functions 
  function showError(inputElement, errorSpanId, message) {
    inputElement.classList.add("input-error");
    document.getElementById(errorSpanId).innerText = message;
  }

  function resetErrors() {
    const inputs = document.querySelectorAll("input, select");
    inputs.forEach((input) => input.classList.remove("input-error"));

    const errorSpans = document.querySelectorAll(".error-message");
    errorSpans.forEach((span) => (span.innerText = ""));
  }
});
