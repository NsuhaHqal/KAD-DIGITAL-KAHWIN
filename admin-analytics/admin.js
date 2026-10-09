(function () {
  "use strict";

  /* ---------- Config ---------- */

  // The invitation's Apps Script web app (the same one as js/main.js). The
  // admin PIN is checked there (never here); every record comes from the sheet.
  var SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwdTzKJSuX50N_fOUm82Tgd9Ga0zTpfl5z37Ylzro9Vu__T_Di20K0570jsI-ofo4Wtzw/exec";
  var TOKEN_KEY = "rsvpAdminToken";      // this tab only (sessionStorage), never localStorage
  var REQUEST_TIMEOUT_MS = 25000;
  var AUTO_REFRESH_MS = 60000;            // while the page is open and visible
  var TIME_ZONE = "Asia/Kuala_Lumpur";

  var $ = function (id) { return document.getElementById(id); };
  var loginView = $("login"), dashView = $("dash");
  var loginForm = $("loginForm"), loginBtn = $("loginBtn"), loginBtnLabel = $("loginBtnLabel"), loginMsg = $("loginMsg");
  var pinBox = $("pin"), pinInputs = Array.prototype.slice.call(document.querySelectorAll(".pin__box"));

  var state = { records: [], limit: null, generatedAt: null, sort: { key: "timestamp", dir: "desc" }, loading: false };
  var refreshTimer = null;

  /* ---------- Session (this browser tab only) ---------- */

  function getToken() { try { return sessionStorage.getItem(TOKEN_KEY); } catch (e) { return null; } }
  function setToken(t) { try { if (t) sessionStorage.setItem(TOKEN_KEY, t); else sessionStorage.removeItem(TOKEN_KEY); } catch (e) { /* private mode */ } }

  /* ---------- Requests to the Apps Script ---------- */

  // POST as text/plain (a "simple" request the Apps Script can answer).
  function api(action, extra) {
    var payload = { action: action };
    for (var k in extra) payload[k] = extra[k];
    var controller = typeof AbortController === "function" ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, REQUEST_TIMEOUT_MS) : null;
    return fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
      redirect: "follow",
      cache: "no-store",
      signal: controller ? controller.signal : undefined
    })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (json) { if (timer) clearTimeout(timer); return json; },
            function (err) { if (timer) clearTimeout(timer); throw err; });
  }

  /* ---------- Admin access: the 6-digit PIN ---------- */
  // Six masked positions, digits only. The PIN is only ever sent, whole, to
  // the Apps Script, which accepts or rejects it — nothing here can tell
  // whether any single digit is right. It is never stored, and the boxes are
  // cleared as soon as it has been sent.

  function pinValue() { return pinInputs.map(function (i) { return i.value; }).join(""); }
  function clearPin() { pinInputs.forEach(function (i) { i.value = ""; i.classList.remove("is-filled"); }); updatePinButton(); }
  function updatePinButton() { loginBtn.disabled = !/^\d{6}$/.test(pinValue()) || loginBtn.classList.contains("is-loading"); }
  function setPinMessage(text) {
    loginMsg.textContent = text || "";
    loginMsg.hidden = !text;
    pinBox.classList.toggle("is-error", !!text);
  }
  function fillFrom(start, digits) {
    var k = start;
    for (var n = 0; n < digits.length && k < pinInputs.length; n++, k++) {
      pinInputs[k].value = digits[n];
      pinInputs[k].classList.add("is-filled");
    }
    (pinInputs[Math.min(k, pinInputs.length - 1)]).focus();
    updatePinButton();
  }

  pinInputs.forEach(function (input, i) {
    input.addEventListener("input", function () {
      var digits = input.value.replace(/\D/g, "");
      input.value = "";
      input.classList.remove("is-filled");
      if (digits) fillFrom(i, digits.split("")); // a digit (or several, e.g. from autofill)
      else updatePinButton();
      if (!loginMsg.hidden) setPinMessage("");
    });
    input.addEventListener("keydown", function (e) {
      if (e.key === "Backspace" && !input.value && i > 0) {
        e.preventDefault();
        pinInputs[i - 1].value = "";
        pinInputs[i - 1].classList.remove("is-filled");
        pinInputs[i - 1].focus();
        updatePinButton();
      } else if (e.key === "ArrowLeft" && i > 0) {
        e.preventDefault(); pinInputs[i - 1].focus();
      } else if (e.key === "ArrowRight" && i < pinInputs.length - 1) {
        e.preventDefault(); pinInputs[i + 1].focus();
      } else if (e.key.length === 1 && !/\d/.test(e.key) && !e.ctrlKey && !e.metaKey) {
        e.preventDefault(); // letters and symbols are never accepted
      }
    });
    input.addEventListener("paste", function (e) {
      var text = (e.clipboardData || window.clipboardData).getData("text") || "";
      var digits = text.replace(/\D/g, "").slice(0, 6);
      e.preventDefault();
      if (digits) fillFrom(i, digits.split(""));
    });
    input.addEventListener("focus", function () { input.select(); });
  });

  function setLoading(on) {
    loginBtn.classList.toggle("is-loading", on);
    loginBtnLabel.textContent = on ? "Verifying…" : "Access Dashboard";
    pinInputs.forEach(function (i) { i.disabled = on; });
    loginForm.setAttribute("aria-busy", String(on));
    updatePinButton();
  }

  function showLogin(message) {
    stopAutoRefresh();
    if (agoTimer) { clearInterval(agoTimer); agoTimer = null; }
    state.records = [];
    clear($("recordsBody"));
    clear($("wishesList"));
    if (greetingModal.open) closeGreeting();
    dashView.hidden = true;
    loginView.hidden = false;
    clearPin();
    setPinMessage(message || "");
    pinInputs[0].focus();
  }

  function showDashboard() {
    loginView.hidden = true;
    dashView.hidden = false;
    fitSideFlutter();
  }

  loginForm.addEventListener("submit", function (e) {
    e.preventDefault();
    if (loginBtn.classList.contains("is-loading")) return;
    var pin = pinValue();
    if (!/^\d{6}$/.test(pin)) { setPinMessage("Please enter all 6 digits of your PIN."); return; }
    setPinMessage("");
    setLoading(true);
    clearPin(); // the PIN is not kept on the page while it is checked
    api("adminLogin", { pin: pin })
      .then(function (res) {
        if (!res || res.success !== true || !res.token) {
          setPinMessage((res && res.message) || "Incorrect PIN. Please try again.");
          pinBox.classList.remove("is-shake"); void pinBox.offsetWidth; pinBox.classList.add("is-shake");
          return;
        }
        setToken(res.token);
        showDashboard();
        loadData();
      })
      .catch(function () {
        setPinMessage("Unable to connect. Please check your internet connection and try again.");
      })
      .then(function () {
        pin = "";
        setLoading(false);
        if (!loginView.hidden) pinInputs[0].focus();
      });
  });

  $("logoutBtn").addEventListener("click", function () {
    var token = getToken();
    setToken(null);
    if (token) api("adminLogout", { token: token }).catch(function () {});
    showLogin("");
  });

  $("refreshBtn").addEventListener("click", function () { loadData(); });

  /* ---------- Data ---------- */

  function setRefreshing(on) {
    var top = $("refreshBtn");
    top.disabled = on;
    top.classList.toggle("is-loading", on);
    $("refreshBtnLabel").textContent = on ? "Refreshing…" : "Refresh";
    $("sideStatus").parentNode.classList.toggle("is-loading", on);
    var b = $("recordsRefresh");
    b.disabled = on;
    b.classList.toggle("is-loading", on);
    $("recordsRefreshLabel").textContent = on ? "Refreshing…" : "Refresh";
  }

  function loadData() {
    var token = getToken();
    if (!token) { showLogin(""); return; }
    if (state.loading) return;
    state.loading = true;
    setRefreshing(true);
    if (!state.generatedAt) setUpdated(null, "Loading…");
    api("adminData", { token: token })
      .then(function (res) {
        if (res && res.code === "admin_session") { setToken(null); showLogin(res.message); return; }
        if (res && res.success === false && res.message) {
          // the Apps Script reached the sheet but couldn't read it (tab or
          // header missing, sheet unavailable): say exactly what it said
          showError(res.message);
          return;
        }
        if (!res || res.success !== true || !Array.isArray(res.records)) throw new Error("No data");
        state.records = res.records.map(cleanRecord);
        state.source = res.source || null;
        state.limit = Number(res.limit) > 0 ? Number(res.limit) : null; // the limit the Apps Script enforces
        state.generatedAt = res.generatedAt ? new Date(res.generatedAt) : new Date();
        $("banner").hidden = true;
        $("sideStatus").parentNode.classList.remove("is-stale");
        render();
        scheduleAutoRefresh();
      })
      .catch(function () {
        showError("The Google Sheet couldn't be reached. Check your internet connection, then press Refresh.");
      })
      .then(function () {
        state.loading = false;
        setRefreshing(false);
      });
  }

  // A problem reaching or reading the sheet: a clear notice at the top. Any
  // figures already on the page stay, marked with when they were read.
  function showError(text) {
    $("banner").textContent = text + (state.generatedAt ? " The figures shown are from " + formatTime(state.generatedAt) + "." : "");
    $("banner").hidden = false;
    $("sideStatus").parentNode.classList.add("is-stale");
    setUpdated(state.generatedAt, "Not loaded yet");
  }

  // "Last refreshed": the time the Apps Script read the sheet, and how long ago
  var agoTimer = null;
  function setUpdated(when, fallback) {
    var t = $("updated");
    t.textContent = when ? formatTime(when) : fallback || "—";
    if (when) t.setAttribute("datetime", when.toISOString()); else t.removeAttribute("datetime");
    updateAgo();
    if (!agoTimer) agoTimer = setInterval(updateAgo, 30000);
  }
  function updateAgo() {
    var when = state.generatedAt, el = $("updatedAgo");
    if (!when) { el.textContent = ""; return; }
    var mins = Math.floor((Date.now() - when.getTime()) / 60000);
    el.textContent = mins < 1 ? "just now" : mins < 60 ? plural(mins, "minute") + " ago" : "over an hour ago";
  }

  function cleanRecord(r) {
    var count = function (v) { var n = Number(v); return isFinite(n) && n >= 0 ? Math.round(n) : 0; };
    var text = function (v) { return v === undefined || v === null ? "" : String(v); };
    var adults = count(r.adults), children = count(r.children);
    var total = count(r.total) || adults + children;
    var time = r.timestamp ? new Date(r.timestamp) : null;
    return {
      row: count(r.row),
      time: time && !isNaN(time) ? time : null,
      timestamp: time && !isNaN(time) ? time.getTime() : 0,
      name: text(r.name),
      attendance: text(r.attendance),
      adults: adults,
      children: children,
      total: total,
      message: text(r.message),
      email: text(r.email)
    };
  }

  function scheduleAutoRefresh() {
    stopAutoRefresh();
    refreshTimer = setTimeout(function () {
      if (document.visibilityState === "visible" && !dashView.hidden) loadData();
      else scheduleAutoRefresh();
    }, AUTO_REFRESH_MS);
  }
  function stopAutoRefresh() { if (refreshTimer) clearTimeout(refreshTimer); refreshTimer = null; }
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible" && !dashView.hidden && getToken() && state.generatedAt &&
        Date.now() - state.generatedAt.getTime() > AUTO_REFRESH_MS) loadData();
  });

  /* ---------- Formatting ---------- */

  var fmtTime = new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
  var fmtDayKey = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });
  function formatTime(d) { return d ? fmtTime.format(d) : "—"; }
  function pct(part, whole) { return whole ? Math.round((part / whole) * 100) : 0; }

  /* ---------- Render ---------- */

  // The overview figures, all worked out from the valid RSVP records read
  // from the sheet (nothing is fixed in the page; the limit comes from the
  // Apps Script). Expected attendees, adults and children count attending
  // (Hadir) RSVPs only.
  function overview(recs, limit) {
    var hadir = recs.filter(function (r) { return r.attendance === "Hadir"; });
    var tidak = recs.filter(function (r) { return r.attendance === "Tidak Hadir"; });
    var sum = function (list, key) { return list.reduce(function (a, r) { return a + r[key]; }, 0); };
    var total = recs.length;
    return {
      hadirList: hadir,
      tidakList: tidak,
      total: total,
      attending: hadir.length,
      notAttending: tidak.length,
      expected: sum(hadir, "total"),
      adults: sum(hadir, "adults"),
      children: sum(hadir, "children"),
      limit: limit,
      remaining: limit ? Math.max(0, limit - total) : null
    };
  }

  function render() {
    var recs = state.records;
    var o = overview(recs, state.limit);

    setUpdated(state.generatedAt);
    renderSource();

    // ---- Overview ----
    $("kTotal").textContent = o.total;
    $("kHadir").textContent = o.attending;
    $("kHadirNote").textContent = "marked Hadir · " + pct(o.attending, o.total) + "% of RSVPs";
    $("kTidak").textContent = o.notAttending;
    $("kTidakNote").textContent = "marked Tidak Hadir · " + pct(o.notAttending, o.total) + "% of RSVPs";
    $("kGuests").textContent = o.expected;
    $("kAdults").textContent = o.adults;
    $("kChildren").textContent = o.children;
    var meter = $("qMeter");
    if (o.limit) {
      $("kCapacity").textContent = o.total + " / " + o.limit;
      meter.setAttribute("aria-valuemax", String(o.limit));
      meter.setAttribute("aria-valuenow", String(o.total));
      meter.classList.toggle("is-full", o.total >= o.limit);
      $("qFill").style.width = Math.min(100, pct(o.total, o.limit)) + "%";
      $("kCapacityNote").textContent = o.total >= o.limit ? "Full — the RSVP form is closed" : pct(o.total, o.limit) + "% of capacity used";
      $("kLeft").textContent = o.remaining;
      $("kLeftNote").textContent = o.remaining === 0 ? "RSVP closed to new guests" : "submissions can still be accepted";
    } else {
      $("kCapacity").textContent = o.total + " / –";
      $("kCapacityNote").textContent = "limit not reported by the Apps Script";
      $("kLeft").textContent = "–";
      $("kLeftNote").textContent = "";
    }

    drawCharts();
    renderTable();
    renderUcapan();
  }

  // Where the figures come from: the tab, the columns found by their headers,
  // and any rows left out because they aren't complete RSVPs.
  function renderSource() {
    var s = state.source, el = $("sourceNote");
    if (!s || !el) return;
    var names = { timestamp: "Timestamp", name: "Nama", attendance: "Kehadiran", adults: "Jumlah Dewasa", children: "Jumlah Kanak-kanak", total: "Jumlah Tetamu", message: "Ucapan", email: "Emel" };
    var cols = Object.keys(names).filter(function (k) { return s.columns && s.columns[k]; })
      .map(function (k) { return s.columns[k].header + " (" + s.columns[k].column + ")"; });
    var absent = Object.keys(names).filter(function (k) { return !(s.columns && s.columns[k]); }).map(function (k) { return names[k]; });
    var text = "Source: Google Sheet, " + (s.tab || "RSVP") + " tab · columns: " + cols.join(", ");
    if (absent.length) text += " · not in the sheet: " + absent.join(", ");
    if (s.skippedRows) text += " · " + plural(s.skippedRows, "incomplete row") + " not counted";
    el.textContent = text + ".";
  }

  /* ---------- Charts (plain SVG/HTML, no libraries) ---------- */
  // Every chart is drawn from state.records (the valid RSVPs read from the
  // sheet) and redrawn on each refresh. Nothing is filled in: a record with
  // no readable timestamp is left out of the trend, and only "Hadir" and
  // "Tidak Hadir" count as attendance.

  var SVG = "http://www.w3.org/2000/svg";
  var COLOR = { yes: "#1c2b52", no: "#a9bcdc", adults: "#1c2b52", children: "#7f97c6", track: "#e8eef8" };
  function svgEl(name, attrs, text) {
    var el = document.createElementNS(SVG, name);
    for (var k in attrs) el.setAttribute(k, attrs[k]);
    if (text !== undefined) el.textContent = text;
    return el;
  }
  function htmlEl(name, cls, text) {
    var el = document.createElement(name);
    if (cls) el.className = cls;
    if (text !== undefined) el.textContent = text;
    return el;
  }
  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); }
  function plural(n, one, many) { return n + " " + (n === 1 ? one : (many || one + "s")); }
  function setNote(id, text) { var el = $(id); el.textContent = text || ""; el.hidden = !text; }
  function emptyChart(box, text) { clear(box); box.appendChild(htmlEl("p", "chart-empty", text)); }
  function legend(target, items) {
    var ul = typeof target === "string" ? $(target) : target;
    clear(ul);
    items.forEach(function (it) {
      var li = htmlEl("li");
      var sw = htmlEl("i", it.line ? "legend__line" : ""); sw.style.background = it.color;
      li.appendChild(sw);
      li.appendChild(htmlEl("span", "", it.label));
      if (it.value !== undefined) li.appendChild(htmlEl("b", "", String(it.value)));
      ul.appendChild(li);
    });
  }
  // Axis steps for whole-number counts: 1, 2, 5, 10, 20, 50 …
  function niceScale(max, ticks) {
    max = Math.max(1, max);
    var raw = max / (ticks || 4), mag = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10)), step = 1;
    [1, 2, 5, 10].some(function (m) { step = Math.max(1, m * mag); return step >= raw; });
    return { step: step, max: Math.ceil(max / step) * step };
  }
  function chartWidth(box, min) { return Math.max(min || 260, Math.round(box.clientWidth || 600)); }

  /* Tooltips: hover with a mouse, tap on a phone, or Tab to a mark */
  var tip = $("chartTip"), tipFor = null;
  function addTip(el, text) {
    el.setAttribute("data-tip", text);
    el.setAttribute("tabindex", "0");
    el.setAttribute("aria-label", text.replace(/\n/g, ", "));
  }
  function showTip(el, x, y) {
    if (tipFor && tipFor !== el) tipFor.classList.remove("is-active");
    tipFor = el;
    el.classList.add("is-active");
    tip.textContent = el.getAttribute("data-tip");
    tip.hidden = false;
    if (x === undefined) { var r = el.getBoundingClientRect(); x = r.left + r.width / 2; y = r.top; }
    var w = tip.offsetWidth, h = tip.offsetHeight;
    var top = y - h - 12;
    if (top < 8) top = y + 18;
    tip.style.left = Math.min(Math.max(8, x - w / 2), window.innerWidth - w - 8) + "px";
    tip.style.top = top + "px";
  }
  function hideTip() {
    if (tipFor) tipFor.classList.remove("is-active");
    tipFor = null;
    tip.hidden = true;
  }
  function tipTarget(e) { var t = e.target; return t && t.closest ? t.closest("[data-tip]") : null; }
  document.addEventListener("pointermove", function (e) {
    if (e.pointerType !== "mouse") return;
    var el = tipTarget(e);
    if (el) showTip(el, e.clientX, e.clientY);
    else if (tipFor && tipFor !== document.activeElement) hideTip();
  });
  document.addEventListener("pointerdown", function (e) {
    if (e.pointerType === "mouse") return;
    var el = tipTarget(e);
    if (el) showTip(el, e.clientX, e.clientY); else hideTip();
  });
  document.documentElement.addEventListener("pointerleave", function () { if (tipFor && tipFor !== document.activeElement) hideTip(); });
  document.addEventListener("focusin", function (e) { var el = tipTarget(e); if (el) showTip(el); });
  document.addEventListener("focusout", function (e) { if (tipTarget(e) && tipTarget(e) === tipFor) hideTip(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") hideTip(); });
  // on scroll the tooltip stays with its mark, and goes once the mark is off screen
  window.addEventListener("scroll", function () {
    if (!tipFor) return;
    var r = tipFor.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight || !tipFor.isConnected) hideTip();
    else showTip(tipFor);
  }, { passive: true });

  function drawCharts() {
    hideTip();
    var recs = state.records, o = overview(recs, state.limit);
    drawCapacity(o);
    drawAttendance(o, recs.length - o.attending - o.notAttending);
    drawSummary(o);
    drawAges(o);
    drawTrend(recs);
  }

  // 5. RSVP capacity progress: accepted submissions out of the limit
  function drawCapacity(o) {
    var box = $("capacityChart");
    clear(box);
    if (!o.limit) {
      $("capFigure").textContent = String(o.total);
      $("capSub").textContent = "Accepted submissions";
      emptyChart(box, "Progress can't be shown: the Apps Script didn't report the submission limit.");
      return;
    }
    var full = o.total >= o.limit, used = pct(o.total, o.limit);
    $("capFigure").textContent = o.total + " / " + o.limit;
    $("capSub").textContent = "Accepted submissions out of the " + o.limit + "-submission limit";

    var track = htmlEl("div", "progress__track" + (full ? " is-full" : ""));
    track.setAttribute("role", "progressbar");
    track.setAttribute("aria-label", "RSVP capacity");
    track.setAttribute("aria-valuemin", "0");
    track.setAttribute("aria-valuemax", String(o.limit));
    track.setAttribute("aria-valuenow", String(Math.min(o.total, o.limit)));
    var fill = htmlEl("span", "progress__fill");
    fill.style.width = Math.min(100, (o.total / o.limit) * 100) + "%";
    addTip(fill, "Accepted: " + plural(o.total, "submission") + "\n" + used + "% of the " + o.limit + "-submission limit");
    var rest = htmlEl("span", "progress__rest");
    addTip(rest, "Remaining: " + plural(o.remaining, "slot") + "\n" + (full ? "The RSVP form is closed" : "New RSVPs can still be accepted"));
    track.appendChild(fill);
    if (!full) track.appendChild(rest);
    box.appendChild(track);

    var scale = htmlEl("div", "progress__scale");
    scale.setAttribute("aria-hidden", "true");
    [0, 0.25, 0.5, 0.75, 1].forEach(function (f) {
      var t = htmlEl("span", "progress__tick", String(Math.round(o.limit * f)));
      t.style.left = f * 100 + "%";
      scale.appendChild(t);
    });
    box.appendChild(scale);

    var foot = htmlEl("div", "progress__foot");
    var ul = htmlEl("ul", "legend legend--inline");
    legend(ul, [
      { label: "Accepted", value: o.total, color: full ? "#a3424f" : COLOR.yes },
      { label: "Remaining", value: o.remaining, color: "#dfe5f0" }
    ]);
    foot.appendChild(ul);
    foot.appendChild(htmlEl("p", "progress__status" + (full ? " is-full" : ""),
      full ? "Full — the RSVP form is closed" : used + "% of capacity used"));
    box.appendChild(foot);
  }

  // 1. Attendance breakdown: Hadir vs Tidak Hadir (doughnut)
  function drawAttendance(o, unknown) {
    var svg = $("attendanceChart");
    clear(svg);
    var total = o.attending + o.notAttending, r = 46, c = 2 * Math.PI * r;
    svg.setAttribute("role", "group");
    svg.setAttribute("aria-label", "Attendance breakdown: " + o.attending + " Hadir, " + o.notAttending + " Tidak Hadir");
    svg.appendChild(svgEl("circle", { "class": "donut__track", cx: 60, cy: 60, r: r }));
    var parts = [
      { label: "Hadir", desc: "Attending", value: o.attending, color: COLOR.yes },
      { label: "Tidak Hadir", desc: "Not attending", value: o.notAttending, color: COLOR.no }
    ];
    var offset = 0;
    parts.forEach(function (p) {
      if (!total || !p.value) return;
      var len = (p.value / total) * c;
      var seg = svgEl("circle", {
        "class": "donut__seg", cx: 60, cy: 60, r: r, stroke: p.color,
        "stroke-dasharray": len + " " + (c - len), "stroke-dashoffset": String(-offset),
        transform: "rotate(-90 60 60)"
      });
      addTip(seg, p.label + " (" + p.desc.toLowerCase() + ")\n" + plural(p.value, "RSVP submission") + " · " + pct(p.value, total) + "%");
      svg.appendChild(seg);
      offset += len;
    });
    svg.appendChild(svgEl("text", { "class": "donut__big", x: 60, y: 63 }, String(total)));
    svg.appendChild(svgEl("text", { "class": "donut__small", x: 60, y: 76 }, total === 1 ? "RSVP" : "RSVPs"));
    legend("attendanceLegend", parts.map(function (p) {
      return { label: p.label, color: p.color, value: p.value + " (" + pct(p.value, total) + "%)" };
    }));
    setNote("attendanceNote", !total ? "No RSVP submissions yet."
      : unknown ? plural(unknown, "submission") + " without a recognised attendance value " + (unknown === 1 ? "isn't" : "aren't") + " shown." : "");
  }

  // Horizontal bars, drawn at the box's own width so text keeps its real size
  function drawHBarChart(box, rows, maxValue, label) {
    clear(box);
    var W = chartWidth(box, 260), labelW = Math.min(118, Math.round(W * 0.34)), R = 74;
    var barH = 26, gap = 22, T = 6, B = 22;
    var H = T + rows.length * barH + (rows.length - 1) * gap + 10 + B;
    var x0 = labelW, w = W - labelW - R, sc = niceScale(maxValue, 4);
    var svg = svgEl("svg", { viewBox: "0 0 " + W + " " + H, width: W, height: H, role: "group", "aria-label": label });
    for (var v = 0; v <= sc.max; v += sc.step) {
      var gx = x0 + (v / sc.max) * w;
      svg.appendChild(svgEl("line", { "class": v ? "grid" : "axis", x1: gx, y1: T - 2, x2: gx, y2: H - B + 2 }));
      svg.appendChild(svgEl("text", { "class": "tick tick--mid", x: gx, y: H - 6 }, String(v)));
    }
    rows.forEach(function (row, i) {
      var y = T + i * (barH + gap);
      var g = svgEl("g", { "class": "mark" });
      g.appendChild(svgEl("rect", { "class": "hit", x: 0, y: y - gap / 2, width: W, height: barH + gap }));
      g.appendChild(svgEl("rect", { "class": "mark__bar", x: x0, y: y, width: Math.max(0, (row.value / sc.max) * w), height: barH, rx: 4, fill: row.color }));
      g.appendChild(svgEl("text", { "class": "label", x: 0, y: y + 12 }, row.label));
      g.appendChild(svgEl("text", { "class": "label label--sub", x: 0, y: y + 26 }, row.sub));
      g.appendChild(svgEl("text", { "class": "value", x: x0 + (row.value / sc.max) * w + 8, y: y + barH / 2 + 5 }, row.valueText));
      addTip(g, row.tip);
      svg.appendChild(g);
    });
    box.appendChild(svg);
  }

  // 4. Guest attendance summary: attending vs not attending submissions
  function drawSummary(o) {
    var box = $("summaryChart"), total = o.attending + o.notAttending;
    legend("summaryLegend", [
      { label: "Attending", value: o.attending, color: COLOR.yes },
      { label: "Not attending", value: o.notAttending, color: COLOR.no }
    ]);
    if (!total) {
      emptyChart(box, "No RSVP submissions yet.");
      setNote("summaryNote", "");
      return;
    }
    drawHBarChart(box, [
      { label: "Attending", sub: "Hadir", value: o.attending, color: COLOR.yes,
        valueText: o.attending + " · " + pct(o.attending, total) + "%",
        tip: "Attending (Hadir)\n" + plural(o.attending, "RSVP submission") + " · " + pct(o.attending, total) + "% of " + total + "\n" + plural(o.expected, "expected attendee") },
      { label: "Not attending", sub: "Tidak Hadir", value: o.notAttending, color: COLOR.no,
        valueText: o.notAttending + " · " + pct(o.notAttending, total) + "%",
        tip: "Not attending (Tidak Hadir)\n" + plural(o.notAttending, "RSVP submission") + " · " + pct(o.notAttending, total) + "% of " + total }
    ], Math.max(o.attending, o.notAttending), "Attending vs not attending RSVP submissions");
    var diff = o.attending - o.notAttending;
    setNote("summaryNote", diff === 0 ? "The same number of submissions are attending and not attending."
      : Math.abs(diff) + " more " + (Math.abs(diff) === 1 ? "submission is " : "submissions are ") + (diff > 0 ? "attending than not attending." : "not attending than attending."));
  }

  // 2. Adults vs children (attending RSVPs), vertical bars
  function drawAges(o) {
    var box = $("ageChart"), people = o.adults + o.children;
    legend("ageLegend", [
      { label: "Adults", value: o.adults, color: COLOR.adults },
      { label: "Children", value: o.children, color: COLOR.children }
    ]);
    clear(box);
    if (!people) {
      emptyChart(box, o.attending ? "The attending RSVPs list no adults or children." : "No attending guests yet.");
      setNote("ageNote", "");
      return;
    }
    var bars = [
      { label: "Adults", sub: "13 years & above", value: o.adults, color: COLOR.adults },
      { label: "Children", sub: "0 – 12 years", value: o.children, color: COLOR.children }
    ];
    var W = chartWidth(box, 240), H = 220, L = 34, R = 8, T = 22, B = 42;
    var w = W - L - R, h = H - T - B, sc = niceScale(Math.max(o.adults, o.children), 4);
    var svg = svgEl("svg", { viewBox: "0 0 " + W + " " + H, width: W, height: H, role: "group", "aria-label": "Adults vs children" });
    for (var v = 0; v <= sc.max; v += sc.step) {
      var gy = T + h - (v / sc.max) * h;
      svg.appendChild(svgEl("line", { "class": v ? "grid" : "axis", x1: L, y1: gy, x2: L + w, y2: gy }));
      svg.appendChild(svgEl("text", { "class": "tick tick--end", x: L - 8, y: gy + 3.5 }, String(v)));
    }
    var slot = w / bars.length, barW = Math.min(72, slot * 0.5);
    bars.forEach(function (b, i) {
      var cx = L + slot * i + slot / 2, bh = (b.value / sc.max) * h;
      var g = svgEl("g", { "class": "mark" });
      g.appendChild(svgEl("rect", { "class": "hit", x: L + slot * i, y: T - 18, width: slot, height: H - T + 18 }));
      g.appendChild(svgEl("rect", { "class": "mark__bar", x: cx - barW / 2, y: T + h - bh, width: barW, height: bh, rx: 4, fill: b.color }));
      g.appendChild(svgEl("text", { "class": "value tick--mid", x: cx, y: T + h - bh - 7 }, String(b.value)));
      g.appendChild(svgEl("text", { "class": "label tick--mid", x: cx, y: H - 22 }, b.label));
      g.appendChild(svgEl("text", { "class": "label label--sub tick--mid", x: cx, y: H - 7 }, b.sub));
      addTip(g, b.label + " (" + b.sub + ")\n" + plural(b.value, b === bars[0] ? "adult" : "child", b === bars[0] ? "adults" : "children") + " · " + pct(b.value, people) + "% of " + people + " attending guests");
      svg.appendChild(g);
    });
    box.appendChild(svg);
    // "Jumlah Tetamu" is read as written in the sheet; say so if it disagrees
    setNote("ageNote", o.expected !== people
      ? "Jumlah Tetamu in the sheet adds up to " + o.expected + ", while adults + children come to " + people + "." : "");
  }

  // 3. RSVP submission trend: submissions per day, from the real timestamps
  var fmtTipDay = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short", year: "numeric" });
  var fmtAxisDay = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short" });
  function dayDate(key) { return new Date(key + "T00:00:00Z"); }

  function drawTrend(recs) {
    var box = $("trendChart");
    var dated = recs.filter(function (r) { return r.time; });
    var cols = state.source && state.source.columns;
    var hasColumn = !cols || !!cols.timestamp;
    clear(box);
    legend("trendLegend", []);
    setNote("trendNote", "");
    if (!recs.length) { emptyChart(box, "No RSVP submissions yet. The trend appears after the first one."); return; }
    if (!hasColumn) {
      emptyChart(box, "The submission trend can't be displayed: the RSVP tab has no Timestamp column, so there is no record of when each RSVP was submitted.");
      return;
    }
    if (!dated.length) {
      emptyChart(box, "The submission trend can't be displayed: none of the " + plural(recs.length, "submission") + " has a readable timestamp in the sheet.");
      return;
    }

    var byDay = {};
    dated.forEach(function (r) { var k = fmtDayKey.format(r.time); byDay[k] = (byDay[k] || 0) + 1; });
    var keys = Object.keys(byDay).sort();
    // every calendar day from the first submission to the last (a day with
    // no submissions is a real 0, not a guess)
    var days = [], d = dayDate(keys[0]), end = dayDate(keys[keys.length - 1]);
    while (d <= end && days.length < 730) { days.push(d.toISOString().slice(0, 10)); d = new Date(d.getTime() + 86400000); }
    var daily = days.map(function (k) { return byDay[k] || 0; });
    var cum = [], run = 0;
    daily.forEach(function (v) { run += v; cum.push(run); });
    var peak = Math.max.apply(null, daily), peakDay = days[daily.indexOf(peak)];

    legend("trendLegend", [
      { label: "Submissions per day", color: COLOR.yes, line: true },
      { label: "Peak", value: peak + " on " + fmtAxisDay.format(dayDate(peakDay)), color: "transparent" },
      { label: "Days", value: days.length, color: "transparent" }
    ]);

    var W = chartWidth(box, 280), H = W < 500 ? 210 : 250, L = 34, R = 18, T = 14, B = 30;
    var w = W - L - R, h = H - T - B, n = days.length, sc = niceScale(peak, 4);
    var xAt = function (i) { return n === 1 ? L + w / 2 : L + (w * i) / (n - 1); };
    var yAt = function (v) { return T + h - (v / sc.max) * h; };
    var svg = svgEl("svg", { viewBox: "0 0 " + W + " " + H, width: W, height: H, role: "group",
      "aria-label": "RSVP submissions per day, " + fmtAxisDay.format(dayDate(days[0])) + " to " + fmtAxisDay.format(dayDate(days[n - 1])) });
    for (var v = 0; v <= sc.max; v += sc.step) {
      svg.appendChild(svgEl("line", { "class": v ? "grid" : "axis", x1: L, y1: yAt(v), x2: L + w, y2: yAt(v) }));
      svg.appendChild(svgEl("text", { "class": "tick tick--end", x: L - 8, y: yAt(v) + 3.5 }, String(v)));
    }
    var pts = daily.map(function (v, i) { return xAt(i).toFixed(1) + "," + yAt(v).toFixed(1); });
    if (n > 1) {
      svg.appendChild(svgEl("path", { "class": "area", d: "M" + xAt(0).toFixed(1) + "," + yAt(0) + " L" + pts.join(" L") + " L" + xAt(n - 1).toFixed(1) + "," + yAt(0) + " Z" }));
      svg.appendChild(svgEl("polyline", { "class": "line", points: pts.join(" ") }));
    }
    var labelEvery = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(w / 64))));
    daily.forEach(function (v, i) {
      var x = xAt(i), half = n === 1 ? w / 2 : w / (n - 1) / 2;
      var g = svgEl("g", { "class": "pt" + (n > 60 ? " pt--quiet" : "") });
      g.appendChild(svgEl("rect", { "class": "hit", x: Math.max(L, x - half), y: T, width: Math.min(L + w, x + half) - Math.max(L, x - half), height: h }));
      g.appendChild(svgEl("line", { "class": "guide", x1: x, y1: T, x2: x, y2: T + h }));
      g.appendChild(svgEl("circle", { "class": "dot", cx: x, cy: yAt(v), r: 4 }));
      addTip(g, fmtTipDay.format(dayDate(days[i])) + "\n" + plural(v, "RSVP submission") + "\nRunning total: " + cum[i]);
      svg.appendChild(g);
      if (i === n - 1 || (i % labelEvery === 0 && n - 1 - i >= labelEvery * 0.6)) {
        svg.appendChild(svgEl("text", { "class": "tick " + (n === 1 ? "tick--mid" : i === 0 ? "tick--start" : i === n - 1 ? "tick--end" : "tick--mid"), x: x, y: H - 8 }, fmtAxisDay.format(dayDate(days[i]))));
      }
    });
    box.appendChild(svg);
    var undated = recs.length - dated.length;
    if (undated) setNote("trendNote", undated + " of " + plural(recs.length, "submission") + (undated === 1 ? " has" : " have") + " no readable timestamp in the sheet and " + (undated === 1 ? "isn't" : "aren't") + " included in the trend.");
  }

  // Charts are drawn at their box's width: redraw when the width changes
  var resizeTimer = null, lastWidth = window.innerWidth;
  window.addEventListener("resize", function () {
    if (window.innerWidth === lastWidth) return; // phone address bar showing/hiding
    lastWidth = window.innerWidth;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { if (!dashView.hidden && state.generatedAt) drawCharts(); }, 150);
  });

  /* ---------- RSVP records table ---------- */
  // Search (guest name), attendance filter, sorting and pages all work on the
  // records already read for this signed-in session. The only way to get
  // records is the authenticated "adminData" request (Refresh).

  var searchInput = $("search"), filterSelect = $("filter"), sortSelect = $("sortSelect"), pageSizeSelect = $("pageSize");
  var tableView = { page: 1, size: Number(pageSizeSelect.value) || 10 };

  function toPageOne() { tableView.page = 1; renderTable(); }
  searchInput.addEventListener("input", toPageOne);
  filterSelect.addEventListener("change", toPageOne);
  pageSizeSelect.addEventListener("change", function () { tableView.size = Number(pageSizeSelect.value) || 10; toPageOne(); });
  sortSelect.addEventListener("change", function () {
    var v = sortSelect.value.split(":");
    state.sort = { key: v[0], dir: v[1] };
    toPageOne();
  });
  Array.prototype.forEach.call(document.querySelectorAll("th button[data-sort]"), function (btn) {
    btn.addEventListener("click", function () {
      var key = btn.getAttribute("data-sort");
      // first click: newest / A–Z / Hadir first / most guests; again: the reverse
      var first = key === "timestamp" || key === "total" ? "desc" : "asc";
      state.sort = state.sort.key === key
        ? { key: key, dir: state.sort.dir === "asc" ? "desc" : "asc" }
        : { key: key, dir: first };
      toPageOne();
    });
  });
  $("recordsRefresh").addEventListener("click", function () { loadData(); });

  function hasDates() {
    var cols = state.source && state.source.columns;
    return !cols || !!cols.timestamp;
  }

  function compareRecords(a, b, key, dir) {
    var d = dir === "asc" ? 1 : -1, c = 0;
    if (key === "timestamp") {
      if (!a.time !== !b.time) return a.time ? -1 : 1;             // no date: always last
      c = (a.timestamp - b.timestamp) || (a.row - b.row);          // sheet order for equal times
      return c * d;
    }
    if (key === "name") c = a.name.localeCompare(b.name, "ms", { sensitivity: "base", numeric: true });
    else if (key === "attendance") c = (a.attendance === "Hadir" ? 0 : 1) - (b.attendance === "Hadir" ? 0 : 1);
    else c = a[key] - b[key];
    return c * d || (b.timestamp - a.timestamp) || (b.row - a.row); // then newest first
  }

  // The records matching the search and filter, in the chosen order
  function matchingRecords() {
    var q = searchInput.value.trim().toLowerCase().replace(/\s+/g, " "), f = filterSelect.value;
    var list = state.records.filter(function (r) {
      if (f && r.attendance !== f) return false;
      return !q || r.name.toLowerCase().replace(/\s+/g, " ").indexOf(q) !== -1;
    });
    var key = state.sort.key, dir = state.sort.dir;
    return list.sort(function (a, b) { return compareRecords(a, b, key, dir); });
  }

  function renderTable() {
    var body = $("recordsBody"), all = state.records, list = matchingRecords();
    var dates = hasDates();
    clear(body);
    $("recordsTable").classList.toggle("records--no-date", !dates);
    Array.prototype.forEach.call(sortSelect.options, function (o) {
      if (o.value.indexOf("timestamp:") === 0) o.textContent = (o.value === "timestamp:desc" ? "Newest" : "Oldest") + (dates ? " first" : " first (sheet order)");
    });
    sortSelect.value = state.sort.key + ":" + state.sort.dir;
    Array.prototype.forEach.call(document.querySelectorAll("th[data-col]"), function (th) {
      var on = th.getAttribute("data-col") === state.sort.key;
      if (on) th.setAttribute("aria-sort", state.sort.dir === "asc" ? "ascending" : "descending");
      else th.removeAttribute("aria-sort");
    });

    var pages = Math.max(1, Math.ceil(list.length / tableView.size));
    tableView.page = Math.min(Math.max(1, tableView.page), pages);
    var start = (tableView.page - 1) * tableView.size;
    var slice = list.slice(start, start + tableView.size);

    slice.forEach(function (r, i) {
      var tr = document.createElement("tr");
      var cell = function (cls, label, text) {
        var td = htmlEl("td", cls, text);
        td.setAttribute("data-label", label);
        tr.appendChild(td);
        return td;
      };
      cell("col-no", "No.", String(start + i + 1));
      cell("col-name", "Guest Name", r.name);
      var att = cell("col-att", "Attendance");
      att.appendChild(htmlEl("span", "tag " + (r.attendance === "Hadir" ? "tag--yes" : "tag--no"), r.attendance === "Hadir" ? "Hadir" : "Tidak Hadir"));
      cell("col-num col-adults", "Adults", String(r.adults));
      cell("col-num col-children", "Children", String(r.children));
      cell("col-num col-total", "Total Guests", String(r.total));
      var wish = cell("col-wish", "Greeting");
      if (r.message) {
        wish.appendChild(htmlEl("span", "wish__text", r.message));
        var view = htmlEl("button", "link-btn", "View");
        view.type = "button";
        view.setAttribute("aria-label", "View the full greeting from " + r.name);
        view.addEventListener("click", function () { openGreeting(r, view); });
        wish.appendChild(view);
      } else {
        wish.appendChild(htmlEl("span", "wish__none", "Tiada ucapan"));
      }
      var when = cell("col-date", "Submission Date", r.time ? formatTime(r.time) : "—");
      if (!r.time) when.title = "No timestamp in the sheet";
      body.appendChild(tr);
    });

    var matching = list.length, total = all.length;
    $("recordsCount").textContent = String(matching);
    $("recordsCount").setAttribute("aria-label", plural(matching, "matching record"));
    $("recordsSummary").textContent = !total ? "No RSVP records yet."
      : !matching ? "0 matching records of " + total + "."
      : (matching === total ? plural(total, "record") : matching + " matching " + (matching === 1 ? "record" : "records") + " of " + total)
        + " · showing " + (slice.length === 1 ? start + 1 : (start + 1) + "–" + (start + slice.length));
    $("recordsEmpty").textContent = total ? "No records match your search or filter." : "No RSVP records yet.";
    $("recordsEmpty").hidden = matching > 0;
    $("recordsClear").hidden = !(total && (searchInput.value.trim() || filterSelect.value));
    renderPager(pages);
  }

  $("recordsClear").addEventListener("click", function () {
    searchInput.value = "";
    filterSelect.value = "";
    toPageOne();
    searchInput.focus();
  });

  // Page numbers: all of them when few, else first, last and those around the current page
  function pageList(page, pages) {
    if (pages <= 7) return Array.apply(null, Array(pages)).map(function (_, i) { return i + 1; });
    var want = [1, pages, page - 1, page, page + 1];
    if (page <= 4) want.push(2, 3, 4, 5);
    if (page >= pages - 3) want.push(pages - 4, pages - 3, pages - 2, pages - 1);
    var nums = want.filter(function (n, i) { return n >= 1 && n <= pages && want.indexOf(n) === i; }).sort(function (a, b) { return a - b; });
    var out = [];
    nums.forEach(function (n, i) { if (i && n - nums[i - 1] > 1) out.push("…"); out.push(n); });
    return out;
  }

  function renderPager(pages) {
    var nav = $("pager"), page = tableView.page;
    clear(nav);
    nav.hidden = pages <= 1;
    if (pages <= 1) return;
    var go = function (n) {
      tableView.page = n;
      renderTable();
      var top = $("recordsTitle").getBoundingClientRect().top;
      if (top < 0) $("recordsTitle").scrollIntoView({ block: "start" });
    };
    var button = function (text, n, label, cls) {
      var b = htmlEl("button", "pager__btn" + (cls ? " " + cls : ""), text);
      b.type = "button";
      if (label) b.setAttribute("aria-label", label);
      if (n === page && !cls) b.setAttribute("aria-current", "page");
      b.disabled = n < 1 || n > pages || (n === page && !cls);
      b.addEventListener("click", function () { go(n); });
      nav.appendChild(b);
    };
    button("‹ Prev", page - 1, "Previous page", "pager__step");
    pageList(page, pages).forEach(function (n) {
      if (n === "…") nav.appendChild(htmlEl("span", "pager__gap", "…"));
      else button(String(n), n, "Page " + n);
    });
    button("Next ›", page + 1, "Next page", "pager__step pager__next");
    nav.appendChild(htmlEl("span", "pager__status", "Page " + page + " of " + pages));
  }

  /* ---------- Full greeting (modal) ---------- */

  var greetingModal = $("greetingModal"), greetingOpener = null;
  function openGreeting(r, opener) {
    greetingOpener = opener || null;
    $("greetingName").textContent = r.name;
    $("greetingMeta").textContent = (r.attendance === "Hadir" ? "Hadir" : "Tidak Hadir") +
      " · " + plural(r.total, "guest") + (r.time ? " · " + formatTime(r.time) : "");
    $("greetingText").textContent = r.message;
    if (typeof greetingModal.showModal === "function") greetingModal.showModal();
    else greetingModal.setAttribute("open", "");
    $("greetingClose").focus();
  }
  function closeGreeting() {
    if (typeof greetingModal.close === "function") greetingModal.close();
    else greetingModal.removeAttribute("open");
  }
  greetingModal.addEventListener("close", function () {
    $("greetingName").textContent = "";
    $("greetingMeta").textContent = "";
    $("greetingText").textContent = "";
    if (greetingOpener && greetingOpener.isConnected) greetingOpener.focus();
    greetingOpener = null;
  });
  greetingModal.addEventListener("click", function (e) { if (e.target === greetingModal) closeGreeting(); }); // the backdrop
  $("greetingClose").addEventListener("click", closeGreeting);
  $("greetingDone").addEventListener("click", closeGreeting);

  /* ---------- Ucapan ---------- */
  // Read-only: the greetings (Ucapan column) of the valid RSVP records. A
  // record counts as "with greeting" when its Ucapan cell isn't blank.

  var WISH_STEP = 12;
  var wishView = { shown: WISH_STEP };
  var wishSearch = $("wishSearch"), wishSort = $("wishSort");
  wishSearch.addEventListener("input", function () { wishView.shown = WISH_STEP; renderUcapan(); });
  wishSort.addEventListener("change", function () { wishView.shown = WISH_STEP; renderUcapan(); });
  $("wishesMore").addEventListener("click", function () {
    var next = $("wishesList").children.length;
    wishView.shown += WISH_STEP;
    renderUcapan();
    var li = $("wishesList").children[next];
    if (li) li.querySelector(".wish__body").focus({ preventScroll: true });
  });
  $("wishesClear").addEventListener("click", function () {
    wishSearch.value = "";
    wishView.shown = WISH_STEP;
    renderUcapan();
    wishSearch.focus();
  });

  // Text with every match of q wrapped in <mark> (built as nodes, never as HTML)
  function highlighted(el, text, q) {
    if (!q) { el.textContent = text; return el; }
    var lower = text.toLowerCase(), at = 0, i;
    while ((i = lower.indexOf(q, at)) !== -1) {
      if (i > at) el.appendChild(document.createTextNode(text.slice(at, i)));
      el.appendChild(htmlEl("mark", "", text.slice(i, i + q.length)));
      at = i + q.length;
    }
    if (at < text.length) el.appendChild(document.createTextNode(text.slice(at)));
    return el;
  }

  function renderUcapan() {
    var recs = state.records, total = recs.length;
    var withMsg = recs.filter(function (r) { return r.message; });
    var without = total - withMsg.length, rate = pct(withMsg.length, total);

    $("uWith").textContent = String(withMsg.length);
    $("uWithout").textContent = String(without);
    $("uRate").textContent = total ? rate + "%" : "–";
    $("uFill").style.width = (total ? rate : 0) + "%";
    $("uMeter").setAttribute("aria-valuenow", String(total ? rate : 0));
    $("uRateNote").textContent = total ? withMsg.length + " of " + plural(total, "submission") + " include a greeting" : "No RSVP submissions yet";

    // the list: search by greeting text or guest name, then sort
    var q = wishSearch.value.trim().toLowerCase();
    var list = withMsg.filter(function (r) {
      return !q || r.message.toLowerCase().indexOf(q) !== -1 || r.name.toLowerCase().indexOf(q) !== -1;
    });
    var how = wishSort.value;
    list.sort(function (a, b) {
      if (how === "name") return a.name.localeCompare(b.name, "ms", { sensitivity: "base", numeric: true }) || (b.timestamp - a.timestamp);
      if (!a.time !== !b.time) return a.time ? -1 : 1;           // no date: last
      var c = (a.timestamp - b.timestamp) || (a.row - b.row);
      return how === "old" ? c : -c;
    });

    var ol = $("wishesList");
    clear(ol);
    var shown = list.slice(0, wishView.shown);
    shown.forEach(function (r) {
      var li = htmlEl("li", "wish");
      var body = highlighted(htmlEl("p", "wish__body"), r.message, q);
      body.tabIndex = -1;
      li.appendChild(body);
      var meta = htmlEl("p", "wish__meta");
      meta.appendChild(highlighted(htmlEl("span", "wish__name"), r.name, q));
      meta.appendChild(htmlEl("span", "tag " + (r.attendance === "Hadir" ? "tag--yes" : "tag--no"), r.attendance === "Hadir" ? "Hadir" : "Tidak Hadir"));
      if (r.time) {
        var when = htmlEl("time", "wish__date", formatTime(r.time));
        when.setAttribute("datetime", r.time.toISOString());
        meta.appendChild(when);
      }
      li.appendChild(meta);
      ol.appendChild(li);
    });
    // long greetings start folded; "Read more" opens them in place
    shown.forEach(function (r, i) {
      var li = ol.children[i], body = li.firstChild;
      if (body.scrollHeight <= body.clientHeight + 2) return;
      var more = htmlEl("button", "link-btn wish__more", "Read more");
      more.type = "button";
      more.setAttribute("aria-expanded", "false");
      more.addEventListener("click", function () {
        var open = li.classList.toggle("is-open");
        more.textContent = open ? "Show less" : "Read more";
        more.setAttribute("aria-expanded", String(open));
      });
      li.insertBefore(more, body.nextSibling);
      // a search hit in the greeting itself: open it so the match can be seen
      if (q && r.message.toLowerCase().indexOf(q) !== -1) more.click();
    });

    $("wishesCount").textContent = String(list.length);
    $("wishesSummary").textContent = !withMsg.length ? (total ? "None of the RSVP records has a greeting yet." : "No RSVP submissions yet.")
      : (q ? list.length + " of " + plural(withMsg.length, "greeting") + " match" + (list.length === 1 ? "es" : "") : plural(withMsg.length, "greeting"))
        + (list.length ? " · showing " + (shown.length === list.length ? "all" : shown.length) : "");
    $("wishesEmpty").textContent = withMsg.length ? "No greetings match “" + wishSearch.value.trim() + "”." : "Belum ada ucapan.";
    $("wishesEmpty").hidden = list.length > 0;
    $("wishesClear").hidden = !(q && !list.length);
    var left = list.length - shown.length;
    $("wishesMore").hidden = left <= 0;
    $("wishesMore").textContent = "Show " + Math.min(WISH_STEP, left) + " more (" + left + " left)";
  }

  /* ---------- CSV export (of the records as read from the sheet) ---------- */

  $("exportBtn").addEventListener("click", function () {
    var rows = [["No.", "Guest Name", "Attendance", "Adults", "Children", "Total Guests", "Greeting", "Submission Date", "Email"]];
    matchingRecords().forEach(function (r) {
      rows.push([rows.length, r.name, r.attendance, r.adults, r.children, r.total, r.message || "Tiada ucapan", r.time ? formatTime(r.time) : "", r.email]);
    });
    var csv = rows.map(function (row) {
      return row.map(function (v) {
        var s = String(v);
        if (/^[=+\-@]/.test(s)) s = "'" + s;           // never a spreadsheet formula
        return '"' + s.replace(/"/g, '""') + '"';
      }).join(",");
    }).join("\r\n");
    var blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "rsvp-" + fmtDayKey.format(new Date()) + ".csv";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  });

  /* ---------- Section navigation ---------- */
  // The sidebar (top bar on small screens) marks the section being read.

  var navLinks = Array.prototype.slice.call(document.querySelectorAll(".nav-link"));
  function setActiveNav(id) {
    navLinks.forEach(function (a) {
      var on = a.getAttribute("href") === "#" + id;
      a.classList.toggle("is-active", on);
      if (on) a.setAttribute("aria-current", "location"); else a.removeAttribute("aria-current");
    });
  }
  function spyNav() {
    if (dashView.hidden) return;
    var line = Math.min(window.innerHeight * 0.35, 260), current = "overview";
    navLinks.forEach(function (a) {
      var sec = document.getElementById(a.getAttribute("href").slice(1));
      if (sec && sec.getBoundingClientRect().top - line <= 0) current = sec.id;
    });
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) current = navLinks[navLinks.length - 1].getAttribute("href").slice(1);
    setActiveNav(current);
  }
  var spyQueued = false;
  window.addEventListener("scroll", function () {
    if (spyQueued) return;
    spyQueued = true;
    requestAnimationFrame(function () { spyQueued = false; spyNav(); });
  }, { passive: true });
  navLinks.forEach(function (a) {
    a.addEventListener("click", function () { setActiveNav(a.getAttribute("href").slice(1)); });
  });
  setActiveNav("overview");

  /* ---------- Butterflies (decoration only) ---------- */
  // The invitation's butterfly, a few of them, small and faint: in the
  // sidebar's free space and behind the sign-in card only. They never take
  // a click, stop while the tab is hidden, and aren't drawn at all for
  // reduced motion.

  function addButterflies(box, n) {
    if (!box || box.childNodes.length) return;
    for (var i = 0; i < n; i++) {
      var bf = htmlEl("span", "bf"), tilt = htmlEl("span", "bf__tilt");
      [["bf__wing", "#ui-fly-wing-l"], ["bf__wing", "#ui-fly-wing-r"], ["bf__body", "#ui-fly-body"]].forEach(function (part, k) {
        var svg = svgEl("svg", { "class": part[0], viewBox: "0 0 64 56", "aria-hidden": "true", focusable: "false" });
        svg.appendChild(svgEl("use", { href: part[1] }));
        if (k < 2) svg.style.animationDelay = (-0.37 * i) + "s";
        tilt.appendChild(svg);
      });
      bf.appendChild(tilt);
      box.appendChild(bf);
    }
  }
  var calm = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
  if (!calm.matches) {
    addButterflies(document.querySelector(".flutter--login"), 3);
    addButterflies(document.querySelector(".flutter--side"), 2);
  }
  // only when the sidebar has room for them, between the menu and the status
  function fitSideFlutter() {
    var box = document.querySelector(".flutter--side");
    if (box) box.classList.toggle("is-cramped", box.clientHeight < 110);
  }
  window.addEventListener("resize", fitSideFlutter);
  document.addEventListener("visibilitychange", function () {
    document.documentElement.classList.toggle("is-paused", document.visibilityState !== "visible");
  });

  /* ---------- Start ---------- */

  if (getToken()) { showDashboard(); loadData(); }
  else showLogin("");
})();
