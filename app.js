(function () {
  "use strict";

  var DEFAULT_DURATION_SECONDS = 60;
  var CONFIG_FILE = "sites.json";
  var sites = [];
  var currentIndex = 0;
  var secondsLeft = DEFAULT_DURATION_SECONDS;
  var rotationTimer = null;
  var loadFallbackTimer = null;

  var frame = document.getElementById("siteFrame");
  var loading = document.getElementById("loading");
  var loadingText = document.getElementById("loadingText");
  var emptyState = document.getElementById("emptyState");
  var siteName = document.getElementById("siteName");
  var siteUrl = document.getElementById("siteUrl");
  var counter = document.getElementById("counter");
  var timer = document.getElementById("timer");
  var previousButton = document.getElementById("previousButton");
  var nextButton = document.getElementById("nextButton");

  function normalizeSites(config) {
    var list = Array.isArray(config) ? config : config.sites;

    if (!Array.isArray(list)) {
      return [];
    }

    return list
      .filter(function (site) {
        return site && typeof site.url === "string" && site.url.trim() !== "";
      })
      .map(function (site, index) {
        var duration = Number(site.durationSeconds || site.duration || DEFAULT_DURATION_SECONDS);

        return {
          name: site.name || site.title || "Site " + (index + 1),
          url: site.url.trim(),
          durationSeconds: duration > 5 ? Math.floor(duration) : DEFAULT_DURATION_SECONDS
        };
      });
  }

  function setLoading(isLoading, text) {
    loadingText.textContent = text || "Carregando";
    loading.className = isLoading ? "loading" : "loading is-hidden";
  }

  function updateStatus(site) {
    siteName.textContent = site.name;
    siteUrl.textContent = site.url;
    counter.textContent = currentIndex + 1 + "/" + sites.length;
    timer.textContent = secondsLeft + "s";
  }

  function startCountdown() {
    if (rotationTimer) {
      window.clearInterval(rotationTimer);
    }

    rotationTimer = window.setInterval(function () {
      secondsLeft -= 1;
      timer.textContent = secondsLeft + "s";

      if (secondsLeft <= 0) {
        showSite(currentIndex + 1);
      }
    }, 1000);
  }

  function showSite(index) {
    if (!sites.length) {
      showEmptyState();
      return;
    }

    currentIndex = (index + sites.length) % sites.length;
    var site = sites[currentIndex];
    secondsLeft = site.durationSeconds;

    setLoading(true, "Carregando");
    updateStatus(site);

    if (loadFallbackTimer) {
      window.clearTimeout(loadFallbackTimer);
    }

    frame.removeAttribute("src");
    loadFallbackTimer = window.setTimeout(function () {
      setLoading(false);
    }, 8000);

    frame.src = site.url;
    startCountdown();
  }

  function showEmptyState() {
    emptyState.hidden = false;
    frame.removeAttribute("src");
    setLoading(false);
    siteName.textContent = "TV Monitor";
    siteUrl.textContent = "Nenhum site em sites.json";
    counter.textContent = "0/0";
    timer.textContent = "0s";
  }

  function loadConfig() {
    setLoading(true, "Carregando sites.json");

    var request = new XMLHttpRequest();
    request.open("GET", CONFIG_FILE + "?v=" + Date.now(), true);

    request.onreadystatechange = function () {
      if (request.readyState !== 4) {
        return;
      }

      if (request.status < 200 || request.status >= 300) {
        sites = [];
        showEmptyState();
        siteName.textContent = "Erro de configuracao";
        siteUrl.textContent = "Nao foi possivel carregar " + CONFIG_FILE;
        return;
      }

      try {
        var config = JSON.parse(request.responseText);
        sites = normalizeSites(config);
        emptyState.hidden = sites.length > 0;
        showSite(0);
      } catch (error) {
        sites = [];
        showEmptyState();
        siteName.textContent = "Erro de configuracao";
        siteUrl.textContent = "JSON invalido em " + CONFIG_FILE;
      }
    };

    request.onerror = function () {
      sites = [];
      showEmptyState();
      siteName.textContent = "Erro de configuracao";
      siteUrl.textContent = "Nao foi possivel carregar " + CONFIG_FILE;
    };

    request.send();
  }

  frame.addEventListener("load", function () {
    if (loadFallbackTimer) {
      window.clearTimeout(loadFallbackTimer);
    }

    setLoading(false);
  });

  previousButton.addEventListener("click", function () {
    showSite(currentIndex - 1);
  });

  nextButton.addEventListener("click", function () {
    showSite(currentIndex + 1);
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "ArrowLeft") {
      showSite(currentIndex - 1);
    }

    if (event.key === "ArrowRight" || event.key === "Enter") {
      showSite(currentIndex + 1);
    }
  });

  loadConfig();
}());
