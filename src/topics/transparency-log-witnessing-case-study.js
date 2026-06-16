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
    {
      heading: 'What it is',
      paragraphs: [
        'A transparency log is a public append-only log backed by an authenticated data structure. It does not prevent every bad event. It makes events visible and tamper-evident so monitors can detect them. Certificate Transparency logs certificate issuance; Sigstore Rekor logs software-signing metadata and attestations.',
        'RFC 6962 describes Certificate Transparency as publicly auditable append-only logs where anyone can verify log correctness and monitor new entries: https://datatracker.ietf.org/doc/html/rfc6962. Sigstore Rekor provides a transparency log for software supply chain metadata and supports inclusion proof, integrity verification, and entry retrieval: https://docs.sigstore.dev/logging/overview/.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Each entry is hashed into a Merkle tree leaf. The log periodically signs a tree size and root hash, producing a signed tree head or checkpoint. An inclusion proof gives the sibling hashes needed to recompute the signed root from one leaf. A consistency proof connects an older tree head to a newer one and shows the log grew by appending rather than rewriting.',
        'Witnesses add a second line of defense. A witness remembers previous checkpoints and signs only newer checkpoints that are consistent with what it already saw. Monitors download and inspect entries for unexpected certificates, package releases, builder identities, keys, or artifact digests. Auditors verify inclusion and consistency proofs for clients.',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'The core structures are an append-only leaf list, Merkle tree, signed tree head, inclusion proof path, consistency proof, witness checkpoint map, monitor cursor, and alert ledger. Merkle Mountain Range Append-Only Log is a useful adjacent lesson because it shows how append-only accumulators can keep compact peaks while supporting old-prefix proofs.',
        'Transparency logs are authenticated data structures plus operations discipline. The log must be append-only. The witness must reject inconsistent heads. The monitor must scan entries. The owner must know what entries are expected. Without monitoring, the log is only an archive.',
      ],
    },
    {
      heading: 'Case studies',
      paragraphs: [
        'Certificate Transparency exposed unexpected certificates by making certificate issuance public and auditable. Rekor applies the pattern to software artifacts: signatures, public keys, artifact hashes, and attestations can be recorded and later verified. The same pattern appears in package registries, binary transparency, key transparency, and supply-chain provenance.',
        'A complete deployment checks several things: the artifact digest matches the downloaded file, the signature verifies, the signing identity is allowed, the Rekor entry is included in the log, the log checkpoint is consistent, and a monitor has not found unexpected events for that identity.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Transparency is not trust by itself. A malicious package can be logged honestly. A compromised identity can sign bad metadata and appear in the log. Inclusion proves that an event was recorded, not that it should be accepted. Policy, identity verification, monitoring, and incident response are still required.',
        'Another mistake is assuming a client must download the whole log. Inclusion and consistency proofs let clients verify specific claims cheaply, while monitors perform the expensive full-log scanning.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Certificate Transparency RFC 6962 at https://datatracker.ietf.org/doc/html/rfc6962, RFC 9162 at https://www.rfc-editor.org/rfc/rfc9162.html, Certificate Transparency overview at https://certificate.transparency.dev/howctworks/, Sigstore Rekor docs at https://docs.sigstore.dev/logging/overview/, Trillian transparent logging guide at https://google.github.io/trillian/docs/TransparentLogging.html, and Rekor repository at https://github.com/sigstore/rekor. Study Merkle Tree, Merkle Mountain Range Append-Only Log, Software Supply Chain Provenance Graph, Sigstore Keyless Signing Transparency, Content-Addressed Merkle DAG Object Store, Write-Ahead Log, and Claim Graph & Source Ledger next.',
      ],
    },
  ],
};
