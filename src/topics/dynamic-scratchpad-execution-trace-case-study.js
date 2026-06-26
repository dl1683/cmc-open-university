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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the scratchpad as the live machine state, not as a diary. Active means the next executable field is being inspected or changed, visited means an old trace fact has already been folded into the state map, and found means the verifier can derive the next legal step from the kept fields.',
        'The safe inference rule is replay sufficiency. If the program counter, locals, stack frame, heap identity, iterator position, random seed, and input observation are enough to reproduce the next transition, then earlier events can be forgotten for that step.',
        {type:'callout', text:'A dynamic scratchpad is not a shorter transcript; it is a replayable current-state contract that earns compression only when the next legal step can be derived from the fields it keeps.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'An execution trace is a record of the states a program passes through. It is useful for training and checking reasoning models because it shows concrete control flow, variable values, and outputs. The problem is that a trace can grow while the live state stays small.',
        'A loop that runs 10,000 times may only need four current facts to continue: the program counter, the loop index, the accumulator, and the stop condition. Keeping all 10,000 trace rows in context spends tokens on history that no longer changes the next step. A dynamic scratchpad exists to keep the state that still has causal force.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to append every step to the prompt. After line 1, write the state; after line 2, write the state again; after line 3, keep going. This is easy to audit because every past value remains visible.',
        'A smaller version stores only diffs, meaning only the variables that changed at each step. That reduces repeated text, but the current value still requires replaying the diff chain. A summary is shorter, but it can drop a detail that later becomes decisive.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is context growth without new decision power. If a trace uses 25 tokens per step, then 10,000 steps cost about 250,000 tokens before the model even answers the next question. Most of those tokens describe events whose effects are already captured by current variables.',
        'The harder wall is hidden state. A value such as item = "a" is not enough when the iterator has seen three different positions that all contain "a". Without the iterator index, the scratchpad cannot know which element comes next.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Make current state the data structure. A dynamic scratchpad is a schema with fields that are sufficient to continue execution. Old trace rows may be deleted only after their effects have been absorbed into those fields.',
        'The invariant is simple: every accepted scratchpad must contain every fact that can affect the next legal transition. If a fact can change the next branch, loop update, function return, alias, random draw, or input read, it is state. If it cannot change any future step, it is history.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'At each step, the executor reads the current scratchpad, applies the next program operation, and rewrites the affected fields. The program counter advances, locals change, stack frames are pushed or popped, heap references keep object identity, and iterator records keep position. The update is not prose compression; it is state transition.',
        'For neural skip-step execution, the model may propose a state several steps ahead. A verifier then replays from the old state to the proposed state or checks enough constraints to accept it. If the proposal fails, the system falls back to a smaller jump or to a real interpreter.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness comes from replay equivalence. If starting from the dynamic scratchpad produces the same next state and output as starting from the full trace, then the omitted trace rows were not needed for that step. The full history and the compact state are equivalent for continuation.',
        'For skip-step search, verification is the safety boundary. The model can guess a future state, but only verified landing states may replace the current state. Search order can improve speed; it cannot make an unverifiable state correct.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'A full trace costs O(t * s) prompt space for t steps and s tokens per step. A dynamic scratchpad costs O(live state), which can stay nearly constant for simple loops. If a loop doubles from 5,000 to 10,000 iterations, the full trace roughly doubles while a four-field scratchpad may not grow at all.',
        'The tax is schema design. Too few fields make replay wrong, and too many fields push the scratchpad back toward a trace. The dominant cost in practice is verifying that compression did not lose state, especially when jumps skip many steps.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Dynamic scratchpads fit program-execution tutors, code reasoning benchmarks, agent traces, and model training systems that need long rollouts without long transcripts. They are useful when the live state is much smaller than the path that produced it.',
        'They also fit systems that retry or resume work. A browser automation agent, a build agent, or a data-cleaning script can checkpoint the facts needed to continue instead of replaying every log event. The checkpoint must still be executable state, not a pleasant summary.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when the schema forgets a hidden dependency. Repeated values need positions, mutable objects need identity, recursion needs frames, random behavior needs seeds or sampled values, and input output needs recorded observations. One missing field can make a short scratchpad worse than a long trace.',
        'It also fails when the verifier is weak. A model can write a plausible state that cannot actually follow from the old one. Without replay or constraint checking, the scratchpad becomes a story about execution rather than execution state.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Consider a loop that sums even numbers from 0 through 18. A full trace records 10 iterations: i = 0, sum = 0; i = 2, sum = 2; i = 4, sum = 6; and so on until i = 20, sum = 90. At 20 tokens per row, that is about 200 tokens for a result described by three live fields.',
        'The dynamic scratchpad after the eighth iteration can be {pc: "loop", i: 16, sum: 56, stop: 20}. The next legal step is derivable: add 16 to get 72, then set i to 18. If the scratchpad only says sum = 56, replay fails because the next addend is unknown.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Execution Tuning at https://arxiv.org/html/2503.05703v1. For the model-training context, also study Meta CWM at https://ai.meta.com/research/publications/cwm-an-open-weights-llm-for-research-on-code-generation-with-world-models/.',
        'Study Execution Trace State Diff Case Study for trace storage, Interpreter Dispatch Table for program counters, Stack Frames for calls, Priority Queue for verified jump search, and Process Reward Models and Verifier Search for proposal checking. Read them in that order if the weak point is program state before model search.',
      ],
    },
  ],
};
