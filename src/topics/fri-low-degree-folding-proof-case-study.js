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
        'The animation traces FRI from commitment through folding to verification. Active nodes mark the current protocol step. Found markers indicate values the verifier has accepted. Compared nodes show the contracting domain that earlier layers produced.',
        'In the folding-rounds view, watch the evaluation table shrink by half each round. The matrix frames show the even/odd decomposition and the plot tracks domain size versus round number. In the query-proof view, the verifier samples positions after all commitments are fixed and checks both Merkle membership and fold-relation algebra at each sampled index.',
        {
          type: 'note',
          text: 'The commit-then-challenge ordering visible in the animation is load-bearing, not cosmetic. If a commitment appears after its challenge in the transcript, the prover can cheat by tailoring that layer to the already-known randomness.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {
          type: 'quote',
          text: 'The main technical contribution is a new interactive oracle proof of proximity (IOPP) for Reed-Solomon codes... achieving the first linear-time prover for this task.',
          attribution: 'Ben-Sasson, Bentov, Horesh, Riabzev, "Fast Reed-Solomon Interactive Oracle Proofs of Proximity," ICALP 2018',
        },
        'A STARK prover encodes a computation trace as polynomial evaluations over a finite field. The verifier must confirm that the committed evaluation table is close to a low-degree polynomial without reading the whole table. That is the low-degree test problem. Every downstream check in the proof system -- quotient constraints, boundary conditions, permutation arguments -- depends on this guarantee holding first.',
        'FRI (Fast Reed-Solomon Interactive Oracle Proof of Proximity) solves this problem with three properties no earlier low-degree test achieved together: linear prover time, logarithmic verifier time, and no trusted setup. It is the engine inside every STARK-family proof system: StarkWare, Plonky2, Plonky3, RISC Zero, SP1, and Polygon Miden all run FRI or a close descendant.',
        {
          type: 'table',
          headers: ['System', 'FRI variant', 'Field', 'Folding factor', 'Hash function'],
          rows: [
            ['StarkWare (Stone)', 'Classic FRI', 'Goldilocks (p = 2^64 - 2^32 + 1)', '2', 'Pedersen / Poseidon'],
            ['Plonky2', 'FRI with degree-4 extension', 'Goldilocks', '2', 'Poseidon'],
            ['Plonky3', 'FRI with circle STARKs', 'Mersenne-31 (p = 2^31 - 1)', '4', 'Poseidon2'],
            ['RISC Zero', 'FRI inside STARK', 'BabyBear (p = 15 * 2^27 + 1)', '4', 'Poseidon2 / SHA-256'],
            ['SP1 (Succinct)', 'FRI inside STARK', 'BabyBear', '4', 'Poseidon2'],
          ],
        },
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The direct method: send the entire evaluation table to the verifier. The verifier interpolates the polynomial, checks its degree, and accepts or rejects. This works and is simple. Low-degree structure is a global property -- a single corrupted position can raise the degree arbitrarily -- so inspecting everything feels natural.',
        'The problem is that the table is enormous. A zkVM trace for a modest program might produce evaluation tables with millions of rows. If the verifier reads the whole table, verification takes as long as the original computation. The proof has not compressed anything.',
        'A second tempting shortcut: commit to the table with a Merkle tree and open a few random positions. A Merkle authentication path proves that an opened value belongs to the committed table, but it says nothing about whether the table as a whole has low-degree structure. A cheating prover can commit to a table that matches a low-degree polynomial at most positions and deviates at a few, and random spot checks alone cannot distinguish this from a valid table with sufficient probability.',
        {
          type: 'note',
          text: 'This is the key gap. Merkle trees authenticate individual openings. Low-degree tests validate global algebraic structure. A proof system needs both, and neither substitutes for the other.',
        },
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is bridging a global algebraic claim to local verifier checks. A table can agree with a degree-d polynomial at 99% of positions and still be distance 0.01 from the Reed-Solomon code. Spot-checking raw values cannot distinguish "close to low-degree" from "carefully corrupted" unless the protocol adds algebraic structure to the checks.',
        'A second wall is adaptive cheating. If the prover sees the verifier\'s query positions before committing, it can repair just those rows. The protocol must force the prover to commit to each layer before later randomness is derived. This commit-then-challenge discipline is not a formality. It is the mechanism that makes the soundness argument work.',
        {
          type: 'diagram',
          label: 'Why raw spot-checks fail',
          text: 'Table T (1024 entries):   [v0] [v1] [v2] ... [v1023]\n                            |    |    |         |\nTrue low-degree poly f:    f(w0) f(w1) f(w2)   f(w1023)\n\nCorrupted table T\':        [v0] [v1] [XX] ... [v1023]\n                                       ^^\n                              T\' differs from f at 10 positions.\n                              Random check hits a corrupted position\n                              with probability 10/1024 ~ 1%.\n                              Even 50 random checks miss all 10\n                              corrupted positions ~60% of the time.\n\nFRI fixes this: folding propagates corruption across layers,\nso a few corrupted positions in layer 0 cause many failures\nin the fold-relation checks across layers.',
        },
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'FRI reduces one large low-degree claim to a sequence of smaller low-degree claims via random folding. Each round splits the polynomial into even and odd coefficient components, combines them with a verifier-chosen random challenge, and produces a new polynomial of half the degree over half the domain. After log(n) rounds, the polynomial is small enough to send in full.',
        'The magic is that corruption does not fold cleanly. If the original table is far from any low-degree polynomial, the folded tables will fail the fold-relation check at many positions -- not just the corrupted ones. Folding amplifies inconsistency. A table that deviates from low-degree structure at k positions in layer 0 is overwhelmingly likely to produce fold-relation failures at O(k) positions in the next layer, because the even-odd split entangles every pair of domain elements.',
        {
          type: 'code',
          language: 'text',
          text: 'Core folding identity:\n\n  Given polynomial p(x) of degree < d, write:\n    p(x) = p_even(x^2) + x * p_odd(x^2)\n\n  where:\n    p_even has the even-index coefficients of p\n    p_odd  has the odd-index coefficients of p\n    both have degree < d/2\n\n  Verifier sends random challenge alpha.\n  Prover computes folded polynomial:\n    p\'(y) = p_even(y) + alpha * p_odd(y)\n\n  p\' has degree < d/2, evaluated over domain D\' = {x^2 : x in D}\n  |D\'| = |D| / 2  (because domain elements pair up: w and -w map to w^2)',
        },
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The FRI protocol proceeds in two phases: a commit phase that builds the folding layers, and a query phase that spot-checks consistency across layers.',
        {
          type: 'diagram',
          label: 'FRI protocol flow',
          text: 'COMMIT PHASE                          QUERY PHASE\n\nProver                 Verifier        Prover              Verifier\n  |                      |               |                   |\n  |-- commit(root_0) --> |               |                   |\n  |                      |               |                   |\n  | <-- challenge a_0 -- |               |                   |\n  |                      |               |                   |\n  |  [fold: p_1 = fold(p_0, a_0)]        |                   |\n  |                      |               |                   |\n  |-- commit(root_1) --> |               |                   |\n  |                      |               |                   |\n  | <-- challenge a_1 -- |               |                   |\n  |                      |               |                   |\n  |  [fold: p_2 = fold(p_1, a_1)]        |                   |\n  |                      |               |                   |\n  |   ... k rounds ...   |               |                   |\n  |                      |               |                   |\n  |-- send final poly -> |    <-- query positions q_1..q_t --|\n  |                      |               |                   |\n  |                      |    -- open values + Merkle paths ->|\n  |                      |               |                   |\n  |                      |          [verify each query:      |\n  |                      |           1. Merkle path valid?   |\n  |                      |           2. fold relation holds? |\n  |                      |           3. final poly matches?] |',
        },
        'Step 1: The prover evaluates the polynomial p_0 over a domain D_0 of size n (typically n = rho * d where rho is the blowup factor, commonly 2 to 8, and d is the degree bound). The prover builds a Merkle tree over these evaluations and sends root_0 to the verifier.',
        'Step 2: The verifier returns a random field element alpha_0. The prover computes the folded polynomial p_1(y) = p_even(y) + alpha_0 * p_odd(y), evaluates it over the squared domain D_1 = {x^2 : x in D_0}, commits via root_1, and sends that commitment.',
        'Step 3: Repeat for k rounds. Each round halves the degree bound and the domain size. After k rounds, the remaining polynomial has degree < d / 2^k. When that degree is small enough (typically 0 to 15), the prover sends the final polynomial coefficients in the clear.',
        'Step 4: The verifier picks t random query positions in D_0. For each query index i, the prover opens the values at position i and its "sibling" (the paired domain element that maps to the same squared value) across all layers, along with Merkle authentication paths.',
        'Step 5: The verifier checks three things per query. First, each Merkle path authenticates against the committed root. Second, the opened values from layer j and layer j+1 satisfy the fold relation under challenge alpha_j. Third, the final opened value matches the sent polynomial evaluated at the appropriate point.',
        {
          type: 'note',
          text: 'The sibling pairing is essential. Domain element w and its conjugate -w both map to w^2 under squaring. The fold relation needs both p(w) and p(-w) to verify that the folded value p\'(w^2) = (p(w) + p(-w))/2 + alpha * (p(w) - p(-w))/(2w). One query position always opens two values in the layer above.',
        },
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The soundness argument has two parts: the folding reduction and the query amplification.',
        'Folding reduction: if the committed table f_0 is delta-far from every polynomial of degree < d (meaning at least delta * |D_0| positions must change to reach any degree-d codeword), then after one honest fold with a random alpha, the folded table f_1 is at least delta-far from every polynomial of degree < d/2, except with probability d / |F| over the choice of alpha. This is because an honest fold of a low-degree polynomial always produces a low-degree result, so if the folded result is close to low-degree, the original must have been close as well (the contrapositive). The field must be large enough that d / |F| is negligible.',
        'Query amplification: after k folding rounds, the verifier samples t independent query positions. Each query catches a fold-relation violation with probability at least delta (since at least delta fraction of positions are inconsistent). The probability of all t queries missing every violation is at most (1 - delta)^t. For delta = 0.5 and t = 80, this is less than 2^{-80}.',
        {
          type: 'table',
          headers: ['Queries (t)', 'Cheating probability (delta=0.5)', 'Security bits'],
          rows: [
            ['20', '(1/2)^20 ~ 10^{-6}', '~20'],
            ['40', '(1/2)^40 ~ 10^{-12}', '~40'],
            ['80', '(1/2)^80 ~ 10^{-24}', '~80'],
            ['128', '(1/2)^128 ~ 10^{-39}', '~128'],
          ],
        },
        'The key invariant across the entire protocol: every commitment must be fixed in the transcript before the challenge it depends on is derived. This is what prevents the prover from retroactively adjusting a layer to satisfy the fold relation at queried positions. In the non-interactive (Fiat-Shamir) setting, challenges are hash outputs that include all prior commitments, enforcing this ordering cryptographically.',
      ],
    },
    {
      heading: 'The Reed-Solomon view',
      paragraphs: [
        'FRI is not just a polynomial test. It is a proximity test for Reed-Solomon codes. A Reed-Solomon code RS[F, D, d] is the set of all evaluation tables {(x, f(x)) : x in D} where f is a polynomial of degree < d over field F. The minimum distance of this code is |D| - d + 1: any two distinct codewords differ in at least |D| - d + 1 positions.',
        'The blowup factor rho = |D| / d controls the code rate. With rho = 2, the code rate is 1/2, and any table that is more than 1/4 of positions away from the nearest codeword will be caught. Higher blowup factors give better distance at the cost of larger evaluation domains and more prover work.',
        {
          type: 'table',
          headers: ['Blowup factor (rho)', 'Code rate', 'Minimum relative distance', 'Prover cost multiplier', 'Typical use'],
          rows: [
            ['2', '1/2', '1/2', '1x (baseline)', 'Research / small proofs'],
            ['4', '1/4', '3/4', '~2x', 'Most production STARKs'],
            ['8', '1/8', '7/8', '~4x', 'Maximum soundness margin'],
          ],
        },
        'This coding-theory view explains why FRI works at all. The evaluation table is a codeword in a code with large minimum distance. A table far from the code must differ from every valid codeword at many positions. Folding preserves this distance structure: a far-from-code table folds into another far-from-code table. Random queries then exploit the distance to catch the inconsistency.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'FRI achieves asymptotically optimal prover work for a Reed-Solomon proximity test.',
        {
          type: 'table',
          headers: ['Metric', 'Complexity', 'Concrete example (d = 2^20, rho = 4, t = 80)'],
          rows: [
            ['Prover time', 'O(n) field ops + O(n) hashes', '~4M field mults + ~4M hashes'],
            ['Verifier time', 'O(t * k) field ops + O(t * k * log n) hash checks', '~1600 field mults + ~25K hashes'],
            ['Proof size', 'O(t * k * log n) hash digests + final poly', '~50 KB with 32-byte hashes'],
            ['Rounds (k)', 'log_2(d) or log_f(d) for folding factor f', '20 rounds (factor 2) or 10 (factor 4)'],
          ],
        },
        'The prover cost is dominated by NTT (Number Theoretic Transform) operations for evaluation and Merkle tree construction. Each folding round processes a table half the size of the previous one, so total prover work sums to roughly 2n -- the geometric series converges. Verifier work is proportional to t * k * log(n), which is polylogarithmic in the original table size.',
        'The proof-size tax is real. Each query opens values and Merkle paths across k layers. With t = 80 queries, k = 10 folding rounds, and 32-byte hash digests, authentication paths alone consume tens of kilobytes. Compare this to a KZG polynomial commitment opening, which is a single 48-byte elliptic curve point regardless of polynomial degree.',
        {
          type: 'table',
          headers: ['Commitment scheme', 'Setup', 'Proof size (opening)', 'Verifier cost', 'Post-quantum'],
          rows: [
            ['FRI (hash-based)', 'None (transparent)', '~50-200 KB', 'O(polylog n)', 'Yes'],
            ['KZG (pairing-based)', 'Trusted setup (SRS)', '48 bytes', 'O(1) pairings', 'No'],
            ['IPA (discrete-log)', 'None (transparent)', 'O(log n) group elements', 'O(n) group ops', 'No'],
          ],
        },
        'When n doubles, the prover does roughly 2x more work, the proof grows by one additional folding layer (adding t * log(2n) hash digests per query), and the verifier does slightly more work per query. The dominant practical cost for the prover is memory: building Merkle trees over multi-million-row tables requires holding the full layer in RAM.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Trace through FRI on a toy example: degree bound d = 4, blowup factor rho = 2, domain size n = 8, field F = Z_97 (integers mod 97), two folding rounds, two query positions.',
        {
          type: 'code',
          language: 'text',
          text: 'Setup:\n  Polynomial: p(x) = 3x^3 + 7x^2 + 2x + 5   (degree 3 < d = 4)\n  Domain D_0 = {1, 96, 22, 75, 46, 51, 35, 62}  (8th roots of unity in Z_97)\n  Evaluations:\n    p(1)  = 3+7+2+5      = 17\n    p(96) = 3(-1)^3+7(1)+2(-1)+5 = -3+7-2+5 = 7   (since 96 = -1 mod 97)\n    p(22) = 3(22^3)+7(22^2)+2(22)+5 mod 97   = 71\n    ... (compute all 8 values)\n\n  Prover commits: root_0 = MerkleRoot([17, 7, 71, ...])',
        },
        {
          type: 'code',
          language: 'text',
          text: 'Round 1:\n  Verifier sends alpha_0 = 41 (random challenge)\n\n  Split p(x) = p_even(x^2) + x * p_odd(x^2):\n    p_even(y) = 7y + 5       (coefficients of x^0 and x^2)\n    p_odd(y)  = 3y + 2       (coefficients of x^1 and x^3)\n\n  Folded polynomial:\n    p_1(y) = p_even(y) + 41 * p_odd(y)\n           = (7y + 5) + 41*(3y + 2)\n           = 7y + 5 + 123y + 82\n           = 130y + 87\n           = 33y + 87 mod 97    (degree 1 < d/2 = 2)\n\n  Domain D_1 = {1^2, 96^2, 22^2, 75^2} mod 97 = {1, 96, 96, 1}\n  Wait -- 1 and 96 pair to 1, and 22 and 75 pair to D_1 elements.\n  D_1 = {1, 96, 22^2 mod 97, 75^2 mod 97} = 4 distinct elements\n\n  Prover evaluates p_1 over D_1, commits root_1.',
        },
        {
          type: 'code',
          language: 'text',
          text: 'Round 2:\n  Verifier sends alpha_1 = 73\n  Fold again: p_2 is a constant (degree 0 < d/4 = 1)\n  Prover sends p_2 in the clear.\n\nQuery phase:\n  Verifier picks query index i = 2 (position in D_0).\n  Prover opens:\n    Layer 0: p(w^2) and p(w^6)  [sibling pair, since w^2 and w^6 = -w^2]\n    Layer 1: p_1(w^4)           [the squared position]\n    Merkle paths for all opened values.\n\n  Verifier checks:\n    1. Merkle paths verify against root_0 and root_1.\n    2. Fold relation: p_1(w^4) = (p(w^2) + p(w^6))/2 + alpha_0 * (p(w^2) - p(w^6))/(2*w^2)\n    3. Final value matches p_2 evaluated at the corresponding point.\n\n  Repeat for second query index. Both pass => accept.',
        },
        'If the prover had committed to a corrupted table -- say, changing p(w^2) to an arbitrary value -- the fold-relation check at query index 2 would fail with high probability, because the opened values from layer 0 would not fold correctly into the committed layer 1 value.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'FRI is the low-degree test inside every production STARK system. The concrete applications are expanding rapidly.',
        {
          type: 'bullets',
          items: [
            'zkVM provers (RISC Zero, SP1, Valida): a virtual machine executes arbitrary programs, records an execution trace, arithmetizes it as polynomial constraints, and uses FRI to prove the trace polynomials are low-degree. The verifier checks the proof without re-executing the program.',
            'Blockchain rollups (StarkNet, Polygon zkEVM): off-chain provers batch thousands of transactions, generate a STARK proof (with FRI inside), and post the proof on-chain. The on-chain verifier checks the proof in O(polylog n) time, enabling scalable throughput without trusting the prover.',
            'Recursive proof composition (Plonky2/3): a STARK proof is verified inside another STARK circuit. FRI is used at every recursion level. The folding structure is amenable to recursive verification because each layer is smaller than the last.',
            'Private computation (zkSTARKs for ML inference): a prover demonstrates that a neural network produced a specific output on a specific input without revealing the model weights. FRI provides the low-degree guarantee for the arithmetized inference trace.',
          ],
        },
        'FRI wins when three conditions hold: (1) a trusted setup is unacceptable or impractical, (2) the prover can afford linear-time work over large domains, and (3) proof size in the tens-to-hundreds of kilobytes range is tolerable. It also wins when post-quantum security matters, since its security relies only on collision-resistant hashing, not on discrete-log or pairing assumptions.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'FRI is not a general-purpose proof of computation. It proves one specific claim: a committed evaluation table is close to a low-degree polynomial. Everything else -- constraint satisfaction, boundary conditions, permutation arguments, lookup tables -- is built on top of that guarantee by other protocol components. If the arithmetization is wrong, FRI will happily prove that a meaningless polynomial is low-degree.',
        {
          type: 'table',
          headers: ['Failure mode', 'Root cause', 'Consequence'],
          rows: [
            ['Challenge before commitment', 'Transcript ordering bug', 'Prover can adaptively choose layer values to pass fold checks'],
            ['Insufficient queries', 'Security parameter too low', 'Cheating probability exceeds target (e.g., 2^{-40} instead of 2^{-128})'],
            ['Domain mismatch', 'Squared domain computed incorrectly', 'Fold relation checks pass vacuously or fail on honest proofs'],
            ['Missing sibling openings', 'Query logic skips paired element', 'Fold relation cannot be verified; verifier accepts without checking'],
            ['Hash collision exploitation', 'Weak hash function or short digest', 'Prover forges Merkle paths to open fake values'],
            ['Grinding attacks', 'Fiat-Shamir transcript too malleable', 'Prover tries many nonces to steer challenges favorably'],
          ],
        },
        'Proof size is the persistent practical weakness. A FRI proof for a degree-2^20 polynomial with 128-bit security might be 100-400 KB, depending on parameters. In contrast, a Groth16 proof (with a trusted setup) is 192 bytes. For on-chain verification where calldata is expensive, this size difference translates directly to cost. Recursive composition (wrapping a STARK proof inside a SNARK) is one mitigation, but it adds complexity and reintroduces setup assumptions at the outer layer.',
        {
          type: 'note',
          text: 'The most common FRI bug in production systems is not a math error. It is a transcript-ordering error: absorbing a commitment after deriving a challenge that should depend on it, or failing to include domain-separation tags that prevent cross-protocol Fiat-Shamir attacks.',
        },
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        {
          type: 'code',
          language: 'python',
          text: '# Simplified FRI commit phase (illustrative, not production)\ndef fri_commit(evaluations, domain, n_rounds, transcript):\n    layers = [evaluations]\n    roots = []\n    challenges = []\n    for r in range(n_rounds):\n        # Commit current layer\n        tree = build_merkle_tree(layers[-1])\n        roots.append(tree.root)\n        transcript.absorb(tree.root)       # commitment BEFORE challenge\n        # Derive challenge from transcript\n        alpha = transcript.squeeze_challenge()\n        challenges.append(alpha)\n        # Fold: combine paired evaluations\n        prev = layers[-1]\n        folded = []\n        half = len(prev) // 2\n        for i in range(half):\n            # prev[i] = p(w^i), prev[i + half] = p(-w^i) = p(w^{i+half})\n            even = (prev[i] + prev[i + half]) / 2\n            odd  = (prev[i] - prev[i + half]) / (2 * domain[i])\n            folded.append(even + alpha * odd)\n        layers.append(folded)\n    # Send final small polynomial in the clear\n    transcript.absorb(layers[-1])\n    return layers, roots, challenges',
        },
        'The critical implementation discipline: every transcript.absorb(commitment) must precede the transcript.squeeze_challenge() that depends on it. Swapping these two lines is the single most dangerous FRI bug, and type systems do not catch it.',
        {
          type: 'bullets',
          items: [
            'Type your domain elements, coset offsets, and field extensions separately. Most FRI bugs are not arithmetic errors; they are index or domain-membership errors between layers.',
            'Log proof parameters in metadata: domain size, blowup factor, folding factor, number of query rounds, hash function, field, final-degree threshold, and target security level.',
            'Test with adversarial inputs: commit to a table that is exactly 1 position away from a valid codeword and verify that the protocol rejects it with the expected probability.',
            'Profile memory before scaling up. Building Merkle trees over 2^24 field elements requires holding the entire layer in RAM. Streaming or pipelined Merkle construction can reduce peak memory by 2x.',
            'Benchmark all four dimensions: prover time, verifier time, proof size, and peak prover memory. Optimizing any one at the expense of others is a common trap.',
          ],
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Primary source: Ben-Sasson, Bentov, Horesh, Riabzev, "Fast Reed-Solomon Interactive Oracle Proofs of Proximity," ICALP 2018, https://drops.dagstuhl.de/entities/document/10.4230/LIPIcs.ICALP.2018.14 -- the original FRI paper, defining the folding protocol and proving soundness.',
            'Tutorial: StarkWare, "Anatomy of a STARK," parts I-VI, https://aszepieniec.github.io/stark-anatomy/ -- a step-by-step implementation walkthrough connecting FRI to the full STARK pipeline.',
            'Implementation reference: RISC Zero FRI documentation, https://dev.risczero.com/reference-docs/about-fri -- production parameter choices and engineering tradeoffs.',
            'Circle STARKs: Haboeck, Levit, Nardi, "Circle STARKs," 2024, https://eprint.iacr.org/2024/278 -- FRI adapted to circle groups over Mersenne primes, used in Plonky3.',
          ],
        },
        {
          type: 'table',
          headers: ['Role', 'Topic', 'Why'],
          rows: [
            ['Prerequisite', 'Merkle Tree', 'FRI commitments are Merkle roots; understanding authentication paths is required to follow query verification'],
            ['Prerequisite', 'Finite Fields', 'All FRI arithmetic happens in a prime field or extension field; roots of unity define the evaluation domain'],
            ['Extension', 'ZK-SNARK Arithmetization', 'FRI proves low-degree proximity; arithmetization is the step that creates the polynomials FRI tests'],
            ['Contrast', 'KZG Polynomial Commitments', 'KZG achieves constant-size openings with a trusted setup; comparing it to FRI clarifies the transparency-vs-size tradeoff'],
            ['Application', 'zkVM Execution Trace AIR', 'The main consumer of FRI in practice; traces how a virtual machine execution becomes polynomial constraints that FRI validates'],
          ],
        },
      ],
    },
  ],
};
