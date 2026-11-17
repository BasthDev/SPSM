#!/usr/bin/env python3
"""apk_builder.py — mini EAS self-hosted.

Endpoint:
  GET  /                 -> status page HTML
  GET  /download         -> latest.apk
  GET  /status.json      -> JSON status build
  GET  /log              -> tail build.log
  POST /build?token=XXX  -> trigger build (butuh BUILD_TOKEN)

Jalankan: python3 apk_builder.py  (env: PORT=8085, BUILD_TOKEN, DIST_DIR, REPO_DIR)
"""
import json
import os
import subprocess
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse, parse_qs

PORT = int(os.environ.get("PORT", "8085"))
BUILD_TOKEN = os.environ.get("BUILD_TOKEN", "")
DIST_DIR = Path(os.environ.get("DIST_DIR", "/home/basth/apk-dist"))
BUILD_SCRIPT = Path(os.environ.get("BUILD_SCRIPT", "/home/basth/apk-builder/build-apk.sh"))
LOG_FILE = Path(os.environ.get("LOG_FILE", "/home/basth/apk-builder/build.log"))
STATE_FILE = Path(os.environ.get("STATE_FILE", "/home/basth/apk-builder/state.json"))

_lock = threading.Lock()
build_proc = {"proc": None, "started": None}


def read_state():
    try:
        return json.loads(STATE_FILE.read_text())
    except Exception:
        return {"status": "idle", "last_build": None}


def write_state(**kw):
    st = read_state()
    st.update(kw)
    st["updated_at"] = int(time.time())
    STATE_FILE.write_text(json.dumps(st))


def is_building():
    p = build_proc["proc"]
    return p is not None and p.poll() is None


def run_build():
    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(LOG_FILE, "a") as log:
        log.write(f"\n===== BUILD START {time.strftime('%Y-%m-%d %H:%M:%S')} =====\n")
        log.flush()
        write_state(status="building", started_at=int(time.time()))
        proc = subprocess.Popen(
            ["bash", str(BUILD_SCRIPT)],
            stdout=log, stderr=subprocess.STDOUT,
        )
        build_proc["proc"] = proc
        build_proc["started"] = int(time.time())
        rc = proc.wait()
        apk = DIST_DIR / "latest.apk"
        ok = rc == 0 and apk.exists()
        write_state(
            status="success" if ok else "failed",
            finished_at=int(time.time()),
            returncode=rc,
        )
        with open(LOG_FILE, "a") as log:
            log.write(f"===== BUILD END rc={rc} {'OK' if ok else 'FAIL'} =====\n")


INDEX_HTML = """<!doctype html><html><head><meta charset=utf-8>
<meta name=viewport content="width=device-width,initial-scale=1">
<title>SPSM APK Builder</title>
<style>
body{font-family:system-ui;background:#0f172a;color:#e2e8f0;display:flex;justify-content:center;padding:40px 16px}
.card{background:#1e293b;border-radius:16px;padding:28px;max-width:420px;width:100%}
h1{font-size:20px;margin:0 0 4px}.sub{color:#94a3b8;font-size:13px;margin-bottom:20px}
.status{display:inline-block;padding:6px 14px;border-radius:999px;font-weight:700;font-size:13px;margin-bottom:16px}
.building{background:#f59e0b}.success{background:#059669}.failed{background:#dc2626}.idle{background:#475569}
a.btn{display:block;text-align:center;background:#0ea5e9;color:#fff;padding:14px;border-radius:12px;text-decoration:none;font-weight:700;margin-top:8px}
small{color:#64748b;display:block;margin-top:14px}
</style></head><body><div class=card>
<h1>SPSM APK Builder</h1>
<div class=sub>Self-hosted build server</div>
<div class="status {cls}">{status}</div>
<p id=info></p>
<a class=btn href="/download">Download APK Terbaru</a>
<form method=post action="/build?token={token}"><button class=btn type=submit style="border:0;cursor:pointer">Build APK Sekarang</button></form>
<small>Build butuh ~10-20 menit. Status: <a style="color:#38bdf8" href="/status.json">/status.json</a> • Log: <a style="color:#38bdf8" href="/log">/log</a></small>
</div><script>
fetch('/status.json').then(r=>r.json()).then(s=>{{
 document.getElementById('info').textContent = s.last_build ? ('Last build: '+s.last_build) : '';
}});
</script></body></html>"""


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _send(self, code, body, ctype="text/plain; charset=utf-8", extra=None):
        if isinstance(body, str):
            body = body.encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        u = urlparse(self.path)
        if u.path == "/":
            st = read_state()
            cls = st.get("status", "idle")
            self._send(200, INDEX_HTML.format(cls=cls, status=cls.upper(), token=BUILD_TOKEN), "text/html; charset=utf-8")
        elif u.path == "/status.json":
            st = read_state()
            st["building"] = is_building()
            self._send(200, json.dumps(st), "application/json")
        elif u.path == "/log":
            try:
                data = LOG_FILE.read_bytes()[-200_000:]
            except Exception:
                data = b"(no log yet)"
            self._send(200, data, "text/plain; charset=utf-8")
        elif u.path == "/download":
            apk = DIST_DIR / "latest.apk"
            if not apk.exists():
                self._send(404, "APK belum ada — jalankan build dulu.")
                return
            self._send(200, apk.read_bytes(), "application/vnd.android.package-archive",
                       {"Content-Disposition": 'attachment; filename="spsm-latest.apk"'})
        else:
            self._send(404, "not found")

    def do_POST(self):
        u = urlparse(self.path)
        if u.path != "/build":
            self._send(404, "not found")
            return
        token = parse_qs(u.query).get("token", [""])[0]
        if not BUILD_TOKEN or token != BUILD_TOKEN:
            self._send(403, "token salah")
            return
        if is_building():
            self._send(409, "build sedang berjalan")
            return
        threading.Thread(target=run_build, daemon=True).start()
        self._send(200, "build dimulai — pantau di /status.json", "text/plain; charset=utf-8")


if __name__ == "__main__":
    DIST_DIR.mkdir(parents=True, exist_ok=True)
    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    print(f"APK Builder on :{PORT} | dist={DIST_DIR} | token={'set' if BUILD_TOKEN else 'UNSET'}")
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
