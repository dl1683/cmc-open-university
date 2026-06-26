// Surface-code decoding: syndrome changes become graph nodes, candidate error
// chains become weighted edges, and matching proposes a correction.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'surface-code-syndrome-matching-case-study',
  title: 'Surface Code Syndrome Matching Case Study',
  category: 'Security',
  summary: 'A quantum error-correction case study: stabilizer checks, syndrome changes, detection-event graph, boundary nodes, minimum-weight matching, correction chains, and logical-failure risk.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['syndrome graph', 'matching decode'], defaultValue: 'syndrome graph' },
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

function decodeGraph(title) {
  return graphState({
    nodes: [
      { id: 'd1', label: 'd1', x: 1.2, y: 2.0, note: 'event' },
      { id: 'd2', label: 'd2', x: 3.4, y: 4.8, note: 'event' },
      { id: 'd3', label: 'd3', x: 6.2, y: 2.2, note: 'event' },
      { id: 'd4', label: 'd4', x: 7.7, y: 5.2, note: 'event' },
      { id: 'bL', label: 'bL', x: 0.7, y: 5.8, note: 'boundary' },
      { id: 'bR', label: 'bR', x: 9.0, y: 3.4, note: 'boundary' },
      { id: 'corr', label: 'corr', x: 4.8, y: 3.4, note: 'chains' },
    ],
    edges: [
      { id: 'e-d1-d2', from: 'd1', to: 'd2', weight: 3 },
      { id: 'e-d3-d4', from: 'd3', to: 'd4', weight: 2 },
      { id: 'e-d1-bL', from: 'd1', to: 'bL', weight: 4 },
      { id: 'e-d4-bR', from: 'd4', to: 'bR', weight: 3 },
      { id: 'e-d2-corr', from: 'd2', to: 'corr' },
      { id: 'e-d3-corr', from: 'd3', to: 'corr' },
      { id: 'e-corr-bR', from: 'corr', to: 'bR' },
    ],
  }, { title });
}

function* syndromeGraph() {
  yield {
    state: labelMatrix(
      'Check rounds',
      [
        { id: 'r1', label: 'r1' },
        { id: 'r2', label: 'r2' },
        { id: 'r3', label: 'r3' },
        { id: 'r4', label: 'r4' },
      ],
      [
        { id: 'checkA', label: 'A' },
        { id: 'checkB', label: 'B' },
        { id: 'event', label: 'event' },
      ],
      [
        ['0', '0', 'none'],
        ['1', '0', 'A flip'],
        ['1', '1', 'B flip'],
        ['0', '1', 'A flip'],
      ],
    ),
    highlight: { active: ['r2:event', 'r3:event', 'r4:event'], compare: ['r1:event'] },
    explanation: 'A surface-code decoder watches stabilizer measurement changes over repeated rounds. A change creates a detection event.',
  };
  yield {
    state: decodeGraph('Detection events become graph nodes'),
    highlight: { active: ['d1', 'd2', 'd3', 'd4'], compare: ['corr'] },
    explanation: 'The decoder builds a graph whose nodes are detection events and boundaries. Edges represent possible error chains that could explain pairs of events.',
    invariant: 'The decoder sees syndromes, not the actual physical error.',
  };
  yield {
    state: labelMatrix(
      'Edge weights',
      [
        { id: 'short', label: 'short' },
        { id: 'long', label: 'long' },
        { id: 'noisy', label: 'noisy' },
        { id: 'bound', label: 'boundary' },
      ],
      [
        { id: 'weight', label: 'w' },
        { id: 'meaning', label: 'meaning' },
      ],
      [
        ['2', 'likely'],
        ['6', 'less likely'],
        ['3', 'device err'],
        ['4', 'edge'],
      ],
    ),
    highlight: { found: ['short:meaning', 'long:meaning', 'bound:meaning'] },
    explanation: 'Weights encode error likelihood, often based on distance and noise model. Lower-weight chains are more plausible corrections.',
  };
  yield {
    state: decodeGraph('Boundaries absorb single events'),
    highlight: { active: ['bL', 'bR', 'e-d1-bL', 'e-d4-bR'], compare: ['e-d1-d2', 'e-d3-d4'] },
    explanation: 'Boundaries are special nodes. Some error chains can terminate at a boundary rather than another detection event.',
  };
}

function* matchingDecode() {
  yield {
    state: decodeGraph('Minimum-weight matching pairs events'),
    highlight: { active: ['d1', 'd2', 'd3', 'd4', 'e-d1-d2', 'e-d3-d4'], compare: ['bL', 'bR'] },
    explanation: 'A common surface-code decoder uses minimum-weight matching to pair detection events with each other or with boundaries.',
  };
  yield {
    state: labelMatrix(
      'Candidate matchings',
      [
        { id: 'm1', label: 'm1' },
        { id: 'm2', label: 'm2' },
        { id: 'm3', label: 'm3' },
        { id: 'chosen', label: 'chosen' },
      ],
      [
        { id: 'pairs', label: 'pairs' },
        { id: 'weight', label: 'w' },
      ],
      [
        ['d1-d2,d3-d4', '5'],
        ['d1-bL,d4-bR', '7'],
        ['cross', '9'],
        ['m1', 'min'],
      ],
    ),
    highlight: { active: ['m1:weight', 'chosen:pairs', 'chosen:weight'], compare: ['m2:weight', 'm3:weight'] },
    explanation: 'The decoder chooses the lowest-weight explanation, not necessarily the actual error. Degeneracy means several errors can share one syndrome.',
  };
  yield {
    state: decodeGraph('Correction chains update the Pauli frame'),
    highlight: { active: ['corr', 'e-d2-corr', 'e-d3-corr'], found: ['d2', 'd3'], compare: ['bR'] },
    explanation: 'The correction may be applied physically or tracked in a Pauli frame. The goal is to keep logical information intact.',
  };
  yield {
    state: labelMatrix(
      'Decoder ledger',
      [
        { id: 'round', label: 'round' },
        { id: 'events', label: 'events' },
        { id: 'match', label: 'match' },
        { id: 'logic', label: 'logical' },
      ],
      [
        { id: 'stored', label: 'stored' },
        { id: 'why', label: 'why' },
      ],
      [
        ['t', 'history'],
        ['coords', 'decode'],
        ['edges', 'audit'],
        ['risk', 'fail'],
      ],
    ),
    highlight: { found: ['events:why', 'match:why', 'logic:why'] },
    explanation: 'A fault-tolerant system needs a decoder ledger: rounds, events, weights, matchings, corrections, and logical-failure indicators.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'syndrome graph') yield* syndromeGraph();
  else if (view === 'matching decode') yield* matchingDecode();
  else throw new InputError('Pick a surface-code view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read each check round as a measurement of stabilizers, which are parity checks that detect error effects without directly measuring the protected logical qubit. A detection event means a check outcome changed between rounds; it is evidence of an error chain, not the physical error itself.',
        'Edges are hypotheses about which events could share a cause. The safe inference rule is that a correction must have the same syndrome boundary as the observed events, while the exact microscopic error may remain unknown.',
        {type:'callout', text:'Surface-code decoding turns noisy stabilizer histories into a fast classical matching problem whose answer keeps logical state alive.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/a/a2/ToricCodeLattice.png', alt:'Square toric-code lattice with a highlighted vertex stabilizer and plaquette stabilizer.', caption:'Toric code lattice with vertex and plaquette stabilizers; Woottonjames, CC BY 3.0, via Wikimedia Commons.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Physical qubits are noisy devices, so one encoded logical qubit must be protected by many physical qubits. The surface code is a quantum error-correcting code, which means it stores logical information in a pattern where local parity checks reveal error symptoms without revealing the encoded value.',
        'The hardware produces a stream of check outcomes. A classical decoder must turn that stream into a correction quickly enough for the quantum computation to continue.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to find the qubit that flipped and flip it back. That fails as a direct measurement strategy because measuring data qubits would destroy the quantum information the code is trying to protect.',
        'A second simple approach is to fix each changed check locally. That also looks reasonable because the events are local, but errors create patterns across space and time rather than isolated labels.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'A syndrome, meaning the set of changed checks, is indirect evidence. One data error can create two detection events, one measurement error can create time-separated events, and a boundary can absorb a single visible event.',
        'Many physical error chains can produce the same syndrome. The decoder must choose a correction class that preserves the logical qubit, not reconstruct the exact history of every hardware fault.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Convert syndrome changes into a weighted graph. Detection events and boundaries become nodes, and possible error chains become edges with weights based on distance or measured error likelihood.',
        'Decoding becomes minimum-weight matching. The decoder pairs events, or pairs events with boundaries, so the chosen correction is the lowest-cost explanation under the current noise model.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The control system repeats stabilizer checks in rounds. When a check changes from one round to the next, the decoder records a detection event with space coordinates, time coordinate, check type, and boundary options.',
        'A graph builder connects plausible pairs of events and boundary matches. Weights are often related to negative log likelihood, so lower weight means a more likely fault path under the assumed device noise.',
        'A matching solver chooses a set of edges that accounts for all events. The correction is then applied physically or tracked in a Pauli frame, which is a software record of pending Pauli X or Z corrections.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The invariant is syndrome agreement. The proposed correction must create the same visible detection-event boundary as the observed syndrome, so applying it returns the measured checks to the code space.',
        'The logical state survives when the real error and the chosen correction differ only by stabilizers. It fails when their combination forms a logical operator across the code, even if every visible syndrome event was matched.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Cost grows with code distance, number of rounds held in memory, event density, and graph edge count. If distance doubles, the number of checks and recent event positions grows roughly with area and time window, not as a single line.',
        'The solver is only part of the bill. Ingestion, event generation, edge weighting, matching, Pauli-frame updates, latency budgeting, and audit logging all sit on the critical path of a running quantum machine.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Surface-code matching decoders are used in quantum error-correction experiments and simulators because they turn hardware noise records into a concrete classical optimization problem. They are also useful during device bring-up because engineers can inspect events, weights, boundaries, and chosen corrections.',
        'The pattern generalizes as a lesson in probabilistic recovery. The system cannot observe the hidden fault directly, so it chooses the cheapest correction consistent with the evidence and keeps a ledger for later failure analysis.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Matching can be the wrong model when errors are strongly correlated, leakage matters, erasures are available, noise is highly biased, or latency forces approximate local decisions. The graph can be perfect for the simplified model and still bad for the actual device.',
        'It also fails operationally when timestamps drift, boundary rules are wrong, weights are stale, or the Pauli-frame ledger is inconsistent. In those cases the algorithm can match the visible syndrome while the control system applies the wrong logical update.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose four detection events appear: d1, d2, d3, and d4. The graph gives d1-d2 weight 3 and d3-d4 weight 2, so that pairing costs 5; two boundary matches cost 4 and 3, so that alternative costs 7; a crossed pairing costs 9.',
        'Minimum-weight matching chooses cost 5. If the real error plus that correction is a stabilizer, the logical qubit is safe; if their combination crosses the code as a logical X or Z, the syndrome disappears but the encoded computation is wrong.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources include surface-code introductions at https://arthurpesah.me/blog/2023-05-13-surface-code/, the Error Correction Zoo surface-code page at https://errorcorrectionzoo.org/c/surface, and Riverlane decoding material at https://textbook.riverlane.com/en/latest/notebooks/ch5-decoding-surfcodes/decoding-surface-codes.html. Study graph matching, min-cost flow, Dijkstra, stabilizer codes, Pauli frames, and detector error models next.',
      ],
    },
  ],
};
