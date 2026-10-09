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
  var GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxRi-dB6ESz2ppsqMTQfHW2bKWJmGZ3s-kTs2iZti54DIsHGPPZwhoEjhKNA4IwPRLSBg/exec";

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

  /* ---------- Live butterflies ---------- */

  // Six or seven small butterflies fly freely about the screen on their own
  // wandering paths — over the names, text, buttons and everything else —
  // and stay in view: each appears somewhere of its own, drifts and dips with
  // every wing beat, sometimes glides or loops, and flies on and on, always
  // somewhere new, never leaving the screen.
  // Pure decoration: aria-hidden, and they never take a tap, click, typing or
  // scroll — everything under them works as if they were not there. Started when the
  // invitation opens; skipped for reduced motion; paused while the tab is
  // hidden (requestAnimationFrame stops by itself).
  function startButterflies() {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (document.querySelector(".flutter")) return;
    var layer = document.createElement("div");
    layer.className = "flutter";
    layer.setAttribute("aria-hidden", "true");
    // on top of the whole page — text, buttons, menu, music player and
    // dialogs — yet letting every tap, click and scroll through (see .flutter)
    document.body.appendChild(layer);

    var SVG = "http://www.w3.org/2000/svg";
    function rand(a, b) { return a + Math.random() * (b - a); }
    // A butterfly is a few stacked layers, each drawn once and then only
    // moved, scaled or faded by the graphics chip — nothing is redrawn while
    // it flies: the glow (for the glint), the wings with their pearly
    // outline, the wings' sheen, the body, and the tiny sparkles. js moves
    // the whole butterfly, beats the wings (scale) and brightens the sheen
    // (opacity); the glow and sparkles fade in and out by CSS. Each one is
    // built once and reused for flight after flight.
    function makeButterfly() {
      var bf = document.createElement("div");
      bf.className = "flutter__bf";
      function part(cls, html) {
        var svg = document.createElementNS(SVG, "svg");
        svg.setAttribute("viewBox", "0 0 64 56");
        svg.setAttribute("class", cls);
        svg.innerHTML = html;
        bf.appendChild(svg);
        return svg;
      }
      part("flutter__glow", '<use href="#bfly-glow-shape"/>');
      var wings = part("flutter__wings", '<g filter="url(#fly-halo)"><use href="#fly-wing-l"/><use href="#fly-wing-r"/></g>');
      var sheen = part("flutter__sheen", '<use href="#fly-sheen-l"/><use href="#fly-sheen-r"/>');
      part("flutter__body", '<g filter="url(#fly-halo)"><use href="#fly-body"/></g>');
      part("flutter__sparks", '<use href="#bfly-spark-1"/><use href="#bfly-spark-2"/>');
      return { el: bf, wings: wings, sheen: sheen };
    }

    // ---- A different character on each page ----
    // The invitation scrolls through its "pages" (the sections). Each has its
    // own butterfly mood: where they appear and which way they tend to fly,
    // how often they circle a while or bend off their line, how fast
    // they fly and how long the gaps are. Every
    // visit to a page also shifts its speed and gaps a little, so no
    // page ever repeats exactly. Butterflies already flying finish their
    // flight; new ones follow the page now in view.
    //   from:      edges whose parts of the screen they appear in more often
    //   to:        edges they fly toward a little more often (repeats = more likely)
    //   loiter:    chance to circle a while on the way
    //   detour:    chance to bend well off the line once
    //   speed:     flight speed ×
    //   gap:       seconds' pause before a butterfly flies again
    var PAGES = {
      hero:        { from: ["left", "left", "right", "right", "top"], to: ["right", "left", "top"], loiter: 0.25, detour: 0.45, speed: 0.9, gap: [2, 8] },
      countdown:   { from: ["top", "top", "bottom"], to: ["bottom", "top", "left"], loiter: 0.1, detour: 0.5, speed: 1.12, gap: [2.5, 9] },
      details:     { from: ["left", "top", "right"], to: ["bottom", "right", "left"], loiter: 0.3, detour: 0.5, speed: 0.82, gap: [2, 8] },
      "rsvp-form": { from: ["left", "right"], to: ["right", "left", "top"], loiter: 0, detour: 0.5, speed: 0.75, gap: [3, 10] },
      timeline:    { from: ["top", "top", "left", "right"], to: ["bottom", "bottom", "left"], loiter: 0.2, detour: 0.5, speed: 1.0, gap: [2, 7] },
      note:        { from: ["left", "right", "bottom"], to: ["top", "left", "right"], loiter: 0.5, detour: 0.3, speed: 0.85, gap: [2, 8] },
      ucapan:      { from: ["bottom", "bottom", "left"], to: ["top", "top", "right"], loiter: 0.15, detour: 0.5, speed: 0.95, gap: [3, 9] },
      rsvp:        { from: ["right", "left", "top"], to: ["left", "bottom", "right"], loiter: 0.3, detour: 0.4, speed: 1.05, gap: [2, 7] }
    };
    var page = PAGES.hero;
    var visit = null;
    function setPage(id) {
      var next = PAGES[id];
      if (!next || (next === page && visit)) return;
      page = next;
      // this visit's own shade of the page's mood
      visit = { speed: rand(0.88, 1.12), gap: rand(0.85, 1.2) };
    }
    setPage("hero");
    if ("IntersectionObserver" in window) {
      var pageIo = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { if (e.isIntersecting) setPage(e.target.id); });
      }, { rootMargin: "-45% 0px -50% 0px" });
      Array.prototype.forEach.call(document.querySelectorAll("main > section[id]"), function (s) { pageIo.observe(s); });
    }
    function pick(list) { return list[Math.floor(Math.random() * list.length)]; }

    // ---- Where a butterfly appears: anywhere on the screen ----
    // The screen is split into a 3 × 3 grid: top-left, top-centre, top-right,
    // middle-left, the middle, middle-right, bottom-left, bottom-centre and
    // bottom-right. Each butterfly takes a cell that none of the last few
    // used (cells by the page's own edges a little more often) and a random
    // spot in it — anywhere, over anything — and fades softly into view
    // there. From then on it stays on the screen.
    var recentCells = [];
    function cellEdges(c) {             // the screen edges a cell touches (none for the middle)
      var e = [];
      if (c.row === 0) e.push("top");
      if (c.row === 2) e.push("bottom");
      if (c.col === 0) e.push("left");
      if (c.col === 2) e.push("right");
      return e;
    }
    function pickCell() {
      var pool = [];
      for (var i = 0; i < 9; i++) {
        if (recentCells.indexOf(i) !== -1) continue;
        var c = { col: i % 3, row: Math.floor(i / 3), i: i };
        var byPage = cellEdges(c).some(function (e) { return page.from.indexOf(e) !== -1; });
        pool.push(c);
        if (byPage) pool.push(c);       // the page's own edges: twice as likely
      }
      var cell = pick(pool);
      recentCells.push(cell.i);
      if (recentCells.length > 4) recentCells.shift();
      return cell;
    }
    function spawnPoint(c, W, H) {
      var A = inner(W, H);
      return { x: clamp(rand(W * c.col / 3, W * (c.col + 1) / 3), A.x0, A.x1),
               y: clamp(rand(H * c.row / 3, H * (c.row + 1) / 3), A.y0, A.y1) };
    }
    // the part of the screen the flights keep to: clear of the edges (more so
    // on a phone), so with all their bobbing and swaying they never leave it
    function inner(W, H) {
      var mx = phone ? 0.1 : 0.06, my = 0.08;
      return { x0: W * mx, x1: W * (1 - mx), y0: H * my, y1: H * (1 - my) };
    }
    function cellOf(x, y, W, H) {
      return { col: clamp(Math.floor(x / (W / 3)), 0, 2), row: clamp(Math.floor(y / (H / 3)), 0, 2) };
    }

    // ---- Which way it flies: a random direction for every butterfly ----
    // Eight directions: left → right, right → left, bottom → top, top →
    // bottom, and the four diagonals. A butterfly takes only one with room
    // ahead on the screen from where it is (from the top-left: right, down or
    // down-right; from the middle: any of them), and seldom one that another
    // butterfly — or one of the last few legs — is already flying, so they
    // never all go the same way. Toward the page's own edges is a little more
    // likely (its character).
    var DIRS = [
      { dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: -1 }, { dx: 0, dy: 1 },
      { dx: 1, dy: -1 }, { dx: -1, dy: -1 }, { dx: 1, dy: 1 }, { dx: -1, dy: 1 }
    ];
    var recentDirs = [];
    function pickDir(cell, busy) {
      var pool = [];
      DIRS.forEach(function (d, i) {
        // never straight toward the side it is next to
        if (cell.col === 0 && d.dx < 0 || cell.col === 2 && d.dx > 0) return;
        if (cell.row === 0 && d.dy < 0 || cell.row === 2 && d.dy > 0) return;
        var w = busy.indexOf(i) !== -1 || recentDirs.indexOf(i) !== -1 ? 1 : 4;
        if (d.dx > 0 && page.to.indexOf("right") !== -1 || d.dx < 0 && page.to.indexOf("left") !== -1 ||
            d.dy > 0 && page.to.indexOf("bottom") !== -1 || d.dy < 0 && page.to.indexOf("top") !== -1) w += 2;
        for (var k = 0; k < w; k++) pool.push(i);
      });
      var i = pick(pool);
      recentDirs.push(i);
      if (recentDirs.length > 4) recentDirs.shift();
      return i;
    }
    function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

    // ---- Its route: curved legs that never leave the screen ----
    // From where it is, it sets off in its direction and flies a good way
    // across the screen (but always stays inside it), through a point every
    // ~220px, each pushed off the line to one side or the other by its own
    // random amount — so the flight bends this way and that, unevenly, never
    // in a straight line or a regular wave. In the page's mood it may circle
    // a while on the way, or swing well off its line once. A smooth Bezier
    // curve is drawn through all the points (buildPath), starting along the
    // way it is already heading. As it nears the end of a leg it takes a new
    // direction and flies on — an endless, ever-changing wander.
    // ---- Keeping their distance ----
    // A comfortable gap between butterflies (centre to centre; a little more
    // room on larger screens). Is a spot within that of another butterfly,
    // or of where one is heading?
    function spaceR() { return phone ? 90 : 120; }
    function crowded(p, f) {
      var R = spaceR() * (f || 1);
      for (var k = 0; k < flock.length; k++) {
        var o = flock[k];
        if (!o.alive || !o.path) continue;
        var ex = o.path.xs[o.path.xs.length - 1], ey = o.path.ys[o.path.ys.length - 1];
        if (Math.sqrt((p.x - o.x) * (p.x - o.x) + (p.y - o.y) * (p.y - o.y)) < R ||
            Math.sqrt((p.x - ex) * (p.x - ex) + (p.y - ey) * (p.y - ey)) < R) return true;
      }
      return false;
    }

    function planLeg(from, heading, W, H, busy) {
      var A = inner(W, H), i, d, end, tries = 0;
      do {
        i = pickDir(cellOf(from.x, from.y, W, H), busy);
        d = DIRS[i];
        // most of the room it has that way
        var roomX = d.dx > 0 ? A.x1 - from.x : from.x - A.x0;
        var roomY = d.dy > 0 ? A.y1 - from.y : from.y - A.y0;
        end = {
          x: d.dx ? from.x + d.dx * roomX * rand(0.55, 0.95) : from.x + rand(-0.15, 0.15) * W,
          y: d.dy ? from.y + d.dy * roomY * rand(0.55, 0.95) : from.y + rand(-0.15, 0.15) * H
        };
        end.x = clamp(end.x, A.x0, A.x1);
        end.y = clamp(end.y, A.y0, A.y1);
        var far = Math.sqrt((end.x - from.x) * (end.x - from.x) + (end.y - from.y) * (end.y - from.y));
      } while ((far < Math.min(W, H) * 0.3 || crowded(end, 1.3)) && ++tries < 8);
      var ex = end.x - from.x, ey = end.y - from.y;
      var len = Math.max(1, Math.sqrt(ex * ex + ey * ey));
      var nx = -ey / len, ny = ex / len;               // across the path
      var sway = Math.min(W, H) * rand(0.08, 0.14);
      var spread = phone ? 0 : W * 0.035;              // on wide screens, a little more sideways play
      var n = Math.max(1, Math.round(len / 220));
      var points = [], side = pick([-1, 1]);
      for (var k = 1; k <= n; k++) {
        if (Math.random() < 0.7) side = -side;          // usually bends back the other way, not always
        var f = k / (n + 1) + rand(-0.06, 0.06), off = side * sway * rand(0.35, 1);
        points.push({ x: clamp(from.x + ex * f + nx * off + rand(-spread, spread), A.x0, A.x1),
                      y: clamp(from.y + ey * f + ny * off, A.y0, A.y1) });
      }
      var r = Math.random();
      if (r < page.loiter) {
        // circle a while: a slow loop of one or two points around one on the way
        var c = pick(points), at = points.indexOf(c);
        c.slow = true;
        for (var q = Math.random() < 0.5 ? 1 : 2; q > 0; q--) {
          points.splice(at + 1, 0, { x: clamp(c.x + pick([-1, 1]) * rand(70, 110), A.x0, A.x1),
                                     y: clamp(c.y + pick([-1, 1]) * rand(50, 90), A.y0, A.y1), slow: true });
        }
      } else if (r < page.loiter + page.detour * 0.5) {
        // bend well off the line once
        var p = pick(points), s = pick([-1, 1]) * sway * rand(1.5, 2.5);
        p.x = clamp(p.x + nx * s, A.x0, A.x1);
        p.y = clamp(p.y + ny * s, A.y0, A.y1);
      }
      points.push(end);
      // the curve begins along the way it is already flying, so there is no kink
      var P = [from];
      if (heading !== null) P.push({ x: clamp(from.x + Math.cos(heading) * 50, A.x0, A.x1),
                                     y: clamp(from.y + Math.sin(heading) * 50, A.y0, A.y1) });
      return { path: buildPath(P.concat(points)), dir: i };
    }

    // A smooth curve through the route's points: between each two, a cubic
    // Bezier whose handles follow the points either side (Catmull-Rom), so
    // the curve flows through every point without corners. It is sampled
    // finely into positions with the distance flown so far.
    function buildPath(P) {
      var xs = [P[0].x], ys = [P[0].y], dist = [0], slow = [false];
      for (var i = 0; i < P.length - 1; i++) {
        var p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
        var c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
        var c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
        var sl = !!(p1.slow || p2.slow);
        for (var k = 1; k <= 24; k++) {
          var t = k / 24, u = 1 - t;
          var x = u * u * u * p1.x + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * p2.x;
          var y = u * u * u * p1.y + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * p2.y;
          var L = xs.length - 1, ddx = x - xs[L], ddy = y - ys[L];
          dist.push(dist[L] + Math.sqrt(ddx * ddx + ddy * ddy));
          xs.push(x); ys.push(y); slow.push(sl);
        }
      }
      return { xs: xs, ys: ys, dist: dist, slow: slow, total: dist[dist.length - 1] };
    }
    // the point `s` px along a butterfly's curve
    function pathAt(b, s) {
      var P = b.path, i = b.pi;
      while (i < P.dist.length - 2 && P.dist[i + 1] < s) i++;
      while (i > 0 && P.dist[i] > s) i--;
      b.pi = i;
      var seg = P.dist[i + 1] - P.dist[i], f = seg > 0 ? clamp((s - P.dist[i]) / seg, 0, 1) : 0;
      return { x: P.xs[i] + (P.xs[i + 1] - P.xs[i]) * f, y: P.ys[i] + (P.ys[i + 1] - P.ys[i]) * f, slow: P.slow[i + 1] };
    }

    // the directions the other butterflies are flying
    function busyDirs() {
      return flock.filter(function (o) { return o.alive; }).map(function (o) { return o.dir; });
    }
    // its pace for a leg, in the mood of the page in view (a touch slower on a phone)
    function legSpeed() {
      return rand(30, 60) * page.speed * visit.speed * (phone ? 0.8 : 1.15);
    }

    function launch(b) {
      var W = VW, H = VH;
      // built the first time; afterwards the same butterfly is put back on
      // the page for each new flight (no new elements)
      if (!b.el) {
        var made = makeButterfly();
        b.el = made.el;
        b.wings = made.wings;
        b.sheen = made.sheen;
      }
      b.el.classList.remove("is-flying", "is-glint");
      // appear where there is room: of a few spots, the one farthest from the others
      var start = null, best = -1;
      for (var tryN = 0; tryN < 6; tryN++) {
        var cand = spawnPoint(pickCell(), W, H), near = 1e9;
        flock.forEach(function (o) {
          if (o.alive) near = Math.min(near, Math.sqrt((cand.x - o.x) * (cand.x - o.x) + (cand.y - o.y) * (cand.y - o.y)));
        });
        if (near > best) { best = near; start = cand; }
        if (near > spaceR() * 1.5) break;
      }
      var route = planLeg(start, null, W, H, busyDirs());
      b.dir = route.dir;
      b.x = start.x;
      b.y = start.y;
      b.path = route.path;
      b.pi = 0;
      var ahead = pathAt(b, 60);
      b.ang = Math.atan2(ahead.y - b.y, ahead.x - b.x) + rand(-0.3, 0.3);
      b.s = 0;         // how far along its curve the point it follows has moved
      b.lag = 0;       // time it has trailed far behind that point
      // now and then (about 2 flights in 5) a small loop or two on the way
      b.loopsLeft = Math.random() < 0.4 ? (Math.random() < 0.3 ? 2 : 1) : 0;
      b.loopIn = rand(2.5, 8);
      b.loop = 0;
      b.speed = b.speedTo = legSpeed(); // px per second
      b.turnRate = rand(1.1, 2.0);                    // how sharply it steers (rad/s)
      // small and delicate (smaller still on phones); now and then (about 1
      // in 5) a touch larger — never big
      var big = Math.random() < 0.2;
      b.size = phone ? (big ? rand(19, 22) : rand(14, 18)) : (big ? rand(24, 28) : rand(18, 23));
      // its own wing-beat: open → close → open about 1.5–2.4 times a
      // second, starting at a random point in the beat (never in step with
      // the others)
      b.period = rand(0.42, 0.66);                    // seconds per full beat
      b.phase = Math.random();
      b.fold = rand(0.1, 0.28);                       // how far this beat closes the wings
      b.pause = rand(0.08, 0.22);                     // how long it rests open
      b.rw1 = 2 * Math.PI / rand(2.5, 5); b.rw2 = 2 * Math.PI / rand(0.9, 1.7); // its rhythm's drift
      b.glideMix = 0; b.burstMix = 0;
      b.f1 = rand(0.3, 0.7); b.f2 = rand(0.8, 1.5);   // its own wander
      b.p1 = rand(0, 6.3); b.p2 = rand(0, 6.3);
      // its own, mismatched rhythms (so the motion never repeats):
      b.upA = rand(4, 10);  b.upW = 2 * Math.PI / rand(1.3, 2.6);   // climb-and-sink
      b.up2A = rand(2, 4);  b.up2W = 2 * Math.PI / rand(0.7, 1.1);  // a quicker flutter on top
      b.latA = rand(3, 8) * (phone ? 0.85 : 1.25); b.latW = 2 * Math.PI / rand(1.8, 3.4);  // side-to-side sway
      b.envW = 2 * Math.PI / rand(5, 9);                            // the float swelling and fading
      b.modW = 2 * Math.PI / rand(3, 6);                            // its pace wavering
      b.driftA = rand(2, 5) * (phone ? 1 : 1.8); b.driftW = 2 * Math.PI / rand(4, 8);   // a slight sideways drift on screen
      b.prevBob = null;
      b.spdW = 2 * Math.PI / rand(3, 6.5);                          // speeding up / easing off
      b.p3 = rand(0, 6.3); b.p4 = rand(0, 6.3); b.p5 = rand(0, 6.3); b.p6 = rand(0, 6.3); b.p7 = rand(0, 6.3);
      b.tilt = Math.cos(b.ang) * 22;  // smoothed lean
      b.prevAng = b.ang;
      b.burst = 0;                    // a short flurry of faster wing-beats
      b.glintIn = rand(1.5, 6);       // until light next catches its wings
      b.glint = 0;
      b.t = 0;
      b.glide = 0;
      b.alive = true;
      b.el.style.setProperty("--bf-size", b.size.toFixed(1) + "px");
      // its starting pose, set before it is shown
      b.el.style.transform = "translate3d(" + b.x.toFixed(1) + "px," + b.y.toFixed(1) + "px,0) rotate(" + b.tilt.toFixed(1) + "deg)";
      // added unseen, then faded softly into view where it is (from its first
      // frame on, in step)
      layer.appendChild(b.el);
      b.fadeIn = true;
    }

    // Only if the device is struggling: one butterfly fades away (and is taken
    // off the page); it comes back when the device keeps up again.
    function rest(b) {
      b.alive = false;
      b.el.classList.remove("is-flying", "is-glint");
      var el = b.el;
      setTimeout(function () { if (!b.alive) el.remove(); }, 900);
      b.wait = rand(4, 8);
    }

    // Six butterflies on a phone, seven on larger screens, all on the screen
    // together, staying in view (fewer only in data-saver mode or on a
    // struggling device). They appear one by one, never two at the same
    // moment. Phone or not is checked again if the screen turns or is resized.
    var VW = window.innerWidth, VH = window.innerHeight; // the screen, re-read only when it changes
    var phone = VW < 820;
    window.addEventListener("resize", function () {
      VW = window.innerWidth;
      VH = window.innerHeight;
      phone = VW < 820;
    });
    var saveData = !!(navigator.connection && navigator.connection.saveData);
    var count = saveData ? 3 : (phone ? 6 : 7); // three in data-saver mode
    function maxVisible() {
      if (quality === 0) return 1;              // very slow device
      if (saveData || quality === 1) return 3;  // light mode
      return count;
    }

    // ---- Stays light on every device ----
    // The real frame rate is watched over ~2-second windows. Below ~30 fps
    // only three butterflies fly (the others softly fade away); below ~20 fps
    // only one. They come back if the device speeds up again.
    var quality = 2, perfTime = 0, perfFrames = 0;
    function watchPerformance(rawDt) {
      if (rawDt > 0.5) return;          // a paused tab, not a slow device
      perfTime += rawDt;
      perfFrames++;
      if (perfTime < 2) return;
      var fps = perfFrames / perfTime;
      quality = fps < 20 ? 0 : fps < 30 ? 1 : 2;
      perfTime = 0;
      perfFrames = 0;
    }
    var MIN_GAP = 0.5;                  // seconds between any two appearances
    var sinceLaunch = MIN_GAP;
    var flock = [];
    for (var i = 0; i < count; i++) {
      flock.push({ el: null, alive: false, wait: rand(0.3, 4) }); // each arrives at its own moment
    }

    function angleDiff(a, b) {
      var d = b - a;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      return d;
    }

    var last = null;
    function step(now) {
      var rawDt = last === null ? 0 : (now - last) / 1000;
      var dt = Math.min(0.05, rawDt);
      last = now;
      if (rawDt > 0) watchPerformance(rawDt);
      sinceLaunch += dt;
      var flying = flock.filter(function (x) { return x.alive; }).length;
      // a struggling device: one fewer for now
      if (flying > maxVisible()) {
        rest(flock.filter(function (x) { return x.alive; })[0]);
        flying--;
      }
      flock.forEach(function (b) {
        if (!b.alive) {
          b.wait -= dt;
          if (b.wait <= 0) {
            if (flying < maxVisible() && sinceLaunch >= MIN_GAP) {
              launch(b);
              flying++;
              sinceLaunch = 0;
            } else {
              b.wait = rand(0.6, 3);    // too busy right now: try again a little later
            }
          }
          return;
        }
        b.t += dt;
        // it follows a point gliding along its curve a little ahead of it
        // (~70px), steering gradually — so it traces the curve the way a
        // butterfly would, never rigidly. The point waits if it falls behind
        // (and moves on anyway if it trails for long).
        // near the end of this leg: on into a new one, in a new direction,
        // carrying straight on from where it is and the way it is heading
        if (b.s >= b.path.total - 25) {
          var leg = planLeg({ x: b.x, y: b.y }, b.ang, VW, VH, busyDirs());
          b.path = leg.path;
          b.dir = leg.dir;
          b.pi = 0;
          b.s = 0;
          b.lag = 0;
          b.speedTo = legSpeed();               // its pace for this leg, in the page's mood
          if (b.loopsLeft <= 0 && Math.random() < 0.4) { b.loopsLeft = 1; b.loopIn = rand(2, 7); }
        }
        b.speed += (b.speedTo - b.speed) * Math.min(1, dt * 0.5); // eased, never a jolt
        var target = pathAt(b, b.s);
        var dx = target.x - b.x, dy = target.y - b.y;
        var gap = Math.sqrt(dx * dx + dy * dy);
        var spd = b.speed * (target.slow ? 0.7 : 1);
        b.lag = gap < 70 ? 0 : b.lag + dt;
        if ((gap < 70 || b.lag > 4) && b.loop <= 0) b.s = Math.min(b.path.total, b.s + spd * 1.15 * dt);
        // steer gradually toward it, with a little wander of its own
        var wander = Math.sin(b.t * b.f1 + b.p1) * 0.45 + Math.sin(b.t * b.f2 + b.p2) * 0.25;
        var turn = angleDiff(b.ang, Math.atan2(dy, dx)) * 1.6 + wander;
        var rate = b.turnRate;
        // others closer than the comfortable gap: it turns gently away — the
        // closer, the firmer — so they never bunch up, cross over or touch
        var R = spaceR(), sepX = 0, sepY = 0;
        for (var k = 0; k < flock.length; k++) {
          var o = flock[k];
          if (o === b || !o.alive) continue;
          var ox = b.x - o.x, oy = b.y - o.y, od = Math.sqrt(ox * ox + oy * oy);
          if (od < R && od > 0.01) {
            sepX += ox / od * (1 - od / R);
            sepY += oy / od * (1 - od / R);
            // really close: they also ease apart a little, directly
            if (od < R * 0.6) {
              b.x += ox / od * (R * 0.6 - od) * dt * 1.2;
              b.y += oy / od * (R * 0.6 - od) * dt * 1.2;
            }
          }
        }
        var push = Math.sqrt(sepX * sepX + sepY * sepY);
        if (push > 0.02) {
          var mix = Math.min(1, push * 2.5);
          turn = turn * (1 - mix) + angleDiff(b.ang, Math.atan2(sepY, sepX)) * 2.2 * mix;
          rate = b.turnRate * (1 + 0.8 * mix);
          if (push > 0.3) b.loop = 0;           // no loop with a neighbour this near
        }
        // close to an edge of the screen: it turns gently back in (and does
        // not loop there), so it never strays out of view
        var edgeM = 45;
        var inX = b.x < edgeM ? 1 : b.x + b.size > VW - edgeM ? -1 : 0;
        var inY = b.y < edgeM ? 1 : b.y + b.size > VH - edgeM ? -1 : 0;
        if (inX || inY) {
          turn = angleDiff(b.ang, Math.atan2(inY, inX)) * 2.5;
          rate = b.turnRate * 1.8;
          b.loop = 0;
        }
        // now and then a small loop: it keeps turning one way for a full
        // circle (one to two and a half seconds), then flies on
        var inside = b.x > 70 && b.x < VW - 70 && b.y > 70 && b.y < VH - 70; // loops only with room around
        if (b.loop > 0) {
          b.loop -= dt;
          b.ang += b.loopDir * b.loopRate * dt;
        } else {
          b.ang += Math.max(-rate, Math.min(rate, turn)) * dt;
          if (b.loopsLeft > 0 && inside && (b.loopIn -= dt) <= 0) {
            b.loopsLeft--;
            b.loop = rand(1.6, 2.6);
            b.loopRate = 2 * Math.PI / b.loop;
            b.loopDir = pick([-1, 1]);
            b.loopIn = rand(4, 9);
          }
        }
        // now and then a short glide: wings held almost open, drifting on
        if (b.glide > 0) b.glide -= dt;
        else if (b.burst <= 0 && Math.random() < dt * 0.1) b.glide = rand(0.7, 1.5);
        // ...and now and then a short flurry of quicker wing-beats
        if (b.burst > 0) b.burst -= dt;
        else if (b.glide <= 0 && Math.random() < dt * 0.08) b.burst = rand(0.5, 1.2);
        // both ease in and out over a fraction of a second, never switch
        b.glideMix += ((b.glide > 0 ? 1 : 0) - b.glideMix) * Math.min(1, dt * 5);
        b.burstMix += ((b.burst > 0 ? 1 : 0) - b.burstMix) * Math.min(1, dt * 4);

        // ---- its wings: open → close → open, in its own uneven rhythm ----
        // The beat drifts a little faster and slower all the time (quicker in
        // a flurry); every beat closes the wings by its own amount and rests
        // open for its own while. A quickening downstroke folds them, a
        // slower upstroke opens them, then a short rest fully spread.
        var period = b.period * (1 + 0.12 * Math.sin(b.t * b.rw1 + b.p1) + 0.06 * Math.sin(b.t * b.rw2 + b.p2)) * (1 - 0.35 * b.burstMix);
        b.phase += dt / period;
        if (b.phase >= 1) {
          b.phase -= 1;
          b.fold = rand(0.1, 0.28);
          b.pause = rand(0.08, 0.22);
        }
        var close = 0, ph = b.phase, opened = 1 - b.pause;
        if (ph < 0.34) close = (ph / 0.34) * (ph / 0.34);
        else if (ph < opened) close = (1 - (ph - 0.34) / (opened - 0.34)) * (1 - (ph - 0.34) / (opened - 0.34));
        var sx = 1 - (1 - b.fold) * close, sy = 1 - 0.06 * close;
        // in a glide: nearly open, with a light tremble
        sx += (0.87 + 0.09 * Math.sin(b.t * 3.3 + b.p3) - sx) * b.glideMix;
        sy += (0.995 - sy) * b.glideMix;
        if (b.fadeIn) {
          b.fadeIn = false;
          b.el.classList.add("is-flying");
        }
        var beat = "scale(" + sx.toFixed(3) + "," + sy.toFixed(3) + ")";
        b.wings.style.transform = beat;
        b.sheen.style.transform = beat;
        // the sheen brightens as the wings tilt toward the light
        b.sheen.style.opacity = (0.1 + 0.5 * (1 - sx)).toFixed(2);
        // speed rises and falls smoothly; slower round the centre, a little
        // quicker in a flurry, easing a touch in a glide
        var ease = 0.8 + 0.4 * (0.5 + 0.5 * Math.sin(b.t * b.spdW + b.p7));
        var v = spd * ease * (1 + 0.18 * b.burstMix) * (1 - 0.05 * b.glideMix);
        b.x += Math.cos(b.ang) * v * dt;
        b.y += Math.sin(b.ang) * v * dt;

        // ---- floating on the air, on top of the flight path ----
        // As it flies on, it bobs gently up and down, sways a little across
        // its path and drifts a touch sideways on the screen. Each comes from
        // slow waves of its own whose pace wavers and whose height swells and
        // fades over time, so the float never settles into a regular rhythm —
        // a living thing riding the air, not an object slid from A to B. It
        // rises with each downstroke, and sinks a little in a glide.
        var bob = b.upA * (0.7 + 0.3 * Math.sin(b.t * b.envW + b.p6)) *
                  Math.sin(b.t * b.upW + b.p3 + 0.8 * Math.sin(b.t * b.modW + b.p4))
                + b.up2A * Math.sin(b.t * b.up2W + b.p4) * (1 - 0.7 * b.glideMix)
                + 3 * b.glideMix
                - Math.sin(b.phase * 2 * Math.PI) * 1.6 * (1 - b.glideMix);
        var lat = b.latA * Math.sin(b.t * b.latW + b.p5 + 0.6 * Math.sin(b.t * b.modW * 0.7 + b.p2));
        var drift = b.driftA * Math.sin(b.t * b.driftW + b.p1);
        // the float eases in over its first second, so the butterfly sets off
        // exactly from where it appeared — never a jump
        var ein = Math.min(1, b.t / 1.2);
        ein = ein * ein * (3 - 2 * ein);
        bob *= ein; lat *= ein; drift *= ein;
        // ...and, with its float, it is always kept wholly on the screen
        var px = clamp(b.x - Math.sin(b.ang) * lat + drift, 0, VW - b.size);
        var py = clamp(b.y + Math.cos(b.ang) * lat + bob, 0, VH - b.size * 0.88);

        // lean: upright-ish, leaning the way it flies, banking into turns,
        // rolling a little with the float (more upright as it rises, tipping
        // on as it sinks), with a faint rock; eased so it never snaps
        var angVel = dt > 0 ? angleDiff(b.prevAng, b.ang) / dt : 0;
        b.prevAng = b.ang;
        var bank = Math.max(-16, Math.min(16, angVel * 14));
        var bobVel = dt > 0 && b.prevBob !== null ? (bob - b.prevBob) / dt : 0;
        b.prevBob = bob;
        var roll = Math.max(-5, Math.min(5, bobVel * 0.12)) * (Math.cos(b.ang) >= 0 ? 1 : -1);
        var tiltTarget = Math.cos(b.ang) * 22 + bank + roll + Math.sin(b.t * 1.3 + b.p6) * 4;
        b.tilt += (tiltTarget - b.tilt) * Math.min(1, dt * 5);
        var tilt = Math.max(-35, Math.min(35, b.tilt));
        b.el.style.transform = "translate3d(" + px.toFixed(1) + "px," + py.toFixed(1) + "px,0) rotate(" + tilt.toFixed(1) + "deg)";
        // now and then light catches its wings: a soft glow swells and fades
        // (about a second)
        if (b.glint > 0) {
          b.glint -= dt;
          if (b.glint <= 0) {
            b.glint = 0;
            b.el.classList.remove("is-glint");
            b.glintIn = rand(4, 10);
          }
        } else {
          b.glintIn -= dt;
          if (b.glintIn <= 0) {
            b.glint = rand(0.9, 1.4);
            b.el.classList.add("is-glint");
          }
        }
      });
      // Nothing in the air: rather than waking every frame, it sleeps until
      // the next butterfly is due (kind to the battery), then carries on.
      if (!flock.some(function (b) { return b.alive; })) {
        var due = Math.max(MIN_GAP - sinceLaunch,
                           Math.min.apply(null, flock.map(function (b) { return b.wait; })));
        if (due > 0.25) { sleep(due); return; }
      }
      requestAnimationFrame(step);
    }
    function sleep(sec) {
      var from = performance.now();
      setTimeout(function () {
        var gone = (performance.now() - from) / 1000;
        flock.forEach(function (b) { b.wait -= gone; });
        sinceLaunch += gone;
        last = null;                    // the flight clock carries on without a jump
        requestAnimationFrame(step);
      }, sec * 1000);
    }
    requestAnimationFrame(step);
  }

  function revealInvitation() {
    window.scrollTo(0, 0);
    body.classList.remove("is-locked");
    body.classList.add("is-open");
    invitation.removeAttribute("aria-hidden");
    cover.classList.add("is-leaving");
    startReveals();
    startButterflies();
    precheckRsvp(); // RSVP places left? (asked of the sheet)
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
  // One RSVP per email: the sheet turns away an email that has already been used.
  var RSVP_MSG_EMAIL = "Sila masukkan emel yang sah.";
  var RSVP_MSG_EMAIL_USED = "Emel ini telah digunakan untuk RSVP. Setiap emel hanya boleh menghantar satu RSVP.";
  var RSVP_EMAIL_MAX = 120;
  // The sheet accepts at most 100 RSVPs in total (counted there, from the
  // saved rows); once full it turns new ones away with code "rsvp_full", and
  // the form gives way to the "RSVP Telah Ditutup" card.
  var RSVP_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  // Choices for the dropdowns: each invitation is for the guest plus one
  // companion (2 adults) and up to 4 children, so the food is enough for all.
  // To change the limits, change `max` here.
  var RSVP_GUESTS = {
    adults:   { min: 1, max: 2, initial: 1 },
    children: { min: 0, max: 4, initial: 0 }
  };
  var RSVP_NAME_MIN = 2;
  var RSVP_WISH_MAX = 300;
  var RSVP_ATTENDANCE = ["Hadir", "Tidak Hadir"]; // first = default

  var rsvpForm = document.getElementById("rsvpForm");
  var rsvpName = document.getElementById("rsvpName");
  var rsvpNameField = document.getElementById("fieldName");
  var rsvpNameError = document.getElementById("rsvpNameError");
  var rsvpEmail = document.getElementById("rsvpEmail");
  var rsvpEmailField = document.getElementById("fieldEmail");
  var rsvpEmailError = document.getElementById("rsvpEmailError");
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
  var rsvpClosedCard = document.getElementById("rsvpClosedCard");
  var RSVP_LABEL_IDLE = "Hantar RSVP";
  var RSVP_LABEL_BUSY = "Menghantar...";
  var rsvpSubmitting = false; // a request is on its way: further clicks/Enter are ignored
  var rsvpSent = false;       // saved: the form is locked for good (one RSVP per visit)
  var rsvpClosed = false;     // the sheet said all 100 places are taken: nothing more is sent

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
      precheckRsvp(); // is there still a place? (asked of the sheet)
      rsvpGateBtn.setAttribute("aria-expanded", "true");
      var instant = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      setTimeout(function () {
        rsvpGate.hidden = true;
        if (rsvpClosed) {
          showRsvpClosedCard(false); // all 100 places taken: the closed notice, not the form
          rsvpClosedCard.focus({ preventScroll: true });
          return;
        }
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

  // Emel: required and in a valid form (name@domain.xx). `message` replaces the
  // error text — used when the sheet says the email has already been used.
  function validateEmail(showError, message) {
    var value = rsvpEmail.value.trim();
    var ok = !message && value.length <= RSVP_EMAIL_MAX && RSVP_EMAIL_RE.test(value);
    if (showError || message || rsvpEmailField.classList.contains("field--invalid")) {
      rsvpEmailField.classList.toggle("field--invalid", !ok);
      rsvpEmail.setAttribute("aria-invalid", String(!ok));
      rsvpEmailError.textContent = message || RSVP_MSG_EMAIL;
      rsvpEmailError.hidden = ok;
    }
    return ok;
  }

  // Kehadiran: "Hadir" (the default) or "Tidak Hadir"; anything else falls back to "Hadir".
  function getAttendance() {
    var value = rsvpForm.elements.attendance ? rsvpForm.elements.attendance.value : "";
    return RSVP_ATTENDANCE.indexOf(value) !== -1 ? value : RSVP_ATTENDANCE[0];
  }

  // The RSVP record — exactly these seven fields, nothing else (no phone or
  // address is collected). The email is kept private in the sheet, only to
  // allow one RSVP per email; it is never shown on the website.
  function getRsvpData() {
    var adults = guestCount(rsvpAdults);
    var children = guestCount(rsvpChildren);
    return {
      name: rsvpName.value.trim(),
      email: rsvpEmail.value.trim().toLowerCase(),
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

  function showRsvpError(show, text) {
    rsvpStatus.textContent = show ? (text || RSVP_MSG_ERROR) : "";
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

  // ---- 100 RSVPs in total, counted in the Google Sheet ----
  // Asks the sheet (GET ?action=status, read live there) whether places are
  // left. Resolves true when all are taken, false when there is room, and
  // null when the sheet can't be reached — the sheet still enforces the limit
  // itself when the RSVP is sent, so nothing can get past it.
  var RSVP_STATUS_TIMEOUT_MS = 12000;
  function checkRsvpFull() {
    var controller = typeof AbortController === "function" ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, RSVP_STATUS_TIMEOUT_MS) : null;
    return fetch(GOOGLE_SCRIPT_URL + "?action=status", {
      method: "GET",
      redirect: "follow",
      signal: controller ? controller.signal : undefined
    })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (result) {
        return result && result.success === true ? result.full === true : null;
      })
      .catch(function () { return null; })
      .then(function (full) {
        if (timer) clearTimeout(timer);
        return full;
      });
  }
  // All 100 places taken: RSVP is closed to new submissions. Nothing more is
  // sent, and the form gives way to the "RSVP Telah Ditutup" card (if the
  // RSVP envelope hasn't been opened yet, the card shows when it is). Only
  // the RSVP form is affected — the rest of the invitation stays as it is.
  // turnedAway: this guest pressed HANTAR RSVP after the last place had gone
  // (while they were filling in the form) — the card then says so, gently:
  // "Maaf, kuota RSVP telah penuh. Terima kasih atas perhatian anda."
  function closeRsvp(turnedAway) {
    rsvpClosed = true;
    rsvpSubmitting = false;
    rsvpSubmitLabel.textContent = RSVP_LABEL_IDLE;
    rsvpSubmit.disabled = true;
    rsvpForm.setAttribute("aria-busy", "false");
    showRsvpError(false);
    if (!rsvpForm.hidden) showRsvpClosedCard(turnedAway);
  }
  function showRsvpClosedCard(turnedAway) {
    document.getElementById("rsvpClosedLead").hidden = !!turnedAway;
    document.getElementById("rsvpClosedSorry").hidden = !turnedAway;
    rsvpForm.hidden = true;
    rsvpClosedCard.hidden = false;
    if (turnedAway) {
      rsvpClosedCard.focus({ preventScroll: true });
      rsvpClosedCard.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
    }
  }
  // Checked as the invitation opens and again when the RSVP envelope is
  // opened, so a guest learns before filling it in if there is no place left.
  function precheckRsvp() {
    if (rsvpSent || rsvpClosed) return;
    checkRsvpFull().then(function (full) {
      if (full === true && !rsvpSent && !rsvpSubmitting) closeRsvp(false);
    });
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
        if (!result || result.success !== true) {
          var notSaved = new Error("Not saved");
          if (result && result.code) notSaved.code = result.code; // e.g. "duplicate_email"
          throw notSaved;
        }
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
  rsvpEmail.addEventListener("input", function () { validateEmail(false); });
  rsvpEmail.addEventListener("blur", function () { if (rsvpEmail.value) validateEmail(true); });

  // After a successful RSVP (saved in the Google Sheet), the confirmation
  // modal is told what was sent. It listens for the "rsvp:success" event on
  // the document; event.detail is a copy of the RSVP: name, attendance,
  // adults, children, totalGuests and message. Fired only once the sheet
  // has answered {"success": true} — never on errors or while sending.
  var rsvpConfirmed = false; // one confirmation per page: the form can only be sent once
  function onRsvpSuccess(data) {
    if (rsvpConfirmed) return;
    rsvpConfirmed = true;
    var detail = {
      name: data.name,
      attendance: data.attendance,
      adults: data.adults,
      children: data.children,
      totalGuests: data.totalGuests,
      message: data.message
    };
    document.dispatchEvent(new CustomEvent("rsvp:success", { detail: detail }));
  }

  /* ---------- RSVP confirmation modal ---------- */

  // Opens on "rsvp:success" (only after the sheet has saved the RSVP) with a
  // summary of what was sent. Everything is set as plain text. TUTUP, Escape
  // or a tap outside the card closes it; focus then returns to the page.
  var rsvpModal = document.getElementById("rsvpModal");
  var rsvpModalClose = document.getElementById("rsvpModalClose");

  // Shown ONCE per browser: closing it saves rsvpConfirmationShown = true in
  // localStorage, so it never appears again in this browser — not after a
  // refresh, not after leaving and coming back, not after reopening the
  // site. It is only ever opened by a successful RSVP, never on page load.
  // (If the browser blocks storage, e.g. some private modes, the modal just
  // behaves as before for that visit.)
  var RSVP_CONFIRM_KEY = "rsvpConfirmationShown";
  function confirmationAlreadyShown() {
    try { return localStorage.getItem(RSVP_CONFIRM_KEY) === "true"; } catch (err) { return false; }
  }
  function rememberConfirmationShown() {
    try { localStorage.setItem(RSVP_CONFIRM_KEY, "true"); } catch (err) { /* storage unavailable */ }
  }
  var rsvpModalTimer = null;
  var rsvpModalReturnFocus = null;

  function openRsvpModal(d) {
    if (confirmationAlreadyShown()) return; // already seen once in this browser
    if (!rsvpModal.hidden) return;          // already open: never stack a second one
    document.getElementById("rsvpModalName").textContent = d.name;
    document.getElementById("rsvpModalAttendance").textContent = d.attendance;
    document.getElementById("rsvpModalAdults").textContent = String(d.adults);
    document.getElementById("rsvpModalChildren").textContent = String(d.children);
    document.getElementById("rsvpModalTotal").textContent = String(d.totalGuests);
    var wish = (d.message || "").trim();
    document.getElementById("rsvpModalWish").textContent = wish ? "“" + wish + "”" : "";
    document.getElementById("rsvpModalWishWrap").hidden = !wish;

    rsvpModalReturnFocus = document.getElementById("rsvpThanks") || document.activeElement;
    clearTimeout(rsvpModalTimer);
    rsvpModal.hidden = false;
    body.classList.add("modal-open");
    void rsvpModal.offsetWidth; // start the fade from the closed state
    rsvpModal.classList.add("is-open");
    rsvpModalClose.focus({ preventScroll: true });
  }

  function closeRsvpModal() {
    if (rsvpModal.hidden || !rsvpModal.classList.contains("is-open")) return;
    rsvpModal.classList.remove("is-open");
    body.classList.remove("modal-open");
    rememberConfirmationShown(); // TUTUP (or Escape / a tap outside): never show it again
    rsvpModalTimer = setTimeout(function () { rsvpModal.hidden = true; }, reduceMotion ? 0 : 500);
    if (rsvpModalReturnFocus && rsvpModalReturnFocus.focus) rsvpModalReturnFocus.focus({ preventScroll: true });
  }

  document.addEventListener("rsvp:success", function (e) { openRsvpModal(e.detail); });
  rsvpModal.addEventListener("click", function (e) {
    if (e.target.closest("[data-modal-close]")) closeRsvpModal();
  });
  document.addEventListener("keydown", function (e) {
    if (rsvpModal.hidden || !rsvpModal.classList.contains("is-open")) return;
    if (e.key === "Escape") {
      e.preventDefault();
      closeRsvpModal();
    } else if (e.key === "Tab") { // TUTUP is the only control: keep focus on it
      e.preventDefault();
      rsvpModalClose.focus();
    }
  });

  rsvpForm.addEventListener("submit", function (e) {
    e.preventDefault();
    // One request at a time, and one RSVP only: clicks, taps or Enter while
    // sending — or after it has been saved — are ignored.
    if (rsvpSubmitting || rsvpSent || rsvpClosed) return;

    // 1. Validate
    var nameOk = validateName(true);
    var emailOk = validateEmail(true);
    if (!nameOk || !emailOk) {
      (nameOk ? rsvpEmail : rsvpName).focus();
      return;
    }

    // 2. Calculate the total (the server recalculates it too)
    updateGuestTotal();
    var data = getRsvpData();

    // 3–4. Disable the button and show "Menghantar..."
    showRsvpError(false);
    setSubmitting(true);

    // 5. Recheck with the sheet that a place is still left (all 100 may have
    // gone since the page opened). If they have, nothing is sent. If the
    // check can't be made, the RSVP is sent anyway: the sheet counts again,
    // under its lock, before writing — so even guests sending at the same
    // moment can never take it past 100.
    checkRsvpFull().then(function (full) {
      if (full === true) {
        closeRsvp(true);
        return;
      }
      // 6–8. Send, wait and handle the JSON reply. "Saved" and "not saved" are
      // decided ONLY by the sheet's answer: success when the Apps Script has
      // written the row (RSVP + optional ucapan, in one row) and replied
      // {"success": true}; anything else — offline, timeout, HTTP error,
      // unreadable reply, {"success": false} — is a failure.
      sendRsvp(data).then(rsvpSaved, rsvpFailed);
    });

    function rsvpSaved(result) {
      // This RSVP may have filled the last place: it is saved and confirmed
      // like any other (no "closed" message for this guest); the page just
      // notes that RSVP is now closed, so nothing more can be sent from it.
      if (result && result.full === true) rsvpClosed = true;
      // Saved: lock the form for good (it is replaced by the thank-you card,
      // so the RSVP can't be sent a second time) and put the button's label
      // back to "Hantar RSVP"; the button itself stays disabled.
      rsvpSent = true;
      rsvpSubmitting = false;
      rsvpSubmitLabel.textContent = RSVP_LABEL_IDLE;
      rsvpSubmit.disabled = true;
      rsvpForm.setAttribute("aria-busy", "false");
      try {
        showRsvpThanks(data);
      } catch (err) {
        console.error(err);
      }
      try {
        loadPublicSummary(); // the wishes below now include this RSVP
      } catch (err) {
        console.error(err);
      }
      // A problem updating the page above must never hide a saved RSVP:
      // the confirmation is always triggered once the sheet has said yes.
      onRsvpSuccess(data);
    }

    function rsvpFailed(err) {
      // Not saved: no confirmation. The existing error message shows, and
      // what the guest typed is kept so they can simply try again. If the
      // sheet already has an RSVP from this email, it is turned away: the
      // email box says so.
      setSubmitting(false);
      if (err && err.code === "rsvp_full") {
        // All places were taken just before this one reached the sheet.
        closeRsvp(true);
        return;
      }
      if (err && err.code === "duplicate_email") {
        validateEmail(true, RSVP_MSG_EMAIL_USED);
        showRsvpError(true, RSVP_MSG_EMAIL_USED);
        rsvpEmail.focus();
        return;
      }
      showRsvpError(true);
    }
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
