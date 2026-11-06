/* Incheve — Firebase adapter.
   The app was written for the claude.ai artifact runtime (window.claude.use).
   This file provides the same small API on top of Firebase Auth + Firestore,
   so the app code itself stays unchanged. */
(function () {
  "use strict";
  var CFG = window.INCHEVE_FIREBASE || {};
  var ADMINS = (CFG.adminEmails || []).map(function (s) { return String(s).trim().toLowerCase(); });

  /* ---------- tiny UI (login, import) ---------- */
  var css = document.createElement("style");
  css.textContent =
    "#fbov{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;background:#eef3f8;font-family:'Noto Sans Armenian',Roboto,system-ui,sans-serif;color:#1e2740}" +
    "@media(prefers-color-scheme:dark){#fbov{background:#14161c!important}}" +
    "#fbov .bx{background:#fff!important;color:#1e2740!important;border-color:#e3ddd3!important}#fbov .bx h1,#fbov .bx p,#fbov .bx label,#fbov .bx b,#fbov .bx span{color:#1e2740}#fbov p{opacity:.75}#fbov .bx input{background:#fff;color:#1e2740}#fbov button.gh{color:#1e2740!important}#fbov .drop span,#fbov .dz span{color:#55607a}" +
    "#fbov .bx{width:100%;max-width:360px;background:#fff;border:1px solid #e3ddd3;border-radius:16px;padding:24px;box-shadow:0 10px 40px rgba(0,0,0,.08)}" +
    "#fbov h1{font-size:20px;margin:0 0 4px}#fbov p{margin:0 0 16px;font-size:14px;opacity:.7;line-height:1.45}" +
    "#fbov label{display:block;font-size:13px;margin:10px 0 4px;opacity:.8}" +
    "#fbov input{width:100%;box-sizing:border-box;font:inherit;font-size:16px;padding:11px 12px;border:1px solid #d6cfc3;border-radius:10px}" +
    "#fbov button{width:100%;margin-top:16px;font:inherit;font-weight:600;font-size:16px;padding:12px;border:0;border-radius:10px;background:#1d527a;color:#fff;cursor:pointer}" +
    "#fbov button.gh{background:transparent;color:inherit;border:1px solid #d6cfc3;margin-top:8px;font-weight:500}" +
    "#fbov button.gg{display:flex;align-items:center;justify-content:center;gap:10px;background:#fff;color:#1f1f1f;border:1px solid #d6cfc3;margin-top:4px}#fbov .or{display:flex;align-items:center;gap:10px;margin:16px 0 0;font-size:12.5px;opacity:.6}#fbov .or:before,#fbov .or:after{content:'';flex:1;border-top:1px solid #d6cfc3}" +
    "#fbov .dz{display:flex;flex-direction:column;align-items:center;gap:4px;padding:22px 12px;border:2px dashed #b9c6d4;border-radius:12px;cursor:pointer;text-align:center;font-size:14px;transition:background .15s,border-color .15s}#fbov .dz span{font-size:12.5px;opacity:.65}#fbov .dz.over{border-color:#1d527a;background:rgba(29,82,122,.08)}#fbov .dz.ok{border-style:solid;border-color:#2e7d4f;background:rgba(46,125,79,.07)}" +
    "#fbov .arrow{position:fixed;top:6px;right:14px;font-size:34px;color:#fff;animation:fbar 1.2s ease-in-out infinite}@keyframes fbar{50%{transform:translate(4px,-4px)}}#fbov .sts{display:flex;flex-direction:column;gap:10px;margin:4px 0 6px}#fbov .st{display:flex;gap:10px;align-items:center;font-size:14.5px}#fbov .st i{flex:none;width:26px;height:26px;border-radius:50%;background:#1d527a;color:#fff;font-style:normal;font-weight:700;display:grid;place-items:center;font-size:13px}#fbov .cph{font-size:12.5px;margin:8px 0 0}#fbov button.ok{background:#2e7d4f}#fbov a.gh2{background:transparent!important;color:#1e2740!important;border:1px solid #d6cfc3;margin-top:10px}#fbov .er{word-break:break-all}" +
    "#fbov a.btnl{display:block;text-align:center;text-decoration:none;margin-top:4px;font-weight:600;font-size:16px;padding:12px;border-radius:10px;background:#1d527a;color:#fff}" +
    "#fbov .sah{font-size:13px!important;opacity:.85!important;margin:14px 0 0!important;line-height:1.45}" +
    "#fbov button:disabled{opacity:.5}#fbov .er{color:#c0392b;font-size:13px;margin-top:10px;min-height:1em}";
  document.head.appendChild(css);

  function overlay(html) {
    var o = document.getElementById("fbov");
    if (!o) { o = document.createElement("div"); o.id = "fbov"; document.body.appendChild(o); }
    o.innerHTML = '<div class="bx">' + html + "</div>";
    return o;
  }
  function closeOverlay() { var o = document.getElementById("fbov"); if (o) o.remove(); }

  if (!window.firebase || !CFG.config || !CFG.config.apiKey || /PASTE/.test(CFG.config.apiKey)) {
    document.addEventListener("DOMContentLoaded", function () {
      overlay("<h1>Կարգավորում չկա</h1><p>config.js ֆայլում տեղադրեք Firebase-ի firebaseConfig-ը (տես ուղեցույցը, քայլ 4)։</p>");
    });
    window.claude = { use: function () { return new Promise(function () {}); } };
    return;
  }

  var conf = Object.assign({}, CFG.config);
  var SA = !!((window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone); // opened from the home-screen icon
  var OWN = /\.netlify\.app$|^incheve\./.test(location.hostname);
  if (OWN && CFG.authProxy !== false) conf.authDomain = location.host; // sign-in pages from our own domain: Safari keeps the sign-in state (no cross-site storage) // sign-in pages served from our own domain (/__/auth → firebaseapp.com)
  firebase.initializeApp(conf);
  var auth = firebase.auth();
  var fs = firebase.firestore();
  fs.settings({ ignoreUndefinedProperties: true, merge: true });
  try { if (fs.enablePersistence) fs.enablePersistence({ synchronizeTabs: true }).catch(function () {}); } catch (e) {} // works offline, syncs later

  /* ---------- error codes → the codes the app expects ---------- */
  var CODE = { "permission-denied": "invalid_argument", "unauthenticated": "invalid_argument", "unavailable": "unavailable",
    "deadline-exceeded": "timeout", "not-found": "not_found", "resource-exhausted": "quota_exceeded", "invalid-argument": "invalid_argument" };
  function mapErr(e) {
    var c = String((e && e.code) || "").replace(/^firestore\//, "");
    var o = new Error((e && e.message) || String(e));
    o.code = CODE[c] || c.replace(/-/g, "_") || "unknown";
    return o;
  }
  function P(p) { return p.catch(function (e) { throw mapErr(e); }); }
  function clean(d) { return JSON.parse(JSON.stringify(d === undefined ? {} : d)); }
  function onErr(er) { return function (e) { if (er) er(mapErr(e)); else console.warn(e); }; }

  /* ---------- db: same shape as claude.use("db") ---------- */
  function wq(q) {
    return {
      where: function (f, o, v) { return wq(q.where(f, o, v)); },
      orderBy: function (f, d) { return wq(q.orderBy(f, d || "asc")); },
      limit: function (n) { return wq(q.limit(n)); },
      get: function () { return P(q.get()); },
      onSnapshot: function (n, er) { return q.onSnapshot(n, onErr(er)); }
    };
  }
  function wd(r) {
    return {
      id: r.id, path: r.path,
      get: function () { return P(r.get()); },
      set: function (d, o) { return P(o ? r.set(clean(d), o) : r.set(clean(d))); },
      update: function (d) { return P(r.update(clean(d))); },
      "delete": function () { return P(r["delete"]()); },
      onSnapshot: function (n, er) { return r.onSnapshot(n, onErr(er)); },
      collection: function (c) { return wc(r.collection(c)); }
    };
  }
  function wc(c) {
    var o = wq(c);
    o.path = c.path;
    o.doc = function (id) { return wd(id ? c.doc(id) : c.doc()); };
    o.add = function (d) { var r = c.doc(); return P(r.set(clean(d))).then(function () { return wd(r); }); };
    return o;
  }
  var db = { doc: function (p) { return wd(fs.doc(p)); }, collection: function (p) { return wc(fs.collection(p)); } };

  /* ---------- user ---------- */
  var isAdmin = false;
  var user = {
    canEdit: function () { return Promise.resolve(true); }, // PIN level decides inside the app
    isOwner: function () { return Promise.resolve(isAdmin); },
    can: function () { return Promise.resolve(true); },
    id: function () { return Promise.resolve(auth.currentUser ? auth.currentUser.uid : null); },
    email: function () { return Promise.resolve(auth.currentUser ? auth.currentUser.email : null); },
    signOut: function () { try { localStorage.removeItem('incheve-bo-session'); } catch (e) {} return auth.signOut().then(function () { location.reload(); }); }
  };

  /* ---------- downloads ---------- */
  var downloads = {
    save: function (r) {
      var b = r.data instanceof Blob ? r.data : new Blob([r.data], { type: /\.html?$/i.test(r.filename) ? "text/html;charset=utf-8" : /\.csv$/i.test(r.filename) ? "text/csv;charset=utf-8" : "application/octet-stream" });
      var u = URL.createObjectURL(b), a = document.createElement("a");
      a.href = u; a.download = r.filename || "download"; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(u); }, 4000);
      return Promise.resolve({ status: "saved" });
    }
  };

  /* ---------- assets: small files stored in Firestore (no paid Storage needed) ---------- */
  function hex32() { var a = new Uint8Array(16); crypto.getRandomValues(a); return Array.prototype.map.call(a, function (x) { return ("0" + x.toString(16)).slice(-2); }).join(""); }
  function toDataUrl(b) { return new Promise(function (ok, no) { var f = new FileReader(); f.onload = function () { ok(f.result); }; f.onerror = no; f.readAsDataURL(b); }); }
  var assets = {
    upload: function (blob, o) {
      if (blob.size > 700 * 1024) { var e = new Error("Ֆայլը մեծ է (առավելագույնը 700 ԿԲ)"); e.code = "quota_exceeded"; return Promise.reject(e); }
      return toDataUrl(blob).then(function (d) {
        var id = hex32();
        return P(fs.doc("blobs/" + id).set({ d: d, type: (o && o.type) || blob.type || "", ts: Date.now() })).then(function () { BC[id] = d; return { id: id }; });
      });
    }
  };
  var BC = {};
  function blobData(id) {
    if (BC[id]) return Promise.resolve(BC[id]);
    return fs.doc("blobs/" + id).get().then(function (s) { var d = s.exists ? s.data().d : ""; BC[id] = d; return d; });
  }
  function fillImgs(root) {
    (root.querySelectorAll ? root : document).querySelectorAll("img[data-blob]").forEach(function (im) {
      var id = im.getAttribute("data-blob"); im.removeAttribute("data-blob");
      blobData(id).then(function (d) { if (d) im.src = d; else im.onerror && im.onerror(); }).catch(function () {});
    });
  }
  new MutationObserver(function (ms) { ms.forEach(function (m) { m.addedNodes.forEach(function (n) { if (n.nodeType === 1) { if (n.matches && n.matches("img[data-blob]")) fillImgs(n.parentNode); else fillImgs(n); } }); }); })
    .observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a[data-blobl]"); if (!a) return; e.preventDefault();
    var w = window.open("", "_blank");
    blobData(a.getAttribute("data-blobl")).then(function (d) {
      if (!d) { if (w) w.close(); return; }
      fetch(d).then(function (r) { return r.blob(); }).then(function (b) { var u = URL.createObjectURL(b); if (w) w.location = u; else location.href = u; });
    });
  });

  /* ---------- sign in, then (first time) import ---------- */
  var readyResolve; var ready = new Promise(function (r) { readyResolve = r; });

  /* Messenger / Instagram / Facebook etc. open links in their own browser where Google sign-in is blocked */
  function inApp() { return /FBAN|FBAV|FB_IAB|FBIOS|FB4A|Messenger|Instagram|MicroMessenger|Line\/|Snapchat|TikTok|musical_ly|; wv\)/i.test(navigator.userAgent || ""); }
  function inAppScreen() {
    var url = location.origin + location.pathname, ua = navigator.userAgent || "", ios = /iPhone|iPad|iPod/i.test(ua), and = /Android/i.test(ua);
    var app = /Messenger|FBAN|FBAV|FB_IAB|FBIOS|FB4A/i.test(ua) ? "Messenger-ի" : /Instagram/i.test(ua) ? "Instagram-ի" : "հավելվածի";
    var step = function (n, h) { return '<div class="st"><i>' + n + '</i><span>' + h + '</span></div>'; };
    var o = overlay('<div class="arrow" aria-hidden="true">↗</div><h1>Բացեք Safari, Chrome կամ Brave-ով</h1><p>Կայքը բացվել է ' + app + ' ներսում։ Այստեղ Google-ը մուտք չի թույլատրում, իսկ ' + (ios ? "iPhone-ը" : "հավելվածը") + ' թույլ չի տալիս Safari-ն բացել կոճակով։</p>' +
      '<div class="sts">' + step(1, 'Սեղմեք վերևի աջ անկյան <b>•••</b>-ը') + step(2, 'Ընտրեք <b>' + (ios ? "Open in external browser" : "Open in browser") + '</b>' + (ios ? " (կամ «Open in Safari»)" : "")) + '</div>' +
      '<div class="or"><span>կամ</span></div>' +
      '<button id="fb_cp">Պատճենել հղումը</button><p class="cph" id="fb_cph">Հետո բացեք Safari-ն, Chrome-ը կամ Brave-ը և տեղադրեք հասցեի տողում։</p>' +
      (and ? '<a class="btnl gh2" href="intent://' + location.host + location.pathname + '#Intent;scheme=https;package=com.android.chrome;end">Բացել Chrome-ով</a>' : "") +
      '<div class="er" id="fb_er"></div>');
    o.querySelector("#fb_cp").onclick = function () {
      var b = this, ok = function () { b.textContent = "✓ Պատճենված է"; b.classList.add("ok"); o.querySelector("#fb_cph").style.fontWeight = "600"; };
      var old = function () { var t = document.createElement("textarea"); t.value = url; t.setAttribute("readonly", ""); t.style.position = "fixed"; t.style.opacity = "0"; document.body.appendChild(t); t.select(); t.setSelectionRange(0, 999); var r = false; try { r = document.execCommand("copy"); } catch (e) {} t.remove(); if (r) ok(); else o.querySelector("#fb_er").textContent = url; };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(ok, old); else old();
    };
  }
  function loginForm(msg) {
    if (inApp()) { inAppScreen(); return; }
    var o = overlay('<h1>Incheve · Back Office</h1><p>Մուտք գործեք ձեր Google հաշվով</p>' +
      '<button type="button" id="fb_g" class="gg"><svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg><span>Մուտք Google-ով</span></button>' +
      ((CFG.emailLogin || SA) ? (SA ? '<p class="sah">Հավելվածում մուտք գործեք էլ. փոստով և գաղտնաբառով։ Գաղտնաբառը մեկ անգամ սահմանեք Safari-ում՝ անվան մենյուից → «Գաղտնաբառ հավելվածի համար»։</p>' : '<div class="or"><span>կամ էլ. փոստով</span></div>') +
      '<form id="fb_f"><label>Էլ. փոստ</label><input id="fb_e" type="email" autocomplete="username" required>' +
      '<label>Գաղտնաբառ</label><input id="fb_p" type="password" autocomplete="current-password" required>' +
      '<button id="fb_b" type="submit">Մուտք</button><div class="er" id="fb_er">' + (msg || "") + "</div></form>" : '<div class="er" id="fb_er">' + (msg || "") + "</div>"));
    o.querySelector("#fb_g").onclick = function () {
      var b = this; b.disabled = true; var pr = new firebase.auth.GoogleAuthProvider(); pr.setCustomParameters({ prompt: "select_account" });
      (standalone() ? auth.signInWithRedirect(pr) : auth.signInWithPopup(pr)).catch(function (er) { // popup must open straight from the tap (Safari blocks it after an await)
        var c = er && er.code || "";
        if (/popup-blocked|operation-not-supported|web-storage/.test(c)) return auth.signInWithRedirect(pr);
        b.disabled = false; if (/popup-closed|cancelled/.test(c)) return;
        o.querySelector("#fb_er").textContent = /unauthorized-domain/.test(c) ? "Կայքի հասցեն ավելացրեք Firebase → Authentication → Settings → Authorized domains" : /network/.test(c) ? "Ինտերնետ կապ չկա" : (er.message || c)
        if (navigator.brave) o.querySelector("#fb_er").textContent += " · Brave-ում հասցեի տողի առյուծի նշանով անջատեք Shields-ը այս կայքի համար և փորձեք կրկին։";
      });
    };
    if (o.querySelector("#fb_f")) o.querySelector("#fb_f").onsubmit = function (e) {
      e.preventDefault();
      var b = o.querySelector("#fb_b"); b.disabled = true;
      auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).then(function () {
        return auth.signInWithEmailAndPassword(o.querySelector("#fb_e").value.trim(), o.querySelector("#fb_p").value);
      }).catch(function (er) {
        b.disabled = false;
        var c = er && er.code || "";
        o.querySelector("#fb_er").textContent = /invalid|wrong|not-found|credential/.test(c) ? "Սխալ էլ. փոստ կամ գաղտնաբառ" : /network/.test(c) ? "Ինտերնետ կապ չկա" : /too-many/.test(c) ? "Շատ փորձեր. փորձեք մի քիչ ուշ" : (er.message || c);
      });
    };
  }

  function importScreen() {
    return new Promise(function (done) {
      var o = overlay('<h1>Բազան դատարկ է</h1><p>Առաջին անգամ ընտրեք <b>incheve-data.json</b> ֆայլը՝ ապրանքները, կարգավորումները և թիմը ներմուծելու համար։</p>' +
        '<label class="dz" id="fb_dz"><input id="fb_file" type="file" accept=".json,application/json" hidden><b>Քաշեք ֆայլը այստեղ</b><span>կամ սեղմեք՝ ընտրելու համար</span></label><button id="fb_imp" disabled>Ներմուծել</button>' +
        '<button class="gh" id="fb_skip">Սկսել դատարկ</button><div class="er" id="fb_er"></div>');
      var data = null;
      var dz = o.querySelector("#fb_dz");
      function take(f) {
        if (!f) return;
        f.text().then(function (t) { data = JSON.parse(t); var n = 0; Object.keys(data).forEach(function (c) { if (c !== "_meta" && data[c] && typeof data[c] === "object") n += Object.keys(data[c]).length; else delete data[c]; });
            dz.classList.add("ok"); dz.querySelector("b").textContent = "✓ " + f.name; dz.querySelector("span").textContent = n + " գրառում"; o.querySelector("#fb_er").textContent = ""; o.querySelector("#fb_imp").disabled = false; })
          .catch(function () { data = null; o.querySelector("#fb_imp").disabled = true; o.querySelector("#fb_er").textContent = "Ֆայլը չի կարդացվում"; });
      }
      o.querySelector("#fb_file").onchange = function (e) { take(e.target.files[0]); };
      ["dragenter", "dragover"].forEach(function (ev) { dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.add("over"); }); });
      ["dragleave", "drop"].forEach(function (ev) { dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.remove("over"); }); });
      dz.addEventListener("drop", function (e) { take(e.dataTransfer.files[0]); });
      o.addEventListener("dragover", function (e) { e.preventDefault(); }); o.addEventListener("drop", function (e) { e.preventDefault(); if (!dz.contains(e.target)) take(e.dataTransfer.files[0]); });
      o.querySelector("#fb_skip").onclick = function () { done(); };
      o.querySelector("#fb_imp").onclick = function () {
        var b = this; b.disabled = true;
        var writes = [];
        Object.keys(data).forEach(function (col) { Object.keys(data[col]).forEach(function (id) { writes.push([col + "/" + id, data[col][id]]); }); });
        var i = 0;
        (function next() {
          if (i >= writes.length) { done(); return; }
          var batch = fs.batch();
          writes.slice(i, i + 400).forEach(function (w) { batch.set(fs.doc(w[0]), clean(w[1])); });
          i += 400; b.textContent = "Ներմուծվում է… " + Math.min(i, writes.length) + "/" + writes.length;
          batch.commit().then(next).catch(function (e) { b.disabled = false; o.querySelector("#fb_er").textContent = "Սխալ: " + (e.message || e.code); });
        })();
      };
    });
  }

  if (/[?&]logout\b/.test(location.search)) { try { localStorage.removeItem('incheve-bo-session'); } catch (e) {} auth.signOut().then(function () { location.replace(location.pathname); }); }

  function standalone() { return SA && OWN && conf.authDomain === location.host; }
  var redirErr = "";
  auth.getRedirectResult().catch(function (er) { var c = er && er.code || ""; redirErr = /unauthorized-domain/.test(c) ? "Կայքի հասցեն ավելացրեք Firebase → Authentication → Settings → Authorized domains" : "Google մուտքը չստացվեց (" + (c || er.message) + ")։ Փորձեք կրկին Safari, Chrome կամ Brave բրաուզերով" + (navigator.brave ? " (Brave-ում անջատեք Shields-ը այս կայքի համար)" : "") + "։"; var e = document.getElementById("fb_er"); if (e) e.textContent = redirErr; });
  var started = false;
  auth.onAuthStateChanged(function (u) {
    if (!u) { if (started) location.reload(); else loginForm(redirErr); return; }
    if (started) return; started = true;
    var em = String(u.email || "").toLowerCase();
    isAdmin = u.emailVerified && ADMINS.indexOf(em) >= 0;
    var go = function () { closeOverlay(); readyResolve(); };
    var deny = function () {
      var o = overlay('<h1>Մուտք չկա</h1><p><b>' + (u.email || "") + '</b> հաշիվը ավելացված չէ աշխատակազմում։ Խնդրեք ղեկավարին «Աշխատակազմ → Տվյալներ» բաժնում ավելացնել ձեր Gmail-ը։</p><button id="fb_out">Մուտք այլ հաշվով</button>');
      o.querySelector("#fb_out").onclick = function () { user.signOut(); };
    };
    if (!isAdmin) {
      if (!u.emailVerified) { deny(); return; }
      fs.doc("allow/" + em).get().then(function (s) { if (s.exists) go(); else deny(); }, deny); return;
    }
    fs.doc("settings/main").get().then(function (s) { return s.exists ? null : importScreen(); }).then(go, go);
  });

  /* ---------- AI: Google Gemini (free key in Settings → Data → AI) stands in for claude.ai sampling ---------- */
  var GM = ["gemini-3.8-flash", "gemini-3.5-flash-lite", "gemini-flash-latest"];
  function gemKey() { return fs.doc("costs/ai").get().then(function (d) { return d.exists ? (d.data().geminiKey || "") : ""; }).catch(function () { return ""; }); }
  function b64(blob) { return toDataUrl(blob).then(function (d) { var i = d.indexOf(","); return { mime: (d.slice(5, i).split(";")[0]) || blob.type || "image/jpeg", data: d.slice(i + 1) }; }); }
  /* one Gemini request: 45 s timeout; tries the key as header, then as ?key=, then as Bearer (new "AQ." auth keys) */
  var GAUTH = 0;
  function gemPost(model, body, key, signal) {
    var url = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent";
    var modes = [GAUTH, 0, 1, 2].filter(function (v, i, a) { return a.indexOf(v) === i; });
    var ctl = new AbortController(); var tm = setTimeout(function () { ctl.abort(); }, 60000);
    if (signal) signal.addEventListener("abort", function () { ctl.abort(); });
    function go(i, lastErr) {
      if (i >= modes.length) return Promise.reject(lastErr);
      var m = modes[i], h = { "Content-Type": "application/json" }, u = url;
      if (m === 0) h["x-goog-api-key"] = key; else if (m === 1) u = url + "?key=" + encodeURIComponent(key); else h["Authorization"] = "Bearer " + key;
      /* direct call; if the browser cannot reach Google (network / CORS / blocker), go through our own domain (/__/gem proxy in netlify.toml) */
      return fetch(u, { method: "POST", headers: h, body: body, signal: ctl.signal })
        .catch(function (er) { if (er && er.name === "AbortError") throw er; if (!/^https?:$/.test(location.protocol)) throw er; return fetch(u.replace("https://generativelanguage.googleapis.com", "/__/gem"), { method: "POST", headers: h, body: body, signal: ctl.signal }); })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { r: r, j: j }; }); })
        .then(function (x) {
          if (x.r.ok) { GAUTH = m; return x; }
          var msg = (x.j.error && x.j.error.message) || ("HTTP " + x.r.status);
          var e = new Error(msg); e.status = x.r.status; e.code = "sampling_failed";
          if (/no longer available|is not found|not supported for generateContent/i.test(msg)) e.status = 404;
          if (x.r.status === 401 || x.r.status === 403 && /token|auth|credential|api key/i.test(msg)) return go(i + 1, e);
          throw e;
        });
    }
    return go(0).then(function (x) { clearTimeout(tm); return x; }, function (e) {
      clearTimeout(tm);
      if (e && e.name === "AbortError") { var t = new Error("Gemini-ն 60 վայրկյանում չպատասխանեց։ Ստուգեք ինտերնետը և փորձեք կրկին։"); t.code = "timeout"; throw t; }
      if (e && e.name === "TypeError") { var n = new Error("Չհաջողվեց կապվել Gemini-ի հետ (ցանց)։ Ստուգեք ինտերնետը, անջատեք գովազդի արգելափակիչը (ad blocker) և փորձեք կրկին։"); n.code = "net"; throw n; }
      if (e && /referer|referrer/i.test(e.message || "")) { var rf = new Error("Բանալին սահմանափակված է կայքերով։ Google Cloud → APIs & Services → Credentials → ձեր բանալին → Website restrictions ավելացրեք https://incheve.netlify.app/* (կամ հանեք սահմանափակումը)։ [" + e.message + "]"); rf.code = "bad_key"; throw rf; }
      if (e && /SERVICE_DISABLED|has not been used|is disabled/i.test(e.message || "")) { var sd = new Error("Ձեր Google նախագծում Generative Language API-ն միացված չէ։ Միացրեք այն console.cloud.google.com → APIs & Services → Library → «Generative Language API» → Enable։ [" + e.message + "]"); sd.code = "bad_key"; throw sd; }
      if (e && e.status === 429) { var q = new Error("Gemini-ի անվճար սահմանաչափը սպառվել է (429)։ Փորձեք մի քանի րոպեից կամ վաղը։ [" + e.message + "]"); q.code = "quota"; q.status = 429; throw q; }
      if (e && e.status === 401) { var a = new Error("Gemini-ն չընդունեց բանալին (401)։ Ստեղծեք նոր բանալի aistudio.google.com/apikey էջում և պահեք Կարգավորումներ → Տվյալներ → AI բաժնում։ [" + e.message + "]"); a.code = "bad_key"; throw a; }
      throw e;
    });
  }
  window.incheveGemPost = gemPost;
  function gemCall(key, prompt, o, json) {
    o = o || {};
    return Promise.all((o.images || []).map(b64)).then(function (imgs) {
      var parts = [{ text: String(prompt) }].concat(imgs.map(function (x) { return { inline_data: { mime_type: x.mime, data: x.data } }; }));
      var body = JSON.stringify({ contents: [{ role: "user", parts: parts }], generationConfig: json ? { temperature: 0.1, responseMimeType: "application/json" } : { temperature: 0.4 } });
      var k = 0;
      function next(last) {
        if (k >= GM.length) return Promise.reject(last || new Error("gemini"));
        var m = GM[k++];
        return gemPost(m, body, key, o.signal).then(function (x) {
          var c = (x.j.candidates || [])[0] || {}; var txt = ((c.content || {}).parts || []).map(function (p) { return p.text || ""; }).join("");
          if (!txt) { var e = new Error("Gemini-ն դատարկ պատասխան տվեց" + (c.finishReason ? " (" + c.finishReason + ")" : (x.j.promptFeedback && x.j.promptFeedback.blockReason ? " (" + x.j.promptFeedback.blockReason + ")" : "")) + "։ Փորձեք կրկին։"); e.code = "sampling_failed"; throw e; }
          return txt;
        }, function (e) { if (e && (e.status === 404 || e.status === 429 || e.status >= 500)) return next(e.status === 404 ? new Error("model " + m) : e); throw e; });
      }
      return next();
    });
  }
  function makeSample(key) {
    var f = function (prompt, o) { return gemCall(key, prompt, o, false).then(function (t) { if (o && o.onText) o.onText({ text: t }); return { text: t }; }); };
    f.json = function (prompt, o) { return gemCall(key, prompt, o, true).then(function (t) { var a = t.indexOf("{"), b = t.lastIndexOf("}"), a2 = t.indexOf("["); if (a2 >= 0 && (a < 0 || a2 < a)) { a = a2; b = t.lastIndexOf("]"); } return JSON.parse(t.slice(a, b + 1)); }); };
    f.limits = function () { return Promise.resolve({ images: { maxCount: 3 } }); };
    return f;
  }
  window.claude = {
    use: function (name) {
      return ready.then(function () {
        if (name === "sample") return gemKey().then(function (k) { return k ? makeSample(k) : null; });
        return { db: db, user: user, downloads: downloads, assets: assets }[name] || null;
      });
    }
  };
  window.incheveSignOut = user.signOut;
  /* a password on the same account lets the home-screen app sign in without Google pop-ups */
  window.incheveSetPassword = function (pw) {
    var u = auth.currentUser; if (!u) return Promise.reject(new Error("no user"));
    var hasPw = (u.providerData || []).some(function (p) { return p.providerId === "password"; });
    var pr = hasPw ? u.updatePassword(pw) : u.linkWithCredential(firebase.auth.EmailAuthProvider.credential(u.email, pw));
    return pr.catch(function (er) { var c = er && er.code || ""; var e = new Error(/operation-not-allowed/.test(c) ? "Firebase-ում միացրեք Email/Password մուտքը (Authentication → Sign-in method)" : /requires-recent-login/.test(c) ? "Դուրս եկեք, նորից մտեք Google-ով և կրկին փորձեք" : /weak-password/.test(c) ? "Գաղտնաբառը պետք է լինի առնվազն 6 նիշ" : (er.message || c)); throw e; });
  };
  window.incheveHasPassword = function () { var u = auth.currentUser; return !!(u && (u.providerData || []).some(function (p) { return p.providerId === "password"; })); };
})();
