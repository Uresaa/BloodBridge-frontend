(() => {
  if (!document.querySelector('link[href="../css/shared-layout.css"]')) {
    const stylesheet = document.createElement("link");
    stylesheet.rel = "stylesheet";
    stylesheet.href = "../css/shared-layout.css";
    document.head.append(stylesheet);
  }
  const isAccountPage =
    /profile\.html|donor-dashboard\.html|patient-dashboard\.html/.test(
      location.pathname,
    );
  const nav = document.createElement("nav");
  nav.className = "site-header";
  nav.innerHTML = `<a class="site-header__logo" href="index.html"><img src="../images/logo.png" alt="BloodBridge logo"></a><button class="site-header__toggle" type="button" aria-label="Open navigation" aria-expanded="false">☰</button><ul class="site-header__links"><li><a href="index.html">Home</a></li><li><a href="index.html#how-it-works">How it Works</a></li><li><a href="index.html#urgent-requests">Urgent Requests</a></li><li><a href="index.html#stats">Our Impact</a></li><li><a href="profile.html">Profile</a></li><li class="site-header__actions"><a class="site-header__request" href="create_request.html">Request Blood</a>${isAccountPage ? '<button id="logoutButton" class="site-header__logout" type="button">Logout</button>' : '<a class="site-header__login" href="login_register.html">Login</a>'}</li></ul>`;
  document.querySelector(".navbar")?.replaceWith(nav);
  if (!document.querySelector(".site-header")) document.body.prepend(nav);
  const footer = document.createElement("footer");
  footer.className = "site-footer";
  footer.innerHTML = `<div class="site-footer__content"><div class="site-footer__brand"><h3>BloodBridge</h3><p>Connecting blood donors with patients and hospitals to save lives through fast and reliable emergency support.</p></div><div><h4>Quick Links</h4><a href="index.html">Home</a><a href="index.html#how-it-works">How It Works</a><a href="index.html#urgent-requests">Urgent Requests</a><a href="index.html#stats">Our Impact</a></div><div><h4>Contact</h4><p>support@bloodbridge.com<br>+383 44 123 456</p></div></div><div class="site-footer__bottom">© 2026 BloodBridge. All Rights Reserved.</div>`;
  document.querySelector(".main-footer, body > footer")?.replaceWith(footer);
  if (!document.querySelector(".site-footer")) document.body.append(footer);
  const toggle = nav.querySelector(".site-header__toggle"),
    links = nav.querySelector(".site-header__links");
  toggle.addEventListener("click", () => {
    const open = links.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", open);
  });
})();
