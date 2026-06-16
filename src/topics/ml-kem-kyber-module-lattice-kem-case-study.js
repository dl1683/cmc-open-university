// ML-KEM / Kyber: module-lattice key encapsulation with public matrices,
// small-noise secrets, ciphertext compression, and decapsulation checks.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'ml-kem-kyber-module-lattice-kem-case-study',
  title: 'ML-KEM Kyber Module-Lattice KEM Case Study',
  category: 'Security',
  summary: 'A post-quantum key-establishment case study: module lattices, public matrix seeds, small-noise vectors, NTT polynomial products, encapsulation, decapsulation, ciphertext checks, and parameter-set ledgers.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['kem flow', 'lattice state'], defaultValue: 'kem flow' },
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

function kemGraph(title) {
  return graphState({
    nodes: [
      { id: 'keygen', label: 'keygen', x: 0.8, y: 3.5, note: 'pk/sk' },
      { id: 'pk', label: 'pk', x: 2.5, y: 2.0, note: 'public' },
      { id: 'encap', label: 'encap', x: 4.4, y: 3.5, note: 'ct+ss' },
      { id: 'ct', label: 'ct', x: 6.2, y: 2.0, note: 'send' },
      { id: 'decap', label: 'decap', x: 7.8, y: 3.5, note: 'check' },
      { id: 'ss', label: 'ss', x: 8.8, y: 5.3, note: 'key' },
    ],
    edges: [
      { id: 'e-keygen-pk', from: 'keygen', to: 'pk' },
      { id: 'e-pk-encap', from: 'pk', to: 'encap' },
      { id: 'e-encap-ct', from: 'encap', to: 'ct' },
      { id: 'e-ct-decap', from: 'ct', to: 'decap' },
      { id: 'e-encap-ss', from: 'encap', to: 'ss' },
      { id: 'e-decap-ss', from: 'decap', to: 'ss' },
    ],
  }, { title });
}

function* kemFlow() {
  yield {
    state: kemGraph('A KEM establishes a shared secret'),
    highlight: { active: ['keygen', 'pk', 'encap', 'ct', 'e-pk-encap', 'e-encap-ct'], found: ['decap', 'ss'] },
    explanation: 'ML-KEM is a key-encapsulation mechanism. One side publishes a public key, the other encapsulates a shared secret into a ciphertext, and the private-key holder decapsulates the same secret.',
    invariant: 'The shared secret is the output; the ciphertext is only the transport object.',
  };

  yield {
    state: labelMatrix(
      'ML-KEM parameter sets',
      [
        { id: 'k512', label: '512' },
        { id: 'k768', label: '768' },
        { id: 'k1024', label: '1024' },
        { id: 'hyb', label: 'hybrid' },
      ],
      [
        { id: 'strength', label: 'strength' },
        { id: 'cost', label: 'cost' },
        { id: 'use', label: 'use' },
      ],
      [
        ['lower', 'fast', 'broad'],
        ['mid', 'mid', 'default'],
        ['higher', 'larger', 'high'],
        ['combo', 'larger', 'transition'],
      ],
    ),
    highlight: { active: ['k768:use'], compare: ['k512:strength', 'k1024:cost'], found: ['hyb:use'] },
    explanation: 'The parameter set is a deployment choice. Higher security levels spend more bytes and cycles; hybrid deployments combine PQC with classical key exchange during migration.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'coins', label: 'coins', x: 0.9, y: 2.0, note: 'rand' },
        { id: 'hash', label: 'hash', x: 2.6, y: 2.0, note: 'derive' },
        { id: 'poly', label: 'poly', x: 4.4, y: 2.0, note: 'NTT' },
        { id: 'comp', label: 'comp', x: 6.3, y: 2.0, note: 'pack' },
        { id: 'check', label: 'check', x: 6.3, y: 5.0, note: 'FO' },
        { id: 'fail', label: 'fail', x: 8.4, y: 5.0, note: 'safe' },
      ],
      edges: [
        { id: 'e-coins-hash', from: 'coins', to: 'hash' },
        { id: 'e-hash-poly', from: 'hash', to: 'poly' },
        { id: 'e-poly-comp', from: 'poly', to: 'comp' },
        { id: 'e-comp-check', from: 'comp', to: 'check' },
        { id: 'e-check-fail', from: 'check', to: 'fail' },
      ],
    }, { title: 'Encapsulation is randomness plus structured algebra' }),
    highlight: { active: ['coins', 'hash', 'poly', 'comp', 'e-hash-poly', 'e-poly-comp'], found: ['check'] },
    explanation: 'The implementation path is a pipeline: derive randomness, multiply module-lattice polynomials, compress the ciphertext, and make decapsulation failure indistinguishable from success to attackers.',
  };

  yield {
    state: labelMatrix(
      'Deployment ledger',
      [
        { id: 'param', label: 'param' },
        { id: 'seed', label: 'seed' },
        { id: 'ct', label: 'ct' },
        { id: 'errata', label: 'errata' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['512/768/1024', 'mismatch'],
        ['matrix seed', 'reuse'],
        ['bytes', 'reject leak'],
        ['FIPS note', 'revision'],
      ],
    ),
    highlight: { active: ['param:stores', 'ct:risk'], found: ['errata:risk'] },
    explanation: 'A production KEM record should include parameter set, public-key fingerprint, ciphertext length, failure behavior, implementation version, and FIPS errata awareness.',
  };
}

function* latticeState() {
  yield {
    state: labelMatrix(
      'Module-lattice objects',
      [
        { id: 'A', label: 'A' },
        { id: 's', label: 's' },
        { id: 'e', label: 'e' },
        { id: 't', label: 't' },
      ],
      [
        { id: 'shape', label: 'shape' },
        { id: 'visibility', label: 'vis' },
      ],
      [
        ['matrix', 'public'],
        ['vector', 'secret'],
        ['small', 'secret'],
        ['vector', 'public'],
      ],
    ),
    highlight: { active: ['A:visibility', 't:visibility'], compare: ['s:visibility', 'e:visibility'] },
    explanation: 'ML-KEM public keys expose structured module-lattice data while hiding small-noise secrets. The hardness assumption is about recovering secrets from noisy linear structure.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'seed', label: 'seed', x: 0.8, y: 3.5, note: 'expand' },
        { id: 'A', label: 'A', x: 2.5, y: 3.5, note: 'matrix' },
        { id: 's', label: 's', x: 4.2, y: 2.0, note: 'small' },
        { id: 'e', label: 'e', x: 4.2, y: 5.0, note: 'noise' },
        { id: 'mul', label: 'mul', x: 6.2, y: 3.5, note: 'NTT' },
        { id: 'pub', label: 'pub', x: 8.2, y: 3.5, note: 't' },
      ],
      edges: [
        { id: 'e-seed-A', from: 'seed', to: 'A' },
        { id: 'e-A-mul', from: 'A', to: 'mul' },
        { id: 'e-s-mul', from: 's', to: 'mul' },
        { id: 'e-e-mul', from: 'e', to: 'mul' },
        { id: 'e-mul-pub', from: 'mul', to: 'pub' },
      ],
    }, { title: 'Public matrices are expanded from compact seeds' }),
    highlight: { active: ['seed', 'A', 'mul', 'pub', 'e-seed-A', 'e-mul-pub'], compare: ['s', 'e'] },
    explanation: 'Seeds compress public matrix generation. Secrets and noise remain private, while NTT polynomial multiplication makes the module operations fast enough for real protocols.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'security level', min: 0, max: 3 }, y: { label: 'relative size', min: 0, max: 100 } },
      series: [
        { id: 'pk', label: 'pk', points: [{ x: 1, y: 35 }, { x: 2, y: 55 }, { x: 3, y: 78 }] },
        { id: 'ct', label: 'ct', points: [{ x: 1, y: 32 }, { x: 2, y: 50 }, { x: 3, y: 70 }] },
      ],
      markers: [
        { id: 'm512', label: '512', x: 1, y: 35 },
        { id: 'm1024', label: '1024', x: 3, y: 78 },
      ],
    }, { title: 'Security level moves byte size' }),
    highlight: { active: ['pk', 'ct'], found: ['m512', 'm1024'] },
    explanation: 'PQC migration is not only math. Packet sizes, handshake fragmentation, hardware acceleration, and certificate chains all need measured rollout data.',
  };

  yield {
    state: kemGraph('ML-KEM feeds symmetric cryptography'),
    highlight: { active: ['decap', 'ss', 'e-decap-ss', 'e-encap-ss'], compare: ['ct'] },
    explanation: 'A KEM establishes a shared secret. Protocols then feed that secret into key derivation and symmetric encryption or authentication; they do not encrypt bulk data directly with ML-KEM.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'kem flow') yield* kemFlow();
  else if (view === 'lattice state') yield* latticeState();
  else throw new InputError('Pick an ML-KEM view.');
}

export const article = {
  sections: [
    { heading: 'What it is', paragraphs: ['ML-KEM is the NIST-standardized module-lattice key-encapsulation mechanism derived from CRYSTALS-Kyber. It lets two parties establish a shared secret over a public channel.', 'The data structures are module-lattice vectors and matrices over polynomial rings, compact seeds, ciphertext byte arrays, shared-secret derivation state, and decapsulation checks.'] },
    { heading: 'How it works', paragraphs: ['Key generation creates a public key and private key. Encapsulation uses the public key and randomness to produce a ciphertext plus a shared secret. Decapsulation uses the private key to recover the same shared secret or safely produce a pseudorandom fallback on invalid ciphertext.', 'The efficient algebra is built from NTT Polynomial Multiplication: fixed-size polynomial vectors, modular reductions, compression, and packing.'] },
    { heading: 'Cost and complexity', paragraphs: ['Compared with classical elliptic-curve key exchange, ML-KEM changes byte sizes and implementation risk. Parameter choice affects public-key size, ciphertext size, CPU cost, and security strength. Migration also needs hybrid negotiation, interoperability tests, and side-channel review.'] },
    { heading: 'Complete case study', paragraphs: ['A TLS deployment offers a hybrid key exchange during migration. The server records the classical group, ML-KEM parameter set, public-key size, ciphertext size, decapsulation result path, handshake fragmentation, latency, and library version. Failures are sliced by client family and network middlebox.', 'The key engineering rule is to treat decapsulation failure handling as sensitive. An observable difference between valid and invalid ciphertext paths can create attack surface.'] },
    { heading: 'Pitfalls', paragraphs: ['Do not call ML-KEM a general encryption algorithm. It establishes shared secrets. Do not ignore the FIPS publication planning notes and errata spreadsheets. Do not benchmark only CPU time while ignoring bytes on the wire and implementation side channels.'] },
    { heading: 'Sources and study next', paragraphs: ['Primary sources: NIST FIPS 203 at https://csrc.nist.gov/pubs/fips/203/final and CRYSTALS-Kyber specification at https://pq-crystals.org/kyber/data/kyber-specification-round3-20210804.pdf. Study NTT Polynomial Multiplication Primer, Binary Exponentiation, ML-DSA Dilithium Rejection Sampling Case Study, SLH-DSA SPHINCS+ Hypertree Signature Case Study, and Shamir Secret Sharing next.'] },
  ],
};
