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
        'Follow the visualization step by step. Each frame shows one operation with the current state highlighted. Use the slider or play button to control playback.',
        {type: 'image', src: './assets/gifs/jit-tiering-hotness-counters.gif', alt: 'Animated walkthrough of the jit tiering hotness counters visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A JIT cannot afford to heavily optimize every function before it knows which code matters. Most code is cold, startup latency is visible, and optimized code needs speculative assumptions that may later break.',
        { type: 'callout', text: 'JIT tiering is runtime budget control: measure first, compile harder only when hotness and feedback justify the cost.' },
        'Tiering exists to spend compiler effort where runtime evidence says it will pay off. Code starts in a cheap tier, usually an interpreter, then hot and stable code is promoted through faster tiers.',
        'The useful way to think about a JIT is as a runtime investment manager. Interpretation buys fast startup and flexibility. Baseline compilation buys cheap machine code. Optimizing tiers buy peak throughput by spending more compile time and making stronger assumptions. Hotness counters decide when the investment is likely to pay back.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'One extreme is to interpret everything. Startup is cheap, but hot loops pay dispatch overhead forever. The other extreme is to optimize everything immediately. Peak code may be fast, but the engine burns CPU and memory compiling code that may never run again.',
        'The wall is uncertainty. The runtime only learns which functions are hot, which branches are common, and which types are stable by watching execution.',
        'Ahead-of-time compilation also has limits for dynamic languages. JavaScript can change object shapes, call targets, prototype behavior, and value types at runtime. A compiler can produce better code after it has observed those patterns, but the observations are bets, not laws.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Hotness counters and feedback vectors turn execution into compiler input. The interpreter or baseline tier counts calls and loop iterations, records observed shapes, operand types, and call targets, then a policy layer decides when to compile a better version.',
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/3/3f/V8_JavaScript_engine_logo_2.svg', alt: 'V8 JavaScript engine logo', caption: 'V8 is a concrete runtime where interpreter, baseline, mid-tier, and optimizing tiers make the promotion ladder visible. Source: https://commons.wikimedia.org/wiki/File:V8_JavaScript_engine_logo_2.svg.' },
        'Modern V8 has a ladder that includes Ignition, Sparkplug, Maglev, and TurboFan. The important data structures are counters, feedback vectors, compilation queues, dependency lists, deoptimization history, and code objects.',
        'A counter is simple, but the policy around it is not. A function called many times may still be unstable. A loop may be hot enough for on-stack replacement even if the surrounding function is not. A polymorphic property access may need generic code, while a monomorphic access can be compiled into a fast offset load. The tiering system reads all of that evidence.',
        'A concrete example is a JavaScript function that repeatedly adds numbers in a loop. Early executions run through the interpreter while the feedback vector records that both operands are small integers. After the loop becomes hot, a higher tier can generate machine code that assumes integer arithmetic. If a later call passes a string, the assumption breaks and the runtime deoptimizes to a safer tier. The optimized code was not wrong; it was conditional.',
      ],
    },
    {
      heading: 'Animation and readouts',
      paragraphs: [
        'Each tier is a different compile-time and code-quality budget, not a badge of correctness. Higher tiers may be faster because they make stronger assumptions, not because lower tiers were wrong.',
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/d/d3/Call_stack_layout.svg', alt: 'Call stack layout with frame pointer', caption: 'Deoptimization needs enough frame metadata to rebuild a lower-tier call stack when optimized assumptions fail. Source: https://commons.wikimedia.org/wiki/File:Call_stack_layout.svg.' },
        'When the animation shows deoptimization, it is the escape hatch that makes speculation safe. Optimized code can assume stable facts only because Deoptimization Stack Maps & Safepoints can reconstruct a lower-tier frame when an assumption breaks.',
        'The promotion-policy view is a scheduler readout. It schedules compile CPU, code memory, and speculation risk against expected future execution. The tier ladder is not linear progress toward truth. It is a set of tradeoffs chosen under limited evidence.',
        'The visual leaves out target-specific details such as exact thresholds, background compilation queues, inline-cache state machines, and garbage-collector metadata. Those details differ by runtime, but the limit is the same: a counter can say code ran often, not that future calls will keep the same shape.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Tiering works because most programs are uneven. A small amount of code runs a large fraction of the time, while much of the code is loaded for setup, error paths, one-time feature checks, or rarely used UI. Hotness counters let the engine find that skew while the program runs.',
        'Speculative optimization works because dynamic behavior is often stable for long stretches. The same property access may see the same hidden class thousands of times. The same arithmetic path may see numbers, not strings. The same call site may target the same function. Optimized code can specialize for those cases and deopt when reality changes.',
        'Deoptimization is what makes this bargain acceptable. The compiler can remove checks, inline functions, and specialize layouts because the runtime keeps metadata that can reconstruct an interpreter-visible state if an assumption fails. Without that escape hatch, speculative optimization would be unsafe for a dynamic language.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'Promotion thresholds are product decisions. A desktop browser, server-side runtime, embedded runtime, and mobile browser may choose different aggressiveness because startup time, battery, memory, and long-running throughput matter differently.',
        'Tiering can waste work if thresholds are wrong. Promote too eagerly and the engine compiles cold code. Promote too late and hot code runs slowly. Ignore deoptimization history and the engine can thrash between optimized and unoptimized states.',
        'There is also code-memory pressure. Each compiled version occupies memory and can evict other useful code from instruction cache. Background compilation can compete with application work. A runtime that looks fast in a long benchmark may still feel worse if it delays first interaction or creates CPU spikes during page load.',
        'Security and correctness constrain the design too. Optimized code must still preserve language semantics, guards must defend speculative assumptions, and generated code must interact with garbage collection, stack walking, and debugging. Tiering is therefore not only a speed feature; it is part of the runtime contract.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Tiering wins for dynamic languages and long-running runtimes where observed behavior can guide speculative optimization. It prevents the engine from paying top-tier compile costs before it has evidence.',
        'It also wins when programs have a small hot core surrounded by a large cold shell. Web apps, servers, command-line tools, test runners, and notebooks often have startup code, setup code, error paths, and a few repeated loops. Tiering lets those regions receive different amounts of compiler work.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Tiering fails as a mental model when benchmarks measure only peak throughput. A tier that wins a long benchmark can still hurt real pages if it delays interactivity, grows code memory, or competes with layout, rendering, and networking on the main thread.',
        'It also struggles when code changes shape constantly. Highly polymorphic call sites, generated code, megamorphic property access, proxies, and repeated deopts make top-tier assumptions short-lived. In those cases a conservative tier can be the better engineering choice because it avoids churn.',
        'Another failure mode is policy thrash. If thresholds promote too early, optimized code is compiled before feedback settles. If thresholds promote too late, hot code stays slow. If deopt history is ignored, the runtime can keep paying to rebuild code that immediately falls apart.',
      ],
    },
    {
      heading: 'Operational diagnostics',
      paragraphs: [
        'A runtime team studies tiering with traces, not vibes. Useful counters include time in interpreter, baseline compile count, optimizing compile count, compile queue delay, on-stack replacement count, deopt count, deopt reason, code memory, and time to first optimized execution. Those numbers explain whether the engine is warming up smoothly or thrashing.',
        'Application developers see tiering indirectly. A microbenchmark may look slow on the first few iterations and fast after warmup. A real UI can do the opposite: compile work may land during interaction and cause jank. That is why serious performance work separates cold start, warm steady state, and latency spikes instead of reporting one number.',
        'When studying a performance trace, ask where the program spends time before optimization, which functions become hot, which assumptions enable the optimized version, and which deopt reasons appear afterward. That habit turns JIT tiering from a black box into an evidence loop.',
      ],
    },
    {
      heading: 'Practical guidance',
      paragraphs: [
        'For application code, do not write strange JavaScript just to chase a guessed tier. First separate cold start, warm throughput, and tail latency. Then look for clear instability in hot paths: changing object shapes, mixed array element kinds, unpredictable call targets, or values that switch between numbers, strings, and objects.',
        'For runtime work, treat thresholds as workload policy. Measure compile time, code memory, deopt reasons, and user-visible latency together. A promotion rule that looks good on a loop benchmark can be wrong for an interactive page if it spends compile CPU during input handling.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: V8 Ignition docs at https://v8.dev/docs/ignition, V8 Sparkplug blog at https://v8.dev/blog/sparkplug, V8 Maglev blog at https://v8.dev/blog/maglev, and V8 TurboFan docs at https://v8.dev/docs/turbofan. Study V8 Ignition Bytecode Pipeline Case Study, Interpreter Dispatch Table & Threaded Code, Deoptimization Stack Maps & Safepoints, and PGO Edge Counters & Block Frequencies next.',
        'For practice, inspect a benchmark twice: once from cold start and once after warmup. The gap teaches why tiering is not just about fastest steady-state code. It is about the path from first execution to hot optimized execution, including all the compile work between.',
      ],
    },
  ],
};
