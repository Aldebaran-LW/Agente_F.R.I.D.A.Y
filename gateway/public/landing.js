(function () {
  var bar = document.getElementById("gateway-status");
  var text = document.getElementById("gateway-status-text");

  fetch("/api/health", { cache: "no-store" })
    .then(function (r) {
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    })
    .then(function (data) {
      bar.classList.add("ok");
      var at = data && data.at ? " · " + new Date(data.at).toLocaleTimeString("pt-PT") : "";
      text.textContent = "Gateway Vercel: ✅ Online" + at;
    })
    .catch(function () {
      bar.classList.add("err");
      text.textContent = "Gateway Vercel: ❌ Offline";
    });

  var els = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    var obs = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.classList.add("visible");
            obs.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    els.forEach(function (el) { obs.observe(el); });
  } else {
    els.forEach(function (el) { el.classList.add("visible"); });
  }

  var hero = document.querySelector(".hero");
  if (hero) hero.classList.add("visible");
})();
