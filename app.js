(function () {
  "use strict";

  var DEFAULT_DURATION_SECONDS = 300;
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
  var blockedState = document.getElementById("blockedState");
  var blockedUrl = document.getElementById("blockedUrl");
  var siteName = document.getElementById("siteName");
  var siteUrl = document.getElementById("siteUrl");
  var counter = document.getElementById("counter");
  var timer = document.getElementById("timer");
  var previousButton = document.getElementById("previousButton");
  var nextButton = document.getElementById("nextButton");
  var keepAliveAudio = document.getElementById("keepAliveAudio");
  var keepAliveVideo = document.getElementById("keepAliveVideo");
  var youtubeKeepAliveFrame = document.getElementById("youtubeKeepAliveFrame");
  var wakeLock = null;

  function getYouTubeVideoId(url) {
    var match = String(url || "").match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([^?&/]+)/);
    return match ? match[1] : "";
  }

  function addUrlParameter(url, key, value) {
    var separator = url.indexOf("?") === -1 ? "?" : "&";
    var pattern = new RegExp("([?&])" + key + "=");

    if (pattern.test(url)) {
      return url;
    }

    return url + separator + encodeURIComponent(key) + "=" + encodeURIComponent(value);
  }

  function buildYouTubeEmbedUrl(url) {
    var videoId = getYouTubeVideoId(url);
    var embedUrl = String(url || "").trim();

    if (!embedUrl) {
      return "";
    }

    if (videoId && embedUrl.indexOf("/embed/") === -1) {
      embedUrl = "https://www.youtube.com/embed/" + videoId;
    }

    embedUrl = addUrlParameter(embedUrl, "autoplay", "1");
    embedUrl = addUrlParameter(embedUrl, "mute", "1");
    embedUrl = addUrlParameter(embedUrl, "loop", "1");
    embedUrl = addUrlParameter(embedUrl, "controls", "0");
    embedUrl = addUrlParameter(embedUrl, "playsinline", "1");
    embedUrl = addUrlParameter(embedUrl, "disablekb", "1");
    embedUrl = addUrlParameter(embedUrl, "modestbranding", "1");

    if (videoId) {
      embedUrl = addUrlParameter(embedUrl, "playlist", videoId);
    }

    return embedUrl;
  }

  function configureYouTubeKeepAlive(config) {
    var keepAlive = config && config.keepAlive ? config.keepAlive : {};
    var embedUrl = buildYouTubeEmbedUrl(keepAlive.youtubeUrl || keepAlive.youtubeEmbedUrl || "");

    if (!youtubeKeepAliveFrame || !embedUrl) {
      if (youtubeKeepAliveFrame) {
        youtubeKeepAliveFrame.className = "is-disabled";
        youtubeKeepAliveFrame.removeAttribute("src");
      }

      return;
    }

    youtubeKeepAliveFrame.className = "";

    if (youtubeKeepAliveFrame.src !== embedUrl) {
      youtubeKeepAliveFrame.src = embedUrl;
    }
  }

  function playMediaElement(element, volume) {
    if (!element || typeof element.play !== "function") {
      return;
    }

    if (typeof volume === "number" && "volume" in element) {
      element.volume = volume;
    }

    var playRequest = element.play();

    if (playRequest && typeof playRequest.catch === "function") {
      playRequest.catch(function () {
        // Some TV browsers only allow playback after a remote-control interaction.
      });
    }
  }

  function requestWakeLock() {
    if (!navigator.wakeLock || typeof navigator.wakeLock.request !== "function") {
      return;
    }

    navigator.wakeLock.request("screen").then(function (lock) {
      wakeLock = lock;
      wakeLock.addEventListener("release", function () {
        wakeLock = null;
      });
    }).catch(function () {
      wakeLock = null;
    });
  }

  function startKeepAlive() {
    requestWakeLock();
    playMediaElement(keepAliveAudio, 1);
    playMediaElement(keepAliveVideo, 0);
  }

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
          embed: site.embed !== false,
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
        showNextSite();
      }
    }, 1000);
  }

  function showNextSite() {
    if (!sites.length) {
      showEmptyState();
      return;
    }

    if (currentIndex >= sites.length - 1) {
      window.location.reload();
      return;
    }

    showSite(currentIndex + 1);
  }

  function showSite(index) {
    if (!sites.length) {
      showEmptyState();
      return;
    }

    currentIndex = (index + sites.length) % sites.length;
    var site = sites[currentIndex];
    secondsLeft = site.durationSeconds;

    emptyState.hidden = true;
    blockedState.hidden = true;
    setLoading(true, "Carregando");
    updateStatus(site);

    if (loadFallbackTimer) {
      window.clearTimeout(loadFallbackTimer);
    }

    frame.removeAttribute("src");

    if (!site.embed) {
      blockedUrl.textContent = site.url;
      blockedState.hidden = false;
      setLoading(false);
      startCountdown();
      return;
    }

    loadFallbackTimer = window.setTimeout(function () {
      setLoading(false);
    }, 8000);

    frame.src = site.url;
    startCountdown();
  }

  function showEmptyState() {
    emptyState.hidden = false;
    blockedState.hidden = true;
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
        configureYouTubeKeepAlive(config);
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
    startKeepAlive();
    showSite(currentIndex - 1);
  });

  nextButton.addEventListener("click", function () {
    startKeepAlive();
    showNextSite();
  });

  document.addEventListener("keydown", function (event) {
    startKeepAlive();

    if (event.key === "ArrowLeft") {
      showSite(currentIndex - 1);
    }

    if (event.key === "ArrowRight" || event.key === "Enter") {
      showNextSite();
    }
  });

  document.addEventListener("pointerdown", startKeepAlive);
  document.addEventListener("touchstart", startKeepAlive);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") {
      startKeepAlive();
    }
  });

  startKeepAlive();
  loadConfig();
}());
