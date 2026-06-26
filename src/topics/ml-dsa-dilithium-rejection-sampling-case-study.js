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
      heading: 'How to read the animation',
      paragraphs: [
        'The animation shows ML-DSA, the NIST module-lattice digital signature algorithm derived from Dilithium. A digital signature lets anyone verify that a named key authorized one exact message, while the signing key remains secret.',
        'Active nodes are the values currently being computed, compare marks the bound or check that may reject the attempt, and found marks a value that can safely leave the signer. The safe inference rule is this: a response above the bound is not a weak signature, it is no signature, so the signer must resample.',
        {type:'callout', text:`Rejection sampling makes Dilithium safe by treating a failed signing attempt as a normal privacy-preserving branch, not an exception.`},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/9/97/Equilateral_Triangle_Lattice.svg', alt:'Equilateral triangular lattice points arranged in a regular grid.', caption:'Equilateral triangle lattice, a simple visual proxy for lattice structure. Image by Jim.belk, public domain, Wikimedia Commons.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Classical public signatures such as RSA and ECDSA depend on math that a large fault-tolerant quantum computer could break. ML-DSA exists so software updates, certificates, audit logs, packages, and policy approvals can keep public verification while changing the hard problem underneath.',
        'The hard problem comes from module lattices, which are algebraic grids built from polynomial vectors. The signer knows short secret vectors; the public key exposes related lattice data that should not reveal those secrets.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious signature design is to hash the message, combine that hash with the secret key, and publish a response that the public key can check. That works as a mental model for authentication because the verifier only needs consistency, not the secret.',
        'For lattice signatures, that direct version is unsafe. If the response is shaped by the secret in a measurable way, many accepted signatures can become samples about the signing key.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is leakage through valid outputs. A response like z = y + c*s includes fresh randomness y, challenge c, and secret vector s; if every z is released, its distribution can drift toward the secret.',
        'Public verification cannot be removed because the whole point of a signature is offline checking by anyone. The algorithm must keep verification public while making the released response look independent enough of the secret.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Dilithium signs by committing before it knows the challenge, then aborting attempts that would reveal too much. The signer samples y, computes w = A*y, hashes the message and w into challenge c, computes z, and releases the signature only if z and related values pass bounds.',
        'This is called rejection sampling. It changes the behavior from "every attempt signs" to "only safe-looking attempts sign", which makes the public transcript useful to the verifier but unhelpful as a statistical leak.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A matrix A is public, and the signer holds short secret vectors. For each attempt, the signer samples a fresh short vector y, computes a commitment w from A and y, and hashes the message plus commitment to derive the sparse challenge c.',
        'The response z combines y with the secret and challenge. If z is too large, or if the helper hint would exceed limits, the signer discards the attempt; otherwise the signature is the challenge, response, and hint.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness means an honest signature verifies. The verifier recomputes the public relation from the message, public key, challenge, response, and hint; if the signer followed the equations and bounds, the reconstructed commitment information hashes back to the same challenge.',
        'Soundness means an attacker should not forge a new accepted transcript without the secret. The challenge is bound to the message and commitment, and the lattice assumption makes it hard to create a bounded response that satisfies the public equation for a fresh challenge.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Signing cost behaves like a loop with random restarts. If the acceptance rate is 80 percent, 100 requested signatures need about 125 attempts on average; if tuning or faults drop acceptance to 50 percent, the same 100 signatures need about 200 attempts.',
        'Verification is steadier because it has no rejection loop. The deployment cost is mostly larger keys and signatures than classical schemes, plus constant-time sampling, hashing, polynomial arithmetic, encoding checks, and versioned parameter policy.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'ML-DSA fits public artifacts that many parties must verify later: package signatures, firmware manifests, certificate chains, transparency logs, release attestations, and signed configuration approvals. The access pattern is many verifiers reading one signed statement.',
        'It is not a drop-in replacement for encryption. A system often pairs ML-DSA for authentication with ML-KEM for key establishment, then uses symmetric cryptography for bulk protected data.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The common failures are implementation and protocol failures. Reused randomness, timing leaks in rejection, malformed encoding acceptance, wrong context strings, or visible retry counts can damage the security argument even when the equations look right.',
        'It also fails as an operational control if the signed message is incomplete. A valid signature on the wrong artifact hash, wrong release channel, wrong parameter set, or stale policy still authorizes the wrong thing.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose an implementation uses a simplified bound of 65 for the response norm. Attempt 1 produces norm 86, so the signer drops it; attempt 2 produces 78, so it drops again; attempt 3 produces 42, so the signer releases that transcript.',
        'For 10,000 signing requests with the same 3-of-5 pattern shown in the plot, the system would perform about 16,667 attempts. That extra work is not wasted overhead; it is the price paid to make released signatures stop acting like measurements of the secret.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: NIST FIPS 204 for ML-DSA, the CRYSTALS-Dilithium specification, and the Dilithium security proof for Fiat-Shamir with aborts. Use the standard for exact byte encodings, parameter names, and verification rules.',
        'Study next: modular arithmetic for coefficient reduction, NTT polynomial multiplication for fast ring operations, hash functions for transcript binding, ML-KEM for post-quantum key establishment, and constant-time programming for side-channel control.',
      ],
    },
  ],
};
