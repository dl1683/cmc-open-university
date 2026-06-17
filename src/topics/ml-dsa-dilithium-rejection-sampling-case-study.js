// ML-DSA / Dilithium: module-lattice signatures with challenge hashes,
// bounded responses, rejection sampling, hints, and verification equations.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'ml-dsa-dilithium-rejection-sampling-case-study',
  title: 'ML-DSA Dilithium Rejection Sampling Case Study',
  category: 'Security',
  summary: 'A post-quantum signature case study: module-lattice public keys, message hashing, challenge polynomials, bounded responses, rejection sampling, hints, verification equations, and parameter-set rollout ledgers.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['signature flow', 'rejection gate'], defaultValue: 'signature flow' },
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

function sigGraph(title) {
  return graphState({
    nodes: [
      { id: 'msg', label: 'msg', x: 0.8, y: 3.5, note: 'hash' },
      { id: 'y', label: 'y', x: 2.4, y: 2.0, note: 'sample' },
      { id: 'w', label: 'w', x: 4.1, y: 2.0, note: 'A*y' },
      { id: 'c', label: 'c', x: 5.7, y: 3.5, note: 'challenge' },
      { id: 'z', label: 'z', x: 7.2, y: 2.0, note: 'resp' },
      { id: 'sig', label: 'sig', x: 8.6, y: 3.5, note: 'c,z,h' },
      { id: 'pk', label: 'pk', x: 2.4, y: 5.4, note: 'public' },
    ],
    edges: [
      { id: 'e-msg-c', from: 'msg', to: 'c' },
      { id: 'e-y-w', from: 'y', to: 'w' },
      { id: 'e-w-c', from: 'w', to: 'c' },
      { id: 'e-c-z', from: 'c', to: 'z' },
      { id: 'e-z-sig', from: 'z', to: 'sig' },
      { id: 'e-pk-c', from: 'pk', to: 'c' },
    ],
  }, { title });
}

function* signatureFlow() {
  yield {
    state: sigGraph('ML-DSA turns a message into a bounded proof'),
    highlight: { active: ['msg', 'y', 'w', 'c', 'z', 'e-msg-c', 'e-y-w', 'e-c-z'], found: ['sig'] },
    explanation: 'ML-DSA is a module-lattice digital signature algorithm. The signer hashes the message and commitment, derives a challenge, computes a response, and only releases it if bounds are safe.',
    invariant: 'The signature should authenticate the message without leaking the secret signing vector.',
  };

  yield {
    state: labelMatrix(
      'Signature tuple',
      [
        { id: 'c', label: 'c' },
        { id: 'z', label: 'z' },
        { id: 'h', label: 'h' },
        { id: 'ctx', label: 'ctx' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['challenge', 'hash bind'],
        ['response', 'leak'],
        ['hint', 'mismatch'],
        ['domain', 'reuse'],
      ],
    ),
    highlight: { active: ['c:role', 'z:role'], compare: ['z:risk'], found: ['ctx:role'] },
    explanation: 'The verifier checks a relation over the public key, message, challenge, response, and hint. The signer must keep response norms and sampling behavior within safe limits.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'm', label: 'M', x: 0.8, y: 3.5, note: 'message' },
        { id: 'sig', label: 'sig', x: 2.7, y: 3.5, note: 'c,z,h' },
        { id: 'pk', label: 'pk', x: 2.7, y: 5.6, note: 'public' },
        { id: 'eq', label: 'eq', x: 5.2, y: 3.5, note: 'check' },
        { id: 'ok', label: 'ok', x: 7.6, y: 2.0, note: 'accept' },
        { id: 'bad', label: 'bad', x: 7.6, y: 5.2, note: 'reject' },
      ],
      edges: [
        { id: 'e-m-eq', from: 'm', to: 'eq' },
        { id: 'e-sig-eq', from: 'sig', to: 'eq' },
        { id: 'e-pk-eq', from: 'pk', to: 'eq' },
        { id: 'e-eq-ok', from: 'eq', to: 'ok' },
        { id: 'e-eq-bad', from: 'eq', to: 'bad' },
      ],
    }, { title: 'Verification recomputes the challenge relation' }),
    highlight: { active: ['m', 'sig', 'pk', 'eq', 'e-m-eq', 'e-sig-eq', 'e-pk-eq'], found: ['ok'], compare: ['bad'] },
    explanation: 'Verification is public. It recomputes the transcript relation and rejects malformed or out-of-bound signatures.',
  };

  yield {
    state: labelMatrix(
      'Parameter ledger',
      [
        { id: 'd44', label: '44' },
        { id: 'd65', label: '65' },
        { id: 'd87', label: '87' },
        { id: 'impl', label: 'impl' },
      ],
      [
        { id: 'strength', label: 'strength' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['lower', 'fast'],
        ['mid', 'mid'],
        ['higher', 'larger'],
        ['version', 'errata'],
      ],
    ),
    highlight: { active: ['d65:strength'], compare: ['d87:cost'], found: ['impl:cost'] },
    explanation: 'FIPS 204 defines ML-DSA parameter sets. Operationally, the selected set, implementation version, context string, and errata status belong beside every signature rollout.',
  };
}

function* rejectionGate() {
  yield {
    state: labelMatrix(
      'Rejection sampling gate',
      [
        { id: 'sample', label: 'sample' },
        { id: 'bound', label: 'bound' },
        { id: 'hint', label: 'hint' },
        { id: 'retry', label: 'retry' },
      ],
      [
        { id: 'check', label: 'check' },
        { id: 'action', label: 'action' },
      ],
      [
        ['fresh y', 'derive'],
        ['norm ok?', 'keep/drop'],
        ['fits?', 'include'],
        ['fail', 'resample'],
      ],
    ),
    highlight: { active: ['bound:action', 'retry:action'], found: ['hint:action'] },
    explanation: 'Rejection sampling keeps the released response distribution from exposing the secret. The loop is part of the security design, not an incidental retry.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'attempt', min: 0, max: 8 }, y: { label: 'norm', min: 0, max: 100 } },
      series: [
        { id: 'norm', label: 'norm', points: [{ x: 1, y: 86 }, { x: 2, y: 78 }, { x: 3, y: 42 }, { x: 4, y: 60 }, { x: 5, y: 39 }] },
        { id: 'bound', label: 'cap', points: [{ x: 1, y: 65 }, { x: 2, y: 65 }, { x: 3, y: 65 }, { x: 4, y: 65 }, { x: 5, y: 65 }] },
      ],
      markers: [
        { id: 'drop1', label: 'drop', x: 1, y: 86 },
        { id: 'keep', label: 'keep', x: 3, y: 42 },
      ],
    }, { title: 'Only bounded responses are released' }),
    highlight: { active: ['norm'], compare: ['bound'], found: ['drop1', 'keep'] },
    explanation: 'A signer may need multiple attempts. What matters is that retries do not leak through timing, counters, logging, or fault behavior in a way attackers can exploit.',
  };

  yield {
    state: sigGraph('Signing links algebra to transcript hashing'),
    highlight: { active: ['msg', 'w', 'c', 'z', 'e-w-c', 'e-c-z'], compare: ['pk'] },
    explanation: 'The challenge binds the message, public information, and commitment. Domain separation and context handling prevent one protocol transcript from being reused as another.',
  };

  yield {
    state: labelMatrix(
      'Failure modes',
      [
        { id: 'nonce', label: 'nonce' },
        { id: 'branch', label: 'branch' },
        { id: 'ctx', label: 'ctx' },
        { id: 'param', label: 'param' },
      ],
      [
        { id: 'risk', label: 'risk' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['reuse', 'DRBG'],
        ['timing', 'ct path'],
        ['confuse', 'domain'],
        ['wrong set', 'pin'],
      ],
    ),
    highlight: { active: ['nonce:fix', 'branch:fix'], found: ['ctx:fix', 'param:fix'] },
    explanation: 'PQC signatures are system components. Secure deployment needs deterministic parameter negotiation, context binding, constant-time paths, and careful randomness or deterministic signing mode policy.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'signature flow') yield* signatureFlow();
  else if (view === 'rejection gate') yield* rejectionGate();
  else throw new InputError('Pick an ML-DSA view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        `Digital signatures let anyone verify that a message, package, certificate, firmware image, or ledger entry came from the holder of a signing key. They solve a different problem from encryption. The point is not secrecy. The point is public, durable accountability: this exact message was authorized and has not been changed.`,
        `ML-DSA is the NIST-standardized module-lattice signature scheme derived from CRYSTALS-Dilithium and specified in FIPS 204. It exists because large quantum computers would break widely deployed classical signature systems such as RSA and ECDSA. A post-quantum migration needs signatures that keep verification public while changing the hard math underneath.`,
      ],
    },
    {
      heading: 'The naive signature idea',
      paragraphs: [
        `The tempting story is simple: hash the message, mix the hash with a secret key, publish a response, and let the public key check it. That story is not wrong at the highest level, but it hides the part that makes lattice signatures subtle. A response can be algebraically related to the public key and still be unsafe to release.`,
        `If the released values carry even a small statistical bias tied to the signing secret, many signatures can become evidence about that secret. This is the same reason real cryptographic code treats randomness, bounds, transcript binding, and side channels as part of the algorithm rather than as optional engineering polish.`,
      ],
    },
    {
      heading: 'Why the obvious version fails',
      paragraphs: [
        `In a lattice signature, the signer works with short secret vectors. A direct response such as y + c*s may reveal information about s because the distribution of the response depends on the secret term. If the response is too large, oddly shaped, or correlated with retry behavior, the verifier may accept while an attacker learns.`,
        `The fix is not to hide the public verification equation. Verification must remain public. The fix is to release only responses whose distribution is controlled closely enough that the secret is not exposed. That is why Dilithium is often described as a Fiat-Shamir-with-aborts construction: some attempts are intentionally abandoned.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `ML-DSA turns signing into a transcript. The signer samples a temporary vector y, computes a commitment w from the public matrix A and y, hashes the message and commitment into a sparse challenge c, and computes a response z. The public signature carries c, z, and a hint h used during verification.`,
        `The challenge binds the signature to the message and to the commitment. The response proves knowledge of secret structure related to the public key without sending the secret itself. Rejection sampling is the gatekeeper: if z or related hidden pieces exceed the accepted bounds, the signer discards the attempt and starts again.`,
      ],
    },
    {
      heading: 'How signing works',
      paragraphs: [
        `A simplified signing pass has five jobs. First, bind the message to the chosen domain and context so the same byte string cannot be silently reused across protocols. Second, sample the temporary vector y. Third, compute the commitment w = A*y in the module lattice. Fourth, hash the transcript into the challenge c. Fifth, compute z and the hint.`,
        `The real specification adds parameterized dimensions, decompositions, packing rules, seeds, and byte-level encodings. Those details matter for interoperability, but the control flow is the same idea shown in the visual: sample, commit, challenge, respond, check bounds, and release only the transcript that passes the safety gate.`,
      ],
    },
    {
      heading: 'What the visual proves',
      paragraphs: [
        `The signature-flow graph is a dependency proof. The message and commitment feed the challenge, the challenge feeds the response, and the public key belongs to verification. The graph is not claiming that the public key can recover the secret. It is showing which values must be bound together for the verifier to reject swapped or replayed transcripts.`,
        `The rejection-gate view proves the less obvious lesson. A failed signing attempt is not an error path in the usual sense. It is a normal cryptographic branch required to keep released responses bounded. The plot makes the rule visible: values above the cap are dropped, and only a safe attempt becomes a signature.`,
      ],
    },
    {
      heading: 'Why verification works',
      paragraphs: [
        `Verification recomputes the public relation from the message, public key, challenge, response, and hint. If the signature was formed honestly, the reconstructed high bits match the challenge that was hashed into the transcript. If an attacker changes the message, response, hint, or context, the recomputed challenge relation breaks.`,
        `This is why signature verification can be cheap and public while signing remains secret. The verifier only checks consistency. It does not need to know the short secret vectors. The security argument rests on the hardness of module-lattice problems plus the fact that accepted transcripts are shaped so they do not leak those vectors.`,
      ],
    },
    {
      heading: 'Deployment ledger',
      paragraphs: [
        `A useful way to study ML-DSA is to separate the math object from the deployed artifact. The math object is a signature tuple. The deployed artifact is a record that says which parameter set was used, which context string was bound, which message bytes were signed, which public key identity was expected, and which encoding rules the verifier must apply.`,
        `That ledger is not bureaucracy. It prevents algorithm confusion. A verifier that accepts the right equation over the wrong context, wrong parameter set, or wrong artifact hash can approve the wrong thing. Post-quantum migration work should therefore treat the signature, metadata, certificate format, transparency log entry, and update policy as one system.`,
        `This is especially important during hybrid or staged migrations. A system may carry classical and post-quantum signatures together for a while. The verifier must know which signatures are required, which are advisory, which policy version applies, and how failure of one signature changes the trust decision.`,
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        `The main deployment cost is size. ML-DSA public keys and signatures are larger than classical ECDSA and Ed25519 artifacts. That affects certificate chains, update manifests, transparency logs, embedded firmware channels, package registries, and any protocol that assumed signatures were tiny.`,
        `The parameter sets ML-DSA-44, ML-DSA-65, and ML-DSA-87 trade security strength against bytes and cycles. A serious rollout ledger should record the parameter set, implementation version, context string policy, randomness or deterministic signing mode, expected rejection behavior, constant-time review, and FIPS or library errata status.`,
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        `ML-DSA is a strong fit when many parties need to verify artifacts long after they were produced. Software supply-chain signing is the natural example: build systems sign releases, mirrors and clients verify them, and investigators later inspect the signed evidence without asking the original signer to come online.`,
        `It also fits public certificates, transparency systems, append-only logs, configuration approvals, and document signing where the organization can absorb larger key and signature sizes. The benefit is not only quantum resistance. It is a standardized path that vendors, auditors, and protocol designers can converge on.`,
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        `The dangerous failures are usually around the algorithm, not inside the clean diagram. Reusing a temporary vector, weakening randomness, accepting malformed encodings, logging retry counts, leaking timing differences, or branching on secret-dependent data can undermine the design. Rejection sampling must not become an attacker-visible oracle.`,
        `System failures are just as common. ML-DSA is not a key-establishment method, so it does not replace ML-KEM. It also does not make a signed update safe unless the signed statement binds the right artifact hash, version, channel, publisher identity, expiration rules, and rollout policy.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Primary source: NIST FIPS 204 at https://csrc.nist.gov/pubs/fips/204/final. Read it when you need exact parameter names, encodings, byte lengths, and verification rules rather than a conceptual map.`,
        `Next topics: NTT Polynomial Multiplication for the arithmetic engine, Modular Arithmetic for the ring operations, Hash Functions for transcript binding, ML-KEM for post-quantum key establishment, SLH-DSA for hash-based signatures, and Software Supply Chain Provenance Graph for the place where signatures become operational evidence.`,
      ],
    },
  ],
};
