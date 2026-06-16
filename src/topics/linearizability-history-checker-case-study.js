// Linearizability: turn an overlapping concurrent history into a sequential
// history that preserves real-time order and the object's specification.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'linearizability-history-checker-case-study',
  title: 'Linearizability History Checker Case Study',
  category: 'Data Structures',
  summary: 'Check a concurrent object by placing each operation at one instant between call and return, then testing real-time order and object semantics.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['history intervals', 'checking proof'], defaultValue: 'history intervals' },
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

function intervalPlot(points, markers = []) {
  return plotState({
    axes: { x: { label: 'time', min: 0, max: 10 }, y: { label: 'operation lane', min: 0, max: 5 } },
    series: points,
    markers,
  });
}

function checkerGraph(title) {
  return graphState({
    nodes: [
      { id: 'history', label: 'history', x: 0.8, y: 3.5, note: 'calls' },
      { id: 'rt', label: 'real-time', x: 2.6, y: 1.8, note: 'order' },
      { id: 'spec', label: 'spec', x: 2.6, y: 5.2, note: 'queue' },
      { id: 'search', label: 'search', x: 4.6, y: 3.5, note: 'orders' },
      { id: 'points', label: 'points', x: 6.5, y: 2.0, note: 'instant' },
      { id: 'witness', label: 'witness', x: 6.5, y: 5.2, note: 'proof' },
      { id: 'verdict', label: 'verdict', x: 8.6, y: 3.5, note: 'pass/fail' },
    ],
    edges: [
      { id: 'e-history-rt', from: 'history', to: 'rt' },
      { id: 'e-history-spec', from: 'history', to: 'spec' },
      { id: 'e-rt-search', from: 'rt', to: 'search' },
      { id: 'e-spec-search', from: 'spec', to: 'search' },
      { id: 'e-search-points', from: 'search', to: 'points' },
      { id: 'e-search-witness', from: 'search', to: 'witness' },
      { id: 'e-points-verdict', from: 'points', to: 'verdict' },
      { id: 'e-witness-verdict', from: 'witness', to: 'verdict' },
    ],
  }, { title });
}

function* historyIntervals() {
  yield {
    state: intervalPlot([
      { id: 'enqA', label: 'enq A', points: [{ x: 1, y: 4 }, { x: 5, y: 4 }] },
      { id: 'enqB', label: 'enq B', points: [{ x: 2, y: 3 }, { x: 6, y: 3 }] },
      { id: 'deq', label: 'deq -> A', points: [{ x: 4, y: 2 }, { x: 8, y: 2 }] },
    ]),
    highlight: { active: ['enqA', 'enqB', 'deq'] },
    explanation: 'A concurrent history records invocation and response intervals. Linearizability asks whether each operation can be assigned one instant inside its interval so the object looks sequential.',
    invariant: 'The linearization point must lie between call and return.',
  };

  yield {
    state: intervalPlot(
      [
        { id: 'enqA', label: 'enq A', points: [{ x: 1, y: 4 }, { x: 5, y: 4 }] },
        { id: 'enqB', label: 'enq B', points: [{ x: 2, y: 3 }, { x: 6, y: 3 }] },
        { id: 'deq', label: 'deq -> A', points: [{ x: 4, y: 2 }, { x: 8, y: 2 }] },
      ],
      [
        { id: 'lpA', x: 3.2, y: 4, label: 'A' },
        { id: 'lpB', x: 5.4, y: 3, label: 'B' },
        { id: 'lpD', x: 6.6, y: 2, label: 'D' },
      ],
    ),
    highlight: { found: ['lpA', 'lpB', 'lpD'], active: ['enqA', 'deq'] },
    explanation: 'One witness order is enq(A), enq(B), deq() -> A. The operations overlap, so enq(A) and enq(B) can be placed in either order unless real-time order forces one before the other.',
  };

  yield {
    state: labelMatrix(
      'Real-time constraints',
      [
        { id: 'a_b', label: 'A vs B' },
        { id: 'a_d', label: 'A vs D' },
        { id: 'b_d', label: 'B vs D' },
      ],
      [
        { id: 'intervals', label: 'intervals' },
        { id: 'forced', label: 'forced?' },
      ],
      [
        ['overlap', 'no'],
        ['overlap', 'no'],
        ['overlap', 'no'],
      ],
    ),
    highlight: { active: ['a_b:forced', 'a_d:forced', 'b_d:forced'] },
    explanation: 'If operations overlap, linearizability can order them either way. If one response happens before another invocation, that order is forced. This locality is why linearizability is compositional.',
  };

  yield {
    state: labelMatrix(
      'Queue semantic check',
      [
        { id: 'order1', label: 'A,B,D' },
        { id: 'order2', label: 'B,A,D' },
        { id: 'order3', label: 'D,A,B' },
      ],
      [
        { id: 'queue', label: 'queue result' },
        { id: 'verdict', label: 'verdict' },
      ],
      [
        ['deq returns A', 'valid'],
        ['deq returns B', 'reject'],
        ['empty deq', 'reject'],
      ],
    ),
    highlight: { found: ['order1:verdict'], removed: ['order2:verdict', 'order3:verdict'] },
    explanation: 'The checker searches sequential orders that respect the intervals and then runs the object spec. A queue that enqueues B before A cannot explain deq returning A.',
  };

  yield {
    state: checkerGraph('A checker returns either a witness or a counterexample'),
    highlight: { active: ['history', 'rt', 'spec', 'search'], found: ['witness', 'verdict'] },
    explanation: 'A linearizability checker is a proof search. Passing histories need a witness order and points. Failing histories need the smallest contradictory core so the algorithm bug can be understood.',
  };
}

function* checkingProof() {
  yield {
    state: checkerGraph('Inputs: history plus sequential specification'),
    highlight: { active: ['history', 'rt', 'spec', 'e-history-rt', 'e-history-spec'], compare: ['verdict'] },
    explanation: 'The checker needs both timing and meaning. Timing gives real-time constraints. The sequential specification says what each operation may return after earlier operations.',
  };

  yield {
    state: labelMatrix(
      'Candidate order pruning',
      [
        { id: 'rt', label: 'real-time' },
        { id: 'pending', label: 'pending ops' },
        { id: 'spec', label: 'spec state' },
        { id: 'memo', label: 'memo key' },
      ],
      [
        { id: 'keeps', label: 'keeps' },
        { id: 'cuts', label: 'cuts' },
      ],
      [
        ['rt edges', 'late ops first'],
        ['open intervals', 'early close'],
        ['queue contents', 'bad returns'],
        ['seen states', 'repeat search'],
      ],
    ),
    highlight: { active: ['rt:cuts', 'spec:cuts', 'memo:cuts'], found: ['pending:keeps'] },
    explanation: 'Naive search can explode. Practical checkers prune with real-time edges, object state, pending-operation sets, and memoization of equivalent partial searches.',
  };

  yield {
    state: intervalPlot(
      [
        { id: 'enqA', label: 'enq A', points: [{ x: 1, y: 4 }, { x: 3, y: 4 }] },
        { id: 'enqB', label: 'enq B', points: [{ x: 4, y: 3 }, { x: 7, y: 3 }] },
        { id: 'deq', label: 'deq -> B', points: [{ x: 5, y: 2 }, { x: 8, y: 2 }] },
      ],
      [
        { id: 'force', x: 3.0, y: 4, label: 'A before' },
        { id: 'bad', x: 6.0, y: 2, label: 'B?' },
      ],
    ),
    highlight: { active: ['enqA', 'deq'], removed: ['bad'], found: ['force'] },
    explanation: 'Here enq(A) returns before deq starts, so A must be visible before the dequeue. If deq returns B while A is still queued ahead of B, the history is not linearizable.',
  };

  yield {
    state: labelMatrix(
      'Counterexample core',
      [
        { id: 'a', label: 'enq A' },
        { id: 'b', label: 'enq B' },
        { id: 'd', label: 'deq -> B' },
      ],
      [
        { id: 'fact', label: 'fact' },
        { id: 'why', label: 'why' },
      ],
      [
        ['A done first', 'must appear'],
        ['B overlaps D', 'may appear'],
        ['returns B', 'skips A'],
      ],
    ),
    highlight: { active: ['a:why', 'd:why'], compare: ['b:why'] },
    explanation: 'A useful failure is small. The counterexample says exactly which completed operation must be before the read and which return value violates the sequential queue spec.',
  };

  yield {
    state: labelMatrix(
      'Where linearization points live',
      [
        { id: 'queueEnq', label: 'MS enq' },
        { id: 'queueDeq', label: 'MS deq' },
        { id: 'stackPop', label: 'stack pop' },
        { id: 'seqlock', label: 'seqlock read' },
      ],
      [
        { id: 'point', label: 'point' },
        { id: 'lesson', label: 'lesson' },
      ],
      [
        ['link CAS', 'publish item'],
        ['head CAS', 'claim item'],
        ['top CAS', 'remove item'],
        ['even version', 'valid snapshot'],
      ],
    ),
    highlight: { found: ['queueEnq:point', 'queueDeq:point', 'stackPop:point'], compare: ['seqlock:point'] },
    explanation: 'For many concurrent structures, the proof centers on one atomic event. The hard part is proving that event matches the abstract operation even when helper threads and retries appear in the implementation.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'history intervals') yield* historyIntervals();
  else if (view === 'checking proof') yield* checkingProof();
  else throw new InputError('Pick a linearizability view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Linearizability is the standard correctness condition for concurrent objects. It says each operation appears to take effect atomically at some point between invocation and response, while preserving real-time order for non-overlapping operations. That lets programmers reason about a concurrent queue, stack, register, or map using the familiar sequential specification.',
        'Herlihy and Wing introduced the condition in Linearizability: A Correctness Condition for Concurrent Objects: https://dl.acm.org/doi/10.1145/78969.78972. A freely available PDF is at https://cs.brown.edu/people/mph/HerlihyW90/p463-herlihy.pdf.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A history contains calls, returns, arguments, return values, and timing. The checker tries to find a sequential order that puts every completed operation at a legal instant inside its interval. If operation A returns before operation B is invoked, A must appear before B. If two intervals overlap, either order may be legal. The candidate order is then tested against the object specification.',
        'For a FIFO queue, the sequential state is just a list. Enqueue appends. Dequeue removes from the front. A history where an earlier completed enqueue is skipped by a later dequeue is not linearizable. For a stack, the spec is LIFO. For a register, the spec is last write wins.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Consider a lock-free queue test that records enq(A), enq(B), and deq()->B. If enq(A) completed before deq started, then any linearization must make A visible before the dequeue. Returning B means the implementation skipped A or lost its pointer. The checker reduces the large execution trace to a three-operation counterexample: A was done, B may be present, D returned B, and FIFO is violated.',
        'For a Michael-Scott queue, the usual enqueue linearization point is the successful CAS linking the new node into the list. The dequeue linearization point is the successful CAS advancing head. The proof then explains helper actions and lagging tail movement as implementation details that do not change the abstract order.',
      ],
    },
    {
      heading: 'Pitfalls and study next',
      paragraphs: [
        'Do not confuse linearizability with serializability, eventual consistency, or thread safety by locking. Linearizability includes real-time order and applies to individual objects. A lock can make an object linearizable, but a lock-free object can also be linearizable. A non-linearizable object can pass many stress tests if the unlucky interleaving never appears.',
        'Study Lock-Free Queue, ABA Tagged Pointer Stack, Nonblocking Progress Guarantees, Sequence Locks, Read-Copy-Update, Hazard Pointers & Epoch Reclamation, Distributed Tracing, and Logical Clocks next.',
      ],
    },
  ],
};
