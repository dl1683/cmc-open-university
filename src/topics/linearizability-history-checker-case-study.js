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
      heading: 'Why linearizability checking exists',
      paragraphs: [
        `Concurrent objects can fail in schedules that look harmless from the source code. A queue may have two enqueues and one dequeue overlapping, and the final size may look correct even though the dequeue returned the wrong item. A map may return an old value after a completed write. A stack may skip an entry only when two pops race.`,
        `Linearizability checking exists to turn those histories into a precise question: can every completed operation be placed at one instant between its invocation and response so the resulting sequential history obeys the object specification and preserves real-time order for operations that did not overlap?`,
        `This is useful because a stress test without a checker only says that something looked wrong. A checker can say which small group of calls and returns cannot be explained by any legal queue, stack, register, or map.`,
      ],
    },
    {
      heading: 'The obvious approach and the wall',
      paragraphs: [
        `The obvious way to test a concurrent object is to run many threads, record operations, and compare simple end conditions. For a queue, count enqueues and dequeues. For a map, check final key values. For a register, look for reads outside the range of writes.`,
        `The wall is that final state is too weak. A queue can have the right final size while returning values in an impossible order. A map can end with the right value while one read in the middle observed a state that no sequential map could produce.`,
        `Another tempting shortcut is to replay operations in invocation order or response order. Both are wrong. Overlapping operations may be ordered either way, while non-overlapping operations have a forced real-time order. The checker has to search between those constraints.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `The core insight is that a passing concurrent history needs a witness. The witness is a sequential order plus a legal point inside each operation interval. If operation A returns before operation B starts, A must appear before B. If they overlap, the witness may choose either order.`,
        `The chosen order must also satisfy the sequential object specification. A FIFO queue cannot dequeue B before A if A was already enqueued and not removed. A stack cannot pop an older item while a newer unpopped item is on top. A register read must observe a write that could be latest at the chosen point.`,
        `The checker is not replaying the scheduler. It is searching for an abstract explanation of the observed results. If no explanation exists, the history is not linearizable.`,
      ],
    },
    {
      heading: 'The invariant',
      paragraphs: [
        `The invariant is local but strict: each operation must appear to take effect at one point inside its own interval. That point cannot move before the invocation or after the response. The witness may be hard to find, but once found, it gives a sequential story for the whole history.`,
        `The second invariant is real-time order. If one operation completed before another began, every legal witness must preserve that order. This is why linearizability is stronger than plain serializability and why it matches what clients can observe from outside the object.`,
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        `The history-intervals view draws each operation as a horizontal segment from invocation to response. A legal linearization point must land somewhere on that segment. When intervals overlap, the model shows why the checker has freedom. When one interval ends before another begins, the ordering is forced.`,
        `The real-time table separates timing constraints from object semantics. Timing says which orders are allowed. The queue table then asks whether any allowed order can explain the return value. The checking-proof view combines those two inputs: real-time edges prune the search, and the sequential spec rejects orders that produce the wrong result.`,
      ],
    },
    {
      heading: 'Mechanism',
      paragraphs: [
        `The input history contains invocations, responses, arguments, return values, process or thread identifiers, and timing. The checker first derives real-time edges. If operation A returned before operation B was invoked, A must precede B in every candidate order.`,
        `The checker then searches candidate sequential orders that respect those edges. Each candidate operation is interpreted by a sequential specification. For a FIFO queue, enqueue appends and dequeue removes from the front. For a stack, pop removes the newest item. For a register, reads observe the latest preceding write.`,
        `If the checker finds an order that explains every completed operation, it can return a witness. If no order works, it should return a small counterexample core. The best failure reports point to the few operations and return values that create the contradiction.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `The correctness argument is direct. If a witness order exists, every operation can be treated as if it happened atomically at its chosen point. The real-time edges preserve facts that clients could observe, and the sequential specification preserves the meaning of the object.`,
        `If no witness exists, then every possible placement violates either timing or semantics. That is stronger than saying a test assertion failed. It says the observed history cannot be explained by any correct atomic object of that kind.`,
        `For many lock-free structures, the implementation proof has the same shape. An enqueue may linearize at the successful compare-and-swap that links a node. A dequeue may linearize at the successful compare-and-swap that claims a node. The checker searches from the outside; the proof identifies the internal event that justifies the outside behavior.`,
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        `Suppose enq(A) runs from time 1 to 3, enq(B) runs from time 4 to 7, and deq() runs from time 5 to 8 returning B. Since enq(A) finished before deq() began, A must be before the dequeue. Since enq(B) overlaps the dequeue, B may be placed before or after it.`,
        `If the dequeue returns B, no FIFO queue can explain the history while A is already enqueued and not removed. The counterexample is small: A completed first, B overlapped, the dequeue returned B, and A was skipped.`,
        `A passing variant is also useful to see. If enq(A), enq(B), and deq() all overlap, and the dequeue returns A, the checker may choose enq(A), enq(B), deq() as the witness. If it returns B, the checker may choose enq(B), deq(), enq(A), provided the intervals allow that order. Overlap is what gives the witness room.`,
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        `Linearizability checking wins when the object has a clear single-object specification and bugs appear only under rare interleavings. Queues, stacks, registers, maps, sets, semaphores, and many lock-free containers fit this pattern.`,
        `It also wins as a teaching tool. A lock-free algorithm can have helper threads, retries, delayed pointer updates, and memory reclamation concerns. Linearizability separates the abstract safety question from the performance and progress questions: did every completed operation appear to happen atomically at a legal point?`,
        `One failing history can be more valuable than many passing stress runs. If the checker returns a minimal contradictory core, the implementation team can focus on the exact overlap and return value that broke the contract.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `Do not confuse linearizability with every kind of correctness. It is a per-object safety property. It does not by itself prove a multi-object transaction system, a distributed consistency model, a memory reclamation scheme, or a progress guarantee.`,
        `The checker can also struggle with scale. Many overlapping operations create many possible orders. Practical tools need pruning, memoization, symmetry reduction, or smaller windows. A huge history may need to be sliced before it becomes useful.`,
        `Bad history capture can mislead the checker. Missing responses, clock skew across recorders, incorrect operation boundaries, nondeterministic specifications, and external side effects can make a correct implementation look bad or make a real bug hard to isolate.`,
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        `Record invocations and responses at the API boundary, not inside helper routines. The checker needs the interval visible to clients. Include thread id, operation name, arguments, return value, start time, end time, and a monotonically increasing event id for stable diagnostics.`,
        `Write the sequential specification first and keep it small. A checker is only as good as the spec it tests against. For a queue, implement a simple reference FIFO model. For a map, model updates and reads directly. Avoid mixing implementation details into the spec.`,
        `When histories are large, check windows around suspicious events, then grow the window. Use real-time pruning, object-state pruning, and memo keys that include enough state to avoid repeating equivalent partial searches. Report both a witness for passing histories and a compact core for failing ones.`,
      ],
    },
    {
      heading: 'What to study next',
      paragraphs: [
        `Read Herlihy and Wing, Linearizability: A Correctness Condition for Concurrent Objects, at https://dl.acm.org/doi/10.1145/78969.78972, with a freely available PDF at https://cs.brown.edu/people/mph/HerlihyW90/p463-herlihy.pdf. Then compare linearizability with serializability, sequential consistency, and eventual consistency.`,
        `Inside this curriculum, study Lock-Free Queue, ABA Tagged Pointer Stack, Nonblocking Progress Guarantees, Sequence Locks, Read-Copy-Update, Hazard Pointers and Epoch Reclamation, Distributed Snapshot Consistent Cut, Logical Clocks, and Distributed Tracing.`,
      ],
    },
  ],
};
