(function enableLocalDirectoryNavigation() {
  "use strict";

  if (window.location.protocol !== "file:") return;

  document.querySelectorAll("a[href]").forEach(function rewriteDirectoryLink(link) {
    var href = link.getAttribute("href");
    if (!href || href.charAt(0) === "#" || href.charAt(0) === "/" || /^[a-z][a-z0-9+.-]*:/i.test(href)) return;

    var match = href.match(/^([^?#]*)([?#].*)?$/);
    if (!match || !match[1].endsWith("/")) return;

    link.setAttribute("href", match[1] + "index.html" + (match[2] || ""));
  });
})();
