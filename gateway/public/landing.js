(function () {
  var POLL_MS = 60_000;

  function $(id) {
    return document.getElementById(id);
  }

  function goToOffice(e) {
    if (e && e.preventDefault) e.preventDefault();
    window.location.href = "/office";
  }

  function setStaticMetrics() {
    setMetric(
      "metric-orchestrator",
      "Coordenação, política de segurança e aprovações no Telegram",
      "live"
    );
    setMetric(
      "metric-macofel",
      "Catálogo e-commerce e sync de imagens (com confirmação)",
      "live"
    );
    setMetric("metric-heimdall", "Monitorização de deploys e portfólio", "live");
    setMetric("metric-vp", "Saúde dos sites industriais", "live");
  }

  function setMetric(id, html, state) {
    var el = $(id);
    if (!el) return;
    el.innerHTML = html;
    el.classList.remove("loading", "live", "err");
    if (state) el.classList.add(state);
  }

  function setHeroSystemLabel(ok) {
    var badge = $("hero-ops-badge");
    var text = $("hero-ops-text");
    var dot = $("hero-status-dot");
    if (!text) return;
    if (ok) {
      if (badge) badge.classList.add("ok");
      if (dot) dot.className = "hero-status-dot ok";
      text.textContent = "Gateway operacional · ecossistema disponível";
    } else {
      if (badge) badge.classList.remove("ok");
      if (dot) dot.className = "hero-status-dot err";
      text.textContent = "Gateway temporariamente indisponível";
    }
  }

  function setNavGateway(ok, label) {
    var navBadge = $("nav-gateway-status");
    var navText = $("nav-gateway-status-text");
    var navDot = $("nav-status-dot");
    if (navBadge) {
      navBadge.classList.remove("ok", "err");
      navBadge.classList.add(ok ? "ok" : "err");
    }
    if (navDot) navDot.className = "status-dot" + (ok ? " ok" : " err");
    if (navText) navText.textContent = label;
  }

  function checkGatewayHealth() {
    var bar = $("gateway-status");
    var text = $("gateway-status-text");

    return fetch("/api/health", { cache: "no-store" })
      .then(function (r) {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then(function (data) {
        if (bar) bar.classList.add("ok");
        var at =
          data && data.at
            ? " · " + new Date(data.at).toLocaleTimeString("pt-PT")
            : "";
        if (text) text.textContent = "Gateway Vercel: online" + at;
        setNavGateway(true, "Gateway online");
        setHeroSystemLabel(true);
      })
      .catch(function () {
        if (bar) bar.classList.add("err");
        if (text) text.textContent = "Gateway Vercel: offline";
        setNavGateway(false, "Gateway offline");
        setHeroSystemLabel(false);
      });
  }

  function initReveal() {
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
      els.forEach(function (el) {
        obs.observe(el);
      });
    } else {
      els.forEach(function (el) {
        el.classList.add("visible");
      });
    }
    var hero = document.querySelector(".hero");
    if (hero) hero.classList.add("visible");
  }

  function init() {
    document.querySelectorAll(".cta-office").forEach(function (el) {
      el.addEventListener("click", goToOffice);
    });

    setStaticMetrics();
    checkGatewayHealth();
    setInterval(checkGatewayHealth, POLL_MS);
    initReveal();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
