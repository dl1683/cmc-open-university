// KZG polynomial commitments: commit once to a polynomial, then prove selected
// evaluations with compact witnesses checked by pairings.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'kzg-polynomial-commitment-opening-case-study',
  title: 'KZG Polynomial Commitments',
  category: 'Security',
  summary: 'A polynomial-commitment case study: trusted setup powers, one compact commitment, point openings, quotient witnesses, pairing checks, and Ethereum blob/Verkle connections.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['commit and open', 'batched openings'], defaultValue: 'commit and open' },
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
  return matrixState({
    title,
    rows,
    columns,
    values: labelsByRow.map((row) => row.map(code)),
    format: (value) => labels[value],
  });
}

function kzgGraph(title) {
  return graphState({
    nodes: [
      { id: 'blob', label: 'blob', x: 0.7, y: 3.9, note: 'field elems' },
      { id: 'poly', label: 'poly', x: 2.7, y: 3.9, note: 'phi(x)' },
      { id: 'setup', label: 'SRS', x: 2.5, y: 1.6, note: 'tau powers' },
      { id: 'commit', label: 'commit', x: 4.8, y: 3.9, note: 'C' },
      { id: 'claim', label: 'claim y', x: 6.4, y: 2.3, note: 'phi(z)' },
      { id: 'proof', label: 'proof', x: 6.4, y: 5.4, note: 'pi' },
      { id: 'pairing', label: 'pair', x: 8.1, y: 3.9, note: 'check' },
      { id: 'accept', label: 'ok', x: 9.4, y: 3.9, note: 'or reject' },
    ],
    edges: [
      { id: 'e-blob-poly', from: 'blob', to: 'poly' },
      { id: 'e-setup-poly', from: 'setup', to: 'poly' },
      { id: 'e-poly-commit', from: 'poly', to: 'commit' },
      { id: 'e-poly-claim', from: 'poly', to: 'claim' },
      { id: 'e-poly-proof', from: 'poly', to: 'proof' },
      { id: 'e-commit-pairing', from: 'commit', to: 'pairing' },
      { id: 'e-claim-pairing', from: 'claim', to: 'pairing' },
      { id: 'e-proof-pairing', from: 'proof', to: 'pairing' },
      { id: 'e-pairing-accept', from: 'pairing', to: 'accept' },
    ],
  }, { title });
}

function batchGraph(title) {
  return graphState({
    nodes: [
      { id: 'commit', label: 'commit C', x: 0.8, y: 3.8, note: 'same poly' },
      { id: 'z1', label: 'z1,y1', x: 2.7, y: 1.8, note: 'open' },
      { id: 'z2', label: 'z2,y2', x: 2.7, y: 3.8, note: 'open' },
      { id: 'z3', label: 'z3,y3', x: 2.7, y: 5.8, note: 'open' },
      { id: 'interp', label: 'interp', x: 4.9, y: 3.8, note: 'claims' },
      { id: 'quotient', label: 'quotient', x: 6.5, y: 3.8, note: 'divide' },
      { id: 'proof', label: 'proof pi', x: 8.0, y: 3.8, note: 'one elem' },
      { id: 'verify', label: 'verify', x: 9.2, y: 3.8, note: 'batch' },
    ],
    edges: [
      { id: 'e-commit-verify', from: 'commit', to: 'verify' },
      { id: 'e-z1-interp', from: 'z1', to: 'interp' },
      { id: 'e-z2-interp', from: 'z2', to: 'interp' },
      { id: 'e-z3-interp', from: 'z3', to: 'interp' },
      { id: 'e-interp-quotient', from: 'interp', to: 'quotient' },
      { id: 'e-quotient-proof', from: 'quotient', to: 'proof' },
      { id: 'e-proof-verify', from: 'proof', to: 'verify' },
    ],
  }, { title });
}

function* commitAndOpen() {
  yield {
    state: kzgGraph('A blob becomes a polynomial over a finite field'),
    highlight: { active: ['blob', 'poly', 'e-blob-poly'], compare: ['setup', 'commit'] },
    explanation: 'A KZG system treats data as evaluations or coefficients of a polynomial over a finite field. The commitment is to that polynomial, not to a JSON object or byte string directly.',
    invariant: 'The verifier will later check claimed evaluations against one committed polynomial.',
  };

  yield {
    state: kzgGraph('The trusted setup supplies hidden powers of tau'),
    highlight: { active: ['setup', 'poly', 'commit', 'e-setup-poly', 'e-poly-commit'], compare: ['claim'] },
    explanation: 'The structured reference string contains group elements derived from a secret tau: g, g^tau, g^(tau^2), and so on. The secret tau must be unknown after setup. The committer combines those powers with polynomial coefficients to form one commitment C.',
  };

  yield {
    state: kzgGraph('Opening one point uses a quotient witness'),
    highlight: { active: ['poly', 'claim', 'proof', 'e-poly-claim', 'e-poly-proof'], found: ['commit'] },
    explanation: 'To open at z, the prover gives y = phi(z) plus a proof for the quotient (phi(x) - y) / (x - z). The division works exactly when y is the correct evaluation.',
  };

  yield {
    state: kzgGraph('The verifier checks commitment, point, value, and proof together'),
    highlight: { active: ['commit', 'claim', 'proof', 'pairing', 'accept', 'e-commit-pairing', 'e-claim-pairing', 'e-proof-pairing', 'e-pairing-accept'], compare: ['blob'] },
    explanation: 'A pairing check ties the commitment C, the claimed point z, the claimed value y, and the proof pi. The verifier does not need the whole polynomial to check this one opening.',
  };

  yield {
    state: labelMatrix(
      'KZG objects',
      [
        { id: 'srs', label: 'SRS' },
        { id: 'poly', label: 'poly' },
        { id: 'commit', label: 'commit' },
        { id: 'opening', label: 'opening' },
        { id: 'verify', label: 'verify' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['tau powers', 'toxic waste'],
        ['data shape', 'wrong field'],
        ['one group pt', 'bind only'],
        ['z,y,proof', 'bad claim'],
        ['pairing eq', 'bad setup'],
      ],
    ),
    highlight: { active: ['commit:stores', 'opening:stores', 'verify:stores'], compare: ['srs:risk', 'poly:risk'] },
    explanation: 'The data structures are small but loaded: an SRS, polynomial representation, commitment, opening tuple, and verifier equation. KZG gives compact openings, not automatic data availability or correct application semantics.',
  };
}

function* batchedOpenings() {
  yield {
    state: batchGraph('Many claimed points can be checked with one proof'),
    highlight: { active: ['z1', 'z2', 'z3', 'interp', 'e-z1-interp', 'e-z2-interp', 'e-z3-interp'], compare: ['proof'] },
    explanation: 'Batch opening starts from several claimed evaluations. The verifier and prover agree on the set of points and values; the algebra builds a small polynomial through those claims.',
    invariant: 'Batching is still binding to the same committed polynomial.',
  };

  yield {
    state: batchGraph('Subtract the claim polynomial, divide by the vanishing polynomial'),
    highlight: { active: ['interp', 'quotient', 'e-interp-quotient'], found: ['commit'], compare: ['z1', 'z2', 'z3'] },
    explanation: 'The prover forms a quotient by subtracting the polynomial that matches the claimed values and dividing by the polynomial that vanishes at all opened points. If any claim is wrong, the final check should fail.',
  };

  yield {
    state: batchGraph('One compact witness carries the batch opening'),
    highlight: { active: ['quotient', 'proof', 'verify', 'e-quotient-proof', 'e-proof-verify', 'e-commit-verify'], found: ['commit'] },
    explanation: 'The batch proof can remain one group element even when several positions are opened. That communication shape is why polynomial commitments are attractive for stateless witnesses and blob proofs.',
  };

  yield {
    state: labelMatrix(
      'Authenticated proof shapes',
      [
        { id: 'merkle', label: 'Merkle' },
        { id: 'sparse', label: 'Sparse M' },
        { id: 'kzg', label: 'KZG' },
        { id: 'verkle', label: 'Verkle' },
      ],
      [
        { id: 'proof', label: 'proof' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['sibling path', 'hash bytes'],
        ['empty path', 'huge key'],
        ['opening', 'pairings'],
        ['vector open', 'prover work'],
      ],
    ),
    highlight: { active: ['kzg:proof', 'verkle:proof'], compare: ['merkle:proof', 'sparse:cost'] },
    explanation: 'KZG changes the proof shape. Merkle systems send hashes along paths. KZG sends algebraic openings. Verkle trees use vector commitments so wide authenticated nodes can open selected children compactly.',
  };

  yield {
    state: labelMatrix(
      'Blob commitment boundary',
      [
        { id: 'commit', label: 'commit' },
        { id: 'proof', label: 'proof' },
        { id: 'blob', label: 'blob' },
        { id: 'network', label: 'network' },
      ],
      [
        { id: 'guarantees', label: 'guarantees' },
        { id: 'not' , label: 'not' },
      ],
      [
        ['binds data', 'stores data'],
        ['opens point', 'executes app'],
        ['avail bytes', 'forever L1'],
        ['gossip/DA', 'valid logic'],
      ],
    ),
    highlight: { found: ['commit:guarantees', 'proof:guarantees', 'blob:guarantees'], compare: ['commit:not', 'network:not'] },
    explanation: 'Ethereum blob commitments are a clean case study. The chain can refer to a compact commitment and verify KZG proofs, but data availability, retention windows, and rollup semantics are separate protocol layers.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'commit and open') yield* commitAndOpen();
  else if (view === 'batched openings') yield* batchedOpenings();
  else throw new InputError('Pick a KZG polynomial-commitment view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A KZG polynomial commitment lets a prover commit to a polynomial with a compact group element and later prove claimed evaluations without revealing the entire polynomial. The verifier checks a commitment, point, value, and proof together.',
        'The Kate-Zaverucha-Goldberg paper describes constant-size commitments to polynomials and openings for evaluations: https://cacr.uwaterloo.ca/techreports/2010/cacr2010-10.pdf. The central algebra is that phi(x) - phi(i) is divisible by x - i when phi(i) is the correct evaluation.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Setup creates a structured reference string containing powers of a hidden value tau. A committer represents data as a polynomial phi, then computes a commitment equivalent to g raised to phi(tau), without knowing tau. To open point z, the prover publishes y = phi(z) and a proof based on the quotient (phi(x) - y) / (x - z).',
        'The verifier uses a pairing equation to check that the commitment and proof are consistent with the claimed point and value. Batch openings use a polynomial through many claimed points and one quotient against the vanishing polynomial for those points.',
      ],
    },
    {
      heading: 'Complete case study: Ethereum blobs',
      paragraphs: [
        'EIP-4844 introduces blob-carrying transactions whose large data payload is not directly accessible to EVM execution, but whose commitment can be accessed: https://eips.ethereum.org/EIPS/eip-4844. Blob data is represented over a field, committed with KZG, and accompanied by proofs that nodes verify.',
        'The ethereum.org danksharding page explains the public KZG ceremony and why the secret randomness must remain unknown: https://ethereum.org/roadmap/danksharding/. If someone knew the secret evaluation locations, they could attack binding assumptions. The ceremony spreads trust so one honest contribution is enough to destroy the toxic waste.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'A polynomial commitment is not a database, not encryption, and not data availability by itself. It binds a compact commitment to polynomial evaluations. The network still needs to distribute data, retain it for the required window, and define what the data means.',
        'The setup is part of the security model. If the toxic waste is known, binding can fail. Implementations also need careful finite-field encoding, domain separation, subgroup checks, canonical serialization, and batch-verification rules.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Kate, Zaverucha, and Goldberg, "Constant-Size Commitments to Polynomials and Their Applications" at https://cacr.uwaterloo.ca/techreports/2010/cacr2010-10.pdf, EIP-4844 at https://eips.ethereum.org/EIPS/eip-4844, and ethereum.org danksharding/KZG ceremony notes at https://ethereum.org/roadmap/danksharding/.',
        'Study Data Availability Sampling & Erasure Coding Case Study, Namespaced Merkle Tree Proof Case Study, Shamir Secret Sharing, Binary Exponentiation, Merkle Tree, Sparse Merkle Tree Non-Membership, Verkle Trees & Stateless Clients, TUF Update Metadata Case Study, and ZK-SNARK Arithmetization Case Study next.',
      ],
    },
  ],
};
