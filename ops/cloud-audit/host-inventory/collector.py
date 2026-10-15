"""Inventory-only Actions probe. No candidate imports, installs or setting writes.

Only main() uses OSReadPort. Offline tests supply inert ports and mock all child
processes. The workflow embeds these exact bytes and verifies their SHA256.
"""
import hashlib
import ipaddress
import json
import os
from pathlib import Path
import re
import selectors
import signal
import stat
import subprocess
import sys
import time

REPOSITORY = "II-ricky-bobby-II/Faith-on-the-Frontlines"
REPOSITORY_ID = "1355135878"
OWNER, OWNER_ID = "II-ricky-bobby-II", "116130409"
REF = "refs/heads/chore/faith-host-inventory-offline"
WORKFLOW = ".github/workflows/cloud-audit.yml"
IMAGE, IMAGE_OS, KERNEL = "20261004.315.1", "ubuntu22", "6.8.0-1064-azure"
MAX_EVIDENCE, MAX_QUERY, MAX_FILE = 1048576, 131072, 32768
MAX_SECONDS, MAX_HASH_FILE, MAX_ELF = 120, 64 * 1024 * 1024, 64
KEYS = ("GITHUB_REPOSITORY", "GITHUB_REPOSITORY_ID", "GITHUB_ACTOR", "GITHUB_ACTOR_ID",
        "GITHUB_TRIGGERING_ACTOR", "GITHUB_EVENT_NAME", "GITHUB_RUN_ID", "GITHUB_RUN_ATTEMPT",
        "GITHUB_SHA", "GITHUB_REF", "GITHUB_WORKFLOW_REF", "GITHUB_WORKFLOW_SHA", "GITHUB_JOB",
        "RUNNER_OS", "RUNNER_ARCH", "RUNNER_ENVIRONMENT", "ImageOS", "ImageVersion",
        "FOTF_APPROVED_SHA", "FOTF_REPOSITORY_PUBLIC", "FOTF_STORAGE_CONFIRMED")
PATHS = {"ip": "/usr/sbin/ip", "nft": "/usr/sbin/nft", "mount": "/usr/bin/mount",
         "umount": "/usr/bin/umount", "truncate": "/usr/bin/truncate", "mkfs": "/usr/sbin/mkfs.ext4",
         "sysctl": "/usr/sbin/sysctl", "rmdir": "/usr/bin/rmdir", "python": "/usr/bin/python3"}
HELPERS = {"sudo": "/usr/bin/sudo", "id": "/usr/bin/id", "packages": "/usr/bin/dpkg-query",
           "readelf": "/usr/bin/readelf", "ldconfig": "/usr/sbin/ldconfig", "getent": "/usr/bin/getent"}
READS = {"memory": "/proc/meminfo", "filesystems": "/proc/filesystems", "mounts": "/proc/self/mountinfo",
         "cgroupMembership": "/proc/self/cgroup", "controllers": "/sys/fs/cgroup/cgroup.controllers",
         "subtreeControl": "/sys/fs/cgroup/cgroup.subtree_control", "cgroupType": "/sys/fs/cgroup/cgroup.type",
         "cgroupEvents": "/sys/fs/cgroup/cgroup.events", "forwarding": "/proc/sys/net/ipv4/ip_forward",
         "userNamespaces": "/proc/sys/user/max_user_namespaces",
         "usernsClone": "/proc/sys/kernel/unprivileged_userns_clone",
         "apparmorUserns": "/proc/sys/kernel/apparmor_restrict_unprivileged_userns",
         "subuid": "/etc/subuid", "subgid": "/etc/subgid"}
STAT_PATHS = ("/sys/fs/cgroup", "/sys/fs/cgroup/cgroup.kill", "/sys/fs/cgroup/cgroup.freeze",
              "/sys/module/loop", "/dev/loop-control")
NAMESPACES = tuple("/proc/self/ns/" + n for n in ("user", "pid", "mnt", "net", "ipc", "uts"))
HOST_ENV = {"PATH": "/usr/sbin:/usr/bin:/sbin:/bin", "LANG": "C", "LC_ALL": "C"}


class Refused(Exception):
    pass


def require(value, reason):
    if not value: raise Refused(reason)


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True).encode()


def query_argv(name, paths, argument=None):
    """Closed command vocabulary. No shell, arbitrary arguments or write verbs."""
    fixed = {"sudo-id": ["sudo", "-n", "@id", "-u"], "links": ["ip", "-j", "-d", "link", "show"],
             "routes": ["ip", "-j", "-4", "route", "show", "table", "all"],
             "netns": ["ip", "-j", "netns", "list"], "firewall": ["sudo", "-n", "@nft", "-j", "list", "ruleset"],
             "library-cache": ["ldconfig", "-p"], "registry-ipv4": ["getent", "ahostsv4", "registry.npmjs.org"]}
    if name in fixed:
        require(argument is None, "unexpected query argument")
        words = fixed[name]; argv = [paths[words[0]]]
        return argv + [paths[w[1:]] if w.startswith("@") else w for w in words[1:]]
    if name in ("elf-dynamic", "elf-program", "package-owner"):
        require(type(argument) is str and argument.startswith(("/usr/", "/lib/", "/lib64/", "/bin/", "/sbin/")) and
                ".." not in Path(argument).parts and "\x00" not in argument, "invalid inspected path")
        if name == "package-owner": return [paths["packages"], "-S", argument]
        return [paths["readelf"], "-d" if name == "elf-dynamic" else "-l", "--", argument]
    if name == "package-version":
        require(type(argument) is str and re.fullmatch(r"[a-z0-9][a-z0-9.+:-]{0,100}", argument), "invalid package name")
        return [paths["packages"], "-W", "-f=${binary:Package}\t${Version}\n", argument]
    raise Refused("unapproved command query")


def bounded_command(argv, deadline, maximum=MAX_QUERY):
    """Only closed, root-owned OS query argv reaches this trusted pipe engine."""
    require(time.monotonic() < deadline, "query deadline")
    require(signal.getsignal(signal.SIGCHLD) == signal.SIG_DFL, "child ownership requires default SIGCHLD")
    child = subprocess.Popen(argv, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                             cwd="/", env=HOST_ENV, start_new_session=True, close_fds=True)
    output, completed, selector = bytearray(), False, selectors.DefaultSelector()
    try:
        os.set_blocking(child.stdout.fileno(), False)
        selector.register(child.stdout, selectors.EVENT_READ)
        while selector.get_map():
            require(time.monotonic() < deadline, "query timeout")
            for key, _ in selector.select(timeout=min(0.05, max(0, deadline - time.monotonic()))):
                data = os.read(key.fd, min(65536, maximum + 1 - len(output)))
                if not data: selector.unregister(key.fileobj)
                else:
                    output.extend(data); require(len(output) <= maximum, "query output limit")
        code = child.wait(timeout=max(0.001, deadline - time.monotonic()))
        completed = True
        return code, bytes(output)
    finally:
        if not completed:
            # Keep the leader unreaped until group reconciliation, including
            # when a dead leader leaves a descendant holding its output pipe.
            try: os.killpg(child.pid, signal.SIGKILL)
            except ProcessLookupError: pass
        child.wait(timeout=2)
        selector.close(); child.stdout.close()


class OSReadPort:
    """No generic command/file mutation API; only the probe's own evidence writes."""
    monotonic = staticmethod(time.monotonic)

    def metadata(self):
        # Do not copy/enumerate environ: token, secret, proxy, SSH and event
        # payload values are never read by the collector or passed to a child.
        return {k: os.environ.get(k, "") for k in KEYS}

    def kernel(self): return os.uname().release
    def machine(self): return os.uname().machine
    def read(self, path):
        require(path in READS.values(), "unapproved metadata path")
        try:
            fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
        except FileNotFoundError: return None
        with os.fdopen(fd, "rb") as stream:
            data = stream.read(MAX_FILE + 1)
        require(len(data) <= MAX_FILE, "metadata file limit")
        return data

    def stat(self, path):
        require(path in STAT_PATHS, "unapproved stat path")
        try: value = os.lstat(path)
        except FileNotFoundError: return {"exists": False}
        return {"exists": True, "uid": value.st_uid, "gid": value.st_gid, "mode": stat.S_IMODE(value.st_mode),
                "type": "directory" if stat.S_ISDIR(value.st_mode) else "file" if stat.S_ISREG(value.st_mode) else
                        "device" if stat.S_ISCHR(value.st_mode) else "other"}

    def namespace(self, path):
        require(path in NAMESPACES, "unapproved namespace path")
        return os.readlink(path)

    def capacity(self):
        value = os.statvfs(Path.cwd())
        return {"cpus": os.cpu_count(), "freeBytes": value.f_bavail * value.f_frsize,
                "freeInodes": value.f_favail, "uid": os.getuid(), "gid": os.getgid()}

    def file_identity(self, path, deadline):
        require(path.startswith(("/usr/", "/lib/", "/lib64/")) and ".." not in Path(path).parts, "unapproved tool/library path")
        try: resolved = Path(path).resolve(strict=True)
        except FileNotFoundError: return {"available": False, "path": path}
        require(str(resolved).startswith(("/usr/", "/lib/", "/lib64/")), "tool resolved outside system roots")
        for parent in (resolved, *resolved.parents):
            info = parent.lstat()
            require(info.st_uid == 0 and not info.st_mode & 0o022 and not stat.S_ISLNK(info.st_mode), "untrusted system path")
        fd = os.open(resolved, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
        try:
            info = os.fstat(fd)
            require(stat.S_ISREG(info.st_mode) and info.st_size <= MAX_HASH_FILE, "tool/library type or size")
            h, total = hashlib.sha256(), 0
            while True:
                require(time.monotonic() < deadline, "tool hash deadline")
                data = os.read(fd, 65536)
                if not data: break
                total += len(data); require(total <= MAX_HASH_FILE, "growing tool/library")
                h.update(data)
            require(total == info.st_size, "tool/library changed while reading")
            return {"available": True, "path": path, "realPath": str(resolved), "uid": info.st_uid,
                    "mode": stat.S_IMODE(info.st_mode), "bytes": total, "sha256": h.hexdigest()}
        finally: os.close(fd)

    def query(self, name, paths, argument, deadline):
        return bounded_command(query_argv(name, paths, argument), min(deadline, time.monotonic() + 5))


class Inventory:
    def __init__(self, port, source_sha):
        self.port, self.source_sha = port, source_sha
        self.deadline = port.monotonic() + MAX_SECONDS
        self.receipts, self.problems, self.package_cache = [], [], {}
        self.paths = {}

    def check(self): require(self.port.monotonic() < self.deadline, "inventory deadline")

    def identity(self, values, kernel, machine):
        require(set(values) == set(KEYS) and all(type(v) is str and len(v) <= 512 for v in values.values()), "invalid bounded metadata")
        expected = {"GITHUB_REPOSITORY": REPOSITORY, "GITHUB_REPOSITORY_ID": REPOSITORY_ID,
                    "GITHUB_ACTOR": OWNER, "GITHUB_ACTOR_ID": OWNER_ID, "GITHUB_TRIGGERING_ACTOR": OWNER,
                    "GITHUB_EVENT_NAME": "workflow_dispatch", "GITHUB_RUN_ATTEMPT": "1", "GITHUB_REF": REF,
                    "GITHUB_JOB": "inventory", "RUNNER_OS": "Linux", "RUNNER_ARCH": "X64",
                    "RUNNER_ENVIRONMENT": "github-hosted", "ImageOS": IMAGE_OS, "ImageVersion": IMAGE,
                    "FOTF_REPOSITORY_PUBLIC": "true", "FOTF_STORAGE_CONFIRMED": "true"}
        require(all(values[k] == v for k, v in expected.items()), "identity or image drift")
        require(re.fullmatch(r"[1-9][0-9]*", values["GITHUB_RUN_ID"]), "invalid run identity")
        sha = values["GITHUB_SHA"]
        require(re.fullmatch(r"[0-9a-f]{40}", sha) and sha == values["FOTF_APPROVED_SHA"] == values["GITHUB_WORKFLOW_SHA"], "probe source drift")
        require(values["GITHUB_WORKFLOW_REF"] == REPOSITORY + "/" + WORKFLOW + "@" + REF, "workflow ref drift")
        require(kernel == KERNEL and machine == "x86_64", "kernel or architecture drift")
        require(re.fullmatch(r"[0-9a-f]{64}", self.source_sha), "collector hash missing")
        return values

    def query(self, name, argument=None, *, allow_failure=False):
        self.check()
        code, data = self.port.query(name, self.paths, argument, self.deadline)
        self.check()
        require(type(code) is int and type(data) is bytes and len(data) <= MAX_QUERY, "invalid bounded query result")
        self.receipts.append({"query": name, "argument": argument, "exitCode": code, "bytes": len(data),
                              "sha256": hashlib.sha256(data).hexdigest()})
        require(allow_failure or code == 0, "read-only query failed")
        return code, data.decode("utf-8", errors="strict")

    def package(self, path):
        code, output = self.query("package-owner", path, allow_failure=True)
        # dpkg may record a pre-usrmerge name for the exact same measured file.
        if code and path.startswith(("/usr/bin/", "/usr/sbin/", "/usr/lib/")):
            code, output = self.query("package-owner", path.removeprefix("/usr"), allow_failure=True)
        names = sorted({line.rsplit(": ", 1)[0] for line in output.splitlines() if ": " in line}) if code == 0 else []
        require(len(names) <= 4, "ambiguous package ownership")
        result = {}
        for name in names:
            require(re.fullmatch(r"[a-z0-9][a-z0-9.+:-]{0,100}", name), "invalid package owner")
            if name not in self.package_cache:
                _, value = self.query("package-version", name)
                require(len(value) <= 1024, "package version limit")
                self.package_cache[name] = value.strip()
            result[name] = self.package_cache[name]
        if not result: self.problems.append("missing package provenance")
        return result

    def tools(self):
        records = {}
        for name, path in {**PATHS, **HELPERS}.items():
            self.check(); value = self.port.file_identity(path, self.deadline); self.check()
            records[name] = value
            if not value.get("available"): self.problems.append("missing tool: " + name)
            else: self.paths[name] = value["realPath"]
        require(set(self.paths) == set(PATHS) | set(HELPERS), "required inventory tool unavailable")
        for value in records.values(): value["packages"] = self.package(value["realPath"])
        return records

    def libraries(self, tools):
        _, cache = self.query("library-cache")
        locations = {}
        for line in cache.splitlines():
            match = re.match(r"\s*(\S+) \([^)]*x86-64[^)]*\) => (/\S+)$", line)
            if match: locations.setdefault(match[1], []).append(match[2])
        pending, inspected, libraries = [v["realPath"] for v in tools.values()], set(), {}
        while pending:
            self.check(); path = pending.pop(0)
            if path in inspected: continue
            require(len(inspected) < MAX_ELF, "ELF closure count limit")
            inspected.add(path)
            _, dynamic = self.query("elf-dynamic", path)
            _, program = self.query("elf-program", path)
            names = re.findall(r"\(NEEDED\).*?\[([^\]]+)\]", dynamic)
            targets = re.findall(r"Requesting program interpreter: (/[^\]]+)\]", program)
            for name in names:
                require(re.fullmatch(r"[A-Za-z0-9_.+-]{1,120}", name), "invalid ELF dependency")
                choices = sorted(set(locations.get(name, [])))
                require(len(choices) == 1, "missing or ambiguous ELF dependency")
                targets.append(choices[0])
            for target in targets:
                require(target.startswith(("/usr/", "/lib/", "/lib64/")), "non-system ELF dependency")
                if target in libraries: continue
                self.check(); value = self.port.file_identity(target, self.deadline); self.check()
                require(value.get("available"), "ELF dependency unavailable")
                value["packages"] = self.package(value["realPath"])
                libraries[target] = value; pending.append(value["realPath"])
                require(len(libraries) <= MAX_ELF, "library count limit")
        return {"scope": "ELF DT_NEEDED and PT_INTERP only; dlopen/NSS/Python modules require separate OS/package provenance",
                "files": libraries, "inspected": sorted(inspected)}

    def observations(self):
        values = {}
        for name, path in READS.items():
            self.check(); raw = self.port.read(path); self.check()
            require(raw is None or (type(raw) is bytes and len(raw) <= MAX_FILE), "metadata read limit")
            text = raw.decode("utf-8", errors="strict") if raw is not None else None
            if raw is None and name not in ("usernsClone", "apparmorUserns"):
                self.problems.append("missing host fact: " + name)
            if name in ("subuid", "subgid"):
                text = [line for line in (text or "").splitlines() if line.startswith("runner:")]
                if not text: self.problems.append("missing runner mapping: " + name)
            if name == "memory":
                text = [line for line in (text or "").splitlines() if line.startswith(("MemTotal:", "MemAvailable:"))]
            values[name] = text
        values["pathFacts"] = {p: self.port.stat(p) for p in STAT_PATHS}
        values["namespaces"] = {p.rsplit("/", 1)[-1]: self.port.namespace(p) for p in NAMESPACES}
        values["capacity"] = self.port.capacity()
        code, value = self.query("sudo-id", allow_failure=True)
        values["passwordlessSudoObserved"] = code == 0 and value.strip() == "0"
        if not values["passwordlessSudoObserved"]: self.problems.append("passwordless sudo unproven")
        for name in ("links", "routes", "netns", "firewall"):
            code, value = self.query(name, allow_failure=True)
            values[name] = json.loads(value) if code == 0 else None
            if code: self.problems.append("read-only observation failed: " + name)
        code, value = self.query("registry-ipv4", allow_failure=True)
        ips = sorted({line.split()[0] for line in value.splitlines() if line.split()}) if code == 0 else []
        require(len(ips) <= 32, "registry address count")
        require(all(ipaddress.ip_address(ip).version == 4 and ipaddress.ip_address(ip).is_global for ip in ips), "nonpublic registry address")
        values["registryIpv4"] = ips
        if not ips: self.problems.append("registry address observation failed")
        return values

    def collect(self):
        report = {"schema": 1, "scope": "read-only-host-inventory", "status": "failed", "qualification": False,
                  "releaseReady": False, "externalApprovalVerified": False, "collectorSha256": self.source_sha,
                  "queries": self.receipts, "problems": self.problems,
                  "limitations": ["Inventory is not a capability or isolation test", "No cgroup/namespace/mount/firewall setting was created or changed",
                                  "Future provider/job/profile/source verification is required", "No candidate/runtime/application image was loaded"]}
        try:
            self.check(); values = self.port.metadata()
            require(set(values) == set(KEYS) and all(type(v) is str and len(v) <= 512 for v in values.values()), "invalid bounded metadata")
            kernel, machine = self.port.kernel(), self.port.machine()
            def host_label(value):
                return value if type(value) is str and re.fullmatch(r"[A-Za-z0-9._+-]{1,128}", value) else "invalid"
            report["observedHost"] = {"image": host_label(values["ImageVersion"]), "imageOS": host_label(values["ImageOS"]),
                                      "kernel": host_label(kernel), "machine": host_label(machine)}
            report["identity"] = self.identity(values, kernel, machine); self.check()
            report["tools"] = self.tools()
            report["libraries"] = self.libraries(report["tools"])
            report["observations"] = self.observations()
            self.check(); report["status"] = "inventory-incomplete" if self.problems else "inventory-collected"
        except Exception as error:
            report["errorType"] = type(error).__name__
            if type(error) is Refused: report["refusal"] = str(error)
        return report


def evidence_bytes(report):
    data = canonical(report)
    if len(data) > MAX_EVIDENCE - 4096:
        report = {"schema": 1, "scope": "read-only-host-inventory", "status": "failed", "qualification": False,
                  "releaseReady": False, "errorType": "EvidenceLimit", "collectorSha256": report.get("collectorSha256"),
                  "identity": report.get("identity"), "discardedUnpersistedBytes": len(data)}
        data = canonical(report)
    manifest = canonical({"schema": 1, "scope": "inventory-only-not-qualified", "status": report["status"],
                          "collectorSha256": report.get("collectorSha256"), "qualification": False, "releaseReady": False,
                          "files": {"inventory.json": {"bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}}})
    require(len(data) + len(manifest) <= MAX_EVIDENCE, "evidence total limit")
    return report, {"inventory.json": data, "manifest.json": manifest}


def write_evidence(base, files):
    """Only these two new private evidence files are ever written."""
    require(set(files) == {"inventory.json", "manifest.json"} and sum(map(len, files.values())) <= MAX_EVIDENCE, "evidence shape")
    base = Path(base)
    require(base.is_absolute() and not base.is_symlink(), "evidence base path")
    parent = os.open(base, os.O_DIRECTORY | os.O_NOFOLLOW)
    folder = None
    try:
        os.mkdir("host-inventory-evidence", 0o700, dir_fd=parent)
        folder = os.open("host-inventory-evidence", os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=parent)
        for name, data in files.items():
            fd = os.open(name, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600, dir_fd=folder)
            with os.fdopen(fd, "wb") as stream: stream.write(data); stream.flush(); os.fsync(stream.fileno())
        os.fsync(folder); os.fsync(parent)
    finally:
        if folder is not None: os.close(folder)
        os.close(parent)


def main(source_sha):
    report, files = evidence_bytes(Inventory(OSReadPort(), source_sha).collect())
    write_evidence(Path.cwd(), files)
    # Never emit command, environment or host-controlled bytes as Actions text.
    print("Host inventory evidence retained; no qualification performed.")
    return 0 if report["status"] == "inventory-collected" else 1


if __name__ == "__main__":
    raise SystemExit(main(globals().get("SOURCE_SHA256", "")))
