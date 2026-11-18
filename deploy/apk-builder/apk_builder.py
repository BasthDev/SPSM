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
PROGRESS_FILE = Path(os.environ.get("PROGRESS_FILE", "/home/basth/apk-builder/progress.txt"))

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


def run_build(mode="release"):
    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(LOG_FILE, "a") as log:
        log.write(f"\n===== BUILD START {time.strftime('%Y-%m-%d %H:%M:%S')} (mode={mode}) =====\n")
        log.flush()
        write_state(status="building", started_at=int(time.time()), build_mode=mode)
        env = os.environ.copy()
        env["BUILD_MODE"] = mode
        proc = subprocess.Popen(
            ["bash", str(BUILD_SCRIPT)],
            stdout=log, stderr=subprocess.STDOUT,
            env=env,
        )
        build_proc["proc"] = proc
        build_proc["started"] = int(time.time())
        rc = proc.wait()
        if mode == "release":
            apk = DIST_DIR / "latest.apk"
        elif mode == "debug":
            apk = DIST_DIR / "latest-debug.apk"
        else:
            apk = None
        ok = rc == 0 and (apk is None or apk.exists())
        write_state(
            status="success" if ok else "failed",
            finished_at=int(time.time()),
            returncode=rc,
            apk_size=apk.stat().st_size if ok and apk else None,
        )
        with open(LOG_FILE, "a") as log:
            log.write(f"===== BUILD END rc={rc} {'OK' if ok else 'FAIL'} =====\n")
        build_proc["proc"] = None


INDEX_HTML = r"""<!doctype html><html lang=id><head><meta charset=utf-8>
<meta name=viewport content="width=device-width,initial-scale=1">
<title>SPSM APK Builder</title>
<style>
*{box-sizing:border-box;margin:0}
body{font-family:ui-sans-serif,system-ui;background:#0f172a;color:#e2e8f0;min-height:100vh;padding:32px 16px;
 background-image:radial-gradient(600px 300px at 15% -5%,rgba(14,165,233,.18),transparent),radial-gradient(700px 350px at 90% 0%,rgba(139,92,246,.15),transparent),radial-gradient(500px 400px at 50% 110%,rgba(16,185,129,.10),transparent)}
.wrap{max-width:940px;margin:0 auto}
header{display:flex;align-items:center;gap:16px;margin-bottom:32px;padding-bottom:24px;border-bottom:1px solid rgba(148,163,184,.2)}
.logo{width:52px;height:52px;border-radius:16px;background:linear-gradient(135deg,#0ea5e9,#8b5cf6);display:flex;align-items:center;justify-content:center;font-size:24px;box-shadow:0 8px 32px rgba(14,165,233,.4)}
h1{font-size:24px;font-weight:800;letter-spacing:-.02em;margin:0}
.sub{color:#64748b;font-size:14px}
.grid{display:grid;grid-template-columns:1fr;gap:20px}
@media(min-width:880px){.grid{grid-template-columns:380px 1fr}}
.card{background:rgba(30,41,59,.85);border:1px solid rgba(148,163,184,.18);border-radius:20px;padding:24px;backdrop-filter:blur(12px)}
.card h2{font-size:11px;text-transform:uppercase;letter-spacing:.14em;color:#94a3b8;margin-bottom:20px}
.pill{display:inline-flex;align-items:center;gap:10px;padding:8px 18px;border-radius:999px;font-weight:700;font-size:13px;margin-bottom:20px}
.pill .dot{width:10px;height:10px;border-radius:50%;background:currentColor}
.building .dot{animation:pulse 1s infinite}
@keyframes pulse{50%{opacity:.3;transform:scale(.75)}}
.building{background:rgba(245,158,11,.18);color:#fbbf24;border:1px solid rgba(245,158,11,.4)}
.success{background:rgba(5,150,105,.18);color:#34d399;border:1px solid rgba(5,150,105,.4)}
.failed{background:rgba(220,38,38,.18);color:#f87171;border:1px solid rgba(220,38,38,.4)}
.idle{background:rgba(71,85,105,.4);color:#94a3b8;border:1px solid rgba(71,85,105,.6)}
.cmds{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:20px}
.btn{padding:14px;border-radius:14px;border:1px solid #334155;background:#1e293b;color:#e2e8f0;font-weight:700;font-size:14px;cursor:pointer;text-align:center;transition:.2s}
.btn:hover:not(:disabled){border-color:#0ea5e9;color:#fff;transform:translateY(-2px)}
.btn:disabled{opacity:.35;cursor:not-allowed}
.btn.primary{background:linear-gradient(135deg,#0ea5e9,#2563eb);border:0;color:#fff}
.btn.prebuild{background:linear-gradient(135deg,#8b5cf6,#a855f7);border:0;color:#fff}
.btn.debug{background:linear-gradient(135deg,#10b981,#059669);border:0;color:#fff}
.btn.release{background:linear-gradient(135deg,#f59e0b,#d97706);border:0;color:#fff}
.btn.stop{background:linear-gradient(135deg,#ef4444,#dc2626);border:0;color:#fff}
.steps{display:flex;flex-direction:column;gap:0}
.step{display:flex;align-items:center;gap:14px;padding:10px 0;position:relative}
.step:not(:last-child)::before{content:'';position:absolute;left:17px;top:38px;bottom:-10px;width:2px;background:#334155}
.step.done:not(:last-child)::before{background:#059669}
.step .ic{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;flex-shrink:0;background:#1e293b;border:2px solid #334155;color:#64748b;z-index:1}
.step.done .ic{background:#059669;border-color:#059669;color:#fff}
.step.active .ic{background:#0ea5e9;border-color:#0ea5e9;color:#fff;animation:pulse 1.2s infinite}
.step .lb{font-size:14px;color:#64748b;font-weight:600}
.step.done .lb{color:#cbd5e1}
.step.active .lb{color:#fff}
.elapsed{margin-top:18px;font-size:12px;color:#64748b}
.bar{height:6px;border-radius:99px;background:#1e293b;overflow:hidden;margin-top:12px}
.bar i{display:block;height:100%;width:0;border-radius:99px;background:linear-gradient(90deg,#0ea5e9,#8b5cf6);transition:width .6s}
.building .bar i{width:100%!important;animation:slide 1.6s ease-in-out infinite}
@keyframes slide{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}
.dl-section{margin-top:20px;padding-top:20px;border-top:1px solid rgba(148,163,184,.18)}
.dl-row{display:flex;gap:10px;margin-bottom:10px}
.dl{flex:1;display:flex;align-items:center;justify-content:center;gap:10px;padding:12px;border-radius:12px;background:linear-gradient(135deg,#059669,#0d9488);color:#fff;font-weight:700;text-decoration:none;font-size:14px;box-shadow:0 6px 20px rgba(5,150,105,.3);transition:.15s}
.dl:hover{transform:translateY(-2px)}
.dl.debug{background:linear-gradient(135deg,#10b981,#059669)}
.dl.release{background:linear-gradient(135deg,#f59e0b,#d97706)}
.meta{font-size:12px;color:#64748b;margin-top:8px;text-align:center}
.log{background:#0b1120;border:1px solid rgba(148,163,184,.18);border-radius:16px;padding:16px;height:420px;overflow-y:auto;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:11.5px;line-height:1.6;color:#94a3b8;white-space:pre-wrap;word-break:break-all}
.log .ln{display:block}
.log .hl{color:#7dd3fc}.log .ok{color:#34d399}.log .err{color:#f87171}
.log::-webkit-scrollbar{width:8px}.log::-webkit-scrollbar-thumb{background:#334155;border-radius:8px}
.foot{margin-top:24px;text-align:center;font-size:12px;color:#475569}
.foot a{color:#38bdf8;text-decoration:none}
.badge{display:inline-block;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:700;background:#334155;color:#94a3b8;margin-left:8px}
</style></head><body><div class=wrap>
<header><div class=logo>🤖</div><div><h1>SPSM APK Builder</h1><div class=sub>Self-hosted build server • multi-command EAS-style</div></div></header>
<div class=grid>
 <div class=card>
  <h2>Build Commands</h2>
  <div class="pill idle" id=pill><span class=dot></span><span id=pilltxt>IDLE</span></div>
  <div class=cmds>
   <button class="btn prebuild" id=prebtn disabled>📦 Prebuild</button>
   <button class="btn debug" id=debugbtn disabled>🐛 Debug</button>
   <button class="btn release" id=relbtn disabled>🚀 Release</button>
  </div>
  <button class="btn stop" id=stopbtn style="display:none;margin-bottom:16px">⏹ Stop Build</button>
  <div class=steps id=steps></div>
  <div class=elapsed id=elapsed></div>
  <div class=bar><i id=bar></i></div>
  <div class=dl-section" id=dlsec style="display:none">
   <div class=dl-row>
    <a class="dl debug" id=dldbg href="/download?file=debug">⬇ Debug APK</a>
    <a class="dl release" id=dlrel href="/download?file=release">⬇ Release APK</a>
   </div>
   <div class=meta id=dlmeta></div>
  </div>
 </div>
 <div class=card>
  <h2>Live Build Log</h2>
  <div class=log id=log>Menunggu command…</div>
 </div>
</div>
<div class=foot>Realtime • <a href="/status.json">status.json</a> • <a href="/log">/log</a></div>
</div><script>
const STAGES=[['start','Persiapan'],['sdk','Android SDK'],['npm','npm install'],['git','Git Pull'],['prebuild','Expo Prebuild'],['gradle','Gradle Build'],['sign','Signing'],['done','Publish APK']];
const LABEL={idle:'IDLE',building:'BUILDING…',success:'SUCCESS',failed:'FAILED'};
let t0=null,logEl=document.getElementById('log');
function fmtDur(s){s=Math.max(0,Math.floor(s));const m=Math.floor(s/60),ss=s%60;return m+'m '+String(ss).padStart(2,'0')+'s'}
function stageIdx(st,prog){
 if(prog){const i=STAGES.findIndex(x=>x[0]!==''&&prog.includes(x[0]));if(i>=0)return i}
 const m={sdk:1,npm:2,git:3,prebuild:4,gradle:5,sign:6,done:7};return m[st]!==undefined?m[st]:st==='building'?0:-1;
}
function renderSteps(idx,status){
 const el=document.getElementById('steps');el.innerHTML='';
 STAGES.forEach((s,i)=>{
  const done=status==='success'?i<STAGES.length-1||i===idx:i<idx||(status==='failed'&&i<=idx);
  const active=status==='building'&&i===idx;
  const d=document.createElement('div');
  d.className='step'+(done?' done':'')+(active?' active':'');
  d.innerHTML='<div class=ic>'+(done?'✓':active?'…':i+1)+'</div><div class=lb>'+s[1]+'</div>';
  el.appendChild(d);
 });
}
function hl(line){
 line=line.replace(/&/g,'&amp;').replace(/</g,'&lt;');
 if(/DONE|success|BUILD SUCCESS/i.test(line))return '<span class=ok>'+line+'</span>';
 if(/error|fail|exception/i.test(line))return '<span class=err>'+line+'</span>';
 if(/^=|Task:|> Task/i.test(line))return '<span class=hl>'+line+'</span>';
 return line;
}
async function runCmd(mode){
 try{
  const r=await fetch('/build?token=__TOKEN__&mode='+mode,{method:'POST'});
  if(!r.ok)throw new Error(await r.text());
  return await r.text();
 }catch(e){
  alert('Gagal menjalankan command: '+e.message);
 }
}
async function stopBuild(){
 try{
  const r=await fetch('/stop?token=__TOKEN__',{method:'POST'});
  if(!r.ok)throw new Error(await r.text());
  return await r.text();
 }catch(e){
  alert('Gagal stop build: '+e.message);
 }
}
async function poll(){
 try{
  const s=await fetch('/status.json').then(r=>r.json());
  const p=await fetch('/progress').then(r=>r.json()).catch(()=>({stage:''}));
  const pill=document.getElementById('pill'),pt=document.getElementById('pilltxt');
  pill.className='pill '+(s.building?'building':s.status||'idle');
  pt.textContent=LABEL[s.building?'building':s.status]||s.status;
  const idx=stageIdx(s.building?'building':s.status,p.stage);
  renderSteps(idx,s.building?'building':s.status);
  const el=document.getElementById('elapsed');
  if(s.building){if(!t0)t0=Date.now();el.textContent='Elapsed: '+fmtDur((Date.now()-t0)/1000)+' — '+s.build_mode?.toUpperCase()||'BUILD'}
  else{t0=null;el.textContent=s.finished_at?'Finished: '+new Date(s.finished_at*1000).toLocaleString('id-ID'):''}
  const canBuild=!s.building;
  document.getElementById('prebtn').disabled=!canBuild;
  document.getElementById('debugbtn').disabled=!canBuild;
  document.getElementById('relbtn').disabled=!canBuild;
  const stopBtn=document.getElementById('stopbtn');
  stopBtn.style.display=s.building?'block':'none';
  const dw=document.getElementById('dlsec');
  if(s.status==='success'){dw.style.display='block';document.getElementById('dlmeta').textContent='Debug: '+(s.debug_size?fmtSize(s.debug_size):'-')+' | Release: '+(s.apk_size?fmtSize(s.apk_size):'-');}
  else dw.style.display='none';
  const txt=await fetch('/log').then(r=>r.text());
  const lines=txt.split('\n');
  const tail=lines.slice(-400).map(hl).join('\n');
  if(tail!==logEl.dataset.v){logEl.innerHTML=tail;logEl.dataset.v=tail;logEl.scrollTop=logEl.scrollHeight;}
 }catch(e){}
 setTimeout(poll,2000);
}
function fmtSize(b){if(!b)return'-';b=Number(b);const k=1024,s=['B','KB','MB','GB'];const i=Math.floor(Math.log(b)/Math.log(k));return parseFloat((b/Math.pow(k,i)).toFixed(1))+' '+s[i];}
document.getElementById('prebtn').onclick=()=>runCmd('prebuild');
document.getElementById('debugbtn').onclick=()=>runCmd('debug');
document.getElementById('relbtn').onclick=()=>runCmd('release');
document.getElementById('stopbtn').onclick=()=>stopBuild();
poll();
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
            html = (INDEX_HTML
                    .replace("__CLS__", cls)
                    .replace("__STATUS__", cls.upper())
                    .replace("__TOKEN__", BUILD_TOKEN))
            self._send(200, html, "text/html; charset=utf-8")
        elif u.path == "/status.json":
            st = read_state()
            st["building"] = is_building()
            apk = DIST_DIR / "latest.apk"
            if apk.exists():
                st["apk_size"] = apk.stat().st_size
                st["apk_mtime"] = int(apk.stat().st_mtime)
            apk_debug = DIST_DIR / "latest-debug.apk"
            if apk_debug.exists():
                st["debug_size"] = apk_debug.stat().st_size
            self._send(200, json.dumps(st), "application/json")
        elif u.path == "/progress":
            stage = ""
            try:
                stage = PROGRESS_FILE.read_text().strip()
            except Exception:
                pass
            if not stage:
                try:
                    tail = LOG_FILE.read_bytes()[-50_000:].decode("utf-8", "replace")
                    marks = [l for l in tail.splitlines() if l.startswith("=== ")]
                    if marks:
                        stage = marks[-1].strip("= ").lower()
                except Exception:
                    pass
            self._send(200, json.dumps({"stage": stage}), "application/json")
        elif u.path == "/log":
            try:
                data = LOG_FILE.read_bytes()[-200_000:]
            except Exception:
                data = b"(no log yet)"
            self._send(200, data, "text/plain; charset=utf-8")
        elif u.path == "/download":
            qs = parse_qs(u.query)
            file_type = qs.get("file", ["release"])[0]
            if file_type == "debug":
                apk = DIST_DIR / "latest-debug.apk"
                name = "spsm-debug.apk"
            else:
                apk = DIST_DIR / "latest.apk"
                name = "spsm-release.apk"
            if not apk.exists():
                self._send(404, f"APK {file_type} belum ada — jalankan build dulu.")
                return
            self._send(200, apk.read_bytes(), "application/vnd.android.package-archive",
                       {"Content-Disposition": f'attachment; filename="{name}"'})
        else:
            self._send(404, "not found")

    def do_POST(self):
        u = urlparse(self.path)
        if u.path == "/build":
            token = parse_qs(u.query).get("token", [""])[0]
            if not BUILD_TOKEN or token != BUILD_TOKEN:
                self._send(403, "token salah")
                return
            if is_building():
                self._send(409, "build sedang berjalan")
                return
            mode = parse_qs(u.query).get("mode", ["release"])[0]
            if mode not in ("prebuild", "debug", "release"):
                self._send(400, "mode tidak valid: gunakan prebuild|debug|release")
                return
            threading.Thread(target=run_build, kwargs={"mode": mode}, daemon=True).start()
            self._send(200, f"build {mode} dimulai — pantau di /status.json", "text/plain; charset=utf-8")
        elif u.path == "/stop":
            token = parse_qs(u.query).get("token", [""])[0]
            if not BUILD_TOKEN or token != BUILD_TOKEN:
                self._send(403, "token salah")
                return
            if not is_building():
                self._send(409, "tidak ada build yang berjalan")
                return
            proc = build_proc["proc"]
            if proc:
                try:
                    proc.terminate()
                    time.sleep(2)
                    if proc.poll() is None:
                        proc.kill()
                except Exception:
                    pass
                with open(LOG_FILE, "a") as log:
                    log.write(f"\n===== BUILD STOPPED =====\n")
                write_state(status="failed", finished_at=int(time.time()), returncode=-9)
                build_proc["proc"] = None
            self._send(200, "build dihentikan", "text/plain; charset=utf-8")
        else:
            self._send(404, "not found")


if __name__ == "__main__":
    DIST_DIR.mkdir(parents=True, exist_ok=True)
    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    print(f"APK Builder on :{PORT} | dist={DIST_DIR} | token={'set' if BUILD_TOKEN else 'UNSET'}")
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
