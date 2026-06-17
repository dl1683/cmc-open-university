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
      heading: 'The problem: virtual registers are free, physical registers are not',
      paragraphs: [
        'A compiler intermediate representation can create as many virtual registers as it wants. Each temporary result can receive a fresh name. This is useful for optimization because the compiler can reason about values without immediately worrying about the target machine. The processor, however, has a fixed register file. At machine-code time, every live value must be in a physical register, in memory, or recomputable.',
        'Register allocation is the pass that maps many virtual registers onto a small set of physical registers. It must respect liveness, instruction constraints, calling conventions, register classes, and spill slots. If two values are live at the same point, they cannot occupy the same register. If a value is needed after a call, the allocator must account for registers the call may clobber. If an instruction demands a specific register, the allocation must adapt.',
        'Linear scan register allocation exists because allocation quality is not the only metric. A JIT compiler, shader compiler, query compiler, or fast build mode may need acceptable machine code quickly. Linear scan turns the allocation problem into a sweep over live intervals. It gives up some global optimality in exchange for speed, simplicity, and predictable compile latency.',
      ],
    },
    {
      heading: 'Why the naive allocator fails',
      paragraphs: [
        'The most obvious allocator walks instructions and hands out a register whenever a virtual register is defined. If no register is free, it stores something to the stack. This local strategy immediately runs into trouble. A value defined early may be used much later. A value that looks dead on one path may be live through another path. A call may destroy a caller-saved register. A target instruction may require one operand in a particular register.',
        'The allocator needs a global view of when each value is live. If virtual register `v1` is defined at position 0 and last used at position 8, it occupies some storage across that span unless the compiler splits or spills it. If `v2` lives from 2 to 5, it overlaps `v1` and cannot share the same register during that region. If `v4` lives from 6 to 7, it can reuse the register that held `v2` after `v2` expires.',
        'Graph-coloring allocation models this as an interference graph: values that are live at the same time have an edge and should receive different colors, where colors are physical registers. Graph coloring can produce high-quality allocations, especially with sophisticated coalescing and spilling. It is also heavier. Linear scan keeps the key liveness information but uses intervals and a single ordered sweep instead of solving a graph-coloring problem.',
      ],
    },
    {
      heading: 'The core mechanism',
      paragraphs: [
        'Linear scan starts by numbering program positions. These positions may be instructions, instruction gaps, or more detailed slots around definitions and uses. Liveness analysis determines where each virtual register is needed. The allocator summarizes that information as live intervals: each interval has a start position and an end position, and more advanced implementations include holes where the value is not live.',
        'The intervals are sorted by start position. The allocator keeps an active set of intervals currently occupying registers, usually ordered by end position. When the scan reaches a new interval, it first expires active intervals whose end is before the new start. Expired intervals release their physical registers. If a register is now free, the new interval receives one. If all registers are occupied, the allocator chooses a spill or eviction.',
        'This works because overlapping intervals are exactly the values competing for registers at the current point. Non-overlapping intervals can reuse the same physical register without conflict. The active set is the live pressure seen by the allocator as the sweep moves forward.',
        'The simplest spill heuristic compares end positions. If the active interval with the farthest end lives longer than the current interval, spill that long active interval and give its register to the current one. Otherwise spill the current interval. More refined allocators use next-use information, loop depth, rematerialization cost, register class pressure, and split points. But the basic tradeoff remains: keep the values that are most valuable to keep in registers now.',
      ],
    },
    {
      heading: 'A concrete allocation pass',
      paragraphs: [
        'Suppose the machine has two allocatable registers, `R1` and `R2`. The compiler has four virtual registers. `v1` lives from 0 to 8. `v2` lives from 2 to 5. `v3` lives from 4 to 9. `v4` lives from 6 to 7. The intervals sorted by start are `v1`, `v2`, `v3`, `v4`.',
        'At position 0, the active set is empty, so `v1` receives `R1`. At position 2, `v1` is still active and `R2` is free, so `v2` receives `R2`. At position 4, both registers are occupied by `v1` and `v2`. The new interval `v3` wants a register. If the allocator uses farthest-end spilling, it compares `v1` ending at 8, `v2` ending at 5, and `v3` ending at 9. Since `v3` ends farthest, a simple policy may spill `v3` and keep the two active intervals.',
        'At position 6, `v2` has expired, releasing `R2`. Now `v4` can receive `R2`. This is the main benefit of interval reasoning: registers are reused as soon as liveness allows. The allocator does not need a new physical register for every virtual name; it needs enough registers for the maximum overlap, plus spill decisions when overlap exceeds supply.',
        'Real allocators often split `v3` rather than spill the whole interval. If `v3` is not used until position 9, it may be stored or rematerialized later, then loaded close to the use. Splitting turns one long hard interval into smaller pieces that fit around pressure peaks.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The proof idea is liveness overlap. If two live intervals do not overlap, assigning them the same physical register is safe because no instruction can need both values at the same time. If they do overlap, the allocator must give them different registers, split one interval, spill one interval, or use a target-specific move sequence that preserves both values.',
        'The active set is a compact representation of this constraint at the current scan position. Expiring intervals is safe because their values will not be read again in that range. Assigning a free register is safe because no active value owns it. Spill and split decisions are where quality varies, but the basic sweep is built on a correctness property: storage can be reused exactly when liveness proves the old value is dead or temporarily absent.',
      ],
    },
    {
      heading: 'Spills, reloads, and machine constraints',
      paragraphs: [
        'A spill is not just a mark in an allocator table. It becomes memory traffic. The compiler must create a stack slot, insert stores after definitions or before eviction, and insert reloads before uses that need the value in a register. On modern processors, extra loads and stores can hurt latency, bandwidth, cache behavior, and instruction count. Spilling also interacts with scheduling because a reload may need to be moved earlier to hide latency.',
        'Some values are cheaper to spill than others. A constant or simple address calculation may be rematerialized instead of loaded from memory. A value used inside a hot loop is expensive to spill because the load or store repeats many times. A value live across a call may be better placed in a callee-saved register if the save/restore cost is lower than repeated spills.',
        'Machine constraints complicate the clean interval story. Some instructions require fixed registers. Some architectures have register classes, such as general-purpose, floating-point, vector, predicate, or special address registers. Calls clobber caller-saved registers. The stack pointer and frame pointer have special roles. Linear scan implementations model these constraints by reserving registers, creating fixed intervals, adding moves, splitting intervals around calls, and selecting from the correct register class.',
      ],
    },
    {
      heading: 'Where linear scan wins',
      paragraphs: [
        'Linear scan is attractive when compile time is part of runtime. A JavaScript engine compiling a hot function, a JVM tier compiling a method, a database compiling a query plan, or a GPU driver compiling a shader cannot always afford a heavyweight allocator. A decent allocation delivered quickly can beat a slightly better allocation delivered too late.',
        'It also fits SSA-based compilers well. SSA gives precise definitions and uses, which help build live intervals. Many SSA values have short lifetimes. Phi elimination and coalescing can remove many boundary moves before or during allocation. With interval splitting and lifetime holes, modern linear-scan allocators are much more capable than the simplest textbook sweep.',
        'Another advantage is predictability. The algorithm is largely sorting plus a scan, with local decisions at pressure points. This makes it easier to bound compile latency and reason about allocator behavior. For a tiered JIT, that predictability can matter more than squeezing every possible move from the final code.',
      ],
    },
    {
      heading: 'Where it fails and what to study next',
      paragraphs: [
        'Linear scan can lose code quality on functions with complex control flow, high register pressure, irregular target constraints, and long live ranges that need global splitting choices. A graph-coloring allocator or a more expensive SSA allocator may find better coalescing, fewer spills, or better handling of awkward interference. Ahead-of-time compilers often have enough time to spend more effort on hard functions.',
        'It also fails when its inputs are wrong. Bad liveness creates use-after-clobber bugs. Incorrect call-clobber modeling loses values across calls. Incorrect phi elimination can force impossible moves or compile the wrong value at a join. Missing register-class constraints can assign a floating-point value to a general-purpose register or place an operand where the instruction cannot read it. Register allocation is a correctness pass as well as a performance pass.',
        'Useful signals include spill count, reload count, dynamic spill cost estimated by block frequency, number of split intervals, move count after coalescing, allocation time per function, maximum active-set size, and verifier errors for illegal operands. Performance analysis should separate compile-time wins from runtime losses. A fast allocator that adds too many loads in a hot loop may be wrong for a top-tier compiler even if it is right for a baseline tier.',
        'Study liveness analysis, control-flow graphs, dominance, SSA form, phi elimination, interference graph allocation, iterated register coalescing, calling conventions, instruction selection, stack-frame layout, rematerialization, and JIT tiering. Linear scan is best understood as a practical engineering point in the allocator design space: less global than coloring, far faster to run, and powerful enough when paired with good interval construction and splitting.',
      ],
    },
  ],
};
