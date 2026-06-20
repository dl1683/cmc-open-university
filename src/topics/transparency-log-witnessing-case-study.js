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
        'The animation has two views. "Log proof path" traces a single entry from submission through leaf hashing, Merkle root computation, signed tree head publication, and finally inclusion and consistency proof verification. "Witness and monitor" shows the ecosystem that prevents a log from equivocating: witnesses cosign checkpoints, monitors scan entries, auditors verify proofs, and alarms reach domain owners.',
        {
          type: 'bullets',
          items: [
            'Active nodes are the current operation: an entry being hashed, a signed tree head being published, a witness accepting a checkpoint, or a monitor raising an alarm.',
            'Found nodes are confirmed outcomes: a proof verified, a cosignature issued, or an alarm delivered to the domain owner.',
            'Compare nodes show the alternative being measured against: a tree head that could be forked, an auditor working in parallel with a monitor, or a consistency proof connecting two different-sized trees.',
          ],
        },
        'In the matrix views, rows are proof types or ecosystem actors. Columns show what each proves versus what it cannot prove, or each actor\'s job versus the risk if that actor is absent.',
        {
          type: 'note',
          text: 'The animation uses abstract labels (entry, leaf, STH) rather than real certificate bytes. In production, a single Certificate Transparency log like Google Argon holds over 10 billion entries. The data structure and proof machinery are identical -- only the scale of the tree and the latency of proof generation change.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {
          type: 'quote',
          text: 'We want Certificate Authorities (CAs) to publicly log every certificate they issue, so that anyone can look up all certificates that have been issued for any domain.',
          attribution: 'Laurie, Langley, Kasper, "Certificate Transparency" (RFC 6962), Section 1',
        },
        'Most security breaches in public-key infrastructure are not caused by broken cryptography. They are caused by a legitimate key doing something it should not have done. In 2011, the DigiNotar certificate authority was compromised and issued fraudulent certificates for google.com, used to intercept Iranian users\' Gmail traffic. The certificates were cryptographically valid -- signed by a trusted CA with a proper chain to a root store. No signature check would have caught the problem.',
        {
          type: 'table',
          headers: ['Incident', 'Year', 'What happened', 'Why signatures alone failed'],
          rows: [
            ['DigiNotar', '2011', 'Compromised CA issued 531 rogue certificates including *.google.com', 'Every certificate had a valid signature chain to a trusted root'],
            ['Symantec misissue', '2015-2017', 'CA issued 30,000+ certificates violating baseline requirements', 'Certificates were syntactically valid; policy violations invisible to clients'],
            ['Let\'s Encrypt phishing', 'Ongoing', 'Free DV certificates issued to lookalike domains for phishing', 'Each certificate is legitimately issued; the problem is that nobody watches'],
            ['SolarWinds supply chain', '2020', 'Compromised build system produced signed, legitimate-looking updates', 'Build signatures were valid; the build pipeline was the problem'],
          ],
        },
        'A digital signature proves that some key produced some output. It says nothing about whether the event was expected, visible to the domain owner, or shown consistently to every relying party. Transparency logs exist because the gap between "cryptographically valid" and "expected by the owner" is where real attacks live.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The reasonable first attempt is direct revocation checking. A client asks the issuer whether a certificate (or package release, or build attestation) is still valid. The issuer maintains a revocation list or responds to an online status query. If the answer is "revoked," the client rejects it.',
        {
          type: 'diagram',
          text: 'Direct trust model:\n\n  CA issues cert for bank.example\n      |\n      v\n  Browser connects to bank.example\n      |\n      v\n  Browser asks CA: "Is cert #4821 revoked?"\n      |\n      v\n  CA responds: "No, still valid"\n      |\n      v\n  Browser proceeds\n\n  Problem: what if CA issued cert #4821 to an attacker?\n  The CA will say "still valid" -- because it IS valid.\n  The domain owner never knew it was issued.',
          label: 'Revocation checks ask the wrong question: "is it revoked?" instead of "should it exist?"',
        },
        'This model works when the issuer is trustworthy and omniscient. It breaks in three specific ways.',
        {
          type: 'bullets',
          items: [
            'The issuer is the adversary: a compromised CA answering "not revoked" about a fraudulent certificate it issued is telling the truth. The certificate was never revoked because the CA does not consider it fraudulent.',
            'Equivocation is invisible: without a shared public record, the issuer can show one history to auditors and a different history to victims. There is no artifact that proves what was shown to whom.',
            'Revocation is reactive, not preventive: CRL and OCSP only help after someone discovers the bad certificate and reports it. They do not help anyone discover it in the first place.',
          ],
        },
        'CRLs (Certificate Revocation Lists) and OCSP (Online Certificate Status Protocol) answer the question "has this credential been revoked?" Transparency logs answer a different question: "does this credential exist at all, and can the owner see it?"',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is equivocation -- the ability of a log operator or issuer to present different histories to different parties without detection.',
        {
          type: 'diagram',
          text: 'Split-view attack (no transparency):\n\n  Compromised CA\n     |           \\\n     v            v\n  Victim sees:   Auditor sees:\n  cert A (real)  [nothing unusual]\n  cert B (fake)  cert B never shown\n     |            |\n     v            v\n  Victim trusts  Auditor reports\n  fake cert B    "all clear"\n\n  The CA showed cert B only to the victim.\n  The auditor never saw it.\n  No one can prove the CA lied\n  because there is no shared record.',
          label: 'Without a public commitment, equivocation is undetectable',
        },
        'A database behind an API can serve different query results to different clients. There is no cryptographic commitment binding the server to a single, consistent view of its data. A malicious CA can issue a certificate, present it only to the intended victim, and never submit it to any revocation list or audit process.',
        {
          type: 'note',
          text: 'This is not hypothetical. The DigiNotar compromise in 2011 went undetected for weeks because there was no mechanism forcing the CA to publicly commit to the certificates it issued. The rogue certificates were discovered only because a security researcher noticed an MITM attack against Iranian users and manually inspected the certificate chain. Without that chance discovery, the fraudulent certificates could have remained in active use indefinitely.',
        },
        'Even honest services face the problem. A certificate authority might have an internal database bug that issues a duplicate or malformed certificate. Without a public append-only log, the only evidence is internal logs that the CA itself controls. The domain owner has no independent way to enumerate every certificate ever issued for their name.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Force every relevant event into an append-only Merkle log. Publish signed commitments to the log state. Make clients demand cryptographic proofs against those commitments. The log does not judge whether an event is good. It guarantees that the event is visible.',
        {
          type: 'diagram',
          text: 'Transparency log architecture:\n\n  Events (certs, packages, attestations)\n      |\n      v\n  Append-only Merkle log\n  [leaf0][leaf1][leaf2][leaf3][leaf4][leaf5]...\n      \\   /       \\   /       \\   /\n     hash01     hash23     hash45\n         \\       /           /\n        hash0123       hash45\n             \\          /\n            root_hash (size=6)\n      |\n      v\n  Signed Tree Head (STH):\n    { tree_size: 6,\n      root_hash: 0xabc...,\n      timestamp: 1718000000,\n      signature: log_key.sign(above) }\n      |\n      v\n  Clients demand:\n    1. Inclusion proof: "Is leaf3 in this tree?"\n    2. Consistency proof: "Did tree size=4 grow into tree size=6?"',
          label: 'The Merkle tree binds the log to one specific history; proofs make that binding verifiable',
        },
        'The security work splits across independent actors with different trust assumptions:',
        {
          type: 'table',
          headers: ['Actor', 'What it does', 'Trust assumption', 'What it cannot do alone'],
          rows: [
            ['Log', 'Stores entries, publishes signed tree heads, serves proofs', 'Trusted to be available; NOT trusted to be honest', 'Cannot prove it showed the same history to everyone'],
            ['Witness', 'Stores latest checkpoint per log, cosigns only consistent updates', 'Trusted to have memory and independence', 'Cannot detect bad entries; only detects forked history'],
            ['Monitor', 'Downloads entries, checks policy, alerts owners', 'Trusted to watch the right names/keys', 'Cannot force the log to include an entry'],
            ['Auditor', 'Verifies inclusion and consistency proofs on demand', 'No trust needed; proofs are self-verifying', 'Cannot detect bad entries that were legitimately logged'],
          ],
        },
        'The key contract: no single actor needs to be fully trusted. A dishonest log is caught by witnesses. Missing entries are caught by monitors. Invalid proofs are caught by auditors. The security result emerges from the combination, not from trusting any one party.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'An event enters the log as a leaf. The log hashes the entry, appends it to the Merkle tree, and periodically publishes a signed tree head (STH) containing the tree size, root hash, and timestamp. The STH is a compact cryptographic commitment: anyone holding it can verify claims about the log at that point in time.',
        {
          type: 'code',
          language: 'javascript',
          text: '// Merkle tree hash computation (RFC 6962 Section 2)\n// Leaf hash uses a 0x00 prefix to prevent second-preimage attacks\nfunction leafHash(entry) {\n  return SHA256(0x00 || entry);\n}\n\n// Interior node hash uses a 0x01 prefix\nfunction nodeHash(left, right) {\n  return SHA256(0x01 || left || right);\n}\n\n// Signed Tree Head structure\nconst sth = {\n  tree_size: 8,                    // number of leaves\n  timestamp: 1718000000000,        // milliseconds since epoch\n  root_hash: nodeHash(              // root of Merkle tree\n    nodeHash(\n      nodeHash(leafHash(e0), leafHash(e1)),\n      nodeHash(leafHash(e2), leafHash(e3))\n    ),\n    nodeHash(\n      nodeHash(leafHash(e4), leafHash(e5)),\n      nodeHash(leafHash(e6), leafHash(e7))\n    )\n  ),\n  signature: logKey.sign(tree_size, timestamp, root_hash)\n};',
        },
        'An inclusion proof answers: "Is entry X in the tree committed by this STH?" The proof provides the sibling hashes along the path from the leaf to the root. The verifier recomputes the root from the leaf and the proof path, then checks whether it matches the STH\'s root hash.',
        {
          type: 'diagram',
          text: 'Inclusion proof for leaf2 in a tree of size 8:\n\n  Tree structure:        Proof path (provided by log):\n        root                    \n       /    \\              \n    h0123   h4567          sibling3: h4567\n    /  \\      /  \\        \n  h01  h23  h45  h67      sibling2: h01\n  / \\  / \\  / \\  / \\     \n  0  1 2  3 4  5 6  7     sibling1: leaf3_hash\n       ^\n       leaf2\n\n  Verifier computes:\n    step1 = nodeHash(leafHash(entry2), sibling1)   --> h23\n    step2 = nodeHash(sibling2, step1)               --> h0123\n    step3 = nodeHash(step2, sibling3)               --> root\n    assert(step3 === sth.root_hash)  // pass => included',
          label: 'Three sibling hashes prove inclusion in a tree of 8 leaves: O(log n) proof size',
        },
        'A consistency proof answers: "Did the tree at size N grow into the tree at size M by only appending?" The proof provides the minimal set of subtree roots that let the verifier reconstruct both the old root (from size N) and the new root (from size M) and confirm that the old tree is a prefix of the new one.',
        {
          type: 'code',
          language: 'javascript',
          text: '// Consistency proof verification (simplified)\nfunction verifyConsistency(oldSize, oldRoot, newSize, newRoot, proof) {\n  // Reconstruct the old root from proof nodes\n  // covering the first oldSize leaves\n  const computedOldRoot = buildRoot(proof, oldSize);\n  if (computedOldRoot !== oldRoot)\n    throw new Error("Old tree is not a prefix of new tree");\n\n  // Reconstruct the new root from the same proof nodes\n  // plus additional nodes covering leaves oldSize..newSize-1\n  const computedNewRoot = buildRoot(proof, newSize);\n  if (computedNewRoot !== newRoot)\n    throw new Error("New root does not match");\n\n  // Both pass => the log grew by appending, not rewriting\n  return true;\n}',
        },
        'Witnesses provide independent checkpoint memory. A witness stores the latest STH it accepted for each log. When the log publishes a new STH, the witness demands a consistency proof from the old STH to the new one. If the proof verifies, the witness cosigns the new STH. If it fails, the witness refuses and raises an alarm.',
        {
          type: 'diagram',
          text: 'Witness protocol:\n\n  Time T1: Witness stores STH_old = {size: 100, root: 0xaaa}\n  Time T2: Log publishes STH_new = {size: 150, root: 0xbbb}\n\n  Witness asks: "Prove consistency(100, 0xaaa, 150, 0xbbb)"\n  Log provides proof path.\n\n  Case 1 (honest log):\n    Proof verifies. Witness cosigns STH_new.\n    Witness updates stored STH to STH_new.\n\n  Case 2 (log rewrote history):\n    Proof fails. Old root is NOT a prefix of new root.\n    Witness refuses to cosign. Alarm raised.\n\n  Case 3 (log forks -- shows different STHs to different parties):\n    Witness A has STH_new_A, Witness B has STH_new_B.\n    When compared, STH_new_A and STH_new_B are inconsistent.\n    Split view detected.',
          label: 'Witnesses turn equivocation from a private lie into a detectable inconsistency',
        },
        'Monitors download the actual log entries and check them against policy. A Certificate Transparency monitor might watch for all certificates issued to *.example.com and alert the domain owner when one appears that was not requested. A software supply chain monitor might watch for package releases signed by an unexpected key.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument rests on three properties: binding, append-only provability, and split-view detection.',
        {
          type: 'table',
          headers: ['Property', 'Mechanism', 'What it prevents', 'Assumption required'],
          rows: [
            ['Binding', 'Collision-resistant Merkle root commits to exact leaf set and order', 'Changing, removing, or reordering any entry without changing the root', 'SHA-256 (or chosen hash) is collision-resistant'],
            ['Append-only', 'Consistency proofs show old tree is a prefix of new tree', 'Rewriting history: deleting old entries, inserting into the middle', 'At least one party remembers the old STH'],
            ['Split-view detection', 'Witnesses cosign only consistent checkpoints; gossip compares views', 'Log showing different histories to different clients indefinitely', 'At least one honest witness communicates with both sides'],
          ],
        },
        'The binding property comes from the Merkle tree. If the log changes leaf i, every hash on the path from leaf i to the root changes, and the root hash changes. Since the STH contains a signed root hash, the log cannot produce a valid inclusion proof for the altered entry under the old STH. A forged proof would require finding a SHA-256 collision.',
        'The append-only property comes from consistency proofs. A consistency proof between STH(size=N) and STH(size=M) shows that the first N leaves of the larger tree produce the same root as the old tree. If the log removed leaf 5 and replaced it with a different entry, the recomputed root for the first N leaves would differ from the old STH\'s root, and the proof would fail.',
        {
          type: 'note',
          text: 'Append-only is enforced by verification, not by the log itself. A log can always choose to publish an inconsistent STH. The guarantee is that this inconsistency is detectable -- any party holding the old STH can ask for a consistency proof and will not receive a valid one. This is why witnesses matter: they are the parties that actually hold old STHs and demand proofs.',
        },
        'Split-view detection works because witnesses create a gossip network of checkpoint knowledge. If log L shows STH_A to client group 1 and STH_B to client group 2, then witness W (which talks to both groups) will eventually see both. Since STH_A and STH_B commit to different roots for the same or overlapping tree sizes, no consistency proof can connect them. The fork is exposed.',
        {
          type: 'quote',
          text: 'The key property of a transparency log is that it makes it possible for interested parties to detect misbehavior by the log operator.',
          attribution: 'Laurie, Langley, Kasper, Stradling, "Certificate Transparency Version 2.0" (RFC 9162), Section 1',
        },
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'table',
          headers: ['Operation', 'Cost', 'Who pays', 'What doubles when log size doubles'],
          rows: [
            ['Append entry', 'O(log n) hashes to update path to root', 'Log operator', 'One additional hash per append'],
            ['Publish STH', 'O(1) signature', 'Log operator', 'Nothing; constant cost'],
            ['Inclusion proof size', 'O(log n) hashes', 'Log serves; client verifies', 'One additional hash in proof path'],
            ['Consistency proof size', 'O(log n) hashes', 'Log serves; witness/auditor verifies', 'At most one additional hash'],
            ['Verify inclusion proof', 'O(log n) hashes + 1 signature check', 'Client or auditor', 'One additional hash computation'],
            ['Full monitoring', 'O(n) download + policy scan', 'Monitor operator', 'Doubles: must download all new entries'],
          ],
        },
        'Client-side verification is cheap. An inclusion proof for a log with 10 billion entries contains about 34 SHA-256 hashes (ceil(log2(10^10)) = 34), totaling roughly 1 KB. Verifying it requires 34 hash computations and one signature check. This is why browsers can demand CT proofs on every TLS handshake without measurable performance impact.',
        'Monitoring is expensive. Google\'s CT logs collectively contain over 10 billion certificates. A monitor watching all certificates for one domain must process the entire stream, because the log is append-only and entries are not indexed by domain. Facebook\'s CT monitor processes the full stream and maintains a reverse index by domain name. Smaller operators use services like crt.sh that maintain searchable mirrors.',
        {
          type: 'note',
          text: 'The asymmetry is deliberate. Transparency log design pushes expensive work (full download, indexing, policy checking) to a small number of professional monitors, while keeping verification cheap enough that every client can do it. A log with 10 billion entries serves a 1 KB inclusion proof to a browser in milliseconds. The same log requires terabytes of storage and continuous processing at the monitor.',
        },
        'Availability is a policy decision, not a technical constant. Chrome currently requires 2 SCTs (Signed Certificate Timestamps, which are promises to include a certificate) from independent logs. If both logs are unreachable, the browser must choose: block the connection (fail-closed) or proceed without transparency (fail-open). Chrome chose fail-open with expiration: SCTs have a maximum lifetime, and stale ones are rejected. This means a log outage lasting longer than the SCT validity window eventually blocks affected certificates.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Trace the lifecycle of a rogue certificate from issuance through detection.',
        {
          type: 'diagram',
          text: 'Phase 1: Rogue issuance\n\n  Attacker compromises CA "TrustCo"\n  Attacker uses CA key to issue:\n    Subject: bank.example\n    Serial: 9918273\n    Issuer: TrustCo\n    Valid: 2026-01-01 to 2027-01-01\n    Signature: TrustCo.sign(cert_body)  [VALID]\n\n  Without CT: certificate works immediately.\n  With CT: browser demands inclusion proof before trusting it.',
          label: 'The certificate is cryptographically valid -- signatures do not catch this',
        },
        {
          type: 'diagram',
          text: 'Phase 2: Forced logging\n\n  TrustCo must submit cert to at least 2 CT logs to get SCTs.\n  Log "Argon" appends cert as leaf 4,821,009,337.\n  Log "Xenon" appends cert as leaf 2,190,445,112.\n\n  Argon returns SCT:\n    { log_id: "argon", timestamp: 1718000000,\n      signature: argon_key.sign(cert_hash, timestamp) }\n\n  Xenon returns SCT:\n    { log_id: "xenon", timestamp: 1718000001,\n      signature: xenon_key.sign(cert_hash, timestamp) }\n\n  TrustCo embeds both SCTs in the certificate (or serves via TLS extension).\n  The certificate is now committed to two public, append-only logs.',
          label: 'SCTs are promises; the certificate is now in the public record',
        },
        {
          type: 'diagram',
          text: 'Phase 3: Detection\n\n  Facebook CT monitor downloads Argon entries continuously.\n  Entry 4,821,009,337 arrives: cert for bank.example by TrustCo.\n\n  Monitor checks policy for bank.example:\n    Expected issuers: [Let\'s Encrypt, DigiCert]\n    TrustCo is NOT in expected list.\n\n  Monitor sends alert to bank.example domain owner:\n    "Unexpected certificate issued by TrustCo, serial 9918273,\n     logged at 2026-06-15 00:00:00 UTC in Argon"\n\n  Domain owner initiates revocation:\n    1. Contacts TrustCo to revoke cert 9918273\n    2. If TrustCo unresponsive: contacts browser root programs\n    3. Adds CAA record restricting future issuance\n\n  Time from issuance to detection: hours, not weeks.',
          label: 'The monitor catches what signature verification cannot',
        },
        {
          type: 'table',
          headers: ['Step', 'Without CT', 'With CT'],
          rows: [
            ['Issuance', 'Certificate works immediately; no one else knows', 'Certificate must be logged; SCTs embedded'],
            ['Detection', 'Depends on chance discovery (took weeks for DigiNotar)', 'Monitor alerts within hours of log entry appearing'],
            ['Evidence', 'Victim has the cert; CA can deny or claim error', 'Log entry is permanent, timestamped, and signed'],
            ['Scope assessment', 'Unknown: how many other certs were issued?', 'Monitor can enumerate all certs from TrustCo in the log'],
            ['Prevention of repeat', 'Hope CA patches its systems', 'CAA records + monitoring; future misissues detected immediately'],
          ],
        },
        'The key difference is not that CT prevents the rogue certificate from being issued. It does not. The key difference is that the certificate cannot be used in the dark. It must enter a public record, and anyone watching that record can see it.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        {
          type: 'table',
          headers: ['System', 'What is logged', 'Who monitors', 'Scale'],
          rows: [
            ['Certificate Transparency (RFC 6962/9162)', 'TLS certificates', 'Domain owners, CAs, browsers, services like crt.sh and Facebook CT monitor', '10+ billion certs across Google, Cloudflare, and other log operators'],
            ['Sigstore Rekor', 'Code signing events: signatures, attestations, public keys', 'Package maintainers, security teams, CI/CD pipelines', 'Millions of entries; used by npm, PyPI, Homebrew ecosystem tooling'],
            ['Go checksum database (sum.db)', 'Module version hashes', 'Go toolchain (every go get verifies against the log)', 'Millions of module versions; witness at sum.golang.org'],
            ['Key Transparency (Google)', 'Public key directory changes', 'End users via client apps', 'Used in Google Messages for E2E encryption key verification'],
            ['Binary Transparency (various)', 'Firmware and OS image hashes', 'Device vendors, security researchers', 'Emerging; Pixel Binary Transparency for Android'],
          ],
        },
        'Certificate Transparency is the largest and most mature deployment. Since April 2018, Chrome requires all newly issued publicly trusted certificates to come with at least two SCTs from independent CT logs. This means every HTTPS certificate issued by a public CA is logged. The effect is measurable: discovery time for rogue certificates dropped from weeks or months (DigiNotar) to hours.',
        {
          type: 'note',
          text: 'Sigstore extends the transparency model from certificates to software supply chains. When a developer signs a release with Sigstore, the signing event (including an ephemeral certificate from Fulcio and the signature itself) is recorded in the Rekor transparency log. The developer\'s identity is tied to an OIDC token, not a long-lived key, so there is no key to steal. The transparency log is the evidence that a specific identity signed a specific artifact at a specific time.',
        },
        'The Go module ecosystem uses a transparency log (sum.db) to prevent a compromised module proxy from serving tampered code. Every `go get` command verifies the downloaded module hash against the log. A sumdb witness (operated by independent parties) cosigns checkpoints to prevent the log itself from equivocating. This is transparency applied to software dependencies, not certificates.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Transparency does not prevent bad events. A malicious package can be logged honestly and remain in the log forever. Logging is evidence, not access control. The security outcome depends entirely on whether someone monitors, detects, and acts.',
            'Monitoring coverage is uneven. Large companies (Google, Facebook, Cloudflare) monitor CT logs comprehensively. Small domain owners often have no monitoring at all. A rogue certificate for a small business domain may sit in a public log indefinitely without anyone noticing.',
            'Metadata leakage is inherent. A public CT log reveals every domain name that has been issued a certificate, including internal hostnames, staging environments, and pre-launch products. Companies have complained about this since CT was deployed. RFC 9162 does not solve it.',
            'Log availability is a single point of failure for fail-closed policies. If Chrome required valid inclusion proofs (not just SCTs) for every connection and all logs were unreachable, HTTPS would stop working. This is why Chrome uses SCTs (promises) rather than full inclusion proofs, accepting a weaker guarantee for better availability.',
            'Split-view attacks work against isolated clients. If an attacker can prevent a victim from communicating with any honest witness or monitor, the log can show the victim a forked view indefinitely. Transparency assumes network connectivity to independent parties.',
            'Append-only means mistakes are permanent. A certificate logged in error cannot be removed from the log. The entry remains forever. Revocation is separate and must be handled by the CA and relying parties, not by the log.',
          ],
        },
        {
          type: 'table',
          headers: ['Failure mode', 'Example', 'Mitigation'],
          rows: [
            ['No monitoring', 'Small domain has no CT monitor; rogue cert undetected', 'Use services like crt.sh notifications or Google Search Console CT alerts'],
            ['Metadata exposure', 'Internal hostname leaked via CT log', 'Use wildcard certificates; accept that CT trades some privacy for integrity'],
            ['Log unavailability', 'CT log goes offline; new certificates cannot get SCTs', 'Require SCTs from multiple independent logs; browser fail-open policies'],
            ['Delayed detection', 'Monitor polls hourly; attacker uses rogue cert in the gap', 'Reduce polling interval; push-based monitoring where available'],
            ['Log misbehavior', 'Log operator serves inconsistent STHs to different regions', 'Witness network (e.g., sigsum witnesses, Go sumdb witnesses)'],
          ],
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'table',
          headers: ['Source', 'What it covers'],
          rows: [
            ['Laurie, Langley, Kasper, "Certificate Transparency" (RFC 6962, 2013)', 'Original CT specification: Merkle tree construction, SCTs, inclusion/consistency proofs, log/monitor/auditor roles'],
            ['Laurie et al., "Certificate Transparency Version 2.0" (RFC 9162, 2021)', 'Updated spec: improved proof formats, log lifecycle, STH extensions'],
            ['certificate.transparency.dev', 'Google-maintained overview of CT architecture, log list, and monitoring tools'],
            ['Sigstore documentation (docs.sigstore.dev)', 'Transparency applied to software supply chains: Rekor log, Fulcio CA, cosigning'],
            ['Go sumdb design (go.dev/ref/mod#checksum-database)', 'Transparency log for Go module hashes with witness protocol'],
            ['Meiklejohn et al., "Think Global, Act Local: Gossip and Client Audits in Verifiable Data Structures" (2022)', 'Formal analysis of witness/gossip protocols for split-view detection'],
            ['google/trillian (github.com/google/trillian)', 'General-purpose transparency log framework; powers multiple Google CT logs'],
          ],
        },
        {
          type: 'bullets',
          items: [
            'Prerequisite: study Merkle Tree for the hash-based commitment structure that all transparency proofs depend on, and digital signatures for the binding between a log operator\'s key and its published checkpoints.',
            'Extensions: study Merkle Mountain Range Append-Only Log for an alternative append-friendly tree structure, and Sigstore Keyless Signing Transparency for how transparency eliminates long-lived signing keys.',
            'Production context: study Software Supply Chain Provenance Graph for the broader supply-chain integrity picture, Content-Addressed Merkle DAG Object Store for content-addressed storage using similar hash structures, and Write-Ahead Log for the general append-only log pattern in databases.',
            'Contrast: study Blockchain Consensus for systems that achieve append-only guarantees through distributed consensus rather than a single trusted-but-verified log operator, and compare the trust assumptions and performance tradeoffs.',
          ],
        },
      ],
    },
  ],
};
