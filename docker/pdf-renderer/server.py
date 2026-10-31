"""
pdf-renderer: turns a .tex file into a PDF with XeLaTeX.

Our API is the only caller. It sends JSON:
    POST /render  {"tex": "<the .tex file>", "files": {"photo.jpg": "<base64>"}}
and gets the PDF back (application/pdf), or a 422 with the end of the LaTeX log.
GET /health answers {"ok": true} when it is running.

Safety: LaTeX runs with shell escape off (no programs can be started from a .tex file), in a
fresh temporary folder per request, with a time limit. Docker publishes the port on
127.0.0.1 only, so nothing outside your PC can reach it.
"""

import base64
import json
import os
import re
import subprocess
import tempfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = int(os.environ.get("PORT", "8090"))
MAX_BODY = 10 * 1024 * 1024
TIMEOUT_SECONDS = 60
SAFE_NAME = re.compile(r"^[A-Za-z0-9_-]{1,40}\.(jpg|jpeg|png)$")


class Handler(BaseHTTPRequestHandler):
    server_version = "pdf-renderer"
    sys_version = ""

    def _send(self, status, body, content_type="application/json"):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _error(self, status, message):
        self._send(status, json.dumps({"message": message}).encode())

    def do_GET(self):
        if self.path == "/health":
            self._send(200, b'{"ok":true,"engine":"xelatex"}')
        else:
            self._error(404, "Not found")

    def do_POST(self):
        if self.path != "/render":
            return self._error(404, "Not found")
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0 or length > MAX_BODY:
            return self._error(413, "Send 1 byte to 10 MB")
        try:
            payload = json.loads(self.rfile.read(length))
            tex = payload["tex"]
            files = payload.get("files") or {}
            assert isinstance(tex, str) and isinstance(files, dict)
        except Exception:
            return self._error(400, 'Send JSON: {"tex": "...", "files": {}}')

        with tempfile.TemporaryDirectory() as work:
            for name, data in files.items():
                if not SAFE_NAME.match(name):
                    return self._error(400, f"File name not allowed: {name}")
                with open(os.path.join(work, name), "wb") as f:
                    f.write(base64.b64decode(data))
            with open(os.path.join(work, "main.tex"), "w", encoding="utf-8") as f:
                f.write(tex)
            try:
                result = subprocess.run(
                    [
                        "xelatex",
                        "-interaction=nonstopmode",
                        "-halt-on-error",
                        "-no-shell-escape",
                        "main.tex",
                    ],
                    cwd=work,
                    capture_output=True,
                    timeout=TIMEOUT_SECONDS,
                )
            except subprocess.TimeoutExpired:
                return self._error(422, "LaTeX took too long")
            pdf_path = os.path.join(work, "main.pdf")
            if result.returncode != 0 or not os.path.exists(pdf_path):
                log = result.stdout.decode("utf-8", "replace")[-2000:]
                return self._error(422, f"LaTeX failed:\n{log}")
            with open(pdf_path, "rb") as f:
                self._send(200, f.read(), "application/pdf")

    def log_message(self, format, *args):
        # One short line per request, without the contents.
        print(f"{self.command} {self.path} -> {args[1] if len(args) > 1 else ''}", flush=True)


if __name__ == "__main__":
    print(f"pdf-renderer listening on :{PORT}", flush=True)
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
