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
        "Read the animation as the execution trace for ML-KEM Kyber Module-Lattice KEM Case Study. A post-quantum key-establishment case study: module lattices, public matrix seeds, small-noise vectors, NTT polynomial products, encapsulation, decapsulation, ciphertext checks, and parameter-set ledgers..",
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        `A network protocol needs a way for two parties to create the same secret while every byte on the wire is visible to an observer. Classical systems usually solve that with Diffie-Hellman over finite fields or elliptic curves. Those systems are compact and fast, but their security depends on algebraic problems that a large enough fault-tolerant quantum computer would threaten. Post-quantum key establishment asks for a replacement whose public information can be recorded today without becoming easy to break later.`,
        `ML-KEM is the standardized module-lattice key-encapsulation mechanism derived from CRYSTALS-Kyber. It is a KEM, not a bulk encryption mode. One party publishes a public key. Another party uses that public key to encapsulate a fresh shared secret into a ciphertext. The private-key holder decapsulates that ciphertext and derives the same shared secret. A protocol then feeds the secret into key derivation, symmetric encryption, and authentication.`,
        `That division of labor matters. ML-KEM does not sign certificates, encrypt files directly, or replace AES. It fills the key-establishment slot in a larger protocol. The surrounding protocol is still responsible for authenticating identities, binding transcript context, deriving traffic keys, rotating secrets, and deciding whether to combine ML-KEM with a classical exchange during migration.`,
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        `The naive migration story is to find an elliptic-curve Diffie-Hellman call and swap in a post-quantum function. That misses the shape of the primitive. ECDH computes a shared value from two long-term or ephemeral public keys. A KEM has key generation, encapsulation, decapsulation, ciphertext transport, and carefully specified failure behavior. The wire format and the API contract are different.`,
        `A second tempting answer is to use a general public-key encryption scheme and encrypt a random session key. Modern KEMs are more disciplined than that. They specify how randomness is derived, how ciphertexts are checked, how shared secrets are bound to the ciphertext and public key, and what must happen when decapsulation receives malformed input. The invalid-ciphertext path is part of the cryptographic design, not an error-handling afterthought.`,
        `The deployment problem is also larger than replacing math. Public keys and ciphertexts are bigger than classical elliptic-curve values. Handshakes may fragment. Certificate chains, middleboxes, hardware accelerators, FIPS-validated modules, telemetry, and retry logic all need to tolerate the new byte sizes and failure modes. A correct primitive can still be deployed incorrectly if the system around it assumes classical sizes and classical API behavior.`,
      ],
    },
    {
      heading: 'The KEM contract',
      paragraphs: [
        `Key generation produces a public key and a secret key. The public key is distributed to peers. The secret key stays private and contains the material needed to decapsulate ciphertexts safely. Encapsulation takes the public key and fresh randomness, outputs a ciphertext, and returns a shared secret to the sender. Decapsulation takes the secret key and ciphertext, then returns the shared secret that the sender should have computed.`,
        `The ciphertext is not the final secret. It is the transport object that lets the private-key holder derive the secret. The shared secret should be treated as input to a key schedule, not as a raw traffic key dropped directly into an encryption mode. Production protocols also bind the KEM result to transcript hashes, algorithm identifiers, peer authentication, and sometimes a classical secret in hybrid deployments.`,
        `This contract is useful because it isolates a hard public-key problem from the rest of the secure channel. Once both sides have the same high-entropy secret, well-understood symmetric tools can protect bulk data. That keeps the expensive post-quantum operation at the handshake boundary instead of using lattice operations for every application byte.`,
      ],
    },
    {
      heading: 'The module-lattice objects',
      paragraphs: [
        `ML-KEM works over vectors of polynomials with coefficients modulo an integer. The parameter k controls the module dimension: larger parameter sets use larger vectors and provide higher security margins at higher byte and CPU cost. A public matrix A is expanded from a compact seed. Secret vectors and error vectors are sampled with small coefficients. The public key contains structured data derived from multiplying A by the secret and adding small noise.`,
        `A useful mental model is noisy linear algebra. The public information exposes a relationship that is easy to compute when the small secret is known, but believed hard to invert without it. The noise is not accidental; it is what turns a simple linear equation into a lattice problem. The matrix is public, the vector t is public, and the secret and noise stay private.`,
        `The arithmetic is not implemented as slow generic matrix multiplication. The polynomials have fixed degree and fixed moduli, so implementations use number-theoretic transforms, precomputed constants, compact packing, and constant-time operations. The phrase module lattice names the mathematical structure, but the engineering artifact is a byte-stable pipeline of sampling, polynomial multiplication, compression, hashing, and verification.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `During encapsulation, the sender derives coins, computes polynomial-vector products against the public key, compresses intermediate values, and emits a ciphertext. The sender also derives a shared secret from the encapsulation process. During decapsulation, the receiver uses the secret key to reconstruct the message encoded by the ciphertext, recomputes what the ciphertext should have been, and checks whether the received bytes match the expected result.`,
        `That recomputation step is central. It turns a public-key encryption style construction into a chosen-ciphertext secure KEM. If the ciphertext is valid, decapsulation returns the same shared secret as encapsulation. If the ciphertext is invalid, decapsulation must return a safe fallback value derived in a way that does not reveal the validity decision through timing, error codes, logs, or network behavior.`,
        `Compression is part of the design because wire size matters. ML-KEM ciphertexts and public keys are large enough that every byte affects handshakes, packets, and certificates. Compression also means implementations must be exact. Rounding rules, packing order, endianness, and parameter identifiers are interoperability details, not cosmetic serialization choices.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `The security claim rests on the hardness of recovering small secrets from noisy module-lattice structure. Legitimate parties know secret material that lets them reconcile the encapsulated value. An attacker sees the public key, ciphertext, and algorithm identifiers, but should not be able to recover the same shared secret or distinguish it from random under the intended assumptions.`,
        `Lexically, the scheme looks like a sequence of hashes and polynomial operations. Conceptually, it is combining two ideas. First, module-lattice algebra gives a compact, fast public-key foundation believed to resist known quantum attacks better than the classical groups used by ECDH. Second, the KEM transform wraps that foundation so malformed ciphertexts do not become a decryption oracle.`,
        `The important invariant is not merely that honest encapsulation and honest decapsulation agree. The stronger invariant is that attackers cannot use the decapsulation endpoint to learn which malformed inputs were close to valid, which branch the implementation took, or what secret-dependent arithmetic looked like inside the branch. Constant-time behavior and uniform failure handling are therefore part of the reason it works in real systems.`,
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        `Imagine a client connecting to a server that has published an ML-KEM-768 public key. The client samples encapsulation randomness, uses the public key to compute a ciphertext, and immediately derives a shared secret. The client sends the ciphertext in the handshake. The server uses its secret key to decapsulate the ciphertext and derives the same shared secret. Both sides feed that secret, plus the handshake transcript, into a key schedule.`,
        `Now suppose a network attacker changes one byte of the ciphertext. The server should not throw a visibly different protocol error that says invalid ML-KEM ciphertext. It should perform the specified decapsulation path, use the safe fallback behavior when verification fails, and let the surrounding protocol fail in a way that does not reveal secret-dependent details. From the outside, invalid input must not become an oracle.`,
        `In a hybrid handshake, the same example includes a classical exchange as well. The key schedule combines the classical shared secret and the ML-KEM shared secret. That does not make either primitive magic, but it gives migration deployments defense in depth while post-quantum implementations, certificates, accelerators, and operational playbooks mature.`,
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        `Use a vetted implementation rather than translating formulas by hand. The difficult parts are not only the polynomial multiplications. Sampling distributions, rejection behavior, NTT constants, compression, packing, hash domain separation, secret-key layout, and constant-time comparison all need to match the standard exactly. A tiny serialization mismatch can produce rare interop failures that look like network flakiness.`,
        `Treat parameter selection as an explicit engineering decision. ML-KEM-512, ML-KEM-768, and ML-KEM-1024 trade security level against size and cost. A service should know which parameter appears in each protocol surface, how it is negotiated, how downgrade resistance is enforced, and how metrics distinguish parameter mismatch from malformed input and from ordinary transport failure.`,
        `Keep secrets out of branch conditions, cache-dependent table lookups, panic messages, structured logs, and tracing fields. Decapsulation should have one observable shape. Invalid ciphertexts should be tested intentionally, including random bytes, truncated ciphertexts, wrong parameter lengths, corrupted public keys, and repeated values. The test oracle should check both correctness and the absence of distinct failure surfaces exposed to remote peers.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `A production rollout should measure bytes on the wire, CPU time, memory allocation, certificate size, handshake fragmentation, retry rate, and middlebox behavior. Post-quantum migration is partly a cryptography change and partly a systems change. The new keys and ciphertexts can interact with old packet assumptions, old load balancers, old observability limits, and old latency budgets.`,
        `A useful deployment ledger records the parameter set, implementation version, FIPS or library status, public-key fingerprint, ciphertext length, negotiated algorithm identifier, hybrid composition rule, and invalid-ciphertext policy. That ledger is not paperwork. It is how an operator answers whether two endpoints are actually using the expected primitive and whether a reported failure is cryptographic, transport-level, or configuration-level.`,
        `Hybrid mode should be designed deliberately. Combining a classical and post-quantum secret is not the same as running two independent handshakes and hoping they compose. The transcript, algorithm identifiers, public keys, ciphertext, and both shared secrets must be bound by the protocol\'s key schedule so downgrade and substitution attacks do not move the connection onto weaker assumptions.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `The first failure mode is conceptual: using ML-KEM as if it were encryption, a signature scheme, a password hash, or a symmetric cipher. It is a key-establishment primitive. Bulk data still belongs to symmetric encryption. Authentication still needs certificates, signatures, or another identity mechanism. Storage encryption still needs a key-management design around the secret.`,
        `The second failure mode is leaky decapsulation. Different timing, different alert codes, different retry behavior, different log lines, or different cleanup paths for invalid ciphertexts can expose information the construction is supposed to hide. This is why a constant-time comparison helper is not enough by itself; the whole endpoint behavior must avoid validity-dependent signals.`,
        `The third failure mode is deployment drift. One side upgrades parameter sets before the other. A library changes packing details. A certificate chain grows past an old limit. A benchmark reports arithmetic throughput but ignores fragmentation and handshake retries. A test suite covers only happy-path ciphertexts. These are ordinary systems bugs, but in a KEM rollout they can become security and availability incidents.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `ML-KEM matters most at protocol boundaries where long-lived confidentiality is at stake. TLS-style handshakes, VPNs, service mesh channels, device provisioning, and encrypted messaging all need a plan for recorded traffic that may be attacked later. Even when a system is not ready for post-quantum-only operation, hybrid key establishment can let teams exercise the code paths and operational assumptions.`,
        `It also matters as a case study in algorithm deployment. The mathematical object is a module-lattice KEM, but the shipped system is a negotiation rule, a byte format, a constant-time implementation, a telemetry story, a parameter policy, and a recovery plan for bad releases. The security boundary is the whole path from public key generation to shared-secret use.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Primary sources to keep nearby are NIST FIPS 203 at https://csrc.nist.gov/pubs/fips/203/final and the CRYSTALS-Kyber specification at https://pq-crystals.org/kyber/data/kyber-specification-round3-20210804.pdf. Read them for exact parameter definitions, byte formats, and security framing rather than treating this article as an implementation spec.`,
        `Within this curriculum, study NTT Polynomial Multiplication to understand the fast polynomial products, Hash Functions and Key Derivation to understand how shared secrets become traffic keys, Constant-Time Programming to reason about decapsulation behavior, ML-DSA for the lattice signature counterpart, SLH-DSA for a hash-based signature alternative, and Shamir Secret Sharing for a very different way to split and reconstruct secrets.`,
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
      heading: 'Cost and behavior',
      paragraphs: [
        "Cost is both asymptotic and practical.",
        "State what grows, what stays flat, and what setup cost dominates before the method becomes useful.",
        "If possible, convert cost into an intuition: doubling, halving, or crossing a fixed bound.",
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

      {
        heading: 'Learning map',
        paragraphs: [
          'Before this topic, unlock all prerequisites and define the required preconditions.',
          'After this topic, trace where this idea appears in one larger path on this site.',
          'Use unlock relationships to keep one path and one checkpoint per review cycle.',
        ],
      },

      {
        heading: 'Micro checks',
        paragraphs: [
          {
            type: 'bullets',
            items: [
              'Can you state one invariant in one sentence?',
              'Can you prove one transition with pre and post state?',
              'Can you name one hidden edge case in one line?',
              'Can you transfer this mechanism to a neighboring domain?',
            ],
          },
        ],
      },

      {
        heading: 'Try this now',
        paragraphs: [
          'Build one input manually and predict every step before running the animation.',
          'If your predicted final state matches the animation for ml-kem-kyber-module-lattice-kem-case-study, continue to the next topic in the same track.'
  ],
      },
],
};
