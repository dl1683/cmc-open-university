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
      heading: 'Why this exists',
      paragraphs: [
        'Seccomp-BPF exists because untrusted or semi-trusted code should not be able to ask the kernel for every service the kernel provides. A parser, plugin, test runner, browser process, container workload, or agent tool may need read, write, futex, mmap, and a small set of ordinary calls. It usually does not need mount, ptrace, keyctl, raw networking, or privilege-changing operations.',
        'The kernel boundary is one of the most important attack surfaces on a Linux system. If compromised code can call every syscall with arbitrary arguments, the attacker has a large menu of kernel behaviors to probe. Seccomp reduces that menu. It does not make the code trustworthy, but it narrows what the code can ask the host kernel to do.',
        'This distinction matters because people often use the word sandbox too loosely. Seccomp is an enforcement mechanism inside a sandbox architecture. It is strongest when combined with namespaces, cgroups, capabilities, filesystem rules, network controls, LSM policy, brokers, and logging. Alone, it is a syscall filter, not a complete isolation story.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to run code in a container and assume the container is the sandbox. That is not precise enough. A container changes namespaces, filesystem views, resource controls, and defaults, but the workload may still reach a large host-kernel API unless syscall filtering and other controls are actually applied.',
        'Another obvious approach is to deny a few dangerous syscalls by name. That is usually weaker than an allowlist. Linux has many syscalls, and danger depends on arguments, capabilities, namespaces, and kernel version. A small denylist can leave surprising routes open. A tight allowlist starts from what the workload needs and treats everything else as suspicious.',
        'A third shortcut is to copy a profile from another workload. That may be a useful starting point, but syscall needs are runtime contracts. A compiler, network fetcher, image decoder, browser renderer, and shell do different things. If they all receive the same broad profile, the profile is probably documenting operational convenience rather than actual least privilege.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core insight is that each isolation layer controls a different axis. Namespaces control what the process can see. Cgroups control how much resource it can consume. Capabilities control privileged operations. Filesystem policy controls paths and mutability. Network policy controls destinations. LSMs control label-based access. Seccomp controls which syscalls can reach the kernel.',
        'Because each layer controls a different axis, no single layer should be asked to do every job. Seccomp cannot decide whether reading a particular file is semantically allowed if read is on the allowlist. A mount namespace cannot stop an allowed syscall from exploiting a kernel bug. A cgroup cannot stop data exfiltration. The architecture works by reducing independent freedoms at the same time.',
        'The second insight is that return actions are policy. Allow, errno, kill, trap, trace, user notification, and log are not interchangeable. Returning errno can be correct for an expected denial. Killing the process can be correct for a syscall that should never appear. Logging can be useful during profile development. The action tells the runtime how seriously to treat the event.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A process installs a seccomp filter program. On each syscall, the kernel exposes metadata such as architecture, syscall number, instruction pointer, and arguments. The filter evaluates that metadata and returns an action. A correct profile checks architecture first because syscall numbers can mean different things across ABIs. Ignoring that check can create ABI confusion.',
        'Profiles can match only what seccomp can see. Argument filtering is possible for simple numeric arguments, but seccomp does not inspect arbitrary pointed-to memory as a rich object. That means it can restrict a syscall shape, not fully understand the business meaning of the operation. If semantic approval is needed, a broker or a higher-level policy layer must participate.',
        'Filters are usually developed from observation. Run the workload under audit or trace, collect the syscalls it actually needs, remove broad permissions, then decide how denials should behave. Production profiles should be intentional, versioned, and tied to the workload. "It did not crash in one test" is not enough evidence that the profile is complete.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The syscall-filter view proves where seccomp sits. The workload asks for a syscall, the filter checks architecture and syscall metadata, and the runtime chooses allow, errno, kill, trap, trace, notify, or log. The program may still be compromised, but the set of kernel entry points available to that compromised program has been narrowed.',
        'The sandbox-layers view proves the architectural point. Seccomp is one node in a stack, not the stack. Namespaces, cgroups, capabilities, LSM policy, filesystem rules, network policy, brokers, and audit logs each cover a different failure mode. If the visual leaves you thinking "seccomp equals sandbox," it has been misread.',
        'The tool-runtime table makes the design concrete. A read-only repository tool, network fetcher, build runner, and shell executor should not share one vague permission bucket. They should have different mounts, network routes, resource limits, syscall profiles, and evidence logs. Sandboxing begins by naming the workload precisely.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works by reducing available behavior after compromise. A perfect program does not need seccomp. Seccomp matters when code is buggy, adversarial, or running data it should not fully trust. If an image decoder exploit lands in a process that cannot call dangerous syscalls, the attacker has fewer paths from code execution to host damage.',
        'It also works because syscall needs are often much smaller than syscall availability. Most specialized workloads use a stable subset of calls. Rendering, parsing, fetching, and testing are not the same as administering the machine. A profile turns that observation into enforcement.',
        'Layering works because failures are not all the same. If a workload escapes a filesystem assumption, seccomp may still block privileged kernel operations. If a syscall is allowed, the namespace may still hide host resources. If both allow an action, audit may still preserve evidence. Defense in depth is not a slogan here; it is a map of independent controls.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'The runtime overhead of a seccomp filter is usually small compared with the security value, but the engineering cost is real. Profiles must be generated, reviewed, tested across kernels and distributions, updated when dependencies change, and observed in production. Too narrow a profile causes strange failures. Too broad a profile becomes documentation theater.',
        'Strict profiles can also conflict with debuggability. Developers may need trace, perf, ptrace, or unusual syscalls that production code should never use. The answer is not to leave production wide open. The answer is to separate developer, CI, staging, and production profiles, and to make temporary privilege expansion visible and reviewed.',
        'gVisor, microVMs, and brokered designs add stronger isolation but cost more in compatibility, performance, and operational complexity. Raw seccomp is lightweight but limited. The right choice depends on the workload risk, kernel exposure, performance budget, and how much behavior must be faithfully emulated.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Seccomp wins for workloads with narrow, stable syscall needs: browser renderers, containerized services, serverless functions, CI jobs, build steps, media parsers, document converters, plugin hosts, and agent tools. It is especially useful when code must process untrusted input but should only need a small operating-system vocabulary.',
        'It is also useful as a policy boundary in multi-tool systems. A model-orchestrated read tool should not be able to open network sockets just because the shell tool can. A build runner should not gain host administration calls because a different workload needed them. Per-tool seccomp profiles help turn abstract permissions into actual runtime constraints.',
        'In Kubernetes, seccomp profiles help move from "containerized" to "constrained." They should sit alongside non-root users, dropped capabilities, read-only root filesystems, network policies, AppArmor or SELinux, resource limits, and admission controls. The combination is the sandbox posture.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'Do not call seccomp a complete sandbox. It cannot decide whether a file read is semantically authorized, whether an allowed network connection leaks private data, or whether a permitted syscall is being used for a dangerous application-level action. It is a kernel-surface control.',
        'Do not deploy profiles without observation. Missing syscalls can break workloads in surprising ways, and behavior can differ across libc, kernel versions, architectures, and optional features. Start with audit and trace data, tighten profiles, then make denials intentional. A profile that only passed one happy-path test is not a production profile.',
        'Do not ignore privilege context. A privileged container with broad capabilities and an unconfined or permissive seccomp profile is not meaningfully isolated just because it is packaged as a container. Conversely, a tight seccomp profile on a process with broad filesystem and network access may still permit serious data loss. The layers must agree on the threat model.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: Linux kernel seccomp filter docs at https://docs.kernel.org/userspace-api/seccomp_filter.html, seccomp(2) at https://man7.org/linux/man-pages/man2/seccomp.2.html, Kubernetes seccomp docs at https://kubernetes.io/docs/reference/node/seccomp/, gVisor overview at https://gvisor.dev/docs/, and gVisor security model at https://gvisor.dev/docs/architecture_guide/security/.',
        'Study Capability Security & Attenuation, Agent Tool Permission Lattice, OPA Rego Policy Decision Graph, Kubernetes Admission Policy Gate, WebAssembly Linear Memory Case Study, TUF Update Metadata Case Study, and Confidential Computing Attestation Chain Case Study next.',
        'A useful exercise is to design four profiles for one platform: read-only file access, network fetch, test execution, and interactive shell. For each profile, list mounts, network access, cgroup limits, capabilities, seccomp actions, and audit evidence. That exercise forces the key lesson: sandboxing is workload-specific architecture, not a single checkbox.',
      ],
    },
  ],
};
