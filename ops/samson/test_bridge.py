#!/usr/bin/env python3
"""Exercise the actual HTTP service and child processes without a tailnet."""
import base64
import hashlib
import json
import os
import socket
import subprocess
import sys
import tempfile
import time
import unittest
import urllib.error
import urllib.request
from pathlib import Path


class BridgeTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.root = Path(cls.temp.name) / "project"
        cls.root.mkdir()
        (cls.root / "package.json").write_text("{}")
        (cls.root / "escape").symlink_to(cls.temp.name)
        cls.client = Path(cls.temp.name) / "installed-client.py"
        cls.client.write_bytes(Path(__file__).with_name("remote.py").read_bytes())
        cls.credential = Path(cls.temp.name) / "credentials"
        cls.credential.mkdir()
        cls.token = "t" * 48
        (cls.credential / "token").write_text(cls.token)
        with socket.socket() as listener:
            listener.bind(("127.0.0.1", 0))
            cls.port = listener.getsockname()[1]
        cls.url = f"http://127.0.0.1:{cls.port}"
        env = {**os.environ, "FOTF_ROOT": str(cls.root), "FOTF_STATE": str(Path(cls.temp.name) / "state"),
               "FOTF_PORT": str(cls.port), "CREDENTIALS_DIRECTORY": str(cls.credential),
               "FOTF_CLIENT": str(cls.client)}
        cls.process = subprocess.Popen([sys.executable, str(Path(__file__).with_name("bridge.py"))], env=env,
                                       stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
        for _ in range(100):
            try:
                if cls.call("GET", "/health")[0] == 200:
                    return
            except OSError:
                time.sleep(.03)
        raise RuntimeError("Bridge did not start")

    @classmethod
    def tearDownClass(cls):
        cls.process.terminate()
        cls.process.communicate(timeout=5)
        cls.temp.cleanup()

    @classmethod
    def call(cls, method, path, data=None, token=None):
        request = urllib.request.Request(cls.url + path, method=method,
            data=None if data is None else json.dumps(data).encode(),
            headers={"Authorization": "Bearer " + (cls.token if token is None else token), "Content-Type": "application/json"})
        try:
            response = urllib.request.urlopen(request, timeout=5)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            return response.status, json.load(response)

    def finish(self, job):
        for _ in range(150):
            status, result = self.call("GET", "/jobs/" + job)
            if result["state"] not in ("queued", "running"):
                return result
            time.sleep(.03)
        self.fail("Job did not finish")

    def test_auth_and_scoping(self):
        self.assertEqual(self.call("GET", "/health", token="wrong")[0], 401)
        self.assertEqual(self.call("GET", "/files?path=../credentials/token")[0], 400)
        self.assertEqual(self.call("GET", "/files?path=escape/credentials/token")[0], 400)
        self.assertEqual(self.call("POST", "/jobs", {"argv": ["true"], "cwd": ".."})[0], 400)

    def test_bootstrap_uses_installed_client_outside_checkout(self):
        self.assertEqual(self.call("GET", "/client", token="wrong")[0], 401)
        (self.root / "ops/samson").mkdir(parents=True)
        (self.root / "ops/samson/remote.py").write_text("untrusted project edit")
        status, result = self.call("GET", "/client")
        self.assertEqual(status, 200)
        expected = self.client.read_bytes()
        self.assertEqual(base64.b64decode(result["base64"]), expected)
        self.assertEqual(result["sha256"], hashlib.sha256(expected).hexdigest())
        (self.root / "ops/samson/remote.py").unlink()
        self.assertEqual(self.call("GET", "/client")[1], result)

    def test_file_conflicts_preserve_previous_content(self):
        body = {"path": "example.txt", "base64": base64.b64encode(b"first").decode(), "expected_sha256": None}
        status, result = self.call("PUT", "/files", body)
        self.assertEqual(status, 200)
        body["base64"] = base64.b64encode(b"second").decode()
        self.assertEqual(self.call("PUT", "/files", body)[0], 409)
        self.assertEqual((self.root / "example.txt").read_bytes(), b"first")
        body["expected_sha256"] = result["sha256"]
        self.assertEqual(self.call("PUT", "/files", body)[0], 200)

    def test_jobs_execute_without_server_credentials_and_serialize(self):
        code = "import os,time;print(os.getenv('CREDENTIALS_DIRECTORY','absent'));time.sleep(.3)"
        status, job = self.call("POST", "/jobs", {"argv": [sys.executable, "-c", code], "timeout": 5})
        self.assertEqual(status, 202)
        self.assertEqual(self.call("POST", "/jobs", {"argv": ["true"]})[0], 409)
        result = self.finish(job["id"])
        self.assertEqual(result["exit_code"], 0)
        self.assertEqual(result["output"].strip(), "absent")

    def test_timeout_stops_process(self):
        status, job = self.call("POST", "/jobs", {"argv": [sys.executable, "-c", "import time;time.sleep(20)"], "timeout": 1})
        self.assertEqual(status, 202)
        result = self.finish(job["id"])
        self.assertEqual(result["state"], "timed_out")
        self.assertEqual(result["exit_code"], 124)


if __name__ == "__main__":
    unittest.main()
