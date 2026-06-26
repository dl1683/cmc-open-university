// FRI: prove a committed evaluation table is close to a low-degree polynomial
// by repeated folding and random oracle queries.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'fri-low-degree-folding-proof-case-study',
  title: 'FRI Low-Degree Folding Proof Case Study',
  category: 'Security',
  summary: 'A STARK/FRI proof case study: Reed-Solomon evaluation domains, Merkle commitments, random queries, even/odd folding, low-degree tests, and verifier spot checks.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['folding rounds', 'query proof'], defaultValue: 'folding rounds' },
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

function friGraph(title) {
  return graphState({
    nodes: [
      { id: 'evals', label: 'evals', x: 1.0, y: 3.5, note: 'domain' },
      { id: 'merkle0', label: 'root0', x: 2.9, y: 2.0, note: 'commit' },
      { id: 'fold1', label: 'fold1', x: 4.6, y: 3.5, note: 'half' },
      { id: 'merkle1', label: 'root1', x: 5.8, y: 2.0, note: 'commit' },
      { id: 'fold2', label: 'fold2', x: 7.0, y: 3.5, note: 'half' },
      { id: 'small', label: 'small', x: 8.6, y: 3.5, note: 'poly' },
      { id: 'query', label: 'query', x: 4.8, y: 5.7, note: 'random' },
    ],
    edges: [
      { id: 'e-evals-merkle0', from: 'evals', to: 'merkle0' },
      { id: 'e-evals-fold1', from: 'evals', to: 'fold1' },
      { id: 'e-fold1-merkle1', from: 'fold1', to: 'merkle1' },
      { id: 'e-fold1-fold2', from: 'fold1', to: 'fold2' },
      { id: 'e-fold2-small', from: 'fold2', to: 'small' },
      { id: 'e-query-evals', from: 'query', to: 'evals' },
      { id: 'e-query-fold1', from: 'query', to: 'fold1' },
      { id: 'e-query-fold2', from: 'query', to: 'fold2' },
    ],
  }, { title });
}

function* foldingRounds() {
  yield {
    state: friGraph('FRI starts with a large evaluation table'),
    highlight: { active: ['evals', 'merkle0', 'e-evals-merkle0'], compare: ['fold1', 'small'] },
    explanation: 'A STARK prover commits to a Reed-Solomon style evaluation table. The verifier wants evidence that this table is close to evaluations of a low-degree polynomial.',
  };
  yield {
    state: labelMatrix(
      'Even/odd split',
      [
        { id: 'p', label: 'p(x)' },
        { id: 'even', label: 'even' },
        { id: 'odd', label: 'odd' },
        { id: 'fold', label: 'fold' },
      ],
      [
        { id: 'meaning', label: 'meaning' },
        { id: 'size', label: 'size' },
      ],
      [
        ['full poly', 'n'],
        ['p_even', 'n/2'],
        ['p_odd', 'n/2'],
        ['even+a*odd', 'n/2'],
      ],
    ),
    highlight: { active: ['even:size', 'odd:size', 'fold:size'], found: ['fold:meaning'] },
    explanation: 'A FRI round folds the polynomial using a random challenge. Conceptually, the prover combines even and odd parts into a smaller table. Degree and domain size shrink together.',
    invariant: 'Every fold must be bound by a commitment before later challenges are known.',
  };
  yield {
    state: friGraph('Repeated folds shrink the proof obligation'),
    highlight: { active: ['fold1', 'fold2', 'small', 'e-evals-fold1', 'e-fold1-fold2', 'e-fold2-small'], found: ['merkle1'], compare: ['evals'] },
    explanation: 'After several rounds, the prover reaches a tiny polynomial that the verifier can inspect directly. The verifier then checks random positions across all layers to connect the folded tables.',
  };
  yield {
    state: plotState({
      axes: { x: { label: 'round', min: 0, max: 6 }, y: { label: 'table size', min: 0, max: 1024 } },
      series: [
        { id: 'size', label: 'size', points: [{ x: 0, y: 1024 }, { x: 1, y: 512 }, { x: 2, y: 256 }, { x: 3, y: 128 }, { x: 4, y: 64 }, { x: 5, y: 32 }] },
      ],
      markers: [
        { id: 'start', x: 0, y: 1024, label: 'root0' },
        { id: 'end', x: 5, y: 32, label: 'small' },
      ],
    }),
    highlight: { active: ['size', 'start', 'end'] },
    explanation: 'The table-size halving is why FRI resembles an FFT-style folding process. The verifier does not read every row; it uses commitments and random spot checks.',
  };
}

function* queryProof() {
  yield {
    state: friGraph('Verifier samples random positions'),
    highlight: { active: ['query', 'evals', 'fold1', 'fold2', 'e-query-evals', 'e-query-fold1', 'e-query-fold2'], compare: ['small'] },
    explanation: 'The verifier samples positions after seeing commitments. For each sampled index, the prover opens values and Merkle paths from multiple FRI layers.',
  };
  yield {
    state: labelMatrix(
      'Query packet',
      [
        { id: 'idx', label: 'idx' },
        { id: 'sib', label: 'sib' },
        { id: 'fold', label: 'fold' },
        { id: 'root', label: 'root' },
      ],
      [
        { id: 'data', label: 'data' },
        { id: 'check', label: 'check' },
      ],
      [
        ['i,j', 'paired'],
        ['Merkle', 'auth'],
        ['relation', 'algebra'],
        ['commit', 'bind'],
      ],
    ),
    highlight: { found: ['sib:check', 'fold:check', 'root:check'], active: ['idx:data'] },
    explanation: 'Each query packet proves two things at once: the opened values belong to committed tables, and adjacent layers satisfy the fold relation at that index.',
  };
  yield {
    state: labelMatrix(
      'FRI vs KZG',
      [
        { id: 'fri', label: 'FRI' },
        { id: 'kzg', label: 'KZG' },
        { id: 'merkle', label: 'Merkle' },
        { id: 'stark', label: 'STARK' },
      ],
      [
        { id: 'trust', label: 'trust' },
        { id: 'proof', label: 'proof' },
      ],
      [
        ['transparent', 'larger'],
        ['setup', 'compact'],
        ['hash path', 'bytes'],
        ['FRI+AIR', 'trace'],
      ],
    ),
    highlight: { active: ['fri:trust', 'stark:proof'], compare: ['kzg:trust', 'kzg:proof'] },
    explanation: 'FRI is attractive for transparent STARK systems: no trusted setup, hash-based commitments, and scalable proving. The tradeoff is larger proofs than pairing-based KZG systems.',
  };
  yield {
    state: friGraph('Bad tables fail with high probability'),
    highlight: { removed: ['fold1', 'fold2', 'e-query-fold1'], active: ['query', 'evals'], compare: ['small'] },
    explanation: 'FRI is probabilistic. A table far from low degree can pass a few unlucky queries, but enough random queries make the cheating probability small.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'folding rounds') yield* foldingRounds();
  else if (view === 'query proof') yield* queryProof();
  else throw new InputError('Pick a FRI view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as a low-degree test, not as a hash-tree demo. A low-degree polynomial is a formula whose largest exponent is below a stated bound, and a finite field is arithmetic done modulo a prime or similar algebraic set. Active frames show the current committed layer, compared frames show the paired values used by a fold, and found frames show checks the verifier has accepted.',
        'The safe inference rule is this: once a layer is committed, the prover cannot change it after seeing the next random challenge. Each fold halves the evaluation domain, so the table gets shorter while the verifier keeps enough linked openings to test that each short table really came from the previous long one.',
        {type:'callout', text:'FRI turns a global low-degree claim into committed folding layers that random local checks can verify.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/9/95/Hash_Tree.svg', alt:'Diagram of a binary Merkle hash tree with leaf data blocks and parent hashes.', caption:'Hash Tree.svg by Azaghal, based on an original illustration by David Goethberg; CC0 via Wikimedia Commons.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'FRI means Fast Reed-Solomon Interactive Oracle Proof of Proximity. It exists because STARK proof systems encode a computation as evaluations of a polynomial and then need a verifier to check that the table is close to some low-degree polynomial without reading the whole table.',
        'The word proximity matters. The verifier is not only checking one value; it is checking that the entire committed table sits near the Reed-Solomon code, which is the set of all low-degree polynomial evaluation tables over the chosen domain.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to send the whole evaluation table to the verifier. The verifier can interpolate a polynomial through the points, compute its degree, and reject if the degree is too high.',
        'That approach is logically clean and useful for tiny examples. If the table has 16 values, reading every value is simpler than building a protocol around commitments and random queries.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that proof systems are built to make verification much cheaper than recomputing or rereading the computation. A table with 4,194,304 evaluations cannot be shipped to every verifier if the goal is a small proof and fast verification.',
        'Raw spot checks also fail. A Merkle path proves that one opened value belongs to a committed table, but it does not prove that the table is globally low degree. A malicious table can look right at sampled rows unless the protocol forces algebraic consistency across layers.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'FRI turns one large global claim into many small local consistency checks. The prover repeatedly folds a polynomial by splitting it into even and odd coefficient parts, mixing those parts with a random challenge, and committing to the smaller result.',
        'The invariant is commit before challenge. If the prover commits to each layer before learning the next random value, then a table that is far from low degree cannot reliably fake all fold relations at random query positions.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Start with evaluations of a polynomial p over a domain D. The prover builds a Merkle tree over those evaluations and sends the root, which is a short hash commitment to the whole table.',
        'The verifier derives a random field element alpha. The prover writes p(x) as p_even(x^2) plus x times p_odd(x^2), then sends evaluations of p_even(y) plus alpha times p_odd(y) on the squared domain. The squared domain is about half as large because x and -x map to the same y.',
        'After enough folds, the remaining polynomial is tiny and can be sent directly. The verifier then asks for random openings across all layers, checks Merkle paths, and checks that each pair of opened parent values produces the opened child value under the recorded challenge.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness has a simple honest side. If the original table really comes from a polynomial below the degree bound, the even-odd decomposition is algebraically valid, each fold has half the degree bound, and every opened relation will match.',
        'Soundness comes from distance and randomness. If the table is far from every low-degree table, many fold relations must be inconsistent after random folding. With t independent query paths and a violation rate near 1/2, the chance of missing every violation is about 2 to the minus t.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Let n be the number of original evaluations. The prover does O(n) field work per total folding process up to small constant factors, plus O(n) hashing to commit to layers. When n doubles, the prover roughly doubles its table work and adds about one more fold layer.',
        'The verifier pays for query paths, not the whole table. With 80 queries and 20 binary fold layers, the verifier checks about 1,600 fold steps and Merkle paths instead of reading millions of field values. Proof size grows with queries times layers times hash size.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'FRI is used in STARK-family proof systems because it avoids a trusted setup and keeps verifier work small. It is a core low-degree testing component in systems descended from the original STARK and FRI papers.',
        'The data-structure lesson travels beyond proofs. A Merkle commitment gives authenticated random access, while folding turns a global property into linked local checks. The combination is useful whenever a verifier must trust a large table through a small transcript.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'FRI is not a general proof system by itself. It proves proximity to a Reed-Solomon code, so the rest of a STARK must still encode the computation, constraints, boundary conditions, and public inputs correctly.',
        'It also has parameter taxes. Larger blowup factors, more queries, and stronger hash functions improve soundness but increase prover work and proof size. Weak randomness, bad transcript ordering, or small fields can break the assumptions the proof relies on.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose the claimed degree bound is less than 8 and the prover sends 32 evaluations, giving a blowup factor of 4. A binary fold takes the degree bound from 8 to 4 and the domain from 32 to 16. The next folds take them to 2 over 8 points and then 1 over 4 points.',
        'Now suppose the verifier opens 40 random query paths and a dishonest table has a fold inconsistency on at least 25 percent of positions at some layer. The chance that all 40 samples miss that layer is at most 0.75 to the 40th power, about 0.00001. More queries push that miss probability down exponentially.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Read Ben-Sasson, Bentov, Horesh, and Riabzev, Fast Reed-Solomon Interactive Oracle Proofs of Proximity, plus the STARK paper for the larger proof-system setting. Study finite fields, Reed-Solomon codes, Merkle trees, Fiat-Shamir transcripts, and polynomial interpolation next.',
        'Then connect FRI to quotient-polynomial checks and trace tables in a STARK. The important bridge is that FRI only checks low degree; the rest of the protocol must make the computation constraints reduce to that low-degree claim.',
      ],
    },
  ],
};
