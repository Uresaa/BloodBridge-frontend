const menuToggle = document.getElementById("menu-toggle");
const navLinks = document.getElementById("nav-links");

if (menuToggle && navLinks) {
  menuToggle.addEventListener("click", () => {
    navLinks.classList.toggle("active");
  });
}

const profileNavItem = document.getElementById("profileNavItem");

if (profileNavItem) {
  profileNavItem.hidden = !localStorage.getItem("bloodbridge.accessToken");
}


const isLoggedIn = Boolean(localStorage.getItem("bloodbridge.accessToken"));

document.querySelectorAll("[data-login-link]").forEach((link) => {
  if (!isLoggedIn) return;

  link.textContent = "Logout";
  link.href = "#";
  link.addEventListener("click", (event) => {
    event.preventDefault();
    if (typeof logout === "function") {
      logout();
      return;
    }
    localStorage.removeItem("bloodbridge.accessToken");
    localStorage.removeItem("bloodbridge.user");
    window.location.href = "login_register.html";
  });
});