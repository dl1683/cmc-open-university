// The Update Framework: signed metadata roles that make software updates
// resistant to rollback, freeze, mix-and-match, and key-compromise failures.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'tuf-update-metadata-case-study',
  title: 'TUF Update Metadata Case Study',
  category: 'Security',
  summary: 'Secure software updates with root, targets, snapshot, timestamp, delegated roles, threshold signatures, hashes, versions, and expiry.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['role graph', 'client workflow'], defaultValue: 'role graph' },
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

function roleGraph(title) {
  return graphState({
    nodes: [
      { id: 'root', label: 'root', x: 0.9, y: 4.0, note: 'keys' },
      { id: 'targets', label: 'targets', x: 2.8, y: 2.3, note: 'files' },
      { id: 'delegated', label: 'delegate', x: 4.8, y: 1.7, note: 'path' },
      { id: 'target', label: 'file', x: 7.0, y: 1.7, note: 'hash' },
      { id: 'snapshot', label: 'snap', x: 3.4, y: 4.0, note: 'versions' },
      { id: 'timestamp', label: 'time', x: 5.6, y: 4.0, note: 'fresh' },
      { id: 'mirror', label: 'mirror', x: 7.25, y: 4.18, note: 'untrusted' },
      { id: 'client', label: 'client', x: 9.35, y: 3.62, note: 'verify' },
    ],
    edges: [
      { id: 'e-root-targets', from: 'root', to: 'targets' },
      { id: 'e-root-snapshot', from: 'root', to: 'snapshot' },
      { id: 'e-root-timestamp', from: 'root', to: 'timestamp' },
      { id: 'e-targets-delegated', from: 'targets', to: 'delegated' },
      { id: 'e-delegated-target', from: 'delegated', to: 'target' },
      { id: 'e-snapshot-targets', from: 'snapshot', to: 'targets' },
      { id: 'e-timestamp-snapshot', from: 'timestamp', to: 'snapshot' },
      { id: 'e-mirror-client', from: 'mirror', to: 'client' },
      { id: 'e-client-timestamp', from: 'client', to: 'timestamp' },
      { id: 'e-client-target', from: 'client', to: 'target' },
    ],
  }, { title });
}

function workflowGraph(title) {
  return graphState({
    nodes: [
      { id: 'trusted', label: 'trusted root', x: 0.8, y: 3.7, note: 'pinned' },
      { id: 'root', label: 'root update', x: 2.5, y: 3.7, note: 'threshold' },
      { id: 'timestamp', label: 'timestamp', x: 4.2, y: 2.1, note: 'expiry' },
      { id: 'snapshot', label: 'snapshot', x: 5.8, y: 2.1, note: 'meta list' },
      { id: 'targets', label: 'targets', x: 5.8, y: 5.2, note: 'hashes' },
      { id: 'file', label: 'file bytes', x: 7.6, y: 5.2, note: 'download' },
      { id: 'verify', label: 'verify', x: 9.2, y: 3.7, note: 'install?' },
    ],
    edges: [
      { id: 'e-trusted-root', from: 'trusted', to: 'root' },
      { id: 'e-root-timestamp', from: 'root', to: 'timestamp' },
      { id: 'e-timestamp-snapshot', from: 'timestamp', to: 'snapshot' },
      { id: 'e-snapshot-targets', from: 'snapshot', to: 'targets' },
      { id: 'e-targets-file', from: 'targets', to: 'file' },
      { id: 'e-file-verify', from: 'file', to: 'verify' },
      { id: 'e-root-verify', from: 'root', to: 'verify' },
      { id: 'e-snapshot-verify', from: 'snapshot', to: 'verify' },
      { id: 'e-targets-verify', from: 'targets', to: 'verify' },
    ],
  }, { title });
}

function* roleGraphView() {
  yield {
    state: roleGraph('TUF splits update trust into signed roles'),
    highlight: { active: ['root', 'targets', 'snapshot', 'timestamp', 'e-root-targets', 'e-root-snapshot', 'e-root-timestamp'], compare: ['mirror'] },
    explanation: 'TUF does not ask a mirror to be trusted. Root signs which keys are trusted for the other top-level roles: targets, snapshot, and timestamp.',
    invariant: 'Trust metadata, not mirrors.',
  };

  yield {
    state: roleGraph('Targets metadata binds paths to hashes and sizes'),
    highlight: { active: ['targets', 'delegated', 'target', 'e-targets-delegated', 'e-delegated-target'], found: ['client'] },
    explanation: 'The targets role says which files are valid and records their hashes and sizes. Delegated targets roles can be trusted for only a subset of paths.',
  };

  yield {
    state: roleGraph('Snapshot and timestamp stop stale metadata games'),
    highlight: { active: ['timestamp', 'snapshot', 'targets', 'e-timestamp-snapshot', 'e-snapshot-targets'], compare: ['mirror'] },
    explanation: 'Snapshot signs the versions of all target metadata, stopping mix-and-match. Timestamp signs the current snapshot hash and expires quickly, stopping indefinite freeze.',
  };

  yield {
    state: labelMatrix(
      'TUF top-level roles',
      [
        { id: 'root', label: 'root' },
        { id: 'targets', label: 'targets' },
        { id: 'snapshot', label: 'snapshot' },
        { id: 'timestamp', label: 'timestamp' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'blocks', label: 'blocks' },
      ],
      [
        ['role keys', 'key takeover'],
        ['file hashes', 'wrong file'],
        ['meta versions', 'mix-match'],
        ['fresh snap', 'freeze'],
      ],
    ),
    highlight: { active: ['root:stores', 'targets:stores', 'snapshot:blocks', 'timestamp:blocks'] },
    explanation: 'The data structure is four signed metadata families with different jobs. Separating jobs limits damage when an online key or mirror is compromised.',
  };
}

function* clientWorkflow() {
  yield {
    state: workflowGraph('Start from a pinned trusted root'),
    highlight: { active: ['trusted', 'root', 'verify', 'e-trusted-root', 'e-root-verify'], compare: ['file'] },
    explanation: 'A client begins with trusted root metadata shipped with the application. Root updates require threshold signatures so one compromised root key is not enough.',
  };

  yield {
    state: workflowGraph('Fetch timestamp before trusting repository state'),
    highlight: { active: ['root', 'timestamp', 'snapshot', 'e-root-timestamp', 'e-timestamp-snapshot'], found: ['verify'] },
    explanation: 'Timestamp is usually online and short-lived. It tells the client which snapshot hash and version are current before the client trusts deeper metadata.',
  };

  yield {
    state: workflowGraph('Snapshot selects one consistent metadata set'),
    highlight: { active: ['snapshot', 'targets', 'e-snapshot-targets'], compare: ['timestamp'], found: ['verify'] },
    explanation: 'Snapshot metadata lists versions of targets metadata, including delegated roles. That prevents an attacker from mixing new timestamp metadata with old targets metadata.',
  };

  yield {
    state: workflowGraph('Install only bytes that match trusted targets metadata'),
    highlight: { active: ['targets', 'file', 'verify', 'e-targets-file', 'e-file-verify', 'e-targets-verify'], compare: ['trusted'] },
    explanation: 'The downloaded target file is checked against trusted hashes and size before the application is allowed to use it. The target bytes remain opaque to TUF.',
    invariant: 'No matching target metadata, no install.',
  };

  yield {
    state: labelMatrix(
      'Attack map',
      [
        { id: 'rollback', label: 'rollback' },
        { id: 'freeze', label: 'freeze' },
        { id: 'mix', label: 'mix-match' },
        { id: 'key', label: 'key leak' },
        { id: 'mirror', label: 'bad mirror' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'defense', label: 'defense' },
      ],
      [
        ['old good file', 'versions'],
        ['stale world', 'expiry'],
        ['split metadata', 'snapshot'],
        ['one key stolen', 'threshold'],
        ['wrong bytes', 'hash check'],
      ],
    ),
    highlight: { found: ['rollback:defense', 'freeze:defense', 'mix:defense', 'key:defense', 'mirror:defense'] },
    explanation: 'TUF is a threat-model data structure. Versions, expiry, hashes, sizes, roles, delegation paths, and threshold signatures each close a specific update attack path.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'role graph') yield* roleGraphView();
  else if (view === 'client workflow') yield* clientWorkflow();
  else throw new InputError('Pick a TUF view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        `The Update Framework, or TUF, is a security design for software update metadata. It does not replace a package manager, build system, CDN, or installer. It gives those systems a way to decide which update metadata is trusted, which target files are allowed, and whether the repository state is fresh enough to use.`,
        `The problem is sharper than checking a signature on a downloaded file. An attacker may serve an old but valid version, freeze a client on stale metadata, combine new metadata with old metadata, replay a vulnerable package, or steal one online signing key. TUF treats the update repository as a set of signed roles with different jobs. Root defines trusted role keys. Targets signs information about files. Snapshot signs a consistent set of metadata versions. Timestamp signs the current snapshot and expires quickly.`,
      ],
    },
    {
      heading: 'The obvious approach and the wall',
      paragraphs: [
        `The obvious approach is HTTPS plus a signed package. That blocks many simple attacks. If the transport is private and the file signature verifies, the client knows the bytes came from some trusted key at some time. For a small internal updater, that may look sufficient.`,
        `The wall is that freshness and consistency are separate from file authenticity. A mirror can serve an older package that was valid last month. A compromised online key can sign a new timestamp pointing at stale content. A repository can accidentally publish mismatched metadata where one role describes version N while another role still describes version N - 1. A single signing key can become too powerful if it can authorize every file and every repository state. TUF's answer is to split authority and make clients verify the shape of the update history, not just one signature.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `The core insight is role separation. Different update questions deserve different keys, different expiry schedules, and different blast radii. Root metadata answers who is trusted to sign the other roles. Targets metadata answers which files are valid and what their hashes and sizes are. Snapshot metadata answers which versions of target metadata belong together. Timestamp metadata answers what the newest snapshot is right now.`,
        `This turns update security into a set of small verification gates. A bad mirror is not trusted because target bytes must match signed hashes. A rollback is detected because metadata versions cannot go backward. A freeze is detected because timestamp metadata expires. A mix-and-match attack is detected because snapshot pins metadata versions. A single stolen key is less damaging when roles use threshold signatures and when highly trusted keys, such as root keys, can be kept offline.`,
      ],
    },
    {
      heading: 'Mechanism and data structures',
      paragraphs: [
        `The main data structures are signed metadata files. Each file has a signed portion, a version number, an expiration time, and signatures from keys authorized for that role. Root metadata stores keys and role definitions, including signature thresholds. Targets metadata stores target paths, hashes, sizes, custom metadata, and delegations. Snapshot metadata stores the versions and hashes of metadata files. Timestamp metadata stores the current snapshot version and hash and is small enough to fetch often.`,
        `Delegation is a tree of authority under targets. A top-level targets role can delegate a path pattern to another role, such as releases for one product, nightly builds, language-package indexes, or hardware-specific images. The delegated role can then sign only the target paths it was trusted to manage. Revocation is also metadata: the delegating role signs a new version that removes or changes the delegation.`,
        `The client workflow is ordered. Start from trusted root metadata that shipped with the application or was already accepted. Update root carefully, one version at a time, checking threshold signatures. Fetch timestamp. Use timestamp to identify and verify snapshot. Use snapshot to identify a consistent targets metadata set, including delegated metadata if needed. Download target bytes only after trusted targets metadata names the file and records its expected hashes and size.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `TUF works because the client never asks one artifact to prove everything. Target hashes prove file integrity. Versions prove monotonic progress. Expiration proves freshness. Snapshot proves that the metadata set is internally consistent. Root proves which keys are allowed to speak for each role. Threshold signatures mean a client can require more than one key before accepting highly sensitive metadata.`,
        `The order of checks matters. A client that trusts targets metadata before checking snapshot can be tricked into inconsistent metadata. A client that ignores expiry can be frozen on old metadata forever. A client that accepts older versions can be rolled back to a vulnerable release. A client that treats timestamp as all-powerful lets an online key authorize too much. The verification sequence is the security boundary.`,
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        `The runtime cost is extra metadata fetches and signature checks. Timestamp is designed to be small and frequently refreshed. Snapshot is larger because it names metadata versions. Targets metadata can grow with repository size, which is why delegation and path scoping matter. Clients cache trusted metadata, but they still need to persist it so future rollback checks have a remembered version to compare against.`,
        `The operational cost is key management. Root keys should be protected by ceremonies, hardware security modules, offline storage, or split responsibility. Timestamp keys are often online because they must sign frequently, so the system assumes they are more exposed and limits their authority. Targets and delegated keys need rotation plans, expiry schedules, audit logs, and emergency recovery paths. TUF is a protocol plus an operating discipline.`,
        `Repository layout also affects behavior. Consistent snapshots can put versioned metadata and target filenames on the wire so caches do not accidentally serve old bytes under a stable name. That costs extra storage and cache churn, but it makes CDN behavior easier to reason about. If a repository keeps stable filenames, operators need tighter cache invalidation and monitoring because stale metadata can look like a protocol failure to clients.`,
      ],
    },
    {
      heading: 'Where it is useful and where it fails',
      paragraphs: [
        `TUF fits package indexes, application updaters, plugin ecosystems, container or model artifact distribution, embedded devices, and any repository where clients may fetch through untrusted mirrors. Uptane adapts the same family of ideas to automotive update systems, where different electronic control units and safety constraints need more structure than a desktop updater.`,
        `TUF is the wrong layer for some questions. It does not prove that source code was reviewed, that a build was reproducible, that a maintainer was honest, that a dependency is free of vulnerabilities, or that installing the update is safe for a particular fleet. It can tell the client that these are the authorized bytes for this repository state. Provenance systems, transparency logs, policy engines, sandboxing, staged rollout, and vulnerability scanners answer adjacent questions.`,
      ],
    },
    {
      heading: 'Operational signals',
      paragraphs: [
        `Watch expired metadata, rejected rollback attempts, signature-threshold failures, unexpected root rotations, delegated-role misses, target hash mismatches, metadata size growth, mirror inconsistency, and clients pinned to old trusted metadata. A spike in timestamp failures can mean an outage, a clock problem, or a compromised mirror serving stale files. A target hash mismatch means the repository metadata and bytes no longer agree, and the client should not install.`,
        `The most important drill is key compromise. Decide in advance which role key is assumed stolen, what damage that role can do, which higher role can revoke or rotate it, how clients will receive the new metadata, and how operators will prove the recovery worked. Without that drill, threshold signatures and role separation can exist on paper while the real recovery path remains unclear.`,
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        `Primary sources: The Update Framework specification at https://theupdateframework.github.io/specification/latest/, TUF project documentation at https://theupdateframework.io/, and Uptane at https://uptane.org/. Study Merkle Tree for hash commitments, Merkle Mountain Range Append-Only Log and Transparency Log Witnessing for public auditability, Software Supply Chain Provenance Graph for build evidence, Sigstore Keyless Signing Transparency for certificate-backed signing, Shamir Secret Sharing for key recovery ceremonies, and OPA Rego Policy Decision Graph for install policy next.`,
      ],
    },
  ],
};
