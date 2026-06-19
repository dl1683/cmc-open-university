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
      heading: 'How to read the animation',
      paragraphs: [
        "Read the animation as the execution trace for Transparency Log Witnessing Case Study. How append-only Merkle logs expose hidden signing events with signed tree heads, inclusion proofs, consistency proofs, monitors, and witnesses..",
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Many security failures are not caused by weak cryptography. They are caused by a real key, issuer, registry account, or build service doing something it should not have done. A certificate authority can issue a certificate for a domain it should not control. A package maintainer token can publish a poisoned release. A build system can sign an artifact with the right key after the build pipeline was compromised.',
        'A signature proves that some key signed something. It does not prove that the event was expected, visible to the owner, or shown consistently to everyone. Transparency logs exist to move those events out of private conversations and into an append-only public record that other parties can audit.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The obvious approach is to trust the issuer directly. A browser asks a certificate authority whether a certificate is valid. A package installer asks a registry whether a release exists. A verifier checks whether an artifact carries a valid signature.',
        'That approach hits two walls. First, the party that answers may be the party that made the mistake. Second, a malicious service can equivocate: show a clean history to monitors, a different history to victims, and deny the bad event later. Without a shared public commitment to history, victims have little evidence and monitors may never know what to inspect.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Put every relevant event into an append-only Merkle log, publish signed checkpoints for the log, and make clients demand proofs against those checkpoints. The log does not decide whether an event is good. It commits to the fact that the event happened in a specific history.',
        'Then split the security work among independent actors. The log stores entries and proves them. Witnesses remember checkpoints and refuse to cosign inconsistent history. Monitors scan the stream for events that violate policy. Auditors verify compact proofs for clients that cannot download the whole log.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'In the log proof path view, follow one event as it becomes a leaf, then a Merkle root, then a signed tree head. The inclusion proof answers one question: is this entry inside the signed tree? The consistency proof answers a different question: did the newer tree grow from the older tree without rewriting the prefix?',
        'In the witness and monitor view, watch the split-view risk. A log can try to present STH A to one audience and STH B to another. A witness is useful because it has memory and signs only consistent checkpoints. A monitor is useful because it reads the actual entries and knows what would be suspicious for a domain, package, builder, or key.',
      ],
    },
    {
      heading: 'How it works (2)',
      paragraphs: [
        'Each logged event is encoded and hashed as a leaf. The leaves form a Merkle tree. The log periodically signs a checkpoint, often called a signed tree head, containing at least the tree size and root hash. That signature is a compact commitment to every leaf in that prefix of the log.',
        'A client that sees an entry asks for an inclusion proof. The proof contains the sibling hashes needed to recompute the signed root from that one leaf. A client or auditor that has seen an older checkpoint asks for a consistency proof to show that the older tree is a prefix of the newer tree.',
        'Witnesses add independent memory. A witness stores the latest checkpoint it accepted for a log and cosigns only a new checkpoint that is consistent with the old one. Monitors add semantic inspection. They download entries, match them against policy, and alert the real owner when something appears that should not exist.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'A collision-resistant Merkle root binds the log to a specific set and order of leaves. If the log changes one old entry, removes one entry, or inserts something into the middle, the root changes. Inclusion proofs let a small client verify one entry against that root without replaying the whole log.',
        'Consistency proofs are what make append-only more than a promise. They connect two signed checkpoints and show that the later tree extends the earlier tree. A log that cannot provide that proof is either broken, unavailable, or trying to rewrite history.',
        'Witnessing turns equivocation into a coordination problem for the attacker. To keep a split view alive, the log must either isolate victims from honest witnesses and monitors or obtain signatures on incompatible checkpoints. That is much harder than lying to one client in private.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a compromised certificate authority issues a certificate for bank.example. The certificate is cryptographically valid, so a simple signature check would not catch the problem. With transparency, the certificate must appear in a public log. The browser can require proof that the certificate is included under a signed checkpoint.',
        'The domain owner runs or uses a monitor that watches for bank.example. When the unexpected certificate appears, the monitor alerts the owner. If the log tries to hide the certificate from monitors while showing it to victims, the log has to maintain incompatible views. Witness-backed checkpoints and consistency checks make that split view detectable when views are compared.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'Client proofs are small, usually logarithmic in the number of log entries. Monitoring is not small. Someone has to download, index, and understand the entries that matter. The design intentionally keeps ordinary clients light and moves continuous inspection to monitors.',
        'The system also creates public metadata. That is often the point for certificates and software releases, but it can leak timing, identity, and deployment information. Private or sensitive ecosystems need to decide what can safely be logged.',
        'Availability matters. If logs, witnesses, or monitors are unreachable, clients must choose between blocking, accepting stale evidence, or failing open. Different ecosystems make different choices because they have different tolerance for outages and compromise.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Transparency wins when the main danger is hidden history: unexpected certificate issuance, unauthorized package publication, suspicious build attestations, key changes, and supply-chain metadata that should be visible to owners and relying parties.',
        'It also wins when many clients need compact verification but only a few parties can afford full monitoring. Browsers, package installers, and policy agents can verify proofs while specialized monitors do the expensive scanning.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Transparency does not make a bad event harmless. A malicious package can be logged honestly. A stolen key can sign a real artifact. Inclusion proves that the event is in the log, not that a client should trust it.',
        'It also fails quietly when nobody monitors the right names, keys, packages, or builders. A log with no monitor is mostly a tamper-evident archive. The practical security result depends on policy, ownership knowledge, alerting, and response.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: Certificate Transparency RFC 6962 at https://datatracker.ietf.org/doc/html/rfc6962, RFC 9162 at https://www.rfc-editor.org/rfc/rfc9162.html, Certificate Transparency overview at https://certificate.transparency.dev/howctworks/, Sigstore Rekor docs at https://docs.sigstore.dev/logging/overview/, Trillian transparent logging guide at https://google.github.io/trillian/docs/TransparentLogging.html, and Rekor repository at https://github.com/sigstore/rekor. Study Merkle Tree, Merkle Mountain Range Append-Only Log, Software Supply Chain Provenance Graph, Sigstore Keyless Signing Transparency, Content-Addressed Merkle DAG Object Store, Write-Ahead Log, and Claim Graph & Source Ledger next.',
      ],
    },
      {
      heading: 'The obvious approach',
      paragraphs: [
        "Name the reasonable first attempt and why teams reach for it.",
        "Then show the exact place that approach stops scaling or starts breaking.",
        "Treat this section as contrast, not a rejection.",
      ],
    },
    {
      heading: 'Learning map',
      paragraphs: [
        'Before this topic, check your prerequisites and map what is assumed, what is computed, and where this mechanism first appears in real systems.',
        'After this topic, follow each unlock topic and test whether you can explain why this mechanism unlocks it.',
        'Use the frame order to prove one invariant per frame and one cost consequence per major operation.',
      ],
    },

    {
      heading: 'Frame-by-frame checkpoints',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Pause on each state change and name exactly what data moved, which references changed, and why the move is legal.',
            'State the invariant that must remain true before the next frame starts.',
            'Track what changed in size, order, ownership, or topology for the operation you are watching.',
            'Translate the active frame into a one-line explanation as if teaching a teammate.',
          ],
        },
      ],
    },

    {
      heading: 'Micro checks',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Can you state one operation-level invariant in one sentence?',
            'Can you derive the time cost from the frame sequence without referencing external formulas?',
            'Can you name one hidden edge case where the naive implementation fails?',
            'Can you transfer this mechanism to one system from a different domain?',
          ],
        },
      ],
    },

    {
      heading: 'Try this now',
      paragraphs: [
        'Build one counterexample input by hand and predict every animation frame before running it; compare your prediction to the trace.',
        'Use this topic as a checkpoint: if you can explain why Transparency Log Witnessing Case Study moves from input to output in the animation and where it fails, you are ready for the next topic.',
      ],
    },

      {
        heading: 'Sources and study next',
        paragraphs: [
          'Read one primary source, one implementation source, and one production case where this idea appears.',
          'If they disagree on a detail, prefer the source with the clearest constraint and define the simplification for this animation.',
          'Then choose three study topics: one prerequisite, one extension, and one case study for your next session.',
        ],
      },
],
};
