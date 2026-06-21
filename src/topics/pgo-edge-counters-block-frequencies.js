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
      heading: 'The problem: source code hides runtime weight',
      paragraphs: [
        'A compiler can see the control-flow graph, call graph, loops, and instruction costs. It cannot automatically know which path real users take most often. Source code may put an error branch beside a hot branch. A parser may spend nearly all of its time in a few token cases. A server may have a rare but enormous administrative path. Static structure is not the same as runtime weight.',
        {type: 'callout', text: 'PGO turns runtime traffic into weights on the compiler graph, so optimization budget follows measured execution instead of source-code shape.'},
        'Without measurements, the optimizer relies on heuristics. Loops are probably hot. Error paths are probably cold. A null check probably succeeds. A small function might be worth inlining. These rules are useful, but they are guesses. They fail when a workload has a shape the heuristic did not predict.',
        'Profile-guided optimization, or PGO, feeds measured execution back into an ahead-of-time compiler. The compiler builds an instrumented binary, representative workloads exercise that binary, raw profile data is merged, and a later optimized build uses the profile to guide inlining, branch layout, block ordering, loop choices, and indirect-call promotion. Edge counters and block frequencies are the basic data structures that carry this evidence.',
      ],
    },
    {
      heading: 'The naive approach and the overfitting wall',
      paragraphs: [
        'The naive approach is to compile once with static heuristics and hope the general-purpose choices are good enough. For many programs they are. A compiler can identify simple loops, estimate branch probabilities from comparisons, and inline tiny functions without any profile. This avoids the operational burden of training runs and profile files.',
        'The wall appears in programs whose performance depends on real distributions. Consider a JSON parser. One deployment may mostly parse tiny well-formed telemetry payloads. Another may parse large nested documents with many escapes. A third may spend meaningful time rejecting malformed input. The same source code wants different hot paths, different inlining decisions, and different cold-code placement under those workloads.',
        'PGO solves one problem and creates another. It replaces generic guesses with measured evidence, but the evidence can overfit. If the training workload misses important production cases, the optimized build may favor the wrong path, inline the wrong callees, or move recovery code so far away that a supposedly rare condition becomes expensive. PGO is only as good as the representativeness and freshness of the profile.',
      ],
    },
    {
      heading: 'The core mechanism',
      paragraphs: [
        'Instrumentation-based PGO inserts counters into the program. Function-entry counters record how often a function ran. Edge counters record how often control moved from one basic block to another. Value profiling may record common indirect-call targets, common virtual-call targets, or common values at selected sites. The instrumented program writes raw profile data after running.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/Some_types_of_control_flow_graphs.svg/250px-Some_types_of_control_flow_graphs.svg.png', alt: 'Four small control-flow graph shapes with branches and loops', caption: 'PGO counters live on control-flow graph entries, blocks, and edges like these branch and loop shapes. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Some_types_of_control_flow_graphs.svg.'},
        'A merge step combines raw runs into indexed profile data. This matters because one run may cover startup, another may cover steady-state traffic, and another may cover large input files. Merge weights decide how much each run contributes. The compiler then reads the profile during the optimized build and attaches measured counts to functions, CFG edges, and sometimes values.',
        'Block frequency is derived from these counts. If function entry is treated as a baseline, each block can be assigned a relative execution frequency. Branch probability is the normalized weight of outgoing edges from a block. A block with two successors might have a 98 percent hot edge and a 2 percent cold edge. That simple ratio influences several later decisions.',
        'The profile is not a trace. The optimizer usually does not replay every event. It consumes summarized weights: counters, edge probabilities, block frequencies, call target frequencies, and profile summaries. Those summaries are compact enough to guide static optimization without turning compilation into full execution simulation.',
      ],
    },
    {
      heading: 'What optimizations use the data',
      paragraphs: [
        'Inlining is one of the largest consumers of profile data. A call inside a hot block may be worth inlining even when the callee is not tiny, because removing the call overhead and exposing more optimization can matter on the hot path. A call in a cold block may be left alone even if it looks inlineable by size. PGO turns inlining from a local size rule into a budgeted decision about measured execution weight.',
        'Block layout uses branch probabilities to improve instruction-cache locality and fallthrough behavior. If one successor is overwhelmingly likely, the compiler can place that block next so the hot path becomes straight-line code. Cold error handling can be split into a distant section. This reduces pressure on the instruction cache and branch predictor for common execution.',
        'Loop optimizations use trip counts and backedge frequencies. A loop that runs many iterations may justify unrolling, vectorization effort, or preheader work. A loop that almost never iterates should not receive the same code-size budget. Indirect-call promotion uses value profiles: if an indirect call almost always targets one function, the compiler can emit a guarded direct call on the hot path and keep the indirect fallback for other targets.',
        'The important point is that PGO does not make an edge true or false. It changes priority. The compiler still has to preserve every legal path. The profile says which paths deserve locality, code size, and analysis budget.',
      ],
    },
    {
      heading: 'Data structures and build pipeline',
      paragraphs: [
        'A typical pipeline has four stages. First, build with instrumentation. Second, run representative training workloads and collect raw profile files. Third, merge those raw files into profile data, often with weights. Fourth, rebuild with the profile enabled. Some systems add a fifth stage that validates the optimized binary against performance and correctness gates before release.',
        'The profile database needs stable identities. A function counter must still refer to the same function when the optimized build consumes it. Compilers use names, hashes, CFG checksums, and versioning to detect mismatches. If source changed too much, the profile may be partially ignored or treated as stale. This is why PGO pipelines are sensitive to build reproducibility and profile provenance.',
        'The central structures are counter arrays, mappings from counters to CFG regions, raw profile records, merged profile summaries, block-frequency info, branch-probability info, and value-profile tables. These are not user-facing features, but they are the reason PGO can be deterministic enough for a compiler pipeline instead of a pile of logs.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'PGO works because many compiler decisions are priority decisions under a budget. The compiler cannot inline everything, place every block in the fastest layout, unroll every loop, and clone every indirect call target without exploding code size. Edge counters and block frequencies tell the optimizer where extra code size and analysis time are likely to pay back.',
        'The correctness contract does not change. A cold path must still be legal, and a hot path must still preserve program semantics. The profile only changes the order of attention. That is why stale profiles usually cause performance regressions rather than wrong answers, while profile identity bugs and compiler bugs are treated as correctness issues separately.',
      ],
    },
    {
      heading: 'Where PGO wins',
      paragraphs: [
        'PGO is strongest when the program is performance-sensitive, the workload is stable enough to train, and the build system can afford a two-phase compilation process. Language runtimes, browsers, databases, compression libraries, server binaries, numerical libraries, and command-line tools with predictable workloads can all benefit.',
        'It wins by spending code size and compile-time effort where users actually spend time. Hot calls get inlined. Hot blocks sit together. Cold paths move away. Branch direction matches reality. Indirect calls that are mostly monomorphic become fast guarded direct calls. The resulting speedup is often not from one spectacular transformation but from many small choices aligning with measured behavior.',
        'PGO can also reduce variance. A binary compiled from generic heuristics may perform well on one input and poorly on another because layout accidentally matches or conflicts with the instruction cache and branch predictor. A well-trained profile makes those choices intentional for the target workload.',
      ],
    },
    {
      heading: 'Failure modes and what to monitor',
      paragraphs: [
        'The main failure is stale or unrepresentative data. A profile collected from synthetic benchmarks can optimize the benchmark and hurt production. A profile collected before a major feature change can point to blocks that no longer matter. A profile merged without weights can let rare stress tests dominate common requests or let common requests hide critical recovery paths.',
        'Another failure is profile mismatch. If the optimized build does not match the instrumented build closely enough, counters may attach poorly or be discarded. Template-heavy C++, generated code, link-time optimization, and build-flag drift can make this harder. The compiler should report profile-use warnings, missing-function rates, hash mismatches, and invalid profile records, and the build should treat unusual shifts as signals.',
        'Operationally, track profile age, workload coverage, raw run provenance, merge weights, profile-use warnings, binary size, hot-path latency, cold-path latency, branch-miss rates, instruction-cache misses, and performance on holdout workloads not used for training. Holdouts are important because they expose overfitting. A PGO build that only wins on its training run is not yet trustworthy.',
        'PGO is related to JIT feedback but not the same. A JIT collects hotness counters inside the running process and adapts to the current workload under latency constraints. A PGO pipeline collects feedback before release and lets an ahead-of-time compiler spend heavier analysis time. Study control-flow graphs, dominator trees, data-flow analysis, branch prediction, code layout, inlining heuristics, JIT tiering, and link-time optimization next.',
      ],
    },
  ],
};
