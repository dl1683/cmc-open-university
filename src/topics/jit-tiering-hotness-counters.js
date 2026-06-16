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
  yield {
    state: tierGraph('Tiering spends compiler effort only after evidence arrives'),
    highlight: { active: ['bc', 'ignition', 'counter', 'feedback', 'e-bc-ignition', 'e-ignition-counter'], compare: ['turbofan'] },
    explanation: 'A JIT engine starts cheap. It interprets bytecode, records hotness and feedback, and delays expensive compilation until the code has proved it runs often enough.',
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
    explanation: 'The tier ladder is an economics table. Cold code should start quickly. Hot code deserves more compiler budget because that cost is amortized over many future executions.',
    invariant: 'Promotion should be based on observed execution, not hope.',
  };
  yield {
    state: tierGraph('Hot code climbs; unstable code may stop early'),
    highlight: { active: ['counter', 'sparkplug', 'maglev', 'e-counter-sparkplug', 'e-sparkplug-maglev'], compare: ['turbofan'], visited: ['feedback'] },
    explanation: 'A function with high call counts and stable feedback can climb toward optimizing tiers. A function with unstable feedback may stay in a safer, more generic tier.',
  };
}

function* promotionPolicy() {
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
    explanation: 'Promotion policy is a small scheduler. It balances startup latency, compile CPU, memory, and future execution speed.',
  };
  yield {
    state: tierGraph('Counters are runtime data structures'),
    highlight: { active: ['counter', 'feedback', 'sparkplug'], found: ['code'], compare: ['ignition'] },
    explanation: 'A counter or feedback vector is not documentation. It is mutable runtime state that compiler tiers read to decide what to generate.',
  };
  yield {
    state: tierGraph('Tiering needs a deoptimization escape hatch'),
    highlight: { active: ['maglev', 'turbofan', 'code'], compare: ['feedback'], removed: ['ignition'] },
    explanation: 'Optimized code is allowed to assume facts only because Deoptimization Stack Maps & Safepoints can reconstruct a lower-tier frame when an assumption breaks.',
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
      heading: 'What it is',
      paragraphs: [
        'JIT tiering is a runtime strategy for spending compiler effort where it pays off. Code starts in a cheap tier, usually an interpreter. The runtime counts calls, loop iterations, and feedback stability. Hot functions are promoted to baseline or optimizing compilers.',
        'Modern V8 has a ladder that includes Ignition, Sparkplug, Maglev, and TurboFan. The data-structure story is the promotion evidence: hotness counters, feedback vectors, compilation queues, deoptimization history, and code objects.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The interpreter or baseline compiler increments counters attached to functions, bytecode offsets, or loops. Feedback records observed shapes, operand types, and call targets. A policy layer decides when enough evidence exists to compile a better version.',
        'Promotion is not always monotonic. If optimized code deoptimizes repeatedly, the runtime may delay future promotion or keep execution in a safer tier. The engine is managing a portfolio of code quality, compile latency, memory, and correctness risk.',
        'The thresholds are product decisions. A desktop browser, server-side JavaScript runtime, embedded runtime, and mobile browser may choose different promotion aggressiveness because battery, memory, startup time, and long-running throughput matter differently.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A JavaScript function first runs under Ignition. After enough calls, Sparkplug can compile it quickly from bytecode. If the function remains hot and feedback is stable, Maglev can produce fast optimized code quickly. TurboFan may spend more time for top-tier optimization on the hottest paths.',
        'A loop can also trigger on-stack replacement, where execution enters optimized code without waiting for the function to return and be called again. That requires metadata mapping the interpreter state into the optimized frame.',
      ],
    },
    {
      heading: 'Pitfalls',
      paragraphs: [
        'Tiering can waste work if thresholds are wrong. Promote too eagerly and the engine burns CPU compiling cold code. Promote too late and hot code runs slowly. Ignore deoptimization history and the engine may thrash between optimized and unoptimized states.',
        'Another pitfall is measuring only peak throughput. A compiler tier that wins on a long benchmark can still hurt real pages if it delays interactivity, grows code memory, or competes with layout, rendering, and networking on the main thread.',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'A tiering implementation usually has function feedback vectors, call counters, loop counters, compilation queues, code-object tables, dependency lists, and deoptimization counters. Those structures let the runtime answer: is this code hot, is it stable, is optimized code still valid, and where should execution enter next?',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: V8 Ignition docs at https://v8.dev/docs/ignition, V8 Sparkplug blog at https://v8.dev/blog/sparkplug, V8 Maglev blog at https://v8.dev/blog/maglev, and V8 TurboFan docs at https://v8.dev/docs/turbofan. Study V8 Ignition Bytecode Pipeline Case Study, Interpreter Dispatch Table & Threaded Code, Deoptimization Stack Maps & Safepoints, and PGO Edge Counters & Block Frequencies next.',
      ],
    },
  ],
};
