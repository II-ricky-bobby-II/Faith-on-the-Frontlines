#!/usr/bin/env python3
"""Cloud client. Uses the environment HTTPS proxy and domain-scoped secret."""
import argparse
import base64
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request


def request(method, path, body=None):
    url = os.environ["FOTF_VM_URL"].rstrip("/")
    if not url.startswith("https://"):
        raise ValueError("FOTF_VM_URL must use verified HTTPS")
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(url + path, data=data, method=method,
        headers={"Authorization": "Bearer " + os.environ["FOTF_VM_TOKEN"], "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as response:
        return json.load(response)


def main():
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="action", required=True)
    sub.add_parser("health")
    get = sub.add_parser("get")
    get.add_argument("path")
    get.add_argument("--output")
    put = sub.add_parser("put")
    put.add_argument("path")
    put.add_argument("source")
    put.add_argument("--expected-sha256", required=True, help="Hash from get, or 'new' for a new file")
    execute = sub.add_parser("exec")
    execute.add_argument("--cwd", default=".")
    execute.add_argument("--timeout", type=int, default=300)
    execute.add_argument("argv", nargs=argparse.REMAINDER)
    poll = sub.add_parser("job")
    poll.add_argument("id")
    args = parser.parse_args()
    if args.action == "health":
        print(json.dumps(request("GET", "/health"), indent=2))
    elif args.action == "get":
        result = request("GET", "/files?" + urllib.parse.urlencode({"path": args.path}))
        if args.output:
            from pathlib import Path
            Path(args.output).write_bytes(base64.b64decode(result["base64"]))
            print(json.dumps({"sha256": result["sha256"], "output": args.output}))
        else:
            print(json.dumps(result, indent=2))
    elif args.action == "put":
        from pathlib import Path
        print(json.dumps(request("PUT", "/files", {"path": args.path,
            "expected_sha256": None if args.expected_sha256 == "new" else args.expected_sha256,
            "base64": base64.b64encode(Path(args.source).read_bytes()).decode()})))
    elif args.action == "job":
        print(json.dumps(request("GET", "/jobs/" + args.id), indent=2))
    elif args.action == "exec":
        argv = args.argv[1:] if args.argv[:1] == ["--"] else args.argv
        result = request("POST", "/jobs", {"argv": argv, "cwd": args.cwd, "timeout": args.timeout})
        print("Job " + result["id"], file=sys.stderr, flush=True)
        deadline = time.monotonic() + args.timeout + 45
        while time.monotonic() < deadline:
            state = request("GET", "/jobs/" + result["id"])
            if state["state"] not in ("queued", "running"):
                print(state.get("output", ""), end="")
                if state.get("error"):
                    print(state["error"], file=sys.stderr)
                raise SystemExit(state.get("exit_code", 125))
            time.sleep(2)
        raise RuntimeError("Client wait expired; inspect job " + result["id"])


if __name__ == "__main__":
    try:
        main()
    except urllib.error.HTTPError as error:
        print(f"Workspace HTTP {error.code}: {error.read().decode(errors='replace')}", file=sys.stderr)
        raise SystemExit(1)
