// SLH-DSA / SPHINCS+: stateless hash-based signatures with FORS, WOTS+,
// Merkle authentication paths, and hypertree layer indexes.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'slh-dsa-sphincs-hypertree-signature-case-study',
  title: 'SLH-DSA SPHINCS+ Hypertree Signature Case Study',
  category: 'Security',
  summary: 'A stateless hash-based signature case study: FORS trees, WOTS+ chains, Merkle authentication paths, hypertree layers, address-derived domain separation, large signatures, and conservative fallback deployment.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['hypertree path', 'signature bundle'], defaultValue: 'hypertree path' },
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
  return matrixState({ title, rows, columns, values: labelsByRow.map((row) => row.map(code)), format: (value) => labels[value] });
}

function treeGraph(title) {
  return graphState({
    nodes: [
      { id: 'msg', label: 'msg', x: 0.8, y: 3.5, note: 'hash' },
      { id: 'fors', label: 'FORS', x: 2.4, y: 3.5, note: 'forest' },
      { id: 'w0', label: 'WOTS0', x: 4.0, y: 2.0, note: 'chain' },
      { id: 'm0', label: 'M0', x: 5.7, y: 2.0, note: 'auth' },
      { id: 'w1', label: 'WOTS1', x: 4.0, y: 5.0, note: 'chain' },
      { id: 'm1', label: 'M1', x: 5.7, y: 5.0, note: 'auth' },
      { id: 'root', label: 'root', x: 8.2, y: 3.5, note: 'pk' },
    ],
    edges: [
      { id: 'e-msg-fors', from: 'msg', to: 'fors' },
      { id: 'e-fors-w0', from: 'fors', to: 'w0' },
      { id: 'e-w0-m0', from: 'w0', to: 'm0' },
      { id: 'e-m0-root', from: 'm0', to: 'root' },
      { id: 'e-fors-w1', from: 'fors', to: 'w1' },
      { id: 'e-w1-m1', from: 'w1', to: 'm1' },
      { id: 'e-m1-root', from: 'm1', to: 'root' },
    ],
  }, { title });
}

function* hypertreePath() {
  yield {
    state: treeGraph('SLH-DSA signs through a hash hypertree'),
    highlight: { active: ['msg', 'fors', 'w0', 'm0', 'root', 'e-msg-fors', 'e-fors-w0', 'e-m0-root'], compare: ['w1', 'm1'] },
    explanation: 'SLH-DSA is stateless hash-based signing. A message selects FORS leaves and hypertree paths; the verifier hashes the signature material upward to the public root.',
    invariant: 'Verification is hash recomputation against the public root, not lattice algebra.',
  };

  yield {
    state: labelMatrix(
      'Layer objects',
      [
        { id: 'fors', label: 'FORS' },
        { id: 'wots', label: 'WOTS' },
        { id: 'auth', label: 'auth' },
        { id: 'addr', label: 'addr' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['msg bits', 'large'],
        ['one-time', 'reuse'],
        ['Merkle path', 'bytes'],
        ['domain', 'mixup'],
      ],
    ),
    highlight: { active: ['fors:role', 'wots:role', 'auth:role'], compare: ['addr:risk'] },
    explanation: 'The signature bundle is large because it carries enough one-time-signature and authentication-path material for the verifier to recompute the root.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'leaf', label: 'leaf', x: 0.9, y: 5.3, note: 'hash' },
        { id: 'sib0', label: 'sib0', x: 2.5, y: 4.4, note: 'path' },
        { id: 'n1', label: 'n1', x: 4.2, y: 3.6, note: 'hash' },
        { id: 'sib1', label: 'sib1', x: 5.8, y: 2.7, note: 'path' },
        { id: 'n2', label: 'n2', x: 7.3, y: 2.1, note: 'hash' },
        { id: 'root', label: 'root', x: 8.7, y: 1.5, note: 'pk' },
      ],
      edges: [
        { id: 'e-leaf-n1', from: 'leaf', to: 'n1' },
        { id: 'e-sib0-n1', from: 'sib0', to: 'n1' },
        { id: 'e-n1-n2', from: 'n1', to: 'n2' },
        { id: 'e-sib1-n2', from: 'sib1', to: 'n2' },
        { id: 'e-n2-root', from: 'n2', to: 'root' },
      ],
    }, { title: 'Merkle authentication paths are explicit proof data' }),
    highlight: { active: ['leaf', 'sib0', 'n1', 'sib1', 'n2', 'root'], found: ['e-n2-root'] },
    explanation: 'Each authentication path proves that a generated leaf belongs under the signed public root. This is the Merkle Tree lesson applied many times inside one signature.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'conservatism', min: 0, max: 10 }, y: { label: 'relative size', min: 0, max: 100 } },
      series: [
        { id: 'sig', label: 'sig', points: [{ x: 2, y: 88 }, { x: 5, y: 82 }, { x: 8, y: 76 }] },
        { id: 'risk', label: 'risk', points: [{ x: 2, y: 42 }, { x: 5, y: 30 }, { x: 8, y: 20 }] },
      ],
      markers: [
        { id: 'fallback', label: 'backup', x: 8, y: 76 },
        { id: 'hot', label: 'hot', x: 2, y: 88 },
      ],
    }, { title: 'Hash signatures buy conservative assumptions with bytes' }),
    highlight: { active: ['sig'], compare: ['risk'], found: ['fallback'] },
    explanation: 'Hash-based signatures are attractive as a conservative fallback family, but signature size can dominate protocol and storage decisions.',
  };
}

function* signatureBundle() {
  yield {
    state: labelMatrix(
      'Signature bundle',
      [
        { id: 'rand', label: 'rand' },
        { id: 'fors', label: 'FORS' },
        { id: 'wots', label: 'WOTS' },
        { id: 'auth', label: 'auth' },
      ],
      [
        { id: 'contains', label: 'contains' },
        { id: 'verify', label: 'verify' },
      ],
      [
        ['R', 'msg hash'],
        ['leaves', 'root'],
        ['chains', 'pk leaf'],
        ['siblings', 'root'],
      ],
    ),
    highlight: { active: ['fors:contains', 'wots:contains', 'auth:contains'], found: ['auth:verify'] },
    explanation: 'A verifier does not need the signing secret. It consumes the bundle, recomputes FORS and WOTS-derived nodes, walks authentication paths, and compares the final root.',
  };

  yield {
    state: treeGraph('The verifier rebuilds a root from bundle data'),
    highlight: { active: ['fors', 'w0', 'm0', 'root', 'e-fors-w0', 'e-w0-m0', 'e-m0-root'], compare: ['msg'] },
    explanation: 'The signature is a proof object. It carries enough data for public recomputation but should not reveal reusable signing secrets.',
  };

  yield {
    state: labelMatrix(
      'Deployment uses',
      [
        { id: 'fw', label: 'firmware' },
        { id: 'root', label: 'root CA' },
        { id: 'ledger', label: 'ledger' },
        { id: 'tls', label: 'TLS' },
      ],
      [
        { id: 'fit', label: 'fit' },
        { id: 'watch', label: 'watch' },
      ],
      [
        ['good', 'size'],
        ['good', 'policy'],
        ['maybe', 'storage'],
        ['hard', 'handshake'],
      ],
    ),
    highlight: { active: ['fw:fit', 'root:fit'], compare: ['tls:watch'] },
    explanation: 'SLH-DSA often fits places where signatures are verified rarely or stored with artifacts. It is harder in latency- and bandwidth-sensitive handshakes.',
  };

  yield {
    state: labelMatrix(
      'Study map',
      [
        { id: 'mlkem', label: 'ML-KEM' },
        { id: 'mldsa', label: 'ML-DSA' },
        { id: 'slh', label: 'SLH' },
        { id: 'merkle', label: 'Merkle' },
      ],
      [
        { id: 'family', label: 'family' },
        { id: 'role', label: 'role' },
      ],
      [
        ['lattice', 'key'],
        ['lattice', 'sign'],
        ['hash', 'sign'],
        ['hash tree', 'proof'],
      ],
    ),
    highlight: { active: ['slh:family', 'merkle:role'], compare: ['mlkem:family', 'mldsa:family'] },
    explanation: 'The PQC menu is not one algorithm. ML-KEM handles key establishment, ML-DSA handles lattice signatures, and SLH-DSA is a hash-based signature fallback with different costs.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'hypertree path') yield* hypertreePath();
  else if (view === 'signature bundle') yield* signatureBundle();
  else throw new InputError('Pick an SLH-DSA view.');
}

export const article = {
  sections: [
    { heading: 'What it is', paragraphs: ['SLH-DSA is NIST FIPS 205: the standardized stateless hash-based digital signature algorithm based on SPHINCS+. It relies on hash functions, one-time signatures, and Merkle authentication paths rather than lattice assumptions.', 'The data structures are FORS forests, WOTS+ chains, hypertree layers, address fields for domain separation, authentication paths, public roots, and large signature bundles.'] },
    { heading: 'How it works', paragraphs: ['The signer hashes the message into indexes, reveals selected FORS and WOTS+ material, and includes Merkle authentication paths through a hypertree. The verifier recomputes hashes upward and checks the final root against the public key.', 'Because it is stateless, the signer does not need to track which one-time leaf was used across signatures. That avoids a dangerous state-management class of failures at the cost of larger signatures.'] },
    { heading: 'Cost and complexity', paragraphs: ['SLH-DSA spends bytes and hashing work to get conservative security assumptions. It can be a strong fit for firmware, root signatures, audit logs, or fallback policy, but large signatures are expensive for handshakes and constrained links.'] },
    { heading: 'Complete case study', paragraphs: ['A vendor signs firmware images with SLH-DSA as a long-horizon fallback. The verification path stores the public root, algorithm identifier, signature bundle, image hash, verification result, and release timestamp. The artifact system accepts larger signatures because firmware updates are not a per-request latency path.', 'A TLS-style handshake has a different ledger: signature bytes, certificate chain size, handshake fragmentation, CPU cost, and client support become first-class rollout constraints.'] },
    { heading: 'Pitfalls', paragraphs: ['Do not confuse stateless hash-based signatures with small signatures. Do not assume every PQC signature has the same deployment profile. Do not strip address/domain-separation fields from the mental model; they prevent cross-layer hash reuse confusion.'] },
    { heading: 'Sources and study next', paragraphs: ['Primary source: NIST FIPS 205 at https://csrc.nist.gov/pubs/fips/205/final. Study Merkle Tree, ML-DSA Dilithium Rejection Sampling Case Study, ML-KEM Kyber Module-Lattice KEM Case Study, Transparency Log Witnessing Case Study, and Software Supply Chain Provenance Graph next.'] },
  ],
};
