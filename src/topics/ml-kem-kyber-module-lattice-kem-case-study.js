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
        'The animation has two views. "KEM flow" traces the three-operation lifecycle -- key generation, encapsulation, decapsulation -- showing how a public key becomes a shared secret through a ciphertext transport object. "Lattice state" shows the algebraic objects inside the scheme: the public matrix A, the secret vector s, the noise vector e, the public vector t, and how they relate through NTT-accelerated polynomial multiplication.',
        {
          type: 'bullets',
          items: [
            'Active (highlighted) nodes are the current operation: which key material is being generated, which polynomial product is being computed, or which ciphertext check is running.',
            'Compare nodes show the hidden counterpart -- secret vectors and noise that an attacker cannot observe but that determine whether decapsulation succeeds.',
            'Found nodes are confirmed outcomes: the shared secret both parties derive, or a verified parameter-set property.',
          ],
        },
        'In the matrix views, rows are ML-KEM objects or parameter sets, and columns are properties (shape, visibility, cost, use case). Watch the visibility column: the entire security argument depends on which objects are public and which stay private.',
        {type:'callout', text:'ML-KEM turns key exchange into a public ciphertext transport while keeping the shared secret inside a checked module-lattice computation.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/9/97/Equilateral_Triangle_Lattice.svg', alt:'Equilateral triangular lattice points arranged in a regular grid.', caption:'Equilateral triangle lattice, a simple visual proxy for module-lattice cryptography. Image by Jim.belk, public domain, Wikimedia Commons.'},
        {
          type: 'note',
          text: 'The animation uses symbolic labels, not real polynomial coefficients. Real ML-KEM operates over degree-255 polynomials with coefficients modulo 3329. The structure shown -- seed expansion, NTT multiply, compress, check -- matches the actual pipeline in FIPS 203.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {
          type: 'quote',
          text: 'An adversary that records encrypted communications today could decrypt them once a cryptanalytically relevant quantum computer becomes available. This "harvest now, decrypt later" threat makes migration to post-quantum cryptography urgent even before large quantum computers exist.',
          attribution: 'NIST IR 8413, "Status Report on the Third Round of the NIST Post-Quantum Cryptography Standardization Process" (2022)',
        },
        'Every TLS handshake, VPN tunnel, and encrypted messaging session starts the same way: two parties who share no secret must create one while every byte between them is visible. Classical systems solve this with Diffie-Hellman over elliptic curves. An X25519 key exchange uses 32-byte public keys, runs in microseconds, and rests on the hardness of the elliptic-curve discrete logarithm problem. That problem is believed to be easy for a sufficiently large fault-tolerant quantum computer running Shor\'s algorithm.',
        'The threat is not that quantum computers exist today. The threat is that ciphertexts recorded today can be stored cheaply and decrypted later. Intelligence agencies, nation-states, and well-funded adversaries can archive encrypted traffic for years. If a quantum computer breaks ECDH in 2035, every session key established by ECDH before 2035 becomes recoverable. Classified government data, medical records, financial transactions, and source-protection communications all have secrecy requirements that outlast the likely arrival of cryptanalytically relevant quantum hardware.',
        {
          type: 'table',
          headers: ['Classical primitive', 'Quantum threat', 'Post-quantum replacement'],
          rows: [
            ['ECDH key exchange', 'Shor\'s algorithm breaks discrete log', 'ML-KEM (module-lattice KEM)'],
            ['RSA key exchange', 'Shor\'s algorithm factors the modulus', 'ML-KEM (module-lattice KEM)'],
            ['ECDSA signatures', 'Shor\'s algorithm breaks discrete log', 'ML-DSA (module-lattice signatures)'],
            ['RSA signatures', 'Shor\'s algorithm factors the modulus', 'SLH-DSA (hash-based signatures)'],
            ['AES-256', 'Grover halves key strength to 128-bit', 'AES-256 still adequate'],
            ['SHA-256', 'Grover halves preimage resistance', 'SHA-256 still adequate'],
          ],
        },
        'ML-KEM (FIPS 203) is the first post-quantum key-encapsulation mechanism standardized by NIST. It descends from CRYSTALS-Kyber, the winner of a seven-year public competition that began with 69 submissions in 2017 and narrowed to one KEM finalist by 2022. ML-KEM is not a general-purpose encryption scheme. It is a KEM: one party publishes a public key, another encapsulates a fresh shared secret into a ciphertext, and the private-key holder decapsulates the same shared secret. That secret then feeds a symmetric key schedule. ML-KEM replaces the key-agreement slot, not the bulk encryption slot.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first instinct is to treat post-quantum migration as a function swap: find every call to X25519 or ECDH, replace it with a post-quantum equivalent, and keep everything else the same. This works conceptually because the goal is identical -- establish a shared secret. And there is a deeper reason teams reach for it: ECDH and KEMs serve the same role in a protocol, so the surrounding key schedule, authentication, and record layer should not need to change.',
        {
          type: 'diagram',
          text: 'Classical handshake (simplified TLS 1.3):\n\n  Client                          Server\n    |-- ClientHello + ECDH share -->|\n    |<-- ServerHello + ECDH share --|\n    |   (both derive shared secret  |\n    |    from two public values)    |\n\nPost-quantum swap (naive):\n\n  Client                          Server\n    |-- ClientHello + ML-KEM pk --->|\n    |<-- ServerHello + ML-KEM ct ---|\n    |   (server encapsulates;       |\n    |    client decapsulates)       |\n\nSame slot, different API shape, much larger bytes.',
          label: 'The key-establishment slot is the same; the API and sizes are not',
        },
        'The swap analogy breaks in three places. First, ECDH is symmetric -- both sides contribute a public share and compute the same secret. A KEM is asymmetric -- one side publishes a key, the other encapsulates. The protocol flow changes. Second, the byte sizes change dramatically: an X25519 public key is 32 bytes; an ML-KEM-768 public key is 1,184 bytes. Ciphertexts grow similarly. Third, a KEM has a formal ciphertext-validity check with specified failure behavior that ECDH does not need. These differences cascade through packet fragmentation, certificate chains, middlebox tolerance, and hardware acceleration.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is not the math. Lattice-based key exchange is well-understood and fast on modern CPUs. The wall is the compound effect of larger objects on every system that touches the handshake.',
        {
          type: 'table',
          headers: ['Property', 'X25519 (classical)', 'ML-KEM-768 (post-quantum)', 'Impact'],
          rows: [
            ['Public key', '32 bytes', '1,184 bytes', '37x larger; may exceed single UDP datagram'],
            ['Ciphertext / share', '32 bytes', '1,088 bytes', '34x larger; fragments TLS ClientHello'],
            ['Shared secret', '32 bytes', '32 bytes', 'Same -- downstream symmetric crypto unchanged'],
            ['Key generation', '~50 us', '~30 us', 'ML-KEM is faster on modern x86 with AVX2'],
            ['Encapsulation', 'N/A (DH has no encaps)', '~40 us', 'New operation; adds one hash + NTT pass'],
            ['Decapsulation', 'N/A (DH compute)', '~45 us', 'Includes mandatory re-encryption check'],
          ],
        },
        'A TLS 1.3 ClientHello with an X25519 key share fits comfortably in a single TCP segment. Add an ML-KEM-768 key share and the ClientHello can exceed 1,200 bytes, potentially requiring TCP fragmentation or triggering middlebox issues. Some enterprise firewalls, load balancers, and deep-packet-inspection appliances have hardcoded limits on ClientHello size that were set when 32-byte key shares were the norm.',
        'Certificate chains compound the problem. A server certificate chain with ML-DSA signatures (the lattice-based signature counterpart) adds thousands of bytes per signature. A chain of three certificates can push the server response past the initial congestion window, adding a round trip. Google\'s ALTS post-quantum experiment measured a 70% increase in handshake latency from the larger certificates alone, even though the raw cryptographic operations were fast.',
        {
          type: 'note',
          text: 'The NIST standardization resolved the mathematical question. The deployment question -- how real networks, real middleboxes, real certificate chains, and real hardware accelerators handle the larger objects -- is still being resolved through production experiments at Google, Cloudflare, AWS, and Signal.',
        },
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'ML-KEM hides a small secret inside a noisy linear equation over a structured algebraic ring, then uses a re-encryption check to make the construction safe against active attackers.',
        {
          type: 'diagram',
          text: 'The algebraic core:\n\n  Key generation:\n    seed  --> expand to public matrix A  (k x k polynomials mod q)\n    sample secret vector s               (k polynomials, small coefficients)\n    sample noise vector e                (k polynomials, small coefficients)\n    compute t = A * s + e                (public vector, looks random)\n    public key  = (seed for A, t)\n    secret key  = s  (plus cached values for decapsulation)\n\n  Security assumption:\n    Given A and t = A*s + e, recovering s is hard.\n    This is the Module Learning With Errors (MLWE) problem.\n    Without the noise e, inverting A*s is ordinary linear algebra.\n    The noise turns it into a lattice problem believed resistant\n    to both classical and quantum algorithms.',
          label: 'Noise is the mechanism, not an accident',
        },
        'The polynomials live in the ring R_q = Z_q[X]/(X^256 + 1), where q = 3329. Each polynomial has 256 coefficients, each reduced modulo 3329. The parameter k determines the module dimension: ML-KEM-512 uses k=2, ML-KEM-768 uses k=3, ML-KEM-1024 uses k=4. Larger k means more polynomials in each vector, larger keys, and a wider security margin.',
        {
          type: 'code',
          language: 'text',
          text: '# The ring and its arithmetic\n#\n# Ring:  R_q = Z_3329[X] / (X^256 + 1)\n# Element: a polynomial of degree <= 255\n#   Example: 1742*X^255 + 892*X^254 + ... + 3104*X + 417\n#\n# Addition: coefficient-wise mod 3329\n#   (a0 + a1*X + ...) + (b0 + b1*X + ...)\n#   = ((a0+b0) mod 3329) + ((a1+b1) mod 3329)*X + ...\n#\n# Multiplication: polynomial product mod (X^256 + 1) mod 3329\n#   Naive: O(256^2) = 65,536 multiplications\n#   NTT:   O(256 * log 256) = 2,048 multiplications\n#   The NTT exploits the factorization of X^256 + 1 over Z_3329\n#   because 3329 = 1 mod 512, so primitive 512th roots of unity exist.',
        },
        'The re-encryption check is what turns a public-key encryption scheme into a chosen-ciphertext-secure KEM. During decapsulation, the receiver does not simply decrypt and return the result. It decrypts the message m\', re-runs the entire encapsulation using m\' as input, and checks whether the re-computed ciphertext matches the received ciphertext byte-for-byte. If yes, the shared secret is derived from m\'. If no, the shared secret is derived from a pseudorandom fallback that depends on the secret key and the ciphertext but does not reveal which branch was taken. This is the Fujisaki-Okamoto (FO) transform.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The full ML-KEM pipeline has three algorithms: KeyGen, Encaps, and Decaps. Each is a sequence of hashing, sampling, NTT polynomial arithmetic, compression, and byte packing.',
        {
          type: 'diagram',
          text: 'ML-KEM.KeyGen():\n  1. d <-- random 32 bytes\n  2. (rho, sigma) = G(d)           // G = SHA3-512; rho seeds A, sigma seeds s,e\n  3. A = ExpandA(rho)              // k x k matrix of polynomials from SHAKE-128\n  4. s = SampleCBD(sigma, 0..k-1)  // k secret polynomials, small coefficients\n  5. e = SampleCBD(sigma, k..2k-1) // k noise polynomials, small coefficients\n  6. s_hat = NTT(s)                // transform to NTT domain for fast multiply\n  7. t_hat = A * s_hat + NTT(e)    // public vector in NTT domain\n  8. ek = Encode(t_hat) || rho     // encapsulation key (public)\n  9. dk = Encode(s_hat) || ek || H(ek) || z   // decapsulation key (private)\n     where z = random 32 bytes (implicit rejection seed)\n\nML-KEM.Encaps(ek):\n  1. m <-- random 32 bytes\n  2. (K, r) = G(m || H(ek))        // K = shared secret, r = encaps randomness\n  3. ct = InnerEncrypt(ek, m, r)   // polynomial products + compression\n  4. return (ct, K)\n\nML-KEM.Decaps(dk, ct):\n  1. m\' = InnerDecrypt(dk, ct)     // recover candidate message\n  2. (K\', r\') = G(m\' || H(ek))    // re-derive what K and r should be\n  3. ct\' = InnerEncrypt(ek, m\', r\')// re-encrypt to check\n  4. if ct == ct\':  return K\'      // valid ciphertext\n     else:          return KDF(z || ct)  // implicit rejection (constant-time)',
          label: 'The re-encryption check (step 3-4 of Decaps) is the FO transform',
        },
        {
          type: 'note',
          text: 'The implicit rejection in step 4 is critical. Earlier Kyber drafts used explicit rejection (return an error). ML-KEM uses implicit rejection: derive a pseudorandom secret from the rejection seed z and the ciphertext. The caller never learns whether decapsulation succeeded or failed. The surrounding protocol simply fails to derive matching traffic keys, which is indistinguishable from a network error.',
        },
        'Compression rounds polynomial coefficients to fewer bits before packing into the ciphertext. ML-KEM-768 compresses the vector component u to 10 bits per coefficient (from 12) and the scalar component v to 4 bits (from 12). This lossy step reduces ciphertext size but introduces rounding noise. Correct decryption tolerates this noise because the secret and error vectors have small coefficients -- the rounding error plus the original noise stays below the decryption threshold.',
        {
          type: 'code',
          language: 'javascript',
          text: '// Compression: round a coefficient from mod q to d bits\n// Compress_d(x) = round(2^d / q * x) mod 2^d\n// Decompress_d(y) = round(q / 2^d * y)\n//\n// Example with q = 3329, d = 10:\n//   Compress_10(1500) = round(1024/3329 * 1500) = round(461.1) = 461\n//   Decompress_10(461) = round(3329/1024 * 461) = round(1498.5) = 1499\n//   Error: |1500 - 1499| = 1  (tiny; decryption tolerates this)\n//\n// The rounding is exact in the spec:\nfunction compress(x, d, q) {\n  return Math.floor((((x << d) + (q >> 1)) / q)) & ((1 << d) - 1);\n}\nfunction decompress(y, d, q) {\n  return Math.floor(((y * q) + (1 << (d - 1))) >> d);\n}',
        },
        'The NTT (Number Theoretic Transform) makes polynomial multiplication fast. Multiplying two degree-255 polynomials naively takes 65,536 coefficient multiplications. The NTT converts each polynomial into 128 degree-1 factors, multiplies them pointwise (256 multiplications), and converts back. The NTT exists because q = 3329 has a primitive 256th root of unity (zeta = 17), and X^256 + 1 splits completely over Z_3329. All arithmetic is integer modular arithmetic -- no floating point, no rounding, no numerical instability.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The security of ML-KEM rests on two foundations: the hardness of the Module Learning With Errors (MLWE) problem, and the soundness of the Fujisaki-Okamoto transform.',
        {
          type: 'table',
          headers: ['Security property', 'What provides it', 'What breaks it'],
          rows: [
            ['Key indistinguishability', 'MLWE hardness: t = As + e looks random', 'Solving MLWE (lattice reduction, quantum attacks on lattices)'],
            ['Ciphertext indistinguishability', 'MLWE hardness: ciphertext components look random', 'Same as above'],
            ['Chosen-ciphertext security (IND-CCA2)', 'FO transform: re-encrypt and check', 'Side channels leaking the validity decision'],
            ['Implicit rejection', 'Pseudorandom fallback from z || ct', 'Timing or error-code differences between valid/invalid paths'],
          ],
        },
        'The MLWE problem asks: given A and t, distinguish whether t = As + e (for small s, e) or t is uniformly random. The best known classical algorithms for this are lattice reduction methods (BKZ, sieving) whose cost grows exponentially with the lattice dimension. The best known quantum algorithms (quantum BKZ variants) offer at most a polynomial speedup over classical lattice reduction -- unlike Shor\'s algorithm, which gives an exponential speedup against factoring and discrete log. This is why lattice problems are believed to resist quantum attack.',
        {
          type: 'quote',
          text: 'The most efficient known quantum attacks against lattice problems are based on quantum variants of lattice sieving, which offer at most a quadratic speedup. Unlike the situation with RSA and ECDH, no exponential quantum speedup is known for lattice problems.',
          attribution: 'NIST FIPS 203, Section 1.1, "Security Basis" (2024)',
        },
        'The FO transform adds active security. Without it, a CPA-secure encryption scheme allows an attacker to submit crafted ciphertexts and learn information from the decryption result. The re-encryption check closes this attack: the decapsulator never reveals the decrypted message directly. It either confirms the ciphertext was honestly constructed (by deriving the same shared secret) or falls back to a pseudorandom value. The attacker cannot distinguish these two outcomes by observing the protocol.',
        'The critical implementation invariant is constant-time execution. The comparison between ct and ct\' must not leak through timing. The branch between the valid and invalid paths must not leak through cache behavior, power consumption, or error messages. The implicit rejection secret must be computed even when the ciphertext is valid, so that both paths take the same time. Every real-world ML-KEM vulnerability found so far has been a side-channel leak in this comparison, not a break of the underlying lattice problem.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'table',
          headers: ['Parameter set', 'Security level', 'k', 'Public key (bytes)', 'Ciphertext (bytes)', 'Shared secret (bytes)', 'KeyGen (cycles)', 'Encaps (cycles)', 'Decaps (cycles)'],
          rows: [
            ['ML-KEM-512', 'NIST Level 1 (~AES-128)', '2', '800', '768', '32', '~28K', '~37K', '~40K'],
            ['ML-KEM-768', 'NIST Level 3 (~AES-192)', '3', '1,184', '1,088', '32', '~43K', '~55K', '~60K'],
            ['ML-KEM-1024', 'NIST Level 5 (~AES-256)', '4', '1,568', '1,568', '32', '~62K', '~78K', '~85K'],
          ],
        },
        {
          type: 'note',
          text: 'Cycle counts are approximate, measured on x86-64 with AVX2 using the pqcrystals reference implementation. ARM and RISC-V implementations vary. The shared secret is always 32 bytes regardless of parameter set -- only the public key and ciphertext grow with k.',
        },
        'All three ML-KEM operations run in constant time with respect to the secret key. There is no input-dependent branching, no early exit, no variable-length processing. The cost is fixed per parameter set: KeyGen always does k^2 NTT multiplications to compute A*s, Encaps does the same plus compression, and Decaps does the full re-encryption regardless of whether the ciphertext is valid.',
        'Stepping from ML-KEM-512 to ML-KEM-768 increases key size by 48% and ciphertext size by 42%. Stepping from 768 to 1024 increases key size by 32% and ciphertext by 44%. The growth is roughly linear in k because each step adds one row and column to the module matrix A and one polynomial to each vector. Cycle counts grow similarly -- each step adds one NTT-domain polynomial multiplication per matrix entry.',
        {
          type: 'diagram',
          text: 'Size comparison with classical key exchange:\n\n  X25519:      pk = 32 B,  share = 32 B,  total = 64 B\n  ML-KEM-768:  pk = 1184 B, ct = 1088 B,  total = 2272 B\n  Ratio: 35.5x more bytes on the wire\n\n  But: ML-KEM-768 KeyGen is ~43K cycles (~14 us at 3 GHz)\n       X25519 scalar mult is ~120K cycles (~40 us at 3 GHz)\n  ML-KEM is 2.8x faster in CPU time despite 35x more bytes.\n\n  The bottleneck is bandwidth, not computation.',
          label: 'ML-KEM trades larger keys for faster arithmetic',
        },
        'In a TLS 1.3 handshake, the additional bytes from ML-KEM-768 add roughly 2.3 KB over X25519. On a fast network, this adds less than 1 ms of latency. On a constrained link (IoT, satellite, cellular edge), fragmentation and retransmission can dominate. The practical cost depends on the deployment context, not just the primitive.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Trace an ML-KEM-768 handshake inside TLS 1.3 to see where every object flows.',
        {
          type: 'diagram',
          text: 'TLS 1.3 handshake with ML-KEM-768 key establishment:\n\n  Client                                    Server\n    |                                         |\n    |  1. KeyGen() --> (ek, dk)                |\n    |     ek = 1184 bytes                      |\n    |                                         |\n    |-- ClientHello --------------------------->|\n    |   supported_groups: [ML-KEM-768]         |\n    |   key_share: ek (1184 bytes)             |\n    |   (ClientHello total: ~1300 bytes)       |\n    |                                         |\n    |                    2. Encaps(ek) --> (ct, K)\n    |                       ct = 1088 bytes    |\n    |                       K = 32 bytes       |\n    |                                         |\n    |<-- ServerHello --------------------------|\n    |   key_share: ct (1088 bytes)             |\n    |   {EncryptedExtensions}                  |\n    |   {Certificate}                          |\n    |   {CertificateVerify}                    |\n    |   {Finished}                             |\n    |                                         |\n    |  3. Decaps(dk, ct) --> K                 |\n    |     K = same 32 bytes                    |\n    |                                         |\n    |  4. Both derive traffic keys from K      |\n    |     + handshake transcript hash          |\n    |                                         |\n    |-- {Finished} --------------------------->|\n    |                                         |\n    |<========= encrypted application data ===>|',
          label: 'The KEM replaces ECDH key shares; everything else in TLS 1.3 stays the same',
        },
        'Now consider the adversarial case. An attacker intercepts the ciphertext ct and flips one byte before forwarding it to the client. The client runs Decaps(dk, ct_corrupted). Internally, Decaps decrypts to get m\', re-encrypts to get ct\', and compares ct\' against ct_corrupted. The comparison fails. Decaps returns KDF(z || ct_corrupted) -- a pseudorandom 32-byte value that has no relation to the real shared secret K. The client derives traffic keys from this wrong secret. The TLS Finished MAC check fails. The connection terminates with the same generic alert as any other handshake failure. The attacker learns nothing about the secret key dk, the real shared secret K, or whether the decapsulation check was the point of failure.',
        {
          type: 'code',
          language: 'javascript',
          text: '// What implicit rejection looks like in practice\nfunction decaps(dk, ct) {\n  const m_prime = innerDecrypt(dk.s_hat, ct);\n  const [K_prime, r_prime] = G(m_prime, dk.h_ek);\n  const ct_prime = innerEncrypt(dk.ek, m_prime, r_prime);\n\n  // Constant-time comparison: always compute BOTH results\n  const K_reject = KDF(dk.z, ct);  // always computed\n  const valid = constantTimeEquals(ct, ct_prime);\n\n  // Constant-time select: no branch, no timing difference\n  return constantTimeSelect(valid, K_prime, K_reject);\n}',
        },
        {
          type: 'note',
          text: 'The hybrid variant (e.g., X25519MLKEM768 in Chrome and Firefox) runs both X25519 and ML-KEM-768 in the same handshake. The key schedule combines both shared secrets with a KDF. If either primitive is broken, the other still protects the session. This costs 32 + 1184 = 1216 bytes for the combined key share and 32 + 1088 = 1120 bytes for the combined ciphertext/share, but adds defense-in-depth during the transition period.',
        },
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Wrong primitive slot: ML-KEM is a key-establishment mechanism, not a general encryption scheme, a signature scheme, or a password hash. Using it to encrypt files directly, authenticate messages, or sign certificates is a category error. Bulk data belongs to AES-GCM or ChaCha20-Poly1305. Authentication belongs to ML-DSA, SLH-DSA, or a classical signature scheme.',
            'Side-channel leaks in decapsulation: the FO transform assumes the valid/invalid branch is invisible. Any timing difference, cache-line access pattern, power trace, or error message that distinguishes the two paths breaks IND-CCA2 security. Early implementations of Kyber had timing leaks in the polynomial comparison; the reference C implementation was patched in 2022.',
            'Middlebox ossification: enterprise firewalls, DPI appliances, and TLS-terminating load balancers that parse ClientHello may reject or truncate messages larger than historically observed sizes. Google reported that ~0.1% of connections failed when ML-KEM key shares were added to Chrome, due to middleboxes that could not handle the larger ClientHello.',
            'Certificate chain bloat: replacing ECDSA signatures with ML-DSA in the certificate chain adds ~2.4 KB per signature (ML-DSA-65 signatures are 3,309 bytes vs. 72 bytes for ECDSA P-256). A three-certificate chain can add ~7 KB, pushing the server response past the initial TCP congestion window.',
            'Parameter mismatch: if the client sends an ML-KEM-768 key share and the server expects ML-KEM-1024, the handshake fails. Unlike ECDH groups, the parameter sets are not mathematically compatible. Negotiation, downgrade resistance, and fallback behavior must be explicitly designed into the protocol.',
            'FIPS validation lag: FIPS 203 was published in August 2024, but FIPS-validated implementations require CMVP certification, which historically takes 12-24 months. During this gap, some deployments cannot use ML-KEM in FIPS mode even though the standard exists.',
          ],
        },
        {
          type: 'note',
          text: 'In February 2025, NIST published a draft revision (FIPS 203-1) with minor technical corrections to the key encapsulation and decapsulation algorithms. Implementations tracking the original FIPS 203 may need updates. This is the kind of deployment drift that operational ledgers are designed to catch.',
        },
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        {
          type: 'table',
          headers: ['Deployment', 'Primitive', 'Status', 'What it exercises'],
          rows: [
            ['Chrome + Cloudflare (2023-)', 'X25519MLKEM768 hybrid', 'Default in Chrome 131+', 'Middlebox tolerance, handshake size, latency impact'],
            ['Signal Protocol (2023-)', 'X25519 + ML-KEM-768 (PQXDH)', 'Production for new sessions', 'Long-term key storage, ratchet integration, mobile bandwidth'],
            ['AWS KMS (2024-)', 'ML-KEM-768 hybrid TLS', 'Opt-in for API endpoints', 'FIPS compliance path, HSM integration, key hierarchy'],
            ['WireGuard pq (experimental)', 'ML-KEM-768 + Classic McEliece', 'Research prototype', 'VPN tunnel overhead, MTU fragmentation, rekey frequency'],
            ['Apple iMessage PQ3 (2024-)', 'ML-KEM-768 ratchet', 'Production on iOS 17.4+', 'Per-message PQ rekeying, iCloud key backup, device migration'],
          ],
        },
        'Chrome\'s deployment is the largest-scale post-quantum experiment in history. By enabling X25519MLKEM768 as the default key share in TLS 1.3, Google forced the entire web infrastructure to handle 1.2 KB key shares. The result: the vast majority of servers and middleboxes handled it fine. The ~0.1% failure rate came from enterprise proxies and legacy load balancers, which were either updated or bypassed with a fallback to X25519.',
        'Signal\'s PQXDH protocol shows a different design point. Messaging requires long-term key bundles stored on servers. A user\'s prekey bundle now includes both an X25519 key and an ML-KEM-768 key. When Alice initiates a session with Bob, she performs both a classical and post-quantum key exchange, combines the results, and uses them to seed the Double Ratchet. Every message is protected by post-quantum key material from the initial exchange, plus periodic ML-KEM ratchet steps for forward secrecy.',
        'The common thread: every deployment uses hybrid mode. No production system relies on ML-KEM alone. The classical component provides a safety net while the post-quantum component provides harvest-resistance. This is prudent engineering during a transition period where lattice assumptions have less cryptanalytic history than discrete-log assumptions.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'table',
          headers: ['Source', 'What it covers'],
          rows: [
            ['NIST FIPS 203 (August 2024)', 'The standard: exact algorithms, parameter sets, byte formats, security levels, compliance requirements'],
            ['Avanzi et al., "CRYSTALS-Kyber" (2024), IACR ePrint 2017/634', 'The original Kyber specification with full security proofs and design rationale'],
            ['Schwabe et al., "CRYSTALS-Kyber: pqcrystals.org"', 'Reference implementation in C with AVX2 optimization; the implementation most libraries derive from'],
            ['Stebila & Mosca, "Post-quantum key exchange for the Internet and the Open Quantum Safe project" (2016)', 'Framework for hybrid key exchange and the OQS library ecosystem'],
            ['Google Security Blog, "Protecting Chrome Traffic with Hybrid Kyber KEM" (2023)', 'Production deployment data: handshake sizes, failure rates, middlebox compatibility'],
            ['Signal, "PQXDH Key Agreement Protocol" (2023)', 'How ML-KEM integrates into a messaging ratchet with forward secrecy'],
          ],
        },
        {
          type: 'bullets',
          items: [
            'Prerequisite: study NTT Polynomial Multiplication to understand why the ring arithmetic is fast, and Modular Arithmetic to understand coefficient reduction.',
            'Companion: study ML-DSA (Module-Lattice Digital Signature) for the signature counterpart -- same ring, same NTT, different construction (Fiat-Shamir with Aborts instead of FO transform).',
            'Alternative: study SLH-DSA (Stateless Hash-Based Signatures) for a post-quantum signature scheme that avoids lattice assumptions entirely, relying only on hash-function security.',
            'Symmetric layer: study Hash Functions and Key Derivation to understand SHA3, SHAKE, and the key schedule that consumes the ML-KEM shared secret.',
            'Side-channel defense: study Constant-Time Programming to understand why the decapsulation comparison must avoid branching, and how constant-time select works at the assembly level.',
            'Contrasting primitive: study Shamir Secret Sharing for a fundamentally different approach to distributing secrets, where the security comes from polynomial interpolation thresholds instead of lattice hardness.',
          ],
        },
      ],
    },
  ],
};
