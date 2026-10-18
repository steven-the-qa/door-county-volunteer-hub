/* Door County Volunteer Hub — behaviour shared by every page.
   Just the phone-width Menu button for now (the menu is hidden at 640px+,
   where the nav buttons show in the header instead). */

(function () {
  "use strict";

  var button = document.getElementById("menu-button");
  var menu = document.getElementById("mobile-menu");
  if (!button || !menu) return;

  function setOpen(open) {
    menu.hidden = !open;
    button.setAttribute("aria-expanded", open ? "true" : "false");
  }

  button.addEventListener("click", function () {
    setOpen(menu.hidden);
  });

  // Escape closes the menu and returns focus to the button.
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !menu.hidden) {
      setOpen(false);
      button.focus();
    }
  });

  // Following an in-page link (e.g. "For Organizations") closes the menu.
  menu.addEventListener("click", function (e) {
    if (e.target.closest("a")) setOpen(false);
  });
})();
