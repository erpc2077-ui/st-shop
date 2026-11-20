/* ============================================================
   ST SHOP — caching service worker
   ------------------------------------------------------------
   الهدف: يتحمّل الموقع مرة واحدة ويبقى على جهاز الزبون،
   ومع ذلك تصل أي تحديثات تنشرها أنت عند فتحه مرة أخرى.

   القواعد:
   • الصفحة (HTML) -> الشبكة أولاً، والنسخة المحفوظة احتياطاً.
     أي تحديث تنشره يظهر فوراً، وإن انقطع الاتصال تُفتح النسخة المحفوظة.
   • ملفات الموقع المحلية (الشعار داخل assets/) -> من الكاش أولاً.
   • Firebase / Cloudinary / الخطوط -> لا نلمسها، لكل منها كاش خاص به.

   لمسح الكاش: أضف ?clearcache=1 لرابط الموقع.
   لتغيير إصدار الكاش: بدّل الرقم في CACHE أدناه.
   ============================================================ */

const PREFIX = "stshop-";
const CACHE = "stshop-v4";
const SHELL = ["./", "./index.html"];

const OFFLINE_PAGE = `<!doctype html><html lang="ar" dir="rtl"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>ST SHOP — بدون اتصال</title><style>
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#fff7f0;color:#1d1b16;font-family:system-ui,"Segoe UI",sans-serif;text-align:center;padding:24px}
.box{max-width:420px;background:#fff;border:3px solid #1d1b16;border-radius:18px;box-shadow:8px 8px 0 #a80b52;padding:28px}
h1{margin:0 0 10px;font-size:24px;color:#a80b52}p{margin:0 0 18px;line-height:1.8}
button{border:3px solid #1d1b16;border-radius:12px;background:#ffd93d;color:#1d1b16;font-weight:800;font-size:16px;padding:10px 22px;cursor:pointer;box-shadow:3px 3px 0 #1d1b16}
</style></head><body><div class="box"><h1>لا يوجد اتصال</h1>
<p>افتح الموقع مرة واحدة وأنت متصل لحفظه على جهازك، ثم سيعمل بدون إنترنت.</p>
<button onclick="location.reload()">إعادة المحاولة</button></div></body></html>`;

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((cache) => Promise.all(SHELL.map((url) => cache.add(url).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.indexOf(PREFIX) === 0 && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (e) => {
  if (e.data === "CLEAR_CACHE") e.waitUntil(caches.delete(CACHE));
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  /* لا نلمس مصادر خارجية ولا ملف الـ service worker نفسه */
  if (url.origin !== self.location.origin) return;
  if (/(^|\/)sw\.js$/.test(url.pathname)) return;

  /* الصفحة: الشبكة أولاً حتى يصل التحديث، والنسخة المحفوظة عند انقطاع الاتصال */
  if (req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html")) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (!res || !res.ok) throw new Error("bad response");
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() =>
          caches.match(req)
            .then((hit) => hit || caches.match("./index.html"))
            .then((hit) => hit || new Response(OFFLINE_PAGE, {
              headers: { "Content-Type": "text/html; charset=utf-8" }, status: 503
            }))
        )
    );
    return;
  }

  /* باقي ملفات الموقع: من الكاش أولاً، وتحديث هادئ في الخلفية */
  e.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => hit);
      return hit || net;
    })
  );
});
