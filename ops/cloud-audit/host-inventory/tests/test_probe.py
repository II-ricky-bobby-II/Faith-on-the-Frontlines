"""Inert probe tests: OSReadPort/host commands are never invoked."""
import ast
import copy
import hashlib
import json
import os
import re
from pathlib import Path
import signal
import sys
import tempfile
import types
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import collector as probe
import render_workflow
import yaml


class InertPort:
    def __init__(self):
        self.clock, self.calls = 0, []
        self.meta = {k: "" for k in probe.KEYS}
        self.meta.update(GITHUB_REPOSITORY=probe.REPOSITORY, GITHUB_REPOSITORY_ID=probe.REPOSITORY_ID,
            GITHUB_ACTOR=probe.OWNER, GITHUB_ACTOR_ID=probe.OWNER_ID, GITHUB_TRIGGERING_ACTOR=probe.OWNER,
            GITHUB_EVENT_NAME="workflow_dispatch", GITHUB_RUN_ATTEMPT="1", GITHUB_RUN_ID="12345",
            GITHUB_REF=probe.REF, GITHUB_SHA="a"*40, GITHUB_WORKFLOW_SHA="a"*40,
            GITHUB_WORKFLOW_REF=probe.REPOSITORY+"/"+probe.WORKFLOW+"@"+probe.REF, GITHUB_JOB="inventory",
            RUNNER_OS="Linux", RUNNER_ARCH="X64", RUNNER_ENVIRONMENT="github-hosted", ImageOS=probe.IMAGE_OS,
            ImageVersion=probe.IMAGE, FOTF_APPROVED_SHA="a"*40, FOTF_REPOSITORY_PUBLIC="true", FOTF_STORAGE_CONFIRMED="true")
        self.kernel_value, self.machine_value = probe.KERNEL, "x86_64"
        self.missing, self.after, self.bad_query = None, None, None
    def event(self, kind, value=None):
        self.calls.append((kind,value))
        if self.after: self.after(kind,value)
    def monotonic(self): return self.clock
    def metadata(self): self.event("metadata"); return copy.deepcopy(self.meta)
    def kernel(self): self.event("kernel"); return self.kernel_value
    def machine(self): self.event("machine"); return self.machine_value
    def file_identity(self, path, deadline):
        self.event("file",path)
        return {"available": path!=self.missing, "realPath":path,"path":path,"uid":0,"mode":493,"bytes":1,"sha256":"f"*64}
    def read(self,path):
        self.event("read",path)
        if path in ("/etc/subuid","/etc/subgid"):return b"other:200000:65536\nrunner:100000:65536\n"
        if path=="/proc/meminfo":return b"MemTotal: 16000000 kB\nMemAvailable: 12000000 kB\nSecretUnrelatedField: ignored\n"
        return b"inert metadata\n"
    def stat(self,path):self.event("stat",path);return {"exists":True,"uid":0,"gid":0,"mode":493,"type":"file"}
    def namespace(self,path):self.event("namespace",path);return "inert:[123]"
    def capacity(self):self.event("capacity");return {"cpus":4,"freeBytes":14*1024**3,"freeInodes":100000,"uid":1001,"gid":1001}
    def query(self,name,paths,argument,deadline):
        self.event("query",(name,argument))
        # Validate exactly the argv grammar that the live port would use.
        probe.query_argv(name,paths,argument)
        if self.bad_query:return self.bad_query(name,argument)
        if name=="package-owner":return 0,("fixture-package: "+argument+"\n").encode()
        if name=="package-version":return 0,b"fixture-package\t1.0\n"
        if name=="library-cache":return 0,b"libfixture.so (libc6,x86-64) => /lib/x86_64-linux-gnu/libfixture.so\n"
        if name=="elf-dynamic":return 0,b" (NEEDED) Shared library: [libfixture.so]\n"
        if name=="elf-program":return 0,b" [Requesting program interpreter: /lib64/ld-fixture.so]\n"
        if name=="sudo-id":return 0,b"0\n"
        if name=="registry-ipv4":return 0,b"104.16.24.34 STREAM registry.npmjs.org\n"
        return 0,b'[]'


class ProbeTests(unittest.TestCase):
    def setUp(self):self.port=InertPort()
    def run_probe(self):return probe.Inventory(self.port,"b"*64).collect()

    def test_complete_inert_inventory_is_explicitly_not_qualification(self):
        self.report=self.run_probe()
        self.assertEqual(self.report['status'],'inventory-collected',self.report)
        self.assertFalse(self.report['qualification']);self.assertFalse(self.report['releaseReady'])
        self.assertFalse(self.report['externalApprovalVerified'])
        self.assertEqual(self.report['observations']['subuid'],['runner:100000:65536'])
        self.assertNotIn('SecretUnrelatedField',json.dumps(self.report))
        self.assertEqual(set(self.report['tools']),set(probe.PATHS)|set(probe.HELPERS))
        self.assertTrue(self.report['libraries']['files'])
        report,files=probe.evidence_bytes(self.report)
        self.assertLessEqual(sum(map(len,files.values())),probe.MAX_EVIDENCE)
        manifest=json.loads(files['manifest.json'])
        self.assertEqual(manifest['files']['inventory.json']['sha256'],hashlib.sha256(files['inventory.json']).hexdigest())

    def test_all_identity_and_host_drift_refuses_before_host_inventory_or_commands(self):
        fields=[(key,'wrong') for key in probe.KEYS if key not in ('GITHUB_SHA','GITHUB_WORKFLOW_SHA','FOTF_APPROVED_SHA')]
        fields += [('GITHUB_SHA','f'*40),('GITHUB_WORKFLOW_SHA','f'*40),('FOTF_APPROVED_SHA','f'*40),('kernel','wrong'),('machine','aarch64')]
        for name,value in fields:
            with self.subTest(field=name):
                self.port=InertPort()
                if name=='kernel':self.port.kernel_value=value
                elif name=='machine':self.port.machine_value=value
                else:self.port.meta[name]=value
                report=self.run_probe()
                self.assertEqual(report['status'],'failed',name)
                self.assertIn('observedHost',report)
                self.assertFalse(any(kind in ('file','read','stat','namespace','capacity','query') for kind,_ in self.port.calls))

    def test_missing_metadata_and_oversized_values_fail_closed(self):
        for change in (lambda x:x.pop('ImageVersion'),lambda x:x.update(ImageVersion='x'*513)):
            with self.subTest(change=change.__code__.co_firstlineno):
                self.port=InertPort();change(self.port.meta)
                self.assertEqual(self.run_probe()['status'],'failed')
                self.assertFalse(any(k=='query' for k,_ in self.port.calls))

    def test_intra_collection_deadline_stops_further_queries(self):
        for target in ('file','read','query'):
            with self.subTest(target=target):
                self.port=InertPort()
                def after(kind,value):
                    if kind==target:self.port.clock=probe.MAX_SECONDS
                self.port.after=after
                report=self.run_probe()
                self.assertEqual(report['status'],'failed')
                self.assertEqual(report['refusal'],'inventory deadline')
                index=next(i for i,(k,_) in enumerate(self.port.calls) if k==target)
                self.assertFalse(any(k=='query' for k,_ in self.port.calls[index+1:]))

    def test_missing_tool_never_installs_or_falls_back(self):
        self.port.missing=probe.PATHS['nft'];report=self.run_probe()
        self.assertEqual(report['status'],'failed')
        self.assertIn('missing tool: nft',report['problems'])
        self.assertFalse(any(k=='query' for k,_ in self.port.calls))

    def test_package_provenance_recognizes_only_same_file_usrmerge_alias(self):
        inventory=probe.Inventory(self.port,'b'*64);inventory.paths={**probe.PATHS,**probe.HELPERS}
        def result(name,arg):
            if name=='package-owner' and arg=='/usr/sbin/ip':return 1,b''
            if name=='package-owner' and arg=='/sbin/ip':return 0,b'iproute2: /sbin/ip\n'
            if name=='package-version':return 0,b'iproute2\t1.0\n'
            raise AssertionError((name,arg))
        self.port.bad_query=result
        self.assertEqual(inventory.package('/usr/sbin/ip'),{'iproute2':'iproute2\t1.0'})
        self.assertEqual([v for k,v in self.port.calls if k=='query'],[('package-owner','/usr/sbin/ip'),('package-owner','/sbin/ip'),('package-version','iproute2')])

    def test_nonpublic_registry_addresses_are_not_an_allowlist(self):
        original=self.port.query
        def query(name,paths,arg,deadline):
            if name=='registry-ipv4':return 0,b'169.254.169.254 STREAM registry.npmjs.org\n'
            return original(name,paths,arg,deadline)
        self.port.query=query
        report=self.run_probe()
        self.assertEqual(report['status'],'failed')
        self.assertEqual(report['refusal'],'nonpublic registry address')

    def test_failed_privileged_reads_are_incomplete_not_success_or_authority(self):
        original=self.port.query
        def query(name,paths,arg,deadline):
            if name in ('sudo-id','firewall'):return 1,b'permission denied\n'
            return original(name,paths,arg,deadline)
        self.port.query=query
        report=self.run_probe()
        self.assertEqual(report['status'],'inventory-incomplete')
        self.assertFalse(report['observations']['passwordlessSudoObserved'])
        self.assertFalse(report['qualification']);self.assertFalse(report['externalApprovalVerified'])

    def test_missing_required_host_fact_is_incomplete_without_configuration_writes(self):
        original=self.port.read
        self.port.read=lambda path:None if path==probe.READS['controllers'] else original(path)
        report=self.run_probe()
        self.assertEqual(report['status'],'inventory-incomplete')
        self.assertIn('missing host fact: controllers',report['problems'])
        self.assertIsNone(report['observations']['controllers'])

    def test_oversized_and_malformed_query_data_cannot_pass(self):
        for value in (b'x'*(probe.MAX_QUERY+1),b'\xff'):
            with self.subTest(bytes=len(value)):
                self.port=InertPort();self.port.bad_query=lambda n,a:(0,value)
                report=self.run_probe();self.assertEqual(report['status'],'failed')
                self.assertNotIn(value[:20].decode(errors='replace'),json.dumps(report))

    def test_unknown_queries_and_unsafe_arguments_are_denied(self):
        paths={**probe.PATHS,**probe.HELPERS}
        for name,arg in [('install',None),('firewall','add rule'),('package-version','--help'),('elf-dynamic','/tmp/candidate'),('package-owner','/usr/../secret')]:
            with self.subTest(name=name,arg=arg):
                with self.assertRaises(probe.Refused):probe.query_argv(name,paths,arg)
        self.assertEqual(probe.query_argv('firewall',paths),['/usr/bin/sudo','-n','/usr/sbin/nft','-j','list','ruleset'])

    def test_evidence_limit_is_failed_compact_output_not_silent_success(self):
        report={'status':'inventory-collected','collectorSha256':'b'*64,'identity':{},'large':'x'*probe.MAX_EVIDENCE}
        report,files=probe.evidence_bytes(report)
        self.assertEqual(report['status'],'failed');self.assertEqual(report['errorType'],'EvidenceLimit')
        self.assertLess(sum(map(len,files.values())),probe.MAX_EVIDENCE)

    def test_evidence_only_creates_two_private_files_and_never_overwrites(self):
        report,files=probe.evidence_bytes(self.run_probe())
        with tempfile.TemporaryDirectory() as tmp:
            probe.write_evidence(tmp,files)
            folder=Path(tmp)/'host-inventory-evidence'
            self.assertEqual({p.name for p in folder.iterdir()},{'inventory.json','manifest.json'})
            self.assertEqual(folder.stat().st_mode&0o777,0o700)
            for p in folder.iterdir():self.assertEqual(p.stat().st_mode&0o777,0o600)
            with self.assertRaises(FileExistsError):probe.write_evidence(tmp,files)
        with tempfile.TemporaryDirectory() as tmp:
            target=Path(tmp)/'target';target.mkdir();(Path(tmp)/'host-inventory-evidence').symlink_to(target)
            with self.assertRaises(FileExistsError):probe.write_evidence(tmp,files)
            self.assertEqual(list(target.iterdir()),[])

    def test_evidence_sync_failure_propagates_and_cannot_acknowledge_success(self):
        _,files=probe.evidence_bytes(self.run_probe())
        with tempfile.TemporaryDirectory() as tmp,patch.object(probe.os,'fsync',side_effect=OSError('inert sync failure')):
            with self.assertRaises(OSError):probe.write_evidence(tmp,files)
            self.assertFalse((Path(tmp)/'host-inventory-evidence/manifest.json').exists())

    def test_read_port_refuses_paths_outside_closed_metadata_scope(self):
        port=probe.OSReadPort()
        for method,path in [(port.read,'/proc/self/environ'),(port.read,'/etc/shadow'),(port.stat,'/home/runner/.ssh'),(port.namespace,'/proc/1/ns/mnt')]:
            with self.subTest(path=path):
                with patch.object(probe.os,'open') as opener,patch.object(probe.os,'lstat') as st,patch.object(probe.os,'readlink') as link:
                    with self.assertRaises(probe.Refused):method(path)
                    opener.assert_not_called();st.assert_not_called();link.assert_not_called()

    def test_untrusted_system_tool_is_not_read_or_executed(self):
        port=probe.OSReadPort()
        root_info=types.SimpleNamespace(st_uid=0,st_mode=0o100777)
        with patch.object(probe.Path,'resolve',return_value=Path('/usr/bin/fake')),patch.object(probe.Path,'lstat',return_value=root_info),patch.object(probe.os,'open') as opener:
            with self.assertRaises(probe.Refused):port.file_identity('/usr/bin/fake',1)
            opener.assert_not_called()

    def test_pipe_output_overflow_and_timeout_kill_group_before_reaping(self):
        for mode in ('overflow','timeout','success'):
            with self.subTest(mode=mode):
                events=[]
                class Stream:
                    def fileno(self):return 987
                    def close(self):events.append('stream-close')
                class Child:
                    pid=987654321;stdout=Stream()
                    def wait(self,timeout):events.append('wait');return 0
                    def poll(self):raise AssertionError('leader must remain unreaped before kill')
                class Selector:
                    def __init__(self):self.open=True;self.reads=0
                    def register(self,*args):pass
                    def get_map(self):return {987:True} if self.open else {}
                    def select(self,timeout):
                        self.reads+=1
                        return [(types.SimpleNamespace(fd=987,fileobj=Child.stdout),1)] if mode!='timeout' else []
                    def unregister(self,*args):self.open=False
                    def close(self):events.append('selector-close')
                clock=[0]
                def now():clock[0]+=0.02;return clock[0]
                reads=iter((b'ok',b''))
                def read(fd,maximum):return b'x'*(maximum) if mode=='overflow' else next(reads)
                with patch.object(probe.subprocess,'Popen',return_value=Child()) as popen,patch.object(probe.selectors,'DefaultSelector',Selector),patch.object(probe.os,'set_blocking'),patch.object(probe.os,'read',side_effect=read),patch.object(probe.os,'killpg',side_effect=lambda pid,sig:events.append(('kill',pid,sig))),patch.object(probe.time,'monotonic',side_effect=now),patch.object(probe.signal,'getsignal',return_value=signal.SIG_DFL):
                    if mode=='success':self.assertEqual(probe.bounded_command(['/usr/bin/id','-u'],1,maximum=16),(0,b'ok'))
                    else:
                        with self.assertRaises(probe.Refused):probe.bounded_command(['/usr/bin/id','-u'],0.12 if mode=='timeout' else 1,maximum=16)
                    self.assertEqual(popen.call_count,1)
                    kwargs=popen.call_args.kwargs
                    self.assertEqual(kwargs['env'],probe.HOST_ENV)
                    self.assertNotIn('shell',kwargs)
                if mode!='success':self.assertEqual(events[0][0],'kill');self.assertEqual(events[1],'wait')
                else:self.assertFalse(any(type(e) is tuple and e[0]=='kill' for e in events))

    def test_live_port_reads_only_named_environment_keys(self):
        class Env:
            def get(self,key,default):
                if key not in probe.KEYS:raise AssertionError('non-allowlisted environment read')
                return 'inert'
            def __iter__(self):raise AssertionError('environment dump')
        with patch.object(probe.os,'environ',Env()):
            self.assertEqual(set(probe.OSReadPort().metadata()),set(probe.KEYS))

    def test_workflow_has_no_checkout_install_image_or_token_permission(self):
        source=(ROOT/'collector.py').read_bytes()
        raw=(ROOT.parents[2]/'.github/workflows/cloud-audit.yml').read_bytes()
        self.assertEqual(raw,render_workflow.render(source))
        class WorkflowLoader(yaml.SafeLoader):pass
        WorkflowLoader.yaml_implicit_resolvers={k:[r for r in v if r[0]!='tag:yaml.org,2002:bool'] for k,v in yaml.SafeLoader.yaml_implicit_resolvers.items()}
        WorkflowLoader.add_implicit_resolver('tag:yaml.org,2002:bool',re.compile(r'^(?:true|false)$'),['t','f'])
        doc=yaml.load(raw,Loader=WorkflowLoader)
        self.assertEqual(set(doc['on']),{'workflow_dispatch'})
        self.assertEqual(set(doc['on']['workflow_dispatch']['inputs']),{'probe_sha','storage_available'})
        self.assertIs(doc['on']['workflow_dispatch']['inputs']['storage_available']['default'],False)
        self.assertEqual(doc['permissions'],{})
        self.assertEqual(set(doc['jobs']),{'inventory'})
        self.assertIs(doc['concurrency']['cancel-in-progress'],False)
        job=doc['jobs']['inventory'];self.assertEqual(job['permissions'],{})
        self.assertEqual(job['timeout-minutes'],5);self.assertEqual(job['runs-on'],'ubuntu-22.04')
        self.assertEqual(len(job['steps']),2);self.assertNotIn('container',job);self.assertNotIn('services',job)
        self.assertIn("github.actor_id == '116130409'",job['if'])
        self.assertIn("github.sha == inputs.probe_sha",job['if'])
        self.assertIn("github.run_attempt == '1'",job['if'])
        self.assertIn("toJSON(github.event.repository.private) == 'false'",job['if'])
        body=job['steps'][0]['run'].split("<<'PY'\n",1)[1].rsplit('\nPY',1)[0]
        launch=job['steps'][0]['run'].split("<<'PY'\n",1)[0]
        self.assertTrue(launch.startswith('/usr/bin/env -i PATH='))
        self.assertIn('/usr/bin/python3 -I -S -B',launch)
        self.assertEqual(set(re.findall(r'\$\{([A-Za-z0-9_]+)-\}',launch)),set(probe.KEYS))
        tree=ast.parse(body)
        assignment=next(n for n in tree.body if isinstance(n,ast.Assign) and n.targets[0].id=='source')
        expected=next(n for n in tree.body if isinstance(n,ast.Assign) and n.targets[0].id=='expected')
        self.assertEqual(ast.literal_eval(assignment.value).encode(),source)
        self.assertEqual(ast.literal_eval(expected.value),hashlib.sha256(source).hexdigest())
        upload=job['steps'][1]
        self.assertEqual(upload['uses'],'actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02')
        self.assertEqual(upload['with']['retention-days'],90)
        self.assertIs(upload['with']['overwrite'],False)
        self.assertIs(upload['with']['include-hidden-files'],False)
        self.assertEqual(set(upload['with']['path'].split()),{'host-inventory-evidence/inventory.json','host-inventory-evidence/manifest.json'})
        self.assertNotIn('secrets.',raw.decode());self.assertNotIn('github.token',raw.decode())

    def test_scope_matches_hard_bounds_and_has_no_activation_or_live_identity(self):
        scope=json.loads((ROOT/'scope.json').read_bytes())
        self.assertEqual(scope['permissions'],{});self.assertEqual(scope['images'],[])
        self.assertFalse(scope['qualification']);self.assertFalse(scope['releaseReady'])
        self.assertFalse(scope['externalApprovalVerified']);self.assertFalse(scope['currentDispatchAuthorityVerified'])
        self.assertIsNone(scope['actualRunId']);self.assertIsNone(scope['actualJobId'])
        self.assertEqual(scope['collectorSeconds'],probe.MAX_SECONDS)
        self.assertEqual(scope['evidenceBytes'],probe.MAX_EVIDENCE)
        self.assertEqual(scope['queryBytes'],probe.MAX_QUERY)
        self.assertEqual(scope['host']['ImageVersion'],probe.IMAGE)
        self.assertEqual(scope['host']['kernel'],probe.KERNEL)


if __name__=='__main__':unittest.main()
