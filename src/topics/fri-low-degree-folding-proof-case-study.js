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
      heading: 'Why this exists',
      paragraphs: [
        "A STARK-style proof wants a verifier to trust a large computation without redoing it. The prover turns the computation into tables of field elements and algebraic constraints. The verifier cannot read the whole table, but it needs confidence that the committed data has the low-degree structure promised by the arithmetization.",
        "FRI, the Fast Reed-Solomon Interactive Oracle Proof of Proximity, is the low-degree testing engine behind many transparent proof systems. It lets a prover commit to a large evaluation table and lets a verifier use random queries to test whether that table is close to evaluations of a low-degree polynomial. That is the bridge from a huge table to a small verification procedure.",
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        "The direct method is to inspect the whole table. If the verifier sees every value, it can interpolate or run a complete low-degree check. That is a reasonable starting point because low-degree structure is a global property. You cannot prove it from one row in isolation.",
        "The direct method defeats succinct verification. If the verifier does work proportional to the committed table, the proof has not compressed the computation. A second tempting shortcut is a Merkle root. A Merkle path proves that an opened value belongs to a committed table. It does not prove that the table is close to any low-degree polynomial.",
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        "The wall is testing a global algebraic claim with local openings. A malicious prover can commit to a table that looks plausible at many positions but is far from every low-degree codeword. The verifier needs a protocol that forces local checks to reflect global structure with high probability.",
        "The prover must also be bound before the verifier chooses positions. If the prover could adapt the table after seeing the query, it could repair only the sampled rows. Commitments, random challenges, and transcript order are not ceremony. They are the mechanism that prevents an adaptive table from pretending to be low degree.",
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        "FRI reduces one large low-degree claim into a sequence of smaller low-degree claims. A round splits the polynomial into even and odd parts, combines them with a random challenge, and produces a folded table over a smaller domain. If the original table came from a low-degree polynomial, the folded table should also match the corresponding lower-degree object.",
        "After enough folds, the table becomes small enough to check directly. The verifier then samples positions across the layers. For each sampled position, the prover opens values and authentication paths, and the verifier checks that adjacent layers satisfy the fold relation. The protocol turns one expensive global check into many cheap consistency checks tied together by randomness.",
      ],
    },
    {
      heading: 'The Reed-Solomon view',
      paragraphs: [
        "A low-degree polynomial evaluated over a domain is a Reed-Solomon codeword. That codeword has distance: a table that is far from the code cannot be changed into a valid low-degree evaluation table without modifying many positions. FRI is a proof of proximity, so the verifier asks whether the committed table is close enough to that code.",
        "This framing matters because the verifier usually does not need the polynomial itself. It needs assurance that the committed values are consistent with a low-degree polynomial. Once that is true, other parts of the proof system can rely on polynomial identities, quotient checks, and boundary constraints. FRI supplies the low-degree discipline those later checks need.",
      ],
    },
    {
      heading: 'How folding works',
      paragraphs: [
        "Conceptually, write a polynomial p(x) as p_even(x^2) + x p_odd(x^2). A verifier challenge alpha combines the even and odd pieces into a new polynomial, often described as p_even + alpha p_odd under the appropriate domain mapping. The new polynomial has lower degree, and its evaluation table is smaller.",
        "The exact folding factor and domain choices vary by implementation. The teaching version halves the table because it exposes the invariant cleanly: each round reduces the problem size while preserving a checkable relation between old values and new values. Practical systems may fold by larger factors, but the logic is the same: commit to the next layer before later randomness is known.",
      ],
    },
    {
      heading: 'Commitments and queries',
      paragraphs: [
        "Each layer is committed, commonly with a Merkle tree. The root binds the prover to that layer. After the commitments are fixed, the verifier derives or samples query positions. The prover returns opened leaves and Merkle authentication paths for the relevant positions across the FRI layers.",
        "A query packet has two jobs. First, it proves membership: these values are the ones under the previously committed roots. Second, it proves algebra: the opened values from one layer fold into the opened value in the next layer under the verifier's challenge. Passing one query is not enough. Passing enough independent queries makes a far-from-low-degree table unlikely to survive.",
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        "Low-degree polynomials are rigid. If two low-degree polynomials agree at many points, they are heavily constrained. If a table is far from every low-degree polynomial, random folding and random openings make it hard to keep satisfying the layer relations. The prover can get lucky on a few samples, but each query applies pressure to a different part of the committed structure.",
        "The soundness is probabilistic and parameterized. Domain size, code rate, blowup factor, folding schedule, number of queries, hash security, and Fiat-Shamir transcript discipline all matter. FRI does not say that one sampled row proves the table. It says that enough committed folding rounds and enough random queries make cheating probability small under the chosen parameters.",
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        "FRI gives a verifier far less work than scanning the whole table. The original paper frames FRI as a Reed-Solomon proximity test with linear prover work and logarithmic verifier arithmetic in the domain size, under its model and parameters. Practical STARK systems also pay for hashing, Merkle paths, transcript operations, field arithmetic, and proof serialization.",
        "The proof-size tax is real. Hash-based transparency avoids a trusted setup and pairing assumptions, but Merkle authentication paths and multiple query rounds use bytes. KZG-style polynomial commitments can give smaller openings under different assumptions and setup requirements. FRI is attractive when transparent setup and scalable proving matter more than minimizing every proof byte.",
      ],
    },
    {
      heading: 'Worked case study',
      paragraphs: [
        "A zkVM prover runs a program and records a machine trace: program counters, registers, memory events, opcodes, and helper columns. The arithmetization turns transition rules and boundary conditions into polynomial constraints over evaluation domains. The prover commits to the relevant evaluation tables.",
        "FRI enters after those commitments. The prover folds the low-degree claim through several committed layers. The verifier samples positions, checks Merkle paths, checks fold equations, and finally checks the last small polynomial. The verifier never reads the full machine trace, but it gains confidence that the committed polynomial data has the low-degree structure required by the proof.",
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        "FRI is a strong fit for transparent STARK systems, zkVMs, rollup provers, and proof systems where avoiding a trusted setup is a major design goal. It pairs naturally with hash commitments and random-oracle transcript challenges. It also teaches a central proof-system idea: commitments bind large data, randomness chooses pressure points, and algebraic structure lets small checks say something global.",
        "It wins educationally because it separates two concerns that beginners often mix. Merkle trees authenticate openings. Low-degree tests establish algebraic structure. A STARK verifier needs both. Authentication alone only says the prover opened the committed row; FRI says the committed table behaves like a low-degree codeword with high probability.",
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        "FRI is not a magic proof of arbitrary computation. It proves proximity to low-degree structure inside a larger proof system. If the arithmetization is wrong, if the public statement is bound incorrectly, or if the transcript omits a commitment, a valid FRI check can still support the wrong claim.",
        "Common implementation mistakes include deriving challenges before commitments are fixed, using too few queries, mixing domains incorrectly, forgetting paired openings needed by the fold relation, underestimating proof bytes, treating hash collision resistance as a side issue, and comparing proof systems only by verifier time while hiding prover memory and serialization cost.",
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        "Keep the transcript order explicit. Every commitment that a challenge depends on must be absorbed before that challenge is derived. Keep domain definitions, cosets, field choices, folding factors, and query indexes typed or otherwise hard to mix. Most FRI bugs are not arithmetic difficulty; they are boundary mistakes between layers.",
        "Expose parameters in proof metadata. A verifier should know domain size, blowup factor, folding schedule, number of query rounds, hash function, field, final-degree threshold, and security target. A benchmark should report prover time, verifier time, proof size, peak memory, and any batching or recursion assumptions.",
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        "Primary sources: Fast Reed-Solomon Interactive Oracle Proofs of Proximity at https://drops.dagstuhl.de/entities/document/10.4230/LIPIcs.ICALP.2018.14 and RISC Zero's FRI docs at https://dev.risczero.com/reference-docs/about-fri.",
        "Study Merkle Tree for authentication paths, Finite Fields for arithmetic, Reed-Solomon codes for the codeword view, ZK-SNARK Arithmetization for the constraint pipeline, zkVM Execution Trace AIR for the trace-to-polynomial bridge, and KZG Polynomial Commitments for a contrasting commitment family.",
      ],
    },
  ],
};
