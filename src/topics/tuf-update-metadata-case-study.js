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
    { heading: 'How to read the animation', paragraphs: ['Read the role graph as a chain of signed questions. Active nodes show the metadata role currently verified, compare nodes show untrusted mirrors, and found nodes show facts the client can rely on.', 'A target is the file being installed, and metadata is signed data about keys, versions, hashes, sizes, and expiry. No file bytes are installable unless the ordered metadata chain authorizes their path, hash, and length.', {type:'callout', text:'TUF protects updates by splitting trust into signed roles where each role blocks one specific class of repository attack.'}]},
    { heading: 'Why this exists', paragraphs: ['An update system is remote code execution with a friendly name. Secure updates need freshness, consistency, rollback protection, key rotation, delegated authority, and byte-level checks.']},
    { heading: 'The obvious approach', paragraphs: ['The obvious approach is HTTPS plus a package signature. That proves bytes were signed by a trusted key at some point, but not that repository state is current or consistent.']},
    { heading: 'The wall', paragraphs: ['A mirror can serve an old signed package with a known vulnerability, and the signature still verifies. File signatures alone do not bind timestamp, snapshot, targets, and file bytes into one consistent view.']},
    { heading: 'The core insight', paragraphs: ['Split trust into roles. Root names trusted keys, targets names valid files, snapshot names metadata versions that belong together, and timestamp names the fresh repository state.']},
    { heading: 'How it works', paragraphs: ['A client starts from pinned root metadata, updates root one version at a time with threshold signatures, then verifies timestamp, snapshot, targets, and finally target file length and hash.']},
    { heading: 'Why it works', paragraphs: ['Each role proves one property. Versions stop rollback, expiry stops freeze, snapshot lists stop mix-and-match, target hashes stop byte tampering, and threshold signatures reduce single-key compromise.']},
    { heading: 'Cost and complexity', paragraphs: ['Runtime cost is extra metadata fetches and signature checks. A repository with root, timestamp, snapshot, top-level targets, and 10 delegated roles may verify about 14 metadata files before one target file.']},
    { heading: 'Real-world uses', paragraphs: ['TUF protects package repositories, language ecosystems, operating-system metadata, Sigstore root material, and embedded update systems. Uptane extends the model for vehicle software updates.']},
    { heading: 'Where it fails', paragraphs: ['TUF does not prove software is good. If an authorized build signs a backdoored artifact hash, TUF distributes that authorized bad artifact correctly.']},
    { heading: 'Worked example', paragraphs: ['A client with timestamp v50 receives timestamp v55, which points to snapshot v22 hash Hs. Snapshot v22 points to targets v8 hash Ht, and targets v8 authorizes editor-3.2.0.tar.gz length 4,718,592 and hash c14a; timestamp v40 would be rejected as rollback.']},
    { heading: 'Sources and study next', paragraphs: ['Read The Update Framework specification, TUF project documentation, the original TUF papers, and Uptane documentation. Study Digital Signatures, Merkle Tree, Shamir Secret Sharing, Transparency Log Witnessing, Sigstore, In-toto, and OPA Policy next.']},
  ],
};