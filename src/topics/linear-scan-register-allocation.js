// Linear scan register allocation: map many virtual registers to a small
// physical register file using live intervals, active sets, and spills.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'linear-scan-register-allocation',
  title: 'Linear Scan Register Allocation',
  category: 'Concepts',
  summary: 'Allocate virtual registers with live intervals: sort by start point, keep active intervals, expire old values, assign physical registers, and spill when pressure is too high.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['live intervals', 'spill decisions'], defaultValue: 'live intervals' },
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

function intervalGraph(title) {
  return graphState({
    nodes: [
      { id: 'ssa', label: 'SSA', x: 0.8, y: 4.0, note: 'vregs' },
      { id: 'live', label: 'live', x: 2.5, y: 4.0, note: 'uses' },
      { id: 'intervals', label: 'ranges', x: 4.4, y: 4.0, note: 'spans' },
      { id: 'active', label: 'active', x: 6.3, y: 2.5, note: 'in regs' },
      { id: 'free', label: 'free', x: 6.3, y: 5.5, note: 'pool' },
      { id: 'assign', label: 'alloc', x: 8.1, y: 4.0, note: 'R1/R2' },
      { id: 'machine', label: 'CPU', x: 9.7, y: 4.0, note: 'finite' },
    ],
    edges: [
      { id: 'e-ssa-live', from: 'ssa', to: 'live' },
      { id: 'e-live-intervals', from: 'live', to: 'intervals' },
      { id: 'e-intervals-active', from: 'intervals', to: 'active' },
      { id: 'e-intervals-free', from: 'intervals', to: 'free' },
      { id: 'e-active-assign', from: 'active', to: 'assign' },
      { id: 'e-free-assign', from: 'free', to: 'assign' },
      { id: 'e-assign-machine', from: 'assign', to: 'machine' },
    ],
  }, { title });
}

function* liveIntervals() {
  yield {
    state: intervalGraph('Register allocation starts from virtual registers'),
    highlight: { active: ['ssa', 'live', 'intervals', 'e-ssa-live', 'e-live-intervals'], compare: ['machine'] },
    explanation: 'Compiler IR can pretend there are many virtual registers. A real CPU has a small physical register file. Register allocation bridges that gap.',
  };
  yield {
    state: labelMatrix(
      'Live intervals',
      [
        { id: 'v1', label: 'v1' },
        { id: 'v2', label: 'v2' },
        { id: 'v3', label: 'v3' },
        { id: 'v4', label: 'v4' },
      ],
      [
        { id: 'start', label: 'start' },
        { id: 'end', label: 'end' },
        { id: 'register', label: 'assigned' },
      ],
      [
        ['0', '8', 'R1'],
        ['2', '5', 'R2'],
        ['4', '9', 'spill?'],
        ['6', '7', 'R2 reuse'],
      ],
    ),
    highlight: { active: ['v1:register', 'v2:register'], compare: ['v3:register'], found: ['v4:register'] },
    explanation: 'Linear scan sorts intervals by start point. As the scan moves forward, expired intervals release registers. New intervals get a free register or trigger a spill decision.',
  };
  yield {
    state: intervalGraph('The active set is the allocator state'),
    highlight: { active: ['intervals', 'active', 'free', 'assign', 'e-intervals-active', 'e-active-assign'], found: ['machine'] },
    explanation: 'The active set contains intervals currently occupying registers, usually ordered by end position. Expiring active intervals is what keeps the scan fast.',
    invariant: 'At each program point, overlapping live intervals compete for the same finite registers.',
  };
}

function* spillDecisions() {
  yield {
    state: labelMatrix(
      'Spill choice',
      [
        { id: 'current', label: 'current v3' },
        { id: 'long', label: 'active v1' },
        { id: 'short', label: 'active v2' },
        { id: 'fixed', label: 'fixed reg' },
      ],
      [
        { id: 'ends', label: 'ends at' },
        { id: 'decision', label: 'decision' },
      ],
      [
        ['9', 'spill current or v1'],
        ['8', 'candidate spill'],
        ['5', 'keep, soon expires'],
        ['call clobber', 'respect target'],
      ],
    ),
    highlight: { compare: ['current:decision', 'long:decision'], found: ['short:decision'] },
    explanation: 'When no register is free, a simple heuristic spills the interval with the farthest next use or farthest end. Keeping a short interval can be better because its register returns soon.',
  };
  yield {
    state: intervalGraph('Spills turn register pressure into memory traffic'),
    highlight: { active: ['assign', 'machine'], removed: ['free'], compare: ['active'] },
    explanation: 'A spill inserts stores and reloads around uses of a value that cannot stay in registers. This makes the program slower, but it preserves correctness under register pressure.',
  };
  yield {
    state: labelMatrix(
      'Allocator tradeoffs',
      [
        { id: 'linear', label: 'linear scan' },
        { id: 'color', label: 'graph coloring' },
        { id: 'jit', label: 'JIT compiler' },
        { id: 'aot', label: 'AOT compiler' },
      ],
      [
        { id: 'strength', label: 'strength' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['fast compile', 'local heuristics'],
        ['global quality', 'heavier analysis'],
        ['latency matters', 'prefer scan'],
        ['code quality matters', 'can spend more'],
      ],
    ),
    highlight: { active: ['linear:strength', 'jit:strength'], compare: ['color:cost'] },
    explanation: 'Linear scan is popular in JITs and fast compilers because compile time matters. More expensive allocators can produce better code when compile latency is less important.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'live intervals') yield* liveIntervals();
  else if (view === 'spill decisions') yield* spillDecisions();
  else throw new InputError('Pick a register-allocation view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Register allocation maps compiler virtual registers to a finite set of physical CPU registers and stack spill slots. Linear scan is a fast allocation strategy based on live intervals sorted by program position.',
        'It is the compiler backend version of interval scheduling under pressure. At each point, all live values need storage. If enough registers exist, values stay in registers. If not, some values spill to memory and reload later.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The compiler first computes liveness over the Control Flow Graph & Dominator Tree, often after Static Single Assignment & Phi Nodes has made value flow explicit. Each virtual register receives one or more live ranges. Linear scan sorts intervals by start position, expires intervals that have ended, assigns free registers, and spills when the active set is too large.',
        'A good implementation handles fixed registers, call-clobbered registers, lifetime holes, move coalescing, spill placement, and target constraints. The teaching version is still valuable because it exposes the central data structures: intervals, active set, free-register pool, and spill slots.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Suppose a block has virtual values v1 live from 0 to 8, v2 from 2 to 5, v3 from 4 to 9, and v4 from 6 to 7, but the target has only two registers. The scan assigns R1 to v1 and R2 to v2. At v3, no register is free, so the allocator compares future pressure and may spill v3 or evict v1. At v4, v2 has expired, so R2 can be reused.',
        'The generated code now reflects storage decisions: register operands where allocation succeeded, load/store instructions where spilling was required, and moves where ABI or instruction constraints demand specific registers.',
      ],
    },
    {
      heading: 'Target constraints',
      paragraphs: [
        'Real instruction sets complicate the teaching version. Some instructions require particular registers. Function calls clobber caller-saved registers. Return values may need specific locations. Two-address instructions may require an output to reuse an input register. These constraints can split intervals and introduce extra moves.',
        'SSA makes value flow easier to analyze, but the allocator still has to leave SSA eventually. Phi nodes become edge moves or parallel copies. Coalescing tries to remove unnecessary moves when two virtual values can safely share one physical register.',
      ],
    },
    {
      heading: 'JIT tradeoffs',
      paragraphs: [
        'Linear scan is attractive for just-in-time compilers because compile latency is user-visible. A JIT often prefers a decent allocation in microseconds or milliseconds over a globally optimal allocation that takes too long. Ahead-of-time compilers can spend more time on graph coloring, splitting, rematerialization, and target-specific scheduling.',
        'The engineering question is not which allocator is theoretically best. It is which allocator produces enough code quality inside the compile-time budget for the product: browser JavaScript, database query JIT, shader compiler, mobile app startup, or offline optimizing compiler.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: LLVM linear-scan notes at https://llvm.org/ProjectsWithLLVM/2004-Fall-CS426-LS.pdf, the UCLA register allocation reference at https://compilers.cs.ucla.edu/fernando/projects/soc/llvm_doc/regAlloc.html, and LLVM register allocation in LLVM 3.0 slides at https://llvm.org/devmtg/2011-11/Olesen_RegisterAllocation.pdf. Study Interference Graph Register Allocation, Iterated Register Coalescing, Static Single Assignment & Phi Nodes, Data-Flow Worklist Analysis, Control Flow Graph & Dominator Tree, Deoptimization Stack Maps & Safepoints, Instruction Selection DAG & GlobalISel, SSA Destruction Phi Elimination & Parallel Copy, Calling Convention & Stack Frame Layout, and Register Virtual Machine: Lua Case Study next.',
      ],
    },
  ],
};
