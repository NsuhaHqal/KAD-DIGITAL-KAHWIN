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

  /* ---------- Phase 1: open invitation (envelope) ---------- */

  // Tapping the envelope: the music starts straight away (it must start inside
  // the tap) and the invitation appears at once — no opening animation.
  function openInvitation() {
    if (openBtn.disabled) return;
    openBtn.disabled = true;
    startMusic();
    revealInvitation();
  }

  function revealInvitation() {
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
    setTimeout(removeCover, 1000); // fallback (e.g. reduced motion)
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

  // The song on the opening page: plays/pauses the same music and mirrors its state.
  var heroMusic = document.getElementById("heroMusic");
  if (heroMusic) {
    heroMusic.addEventListener("click", function () {
      if (music.classList.contains("is-playing")) pauseMusic();
      else startMusic();
    });
    var syncHeroMusic = function () {
      var playing = music.classList.contains("is-playing");
      heroMusic.classList.toggle("is-playing", playing);
      heroMusic.setAttribute("aria-pressed", String(playing));
      heroMusic.setAttribute("aria-label", "Muzik: La Vie En Rose oleh Emily Watts. " + (playing ? "Jeda" : "Main"));
    };
    new MutationObserver(syncHeroMusic).observe(music, { attributes: true, attributeFilter: ["class"] });
    syncHeroMusic();
  }

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

  /* ---------- Phase 7: WhatsApp ---------- */

  document.getElementById("whatsappLink").href =
    "https://wa.me/" + WHATSAPP_NUMBER + "?text=" + encodeURIComponent(WHATSAPP_TEXT);

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

  // RSVP envelope: the form waits behind an envelope; tapping it plays a short
  // opening (CSS .is-opening) and the form appears in its place. The form
  // itself is unchanged. Without JavaScript the form simply shows.
  var rsvpGate = document.getElementById("rsvpGate");
  var rsvpGateBtn = document.getElementById("rsvpGateBtn");
  if (rsvpGate && rsvpGateBtn) {
    rsvpForm.hidden = true;
    rsvpGate.hidden = false;
    rsvpGateBtn.addEventListener("click", function () {
      if (rsvpGate.classList.contains("is-opening")) return;
      rsvpGate.classList.add("is-opening");
      rsvpGateBtn.setAttribute("aria-expanded", "true");
      var instant = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      setTimeout(function () {
        rsvpGate.hidden = true;
        rsvpForm.hidden = false;
        rsvpForm.focus({ preventScroll: true }); // keep keyboard/screen-reader users in place
      }, instant ? 0 : 950);
    });
  }

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
        loadPublicSummary(); // the wishes below now include this RSVP
      })
      .catch(function () {
        // Keep what the guest typed so they can simply try again.
        showRsvpError(true);
        setSubmitting(false);
      });
  });

  /* ---------- Ucapan: live public wishes ---------- */

  // One read from the Apps Script's read-only endpoint (a GET to GOOGLE_SCRIPT_URL),
  // which returns only { attendance: { hadir, tidakHadir }, wishes: [{ name, message }] }
  // (wishes already newest first, empty messages already left out). Only the
  // wishes are shown on the page.
  var wishList = document.getElementById("wishList");     // the scrolling box
  var wishesList = document.getElementById("wishesList"); // the list inside it
  var wishesNote = document.getElementById("wishesNote");
  var PUBLIC_TIMEOUT_MS = 20000;
  var WISH_NAME_MAX = 80;        // same limits as the form
  var WISH_MESSAGE_MAX = 300;
  var WISHES_MSG_EMPTY = "Belum ada ucapan.";
  var WISHES_MSG_ERROR = "Ucapan tidak dapat dipaparkan buat masa ini.";
  var publicRequested = false;
  var wishesAll = [];

  // Only name + message are kept; anything else in the reply is ignored.
  function cleanWishes(list) {
    if (!Array.isArray(list)) return null;
    return list.map(function (w) {
      var name = w && typeof w.name === "string" ? w.name.trim().slice(0, WISH_NAME_MAX) : "";
      var message = w && typeof w.message === "string" ? w.message.trim().slice(0, WISH_MESSAGE_MAX) : "";
      return { name: name, message: message };
    }).filter(function (w) { return w.name && w.message; });
  }

  // One wish: the message, then the guest's name — both as plain text.
  function wishItem(w) {
    var li = document.createElement("li");
    // Short wishes are set large; longer ones step down so they stay graceful.
    li.className = "wish" + (w.message.length > 160 ? " wish--long" : w.message.length > 70 ? " wish--medium" : "");
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

  // All the wishes in one list that scrolls down; the soft fade at the
  // bottom edge goes once the end is reached.
  function updateWishFade() {
    var scrollable = wishList.scrollHeight > wishList.clientHeight + 2;
    wishList.classList.toggle("is-scrollable", scrollable);
    wishList.classList.toggle("is-end", !scrollable || wishList.scrollTop + wishList.clientHeight >= wishList.scrollHeight - 2);
  }
  wishList.addEventListener("scroll", updateWishFade, { passive: true });
  window.addEventListener("resize", updateWishFade);

  function renderWishes(list) {
    wishesAll = list;
    wishesList.replaceChildren.apply(wishesList, list.map(wishItem));
    wishList.hidden = list.length === 0;
    wishList.scrollTop = 0; // newest first
    wishesNote.hidden = list.length > 0;
    wishesNote.textContent = list.length ? "" : WISHES_MSG_EMPTY;
    updateWishFade();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(updateWishFade);
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
        var wishes = cleanWishes(result.wishes);
        if (wishes) renderWishes(wishes); else showWishesError();
      })
      .catch(function () {
        showWishesError();
      })
      .then(function () {
        if (timer) clearTimeout(timer);
        wishesList.setAttribute("aria-busy", "false");
      });
  }

  // Fetch once, shortly before the Ucapan section scrolls into view.
  if ("IntersectionObserver" in window) {
    var publicIo = new IntersectionObserver(function (entries) {
      if (!entries.some(function (e) { return e.isIntersecting; })) return;
      publicIo.disconnect();
      if (!publicRequested) loadPublicSummary();
    }, { rootMargin: "600px 0px" });
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
    hero: "hero", countdown: "hero",
    details: "details", timeline: "timeline", note: "timeline",
    "rsvp-form": "rsvp-form", ucapan: "rsvp-form", rsvp: "rsvp-form"
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
