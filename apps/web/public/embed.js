(function () {
  var script = document.currentScript;
  if (!script) return;

  var partner = script.getAttribute("data-partner");
  if (!partner) {
    console.error("[CultureMesh embed] missing required data-partner attribute");
    return;
  }

  // Override with data-origin for staging/testing against a non-production
  // deployment (e.g. the Vercel preview domain before cutover).
  var origin = script.getAttribute("data-origin") || "https://culturemesh.com";
  var height = script.getAttribute("data-height") || "600";

  var iframe = document.createElement("iframe");
  iframe.src = origin + "/embed/" + encodeURIComponent(partner);
  iframe.style.width = "100%";
  iframe.style.height = height + "px";
  iframe.style.border = "none";
  iframe.title = "CultureMesh";

  var container = document.getElementById("culturemesh-embed");
  if (container) {
    container.appendChild(iframe);
  } else if (script.parentNode) {
    script.parentNode.insertBefore(iframe, script.nextSibling);
  }
})();
