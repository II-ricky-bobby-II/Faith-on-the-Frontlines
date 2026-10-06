#!/usr/bin/env python3
"""Create only the dedicated FOTF guest on Samson, from a clean Ubuntu image."""
import argparse
import hashlib
import json
import subprocess
from pathlib import Path

VMID = "111"
NAME = "fotf-workspace"
ADDRESS = "192.168.88.209"
MAC = "BC:24:11:F0:01:11"
IMAGE = Path("/var/lib/vz/core-qa-foundation/noble-20260926-amd64.img")
IMAGE_SHA256 = "6a81c37564db9b1ee84e141922625e1d7c5b389b99bb3c572e0243607d5bb4d2"


def run(*args):
    return subprocess.check_output(args, text=True, stderr=subprocess.STDOUT)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--public-key-file", required=True)
    args = parser.parse_args()
    assert run("hostname").strip() == "Samson"
    guests = json.loads(run("pvesh", "get", "/cluster/resources", "--type", "vm", "--output-format", "json"))
    assert not any(str(g["vmid"]) == VMID or g.get("name") == NAME for g in guests), "Target already exists; inspect before retrying"
    assert hashlib.file_digest(IMAGE.open("rb"), "sha256").hexdigest() == IMAGE_SHA256
    key = Path(args.public_key_file).read_text().strip()
    assert key.startswith("ssh-ed25519 ")
    plan = {"vmid": VMID, "name": NAME, "ip": ADDRESS, "cores": 2,
            "memory_mib": 4096, "disk_gib": 24, "bridge": "vmbr0", "fresh_image": True}
    print(json.dumps({"plan": plan, "apply": args.apply}), flush=True)
    if not args.apply:
        return
    bootstrap = Path(__file__).with_name("bootstrap.sh").read_text()
    config = {
        "hostname": NAME, "manage_etc_hosts": True, "ssh_pwauth": False, "disable_root": True,
        "users": [
            {"name": "fotfops", "lock_passwd": True, "groups": ["adm", "sudo"],
             "sudo": "ALL=(ALL) NOPASSWD:ALL", "shell": "/bin/bash", "ssh_authorized_keys": [key]},
            {"name": "fotf", "lock_passwd": True, "shell": "/bin/bash"}],
        "package_update": True,
        "packages": ["qemu-guest-agent", "ca-certificates", "curl", "git", "jq", "python3", "xz-utils", "nftables", "unattended-upgrades"],
        "write_files": [{"path": "/usr/local/sbin/fotf-bootstrap", "permissions": "0750", "content": bootstrap}],
        "runcmd": [["systemctl", "start", "qemu-guest-agent"], ["/usr/local/sbin/fotf-bootstrap"]],
    }
    snippet = Path("/var/lib/vz/snippets/fotf-workspace-user.yaml")
    assert not snippet.exists(), "First-boot configuration already exists"
    snippet.write_text("#cloud-config\n" + json.dumps(config, indent=2) + "\n")
    # Enforce network isolation outside the guest, even if its runtime is compromised.
    firewall = Path(f"/etc/pve/firewall/{VMID}.fw")
    assert not firewall.exists(), "Firewall target already exists"
    firewall.write_text(f"""[OPTIONS]
enable: 1
policy_in: DROP
policy_out: ACCEPT
ipfilter: 1
macfilter: 1
ndp: 0

[IPSET ipfilter-net0]
{ADDRESS}

[RULES]
IN ACCEPT -source 192.168.88.1 -p tcp -dport 22
IN ACCEPT -source 192.168.88.241 -p tcp -dport 22
IN ACCEPT -source 192.168.88.247 -p tcp -dport 22
IN ACCEPT -p udp -dport 41641
OUT ACCEPT -dest 192.168.88.1 -p udp -dport 53
OUT ACCEPT -dest 192.168.88.1 -p tcp -dport 53
OUT DROP -dest 10.0.0.0/8
OUT DROP -dest 172.16.0.0/12
OUT DROP -dest 192.168.0.0/16
OUT DROP -dest 169.254.0.0/16
OUT DROP -dest ::/0
""")
    run("qm", "create", VMID, "--name", NAME, "--cores", "2", "--memory", "4096", "--balloon", "0",
        "--cpu", "host", "--ostype", "l26", "--agent", "enabled=1", "--scsihw", "virtio-scsi-single",
        "--net0", f"virtio={MAC},bridge=vmbr0,firewall=1", "--serial0", "socket", "--vga", "serial0",
        "--onboot", "1", "--startup", "order=40", "--ide2", "local-lvm:cloudinit",
        "--ciuser", "fotfops", "--sshkeys", args.public_key_file,
        "--ipconfig0", f"ip={ADDRESS}/24,gw=192.168.88.1", "--nameserver", "192.168.88.1",
        "--cicustom", "user=local:snippets/fotf-workspace-user.yaml", "--tags", "global-fellowship;development",
        "--description", "Faith on the Frontlines development workspace. Private project access only; no production deploy credentials.")
    run("qm", "set", VMID, "--scsi0", f"local-lvm:0,import-from={IMAGE},discard=on,iothread=1,ssd=1")
    run("qm", "resize", VMID, "scsi0", "24G")
    run("qm", "set", VMID, "--boot", "order=scsi0")
    compiled = run("pve-firewall", "compile")
    assert "error" not in compiled.lower(), compiled
    run("qm", "start", VMID)
    print(run("qm", "status", VMID).strip(), flush=True)


if __name__ == "__main__":
    main()
