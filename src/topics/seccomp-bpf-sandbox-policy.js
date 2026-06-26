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
  const nodeCount = 8;
  const edgeCount = 9;
  const filterInputs = 'syscall number, architecture, and arguments';
  const actionCount = 6;
  const actions = 'allow, errno, kill, trap, trace, and log';

  yield {
    state: syscallGraph('Every syscall crosses the filter before the kernel action'),
    highlight: { active: ['proc', 'call', 'arch', 'filter', 'e-proc-call', 'e-call-arch', 'e-call-filter', 'e-arch-filter'], compare: ['allow'] },
    explanation: `Seccomp-BPF attaches a small filter program to a process. The filter sees ${filterInputs}, then returns one of ${actionCount} possible actions.`,
    invariant: `Minimize kernel surface across all ${nodeCount} nodes; do not pretend this is the whole sandbox.`,
  };

  yield {
    state: syscallGraph('Allowed calls continue; denied calls do not'),
    highlight: { active: ['filter', 'allow', 'errno', 'e-filter-allow', 'e-filter-errno'], removed: ['kill'], found: ['log'] },
    explanation: `A policy can ${actions}. The graph has ${edgeCount} edges showing how each syscall flows from process to one of these outcomes.`,
  };

  yield {
    state: syscallGraph('The architecture check prevents ABI confusion'),
    highlight: { active: ['call', 'arch', 'filter', 'e-call-arch', 'e-arch-filter'], compare: ['allow'] },
    explanation: `The filter must check architecture and syscall ABI, not only syscall numbers. The arch node validates the ABI before the BPF program evaluates ${filterInputs}.`,
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
    explanation: `The return action is part of the data structure. With ${actionCount} distinct actions, a good profile distinguishes calls that should normally fail (errno) from calls that indicate compromise (kill).`,
  };
}

function* sandboxLayers() {
  const layerCount = 8;
  const layerEdgeCount = 8;
  const isolationMechanisms = 5;
  const layers = 'namespaces, cgroups, capabilities, LSM, and seccomp';
  const toolCount = 4;
  const toolNames = 'read tool, net fetch, build code, and shell';

  yield {
    state: layerGraph('Seccomp is one layer in a sandbox stack'),
    highlight: { active: ['workload', 'namespaces', 'cgroups', 'caps', 'seccomp', 'lsm', 'e-workload-namespaces', 'e-workload-cgroups', 'e-caps-seccomp'], compare: ['host'] },
    explanation: `The Linux kernel documentation is explicit: syscall filtering is not a complete sandbox. All ${layerCount} nodes in the stack — including ${layers} — must be composed to form real isolation.`,
  };

  yield {
    state: layerGraph('gVisor moves the syscall surface behind an application kernel'),
    highlight: { active: ['workload', 'seccomp', 'gvisor', 'host', 'e-seccomp-gvisor', 'e-gvisor-host'], compare: ['namespaces', 'cgroups'] },
    explanation: `gVisor is not just an allowlist. Its Sentry interposes between seccomp and the host kernel across ${layerEdgeCount} edges, implementing a Linux-like interface in userspace rather than passing application syscalls directly through.`,
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
    explanation: `Each of the ${isolationMechanisms} mechanisms controls a different axis. Seccomp narrows kernel entry points; gVisor narrows host-kernel exposure by interposing a user-space kernel; neither replaces authorization or resource policy.`,
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
    explanation: `Agent tools need profiles, not vibes. Each of ${toolCount} tool types — ${toolNames} — should get different filesystem, network, syscall, and audit constraints.`,
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
    { heading: 'How to read the animation', paragraphs: [
      'The syscall-filter view follows one system call from user code to a seccomp-BPF filter. A system call is a request into the Linux kernel, and active nodes show the metadata being checked before the call is allowed or denied.',
      {type: 'image', src: './assets/gifs/seccomp-bpf-sandbox-policy.gif', alt: 'Animated walkthrough of the seccomp bpf sandbox policy visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
    ]},
    { heading: 'Why this exists', paragraphs: [
      'Untrusted code should not be able to ask the kernel for every service it provides. Seccomp-BPF exists to reduce the kernel entry points available after compromise, not to make the code trustworthy.',
      {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/5/5b/Linux_kernel_map.png', alt: 'Linux kernel map showing system interfaces, memory, storage, networking, and security layers', caption: 'The kernel exposes many service families; seccomp narrows which entry points a process can reach. Source: Wikimedia Commons, Constantine Shulyupin, CC BY-SA 3.0.'},
      {type: 'callout', text: 'Seccomp is an attack-surface reducer, not an authority model: it filters kernel entry points while other layers control identity, files, network, and resources.'},
    ]},
    { heading: 'The obvious approach', paragraphs: [
      'The obvious approach is to run code in a container and assume the container is the sandbox. That is incomplete because a container can still expose a broad host-kernel API unless syscall filtering and other controls are applied.',
    ]},
    { heading: 'The wall', paragraphs: [
      'No single layer sees the whole security question. Seccomp sees syscall metadata, but it does not know whether a file read is semantically allowed or whether an allowed network connection leaks data.',
    ]},
    { heading: 'The core insight', paragraphs: [
      'Sandboxing is composition across axes. Namespaces control what a process sees, cgroups control resources, capabilities control privileged operations, LSMs control labeled access, and seccomp controls syscall entry.',
      {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/6/65/Simplified_Structure_of_the_Linux_Kernel.svg', alt: 'Simplified Linux kernel structure showing user space, system calls, virtual file system, drivers, and hardware', caption: 'Sandbox layers sit around a real kernel stack; seccomp only governs syscall entry, not every downstream authorization question. Source: Wikimedia Commons, ScotXW, CC BY-SA 4.0 or GFDL.'},
    ]},
    { heading: 'How it works', paragraphs: [
      'A process installs a BPF filter program. On each syscall, the kernel exposes architecture, syscall number, instruction pointer, and arguments, and the filter returns an action such as allow, errno, kill, trace, notify, or log.',
    ]},
    { heading: 'Why it works', paragraphs: [
      'Seccomp works after compromise by removing options. If an exploited parser cannot call mount, ptrace, keyctl, or raw socket operations, the attacker has fewer routes from code execution to host damage.',
    ]},
    { heading: 'Cost and complexity', paragraphs: [
      'Runtime overhead is usually small, but profile engineering is real work. Profiles must be traced, reviewed, tested across kernels and architectures, versioned with the workload, and observed in production.',
    ]},
    { heading: 'Real-world uses', paragraphs: [
      'Seccomp fits browser renderers, serverless functions, CI jobs, media parsers, document converters, plugin hosts, Kubernetes workloads, and agent tools. Each workload should get a profile that matches its actual operating-system vocabulary.',
    ]},
    { heading: 'Where it fails', paragraphs: [
      'Seccomp fails as a complete sandbox because it is not an authority model. If read is allowed and secrets are mounted, seccomp will not know the read is forbidden, so filesystem and identity policy must do that work.',
    ]},
    { heading: 'Worked example', paragraphs: [
      'A read-only file tool may need openat with read-only flags, read, close, fstat, mmap, munmap, brk, futex, and exit. It should not need socket, connect, mount, ptrace, keyctl, chmod, or unlink.',
      'A shell tool may need fork or clone, execve, wait4, pipe, dup2, and broader filesystem calls. Giving the shell profile to the read-only tool overexposes it; giving the read-only profile to the shell breaks it.',
    ]},
    { heading: 'Sources and study next', paragraphs: [
      'Primary sources are the Linux kernel seccomp filter documentation, seccomp(2), Kubernetes seccomp docs, and the gVisor architecture and security model. Study Linux capabilities, namespaces, cgroups, AppArmor or SELinux, WebAssembly sandboxing, microVMs, and audit logging next.',
    ]},
  ],
};