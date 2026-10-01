(function () {
  "use strict";

  /* ---------- Config ---------- */

  // 15 November 2026, Malaysia time (UTC+8)
  var WEDDING_DATE = new Date("2026-11-15T00:00:00+08:00");
  var VENUE_QUERY = "Casa Bianca Villa, No. 2, Jalan Gunung Lambak 17, Taman Gunung Lambak, 86000 Kluang, Johor";
  var MAPS_URL = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(VENUE_QUERY);
  var WAZE_URL = "https://waze.com/ul?q=" + encodeURIComponent(VENUE_QUERY) + "&navigate=yes";
  var MUSIC_VOLUME = 0.6;
  var WHATSAPP_NUMBER = "601112518133"; // Aiman, 011 1251 8133 (Malaysia +60)
  var WHATSAPP_TEXT = "Hai Aiman, saya ingin bertanya tentang majlis perkahwinan Nur Asyiqin & Ahmad Fikri pada 15 November 2026. #FAlovestory";

  // SIMPAN TARIKH: the one source of the wedding's calendar details. Google
  // Calendar, ICS (Apple Calendar, Outlook, others) are all built from this.
  // Times carry the Malaysia offset (+08:00) so they are unambiguous
  // everywhere; `timeZone` is for formats that want the zone name.
  var WEDDING_EVENT = (function () {
    var venue = "Casa Bianca Villa";
    var address = [
      "No. 2, Jalan Gunung Lambak 17",
      "Taman Gunung Lambak",
      "86000 Kluang",
      "Johor Darul Ta'zim"
    ];
    return Object.freeze({
      title: "The Beginning of Forever — Nur Asyiqin & Ahmad Fikri",
      start: "2026-11-15T11:00:00+08:00", // 11:00 AM
      end: "2026-11-15T16:00:00+08:00",   // 4:00 PM
      timeZone: "Asia/Kuala_Lumpur",
      venue: venue,
      address: Object.freeze(address),
      location: venue + ", " + address.join(", "), // single-line form for calendars
      description: [
        "The Beginning of Forever",
        "",
        "Nur Asyiqin Binti Mohd Azman",
        "&",
        "Ahmad Fikri Bin Ruzaimi",
        "",
        "#FAlovestory",
        "",
        "Majlis perkahwinan pada 15 November 2026."
      ].join("\n")
    });
  })();

  // RSVP: Google Apps Script Web App URL (Deploy → Manage deployments → Web app URL,
  // ends in /exec). Each RSVP is added to the private "Wedding RSVP 2026" sheet.
  var GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwdTzKJSuX50N_fOUm82Tgd9Ga0zTpfl5z37Ylzro9Vu__T_Di20K0570jsI-ofo4Wtzw/exec";

  var body = document.body;
  var cover = document.getElementById("cover");
  var invitation = document.getElementById("invitation");
  var openBtn = document.getElementById("openInvitation");
  var audio = document.getElementById("bgm");
  var music = document.getElementById("music");
  var musicExpand = document.getElementById("musicExpand");
  var musicPlay = document.getElementById("musicPlay");
  var musicMute = document.getElementById("musicMute");

  /* ---------- Phase 1: open invitation ---------- */

  function openInvitation() {
    openBtn.disabled = true;
    startMusic();

    window.scrollTo(0, 0);
    body.classList.remove("is-locked");
    body.classList.add("is-open");
    invitation.removeAttribute("aria-hidden");
    cover.classList.add("is-leaving");
    startReveals();
    music.hidden = false;
    navToggle.hidden = false;
    peekMusic(); // briefly show the track name, then fold back to the disc

    var done = false;
    function removeCover() {
      if (done) return;
      done = true;
      cover.hidden = true;
      cover.setAttribute("aria-hidden", "true");
    }
    cover.addEventListener("transitionend", function (e) {
      if (e.target === cover && e.propertyName === "opacity") removeCover();
    });
    setTimeout(removeCover, 2000); // fallback (e.g. reduced motion)
  }

  openBtn.addEventListener("click", openInvitation);

  /* ---------- Music ---------- */

  var fadeTimer = null;
  var pausedByVisibility = false;

  var collapseTimer = null;

  function setPlayingUI(playing) {
    music.classList.toggle("is-playing", playing);
    musicPlay.dataset.on = String(playing);
    musicPlay.setAttribute("aria-label", playing ? "Jeda" : "Main");
  }

  function setMutedUI(muted) {
    music.classList.toggle("is-muted", muted);
    musicMute.dataset.on = String(muted);
    musicMute.setAttribute("aria-pressed", String(muted));
    musicMute.setAttribute("aria-label", muted ? "Nyahsenyap" : "Senyap");
  }

  function setExpanded(open) {
    clearTimeout(collapseTimer);
    music.classList.toggle("is-expanded", open);
    musicExpand.setAttribute("aria-expanded", String(open));
    musicExpand.setAttribute("aria-label", "Muzik: La Vie En Rose oleh Emily Watts. " + (open ? "Sembunyikan" : "Tunjukkan") + " kawalan");
  }

  function scheduleCollapse(ms) {
    clearTimeout(collapseTimer);
    collapseTimer = setTimeout(function () {
      if (!music.matches(":hover") && !music.contains(document.activeElement)) setExpanded(false);
      else scheduleCollapse(2000);
    }, ms);
  }

  function peekMusic() {
    setTimeout(function () {
      setExpanded(true);
      scheduleCollapse(5000);
    }, 1800);
  }

  function fadeTo(target, ms, then) {
    clearInterval(fadeTimer);
    var start = audio.volume;
    var steps = Math.max(1, Math.round(ms / 50));
    var i = 0;
    fadeTimer = setInterval(function () {
      i++;
      audio.volume = Math.min(1, Math.max(0, start + (target - start) * (i / steps)));
      if (i >= steps) {
        clearInterval(fadeTimer);
        if (then) then();
      }
    }, 50);
  }

  function startMusic() {
    audio.volume = 0;
    var p = audio.play();
    if (p && typeof p.then === "function") {
      p.then(function () {
        setPlayingUI(true);
        fadeTo(MUSIC_VOLUME, 2000);
      }).catch(function (err) {
        console.warn("Music could not start:", err && err.message);
        setPlayingUI(false);
      });
    } else {
      setPlayingUI(true);
      fadeTo(MUSIC_VOLUME, 2000);
    }
  }

  function pauseMusic() {
    setPlayingUI(false);
    fadeTo(0, 500, function () { audio.pause(); });
  }

  musicExpand.addEventListener("click", function () {
    var open = !music.classList.contains("is-expanded");
    setExpanded(open);
    if (open) scheduleCollapse(6000);
  });

  musicPlay.addEventListener("click", function () {
    if (music.classList.contains("is-playing")) pauseMusic();
    else startMusic();
    scheduleCollapse(6000);
  });

  musicMute.addEventListener("click", function () {
    audio.muted = !audio.muted;
    setMutedUI(audio.muted);
    scheduleCollapse(6000);
  });

  // Tapping elsewhere folds the player back to the disc.
  document.addEventListener("click", function (e) {
    if (music.classList.contains("is-expanded") && !music.contains(e.target)) setExpanded(false);
  });

  audio.addEventListener("error", function () {
    console.warn("Music file not found: place the track at assets/music/la-vie-en-rose.mp3");
    setPlayingUI(false);
  });

  // Pause when the tab/app is backgrounded, resume on return.
  document.addEventListener("visibilitychange", function () {
    if (document.hidden && !audio.paused) {
      pausedByVisibility = true;
      audio.pause();
    } else if (!document.hidden && pausedByVisibility) {
      pausedByVisibility = false;
      audio.play().catch(function () { setPlayingUI(false); });
    }
  });

  /* ---------- Phase 2: countdown ---------- */

  var grid = document.getElementById("countdownGrid");
  var today = document.getElementById("countdownToday");
  var nums = {};
  grid.querySelectorAll("[data-unit]").forEach(function (el) { nums[el.dataset.unit] = el; });

  function pad(n) { return n < 10 ? "0" + n : String(n); }

  var countdownTimer = null;
  function tick() {
    var diff = WEDDING_DATE.getTime() - Date.now();
    if (diff <= 0) {
      clearInterval(countdownTimer);
      grid.hidden = true;
      today.hidden = false;
      return;
    }
    var s = Math.floor(diff / 1000);
    nums.days.textContent = pad(Math.floor(s / 86400));
    nums.hours.textContent = pad(Math.floor((s % 86400) / 3600));
    nums.minutes.textContent = pad(Math.floor((s % 3600) / 60));
    nums.seconds.textContent = pad(s % 60);
  }
  tick();
  countdownTimer = setInterval(tick, 1000);

  /* ---------- Phase 3: location ---------- */

  document.getElementById("mapLink").href = MAPS_URL;
  document.getElementById("wazeLink").href = WAZE_URL;
  document.getElementById("mapVisual").href = MAPS_URL;

  /* ---------- Simpan Tarikh: calendar options (built from WEDDING_EVENT) ---------- */

  // "2026-11-15T11:00:00+08:00" -> "20261115T030000Z", the UTC form calendars expect.
  function calendarStamp(iso) {
    return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  }

  // Pre-filled Google Calendar "add event" page — nothing for the guest to type.
  function googleCalendarUrl(ev) {
    return "https://calendar.google.com/calendar/render?" + [
      ["action", "TEMPLATE"],
      ["text", encodeURIComponent(ev.title)],
      ["dates", calendarStamp(ev.start) + "/" + calendarStamp(ev.end)], // digits, T, Z and "/" only
      ["ctz", encodeURIComponent(ev.timeZone)],
      ["location", encodeURIComponent(ev.location)],
      ["details", encodeURIComponent(ev.description)]
    ].map(function (p) { return p[0] + "=" + p[1]; }).join("&");
  }

  // --- Universal .ics file (Apple Calendar, Outlook, Samsung, and others) ---

  // "20261115T110000": the event's wall-clock time in its own time zone,
  // worked out from the config, so the guest's device zone can't shift it.
  function localStamp(iso, timeZone) {
    var parts = {};
    new Intl.DateTimeFormat("en-GB", {
      timeZone: timeZone, hourCycle: "h23",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit"
    }).formatToParts(new Date(iso)).forEach(function (p) { parts[p.type] = p.value; });
    return parts.year + parts.month + parts.day + "T" + parts.hour + parts.minute + parts.second;
  }

  // RFC 5545 text: escape \ ; , and turn line breaks into \n.
  function icsText(s) {
    return String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
  }

  // RFC 5545 lines are at most 75 bytes; longer ones continue on lines that
  // start with a space. Counted in UTF-8 bytes so "—" (3 bytes) is never split.
  function icsFold(line) {
    var out = "", bytes = 0;
    Array.from(line).forEach(function (ch) {
      var n = new TextEncoder().encode(ch).length;
      if (bytes + n > 75) { out += "\r\n "; bytes = 1; }
      out += ch;
      bytes += n;
    });
    return out;
  }

  function icsFile(ev) {
    var tz = ev.timeZone;
    var lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//FAlovestory//Nur Asyiqin & Ahmad Fikri//MS",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      // Malaysia: UTC+8 all year, no daylight saving (since 1982).
      "BEGIN:VTIMEZONE",
      "TZID:" + tz,
      "BEGIN:STANDARD",
      "DTSTART:19820101T000000",
      "TZOFFSETFROM:+0800",
      "TZOFFSETTO:+0800",
      "TZNAME:+08",
      "END:STANDARD",
      "END:VTIMEZONE",
      "BEGIN:VEVENT",
      // Same UID every time: adding it twice updates the event, not duplicates it.
      "UID:" + calendarStamp(ev.start) + "-falovestory@the-beginning-of-forever",
      "DTSTAMP:" + calendarStamp(new Date().toISOString()),
      "DTSTART;TZID=" + tz + ":" + localStamp(ev.start, tz),
      "DTEND;TZID=" + tz + ":" + localStamp(ev.end, tz),
      "SUMMARY:" + icsText(ev.title),
      "LOCATION:" + icsText(ev.location),
      "DESCRIPTION:" + icsText(ev.description),
      "STATUS:CONFIRMED",
      "TRANSP:OPAQUE",
      "END:VEVENT",
      "END:VCALENDAR"
    ];
    return lines.map(icsFold).join("\r\n") + "\r\n";
  }

  var ICS_FILENAME = "The-Beginning-of-Forever-15-November-2026.ics";
  // iPhone/iPad (incl. iPadOS reporting as a Mac): Safari shows its
  // "Add to Calendar" sheet when it opens a calendar file directly.
  var isAppleMobile = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  function openIcs() {
    var ics = icsFile(WEDDING_EVENT);
    if (isAppleMobile) {
      window.location.href = "data:text/calendar;charset=utf-8," + encodeURIComponent(ics);
      return;
    }
    // Elsewhere: download the file; the calendar app opens it from there.
    var url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
    var a = document.createElement("a");
    a.href = url;
    a.download = ICS_FILENAME;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
  }

  var saveDateBtn = document.getElementById("saveDateBtn");
  document.getElementById("saveDateGoogle").href = googleCalendarUrl(WEDDING_EVENT);
  document.getElementById("saveDateIcs").addEventListener("click", function (e) {
    e.preventDefault();
    openIcs();
  });

  // --- The sheet: bottom sheet on phones, small card on wider screens ---

  var saveSheet = document.getElementById("saveDateSheet");
  var saveSheetPanel = saveSheet.querySelector(".save-sheet__panel");
  var saveSheetTimer = null;

  // "15 November 2026", from the event config (Malaysia date).
  document.getElementById("saveSheetDate").textContent = new Date(WEDDING_EVENT.start)
    .toLocaleDateString("ms-MY", { timeZone: WEDDING_EVENT.timeZone, day: "numeric", month: "long", year: "numeric" });

  function sheetFocusables() {
    return Array.prototype.slice.call(saveSheetPanel.querySelectorAll("a[href], button"));
  }

  function openSaveSheet() {
    clearTimeout(saveSheetTimer);
    saveSheet.hidden = false;
    body.classList.add("sheet-open");
    void saveSheet.offsetWidth; // start the transition from the closed state
    saveSheet.classList.add("is-open");
    saveDateBtn.setAttribute("aria-expanded", "true");
    sheetFocusables()[0].focus({ preventScroll: true });
  }

  function closeSaveSheet() {
    if (saveSheet.hidden || !saveSheet.classList.contains("is-open")) return;
    saveSheet.classList.remove("is-open");
    body.classList.remove("sheet-open");
    saveDateBtn.setAttribute("aria-expanded", "false");
    saveSheetTimer = setTimeout(function () { saveSheet.hidden = true; }, 550);
    saveDateBtn.focus({ preventScroll: true });
  }

  saveDateBtn.addEventListener("click", openSaveSheet);
  // Close with Tutup, a tap outside the card, after choosing a calendar, or Escape.
  saveSheet.addEventListener("click", function (e) {
    if (e.target.closest("[data-sheet-close], .save-sheet__option")) closeSaveSheet();
  });
  document.addEventListener("keydown", function (e) {
    if (saveSheet.hidden || !saveSheet.classList.contains("is-open")) return;
    if (e.key === "Escape") {
      e.preventDefault();
      closeSaveSheet();
    } else if (e.key === "Tab") { // keep keyboard focus inside the sheet
      var items = sheetFocusables();
      var first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  /* ---------- Phase 4: timeline line follows scroll ---------- */

  var timelineList = document.getElementById("timelineList");
  var timelineFill = document.getElementById("timelineFill");

  function updateTimelineLine() {
    var rect = timelineList.getBoundingClientRect();
    var vh = window.innerHeight || document.documentElement.clientHeight;
    var p = (vh * 0.7 - rect.top) / rect.height;
    timelineFill.style.setProperty("--p", Math.min(1, Math.max(0, p)).toFixed(3));
  }
  window.addEventListener("scroll", updateTimelineLine, { passive: true });
  window.addEventListener("resize", updateTimelineLine);
  updateTimelineLine();

  /* ---------- Phase 6: photo lightbox ---------- */

  // The Our Story chapter photos open in one fullscreen viewer, in page order.
  var shots = Array.prototype.slice.call(document.querySelectorAll("#story .shot"));
  var lightbox = document.getElementById("lightbox");
  var lbStage = document.getElementById("lbStage");
  var lbIndex = document.getElementById("lbIndex");
  var lbPrev = document.getElementById("lbPrev");
  var lbNext = document.getElementById("lbNext");
  var current = 0;
  var lastFocus = null;
  var closeTimer = null;

  document.getElementById("lbTotal").textContent = pad(shots.length);

  function renderSlide(i) {
    var shot = shots[i];
    var media = shot.querySelector("img, .ph");
    var node;
    if (media.tagName === "IMG") {
      node = new Image();
      node.src = media.dataset.full || media.currentSrc || media.src;
      node.alt = media.alt || "";
    } else {
      // Placeholder: show it at the tile's proportions
      var ratio = shot.offsetWidth / shot.offsetHeight || 1; // untransformed size (polaroids are rotated)
      var vw = window.innerWidth, vh = window.innerHeight;
      var w = Math.min(vw * 0.88, vh * 0.72 * ratio, 720);
      node = media.cloneNode(true);
      node.style.width = w + "px";
      node.style.height = w / ratio + "px";
    }
    lbStage.replaceChildren(node);
    lbIndex.textContent = pad(i + 1);
  }

  function openLightbox(i) {
    clearTimeout(closeTimer);
    current = i;
    lastFocus = document.activeElement;
    renderSlide(i);
    lightbox.hidden = false;
    body.classList.add("lb-open");
    void lightbox.offsetWidth; // start transition from the hidden state
    lightbox.classList.add("is-open");
    lightbox.querySelector(".lb-btn--close").focus({ preventScroll: true });
  }

  function closeLightbox() {
    if (lightbox.hidden) return;
    lightbox.classList.remove("is-open");
    body.classList.remove("lb-open");
    closeTimer = setTimeout(function () {
      lightbox.hidden = true;
      lbStage.replaceChildren();
    }, 450);
    if (lastFocus) lastFocus.focus({ preventScroll: true });
  }

  function go(step) {
    current = (current + step + shots.length) % shots.length;
    lbStage.classList.add("is-swapping");
    setTimeout(function () {
      renderSlide(current);
      lbStage.classList.remove("is-swapping");
    }, 350);
  }

  shots.forEach(function (shot, i) {
    shot.setAttribute("aria-label", "Buka foto " + (i + 1) + " daripada " + shots.length);
    shot.addEventListener("click", function () { openLightbox(i); });
  });
  lbPrev.addEventListener("click", function () { go(-1); });
  lbNext.addEventListener("click", function () { go(1); });
  lightbox.querySelectorAll("[data-close]").forEach(function (el) {
    el.addEventListener("click", closeLightbox);
  });

  document.addEventListener("keydown", function (e) {
    if (lightbox.hidden) return;
    if (e.key === "Escape") closeLightbox();
    else if (e.key === "ArrowLeft") go(-1);
    else if (e.key === "ArrowRight") go(1);
    else if (e.key === "Tab") { // keep focus inside the viewer
      var btns = lightbox.querySelectorAll(".lb-btn");
      var first = btns[0], last = btns[btns.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  // Swipe left/right on touch screens
  var touchX = null;
  lightbox.addEventListener("touchstart", function (e) { touchX = e.touches[0].clientX; }, { passive: true });
  lightbox.addEventListener("touchend", function (e) {
    if (touchX === null) return;
    var dx = e.changedTouches[0].clientX - touchX;
    touchX = null;
    if (Math.abs(dx) > 45) go(dx < 0 ? 1 : -1);
  });

  /* ---------- Phase 7: WhatsApp & hashtag ---------- */

  document.getElementById("whatsappLink").href =
    "https://wa.me/" + WHATSAPP_NUMBER + "?text=" + encodeURIComponent(WHATSAPP_TEXT);

  var copyBtn = document.getElementById("copyHashtag");
  var copyLabel = copyBtn.querySelector(".copy-btn__label");
  var copyStatus = document.getElementById("copyStatus");
  var copyTimer = null;

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    // Fallback for http:// or older browsers
    return new Promise(function (resolve, reject) {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;";
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, text.length);
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      ok ? resolve() : reject(new Error("copy failed"));
    });
  }

  copyBtn.addEventListener("click", function () {
    copyText(copyBtn.dataset.copy).then(function () {
      clearTimeout(copyTimer);
      copyBtn.classList.add("is-copied");
      copyLabel.textContent = "Disalin!";
      copyStatus.textContent = "Hashtag telah disalin";
      copyTimer = setTimeout(function () {
        copyBtn.classList.remove("is-copied");
        copyLabel.textContent = "Salin Hashtag";
        copyStatus.textContent = "";
      }, 2200);
    }).catch(function () {
      clearTimeout(copyTimer);
      copyLabel.textContent = "Tekan lama hashtag untuk menyalin";
      copyTimer = setTimeout(function () { copyLabel.textContent = "Salin Hashtag"; }, 3000);
    });
  });

  /* ---------- RSVP & Ucapan form (saved to Google Sheets via Apps Script) ---------- */

  // Submissions go to GOOGLE_SCRIPT_URL (see Config at the top of this file).
  var RSVP_TIMEOUT_MS = 30000;
  var RSVP_MSG_ERROR = "Maaf, RSVP anda tidak dapat dihantar buat masa ini. Sila cuba lagi.";

  // Choices for the dropdowns. There is NO limit on the total number of
  // guests (the server accepts any count): to offer more choices, just raise `max` here.
  var RSVP_GUESTS = {
    adults:   { min: 1, max: 50, initial: 1 },
    children: { min: 0, max: 50, initial: 0 }
  };
  var RSVP_NAME_MIN = 2;
  var RSVP_WISH_MAX = 300;
  var RSVP_ATTENDANCE = ["Hadir", "Tidak Hadir"]; // first = default

  var rsvpForm = document.getElementById("rsvpForm");
  var rsvpName = document.getElementById("rsvpName");
  var rsvpNameField = document.getElementById("fieldName");
  var rsvpNameError = document.getElementById("rsvpNameError");
  var rsvpAdults = document.getElementById("rsvpAdults");
  var rsvpChildren = document.getElementById("rsvpChildren");
  var rsvpTotalNum = document.getElementById("rsvpTotalNum");
  var rsvpTotalInput = document.getElementById("rsvpTotalInput");
  var rsvpWish = document.getElementById("rsvpWish");
  var rsvpWishUsed = document.getElementById("rsvpWishUsed");
  var rsvpWishCount = document.getElementById("rsvpWishCount");
  var rsvpSubmit = document.getElementById("rsvpSubmit");
  var rsvpSubmitLabel = document.getElementById("rsvpSubmitLabel");
  var rsvpStatus = document.getElementById("rsvpStatus");
  var rsvpThanks = document.getElementById("rsvpThanks");
  var RSVP_LABEL_IDLE = "Hantar RSVP";
  var RSVP_LABEL_BUSY = "Menghantar...";
  var rsvpSubmitting = false;

  function guestLabel(n) { return n === 0 ? "Tiada" : n + " orang"; }

  function fillGuestSelect(select, cfg) {
    for (var n = cfg.min; n <= cfg.max; n++) {
      var opt = document.createElement("option");
      opt.value = String(n);
      opt.textContent = guestLabel(n);
      if (n === cfg.initial) opt.selected = true;
      select.appendChild(opt);
    }
  }

  // Whole, non-negative number from a select; anything else counts as 0.
  function guestCount(select) {
    var n = parseInt(select.value, 10);
    return isFinite(n) && n > 0 ? n : 0;
  }

  // Jumlah Tetamu = adults + children, always calculated, never typed.
  // No upper limit: any number of adults/children is added as-is.
  function updateGuestTotal() {
    var total = guestCount(rsvpAdults) + guestCount(rsvpChildren);
    rsvpTotalNum.textContent = String(total);
    rsvpTotalInput.value = String(total);
    return total;
  }

  function updateWishCount() {
    // maxlength stops typing past the limit; this also catches pasted or
    // programmatic text so the message can never exceed RSVP_WISH_MAX.
    if (rsvpWish.value.length > RSVP_WISH_MAX) {
      rsvpWish.value = rsvpWish.value.slice(0, RSVP_WISH_MAX);
    }
    var used = rsvpWish.value.length;
    rsvpWishUsed.textContent = String(used);
    rsvpWishCount.classList.toggle("is-near", used >= RSVP_WISH_MAX * 0.9 && used < RSVP_WISH_MAX);
    rsvpWishCount.classList.toggle("is-full", used >= RSVP_WISH_MAX);
  }

  function validateName(showError) {
    var ok = rsvpName.value.trim().length >= RSVP_NAME_MIN;
    if (showError || rsvpNameField.classList.contains("field--invalid")) {
      rsvpNameField.classList.toggle("field--invalid", !ok);
      rsvpName.setAttribute("aria-invalid", String(!ok));
      rsvpNameError.hidden = ok;
    }
    return ok;
  }

  // Kehadiran: "Hadir" (the default) or "Tidak Hadir"; anything else falls back to "Hadir".
  function getAttendance() {
    var value = rsvpForm.elements.attendance ? rsvpForm.elements.attendance.value : "";
    return RSVP_ATTENDANCE.indexOf(value) !== -1 ? value : RSVP_ATTENDANCE[0];
  }

  // The RSVP record — exactly these six fields, nothing else
  // (no phone, email or address is collected or sent).
  function getRsvpData() {
    var adults = guestCount(rsvpAdults);
    var children = guestCount(rsvpChildren);
    return {
      name: rsvpName.value.trim(),
      attendance: getAttendance(),
      adults: adults,
      children: children,
      totalGuests: adults + children,
      message: rsvpWish.value.trim().slice(0, RSVP_WISH_MAX)
    };
  }

  function setSubmitting(busy) {
    rsvpSubmitting = busy;
    rsvpSubmit.disabled = busy;
    rsvpSubmitLabel.textContent = busy ? RSVP_LABEL_BUSY : RSVP_LABEL_IDLE;
    rsvpForm.setAttribute("aria-busy", String(busy));
  }

  function showRsvpError(show) {
    rsvpStatus.textContent = show ? RSVP_MSG_ERROR : "";
    rsvpStatus.hidden = !show;
  }

  // Replaces the form with the thank-you card and a summary of what was sent.
  function showRsvpThanks(data) {
    document.getElementById("thanksName").textContent = data.name;
    document.getElementById("thanksAttendance").textContent = data.attendance;
    document.getElementById("thanksNote").textContent = data.attendance === "Tidak Hadir"
      ? "Terima kasih kerana memaklumkan kami."
      : "Kami menantikan kehadiran anda.";
    document.getElementById("thanksAdults").textContent = String(data.adults);
    document.getElementById("thanksChildren").textContent = String(data.children);
    document.getElementById("thanksTotal").textContent = String(data.totalGuests);

    rsvpForm.hidden = true;
    rsvpThanks.hidden = false;
    rsvpThanks.focus({ preventScroll: true });
    rsvpThanks.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
  }

  // POSTs the RSVP to the Apps Script web app and resolves only when it
  // answers {"success": true}; anything else (offline, timeout, HTTP error,
  // unreadable reply, success: false) rejects.
  // Sent as text/plain so the browser makes a simple request (Apps Script
  // cannot answer CORS preflight requests); the body is still JSON.
  function sendRsvp(data) {
    var controller = typeof AbortController === "function" ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, RSVP_TIMEOUT_MS) : null;

    return fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(data),
      redirect: "follow",
      signal: controller ? controller.signal : undefined
    })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (result) {
        if (!result || result.success !== true) throw new Error("Not saved");
        return result;
      })
      .then(function (result) {
        if (timer) clearTimeout(timer);
        return result;
      }, function (err) {
        if (timer) clearTimeout(timer);
        throw err;
      });
  }

  // Tidak Hadir: nobody is coming, so both counts become "Tiada" (0) and are
  // locked; switching back to Hadir restores the guest's earlier choices.
  var savedGuests = null;
  function syncGuestsWithAttendance() {
    var notComing = getAttendance() === "Tidak Hadir";
    if (notComing && !savedGuests) {
      savedGuests = { adults: rsvpAdults.value, children: rsvpChildren.value };
      var none = document.createElement("option");
      none.value = "0";
      none.textContent = guestLabel(0);
      none.setAttribute("data-not-coming", "");
      rsvpAdults.insertBefore(none, rsvpAdults.firstChild);
      rsvpAdults.value = "0";
      rsvpChildren.value = "0";
    } else if (!notComing && savedGuests) {
      var temp = rsvpAdults.querySelector("[data-not-coming]");
      if (temp) temp.remove();
      rsvpAdults.value = savedGuests.adults;
      rsvpChildren.value = savedGuests.children;
      savedGuests = null;
    }
    rsvpAdults.disabled = notComing;
    rsvpChildren.disabled = notComing;
    updateGuestTotal();
  }

  fillGuestSelect(rsvpAdults, RSVP_GUESTS.adults);
  fillGuestSelect(rsvpChildren, RSVP_GUESTS.children);
  syncGuestsWithAttendance();
  updateWishCount();

  Array.prototype.forEach.call(rsvpForm.querySelectorAll('input[name="attendance"]'), function (radio) {
    radio.addEventListener("change", syncGuestsWithAttendance);
  });

  rsvpAdults.addEventListener("change", updateGuestTotal);
  rsvpChildren.addEventListener("change", updateGuestTotal);
  rsvpWish.addEventListener("input", updateWishCount);
  rsvpName.addEventListener("input", function () { validateName(false); });
  rsvpName.addEventListener("blur", function () { if (rsvpName.value) validateName(true); });

  rsvpForm.addEventListener("submit", function (e) {
    e.preventDefault();
    // One request at a time: repeated clicks/taps while sending are ignored.
    if (rsvpSubmitting) return;

    // 1. Validate
    if (!validateName(true)) {
      rsvpName.focus();
      return;
    }

    // 2. Calculate the total (the server recalculates it too)
    updateGuestTotal();
    var data = getRsvpData();

    // 3–4. Disable the button and show "Menghantar..."
    showRsvpError(false);
    setSubmitting(true);

    // 5–7. Send, wait and handle the JSON reply
    sendRsvp(data)
      .then(function () {
        // Saved: the form is replaced by the thank-you card, so it stays
        // locked and can't be sent a second time.
        showRsvpThanks(data);
        loadPublicSummary(); // the counts and wishes below now include this RSVP
      })
      .catch(function () {
        // Keep what the guest typed so they can simply try again.
        showRsvpError(true);
        setSubmitting(false);
      });
  });

  /* ---------- Kehadiran + Ucapan: live public summary ---------- */

  // One read from the Apps Script's read-only endpoint (a GET to GOOGLE_SCRIPT_URL),
  // which returns only { attendance: { hadir, tidakHadir }, wishes: [{ name, message }] }
  // (wishes already newest first, empty messages already left out).
  var attendanceStats = document.getElementById("attendanceStats");
  var attendanceValues = {
    hadir: attendanceStats.querySelector('[data-stat="hadir"]'),
    tidakHadir: attendanceStats.querySelector('[data-stat="tidakHadir"]')
  };
  var wishCarousel = document.getElementById("wishCarousel");
  var wishesList = document.getElementById("wishesList"); // the carousel track
  var wishesNote = document.getElementById("wishesNote");
  var PUBLIC_TIMEOUT_MS = 20000;
  var WISH_NAME_MAX = 80;        // same limits as the form
  var WISH_MESSAGE_MAX = 300;
  var WISHES_MSG_EMPTY = "Belum ada ucapan.";
  var WISHES_MSG_ERROR = "Ucapan tidak dapat dipaparkan buat masa ini.";
  var publicRequested = false;
  var wishesAll = [];
  var wishIndex = 0;             // the one wish currently shown

  function isCount(n) { return typeof n === "number" && isFinite(n) && n >= 0 && Math.floor(n) === n; }
  function formatCount(n) { return n.toLocaleString("ms-MY"); }

  function renderAttendance(a) {
    if (!a || !isCount(a.hadir) || !isCount(a.tidakHadir)) return false;
    var hadirText = formatCount(a.hadir);
    var tidakHadirText = formatCount(a.tidakHadir);
    attendanceValues.hadir.textContent = hadirText;
    attendanceValues.tidakHadir.textContent = tidakHadirText;
    // Both figures share one size, scaled down only if a number gets long.
    attendanceStats.style.setProperty("--digits", Math.max(hadirText.length, tidakHadirText.length));
    attendanceStats.classList.remove("is-error");
    attendanceStats.classList.add("is-loaded");
    return true;
  }

  function showAttendanceError() {
    // Keep any numbers already shown; otherwise a quiet dash.
    if (attendanceStats.classList.contains("is-loaded")) return;
    attendanceValues.hadir.textContent = "–";
    attendanceValues.tidakHadir.textContent = "–";
    attendanceStats.classList.add("is-error");
  }

  // Only name + message are kept; anything else in the reply is ignored.
  function cleanWishes(list) {
    if (!Array.isArray(list)) return null;
    return list.map(function (w) {
      var name = w && typeof w.name === "string" ? w.name.trim().slice(0, WISH_NAME_MAX) : "";
      var message = w && typeof w.message === "string" ? w.message.trim().slice(0, WISH_MESSAGE_MAX) : "";
      return { name: name, message: message };
    }).filter(function (w) { return w.name && w.message; });
  }

  // One slide: message first, guest name underneath — both as plain text.
  function wishSlide(w, i, total) {
    var li = document.createElement("li");
    // Short wishes are set large; longer ones step down so they stay graceful.
    li.className = "wish" + (w.message.length > 160 ? " wish--long" : w.message.length > 70 ? " wish--medium" : "");
    li.setAttribute("aria-roledescription", "slide");
    li.setAttribute("aria-label", (i + 1) + " daripada " + total);
    var message = document.createElement("p");
    message.className = "wish__message";
    message.textContent = "“" + w.message + "”";
    var name = document.createElement("p");
    name.className = "wish__name";
    name.textContent = w.name;
    li.appendChild(message);
    li.appendChild(name);
    return li;
  }

  var wishPrev = document.getElementById("wishPrev");
  var wishNext = document.getElementById("wishNext");
  var wishDots = document.getElementById("wishDots");
  var wishDotStrip = document.getElementById("wishDotStrip");
  var wishStatus = document.getElementById("wishStatus");
  var MAX_DOTS = 7;   // with more wishes, the dots become a sliding window
  var DOT_SLOT = 24;  // px per dot button (matches .wish-carousel__dot width)

  // One small dot button per wish.
  function buildDots(total) {
    var dots = [];
    for (var n = 0; n < total; n++) {
      var dot = document.createElement("button");
      dot.type = "button";
      dot.className = "wish-carousel__dot";
      dot.setAttribute("aria-label", "Ucapan " + (n + 1) + " daripada " + total);
      dot.dataset.index = String(n);
      dots.push(dot);
    }
    wishDotStrip.replaceChildren.apply(wishDotStrip, dots);
    wishDots.style.setProperty("--dots-visible", Math.min(total, MAX_DOTS));
  }

  // Active dot, the visible window of dots, and the arrows' end states.
  function updateControls() {
    var dots = wishDotStrip.children;
    var total = dots.length;
    var start = Math.max(0, Math.min(wishIndex - Math.floor(MAX_DOTS / 2), total - MAX_DOTS));
    wishDotStrip.style.transform = "translateX(" + (-start * DOT_SLOT) + "px)";
    Array.prototype.forEach.call(dots, function (dot, n) {
      var active = n === wishIndex;
      dot.classList.toggle("is-active", active);
      if (active) dot.setAttribute("aria-current", "true"); else dot.removeAttribute("aria-current");
      dot.tabIndex = active ? 0 : -1; // one tab stop; arrow keys move between wishes
      // Dots at the window's edge shrink when more wishes lie beyond them.
      var edge = total > MAX_DOTS && ((n === start && start > 0) || (n === start + MAX_DOTS - 1 && start + MAX_DOTS < total));
      dot.classList.toggle("is-edge", edge);
    });
    wishPrev.disabled = wishIndex === 0;
    wishNext.disabled = wishIndex >= total - 1;
  }

  // Shows exactly one wish: the track slides to it, and the others are hidden
  // from screen readers and the keyboard. `announce` reads the new position
  // aloud for screen readers after a user action.
  function showWish(i, announce) {
    var slides = wishesList.children;
    if (!slides.length) return;
    wishIndex = Math.max(0, Math.min(i, slides.length - 1));
    wishesList.style.transform = "translateX(" + (-100 * wishIndex) + "%)";
    Array.prototype.forEach.call(slides, function (slide, n) {
      var current = n === wishIndex;
      slide.classList.toggle("is-current", current);
      slide.setAttribute("aria-hidden", String(!current));
      slide.inert = !current;
    });
    updateControls();
    if (announce) {
      var w = wishesAll[wishIndex];
      wishStatus.textContent = "Ucapan " + (wishIndex + 1) + " daripada " + slides.length + ": " + w.message + ", " + w.name;
    }
  }

  wishPrev.addEventListener("click", function () { showWish(wishIndex - 1, true); });
  wishNext.addEventListener("click", function () { showWish(wishIndex + 1, true); });
  wishDotStrip.addEventListener("click", function (e) {
    var dot = e.target.closest(".wish-carousel__dot");
    if (dot) showWish(Number(dot.dataset.index), true);
  });

  // Keyboard, while focus is on an arrow or a dot: ← → Home End.
  wishCarousel.addEventListener("keydown", function (e) {
    if (!e.target.closest(".wish-carousel__arrow, .wish-carousel__dot")) return;
    var last = wishesList.children.length - 1;
    var to = e.key === "ArrowLeft" ? wishIndex - 1
      : e.key === "ArrowRight" ? wishIndex + 1
      : e.key === "Home" ? 0
      : e.key === "End" ? last
      : null;
    if (to === null) return;
    e.preventDefault();
    showWish(to, true);
    if (e.target.closest(".wish-carousel__dot")) wishDotStrip.children[wishIndex].focus({ preventScroll: true });
  });

  // Touch swipe: left = next wish, right = previous. The viewport has
  // `touch-action: pan-y`, so vertical scrolling stays with the browser (it
  // cancels our gesture); only a clearly sideways drag moves the carousel.
  (function () {
    var viewport = wishCarousel.querySelector(".wish-carousel__viewport");
    var SLOP = 10;           // px of movement before deciding the direction
    var MIN_SWIPE = 50;      // px, or...
    var MIN_SWIPE_RATIO = 0.18; // ...this share of the width, whichever is larger
    var FLICK_SPEED = 0.45;  // px/ms: a quick flick counts even if short
    var EDGE_RESIST = 0.35;  // drag past the first/last wish only partly
    var drag = null;

    function setOffset(dx) {
      wishesList.style.transform = "translateX(calc(" + (-100 * wishIndex) + "% + " + dx + "px))";
    }

    function end(e, cancelled) {
      if (!drag || e.pointerId !== drag.id) return;
      var d = drag;
      drag = null;
      wishCarousel.classList.remove("is-dragging");
      if (!d.horizontal) return;
      var dx = e.clientX - d.x0;
      var speed = Math.abs(dx) / Math.max(1, e.timeStamp - d.t0);
      var far = Math.abs(dx) >= Math.max(MIN_SWIPE, d.width * MIN_SWIPE_RATIO);
      var flick = speed >= FLICK_SPEED && Math.abs(dx) >= 20;
      var step = !cancelled && (far || flick) ? (dx < 0 ? 1 : -1) : 0;
      showWish(wishIndex + step, step !== 0); // also snaps back when step is 0 or at an end
    }

    viewport.addEventListener("pointerdown", function (e) {
      if (e.pointerType === "mouse" || drag || wishesList.children.length < 2) return;
      drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, t0: e.timeStamp, width: viewport.clientWidth, horizontal: false };
    });

    viewport.addEventListener("pointermove", function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      var dx = e.clientX - drag.x0;
      var dy = e.clientY - drag.y0;
      if (!drag.horizontal) {
        if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return;
        if (Math.abs(dy) >= Math.abs(dx)) { drag = null; return; } // vertical: leave it to the page
        drag.horizontal = true;
        drag.x0 = e.clientX; // start following from here, so the slide doesn't jump
        drag.t0 = e.timeStamp;
        dx = 0;
        wishCarousel.classList.add("is-dragging");
        try { viewport.setPointerCapture(e.pointerId); } catch (err) { /* not critical */ }
      }
      var atEnd = (dx > 0 && wishIndex === 0) || (dx < 0 && wishIndex === wishesList.children.length - 1);
      setOffset(atEnd ? dx * EDGE_RESIST : dx);
    });

    viewport.addEventListener("pointerup", function (e) { end(e, false); });
    viewport.addEventListener("pointercancel", function (e) { end(e, true); });
  })();

  function renderWishes(list) {
    wishesAll = list;
    wishesList.replaceChildren.apply(wishesList, list.map(function (w, i) { return wishSlide(w, i, list.length); }));
    buildDots(list.length);
    wishCarousel.classList.toggle("is-single", list.length === 1); // no arrows or dots for one wish
    wishCarousel.hidden = list.length === 0;
    wishesNote.hidden = list.length > 0;
    wishesNote.textContent = list.length ? "" : WISHES_MSG_EMPTY;
    showWish(0); // newest first
  }

  function showWishesError() {
    if (wishesAll.length) return; // keep wishes already shown
    wishesNote.textContent = WISHES_MSG_ERROR;
    wishesNote.hidden = false;
  }

  function loadPublicSummary() {
    publicRequested = true;
    var controller = typeof AbortController === "function" ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, PUBLIC_TIMEOUT_MS) : null;

    fetch(GOOGLE_SCRIPT_URL, { method: "GET", redirect: "follow", signal: controller ? controller.signal : undefined })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (result) {
        if (!result || result.success !== true) throw new Error("Not available");
        if (!renderAttendance(result.attendance)) showAttendanceError();
        var wishes = cleanWishes(result.wishes);
        if (wishes) renderWishes(wishes); else showWishesError();
      })
      .catch(function () {
        showAttendanceError();
        showWishesError();
      })
      .then(function () {
        if (timer) clearTimeout(timer);
        attendanceStats.setAttribute("aria-busy", "false");
        wishesList.setAttribute("aria-busy", "false");
      });
  }

  // Fetch once, shortly before the Kehadiran section scrolls into view.
  if ("IntersectionObserver" in window) {
    var publicIo = new IntersectionObserver(function (entries) {
      if (!entries.some(function (e) { return e.isIntersecting; })) return;
      publicIo.disconnect();
      if (!publicRequested) loadPublicSummary();
    }, { rootMargin: "600px 0px" });
    publicIo.observe(document.getElementById("kehadiran"));
    publicIo.observe(document.getElementById("ucapan"));
  } else {
    loadPublicSummary();
  }

  /* ---------- Scroll-triggered reveals ---------- */

  // Photos get the curtain-style image reveal.
  document.querySelectorAll("#story .shot, .person__frame, .portrait__arch").forEach(function (el) {
    el.classList.add("img-reveal");
  });

  // Started when the invitation opens, so nothing animates unseen behind the cover.
  function startReveals() {
    var reveals = document.querySelectorAll(".reveal");
    var photos = document.querySelectorAll(".img-reveal");
    if (!("IntersectionObserver" in window)) {
      reveals.forEach(function (el) { el.classList.add("in-view"); });
      photos.forEach(function (el) { el.classList.add("in-view"); });
      return;
    }

    // A photo starts fully clipped (clip-path), so it has no visible area and
    // IntersectionObserver would never report it. Watch its unclipped parent
    // instead, and reveal the photo(s) inside when the parent comes into view.
    var photosByWatcher = new Map();
    photos.forEach(function (el) {
      var watcher = el.parentElement;
      if (!photosByWatcher.has(watcher)) photosByWatcher.set(watcher, []);
      photosByWatcher.get(watcher).push(el);
    });

    var io = new IntersectionObserver(function (entries) {
      var k = 0;
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        // Elements arriving together cascade gently instead of appearing at once.
        if (el.classList.contains("reveal")) {
          el.style.setProperty("--i", Math.min(k++, 5));
          el.classList.add("in-view");
        }
        (photosByWatcher.get(el) || []).forEach(function (photo) {
          photo.style.setProperty("--i", Math.min(k++, 5));
          photo.classList.add("in-view");
        });
        io.unobserve(el);
      });
    }, { threshold: 0.15, rootMargin: "0px 0px -8% 0px" });

    reveals.forEach(function (el) { io.observe(el); });
    photosByWatcher.forEach(function (_, watcher) { io.observe(watcher); });
  }

  /* ---------- Soft parallax ---------- */

  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var parallaxItems = [];
  var parallaxTicking = false;

  // [selector, speed, reference element]: offset follows the reference's distance from screen centre.
  [
    [".invitation .flora", 0.08, "section"],
    [".portrait, .person__photo", 0.05, "section"]
  ].forEach(function (cfg) {
    document.querySelectorAll(cfg[0]).forEach(function (el) {
      parallaxItems.push({ el: el, speed: cfg[1], ref: el.closest(cfg[2]) || el.parentElement });
    });
  });

  // Desktop backdrop sprigs drift slowly over the length of the whole page.
  var backdropSprigs = Array.prototype.slice.call(document.querySelectorAll(".bd-sprig"));

  function updateParallax() {
    parallaxTicking = false;
    var vh = window.innerHeight;
    var scrollable = document.documentElement.scrollHeight - vh;
    var progress = scrollable > 0 ? window.scrollY / scrollable : 0;
    backdropSprigs.forEach(function (s) {
      var drift = parseFloat(s.dataset.drift) || 0;
      s.style.setProperty("--py", ((progress - 0.5) * -2 * drift).toFixed(1) + "px");
    });
    parallaxItems.forEach(function (p) {
      var r = p.ref.getBoundingClientRect();
      if (r.bottom < -120 || r.top > vh + 120) return; // off-screen: skip
      var offset = -((r.top + r.height / 2) - vh / 2) * p.speed;
      p.el.style.setProperty("--py", Math.max(-40, Math.min(40, offset)).toFixed(1) + "px");
    });
  }
  function requestParallax() {
    if (!parallaxTicking) {
      parallaxTicking = true;
      requestAnimationFrame(updateParallax);
    }
  }
  if (!reduceMotion) {
    window.addEventListener("scroll", requestParallax, { passive: true });
    window.addEventListener("resize", requestParallax);
    updateParallax();
  }

  /* ---------- Background flora & butterflies: animate only while on screen ---------- */

  // Each decoration layer pauses (CSS .is-idle) when it is off screen, so only
  // the one or two layers in view use the CPU. Paused animations resume exactly
  // where they were, so there is never a jump.
  if (!reduceMotion && "IntersectionObserver" in window) {
    var decorIo = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        entry.target.classList.toggle("is-idle", !entry.isIntersecting);
      });
    }, { rootMargin: "150px 0px" });
    document.querySelectorAll(".butterflies, .fleurs").forEach(function (layer) {
      decorIo.observe(layer);
    });
  }

  /* ---------- Navigation ---------- */

  var navToggle = document.getElementById("navToggle");
  var nav = document.getElementById("nav");
  var navLinks = Array.prototype.slice.call(nav.querySelectorAll(".nav__link"));

  function setNav(open) {
    nav.classList.toggle("is-open", open);
    nav.setAttribute("aria-hidden", String(!open));
    nav.inert = !open;
    body.classList.toggle("nav-open", open);
    navToggle.setAttribute("aria-expanded", String(open));
    navToggle.setAttribute("aria-label", open ? "Tutup menu" : "Buka menu");
    if (open) navLinks[0].focus({ preventScroll: true });
  }

  navToggle.addEventListener("click", function () {
    setNav(!nav.classList.contains("is-open"));
  });
  nav.querySelector("[data-nav-close]").addEventListener("click", function () { setNav(false); });

  navLinks.forEach(function (link) {
    link.addEventListener("click", function (e) {
      var target = document.querySelector(link.getAttribute("href"));
      if (!target) return;
      e.preventDefault();
      setNav(false); // unlocks scrolling first
      target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
      navToggle.focus({ preventScroll: true });
    });
  });

  document.addEventListener("keydown", function (e) {
    if (!nav.classList.contains("is-open")) return;
    if (e.key === "Escape") {
      setNav(false);
      navToggle.focus();
    } else if (e.key === "Tab") { // cycle between the toggle and the links
      var items = [navToggle].concat(navLinks);
      var i = items.indexOf(document.activeElement);
      var next = e.shiftKey ? (i <= 0 ? items.length - 1 : i - 1) : (i === items.length - 1 ? 0 : i + 1);
      e.preventDefault();
      items[next].focus();
    }
  });

  // Highlight the menu item for the section currently in view.
  var NAV_FOR_SECTION = {
    hero: "hero", couple: "hero", family: "hero", countdown: "hero",
    details: "details", timeline: "timeline",
    story: "story",
    "rsvp-form": "rsvp-form", kehadiran: "rsvp-form", ucapan: "rsvp-form",
    rsvp: "rsvp-form", share: "rsvp-form", closing: "rsvp-form"
  };
  if ("IntersectionObserver" in window) {
    var navIo = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var id = NAV_FOR_SECTION[entry.target.id];
        navLinks.forEach(function (link) {
          if (link.getAttribute("href") === "#" + id) link.setAttribute("aria-current", "true");
          else link.removeAttribute("aria-current");
        });
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    Object.keys(NAV_FOR_SECTION).forEach(function (id) {
      var s = document.getElementById(id);
      if (s) navIo.observe(s);
    });
  }
})();
