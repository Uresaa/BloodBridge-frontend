const menuToggle = document.getElementById("menu-toggle");
const navLinks = document.getElementById("nav-links");

menuToggle.addEventListener("click", () => {
  navLinks.classList.toggle("active");
});

const profileNavItem = document.getElementById("profileNavItem");
if (profileNavItem) {
  profileNavItem.hidden = !localStorage.getItem("bloodbridge.accessToken");
}
