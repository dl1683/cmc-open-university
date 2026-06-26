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
    explanation: `${topic.title} bridges the gap between compiler IR, which pretends there are many virtual registers, and a real CPU with a small physical register file — a core ${topic.category} problem.`,
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
    explanation: `${topic.title} sorts ${4} intervals by start point. As the scan moves forward, expired intervals release registers. New intervals get one of ${3} columns tracked per interval or trigger a spill decision.`,
  };
  yield {
    state: intervalGraph('The active set is the allocator state'),
    highlight: { active: ['intervals', 'active', 'free', 'assign', 'e-intervals-active', 'e-active-assign'], found: ['machine'] },
    explanation: `The active set in ${topic.title} contains intervals currently occupying registers, usually ordered by end position. Expiring active intervals across the ${7}-node pipeline is what keeps the scan fast.`,
    invariant: `At each program point in ${topic.title}, overlapping live intervals compete for the same finite registers — the central ${topic.category} invariant.`,
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
    explanation: `When no register is free in ${topic.title}, a simple heuristic among ${4} candidates spills the interval with the farthest next use or farthest end. Keeping a short interval can be better because its register returns soon.`,
  };
  yield {
    state: intervalGraph('Spills turn register pressure into memory traffic'),
    highlight: { active: ['assign', 'machine'], removed: ['free'], compare: ['active'] },
    explanation: `A spill in ${topic.title} inserts stores and reloads around uses of a value that cannot stay in the ${7}-node pipeline's registers. This makes the program slower, but it preserves correctness under register pressure.`,
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
    explanation: `${topic.title} is popular in JITs and fast compilers — a key ${topic.category} tradeoff among ${4} allocator strategies. More expensive allocators can produce better code when compile latency is less important.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'Each horizontal bar is a live interval, meaning the program positions where one temporary value must still be available. Registers are the small fast storage slots in the CPU. The active set contains intervals that overlap the current scan position and already occupy registers.',
        'Read every step as interval scheduling. When an interval ends before the current one starts, its register can be reused. When too many intervals overlap, one value must spill, which means it is stored in memory and later loaded back.',
        {type: 'callout', text: 'Linear scan treats register allocation as a one-pass interval scheduling problem: expire dead values, assign free registers, and spill only when overlap exceeds capacity.'},
        {type: 'image', src: './assets/gifs/linear-scan-register-allocation.gif', alt: 'Animated walkthrough of the linear scan register allocation visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Compilers create more temporary values than a CPU has registers. A register allocator decides which values live in registers and which values spill to memory. Good choices matter because register access is far cheaper than memory access.',
        'Linear scan exists for compilers that need fast allocation, such as just-in-time compilers. It gives up some optimality to allocate in one ordered pass over live intervals. That trade is attractive when compile time is part of user-visible latency.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/4f/KL_Intel_i7_die.jpg', alt: 'Intel CPU die photograph showing the silicon target of compiled machine code.', caption: 'Register allocation is where compiler temporaries become concrete machine resources on hardware. Source: Wikimedia Commons, KL/Intel, public domain.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The classic approach is graph coloring. Build an interference graph where each value is a node, and an edge means two values are live at the same time and cannot share a register. Then color the graph with k colors for k registers.',
        'Graph coloring is expressive because it sees conflicts globally. It can make better spill decisions in optimized ahead-of-time compilers. The cost is building and simplifying a graph that may be large.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with nodes connected by arrows.', caption: 'The graph-coloring baseline sees interference globally; linear scan replaces that graph with sorted live intervals and a moving active set. Source: Wikimedia Commons, David W., public domain.'},
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is compile-time cost. A just-in-time compiler may need to compile a hot function while a program is running. Spending too long on global register optimization can cost more than the runtime speed it saves.',
        'Many programs also contain short basic blocks and simple live ranges where global coloring is overkill. The allocator still must be correct, but it does not always need the most expensive possible search for a near-perfect assignment.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'If every live value is represented as an interval from first use to last use, overlap tells us register conflict. Scan intervals by start position. Keep only the intervals that are currently active, sorted by end position.',
        'When a new interval starts, expire all active intervals that already ended. If a register is free, assign it. If no register is free, spill either the new interval or the active interval with the farthest end, because that choice frees a register for the longest remaining stretch.',
      ],
    },    {
      heading: 'How it works',
      paragraphs: [
        'First compute live intervals from the intermediate representation. A value starts at its definition or first needed point and ends at its last use. Sort intervals by start position.',
        'Walk the sorted list. Before handling the next interval, remove active intervals whose end is before the new start and return their registers to the free pool. Then assign a free register or choose a spill.',
        'A spill inserts memory traffic. If the new interval ends soon, it may keep a register and force a long active interval to spill. If the new interval ends far in the future, the allocator may spill the new value instead.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The invariant is that active contains exactly the intervals that overlap the current scan position and have assigned registers. Expiring ended intervals is safe because a value past its last use can never be read again. Reusing its register cannot change program behavior.',
        'Two intervals that overlap are never assigned the same register unless one is spilled, because the allocator checks active conflicts before assignment. Two intervals that do not overlap can share a register because their lifetimes do not intersect. That is the correctness claim: every live value is either in its assigned register or in a known spill slot when needed.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Computing intervals depends on the compiler representation, but the allocation pass sorts n intervals and then scans them. With sorting, the cost is O(n log n). With intervals already in program order, the scan itself is close to O(n), plus active-set maintenance.',
        'When n doubles, sort cost grows a little more than double, while the scan grows linearly. Memory is O(n) for intervals and O(k) for the active register set, where k is the number of registers. The behavioral cost that matters later is the number of inserted loads and stores from spills.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Linear scan is common in just-in-time compilers and fast compiler tiers. It fits code that must compile quickly, then run soon after. The access pattern is one function at a time with live intervals known from local analysis.',
        'It is also used in lower optimization tiers before a hotter function earns a slower optimizing compiler. A runtime can start with fast code, collect profiling data, and later recompile with a more expensive allocator if the function stays hot.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Linear scan can spill more than graph coloring because interval endpoints hide detailed control-flow structure. A value may appear live across a long range even if only some paths need it. That coarse interval can occupy a register longer than necessary.',
        'It also needs careful handling for fixed registers, calling conventions, loops, rematerialization, and split intervals. Production allocators often split live ranges to reduce spill cost. Plain textbook linear scan is the starting point, not the whole compiler backend.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose there are two registers R1 and R2. Intervals are a:[1,4], b:[2,6], c:[3,5], and d:[7,8]. Sort by start time and scan left to right.',
        'At a, assign R1. At b, a is still active, so assign R2. At c, both a and b overlap and no register is free. The farthest end is b at 6, while c ends at 5, so spill b and give R2 to c.',
        'At d, a, b, and c have all ended or spilled out of the active set, so a register is free. Assign d to R1. The allocator used one spill because three intervals overlapped while only two registers existed.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Poletto and Sarkar, Linear Scan Register Allocation, ACM TOPLAS 1999. Study the paper for interval construction, active-set management, and why the method became important for fast compilers.',
        'Study next by role. Liveness analysis explains where intervals come from. Graph coloring allocation explains the global baseline. SSA form, live-range splitting, and rematerialization explain how production allocators reduce spills.',
      ],
    },
  ],
};
