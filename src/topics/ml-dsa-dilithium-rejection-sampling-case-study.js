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
    { heading: 'What it is', paragraphs: ['ML-DSA is the NIST-standardized module-lattice digital signature algorithm derived from CRYSTALS-Dilithium. It is used to sign messages so verifiers can detect modification and authenticate the signer.', 'Its core data structures are polynomial-vector public keys, signing secrets, challenge hashes, bounded response vectors, hint bits, and verification equations.'] },
    { heading: 'How it works', paragraphs: ['A signer samples a temporary vector, computes a commitment, hashes the transcript into a challenge, derives a response using the secret, and rejects attempts whose response or hints fall outside allowed bounds. The final signature carries the challenge, response, and hint material.', 'The verifier uses the public key, message, and signature to reconstruct the expected challenge relation and rejects malformed or out-of-bound signatures.'] },
    { heading: 'Cost and complexity', paragraphs: ['The dominant implementation issues are polynomial arithmetic, byte packing, rejection-sampling behavior, randomness, context/domain separation, signature size, and side-channel discipline. Parameter sets trade security strength against key and signature size.'] },
    { heading: 'Complete case study', paragraphs: ['A software-update system migrates from classical signatures to ML-DSA. The release ledger records the parameter set, public-key fingerprint, signature length, context string, signing library, verification library, rejection-rate telemetry, and fallback policy.', 'If a signature fails, the triage path distinguishes wrong context, wrong parameter set, corrupted artifact, malformed signature, stale verifier, and implementation-version mismatch.'] },
    { heading: 'Pitfalls', paragraphs: ['Do not log secret-dependent rejection counts or timing in a way attackers can query. Do not mix contexts casually. Do not present PQC migration as only replacing an algorithm name; key sizes, signature sizes, protocol identifiers, certificate formats, and verifier rollout all change.'] },
    { heading: 'Sources and study next', paragraphs: ['Primary source: NIST FIPS 204 at https://csrc.nist.gov/pubs/fips/204/final. Study NTT Polynomial Multiplication Primer, ML-KEM Kyber Module-Lattice KEM Case Study, SLH-DSA SPHINCS+ Hypertree Signature Case Study, Binary Exponentiation, and Software Supply Chain Provenance Graph next.'] },
  ],
};
