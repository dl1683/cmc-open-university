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
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation shows ML-KEM, the NIST module-lattice key encapsulation mechanism derived from Kyber. A key encapsulation mechanism, or KEM, lets one party create a shared secret using another party public key and a ciphertext transport object.',
        'Active nodes are the operation running now, compare marks hidden secret or failure-check state, and found marks the shared secret or confirmed deployment choice. The safe inference rule is this: the ciphertext is not the secret; it is the public object that lets the private-key holder derive the same 32-byte secret.',
        {type:'callout', text:'ML-KEM turns key exchange into a public ciphertext transport while keeping the shared secret inside a checked module-lattice computation.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/9/97/Equilateral_Triangle_Lattice.svg', alt:'Equilateral triangular lattice points arranged in a regular grid.', caption:'Equilateral triangle lattice, a simple visual proxy for module-lattice cryptography. Image by Jim.belk, public domain, Wikimedia Commons.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Encrypted protocols need a way to create a fresh symmetric key before encrypted traffic begins. Classical Diffie-Hellman does this with discrete logarithms, which are threatened by Shor algorithm on a large fault-tolerant quantum computer.',
        'ML-KEM exists for "harvest now, decrypt later" risk. An attacker can record traffic today and wait for future cryptanalysis, so long-lived secrets need a key-establishment step that is not based on factoring or discrete logs.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious migration plan is to replace an elliptic-curve key exchange with a post-quantum primitive and keep the protocol around it unchanged. That instinct is reasonable because both primitives feed a key derivation function with a shared secret.',
        'A KEM has a different shape from Diffie-Hellman. One side publishes a public key, the other encapsulates to a ciphertext, and the private-key holder decapsulates; the data flow is asymmetric even though both sides end with the same secret.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is the size and validity behavior of the new objects. An X25519 public share is 32 bytes, while an ML-KEM-768 public key is 1184 bytes and its ciphertext is 1088 bytes.',
        'Those bytes affect packet size, handshake fragmentation, middlebox behavior, certificate design, embedded links, and hardware queues. The algorithm is fast, but the system around it has to tolerate larger public objects and strict decapsulation failure rules.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'ML-KEM hides a small secret inside noisy module-lattice equations. The public key exposes A and t = A*s + e, where A is public structure, s is secret, and e is small noise that blocks ordinary linear solving.',
        'Encapsulation creates a ciphertext from related noisy equations and a random message. Decapsulation recovers the message, re-encrypts it, checks that the ciphertext was honestly formed, and returns either the real shared secret or a pseudorandom fallback.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Key generation expands a compact seed into the public matrix A, samples small secret and noise polynomials, computes the public vector, and stores the secret material needed for decapsulation. The polynomials live modulo 3329, and NTT arithmetic makes their multiplication fast.',
        'Encapsulation hashes fresh randomness with the public key hash, encrypts a 32-byte message into a compressed ciphertext, and outputs a 32-byte shared secret. Decapsulation decrypts a candidate message, re-encrypts it, compares ciphertexts in constant time, and uses constant-time selection for the output secret.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness comes from bounded noise. Honest encryption adds noise and compression error, but the total error stays small enough that the private key recovers the encoded message on valid ciphertexts.',
        'Security comes from the Module Learning With Errors problem and the Fujisaki-Okamoto transform. MLWE makes the public equations hard to invert, while the re-encryption check prevents chosen-ciphertext attacks from turning decapsulation into an oracle.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The main cost behaves with parameter k. ML-KEM-512 uses k = 2 with 800-byte public keys and 768-byte ciphertexts, ML-KEM-768 uses k = 3 with 1184-byte public keys and 1088-byte ciphertexts, and ML-KEM-1024 uses k = 4 with 1568-byte public keys and 1568-byte ciphertexts.',
        'Doubling the number of handshakes roughly doubles the bytes sent for key establishment, because each handshake carries a fresh public key or ciphertext. CPU cost is dominated by polynomial transforms and hashes, while network cost is dominated by the larger key-share payload.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'ML-KEM fits TLS, VPNs, messaging session setup, key wrapping, and service-to-service channels where two parties need a fresh symmetric secret. The access pattern is short-lived establishment followed by ordinary symmetric encryption.',
        'Hybrid deployment is common during migration: combine a classical secret with an ML-KEM secret in the key schedule. That lets the classical path protect against unexpected lattice weakness while ML-KEM protects against future quantum attacks on discrete logs.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'ML-KEM fails if decapsulation leaks which branch it took. Timing, cache behavior, error messages, power traces, or early exits can reveal ciphertext validity and break the chosen-ciphertext security model.',
        'It is also the wrong primitive for signatures, password hashing, or bulk encryption. The output is a shared secret for a key schedule; files and records should still be protected with symmetric authenticated encryption.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Take ML-KEM-768 in a simplified handshake. The client sends an 1184-byte public key, the server returns a 1088-byte ciphertext, and both sides derive a 32-byte shared secret for the traffic-key schedule.',
        'Compared with two 32-byte X25519 shares, the key-establishment payload grows from 64 bytes to 2272 bytes, or 35.5 times more data. If a service handles 10,000 new handshakes per second, that extra 2208 bytes per handshake is about 22.08 MB per second of additional wire traffic before protocol framing.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: NIST FIPS 203 for ML-KEM, the CRYSTALS-Kyber specification, and the Kyber implementation notes from the pq-crystals project. Use the standard for exact algorithms, byte lengths, parameter sets, and failure behavior.',
        'Study next: NTT polynomial multiplication, modular arithmetic, hash-based key derivation, constant-time comparison, TLS 1.3 key scheduling, ML-DSA for signatures, and hybrid post-quantum migration design.',
      ],
    },
  ],
};
