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
      heading: 'How to read the animation',
      paragraphs: [
        'The commit-and-open view shows one large object becoming a polynomial, then one compact commitment. A polynomial is an expression such as f(x) = ax^2 + bx + c over a finite field, which is arithmetic modulo a large prime. The point z and value y form the opening claim.',
        'The batched-opening view shows several claims checked through one quotient relation. The safe inference is algebraic: if y equals f(z), then f(x) - y has root z, so x - z divides f(x) - y. KZG turns that divisibility claim into a pairing check on group elements.',
        {type: 'callout', text: 'KZG makes a large object verifiable by binding it to one polynomial commitment and proving each opening as a quotient relation checked in the exponent.'},
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/5/5a/Lagrange_polynomial.svg', alt: 'Graph showing Lagrange basis polynomials and their interpolating polynomial through four points.', caption: 'Lagrange polynomial diagram by Glosser.ca and Rayhem, Wikimedia Commons, CC BY-SA 3.0 or GFDL.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Many systems need to commit to a large object and later prove a small fact about it. A rollup may publish a commitment to blob data. A verifier may want one vector position or one polynomial evaluation without downloading the full object.',
        'KZG is a polynomial commitment scheme. The prover commits once to a degree-bounded polynomial and later opens the commitment at chosen points. The verifier checks a compact proof against the commitment, point, and claimed value.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious commitment is a Merkle tree. Hash data chunks as leaves, hash upward to a root, and prove one chunk with sibling hashes along the path. Merkle proofs are transparent, practical, and easy to audit.',
        'Merkle trees prove membership in a hash tree. They do not naturally prove algebraic claims such as this value is f(z) for the committed polynomial. Their proof size also grows with tree depth, while KZG can keep a single opening proof to one group element under its setup assumptions.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is verifier bandwidth and algebraic structure. A proof system may need many polynomial evaluations, and sending long hash paths or raw coefficients becomes expensive. The verifier wants a small check that still binds the prover to one polynomial.',
        'The second wall is trust. KZG needs a structured reference string containing powers of a hidden value tau. If tau is known to an attacker, the binding property can fail. The scheme buys compact openings by paying setup and pairing complexity.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'KZG commits to f(tau) in the exponent without revealing tau. The structured reference string contains group elements for powers of tau, so a committer can combine coefficients with those powers and publish one commitment. The commitment is compact because the polynomial has been folded into one hidden evaluation.',
        'An opening proves a quotient relation. If f(z) = y, then f(x) - y is divisible by x - z. The proof commits to q(x) = (f(x) - y) / (x - z), and a pairing equation checks the relation at the hidden point tau.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Setup fixes a maximum degree and publishes powers of tau in pairing groups. Commitment combines the polynomial with those powers to produce a group element C. Opening at z publishes y and a proof pi for the quotient polynomial.',
        'Verification checks that C, z, y, and pi satisfy the equation corresponding to f(tau) - y = q(tau)(tau - z). The verifier does not reconstruct f. It checks a relation between group elements that would be hard to fake without knowing a valid quotient or the hidden tau.',
      ],
    },    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is the root theorem for polynomials. A polynomial g(x) has root z exactly when x - z divides g(x). Setting g(x) = f(x) - y turns a claimed evaluation into a divisibility test.',
        'Binding comes from the hidden evaluation point and the degree bound. A dishonest prover should not be able to create two different low-degree polynomials that both match the same commitment and pass openings, unless the setup is compromised or the cryptographic assumptions fail. Implementation checks such as subgroup validation and canonical encodings keep the algebraic statement well formed.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'A single KZG commitment or proof can be 48 bytes on BLS12-381 G1 in Ethereum Deneb, and each blob has 4,096 field elements. Verification uses pairings, which are heavier than hash checks but keep communication small. Doubling the number of opened points can often be batched so communication grows more slowly than sending many separate paths.',
        'The cost moves to prover work, setup, curve code, serialization, and input validation. KZG is not simpler than Merkle trees. Cost as behavior means it wins when compact openings matter enough to justify trusted setup and pairing machinery.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'KZG appears in Ethereum blob commitments, polynomial proof systems, vector commitments, and designs such as Verkle-style authenticated state. It fits systems where a verifier must check small openings against a large committed algebraic object. Rollups use blob commitments so data can be committed compactly while availability is handled by the protocol.',
        'It is also useful when many openings are checked against the same commitment. Batch openings use an interpolation polynomial for claimed values and a vanishing polynomial for opened points. The logic remains divisibility, but communication and verification can be amortized.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'KZG is the wrong tool when a transparent hash commitment is enough. Merkle trees need no trusted setup and rely on ordinary hash functions. If proof size is acceptable, the algebraic tax may not pay.',
        'It also does not solve data availability, storage, encryption, or application validity. A commitment can bind to data, but it does not keep the data online or prove that the application interpreted it correctly. Ethereum blob data, for example, is temporary even though commitments remain useful.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Let f(x) = x^2 + 2x + 3 and open at z = 4. The claimed value is y = 4^2 + 2 times 4 + 3 = 27. Then f(x) - 27 = x^2 + 2x - 24 = (x - 4)(x + 6), so q(x) = x + 6.',
        'The prover sends y = 27 and a proof that commits to q. The verifier checks the commitment relation at hidden tau. If the prover claims y = 26, then f(x) - 26 = x^2 + 2x - 23, which is not divisible by x - 4, so no valid quotient relation should pass.',
        'For two openings at z = 4 and z = 5, the claimed values define a small interpolation polynomial that matches those two points. The difference between f and that interpolation must vanish at both points, so it is divisible by (x - 4)(x - 5). That is the same idea with a larger vanishing polynomial.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Kate, Zaverucha, and Goldberg, Constant-Size Commitments to Polynomials at https://cacr.uwaterloo.ca/techreports/2010/cacr2010-10.pdf, EIP-4844 at https://eips.ethereum.org/EIPS/eip-4844, and Ethereum Deneb polynomial commitments at https://ethereum.github.io/consensus-specs/specs/deneb/polynomial-commitments/.',
        'Study finite fields, roots and divisibility, polynomial interpolation, pairing-based cryptography, Merkle trees, vector commitments, data availability sampling, Verkle trees, and SNARK arithmetization next.',
      ],
    },
  ],
};