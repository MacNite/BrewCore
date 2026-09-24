/* Language (EN/DE) and theme toggles shared by the landing page and the demo.
   Each page defines window.SITE_TEXT = { en: {...}, de: {...} } before loading
   this file; elements carry data-i18n="key" (text) or data-i18n-attr="attr:key". */
(function () {
  var store = {
    get: function (k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* storage unavailable */ } },
  };

  var text = window.SITE_TEXT || { en: {}, de: {} };
  var initial = store.get("bc-site-lang") || ((navigator.language || "en").slice(0, 2) === "de" ? "de" : "en");

  var site = {
    lang: initial === "de" ? "de" : "en",
    t: function (key, vars) {
      var s = (text[site.lang] && text[site.lang][key]) || text.en[key] || key;
      if (vars) Object.keys(vars).forEach(function (k) { s = s.split("{" + k + "}").join(vars[k]); });
      return s;
    },
    listeners: [],
    onLang: function (fn) { site.listeners.push(fn); },
    apply: function () {
      document.documentElement.lang = site.lang;
      document.querySelectorAll("[data-i18n]").forEach(function (el) { el.textContent = site.t(el.getAttribute("data-i18n")); });
      document.querySelectorAll("[data-i18n-html]").forEach(function (el) { el.innerHTML = site.t(el.getAttribute("data-i18n-html")); });
      document.querySelectorAll("[data-i18n-attr]").forEach(function (el) {
        el.getAttribute("data-i18n-attr").split(";").forEach(function (pair) {
          var p = pair.split(":");
          el.setAttribute(p[0], site.t(p[1]));
        });
      });
      var title = document.querySelector("title[data-key]");
      if (title) document.title = site.t(title.getAttribute("data-key"));
      var btn = document.getElementById("lang-toggle");
      if (btn) btn.textContent = site.lang === "de" ? "EN" : "DE";
      site.listeners.forEach(function (fn) { fn(site.lang); });
    },
  };
  window.SITE = site;

  var theme = store.get("bc-site-theme");
  if (theme === "light" || theme === "dark") document.documentElement.setAttribute("data-theme", theme);

  document.addEventListener("DOMContentLoaded", function () {
    var lang = document.getElementById("lang-toggle");
    if (lang) lang.addEventListener("click", function () {
      site.lang = site.lang === "de" ? "en" : "de";
      store.set("bc-site-lang", site.lang);
      site.apply();
    });
    var th = document.getElementById("theme-toggle");
    if (th) th.addEventListener("click", function () {
      var dark = document.documentElement.getAttribute("data-theme") === "dark" ||
        (!document.documentElement.getAttribute("data-theme") && window.matchMedia("(prefers-color-scheme: dark)").matches);
      var next = dark ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      store.set("bc-site-theme", next);
    });
    site.apply();
  });
})();
