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
    { heading: 'Why this exists', paragraphs: [
      'Physical qubits are noisy. A useful quantum computer needs logical information to survive bit flips, phase flips, measurement error, leakage, and hardware drift. The surface code is one of the main proposals for doing that with local checks on a two-dimensional layout.',
      'The quantum hardware does not hand the control system a neat list of errors. It hands over repeated stabilizer measurements. The classical decoder has to infer a correction from those measurements quickly enough that the logical computation can continue.',
      'This is why the topic is both quantum and classical. The protected state lives in a code, but the decision problem is an online graph problem running on ordinary hardware. The decoder is part of the machine, not an optional analysis tool after the experiment.',
      {type:'callout', text:'Surface-code decoding turns noisy stabilizer histories into a fast classical matching problem whose answer keeps logical state alive.'},
      {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/a/a2/ToricCodeLattice.png', alt:'Square toric-code lattice with a highlighted vertex stabilizer and plaquette stabilizer.', caption:'Toric code lattice with vertex and plaquette stabilizers; Woottonjames, CC BY 3.0, via Wikimedia Commons.'},
    ] },
    { heading: 'Why the obvious approach fails', paragraphs: [
      'The obvious approach is to find the qubit that flipped and flip it back. That cannot work because the code deliberately avoids measuring the data qubits directly. Measuring them would reveal and damage the logical information. Instead, the machine measures stabilizer checks that say whether local parity constraints changed.',
      'A syndrome is therefore indirect evidence. It tells the decoder that something changed near a check at a round in time, not which data qubit was hit. Measurement itself can also be wrong, so a changed check might come from a data error, a measurement error, or a short-lived hardware fault. Correcting the nearest visible qubit is not a well-defined strategy.',
      'The next naive approach is to make every local syndrome change disappear independently. That also fails because errors create patterns. A single physical error can produce two detection events. A chain of errors can connect distant events. Some chains can end at boundaries. The decoder must explain the whole syndrome history, not each event in isolation.',
    ] },
    { heading: 'The core insight', paragraphs: [
      'A change in syndrome is a detection event. Possible physical error chains become weighted edges between events and boundaries. Decoding becomes a graph problem: pair events with low total error cost.',
      'The decoder does not observe the true error directly. It chooses a likely correction consistent with the syndrome history and noise model. If the correction and the real error differ only by stabilizers, the logical state survives. If their combination forms a logical operator, the code fails.',
      'Minimum-weight matching is useful because many common surface-code noise models produce endpoint-pairing problems. Detection events appear in pairs or terminate at boundaries, and lower-weight paths represent more likely error chains.',
    ] },
    {
      heading: 'Visual guide',
      paragraphs: [
        'In the syndrome-graph view, each event is a changed stabilizer outcome across rounds. The event is not the physical error. It is a clue that some error chain ended nearby in space-time.',
        'In the matching view, edges are hypotheses. A low-weight edge means the noise model thinks that chain is plausible. The chosen matching is the lowest-cost explanation among candidates, not a guarantee that the real hardware error was exactly that chain.',
        'The boundary nodes matter. A visible event does not always need a visible partner. Some error chains can disappear into a code boundary, and a decoder that forgets boundaries will force bad pairings.',
      ],
    },
    { heading: 'How it works', paragraphs: [
      'Repeated syndrome rounds produce detection events across space and time. The decoder builds a matching graph, weights edges by error likelihood, and finds a low-weight matching. The matched paths update a Pauli frame or trigger physical correction.',
      'With four events, the decoder compares pairings such as d1-d2 plus d3-d4 against alternatives. The lowest-weight pairing is the correction that best fits the assumed noise model.',
      'Boundaries matter because not every event must pair with another event. Some error chains can terminate at a code boundary. A realistic graph therefore includes boundary nodes and time-like edges as well as space-like edges.',
      'The graph is usually built from a detector error model or an equivalent noise model. A candidate edge says: if this kind of physical fault happened, these detection events would appear. The edge weight is commonly related to the negative log likelihood of that fault. Matching then turns maximum-likelihood intuition into a shortest-total-weight pairing problem.',
    ] },
    { heading: 'Syndrome rounds and time', paragraphs: [
      'Surface-code decoding is not just a two-dimensional picture. Repeated check rounds add time as a third axis. A data error can create neighboring events in space. A measurement error can create neighboring events in time because one round disagrees with the rounds before and after it.',
      'That time structure is important operationally. The decoder receives a stream of check outcomes, converts changes into events, and keeps enough recent history to match events whose partners may arrive in later rounds. It has to decide when an event is old enough to finalize and when waiting for more context is worth the latency.',
      'A clean implementation records round number, check identity, coordinates, detector type, boundary options, and raw measurement references. Without that ledger, a decoded correction cannot be audited after a logical failure.',
    ] },
    { heading: 'Boundary and degeneracy', paragraphs: [
      'Boundaries are not special cases bolted onto the algorithm. They are part of the code geometry. Rough and smooth boundaries allow certain error chains to terminate without another detection event. Matching to a boundary can be the correct low-cost explanation.',
      'Degeneracy is the other important idea. Many different physical error chains can have the same syndrome and the same logical effect. The decoder does not need to recover history exactly. It needs to choose a correction class that returns the state to the code space without applying a logical operator.',
      'This is why a matching decoder can succeed even when its guessed chain is not the real chain. If the guessed correction and the actual error differ by stabilizers, the logical information is unchanged. If they differ by a logical X or Z, the syndrome can look fixed while the encoded qubit has failed.',
    ] },
    { heading: 'Why it works', paragraphs: [
      'Errors create syndrome endpoints. Pairing endpoints proposes chains whose boundary matches the observed syndrome. If the proposed correction and actual error differ only by stabilizers, the logical state is preserved.',
      'Failure happens when the decoder chooses a correction that combines with the real error into a logical operator. That can happen even when the syndrome is matched perfectly.',
      'Minimum-weight matching works for the simplified model because the syndrome constraints require endpoints to be paired, and edge weights encode how unlikely each connecting chain is. Choosing the minimum total weight gives the most likely explanation under that model. The model can be wrong, but the optimization problem is clear.',
    ] },
    { heading: 'Cost and behavior', paragraphs: [
      'Decoding has a latency budget. Syndrome rounds arrive continuously, and the classical decoder must keep up with the quantum hardware. Better matching accuracy can cost more time.',
      'A production decoder needs a ledger: rounds, events, edge weights, chosen matchings, correction frame, and logical-failure indicators. Without it, failures are almost impossible to debug.',
      'Cost grows with code distance, number of rounds, event density, and graph construction. Matching itself is only part of the system. The pipeline also has measurement ingestion, event generation, edge weighting, batching, hardware feedback, and audit logging.',
      'There is also a memory tradeoff. Keeping more history helps match delayed partners and diagnose faults, but it increases buffering and can delay decisions. Streaming decoders often commit old regions after a window, accepting that some rare long-range ambiguity will be resolved approximately.',
    ] },
    { heading: 'Implementation guidance', paragraphs: [
      'Start by making the data model explicit. Store raw check outcomes separately from detection events. Store detection events separately from candidate edges. Store chosen matchings separately from the Pauli frame. Those separations make it possible to test each layer and to replay a failure with the same inputs.',
      'Use weights that match the hardware you are actually modeling. A toy distance weight is useful for learning, but production decoding needs measurement-error rates, data-error rates, boundary behavior, leakage handling, and sometimes correlated faults. If the weights are stale or too simple, the graph algorithm can be perfect and still choose poor corrections.',
      'Test with injected errors whose logical effect is known. Include single data errors, measurement errors, boundary-ending chains, chains near corners, repeated rounds with no events, high-density event bursts, and ambiguous cases where several matchings have similar weight. The confidence gap between best and second-best matching is often as important as the best matching itself.',
    ] },
    { heading: 'Where it wins', paragraphs: [
      'Matching decoders work well for surface-code noise models that can be represented as weighted event graphs. They make quantum error correction a concrete graph algorithm.',
      'They also win pedagogically. The surface code can feel abstract until syndrome changes become graph nodes and candidate corrections become edges. Once framed that way, the decoder is recognizably a weighted graph problem.',
      'They are also useful because the result is inspectable. Engineers can look at events, candidate weights, boundary choices, and correction chains instead of treating the decoder as a black box. That makes calibration, benchmarking, and hardware bring-up much easier.',
    ] },
    { heading: 'Where it fails', paragraphs: [
      'Matching decoders struggle when the noise model is wrong, correlations matter, leakage appears, or latency constraints force approximate decisions.',
      'They also hide degeneracy if explained too simply. Many physical errors can produce the same syndrome. The decoder is not reconstructing history; it is choosing a correction class that is likely to preserve the logical state.',
      'A final failure mode is operational. If syndrome timestamps drift, edge weights are stale, boundary handling is wrong, or the Pauli frame ledger is inconsistent, the graph algorithm can look correct while the control system applies the wrong logical update.',
      'Matching can also be the wrong abstraction for richer noise. Correlated errors, biased noise, erasures, leakage, and circuit-level effects may require modified graphs, belief propagation, union-find variants, tensor-network methods, neural decoders, or hybrid decoders. The matching graph is a powerful model, not a universal law.',
    ] },
    { heading: 'A worked case', paragraphs: [
      'Suppose four detection events appear: d1, d2, d3, and d4. The graph assigns weight 3 to d1-d2 and weight 2 to d3-d4, for total 5. Alternative pairings through boundaries cost 7 or 9. Minimum-weight matching chooses the total-5 explanation.',
      'That does not prove the hardware suffered exactly those two chains. It means that, under the current noise model, applying the matching correction is the most likely way to return to the code space without changing the logical qubit. The distinction between "most likely correction" and "true error" is central to quantum error correction.',
      'If the real error plus the chosen correction forms only stabilizers, the logical qubit is safe. If the combination crosses the code in a way that implements a logical operator, the syndrome can be cleared and the computation can still be wrong. That is the difference between matching the syndrome and preserving the encoded information.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Primary sources: surface-code introduction at https://arthurpesah.me/blog/2023-05-13-surface-code/, Error Correction Zoo surface code page at https://errorcorrectionzoo.org/c/surface, and Riverlane decoding tutorial at https://textbook.riverlane.com/en/latest/notebooks/ch5-decoding-surfcodes/decoding-surface-codes.html.',
      'Study Hopcroft-Karp for matching vocabulary, Min-Cost Max-Flow for weighted pairing intuition, Graph BFS and Dijkstra for path costs, Quantum Circuit DAG Transpiler for the compiler side of quantum systems, and Quantum Statevector Amplitude Array for the simulation model that error correction is trying to protect.',
    ] },
  ],
};
