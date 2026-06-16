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
  yield {
    state: pgoGraph('PGO turns a real run into compiler input'),
    highlight: { active: ['cfg', 'inst', 'run', 'raw', 'e-cfg-inst', 'e-inst-run', 'e-run-raw'], compare: ['opt'] },
    explanation: 'Instrumentation-based PGO inserts counters, runs representative workloads, writes raw profiles, merges them, and uses the result in a later optimized build.',
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
    explanation: 'Counters turn dynamic behavior into static hints. The optimizer can bias inlining, block layout, branch direction, and loop decisions toward what actually happened.',
    invariant: 'Bad training workloads produce bad optimization hints.',
  };
  yield {
    state: pgoGraph('Merged profile data feeds the optimizing compiler'),
    highlight: { active: ['merge', 'prob', 'freq', 'opt', 'e-merge-prob', 'e-merge-freq'], visited: ['raw'] },
    explanation: 'llvm-profdata-style merging converts raw run files into indexed profile data. The compiler consumes probabilities and frequencies, not the original execution trace.',
  };
}

function* branchProbabilities() {
  yield {
    state: pgoGraph('Branch probabilities sit on CFG edges'),
    highlight: { active: ['cfg', 'prob', 'freq'], found: ['opt'], compare: ['inst'] },
    explanation: 'A block with multiple successors gets probabilities on outgoing edges. Block frequency estimates how often each block runs relative to function entry.',
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
    explanation: 'PGO is not magic. It is a set of weighted decisions. The optimizer must still manage code size, stale profiles, and unusual inputs.',
  };
  yield {
    state: pgoGraph('PGO is ahead-of-time feedback-directed tiering'),
    highlight: { active: ['run', 'merge', 'prob', 'opt'], compare: ['inst'], found: ['freq'] },
    explanation: 'JIT Tiering & Hotness Counters collects feedback inside a running VM. PGO collects feedback in a training run and feeds it into an ahead-of-time compiler.',
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
    {
      heading: 'What it is',
      paragraphs: [
        'Profile-guided optimization uses runtime behavior to guide a later compilation. The compiler inserts counters, the program runs on representative workloads, raw profile files are merged, and the next build uses the profile to optimize for common paths.',
        'The central data structures are counters, raw profile records, indexed profile data, branch probabilities, block frequencies, and value-profile records such as likely indirect-call targets.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Instrumentation records how many times functions, blocks, edges, and sometimes values are observed. A merge tool combines runs into a profile database. The compiler then annotates IR or internal CFG analyses with execution counts and probabilities.',
        'Those weights guide inlining, code layout, branch ordering, loop unrolling, indirect-call promotion, and cold-code splitting. The code is still statically compiled, but it carries evidence from real execution.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Imagine a parser where valid input takes the fast branch 98 percent of the time and error recovery takes the slow branch 2 percent of the time. PGO can arrange the fast path as fallthrough, move cold error blocks away from hot code, and inline the common token reader.',
        'If production input differs from the training workload, the profile can become harmful. That is the central discipline: collect representative workloads, merge enough runs, and watch for stale profile mismatches.',
        'For libraries, representative means more than one benchmark. A JSON parser trained only on tiny documents may optimize different branches than one trained on large nested documents, malformed input, and Unicode-heavy strings. The profile is a data product, so it needs coverage thinking too.',
      ],
    },
    {
      heading: 'Relation to JITs',
      paragraphs: [
        'PGO resembles JIT feedback, but the timeline is different. A JIT uses counters while the program is running. PGO records counters in one run and applies them to a later build. Both turn dynamic execution into compiler data.',
        'The tradeoff is control. PGO can spend normal ahead-of-time compiler time using high-quality global analyses, but it only sees the training workloads. A JIT sees the actual current workload, but it must compile under latency and memory constraints.',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'The profile database needs stable function identities, hashes that detect source or IR drift, counter arrays, value-profile tables, summary statistics, and merge weights. The optimizer then translates those records into CFG edge probabilities, block frequencies, callsite weights, and hot/cold annotations.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Clang user manual PGO section at https://clang.llvm.org/docs/UsersManual.html, LLVM instrumentation profile format at https://llvm.org/docs/InstrProfileFormat.html, llvm-profdata guide at https://llvm.org/docs/CommandGuide/llvm-profdata.html, and LLVM build-with-PGO guide at https://llvm.org/docs/HowToBuildWithPGO.html. Study Control Flow Graph & Dominator Tree, Data-Flow Worklist Analysis, JIT Tiering & Hotness Counters, Deoptimization Stack Maps & Safepoints, and Instruction Selection DAG & GlobalISel next.',
      ],
    },
  ],
};
