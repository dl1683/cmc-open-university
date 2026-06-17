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
      heading: 'Why this exists',
      paragraphs: [
        `Many systems need to commit to a large object and later prove small facts about it. A rollup may publish a commitment to blob data. A stateless-client design may want a compact proof that one position in a large vector has a claimed value. A proof system may need to bind a prover to a polynomial before revealing selected evaluations.`,
        `A KZG polynomial commitment solves a narrow version of that problem. The prover commits once to a degree-bounded polynomial, then later opens the commitment at selected points. The verifier checks the claimed value without downloading the whole polynomial.`,
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        `The obvious commitment is a Merkle tree over data chunks. Hash the leaves, hash parents upward, publish the root, and prove one chunk by sending its sibling hashes. This is simple, transparent, and widely useful.`,
        `The wall is proof shape. A Merkle opening grows with tree depth, and many openings send many hashes unless the paths overlap. A Merkle tree also proves membership in a hash tree. It does not natively prove algebraic claims such as "this value is the evaluation of the committed polynomial at point z."`,
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        `KZG turns data into a polynomial and commits to the polynomial at a hidden evaluation point tau. The committer does not know tau. The structured reference string contains group elements derived from powers of tau, which let the committer build a group commitment equivalent to "the polynomial evaluated at tau" without learning tau itself.`,
        `An opening proves a divisibility fact. If y really equals phi(z), then phi(x) - y has z as a root, so phi(x) - y is divisible by x - z. The proof is a commitment to the quotient q(x) = (phi(x) - y) / (x - z). Pairings let the verifier check that relation in the exponent.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `Setup creates the structured reference string for a maximum degree: powers of tau in one or more pairing groups. The secret tau is toxic waste. If an attacker learns it, they can fake relationships the verifier is supposed to treat as binding.`,
        `Commitment takes the polynomial coefficients or evaluation-form data and combines them with the SRS powers. The result is one compact group element C. In Ethereum Deneb blob commitments, the consensus polynomial-commitment spec uses BLS12-381, 4096 field elements per blob, and 48-byte KZG commitments and proofs.`,
        `Opening at point z publishes the claimed value y and a proof pi for the quotient. Verification checks C, z, y, and pi together with a pairing equation. The verifier does not reconstruct phi; it checks that the committed polynomial and the claimed opening satisfy the quotient relation.`,
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        `In the commit-and-open view, follow the object boundary. The blob is first interpreted as field data, then as a polynomial, then as a commitment. The SRS enters only where the polynomial becomes a group element. That is the point where compactness and trusted setup both enter the story.`,
        `The opening frame is the key state change. The claim y is not trusted because the prover says it. The quotient proof exists only if the claimed value makes phi(x) - y divisible by x - z. The pairing frame then checks commitment, point, value, and proof as one relation.`,
        `In the batched-opening view, several claims become one interpolation polynomial and one vanishing polynomial. The batch proof is still tied to the same commitment. The final Ethereum boundary frame is a warning: a KZG commitment can bind to blob data, but it does not store that data forever or prove rollup semantics by itself.`,
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        `KZG buys compact proof size and fast verification shape. A single opening proof can be one group element, and batch openings can keep communication small even when several points are checked. That is the main reason KZG appears in blob commitments, vector commitments, and polynomial-heavy proof systems.`,
        `The cost moves to setup, algebra, and implementation. The system needs a trusted or multiparty setup for the maximum degree, pairing-friendly curves, subgroup checks, canonical serialization, field encoding, domain separation, batch-verification rules, and prover work to compute quotients. KZG is not simpler than Merkle trees. It is smaller for the workloads that can pay the algebraic tax.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `The correctness argument starts with a high-school algebra fact: a polynomial f(x) has root z exactly when x - z divides f(x). For a claimed opening y = phi(z), the polynomial phi(x) - y should have root z. Therefore it should equal q(x)(x - z) for some quotient q.`,
        `The commitment hides the check at tau. The verifier cannot see phi(tau) or q(tau) directly, but the commitment and proof encode those values in groups. Pairings let the verifier check that "committed phi minus y" matches "committed quotient times tau minus z" without learning tau or the full polynomial.`,
        `Binding depends on tau staying hidden and on the degree bound. If the prover could choose arbitrary higher-degree behavior outside the SRS limit, or if the prover knew tau, the compact check would no longer bind the prover to one polynomial in the intended way.`,
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        `Take phi(x) = x^2 + 2x + 3 and open it at z = 4. The claimed value is y = 16 + 8 + 3 = 27. Then phi(x) - 27 = x^2 + 2x - 24, which factors as (x - 4)(x + 6). The quotient is q(x) = x + 6.`,
        `The prover does not send the whole polynomial. It sends y and a commitment-like proof for q. The verifier checks the relation using C, z, y, and pi. If the prover claimed y = 26 instead, phi(x) - 26 would not be divisible by x - 4, so the quotient relation would fail.`,
      ],
    },
    {
      heading: 'Batched openings',
      paragraphs: [
        `For several claimed points, the prover and verifier first define the polynomial that matches the claimed values at those points. They also define a vanishing polynomial that is zero at all opened points. Subtract the claim polynomial from the committed polynomial, divide by the vanishing polynomial, and commit to the quotient.`,
        `The logic is the same as one opening: if every claimed value is right, the difference vanishes at every opened point and division works. If any value is wrong, the batch relation should fail. Batching changes communication and verification economics, but it does not remove the need to define the opened points and field encoding precisely.`,
      ],
    },
    {
      heading: 'Ethereum blob boundary',
      paragraphs: [
        `EIP-4844 introduced blob-carrying transactions whose large data payload cannot be accessed directly by EVM execution, while a commitment to the blob can be accessed. The point is cheaper temporary data space for rollups, not permanent execution-layer storage.`,
        `Current Ethereum documentation describes blobs as temporary data, with a retention window around 4096 epochs, about 18 days. After that period, protocol nodes may prune blob data. KZG commitments still let applications verify commitments and openings, but missing data is a data-availability problem, not a polynomial-commitment problem.`,
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        `KZG wins when compact openings are worth the setup and pairing machinery. Good fits include polynomial IOPs and SNARK-related protocols, Ethereum blob commitments, vector commitments, Verkle-style authenticated state, and systems that batch many openings against the same commitment.`,
        `It is especially attractive when verifier bandwidth is scarce and prover work is acceptable. A verifier that checks a small proof instead of a long hash path can be a real systems win.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `KZG is the wrong tool when a transparent hash commitment is enough. Merkle trees need no trusted setup, use ordinary hash functions, and are easier to audit. If proof size is not the bottleneck, the extra algebra may not pay for itself.`,
        `It also fails as a substitute for data availability, storage, encryption, or application correctness. A commitment can bind to data. It does not keep the data online, hide the data, explain what the data means, or prove that a rollup state transition is valid.`,
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        `A real implementation should define the polynomial form before any proof code is written. State whether the application stores coefficients or evaluations, which evaluation domain is used, what degree bound the SRS supports, how bytes become field elements, and how commitments, proofs, and field elements are serialized. Ambiguity here creates bugs that look like cryptography failures but are really encoding failures.`,
        `Verification should reject malformed inputs early: wrong byte length, non-canonical field elements, points not in the expected subgroup, unsupported degree, mismatched domain, reused or biased batch challenge, and missing domain separation. Batch verification should be treated as its own protocol, not as a casual loop around single openings. Keep test vectors for valid openings, wrong values, wrong points, wrong domains, max-degree inputs, and malformed encodings.`,
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        `Setup compromise is the headline risk. If toxic waste survives, binding can fail. A second class of failures lives in implementation details: accepting non-canonical encodings, skipping subgroup checks, mixing domains, using the wrong evaluation form, or verifying a batch with a challenge the prover can bias.`,
        `Degree mismatch is another common pitfall. The SRS supports commitments only up to a chosen degree. If the application silently commits data outside that shape, the proof system may no longer be proving the statement the application believes it is proving.`,
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        `Primary sources: Kate, Zaverucha, and Goldberg, "Constant-Size Commitments to Polynomials and Their Applications" at https://cacr.uwaterloo.ca/techreports/2010/cacr2010-10.pdf, EIP-4844 at https://eips.ethereum.org/EIPS/eip-4844, Ethereum Deneb polynomial commitments at https://ethereum.github.io/consensus-specs/specs/deneb/polynomial-commitments/, and ethereum.org Dencun and danksharding notes at https://ethereum.org/roadmap/dencun/ and https://ethereum.org/roadmap/danksharding/.`,
        `Study Finite Fields, Binary Exponentiation, Pairing-Based Cryptography, Shamir Secret Sharing, Merkle Tree, Sparse Merkle Tree Non-Membership, Namespaced Merkle Tree Proof Case Study, Data Availability Sampling and Erasure Coding Case Study, Verkle Trees and Stateless Clients, and ZK-SNARK Arithmetization Case Study next.`,
      ],
    },
  ],
};
