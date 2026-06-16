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
    { heading: 'What it is', paragraphs: ['The surface code is a quantum error-correcting code. Decoding turns stabilizer measurement changes into a graph problem: detection events are nodes, possible error chains are weighted edges, and matching proposes corrections.'] },
    { heading: 'How it works', paragraphs: ['Repeated syndrome measurements identify changes. The decoder builds a graph with event and boundary nodes, weights edges by error likelihood, then finds a low-weight matching. The resulting chains update the correction frame.'] },
    { heading: 'Case study', paragraphs: ['Four detection events appear across recent rounds. The decoder compares pairings and chooses d1-d2 plus d3-d4 because the total edge weight is smallest. That correction is plausible under the noise model.'] },
    { heading: 'Pitfalls', paragraphs: ['The decoder does not know the actual error. Degenerate errors can share syndromes. A low-weight correction can still create a logical error if the noise model or matching is wrong.'] },
    { heading: 'Why it matters', paragraphs: ['Surface-code decoding is where quantum hardware becomes classical graph processing under tight latency constraints. It connects matching, weighted graphs, streaming syndrome data, and reliability ledgers.'] },
    { heading: 'Sources and study next', paragraphs: ['Study sources: surface-code introduction at https://arthurpesah.me/blog/2023-05-13-surface-code/, Error Correction Zoo surface code page at https://errorcorrectionzoo.org/c/surface, and Riverlane decoding tutorial at https://textbook.riverlane.com/en/latest/notebooks/ch5-decoding-surfcodes/decoding-surface-codes.html. Study Hopcroft-Karp, Min-Cost Max-Flow, Graph BFS, and Quantum Circuit DAG next.'] },
  ],
};
