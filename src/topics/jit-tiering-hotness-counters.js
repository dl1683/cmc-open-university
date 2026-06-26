// JIT tiering: collect lightweight execution evidence, then promote hot code
// through progressively more expensive compiler tiers.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'jit-tiering-hotness-counters',
  title: 'JIT Tiering & Hotness Counters',
  category: 'Concepts',
  summary: 'A runtime promotion policy: execute first, count calls and loops, then move hot functions from interpreter to baseline and optimizing compilers.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['tier ladder', 'promotion policy'], defaultValue: 'tier ladder' },
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

function tierGraph(title) {
  return graphState({
    nodes: [
      { id: 'bc', label: 'bc', x: 0.8, y: 3.8, note: 'bytecode' },
      { id: 'ignition', label: 'Ign', x: 2.3, y: 3.8, note: 'interp' },
      { id: 'counter', label: 'count', x: 3.8, y: 2.2, note: 'hotness' },
      { id: 'feedback', label: 'fb', x: 3.8, y: 5.4, note: 'types' },
      { id: 'sparkplug', label: 'SP', x: 5.7, y: 3.8, note: 'baseline' },
      { id: 'maglev', label: 'M', x: 7.4, y: 2.4, note: 'mid tier' },
      { id: 'turbofan', label: 'TF', x: 7.4, y: 5.3, note: 'top tier' },
      { id: 'code', label: 'code', x: 9.1, y: 3.8, note: 'machine' },
    ],
    edges: [
      { id: 'e-bc-ignition', from: 'bc', to: 'ignition' },
      { id: 'e-ignition-counter', from: 'ignition', to: 'counter' },
      { id: 'e-ignition-feedback', from: 'ignition', to: 'feedback' },
      { id: 'e-counter-sparkplug', from: 'counter', to: 'sparkplug' },
      { id: 'e-feedback-sparkplug', from: 'feedback', to: 'sparkplug' },
      { id: 'e-sparkplug-maglev', from: 'sparkplug', to: 'maglev' },
      { id: 'e-sparkplug-turbofan', from: 'sparkplug', to: 'turbofan' },
      { id: 'e-maglev-code', from: 'maglev', to: 'code' },
      { id: 'e-turbofan-code', from: 'turbofan', to: 'code' },
    ],
  }, { title });
}

function* tierLadder() {
  const tierCount = 4;  // Ignition, Sparkplug, Maglev, TurboFan
  const signalTypes = 2;  // counter and feedback

  yield {
    state: tierGraph('Tiering spends compiler effort only after evidence arrives'),
    highlight: { active: ['bc', 'ignition', 'counter', 'feedback', 'e-bc-ignition', 'e-ignition-counter'], compare: ['turbofan'] },
    explanation: `A JIT engine starts cheap. It interprets bytecode, records ${signalTypes} signal types (hotness and feedback), and delays expensive compilation until the code has proved it runs often enough.`,
  };
  yield {
    state: labelMatrix(
      'Tier ladder',
      [
        { id: 'ignition', label: 'Ignition' },
        { id: 'sparkplug', label: 'Sparkplug' },
        { id: 'maglev', label: 'Maglev' },
        { id: 'turbofan', label: 'TurboFan' },
      ],
      [
        { id: 'cost', label: 'compile cost' },
        { id: 'quality', label: 'code quality' },
      ],
      [
        ['very low', 'interpreted'],
        ['low', 'baseline'],
        ['medium', 'fast optimizing'],
        ['high', 'top optimizing'],
      ],
    ),
    highlight: { active: ['ignition:cost', 'sparkplug:cost'], found: ['maglev:quality', 'turbofan:quality'] },
    explanation: `The tier ladder is an economics table with ${tierCount} tiers. Cold code should start quickly. Hot code deserves more compiler budget because that cost is amortized over many future executions.`,
    invariant: `Promotion across ${tierCount} tiers should be based on observed execution, not hope.`,
  };
  yield {
    state: tierGraph('Hot code climbs; unstable code may stop early'),
    highlight: { active: ['counter', 'sparkplug', 'maglev', 'e-counter-sparkplug', 'e-sparkplug-maglev'], compare: ['turbofan'], visited: ['feedback'] },
    explanation: `A function with high call counts and stable feedback can climb toward the top of ${tierCount} tiers. A function with unstable ${signalTypes === 2 ? 'counter or feedback' : 'signal'} data may stay in a safer, more generic tier.`,
  };
}

function* promotionPolicy() {
  const signals = 4;  // call count, loop ticks, type feedback, deopt history

  yield {
    state: labelMatrix(
      'Promotion signals',
      [
        { id: 'calls', label: 'call count' },
        { id: 'loops', label: 'loop ticks' },
        { id: 'types', label: 'type feedback' },
        { id: 'deopt', label: 'deopt history' },
      ],
      [
        { id: 'signal', label: 'signal' },
        { id: 'action', label: 'tier action' },
      ],
      [
        ['high', 'compile baseline'],
        ['hot loop', 'OSR candidate'],
        ['stable', 'optimize'],
        ['frequent', 'delay promotion'],
      ],
    ),
    highlight: { active: ['calls:action', 'loops:action', 'types:action'], compare: ['deopt:action'] },
    explanation: `Promotion policy reads ${signals} signals to act as a small scheduler. It balances startup latency, compile CPU, memory, and future execution speed.`,
  };
  yield {
    state: tierGraph('Counters are runtime data structures'),
    highlight: { active: ['counter', 'feedback', 'sparkplug'], found: ['code'], compare: ['ignition'] },
    explanation: `A counter or feedback vector is not documentation. It is mutable runtime state that ${signals} signal categories feed into compiler tiers to decide what to generate.`,
  };
  yield {
    state: tierGraph('Tiering needs a deoptimization escape hatch'),
    highlight: { active: ['maglev', 'turbofan', 'code'], compare: ['feedback'], removed: ['ignition'] },
    explanation: `Optimized code is allowed to assume facts drawn from ${signals} signal types only because Deoptimization Stack Maps & Safepoints can reconstruct a lower-tier frame when an assumption breaks.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'tier ladder') yield* tierLadder();
  else if (view === 'promotion policy') yield* promotionPolicy();
  else throw new InputError('Pick a JIT-tiering view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the tier ladder as a spending policy, not as a correctness ladder. Active nodes are the tier or signal being used now, compare nodes are higher-cost choices being delayed, and found nodes are compiled code that the runtime has decided is worth keeping.',
        {type: 'image', src: './assets/gifs/jit-tiering-hotness-counters.gif', alt: 'Animated walkthrough of the jit tiering hotness counters visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'The safe inference rule is simple: a function can move upward only after runtime evidence says future executions can repay compile cost. A hotness counter records how often code runs, and feedback records facts such as observed value types, object shapes, and call targets.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A just-in-time compiler, or JIT, compiles code while a program is already running. JavaScript engines need JITs because JavaScript is dynamic: object shapes, value types, and call targets can change while the page or server process is alive.',
        { type: 'callout', text: 'JIT tiering is runtime budget control: measure first, compile harder only when hotness and feedback justify the cost.' },
        'Compiling everything with the strongest optimizer would make startup slow and waste CPU on code that runs once. Interpreting everything would start quickly but leave hot loops paying dispatch overhead forever.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'One obvious approach is to interpret every bytecode instruction forever. That keeps startup cheap because the engine can run code immediately, but a loop that executes 10 million times pays the interpreter dispatch cost 10 million times.',
        'The opposite approach is to optimize every function before it runs. That creates fast machine code for some paths, but it also burns compile CPU and code memory on functions that may never be called again.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is uncertainty. At parse time, the engine does not yet know which functions will be hot, whether a property access will stay monomorphic, or whether arithmetic will keep seeing numbers instead of strings.',
        'Speculation is also dangerous without an escape hatch. If optimized code assumes an object has one hidden class and a later call passes a different shape, the runtime must return to a safer representation without changing JavaScript semantics.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Hotness counters turn execution into evidence. A counter attached to a function or loop says how often that code ran, and feedback vectors say what the runtime observed about types, object shapes, and call sites.',
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/3/3f/V8_JavaScript_engine_logo_2.svg', alt: 'V8 JavaScript engine logo', caption: 'V8 is a concrete runtime where interpreter, baseline, mid-tier, and optimizing tiers make the promotion ladder visible. Source: https://commons.wikimedia.org/wiki/File:V8_JavaScript_engine_logo_2.svg.' },
        'Tiering uses that evidence to spend compiler effort gradually. A cheap interpreter or baseline compiler handles cold code, while hot and stable code can climb toward a stronger optimizer that makes narrower assumptions.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A modern JavaScript engine first produces bytecode and runs it in an interpreter. While the bytecode executes, counters record calls and loop back-edges, and feedback slots record facts such as integer arithmetic, property shapes, and repeated call targets.',
        'When a threshold is crossed, the engine queues a higher-tier compilation. V8, for example, has used Ignition as the interpreter, Sparkplug as a fast baseline compiler, Maglev as a fast optimizing tier, and TurboFan as a higher-cost optimizing compiler.',
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/d/d3/Call_stack_layout.svg', alt: 'Call stack layout with frame pointer', caption: 'Deoptimization needs enough frame metadata to rebuild a lower-tier call stack when optimized assumptions fail. Source: https://commons.wikimedia.org/wiki/File:Call_stack_layout.svg.' },
        'Optimized code carries guards for its assumptions. If a guard fails, deoptimization reconstructs an interpreter-visible stack frame and resumes in a safer tier.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Tiering works because real programs are uneven. A small hot core usually consumes most runtime, while setup code, error paths, and rare UI handlers run only a few times.',
        'The correctness argument is that each tier must implement the same language semantics. Higher tiers are allowed to skip checks only behind guards, and deoptimization restores a lower-tier state when a guard proves the assumption false.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The main cost is compile CPU, code memory, and policy risk. If thresholds are too low, the engine compiles cold code; if thresholds are too high, hot code runs slowly for too long.',
        'When executions double, interpretation cost doubles unless code is promoted. If a function costs 1 microsecond interpreted, 0.2 microseconds optimized, and 2 milliseconds to compile, optimization pays back after about 2,500 future calls because each call saves 0.8 microseconds.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Browsers use tiering to balance page startup, interaction latency, and long-running JavaScript throughput. A page can start in an interpreter, then promote animation loops, framework render paths, or repeated event handlers after evidence appears.',
        'Server runtimes use the same idea for warm services. A Node.js endpoint may run cold code during deploy, then optimize hot request handlers as traffic settles into stable object shapes and call patterns.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Tiering struggles when code shape changes constantly. Megamorphic property access, proxies, generated code, changing array element kinds, and repeated deoptimizations make strong assumptions short-lived.',
        'It also fails as a benchmark story when only steady-state throughput is measured. A tier can look excellent after warmup but still hurt users if compilation competes with startup, rendering, or input handling.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a function starts in the interpreter at 1.0 microsecond per call. After 1,000 calls, Sparkplug compilation costs 0.4 milliseconds and reduces cost to 0.55 microseconds per call.',
        'The baseline tier saves 0.45 microseconds per call. The 0.4 millisecond compile cost is paid back after about 889 later calls, so promoting at 1,000 calls is reasonable if the function keeps running.',
        'Now suppose Maglev costs 2.0 milliseconds and reduces the function to 0.25 microseconds per call. From baseline, each future call saves 0.30 microseconds, so Maglev needs about 6,667 future calls to pay back.',
        'If type feedback later changes and the function deoptimizes after only 500 optimized calls, the promotion lost money. The counter proved past hotness, but the feedback stability determined whether the bet was durable.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: V8 Ignition docs at https://v8.dev/docs/ignition, Sparkplug at https://v8.dev/blog/sparkplug, Maglev at https://v8.dev/blog/maglev, and TurboFan at https://v8.dev/docs/turbofan. These explain the concrete tier names, fast baseline compilation, optimized tiers, stack-frame compatibility, and deoptimization machinery.',
        'Study interpreter dispatch first, then inline caches and hidden classes, then deoptimization stack maps and safepoints. After that, study profile-guided optimization because hotness counters are the dynamic-language version of the same evidence loop.',
      ],
    },
  ],
};
