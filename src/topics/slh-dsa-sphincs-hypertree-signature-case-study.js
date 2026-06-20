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
      heading: 'Why This Exists',
      paragraphs: [
        'Post-quantum cryptography is not one replacement algorithm. ML-KEM covers key establishment, ML-DSA covers lattice-based signatures, and SLH-DSA covers stateless hash-based signatures. SLH-DSA, standardized in FIPS 205 and based on SPHINCS+, matters because it gives systems a signature option whose security story is built mostly from hash functions rather than lattice assumptions.',
        'That conservative assumption base is useful for long-lived trust anchors. Firmware, root certificates, audit logs, software releases, and archival records may need signatures that remain credible across many years. SLH-DSA is not chosen because it is small. It is chosen when a hash-based fallback or defense-in-depth signature family is worth the extra bytes.',
        {type:'callout', text:'SLH-DSA buys stateless post-quantum signatures by moving enough hash proof material into each signature for public recomputation.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/9/95/Hash_Tree.svg', alt:'Binary hash tree showing leaf blocks, intermediate hashes, and a top hash.', caption:'Binary hash tree diagram by Azaghal, based on David Gothberg original, Wikimedia Commons, CC0.'},
      ],
    },
    {
      heading: 'Naive One-Time Signatures',
      paragraphs: [
        'The simple hash-signature idea is easy to sketch. Generate many one-time signing keys, sign a message with one of them, and prove that the corresponding one-time public key is part of a Merkle tree whose root is the public key. Verification is public recomputation: hash the one-time material, walk the authentication path, and compare the root.',
        'The obvious design fails operationally because it is stateful. If a signer must remember which one-time leaves have already been used, then backup restoration, parallel signing, crash recovery, or clock mistakes can reuse a leaf. Reusing one-time signing material can destroy security. The hard part is avoiding that state-management cliff while keeping verification public and simple.',
      ],
    },
    {
      heading: 'Core Insight',
      paragraphs: [
        'SLH-DSA makes the scheme stateless by deriving signing choices from the message, randomness, secret seed material, and address structure. Instead of asking the signer to maintain a global counter, the signature carries enough one-time-signature and authentication-path material for the verifier to rebuild the public root for this message.',
        'The price is size. Statelessness moves information into the signature bundle. The verifier does not trust a hidden database of used leaves. It trusts the public root and checks that the provided FORS data, WOTS+ data, and Merkle paths hash upward to that root under the right address domains.',
      ],
    },
    {
      heading: 'FORS Layer',
      paragraphs: [
        'FORS is the forest-of-random-subsets component. The message digest selects leaves across several small trees. The signature reveals selected secret values and sibling nodes so the verifier can reconstruct a FORS public value. Think of it as a hash-based way to bind message-derived indexes to a compact root used by the next layer.',
        'FORS is not the whole signature. It signs a message-derived value inside the larger construction. Its output is then authenticated by WOTS+ and by the hypertree. This layering is why the bundle has many parts that look similar at first glance: each part belongs to a different level of public recomputation.',
      ],
    },
    {
      heading: 'WOTS Plus',
      paragraphs: [
        'WOTS+ is a one-time signature scheme made from hash chains. A secret value is hashed forward a message-dependent number of steps, and the verifier hashes the revealed chain value the remaining number of steps to reach a public chain endpoint. Many chains together authenticate the value being signed.',
        'The one-time warning still matters. WOTS+ material is safe only inside the construction that prevents dangerous reuse. SLH-DSA wraps it in randomized message processing, tree addressing, and hypertree authentication so that the signer can be stateless while the verifier still sees a complete public proof object.',
      ],
    },
    {
      heading: 'Hypertree Paths',
      paragraphs: [
        'A single huge Merkle tree would be unwieldy. SLH-DSA uses a hypertree: multiple layers of smaller Merkle trees. A WOTS+ signature at one layer authenticates the root of the layer below. Authentication paths provide sibling nodes that let the verifier hash from a leaf or subtree root upward.',
        'This is the Merkle Tree lesson repeated carefully. A leaf alone is not enough. The verifier needs the sibling at each level and the rule for ordering left and right children. The final check is the public root. If the recomputed root differs, the signature is rejected.',
      ],
    },
    {
      heading: 'Address Separation',
      paragraphs: [
        'SLH-DSA performs many hash calls that would be dangerous to confuse. A hash used for a FORS leaf must not be interchangeable with a hash used for a WOTS+ chain step or a Merkle internal node. Address fields and domain separation tell each hash invocation what role, layer, tree, and position it belongs to.',
        'This is not clerical metadata. In a construction made almost entirely of hashes, context is part of security. The same bytes under the wrong address should not validate in another role. Good implementations treat address construction as critical logic, not formatting glue.',
      ],
    },
    {
      heading: 'What The Visual Proves',
      paragraphs: [
        'The hypertree visual shows verification as a path of public recomputation. The message selects FORS material. FORS produces a value. WOTS+ and authentication paths lift that value through Merkle layers. The public key is reached only if every revealed piece fits its claimed position.',
        'The signature-bundle view explains the size tradeoff. The signature is not a single digest plus a short scalar. It is a portable proof object containing randomness, selected leaves, chain values, sibling nodes, layer indexes, and enough structure for a verifier with no signing secret to rebuild trust from hash operations.',
      ],
    },
    {
      heading: 'Why It Works',
      paragraphs: [
        'Verification works because each layer reduces to a public hash check. The verifier recomputes FORS roots from the revealed secret values and siblings, recomputes WOTS+ public keys from chain values, compresses those public keys into leaves, and walks Merkle authentication paths through the hypertree.',
        'Security depends on the hash assumptions, the one-time-signature limits, correct randomized message processing, and correct domain separation. The signer does not need to remember used leaves, which removes a serious operational failure mode. The verifier accepts only if the whole bundle recomputes to the expected public root for the exact message.',
      ],
    },
    {
      heading: 'Costs And Tradeoffs',
      paragraphs: [
        'The cost ledger for SLH-DSA should track algorithm parameter set, signature bytes, public-key bytes, private-key handling, signing CPU, verification CPU, artifact size, transport fragmentation, cache impact, and policy reason. Large signatures are not incidental overhead. They are the data needed for stateless public recomputation.',
        'The tradeoff is unusually plain. SLH-DSA buys conservative assumptions and stateless operation with larger signatures and more hashing work. That can be a good bargain for artifacts signed rarely and verified many times. It can be a poor bargain when every byte appears on a latency-sensitive network path.',
      ],
    },
    {
      heading: 'Where It Wins',
      paragraphs: [
        'SLH-DSA fits firmware signing, software supply-chain attestations, root-of-trust material, archival signatures, offline release signatures, audit logs, and fallback signature policy. These settings can often tolerate large signatures because the signed object is already large or because verification is not inside a tight handshake loop.',
        'It is also an excellent teaching bridge. It connects hash functions, Merkle authentication paths, one-time signatures, domain separation, and proof bundles into one standardized object. Students who understand SLH-DSA understand why cryptographic engineering is often about state, serialization, and failure modes as much as formulas.',
      ],
    },
    {
      heading: 'Failure Modes',
      paragraphs: [
        'The first failure mode is pretending that all post-quantum signatures have the same deployment shape. ML-DSA and SLH-DSA both sign, but their size, assumption story, and operational fit differ. A protocol that can absorb ML-DSA may not be able to absorb SLH-DSA without changes to packetization, certificate chains, caches, or storage.',
        'The second failure mode is hiding the bytes. Large signatures affect bandwidth, database indexes, transparency logs, embedded firmware partitions, certificate compression, and denial-of-service surfaces. The third is implementation confusion: wrong addresses, wrong parameter identifiers, weak randomness handling, or accepting a bundle under the wrong algorithm label can defeat the clean theory.',
      ],
    },
    {
      heading: 'Study Next',
      paragraphs: [
        'Start with Merkle Tree if authentication paths are new. Then compare ML-DSA Dilithium Rejection Sampling for lattice signatures, ML-KEM Kyber Module Lattice KEM for key establishment, Transparency Log Witnessing for public audit, TUF Update Metadata for signed software updates, Sigstore Keyless Signing, and Software Supply Chain Provenance Graph.',
        'The primary specification is NIST FIPS 205. The useful mental model is not that SLH-DSA is complicated magic. It is a carefully addressed stack of hash-based proof checks, designed to remove signer state at the cost of carrying a large but verifiable signature bundle.',
      ],
    },
  ],
};
