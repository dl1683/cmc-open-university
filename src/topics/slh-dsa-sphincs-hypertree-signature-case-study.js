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
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as public recomputation of a signature. SLH-DSA is the NIST stateless hash-based digital signature algorithm, SPHINCS+ is the construction behind it, and a hypertree is a stack of Merkle trees used to authenticate smaller signature pieces. Active nodes are the FORS values, WOTS+ chain values, sibling hashes, or roots being recomputed.',
        {type:'callout', text:'SLH-DSA buys stateless post-quantum signatures by moving enough hash proof material into each signature for public recomputation.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/9/95/Hash_Tree.svg', alt:'Binary hash tree showing leaf blocks, intermediate hashes, and a top hash.', caption:'Binary hash tree diagram by Azaghal, based on David Gothberg original, Wikimedia Commons, CC0.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Post-quantum signatures are needed because large quantum computers would threaten RSA and elliptic-curve signatures. SLH-DSA gives a standardized signature family built mainly from hash functions. It is attractive for firmware, root certificates, release artifacts, transparency logs, and archival records that can tolerate large signatures.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The simple hash-signature design uses many one-time signing keys. Sign with one leaf key, provide a Merkle authentication path, and let the verifier hash upward to the public root. The design is clear, but the signer must never reuse a leaf.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is signer state. A stateful signer must remember exactly which one-time leaves are consumed across crashes, backups, parallel machines, and restarts. If that counter is wrong, one-time key reuse can destroy the security argument.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'SLH-DSA derives signing choices from secret seeds, message processing, randomness, and address fields rather than a mutable global counter. The signature carries selected secret values, chain values, and sibling nodes. Statelessness moves information into the signature bundle so the verifier can rebuild trust from public hash checks.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'FORS, the forest of random subsets, binds a message digest to selected leaves in several small hash trees. WOTS+ uses hash chains as one-time signatures for values produced by lower layers. The hypertree links layers with Merkle authentication paths, and address fields separate hash roles so a leaf hash cannot be confused with an internal-node hash.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Verification works because every layer reduces to a public hash check. If a revealed value, sibling order, address, parameter identifier, or message digest is wrong, the recomputed parent changes and the final root no longer matches the public key. The signer avoids durable leaf-use memory, but security still depends on correct randomized message processing and domain separation.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The main cost is bytes and hashes. A 16 KB signature added to a 10 MB firmware image is usually tolerable, but the same 16 KB inside a handshake or certificate chain can change latency, packetization, cache footprint, and storage. Verification spends CPU hashing the supplied proof material back to the root.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'SLH-DSA fits signed software releases, firmware updates, root-of-trust material, archival records, transparency logs, and fallback signature policy. These settings often sign rarely and verify many times, so large signatures can be an acceptable trade for stateless hash-based assurance.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'SLH-DSA is a poor fit when every byte sits on a latency-sensitive path. Large signatures can stress embedded links, TLS handshakes, logs, and indexes. It also fails under implementation confusion: wrong addresses, wrong parameter labels, weak randomness, or incomplete verification can defeat the clean theory.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Use a toy hypertree with 4 layers and 3 sibling hashes per layer, with each hash output 32 bytes. Merkle siblings alone cost 4 x 3 x 32 = 384 bytes before FORS values, WOTS+ chain values, randomness, and identifiers. If one sibling is swapped, the next parent hash changes and the final public root comparison rejects.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: NIST FIPS 205 for SLH-DSA, the SPHINCS+ specification and papers, and NIST post-quantum cryptography material. Study Merkle trees, one-time signatures, WOTS+, FORS, domain separation, ML-DSA, ML-KEM, transparency logs, TUF metadata, and software supply-chain provenance.',
      ],
    },
  ],
};