/**
 * Wedding RSVP 2026 — Google Apps Script Web App
 *
 * Receives RSVP submissions from the invitation website and appends one row
 * per submission to the "RSVP" tab of the "Wedding RSVP 2026" Google Sheet:
 *
 *   A Timestamp | B Nama | C Kehadiran | D Jumlah Dewasa |
 *   E Jumlah Kanak-kanak | F Jumlah Tetamu | G Ucapan
 *
 * Setup (once):
 *   1. Open the "Wedding RSVP 2026" sheet → Extensions → Apps Script.
 *   2. Replace the contents of Code.gs with this file and click Save.
 *   3. Deploy → New deployment → type "Web app":
 *        Execute as:      Me
 *        Who has access:  Anyone
 *      Authorise when asked, then copy the Web app URL (ends in /exec).
 *
 * Updating an existing deployment (keeps the same /exec URL):
 *   Save, then Deploy → Manage deployments → ✏ Edit → Version: New version → Deploy.
 *
 * Endpoints (same /exec URL):
 *   POST  adds one RSVP row.
 *   GET   returns ONLY the public summary: the Hadir / Tidak Hadir counts and
 *         the wishes (name + message, newest first). Timestamps, guest counts
 *         and everything else in the sheet stay private.
 *
 * The sheet itself stays private; it is never shared or returned whole.
 *
 * Do not upload this apps-script/ folder with the website — it is not part
 * of the site.
 */

/** @OnlyCurrentDoc Limits this script's access to this one spreadsheet. */

// Must match the tab name in the Google Sheet.
var SHEET_NAME = 'RSVP';

// Same limits as the form on the website (js/main.js, index.html).
// Guest counts only need to be whole numbers of 0 or more: there is NO maximum.
var NAME_MIN = 2;
var NAME_MAX = 80;
var ATTENDANCE_OPTIONS = ['Hadir', 'Tidak Hadir'];
var MESSAGE_MAX = 300;

// A real submission is a few hundred characters; anything far larger is not
// from the form.
var BODY_MAX = 5000;

// Header names the public summary reads (looked up by name, so it still works
// if columns are moved). Only these columns are ever read for GET, and only
// Nama, Kehadiran and Ucapan values can appear in the output.
var COL = { timestamp: 'Timestamp', name: 'Nama', attendance: 'Kehadiran', message: 'Ucapan' };

// The public summary is cached briefly so many visitors don't each read the
// sheet; a new RSVP clears the cache so it appears straight away.
var PUBLIC_CACHE_KEY = 'public-summary-v1';
var PUBLIC_CACHE_SECONDS = 60;

// Messages shown to guests. Never include technical details here.
var MSG = {
  invalidRequest: 'Permintaan tidak sah. Sila cuba lagi.',
  name: 'Sila masukkan nama anda.',
  attendance: 'Sila pilih kehadiran anda.',
  adults: 'Sila pilih jumlah dewasa.',
  children: 'Sila pilih jumlah kanak-kanak.',
  message: 'Ucapan tidak boleh melebihi ' + MESSAGE_MAX + ' aksara.',
  busy: 'Sistem sedang sibuk. Sila cuba sebentar lagi.',
  server: 'Maaf, RSVP anda tidak dapat dihantar. Sila cuba lagi.',
  publicError: 'Maaf, maklumat tidak dapat dipaparkan buat masa ini.'
};

/** Receives an RSVP submission. */
function doPost(e) {
  try {
    // 1. Parse the request.
    var body = parseBody_(e);
    if (!body) return fail_(MSG.invalidRequest);

    // 2. Validate the name.
    var name = cleanText_(body.name, false);
    if (name.length < NAME_MIN || name.length > NAME_MAX) return fail_(MSG.name);

    // 3. Validate attendance: exactly "Hadir" or "Tidak Hadir".
    var attendance = body.attendance;
    if (typeof attendance !== 'string' || ATTENDANCE_OPTIONS.indexOf(attendance) === -1) {
      return fail_(MSG.attendance);
    }

    // 4. Validate adults (whole number, 0 or more).
    var adults = toWholeNumber_(body.adults);
    if (adults === null) return fail_(MSG.adults);

    // 5. Validate children (whole number, 0 or more).
    var children = toWholeNumber_(body.children);
    if (children === null) return fail_(MSG.children);

    // 6. Validate message length (optional field).
    var message = cleanText_(body.message, true);
    if (message.length > MESSAGE_MAX) return fail_(MSG.message);

    // 7. Calculate the total on the server. body.totalGuests is ignored.
    //    There is no maximum guest limit.
    var totalGuests = adults + children;

    // 8. Timestamp (the sheet's time zone is Asia/Kuala_Lumpur).
    var timestamp = new Date();

    // 9. Append the row: A Timestamp, B Nama, C Kehadiran, D Dewasa,
    //    E Kanak-kanak, F Jumlah Tetamu, G Ucapan.
    return appendRsvp_([
      timestamp,
      asText_(name),
      attendance,
      adults,
      children,
      totalGuests,
      asText_(message)
    ]);
  } catch (err) {
    console.error('RSVP doPost failed: ' + (err && err.stack ? err.stack : err));
    return fail_(MSG.server);
  }
}

/**
 * Read-only public summary:
 *   { success: true,
 *     attendance: { hadir: <rows with Kehadiran "Hadir">, tidakHadir: <rows with "Tidak Hadir"> },
 *     wishes: [ { name, message }, ... ]   // non-empty Ucapan only, newest first
 *   }
 * Nothing else from the sheet is returned.
 */
function doGet() {
  try {
    var cache = CacheService.getScriptCache();
    var cached = cache.get(PUBLIC_CACHE_KEY);
    if (cached) return jsonText_(cached);

    var summary = buildPublicSummary_();
    if (!summary) return fail_(MSG.publicError);

    var text = JSON.stringify(summary);
    try {
      cache.put(PUBLIC_CACHE_KEY, text, PUBLIC_CACHE_SECONDS);
    } catch (err) {
      // Too large to cache (over 100 KB): just serve it uncached.
    }
    return jsonText_(text);
  } catch (err) {
    console.error('RSVP doGet failed: ' + (err && err.stack ? err.stack : err));
    return fail_(MSG.publicError);
  }
}

/* ---------- Helpers ---------- */

function appendRsvp_(row) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return fail_(MSG.busy);

  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    if (!sheet) {
      console.error('RSVP sheet tab "' + SHEET_NAME + '" not found.');
      return fail_(MSG.server);
    }
    sheet.appendRow(row);
    SpreadsheetApp.flush();
    clearPublicCache_();
    return json_({ success: true, message: 'RSVP successfully submitted' });
  } finally {
    lock.releaseLock();
  }
}

// Reads only Timestamp, Nama, Kehadiran and Ucapan, and returns only the
// counts plus name/message pairs. Returns null if the tab or a header is missing.
function buildPublicSummary_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) {
    console.error('RSVP sheet tab "' + SHEET_NAME + '" not found.');
    return null;
  }

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 1 || lastCol < 1) return null;

  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) {
    return String(h).trim();
  });
  var idx = {};
  for (var key in COL) {
    idx[key] = headers.indexOf(COL[key]);
    if (idx[key] === -1) {
      console.error('RSVP sheet header "' + COL[key] + '" not found.');
      return null;
    }
  }

  var hadir = 0;
  var tidakHadir = 0;
  var wishes = [];

  if (lastRow >= 2) {
    var rowCount = lastRow - 1;
    var read = function (i) { return sheet.getRange(2, i + 1, rowCount, 1).getValues(); };
    var times = read(idx.timestamp);
    var names = read(idx.name);
    var attendance = read(idx.attendance);
    var messages = read(idx.message);

    for (var r = 0; r < rowCount; r++) {
      var status = String(attendance[r][0]).trim();
      if (status === 'Hadir') hadir++;
      else if (status === 'Tidak Hadir') tidakHadir++;

      var message = String(messages[r][0]).trim();
      var name = String(names[r][0]).trim();
      if (message && name) {
        var t = times[r][0];
        wishes.push({
          order: t instanceof Date ? t.getTime() : 0,
          row: r,
          name: name,
          message: message
        });
      }
    }
  }

  // Newest first: by timestamp, then by row position for equal/missing times.
  wishes.sort(function (a, b) { return (b.order - a.order) || (b.row - a.row); });

  return {
    success: true,
    attendance: { hadir: hadir, tidakHadir: tidakHadir },
    wishes: wishes.map(function (w) { return { name: w.name, message: w.message }; })
  };
}

function clearPublicCache_() {
  try {
    CacheService.getScriptCache().remove(PUBLIC_CACHE_KEY);
  } catch (err) {
    // Cache is only an optimisation; the summary refreshes within a minute anyway.
  }
}

// Accepts a JSON body (sent as text/plain or application/json) or ordinary
// form fields. Returns a plain object, or null if the request is unusable.
function parseBody_(e) {
  if (!e) return null;

  var raw = e.postData && typeof e.postData.contents === 'string' ? e.postData.contents : '';
  if (raw.length > BODY_MAX) return null;

  var type = e.postData && e.postData.type ? String(e.postData.type) : '';
  if (raw && type.indexOf('application/x-www-form-urlencoded') === -1) {
    try {
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
    } catch (err) {
      return null;
    }
  }

  if (e.parameter && typeof e.parameter === 'object') return e.parameter;
  return null;
}

// Trims, removes control characters and collapses spaces. Line breaks are
// kept only when allowNewlines is true (the Ucapan field).
function cleanText_(value, allowNewlines) {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string' && typeof value !== 'number') return '';

  var text = String(value).replace(/\r\n?/g, '\n');
  if (allowNewlines) {
    text = text
      .replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '')
      .replace(/[ \t]+/g, ' ')
      .replace(/ *\n */g, '\n')
      .replace(/\n{3,}/g, '\n\n');
  } else {
    text = text
      .replace(/[\u0000-\u001F\u007F]+/g, ' ')
      .replace(/\s+/g, ' ');
  }
  return text.trim();
}

// Whole, non-negative number from a number or a digit string; otherwise null.
function toWholeNumber_(value) {
  var n;
  if (typeof value === 'number') {
    n = value;
  } else if (typeof value === 'string' && /^\s*\d+\s*$/.test(value)) {
    n = Number(value);
  } else {
    return null;
  }
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
}

// Guest text is stored as plain text: a leading apostrophe stops the sheet
// from treating input such as "=..." as a formula (it is not displayed).
function asText_(text) {
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function fail_(message) {
  return json_({ success: false, message: message });
}

function json_(obj) {
  return jsonText_(JSON.stringify(obj));
}

function jsonText_(text) {
  return ContentService
    .createTextOutput(text)
    .setMimeType(ContentService.MimeType.JSON);
}
