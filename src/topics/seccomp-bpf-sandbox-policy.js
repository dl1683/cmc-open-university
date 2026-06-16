// Seccomp-BPF and sandbox layers: a syscall filter is one enforcement layer,
// not a complete sandbox by itself.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'seccomp-bpf-sandbox-policy',
  title: 'Seccomp BPF Sandbox Policy',
  category: 'Security',
  summary: 'A runtime isolation primer: filter syscalls with seccomp-BPF, compose namespaces and cgroups, and understand why gVisor is not just a syscall allowlist.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['syscall filter', 'sandbox layers'], defaultValue: 'syscall filter' },
  ],
  run,
};

function labelMatrix(title, rows, columns, labelsByRow) {
  const labels = [''];
  const codes = new Map([['', 0]]);
  const code = (label) => {
    if (!codes.has(label)) {
      codes.set(label, labels.length);
      labels.push(label);
    }
    return codes.get(label);
  };
  return matrixState({
    title,
    rows,
    columns,
    values: labelsByRow.map((row) => row.map(code)),
    format: (value) => labels[value],
  });
}

function syscallGraph(title) {
  return graphState({
    nodes: [
      { id: 'proc', label: 'proc', x: 0.65, y: 3.7, note: 'untrusted' },
      { id: 'call', label: 'syscall', x: 2.75, y: 3.7, note: 'nr+args' },
      { id: 'arch', label: 'arch', x: 4.0, y: 2.1, note: 'ABI' },
      { id: 'filter', label: 'BPF', x: 4.0, y: 5.2, note: 'program' },
      { id: 'allow', label: 'allow', x: 6.2, y: 2.1, note: 'execute' },
      { id: 'errno', label: 'errno', x: 6.2, y: 3.7, note: 'deny' },
      { id: 'kill', label: 'kill', x: 6.2, y: 5.4, note: 'SIGSYS' },
      { id: 'log', label: 'audit', x: 8.4, y: 4.0, note: 'observe' },
    ],
    edges: [
      { id: 'e-proc-call', from: 'proc', to: 'call' },
      { id: 'e-call-arch', from: 'call', to: 'arch' },
      { id: 'e-call-filter', from: 'call', to: 'filter' },
      { id: 'e-arch-filter', from: 'arch', to: 'filter' },
      { id: 'e-filter-allow', from: 'filter', to: 'allow' },
      { id: 'e-filter-errno', from: 'filter', to: 'errno' },
      { id: 'e-filter-kill', from: 'filter', to: 'kill' },
      { id: 'e-errno-log', from: 'errno', to: 'log' },
      { id: 'e-kill-log', from: 'kill', to: 'log' },
    ],
  }, { title });
}

function layerGraph(title) {
  return graphState({
    nodes: [
      { id: 'workload', label: 'workload', x: 0.8, y: 3.7, note: 'code' },
      { id: 'namespaces', label: 'namespaces', x: 2.6, y: 2.0, note: 'view' },
      { id: 'cgroups', label: 'cgroups', x: 2.6, y: 5.4, note: 'limits' },
      { id: 'caps', label: 'caps', x: 4.5, y: 1.6, note: 'privs' },
      { id: 'seccomp', label: 'seccomp', x: 4.5, y: 3.7, note: 'syscalls' },
      { id: 'lsm', label: 'LSM', x: 4.5, y: 5.8, note: 'labels' },
      { id: 'gvisor', label: 'gVisor', x: 6.7, y: 3.7, note: 'Sentry' },
      { id: 'host', label: 'host', x: 8.8, y: 3.7, note: 'kernel' },
    ],
    edges: [
      { id: 'e-workload-namespaces', from: 'workload', to: 'namespaces' },
      { id: 'e-workload-cgroups', from: 'workload', to: 'cgroups' },
      { id: 'e-namespaces-caps', from: 'namespaces', to: 'caps' },
      { id: 'e-cgroups-lsm', from: 'cgroups', to: 'lsm' },
      { id: 'e-caps-seccomp', from: 'caps', to: 'seccomp' },
      { id: 'e-lsm-seccomp', from: 'lsm', to: 'seccomp' },
      { id: 'e-seccomp-gvisor', from: 'seccomp', to: 'gvisor' },
      { id: 'e-gvisor-host', from: 'gvisor', to: 'host' },
    ],
  }, { title });
}

function* syscallFilter() {
  yield {
    state: syscallGraph('Every syscall crosses the filter before the kernel action'),
    highlight: { active: ['proc', 'call', 'arch', 'filter', 'e-proc-call', 'e-call-arch', 'e-call-filter', 'e-arch-filter'], compare: ['allow'] },
    explanation: 'Seccomp-BPF attaches a small filter program to a process. The filter sees syscall number, architecture, and arguments, then returns an action.',
    invariant: 'Minimize kernel surface; do not pretend this is the whole sandbox.',
  };

  yield {
    state: syscallGraph('Allowed calls continue; denied calls do not'),
    highlight: { active: ['filter', 'allow', 'errno', 'e-filter-allow', 'e-filter-errno'], removed: ['kill'], found: ['log'] },
    explanation: 'A policy can allow common calls, return errno for expected denials, kill the process for dangerous calls, trap, trace, notify userspace, or log selected actions.',
  };

  yield {
    state: syscallGraph('The architecture check prevents ABI confusion'),
    highlight: { active: ['call', 'arch', 'filter', 'e-call-arch', 'e-arch-filter'], compare: ['allow'] },
    explanation: 'The filter must check architecture and syscall ABI, not only syscall numbers. The same numeric value can mean different things across ABIs.',
  };

  yield {
    state: labelMatrix(
      'Seccomp return actions',
      [
        { id: 'kill', label: 'kill' },
        { id: 'trap', label: 'trap' },
        { id: 'errno', label: 'errno' },
        { id: 'trace', label: 'trace' },
        { id: 'log', label: 'log' },
        { id: 'allow', label: 'allow' },
      ],
      [
        { id: 'effect', label: 'effect' },
        { id: 'use', label: 'use' },
      ],
      [
        ['stop proc', 'hard fail'],
        ['SIGSYS', 'debug'],
        ['fail call', 'normal deny'],
        ['ptrace', 'broker'],
        ['record', 'audit'],
        ['execute', 'needed call'],
      ],
    ),
    highlight: { active: ['kill:effect', 'errno:effect', 'allow:effect'], compare: ['trace:use'] },
    explanation: 'The return action is part of the data structure. A good profile distinguishes calls that should normally fail from calls that indicate compromise.',
  };
}

function* sandboxLayers() {
  yield {
    state: layerGraph('Seccomp is one layer in a sandbox stack'),
    highlight: { active: ['workload', 'namespaces', 'cgroups', 'caps', 'seccomp', 'lsm', 'e-workload-namespaces', 'e-workload-cgroups', 'e-caps-seccomp'], compare: ['host'] },
    explanation: 'The Linux kernel documentation is explicit: syscall filtering is not a complete sandbox. Namespaces, cgroups, Linux capabilities, LSM policy, seccomp, filesystem policy, and network policy must be composed.',
  };

  yield {
    state: layerGraph('gVisor moves the syscall surface behind an application kernel'),
    highlight: { active: ['workload', 'seccomp', 'gvisor', 'host', 'e-seccomp-gvisor', 'e-gvisor-host'], compare: ['namespaces', 'cgroups'] },
    explanation: 'gVisor is not just an allowlist. Its Sentry implements a Linux-like interface in userspace and does not pass application syscalls directly through to the host kernel.',
  };

  yield {
    state: labelMatrix(
      'Isolation mechanisms',
      [
        { id: 'ns', label: 'namespace' },
        { id: 'cg', label: 'cgroup' },
        { id: 'cap', label: 'capability' },
        { id: 'sec', label: 'seccomp' },
        { id: 'gvisor', label: 'gVisor' },
      ],
      [
        { id: 'controls', label: 'controls' },
        { id: 'misses', label: 'misses' },
      ],
      [
        ['visible world', 'syscall shape'],
        ['CPU/mem', 'file access'],
        ['priv ops', 'ordinary calls'],
        ['syscalls', 'data flow'],
        ['host API', 'perf cost'],
      ],
    ),
    highlight: { active: ['sec:controls', 'gvisor:controls'], compare: ['sec:misses', 'gvisor:misses'] },
    explanation: 'Each layer controls a different axis. Seccomp narrows kernel entry points; gVisor narrows host-kernel exposure by interposing a user-space kernel; neither replaces authorization or resource policy.',
  };

  yield {
    state: labelMatrix(
      'Tool-runtime profile',
      [
        { id: 'read', label: 'read tool' },
        { id: 'net', label: 'net fetch' },
        { id: 'build', label: 'build code' },
        { id: 'shell', label: 'shell' },
      ],
      [
        { id: 'profile', label: 'profile' },
        { id: 'proof', label: 'proof' },
      ],
      [
        ['no net', 'file log'],
        ['egress list', 'URL log'],
        ['tmp fs', 'digest'],
        ['microVM', 'transcript'],
      ],
    ),
    highlight: { active: ['read:profile', 'net:profile', 'build:profile', 'shell:profile'], found: ['shell:proof'] },
    explanation: 'Agent tools need profiles, not vibes. A read-only file tool, network fetcher, build runner, and shell executor should get different filesystem, network, syscall, and audit constraints.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'syscall filter') yield* syscallFilter();
  else if (view === 'sandbox layers') yield* sandboxLayers();
  else throw new InputError('Pick a sandbox-policy view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Seccomp-BPF is Linux system-call filtering. A process installs a BPF filter that evaluates syscall metadata and returns an action such as allow, errno, trap, kill, trace, notify, or log. It reduces exposed kernel surface, which is valuable when running parsers, plugins, build steps, agent tools, or other less-trusted code.',
        'The Linux kernel documentation warns that system-call filtering is not a sandbox by itself. It is a mechanism for minimizing exposed kernel surface and should be combined with other hardening layers such as namespaces, cgroups, capabilities, LSM policy, filesystem policy, and network policy.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The filter receives syscall number, architecture, instruction pointer, and arguments through seccomp data. A profile must check architecture to avoid ABI confusion, then match syscall numbers and sometimes arguments. Multiple filters compose by precedence, with the least permissive high-precedence action winning.',
        'Return actions encode policy. Allow executes the call. Errno fails it predictably. Kill stops the process. Trap sends SIGSYS for debugging or custom handling. Trace and user notification support broker-style designs. Log records selected events. The action choice is part of the runtime contract, not just an implementation detail.',
      ],
    },
    {
      heading: 'Sandbox layers',
      paragraphs: [
        'A practical sandbox composes several axes. Namespaces change what the process can see. Cgroups bound resources. Linux capabilities remove privileged operations. Seccomp filters kernel entry points. LSMs such as AppArmor or SELinux add label-based policy. Filesystem and network rules control information flow. Audit logs preserve evidence.',
        'gVisor takes a different approach from a raw seccomp allowlist. It provides a Linux-like application kernel called the Sentry. Application syscalls are handled by the Sentry rather than being passed directly through to the host kernel. gVisor then restricts the Sentry and Gofer host interactions for defense in depth.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'An agent platform offers four tools: read_repo, fetch_url, run_tests, and shell. The read tool runs without network and with a read-only mount. The fetch tool gets a tight egress allowlist and response-size limits. The test runner receives a writable temp directory, CPU and memory limits, and a syscall profile that denies mount and privileged operations. The shell tool, if allowed at all, runs in a stronger sandbox such as gVisor or a microVM with full transcript logging.',
        'The policy is tied to tool identity. A model cannot turn read_repo into a network exfiltration path because the runtime has no network. It cannot use run_tests to write outside the temp directory because the mount namespace and filesystem policy prevent it. Seccomp narrows syscalls, but the complete safety story depends on the full layer stack.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not call seccomp a complete sandbox. It cannot decide whether a file read is semantically authorized, whether a network destination leaks private data, or whether an allowed syscall is being used for a dangerous business action. It is a kernel-surface control.',
        'Do not deploy profiles without observation. Missing syscalls can break workloads in surprising ways, and vDSO behavior can differ across machines. Start with audit and trace data, tighten profiles, then make denials intentional. Do not give a privileged container an unconfined seccomp profile and assume Kubernetes protected it.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Linux kernel seccomp filter docs at https://docs.kernel.org/userspace-api/seccomp_filter.html, seccomp(2) at https://man7.org/linux/man-pages/man2/seccomp.2.html, Kubernetes seccomp docs at https://kubernetes.io/docs/reference/node/seccomp/, gVisor overview at https://gvisor.dev/docs/, and gVisor security model at https://gvisor.dev/docs/architecture_guide/security/. Study Capability Security & Attenuation, OPA Rego Policy Decision Graph, LLM Guardrail Policy Engine, Model Context Protocol Case Study, Agent Tool Permission Lattice, Kubernetes Admission Policy Gate, WebAssembly Linear Memory Case Study, and TUF Update Metadata Case Study next.',
      ],
    },
  ],
};
