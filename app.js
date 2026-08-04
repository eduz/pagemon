(function () {
  "use strict";

  var DEFAULT_DURATION_SECONDS = 300;
  var CONFIG_FILE = "sites.json";
  var sites = [];
  var currentIndex = 0;
  var secondsLeft = DEFAULT_DURATION_SECONDS;
  var rotationTimer = null;
  var loadFallbackTimer = null;
  var isRefreshingConfig = false;

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
  var githubDot = document.getElementById("githubDot");
  var githubStatus = document.getElementById("githubStatus");
  var githubDetail = document.getElementById("githubDetail");
  var githubUpdated = document.getElementById("githubUpdated");
  var awsDot = document.getElementById("awsDot");
  var awsSaEast = document.getElementById("awsSaEast");
  var awsUsEast = document.getElementById("awsUsEast");
  var awsUpdated = document.getElementById("awsUpdated");
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

  function buildYouTubeEmbedUrl(url, options) {
    var videoId = getYouTubeVideoId(url);
    var keepAliveOptions = options || {};
    var embedUrl = String(url || "").trim();

    if (!embedUrl) {
      return "";
    }

    if (videoId && embedUrl.indexOf("/embed/") === -1) {
      embedUrl = "https://www.youtube.com/embed/" + videoId;
    }

    embedUrl = addUrlParameter(embedUrl, "autoplay", "1");
    embedUrl = addUrlParameter(embedUrl, "mute", keepAliveOptions.youtubeMuted === false ? "0" : "1");
    embedUrl = addUrlParameter(embedUrl, "loop", "1");
    embedUrl = addUrlParameter(embedUrl, "controls", keepAliveOptions.youtubeControls === false ? "0" : "1");
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
    var embedUrl = buildYouTubeEmbedUrl(keepAlive.youtubeUrl || keepAlive.youtubeEmbedUrl || "", keepAlive);

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

  function requestJson(url, onSuccess, onError) {
    var request = new XMLHttpRequest();
    request.open("GET", url, true);
    request.timeout = 8000;

    request.onreadystatechange = function () {
      if (request.readyState !== 4) {
        return;
      }

      if (request.status < 200 || request.status >= 300) {
        onError();
        return;
      }

      try {
        onSuccess(JSON.parse(request.responseText.replace(/^\uFEFF/, "").replace(/\u0000/g, "")));
      } catch (error) {
        onError();
      }
    };

    request.onerror = onError;
    request.ontimeout = onError;
    request.send();
  }

  function formatUpdatedAt(value) {
    if (!value) {
      return "--";
    }

    var date = new Date(value);

    if (isNaN(date.getTime())) {
      return "--";
    }

    return date.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function setDotState(dot, state) {
    if (!dot) {
      return;
    }

    dot.className = "status-dot is-" + state;
  }

  function updateGithubStatus() {
    requestJson("https://www.githubstatus.com/api/v2/status.json?ts=" + Date.now(), function (data) {
      var indicator = data.status && data.status.indicator ? data.status.indicator : "none";
      var state = indicator === "none" ? "ok" : indicator === "minor" ? "warn" : "bad";

      setDotState(githubDot, state);
      githubStatus.textContent = data.status && data.status.description ? data.status.description : "Operational";
      githubDetail.textContent = "githubstatus.com";
      githubUpdated.textContent = "Atualizado " + formatUpdatedAt(data.page && data.page.updated_at);
    }, function () {
      setDotState(githubDot, "warn");
      githubStatus.textContent = "Indisponivel";
      githubDetail.textContent = "Nao foi possivel consultar o status.";
      githubUpdated.textContent = "Atualizado --";
    });
  }

  function getAwsRegionEvents(events, region) {
    return events.filter(function (event) {
      var arn = String(event.arn || "");
      var service = String(event.service || "");
      var serviceStatus = Array.isArray(event.service_status) ? event.service_status : [];

      return arn.indexOf(":health:" + region + ":") !== -1 ||
        service.indexOf("-" + region) !== -1 ||
        serviceStatus.some(function (item) {
          return String(item.service || "").indexOf("-" + region) !== -1;
        });
    });
  }

  function getAwsEventState(event) {
    var status = Number(event.status || event.current_status || 0);

    if (status >= 3) {
      return "bad";
    }

    if (status >= 1) {
      return "warn";
    }

    return "ok";
  }

  function updateAwsRegion(row, region, label, events) {
    var regionEvents = getAwsRegionEvents(events, region);
    var worstState = "ok";
    var detail = label;
    var title = "Operational";

    regionEvents.forEach(function (event) {
      var state = getAwsEventState(event);

      if (state === "bad") {
        worstState = "bad";
      } else if (state === "warn" && worstState !== "bad") {
        worstState = "warn";
      }
    });

    if (regionEvents.length) {
      title = regionEvents.length + " evento(s)";
      detail = regionEvents[0].summary || regionEvents[0].service_name || label;
    }

    row.className = "region-row is-" + worstState;
    row.querySelector("strong").textContent = title;
    row.querySelector("p").textContent = detail;

    return worstState;
  }

  function updateAwsStatusFromEvents(events) {
    var saState = updateAwsRegion(awsSaEast, "sa-east-1", "Sao Paulo", events);
    var usState = updateAwsRegion(awsUsEast, "us-east-1", "N. Virginia", events);
    var state = saState === "bad" || usState === "bad" ? "bad" : saState === "warn" || usState === "warn" ? "warn" : "ok";

    setDotState(awsDot, state);
    awsUpdated.textContent = "Atualizado " + formatUpdatedAt(new Date());
  }

  function updateAwsStatusFromSummary(data) {
    var states = [];

    (data.regions || []).forEach(function (region) {
      var row = region.code === "sa-east-1" ? awsSaEast : region.code === "us-east-1" ? awsUsEast : null;

      if (!row) {
        return;
      }

      row.className = "region-row is-" + region.state;
      row.querySelector("strong").textContent = region.title;
      row.querySelector("p").textContent = region.detail;
      states.push(region.state);
    });

    var state = states.indexOf("bad") !== -1 ? "bad" : states.indexOf("warn") !== -1 ? "warn" : "ok";
    setDotState(awsDot, state);
    awsUpdated.textContent = "Atualizado " + formatUpdatedAt(data.updatedAt);
  }

  function updateAwsStatus() {
    var url = "https://health.aws.amazon.com/public/currentevents?ts=" + Date.now();
    var proxyUrl = "https://api.allorigins.win/raw?url=" + encodeURIComponent(url);

    requestJson("aws-regions.json?ts=" + Date.now(), updateAwsStatusFromSummary, function () {
      requestJson(url, updateAwsStatusFromEvents, function () {
        requestJson(proxyUrl, updateAwsStatusFromEvents, function () {
          setDotState(awsDot, "warn");
          [awsSaEast, awsUsEast].forEach(function (row) {
            row.className = "region-row is-warn";
            row.querySelector("strong").textContent = "Indisponivel";
            row.querySelector("p").textContent = "Nao foi possivel consultar AWS Health.";
          });
          awsUpdated.textContent = "Atualizado --";
        });
      });
    });
  }

  function startExternalStatusUpdates() {
    updateGithubStatus();
    updateAwsStatus();
    window.setInterval(updateGithubStatus, 60000);
    window.setInterval(updateAwsStatus, 60000);
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

  function stopCountdown() {
    if (rotationTimer) {
      window.clearInterval(rotationTimer);
      rotationTimer = null;
    }
  }

  function startCountdown() {
    stopCountdown();

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
      refreshConfig();
      return;
    }

    showSite(currentIndex + 1);
  }

  function refreshConfig() {
    if (isRefreshingConfig) {
      return;
    }

    isRefreshingConfig = true;
    stopCountdown();
    setLoading(true, "Atualizando sites.json");
    loadConfig(true);
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

  function handleConfigError(message, isRefresh) {
    isRefreshingConfig = false;

    if (isRefresh && sites.length) {
      // Mantem a lista atual em vez de apagar o painel numa falha de rede.
      showSite(0);
      return;
    }

    sites = [];
    showEmptyState();
    siteName.textContent = "Erro de configuracao";
    siteUrl.textContent = message;
  }

  function loadConfig(isRefresh) {
    if (!isRefresh) {
      setLoading(true, "Carregando sites.json");
    }

    var request = new XMLHttpRequest();
    request.open("GET", CONFIG_FILE + "?v=" + Date.now(), true);

    request.onreadystatechange = function () {
      if (request.readyState !== 4) {
        return;
      }

      if (request.status < 200 || request.status >= 300) {
        handleConfigError("Nao foi possivel carregar " + CONFIG_FILE, isRefresh);
        return;
      }

      try {
        var config = JSON.parse(request.responseText);
        sites = normalizeSites(config);

        // O video do YouTube e configurado so na carga inicial: refazer o src a
        // cada volta do rodizio reiniciaria o video.
        if (!isRefresh) {
          configureYouTubeKeepAlive(config);
        }

        isRefreshingConfig = false;
        emptyState.hidden = sites.length > 0;
        showSite(0);
      } catch (error) {
        handleConfigError("JSON invalido em " + CONFIG_FILE, isRefresh);
      }
    };

    request.onerror = function () {
      handleConfigError("Nao foi possivel carregar " + CONFIG_FILE, isRefresh);
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
  startExternalStatusUpdates();
  loadConfig();
}());
