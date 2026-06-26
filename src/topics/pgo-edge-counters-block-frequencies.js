// Profile-guided optimization: run an instrumented program, collect counters,
// merge profile data, then feed branch probabilities back into compilation.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'pgo-edge-counters-block-frequencies',
  title: 'PGO Edge Counters & Block Frequencies',
  category: 'Concepts',
  summary: 'Profile-guided optimization as data structures: instrumented counters, raw profiles, merged profdata, branch probabilities, and hot block layout.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['instrument then use', 'branch probabilities'], defaultValue: 'instrument then use' },
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

function pgoGraph(title) {
  return graphState({
    nodes: [
      { id: 'cfg', label: 'CFG', x: 0.8, y: 3.8, note: 'blocks' },
      { id: 'inst', label: 'inst', x: 2.4, y: 2.4, note: 'counters' },
      { id: 'run', label: 'run', x: 2.4, y: 5.3, note: '' },
      { id: 'raw', label: 'raw', x: 4.2, y: 5.3, note: '.profraw' },
      { id: 'merge', label: 'merge', x: 5.8, y: 3.8, note: 'profdata' },
      { id: 'prob', label: 'prob', x: 7.3, y: 2.4, note: 'edges' },
      { id: 'freq', label: 'freq', x: 7.3, y: 5.3, note: 'blocks' },
      { id: 'opt', label: 'opt', x: 9.0, y: 3.8, note: 'layout' },
    ],
    edges: [
      { id: 'e-cfg-inst', from: 'cfg', to: 'inst' },
      { id: 'e-inst-run', from: 'inst', to: 'run' },
      { id: 'e-run-raw', from: 'run', to: 'raw' },
      { id: 'e-raw-merge', from: 'raw', to: 'merge' },
      { id: 'e-merge-prob', from: 'merge', to: 'prob' },
      { id: 'e-merge-freq', from: 'merge', to: 'freq' },
      { id: 'e-prob-opt', from: 'prob', to: 'opt' },
      { id: 'e-freq-opt', from: 'freq', to: 'opt' },
    ],
  }, { title });
}

function* instrumentThenUse() {
  const pipelineSteps = ['CFG', 'instrument', 'run', 'raw profile', 'merge', 'probabilities', 'frequencies', 'optimize'];
  const stepCount = pipelineSteps.length;
  const entryCount = 100000;
  const thenCount = 98000;
  const elseCount = 2000;
  const loopCount = 900000;

  yield {
    state: pgoGraph('PGO turns a real run into compiler input'),
    highlight: { active: ['cfg', 'inst', 'run', 'raw', 'e-cfg-inst', 'e-inst-run', 'e-run-raw'], compare: ['opt'] },
    explanation: `Instrumentation-based PGO follows ${stepCount} pipeline stages (${pipelineSteps.join(' → ')}): insert counters, run representative workloads, write raw profiles, merge them, and use the result in a later optimized build.`,
  };
  yield {
    state: labelMatrix(
      'Counter data',
      [
        { id: 'entry', label: 'function entry' },
        { id: 'then', label: 'then edge' },
        { id: 'else', label: 'else edge' },
        { id: 'loop', label: 'loop backedge' },
      ],
      [
        { id: 'count', label: 'count' },
        { id: 'compilerUse', label: 'compiler use' },
      ],
      [
        ['100000', 'inline candidate'],
        ['98000', 'hot path layout'],
        ['2000', 'cold path split'],
        ['900000', 'loop opts'],
      ],
    ),
    highlight: { active: ['then:count', 'then:compilerUse', 'loop:compilerUse'], compare: ['else:compilerUse'] },
    explanation: `Counters turn dynamic behavior into static hints. The entry ran ${entryCount.toLocaleString()} times; the then-edge fired ${thenCount.toLocaleString()} times versus only ${elseCount.toLocaleString()} for else, and the loop backedge hit ${loopCount.toLocaleString()} times. The optimizer biases inlining, layout, and loop decisions toward what actually happened.`,
    invariant: `Bad training workloads produce bad optimization hints — if the ${elseCount.toLocaleString()} else-edge count does not reflect production, cold-path splitting may hurt real performance.`,
  };
  yield {
    state: pgoGraph('Merged profile data feeds the optimizing compiler'),
    highlight: { active: ['merge', 'prob', 'freq', 'opt', 'e-merge-prob', 'e-merge-freq'], visited: ['raw'] },
    explanation: `llvm-profdata-style merging converts raw run files into indexed profile data. The compiler consumes ${stepCount - 2} downstream artifacts (probabilities, frequencies, and optimization decisions), not the original execution trace.`,
  };
}

function* branchProbabilities() {
  const optimizations = ['inlining', 'block layout', 'cold splitting', 'loop choice'];
  const optCount = optimizations.length;

  yield {
    state: pgoGraph('Branch probabilities sit on CFG edges'),
    highlight: { active: ['cfg', 'prob', 'freq'], found: ['opt'], compare: ['inst'] },
    explanation: `A block with multiple successors gets probabilities on outgoing edges. Block frequency estimates how often each block runs relative to function entry, driving ${optCount} key optimization decisions.`,
  };
  yield {
    state: labelMatrix(
      'Optimization decisions',
      [
        { id: 'inline', label: 'inlining' },
        { id: 'layout', label: 'block layout' },
        { id: 'split', label: 'cold splitting' },
        { id: 'unroll', label: 'loop choice' },
      ],
      [
        { id: 'profileSignal', label: 'profile signal' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['hot call', 'code growth'],
        ['hot fallthrough', 'stale profile'],
        ['rare edge', 'missed recovery'],
        ['hot loop', 'overfit'],
      ],
    ),
    highlight: { active: ['inline:profileSignal', 'layout:profileSignal'], compare: ['split:risk', 'unroll:risk'] },
    explanation: `PGO is not magic. It is ${optCount} weighted decisions (${optimizations.join(', ')}), each with its own profile signal and risk. The optimizer must still manage code size, stale profiles, and unusual inputs.`,
  };
  yield {
    state: pgoGraph('PGO is ahead-of-time feedback-directed tiering'),
    highlight: { active: ['run', 'merge', 'prob', 'opt'], compare: ['inst'], found: ['freq'] },
    explanation: `JIT Tiering & Hotness Counters collects feedback inside a running VM. PGO collects feedback in a training run and feeds all ${optCount} optimization categories into an ahead-of-time compiler.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'instrument then use') yield* instrumentThenUse();
  else if (view === 'branch probabilities') yield* branchProbabilities();
  else throw new InputError('Pick a PGO view.');
}

export const article = {
  sections: [
    { heading: 'How to read the animation', paragraphs: [
        'Read the graph as a compiler feedback pipeline. Active nodes show where runtime counts are collected, merged, converted into probabilities, and then used by optimization passes.',
        {type: 'image', src: './assets/gifs/pgo-edge-counters-block-frequencies.gif', alt: 'Animated walkthrough of the pgo edge counters block frequencies visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ], },
    { heading: 'Why this exists', paragraphs: [
        'Source code does not show runtime weight. Profile-guided optimization, or PGO, exists so an ahead-of-time compiler can spend code size and analysis budget on paths real workloads actually execute.',
        {type: 'callout', text: 'PGO turns runtime traffic into weights on the compiler graph, so optimization budget follows measured execution instead of source-code shape.'},
      ], },
    { heading: 'The obvious approach', paragraphs: [
        'The obvious approach is to optimize from static source structure. A compiler can guess that loops are hot, error branches are cold, and tiny functions are good inline candidates.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/Some_types_of_control_flow_graphs.svg/250px-Some_types_of_control_flow_graphs.svg.png', alt: 'Four small control-flow graph shapes with branches and loops', caption: 'PGO counters live on control-flow graph entries, blocks, and edges like these branch and loop shapes. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Some_types_of_control_flow_graphs.svg.'},
      ], },
    { heading: 'The wall', paragraphs: [
        'Static guesses fail when source shape and runtime traffic diverge. A rare-looking branch may dominate production, while a large function may be cold except during administrative recovery.',
      ], },
    { heading: 'The core insight', paragraphs: [
        'Instrument the program, run representative workloads, and turn execution counts into weights on the control-flow graph. The optimizer still preserves every legal path, but it prioritizes the measured hot paths.',
      ], },
    { heading: 'How it works', paragraphs: [
        'The first build inserts counters on function entries, edges, loops, and sometimes values. Training runs produce raw profile files, a merge step combines them, and the optimized build consumes branch probabilities and block frequencies.',
        'A block frequency estimates how often a basic block runs relative to function entry. A branch probability normalizes outgoing edge counts, such as 98000 then-edge executions versus 2000 else-edge executions.',
      ], },
    { heading: 'Why it works', paragraphs: [
        'Many compiler decisions are budget decisions. The compiler cannot inline every call, unroll every loop, or place every block on the fast path without code-size and cache costs, so measured hotness tells it where the budget is likely to pay back.',
      ], },
    { heading: 'Cost and complexity', paragraphs: [
        'PGO costs an extra instrumented build, representative training runs, profile merging, and a second optimized build. Instrumented binaries run slower, and stale profiles can turn the optimized binary into a benchmark specialist.',
      ], },
    { heading: 'Real-world uses', paragraphs: [
        'PGO is common in browsers, language runtimes, databases, compression libraries, server binaries, and command-line tools with stable workloads. It improves inlining, code layout, cold splitting, indirect-call promotion, and loop choices.',
      ], },
    { heading: 'Where it fails', paragraphs: [
        'It fails when training traffic is not representative. It also fails when source changes make profile identities stale, so build systems should track profile age, profile-use warnings, binary size, and holdout workload performance.',
      ], },
    { heading: 'Worked example', paragraphs: [
        'Suppose a function runs 100000 times, a then edge runs 98000 times, an else edge runs 2000 times, and a loop backedge runs 900000 times. PGO records a 98 percent then probability and a loop that averages about 9 backedges per entry.',
        'The compiler can lay out the then block as fallthrough, split the else block away as cold code, and spend loop optimization effort on the hot loop. Correctness is unchanged because the else path still exists; only priority changed.',
      ], },
    { heading: 'Sources and study next', paragraphs: [
        'Study LLVM instrumentation PGO and AutoFDO documentation for implementation details, then compare GCC profile-guided optimization docs. The stable concept is the same: counters become profile summaries that guide later compilation.',
        'Study Control-Flow Graph, Dominator Tree, Data-Flow Worklist Analysis, Branch Prediction, Code Layout, Inlining, JIT Tiering, and Link-Time Optimization next.',
      ], },
  ],
};
