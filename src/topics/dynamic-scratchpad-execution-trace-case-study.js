// Dynamic scratchpads for execution traces: keep a mutable current-state
// representation so long programs do not require emitting the full history.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'dynamic-scratchpad-execution-trace-case-study',
  title: 'Dynamic Scratchpad Execution Trace Case Study',
  category: 'AI & ML',
  summary: 'A trace-modeling case study: replace ever-growing execution histories with mutable current-state scratchpads, skip-step prediction, and verifier-backed search.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['history vs state', 'skip-step search'], defaultValue: 'history vs state' },
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

function scratchpadGraph(title) {
  return graphState({
    nodes: [
      { id: 'code', label: 'code', x: 0.7, y: 3.5, note: 'source' },
      { id: 'event', label: 'event', x: 2.1, y: 3.5, note: 'line/op' },
      { id: 'history', label: 'history', x: 4.0, y: 1.7, note: 'grows' },
      { id: 'compact', label: 'diffs', x: 4.0, y: 3.5, note: 'delta' },
      { id: 'state', label: 'state map', x: 4.0, y: 5.3, note: 'update' },
      { id: 'iterator', label: 'iter', x: 6.0, y: 4.3, note: 'count' },
      { id: 'stack', label: 'stack', x: 6.0, y: 5.9, note: 'frames' },
      { id: 'predict', label: 'predict', x: 8.0, y: 4.9, note: 'next' },
      { id: 'answer', label: 'answer', x: 9.4, y: 4.9, note: 'return' },
    ],
    edges: [
      { id: 'e-code-event', from: 'code', to: 'event' },
      { id: 'e-event-history', from: 'event', to: 'history' },
      { id: 'e-event-compact', from: 'event', to: 'compact' },
      { id: 'e-event-state', from: 'event', to: 'state' },
      { id: 'e-state-iterator', from: 'state', to: 'iterator' },
      { id: 'e-state-stack', from: 'state', to: 'stack' },
      { id: 'e-iterator-predict', from: 'iterator', to: 'predict' },
      { id: 'e-stack-predict', from: 'stack', to: 'predict' },
      { id: 'e-predict-answer', from: 'predict', to: 'answer' },
    ],
  }, { title });
}

function searchGraph(title) {
  return graphState({
    nodes: [
      { id: 's0', label: 'S0', x: 0.8, y: 3.6, note: 'start' },
      { id: 'n1', label: '+1', x: 2.4, y: 2.0, note: 'safe' },
      { id: 'n4', label: '+4', x: 2.4, y: 3.6, note: 'cheap' },
      { id: 'n10', label: '+10', x: 2.4, y: 5.2, note: 'risky' },
      { id: 'v1', label: 'verify', x: 4.4, y: 2.0, note: 'state' },
      { id: 'v4', label: 'verify', x: 4.4, y: 3.6, note: 'state' },
      { id: 'v10', label: 'verify', x: 4.4, y: 5.2, note: 'state' },
      { id: 'frontier', label: 'frontier', x: 6.6, y: 3.6, note: 'heap' },
      { id: 'return', label: 'return', x: 8.6, y: 3.6, note: 'done' },
    ],
    edges: [
      { id: 'e-s0-n1', from: 's0', to: 'n1', weight: 'low NLL' },
      { id: 'e-s0-n4', from: 's0', to: 'n4', weight: 'best cost' },
      { id: 'e-s0-n10', from: 's0', to: 'n10', weight: 'high NLL' },
      { id: 'e-n1-v1', from: 'n1', to: 'v1' },
      { id: 'e-n4-v4', from: 'n4', to: 'v4' },
      { id: 'e-n10-v10', from: 'n10', to: 'v10' },
      { id: 'e-v1-frontier', from: 'v1', to: 'frontier' },
      { id: 'e-v4-frontier', from: 'v4', to: 'frontier' },
      { id: 'e-v10-frontier', from: 'v10', to: 'frontier' },
      { id: 'e-frontier-return', from: 'frontier', to: 'return' },
    ],
  }, { title });
}

function* historyVsState() {
  yield {
    state: scratchpadGraph('A dynamic scratchpad updates current state'),
    highlight: { active: ['code', 'event', 'state', 'iterator', 'stack', 'predict', 'e-code-event', 'e-event-state', 'e-state-iterator', 'e-state-stack'], compare: ['history'] },
    explanation: 'A regular trace scratchpad appends every intermediate state. A dynamic scratchpad instead keeps one self-contained current-state object and updates it after each step, so long executions do not force the model to carry the entire transcript. A compact diff log says what changed; the dynamic scratchpad says what is true now.',
    invariant: 'The current state must contain every fact needed to continue without rereading the old trace.',
  };

  yield {
    state: labelMatrix(
      'Scratchpad representations',
      [
        { id: 'direct', label: 'direct' },
        { id: 'history', label: 'history' },
        { id: 'compact', label: 'compact' },
        { id: 'dynamic', label: 'dynamic' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'strength', label: 'strength' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['only answer', 'cheap', 'opaque'],
        ['all states', 'complete', 'long ctx'],
        ['deltas', 'smaller', 'needs replay'],
        ['current map', 'bounded', 'missing hidden'],
      ],
    ),
    highlight: { active: ['dynamic:stores', 'dynamic:strength'], compare: ['history:risk', 'compact:risk'] },
    explanation: 'The choice is a data-structure tradeoff. Full history maximizes evidence but grows linearly. Compact diffs save tokens but may require replay. Dynamic state is bounded, but any hidden state omitted from the map becomes an error source.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'execution steps', min: 0, max: 14000 }, y: { label: 'prompted trace units', min: 0, max: 14000 } },
      series: [
        { id: 'history', label: 'history', points: [{ x: 100, y: 100 }, { x: 1000, y: 1000 }, { x: 5000, y: 5000 }, { x: 14000, y: 14000 }] },
        { id: 'compact', label: 'compact', points: [{ x: 100, y: 70 }, { x: 1000, y: 500 }, { x: 5000, y: 1700 }, { x: 14000, y: 3600 }] },
        { id: 'dynamic', label: 'dynamic', points: [{ x: 100, y: 70 }, { x: 1000, y: 90 }, { x: 5000, y: 110 }, { x: 14000, y: 130 }] },
      ],
      markers: [
        { id: 'wall', x: 5000, y: 5000, label: 'ctx wall' },
      ],
    }),
    highlight: { active: ['dynamic'], compare: ['history'], found: ['compact', 'wall'] },
    explanation: 'The numbers are conceptual, but the shape is the point. Full trace history grows with the execution, while a dynamic scratchpad grows with the size of the live state. That is why long loops such as Collatz can stay readable instead of drowning the model in old states.',
  };

  yield {
    state: labelMatrix(
      'Current-state fields',
      [
        { id: 'pc', label: 'pc' },
        { id: 'locals', label: 'locals' },
        { id: 'iter', label: 'iterator' },
        { id: 'stack', label: 'stack' },
        { id: 'heap', label: 'heap refs' },
        { id: 'conf', label: 'confidence' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'failure', label: 'if missing' },
      ],
      [
        ['next edge', 'wrong line'],
        ['values', 'wrong math'],
        ['loop count', 'ambiguous item'],
        ['call state', 'bad return'],
        ['identity', 'alias bug'],
        ['routing', 'bad skip'],
      ],
    ),
    highlight: { active: ['iter:role', 'stack:role', 'heap:role', 'conf:role'], found: ['pc:role'] },
    explanation: 'Dynamic scratchpads need fields that full history gave implicitly. Iterator counts are the canonical example: if a loop sees the value "a" twice, the current state must say which occurrence it is. Stack and heap identity do the same job for calls and mutation.',
  };

  yield {
    state: scratchpadGraph('Dynamic state is not a lossy summary when it is replayable'),
    highlight: { active: ['state', 'iterator', 'stack', 'predict', 'answer', 'e-state-iterator', 'e-state-stack', 'e-iterator-predict', 'e-stack-predict', 'e-predict-answer'], compare: ['history', 'compact'] },
    explanation: 'The dynamic scratchpad can be compact without being hand-wavy. The test is replay: can a verifier start from this current-state map and produce the same next state or output? If not, the state omitted something important.',
  };
}

function* skipStepSearch() {
  yield {
    state: searchGraph('Skip-step prediction turns execution into path search'),
    highlight: { active: ['s0', 'n1', 'n4', 'n10', 'v1', 'v4', 'v10'], found: ['frontier', 'return'] },
    explanation: 'A model can predict one step ahead or jump multiple steps ahead. Multi-step jumps reduce the number of generated trace states, but they also raise error risk. The runtime should treat each jump as an edge with a cost and a verifier check.',
    invariant: 'A skipped span is acceptable only if the predicted landing state verifies.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'jump size', min: 1, max: 10 }, y: { label: 'model signal', min: 0, max: 1 } },
      series: [
        { id: 'accuracy', label: 'accuracy', points: [{ x: 1, y: 0.96 }, { x: 2, y: 0.91 }, { x: 4, y: 0.82 }, { x: 7, y: 0.68 }, { x: 10, y: 0.55 }] },
        { id: 'confidence', label: 'confidence', points: [{ x: 1, y: 0.93 }, { x: 2, y: 0.88 }, { x: 4, y: 0.76 }, { x: 7, y: 0.60 }, { x: 10, y: 0.46 }] },
      ],
      markers: [
        { id: 'knee', x: 4, y: 0.82, label: 'skip knee' },
      ],
    }),
    highlight: { active: ['accuracy', 'confidence', 'knee'] },
    explanation: 'Execution Tuning reports that predicting further into the future is feasible, but accuracy falls as the jump grows. Negative log likelihood can become a useful routing signal: take longer skips only when the model is confident enough and the verifier can cheaply reject bad landings.',
  };

  yield {
    state: labelMatrix(
      'Long-execution strategies',
      [
        { id: 'line1', label: 'Line-1' },
        { id: 'linen', label: 'Line-n' },
        { id: 'search', label: 'Line-n search' },
        { id: 'fallback', label: 'fallback' },
      ],
      [
        { id: 'policy', label: 'policy' },
        { id: 'cost', label: 'cost' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['next step', 'many states', 'slow'],
        ['jump ahead', 'fewer states', 'miss'],
        ['best path', 'heap work', 'oracle leak'],
        ['symbolic run', 'external', 'limited'],
      ],
    ),
    highlight: { active: ['linen:policy', 'search:policy'], compare: ['line1:cost'], found: ['fallback:policy'] },
    explanation: 'Line-1 is safe but verbose. Line-n is shorter but may land wrong. A Dijkstra-style frontier can choose lower-cost paths through predicted states, provided the verifier does not leak ground truth into evaluation. The practical fallback is still the real interpreter.',
  };

  yield {
    state: searchGraph('Use a priority queue for candidate landing states'),
    highlight: { active: ['n4', 'v4', 'frontier', 'return', 'e-s0-n4', 'e-n4-v4', 'e-v4-frontier', 'e-frontier-return'], compare: ['n10', 'v10'], found: ['n1', 'v1'] },
    explanation: 'The data structure is a priority queue keyed by predicted cost: confidence, jump length, replay cost, and task budget. The frontier expands the cheapest credible landing states first and discards states that fail verification, so skipping is controlled rather than blind.',
  };

  yield {
    state: labelMatrix(
      'Failure modes',
      [
        { id: 'hidden', label: 'hidden state' },
        { id: 'string', label: 'strings' },
        { id: 'iterator', label: 'iterator' },
        { id: 'calib', label: 'confidence' },
        { id: 'oracle', label: 'oracle leak' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'control', label: 'control' },
      ],
      [
        ['state jump', 'explicit field'],
        ['wrong char', 'span check'],
        ['same value', 'count'],
        ['bad skip', 'NLL gate'],
        ['fake gain', 'holdout'],
      ],
    ),
    highlight: { active: ['hidden:control', 'iterator:control', 'calib:control'], removed: ['oracle:symptom'] },
    explanation: 'Dynamic scratchpads fail when the current state is not actually self-contained. Strings and indexing are common brittle spots; iterators require explicit counters; confidence needs calibration; and search experiments must avoid using ground truth in a way production would not have.',
  };

  yield {
    state: searchGraph('The production pattern is neural proposal plus symbolic check'),
    highlight: { active: ['s0', 'n1', 'n4', 'frontier', 'return'], found: ['v1', 'v4'], compare: ['n10'] },
    explanation: 'The model proposes the next or skipped state. The verifier checks whether the landing state is legal. The frontier allocates compute. This is the same hybrid pattern behind Code World Models, verifier search, and execution-as-a-service: neural compression with explicit state checks.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'history vs state') yield* historyVsState();
  else if (view === 'skip-step search') yield* skipStepSearch();
  else throw new InputError('Pick a dynamic-scratchpad execution-trace view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'Execution traces teach models what code does, but long programs create a context wall. A loop with thousands of steps can be simple to execute and still too long to keep as a prompt transcript. A dynamic scratchpad solves the prompt-facing part of that problem by keeping only the current state needed to continue.',
        'Instead of asking a model to append every line-level state forever, the model updates one self-contained state map: program counter, locals, iterator counts, stack frames, heap references, and confidence. Execution Trace State Diff Case Study records what happened. A dynamic scratchpad defines the compact state a model must carry if it wants to continue simulating the program after thousands of steps.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is an append-only scratchpad: state after line 1, state after line 2, state after line 3, and so on. It is honest and easy to audit because the full history is present.',
        'The wall is growth. The prompt grows with execution length even when the live state is tiny. Compact diffs reduce tokens but still require replay when the model needs the current value. A summary is shorter, but it is unsafe if it forgets an iterator count, call frame, heap alias, seed, or IO fact needed for the next step.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Make the current state the data structure. The invariant is simple: the current-state map must contain every fact needed to take the next legal step without rereading the old trace. The model can forget old events only after their effects have been folded into this map.',
        'Execution Tuning compares regular scratchpads, compact scratchpads, and dynamic scratchpads, and reports that dynamic scratchpads help on long executions up to roughly 14k steps. It also studies multi-step prediction, where the model jumps several steps ahead instead of emitting every intermediate state: https://arxiv.org/html/2503.05703v1.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'Inspect the scratchpad as executable state, not as a summary paragraph. Every field should answer a replay question: can an interpreter or verifier continue from this map without reading the old trace? If not, the omitted fact still belongs in state.',
        'The useful comparison is history versus sufficiency. Full history is expensive but complete. A dynamic scratchpad is cheaper only when it preserves all facts that affect the next transition: program counter, locals, stack frames, object identity, iterator positions, randomness, and IO observations.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A regular scratchpad is append-only. A compact scratchpad stores changed variables. A dynamic scratchpad updates the current state in place. That state has to include hidden facts that full history would otherwise imply. Iterator counts are the obvious example: if a loop visits the same value twice, the current state must distinguish the first visit from the second. Stack frames, object identity, seeds, and IO state play the same role in richer programs.',
        'Skip-step prediction turns the trace into a search problem. From state S0, the model can propose S1, S4, or S10. Each edge has a cost based on confidence, jump length, and verification expense. A priority queue can expand the best landing states first, while a verifier rejects illegal states. This is Dijkstra-style thinking applied to model-predicted execution states, with the caveat that ground-truth access must not leak into the benchmark.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is replay from the current state. If a verifier can start at the scratchpad map and produce the same next state or output as the full trace would, then the old history has been compressed without losing executable facts. If replay fails, the scratchpad omitted state.',
        'For skip-step search, the invariant is that every accepted landing state verifies. The model may propose a jump, but the verifier decides whether the jump is legal. The priority queue only changes the order of attempts; it does not make an unverifiable landing state correct.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'The cost is schema pressure. A dynamic scratchpad must name live state explicitly, so the designer has to decide what counts as state for this runtime. Too few fields make the state wrong. Too many fields push the prompt back toward full history.',
        'Skip-step prediction adds another tradeoff. Larger jumps save tokens and tool calls, but accuracy falls as the landing state moves farther away. Negative log likelihood, confidence, replay cost, and task budget become routing signals. The practical fallback is still the real interpreter.',
        'The design should treat compression as a budgeted bet. A one-step symbolic interpreter is slow but reliable. A ten-step neural jump is cheap only when it verifies. The runtime earns speed by choosing jump lengths that match confidence, not by pretending every trace can be summarized equally well.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Dynamic scratchpads win on long but structured executions: loops, counters, interpreters, simple simulations, and repeated program states where the live state is small. They also turn raw trace factories into better training targets because the target is a compact state object instead of an ever-growing transcript.',
        'The local Code World Models Breakdown makes the same architectural point from the CWM side: execution grounding works, but the valuable asset is the verified trace factory. Dynamic scratchpads make that factory more useful because they turn raw traces into compact, replayable state training targets.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when the state schema is incomplete or the verifier is too weak. Strings and indexing are brittle because many positions can hold the same character. Iterators require counts. Function calls require frames. Mutation requires object identity. IO and randomness require external state. A short scratchpad that drops the decisive field is worse than a long trace.',
      ],
    },
    {
      heading: 'Operational signals',
      paragraphs: [
        'Track replay success rate, verifier rejection rate, average scratchpad size, omitted-field failures, skip length, rollback count, frontier expansions, and token savings per verified step. These signals tell you whether the dynamic scratchpad is compressing execution or merely hiding missing state until the verifier catches it.',
        'The most valuable failure analysis is schema-level. If many rejections come from iterator position, add iterator counters. If aliasing breaks replay, add object ids. If IO breaks replay, name the external observation. The scratchpad should evolve from verifier evidence, not from vibes.',
      ],
    },
    {
      heading: 'What to remember',
      paragraphs: [
        'A dynamic scratchpad is a current-state contract. It earns its shorter context only when the next legal step can be derived from the state it keeps. Summarization is not enough; the state must be replayable.',
        'For course design, teach this after execution traces, stacks, and priority queues. It connects classic program-state ideas to modern agent and model-training systems: reduce context, preserve invariants, verify jumps, and fall back when compression loses information.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Take a Collatz loop. Full history emits every value of n and steps. A dynamic scratchpad stores the current n, steps, program counter, and loop condition, then updates those fields. For a long run, the model can attempt a skip: predict the state after four loop iterations. If the landing state verifies, the system saves tokens. If it fails, the frontier falls back to smaller jumps or the symbolic interpreter.',
        'Now take a Python iterator over repeated values. A state that only stores c = "a" is ambiguous. The dynamic scratchpad needs an iterator field such as iterator_1 = 0 or iterator_1 = 2. Without that field, the model can know the current value but not where it is in the loop. This is why dynamic state is not just summarization; it is a schema contract.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Do not call a summary dynamic if it cannot replay. Do not drop iterator counts, stack frames, alias ids, seeds, or IO facts when they affect the next state. Do not use a Dijkstra-style search result that had access to ground truth as if it were a fair production metric. Do not assume lower token count means better reasoning; a compact state that omits one decisive field is worse than a long trace.',
        'Primary sources: Execution Tuning at https://arxiv.org/html/2503.05703v1, Meta CWM at https://ai.meta.com/research/publications/cwm-an-open-weights-llm-for-research-on-code-generation-with-world-models/, and the local Code World Models Breakdown.txt corpus note. Study Code World Models Case Study, Execution Trace State Diff Case Study, Verified Agent Trajectory Store, Agent Interface Portability Audit, Abstract Agent Operation Graph, Dijkstra, Beam Search vs Greedy, Process Reward Models & Verifier Search, Execution-as-a-Service Verifier Economy Case Study, Interpreter Dispatch Table & Threaded Code, Write-Ahead Log, and Distributed Tracing next.',
      ],
    },
  ],
};
