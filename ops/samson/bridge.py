#!/usr/bin/env python3
"""Authenticated project file and job API, reachable only through Tailscale Serve.

The token grants this VM's unprivileged project account, including command
execution. It is not a read-only credential. Run under bridge.service.
"""
import base64
import hashlib
import hmac
import json
import os
import signal
import subprocess
import threading
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

ROOT = Path(os.environ.get("FOTF_ROOT", "/srv/faith-on-the-frontlines")).resolve()
STATE = Path(os.environ.get("FOTF_STATE", "/var/lib/fotf-bridge"))
MAX_BODY = 4 * 1024 * 1024
MAX_FILE = 2 * 1024 * 1024
LOCK = threading.Lock()
FILE_LOCK = threading.Lock()
STATE.mkdir(parents=True, exist_ok=True)
for saved in STATE.glob("*.json"):
    previous = json.loads(saved.read_text())
    if previous.get("state") in ("queued", "running"):
        previous.update(state="interrupted", exit_code=125, finished=time.time())
        saved.write_text(json.dumps(previous))
    # Old logs are not project records; retain a fortnight of job diagnostics.
    if saved.stat().st_mtime < time.time() - 14 * 86400:
        saved.with_suffix(".log").unlink(missing_ok=True)
        saved.unlink()
TOKEN = (Path(os.environ["CREDENTIALS_DIRECTORY"]) / "token").read_text().strip()
if len(TOKEN) < 32:
    raise RuntimeError("A strong token is required")


def scoped(name):
    if not isinstance(name, str) or Path(name).is_absolute():
        raise ValueError("Use a relative project path")
    path = (ROOT / name).resolve()
    if not path.is_relative_to(ROOT):
        raise ValueError("Path leaves the project")
    return path


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest() if path.exists() else None


def job_worker(job_id, argv, cwd, timeout):
    record = {"id": job_id, "state": "running", "started": time.time()}
    metadata = STATE / (job_id + ".json")
    output = STATE / (job_id + ".log")
    initial = metadata.with_suffix(".tmp")
    initial.write_text(json.dumps(record))
    initial.replace(metadata)
    try:
        env = {"PATH": "/usr/local/bin:/usr/bin:/bin", "HOME": str(STATE / "home"),
               "LANG": "C.UTF-8", "CI": "true"}
        with output.open("wb") as log:
            process = subprocess.Popen(argv, cwd=cwd, env=env, stdout=log,
                                       stderr=subprocess.STDOUT, start_new_session=True)
            try:
                code = process.wait(timeout=timeout)
                record.update(state="complete", exit_code=code)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGTERM)
                try:
                    process.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    os.killpg(process.pid, signal.SIGKILL)
                    process.wait()
                record.update(state="timed_out", exit_code=124)
            finally:
                # Jobs are bounded; use a separate service for persistent previews.
                try:
                    os.killpg(process.pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
    except Exception as error:
        record.update(state="failed", error=str(error), exit_code=125)
    finally:
        record["finished"] = time.time()
        if output.exists() and output.stat().st_size > 512 * 1024:
            with output.open("rb") as log:
                log.seek(-512 * 1024, 2)
                tail = log.read()
            output.write_bytes(tail)
            record["output_truncated"] = True
        temporary = metadata.with_suffix(".tmp")
        temporary.write_text(json.dumps(record))
        temporary.replace(metadata)
        LOCK.release()


class Handler(BaseHTTPRequestHandler):
    server_version = "FOTFWorkspace/1"

    def log_message(self, fmt, *args):
        # Do not log Authorization headers, request contents or URL queries.
        print(json.dumps({"method": self.command, "path": urlsplit(self.path).path}), flush=True)

    def send_json(self, status, data):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def authorized(self):
        return hmac.compare_digest(self.headers.get("Authorization", "").encode(), ("Bearer " + TOKEN).encode())

    def dispatch(self):
        if not self.authorized():
            return self.send_json(401, {"error": "Authentication required"})
        parsed = urlsplit(self.path)
        query = parse_qs(parsed.query)
        body = {}
        if self.command in ("POST", "PUT", "DELETE"):
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= MAX_BODY:
                return self.send_json(413, {"error": "Invalid body size"})
            body = json.loads(self.rfile.read(length))
        if self.command == "GET" and parsed.path == "/health":
            return self.send_json(200, {"ready": (ROOT / "package.json").is_file(), "root": str(ROOT), "busy": LOCK.locked()})
        if self.command == "GET" and parsed.path == "/files":
            path = scoped(query.get("path", ["."])[0])
            if path.is_dir():
                entries = [{"name": p.name, "directory": p.is_dir(), "symlink": p.is_symlink()} for p in sorted(path.iterdir())]
                return self.send_json(200, {"entries": entries[:2000], "truncated": len(entries) > 2000})
            if path.stat().st_size > MAX_FILE:
                return self.send_json(413, {"error": "File exceeds transfer limit"})
            content = path.read_bytes()
            return self.send_json(200, {"base64": base64.b64encode(content).decode(), "sha256": hashlib.sha256(content).hexdigest()})
        if self.command in ("PUT", "DELETE") and parsed.path == "/files":
            path = scoped(body["path"])
            if path == ROOT or path.is_dir():
                raise ValueError("Target must be a project file")
            with FILE_LOCK:
                if "expected_sha256" not in body or digest(path) != body["expected_sha256"]:
                    return self.send_json(409, {"error": "File changed; read it before writing"})
                if self.command == "DELETE":
                    path.unlink()
                    return self.send_json(200, {"deleted": True})
                content = base64.b64decode(body["base64"], validate=True)
                if len(content) > MAX_FILE:
                    return self.send_json(413, {"error": "File exceeds transfer limit"})
                path.parent.mkdir(parents=True, exist_ok=True)
                temporary = path.with_name("." + path.name + "." + uuid.uuid4().hex)
                temporary.write_bytes(content)
                temporary.replace(path)
                return self.send_json(200, {"sha256": digest(path)})
        if self.command == "POST" and parsed.path == "/jobs":
            argv = body["argv"]
            if not isinstance(argv, list) or not argv or len(argv) > 256 or not all(isinstance(v, str) and len(v) <= 65536 for v in argv):
                raise ValueError("argv must be a bounded list of strings")
            cwd = scoped(body.get("cwd", "."))
            if not cwd.is_dir():
                raise ValueError("Working directory does not exist")
            timeout = int(body.get("timeout", 300))
            if not 1 <= timeout <= 900:
                raise ValueError("Timeout must be 1–900 seconds")
            if not LOCK.acquire(blocking=False):
                return self.send_json(409, {"error": "Another job is running"})
            job_id = uuid.uuid4().hex
            (STATE / (job_id + ".json")).write_text(json.dumps({"id": job_id, "state": "queued"}))
            threading.Thread(target=job_worker, args=(job_id, argv, cwd, timeout), daemon=True).start()
            return self.send_json(202, {"id": job_id})
        if self.command == "GET" and parsed.path.startswith("/jobs/"):
            job_id = parsed.path.removeprefix("/jobs/")
            if len(job_id) != 32 or any(c not in "0123456789abcdef" for c in job_id):
                raise ValueError("Invalid job id")
            record = json.loads((STATE / (job_id + ".json")).read_text())
            output = STATE / (job_id + ".log")
            if output.exists():
                with output.open("rb") as stream:
                    size = output.stat().st_size
                    stream.seek(max(0, size - 512 * 1024))
                    record.update(output=stream.read().decode(errors="replace"), output_truncated=record.get("output_truncated", False) or size > 512 * 1024)
            return self.send_json(200, record)
        return self.send_json(404, {"error": "Unknown endpoint"})

    def handle_request(self):
        self.connection.settimeout(15)
        try:
            self.dispatch()
        except FileNotFoundError:
            self.send_json(404, {"error": "Not found"})
        except (ValueError, KeyError, TypeError, IsADirectoryError):
            self.send_json(400, {"error": "Invalid request"})
        except (BrokenPipeError, TimeoutError):
            pass

    do_GET = do_POST = do_PUT = do_DELETE = handle_request


if __name__ == "__main__":
    os.umask(0o077)
    ThreadingHTTPServer(("127.0.0.1", int(os.environ.get("FOTF_PORT", "8787"))), Handler).serve_forever()
