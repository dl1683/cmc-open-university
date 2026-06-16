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
        'The Update Framework, or TUF, secures software update systems with signed metadata roles. It does not define a package manager. It gives a package manager or application updater a disciplined way to decide which metadata and target files are trustworthy.',
        'The current TUF specification describes four fundamental top-level roles: Root, Targets, Snapshot, and Timestamp. Root defines trusted keys for roles. Targets signs file metadata and delegations. Snapshot signs the versions of targets metadata. Timestamp signs the current snapshot hash and expires quickly. Together they protect clients even when mirrors are malicious or some keys are compromised.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A client starts with trusted root metadata bundled with the application. It updates root through threshold signatures, fetches fresh timestamp metadata, uses timestamp to select snapshot, uses snapshot to select a consistent set of targets metadata, and finally downloads only target bytes whose hash and size match trusted targets metadata.',
        'Delegation lets the targets role grant full or partial authority to other roles. For example, one role can sign browser extension targets while another signs language-package targets. Delegation is revoked when the delegating role signs new metadata without that delegation.',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'The central structures are signed metadata objects, key dictionaries, role-to-key threshold maps, target path maps, hash and size records, version numbers, expiry times, snapshot metadata indexes, and delegation graphs. Versions block rollback. Expiry blocks freeze. Snapshot indexes block mix-and-match. Threshold signatures reduce the blast radius of a single stolen key. Shamir Secret Sharing is a useful adjacent pattern for offline root-key recovery ceremonies, where a raw secret should not live with one person.',
        'This topic connects directly to Transparency Log Witnessing Case Study, Software Supply Chain Provenance Graph, and Sigstore Keyless Signing Transparency. Transparency logs make signing events public. Provenance explains how an artifact was built. Sigstore uses TUF-distributed roots. TUF answers a different question: which update metadata and target bytes should a client accept right now?',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A desktop application updater polls a repository through a CDN mirror. The mirror is compromised and serves an old vulnerable binary plus matching old targets metadata. The client first checks timestamp metadata. If the timestamp is expired, the freeze is detected. If the mirror pairs a fresh timestamp with old targets metadata, snapshot version checks fail. If the mirror serves different binary bytes, the targets hash check fails.',
        'Now suppose the online timestamp key is stolen. That key can cause a temporary freeze or denial of service, but it cannot authorize arbitrary target bytes because targets metadata and snapshot metadata still need their own trusted signatures. The role split is the safety feature.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'A valid TLS connection to a mirror is not the same as update security. TUF assumes mirrors and networks can lie. Another mistake is treating all signing keys as equivalent. Root keys should be highly protected and often offline; timestamp keys are online and deliberately less trusted.',
        'TUF also does not decide whether an update is semantically safe. It can say the bytes are the trusted update bytes. It cannot prove the update has no vulnerability, bad migration, malicious maintainer change, or policy violation. That is where provenance, transparency monitoring, sandboxing, and deployment policy enter.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: The Update Framework specification at https://theupdateframework.github.io/specification/latest/, TUF documentation at https://theupdateframework.io/, and Uptane standard role metadata at https://uptane.org/docs/1.0.0/standard/uptane-standard. Study Shamir Secret Sharing, Merkle Tree, Merkle Mountain Range Append-Only Log, Transparency Log Witnessing Case Study, Content-Addressed Merkle DAG Object Store, Software Supply Chain Provenance Graph, Sigstore Keyless Signing Transparency, OPA Rego Policy Decision Graph, and Seccomp BPF Sandbox Policy next.',
      ],
    },
  ],
};
