#!/usr/bin/env python3
"""Local static server for the web demo, with cross-origin isolation (needed for multi-threaded WASM).

Usage:
    python3 serve.py [port] [--remote https://hkasr.joe2643.work]

With --remote, any /models/* or /ort/*.wasm file that is missing locally is streamed from that site,
so you can work on the UI without building the ONNX model package yourself.
"""

import http.server
import os
import shutil
import socketserver
import sys
import urllib.request

os.chdir(os.path.dirname(os.path.abspath(__file__)))
args = [a for a in sys.argv[1:] if not a.startswith("--remote")]
REMOTE = None
for i, a in enumerate(sys.argv[1:], 1):
    if a == "--remote" and i + 1 < len(sys.argv):
        REMOTE = sys.argv[i + 1].rstrip("/")
        args = [x for x in args if x != sys.argv[i + 1]]
    elif a.startswith("--remote="):
        REMOTE = a.split("=", 1)[1].rstrip("/")
PORT = int(args[0]) if args else 18096


class H(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".mjs": "text/javascript",
        ".js": "text/javascript",
        ".wasm": "application/wasm",
        ".json": "application/json",
        ".onnx": "application/octet-stream",
    }

    def end_headers(self):
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        self.send_header("Cross-Origin-Embedder-Policy", "require-corp")
        self.send_header("Cross-Origin-Resource-Policy", "same-origin")
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def _remote_ok(self):
        p = self.path.split("?", 1)[0]
        if not REMOTE or ".." in p:
            return None
        if not (p.startswith("/models/") or (p.startswith("/ort/") and p.endswith(".wasm"))):
            return None
        return None if os.path.exists("." + p) else p

    def do_GET(self):
        p = self._remote_ok()
        if p is None:
            return super().do_GET()
        try:
            req = urllib.request.Request(REMOTE + p, headers={"User-Agent": "hkasr-dev-serve/1.0"})
            with urllib.request.urlopen(req, timeout=60) as r:
                self.send_response(200)
                self.send_header("Content-Type", r.headers.get("Content-Type", "application/octet-stream"))
                if r.headers.get("Content-Length"):
                    self.send_header("Content-Length", r.headers["Content-Length"])
                self.end_headers()
                shutil.copyfileobj(r, self.wfile, 1 << 20)
        except Exception as e:  # noqa: BLE001
            self.send_error(502, f"remote fetch failed: {e}")

    def log_message(self, *a):
        pass


class S(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


print(f"http://127.0.0.1:{PORT}/" + (f"  (missing models/wasm from {REMOTE})" if REMOTE else ""))
S(("127.0.0.1", PORT), H).serve_forever()
