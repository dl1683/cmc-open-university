// Transparency logs and witnesses: append-only Merkle logs, signed tree heads,
// inclusion proofs, consistency proofs, monitors, and split-view detection.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'transparency-log-witnessing-case-study',
  title: 'Transparency Log Witnessing Case Study',
  category: 'Security',
  summary: 'How append-only Merkle logs expose hidden signing events with signed tree heads, inclusion proofs, consistency proofs, monitors, and witnesses.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['log proof path', 'witness and monitor'], defaultValue: 'log proof path' },
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

function logGraph(title) {
  return graphState({
    nodes: [
      { id: 'entry', label: 'entry', x: 0.8, y: 4.1, note: 'cert/signature' },
      { id: 'leaf', label: 'leaf', x: 2.2, y: 4.1, note: 'hash' },
      { id: 'tree', label: 'Merkle log', x: 4.0, y: 4.1, note: 'append only' },
      { id: 'sth', label: 'STH', x: 5.8, y: 4.9, note: 'signed root' },
      { id: 'incl', label: 'inclusion', x: 5.8, y: 3.3, note: 'path' },
      { id: 'client', label: 'client', x: 7.6, y: 4.1, note: 'verify' },
      { id: 'old', label: 'old STH', x: 9.0, y: 4.9, note: 'size n' },
      { id: 'new', label: 'new STH', x: 9.0, y: 3.3, note: 'size m' },
    ],
    edges: [
      { id: 'e-entry-leaf', from: 'entry', to: 'leaf' },
      { id: 'e-leaf-tree', from: 'leaf', to: 'tree' },
      { id: 'e-tree-sth', from: 'tree', to: 'sth' },
      { id: 'e-tree-incl', from: 'tree', to: 'incl' },
      { id: 'e-sth-client', from: 'sth', to: 'client' },
      { id: 'e-incl-client', from: 'incl', to: 'client' },
      { id: 'e-old-new', from: 'old', to: 'new' },
      { id: 'e-new-client', from: 'new', to: 'client' },
    ],
  }, { title });
}

function monitorGraph(title) {
  return graphState({
    nodes: [
      { id: 'log', label: 'log', x: 0.8, y: 4.1, note: 'untrusted' },
      { id: 'sthA', label: 'STH A', x: 2.4, y: 4.9, note: 'view 1' },
      { id: 'sthB', label: 'STH B', x: 2.4, y: 3.3, note: 'view 2' },
      { id: 'witness', label: 'witness', x: 4.3, y: 4.1, note: 'cosign' },
      { id: 'monitor', label: 'monitor', x: 6.2, y: 4.9, note: 'scan' },
      { id: 'auditor', label: 'auditor', x: 6.2, y: 3.3, note: 'prove' },
      { id: 'alarm', label: 'alarm', x: 8.1, y: 4.1, note: 'split view' },
      { id: 'owner', label: 'owner', x: 9.3, y: 4.1, note: 'respond' },
    ],
    edges: [
      { id: 'e-log-a', from: 'log', to: 'sthA' },
      { id: 'e-log-b', from: 'log', to: 'sthB' },
      { id: 'e-a-witness', from: 'sthA', to: 'witness' },
      { id: 'e-b-witness', from: 'sthB', to: 'witness' },
      { id: 'e-witness-monitor', from: 'witness', to: 'monitor' },
      { id: 'e-witness-auditor', from: 'witness', to: 'auditor' },
      { id: 'e-monitor-alarm', from: 'monitor', to: 'alarm' },
      { id: 'e-auditor-alarm', from: 'auditor', to: 'alarm' },
      { id: 'e-alarm-owner', from: 'alarm', to: 'owner' },
    ],
  }, { title });
}

function* logProofPath() {
  yield {
    state: logGraph('An entry becomes a Merkle log leaf'),
    highlight: { active: ['entry', 'leaf', 'tree', 'e-entry-leaf', 'e-leaf-tree'], compare: ['sth'] },
    explanation: 'A transparency log records a certificate, signature, build attestation, or package release as an append-only entry. The leaf hash enters a Merkle log.',
  };
  yield {
    state: logGraph('A signed tree head commits to the current log'),
    highlight: { active: ['tree', 'sth', 'client', 'e-tree-sth', 'e-sth-client'], compare: ['incl'] },
    explanation: 'The log signs a tree size and root hash. A client can treat that signed tree head as a compact commitment to the log state at that size.',
  };
  yield {
    state: logGraph('Inclusion proof connects one entry to one signed root'),
    highlight: { active: ['leaf', 'incl', 'client', 'e-tree-incl', 'e-incl-client'], found: ['sth'] },
    explanation: 'An inclusion proof provides the sibling hashes needed to recompute the signed root. It proves the entry was included under that tree head.',
  };
  yield {
    state: logGraph('Consistency proof checks append-only growth'),
    highlight: { active: ['old', 'new', 'client', 'e-old-new', 'e-new-client'], compare: ['entry'] },
    explanation: 'A consistency proof shows that an older tree is a prefix of a newer tree. That is how auditors catch logs that rewrite history instead of appending.',
    invariant: 'Inclusion proves presence; consistency proves no rewrite between two tree heads.',
  };
  yield {
    state: labelMatrix(
      'Transparency proof types',
      [
        { id: 'sct', label: 'promise' },
        { id: 'sth', label: 'signed head' },
        { id: 'incl', label: 'inclusion' },
        { id: 'cons', label: 'consistency' },
      ],
      [
        { id: 'proves', label: 'proves' },
        { id: 'doesnot', label: 'does not prove' },
      ],
      [
        ['will include', 'already monitored'],
        ['root at size', 'entry is good'],
        ['entry in log', 'entry is trusted'],
        ['append only', 'no bad entries'],
      ],
    ),
    highlight: { active: ['incl:proves', 'cons:proves'], compare: ['incl:doesnot', 'cons:doesnot'] },
    explanation: 'Transparency reveals events; it does not automatically make them benign. Monitors and policy decide whether a logged event is expected.',
  };
}

function* witnessAndMonitor() {
  yield {
    state: monitorGraph('A log can be honest, faulty, or malicious'),
    highlight: { active: ['log', 'sthA', 'sthB', 'e-log-a', 'e-log-b'], compare: ['witness'] },
    explanation: 'The log is append-only by design, but clients still need evidence that everyone sees compatible tree heads. Otherwise a malicious log can try a split view.',
  };
  yield {
    state: monitorGraph('Witnesses cosign only consistent checkpoints'),
    highlight: { active: ['sthA', 'sthB', 'witness', 'e-a-witness', 'e-b-witness'], found: ['alarm'] },
    explanation: 'A witness tracks previously seen tree heads and signs only new heads that can be proven consistent with older ones. Multiple witnesses make split views harder to hide.',
  };
  yield {
    state: monitorGraph('Monitors scan logs for unexpected entries'),
    highlight: { active: ['witness', 'monitor', 'alarm', 'owner', 'e-witness-monitor', 'e-monitor-alarm', 'e-alarm-owner'], compare: ['auditor'] },
    explanation: 'A monitor downloads entries and checks whether a domain, package, builder identity, key, or artifact digest appears unexpectedly. Detection is the point.',
  };
  yield {
    state: monitorGraph('Auditors verify proofs on demand'),
    highlight: { active: ['witness', 'auditor', 'alarm', 'e-witness-auditor', 'e-auditor-alarm'], compare: ['monitor'] },
    explanation: 'An auditor can verify inclusion and consistency proofs without downloading the whole log. This separates small-client verification from full monitoring.',
  };
  yield {
    state: labelMatrix(
      'Actors in a transparent system',
      [
        { id: 'log', label: 'log' },
        { id: 'witness', label: 'witness' },
        { id: 'monitor', label: 'monitor' },
        { id: 'auditor', label: 'auditor' },
        { id: 'owner', label: 'owner' },
      ],
      [
        { id: 'job', label: 'job' },
        { id: 'risk', label: 'risk if absent' },
      ],
      [
        ['append entries', 'hidden issuance'],
        ['cosign heads', 'split view'],
        ['scan entries', 'missed compromise'],
        ['check proofs', 'blind clients'],
        ['respond', 'no remediation'],
      ],
    ),
    highlight: { active: ['witness:job', 'monitor:job', 'auditor:job'], compare: ['log:risk'] },
    explanation: 'A transparency log is an ecosystem. The data structure gives proofs, but the security result needs witnesses, monitors, auditors, and owners who act on alarms.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'log proof path') yield* logProofPath();
  else if (view === 'witness and monitor') yield* witnessAndMonitor();
  else throw new InputError('Pick a transparency-log view.');
}


export const article = {
  sections: [
    { heading: 'How to read the animation', paragraphs: ['Read the proof view as an entry becoming a leaf in an append-only Merkle tree. Active nodes show hashing, signing, or proof verification; found nodes show commitments that verified.', 'A Merkle tree is a hash tree. A signed tree head is the log\'s signed root for one size. Inclusion proves one entry is under one root; consistency proves a newer root appended to an older root.', {type:'callout', text:'Transparency works by making every security-relevant event public, provable, and hard to show differently to different observers.'}, {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/9/95/Hash_Tree.svg', alt:'Binary hash tree diagram with leaves feeding interior hashes and a top hash.', caption:'Binary hash tree diagram. Wikimedia Commons, Azaghal after David Gothberg, CC0 1.0.'}]},
    { heading: 'Why this exists', paragraphs: ['A signature proves a key signed bytes, not that the event was expected or public. Transparency logs make certificate issuance, package signing, or build attestations visible to independent monitors.']},
    { heading: 'The obvious approach', paragraphs: ['The obvious approach is asking the issuer whether an artifact is valid or revoked. That fails when the issuer is compromised, mistaken, or able to show different histories to different clients.']},
    { heading: 'The wall', paragraphs: ['The wall is equivocation. Without a shared public commitment, a server can show a victim one view and an auditor another, leaving no comparable artifact.']},
    { heading: 'The core insight', paragraphs: ['Put every event in an append-only log and commit to it with a signed Merkle root. The log does not judge goodness; it makes events visible and rewrites detectable.']},
    { heading: 'How it works', paragraphs: ['The log hashes each entry into a leaf and combines leaves into a tree. An inclusion proof gives sibling hashes for one leaf, and a consistency proof connects an old tree size to a larger one.']},
    { heading: 'Why it works', paragraphs: ['Hash binding makes changes visible because changing one leaf changes every hash on its path to the root. Consistency proofs show that the old root is still the prefix of the new tree.']},
    { heading: 'Cost and complexity', paragraphs: ['Client verification costs O(log n) hashes plus one signature check. A log with about 1,000,000,000 leaves has a proof path around 30 hashes, while monitors still pay O(n) over new entries.']},
    { heading: 'Real-world uses', paragraphs: ['Certificate Transparency logs TLS certificates. Sigstore Rekor logs software signing events, and Go\'s checksum database logs module hashes. The shared pattern is public evidence plus independent monitoring.']},
    { heading: 'Where it fails', paragraphs: ['Transparency does not prevent bad events; it exposes them. It also leaks metadata by design, because public auditability requires public or broadly visible records.']},
    { heading: 'Worked example', paragraphs: ['In an 8-leaf tree, entry 5 needs 3 sibling hashes because log2(8)=3. The verifier hashes h4 with h5, then that result with h67, then with h0123, and accepts only if the final root equals the signed root.']},
    { heading: 'Sources and study next', paragraphs: ['Read RFC 6962, RFC 9162, certificate.transparency.dev, Sigstore Rekor docs, and the Go checksum database design. Study Merkle Tree, Digital Signatures, TUF Update Metadata, Sigstore Keyless Signing Transparency, and Blockchain Consensus next.']},
  ],
};