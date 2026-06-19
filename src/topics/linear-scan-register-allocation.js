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
      heading: 'How to read the animation',
      paragraphs: [
        'The animation shows a linear scan allocator processing virtual registers one at a time. Active highlights mark the interval currently being allocated. Compared highlights mark intervals competing for the same physical register. Found highlights mark successful assignments. Removed highlights mark spilled intervals that lost their register.',
        'In the "live intervals" view, watch the matrix fill as each virtual register receives an assignment or a spill marker. In the "spill decisions" view, watch how the allocator chooses which interval to evict when register pressure exceeds supply. The graph view shows the pipeline from SSA virtual registers through liveness analysis, active-set management, and final machine-register assignment.',
        'At each frame, ask: which intervals overlap right now, how many registers are free, and why the allocator made the choice it did. If the spill decision seems wrong, check whether a different heuristic (shortest remaining lifetime vs. farthest next use) would have produced fewer total spills.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A compiler intermediate representation names values freely. Every add, load, and phi node gets its own virtual register. The optimizer never worries about how many physical registers the target has. But the CPU does worry. An x86-64 chip has 16 general-purpose registers. AArch64 has 31. A GPU lane may have 64-256 depending on occupancy targets. Register allocation is the pass that maps an unbounded virtual name space onto this finite physical file.',
        {
          type: 'quote',
          text: 'We have presented a register allocation algorithm whose time is linear in the size of the intermediate representation. This is in contrast to algorithms based on graph coloring, which have a worst-case time that is quadratic in the size of the interference graph.',
          attribution: 'Massimiliano Poletto and Vivek Sarkar, "Linear Scan Register Allocation" (1999)',
        },
        'Poletto and Sarkar published linear scan in 1999 to solve a specific production problem: JIT compilers cannot afford the compile latency of graph coloring. A Java method that runs once or twice should not wait hundreds of microseconds for optimal register assignment. Linear scan trades some code quality for a compilation speed that scales linearly with program size, making it the default allocator in most JIT compilers shipped since 2000.',
        'The core tension is compile time vs. code quality. An ahead-of-time compiler compiles once and runs millions of times, so spending seconds on allocation is fine. A JIT compiler compiles at runtime, so every microsecond of allocation is a microsecond the user waits. Linear scan exists because "good enough registers, fast" beats "perfect registers, late" when compilation is on the critical path.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Graph coloring is the textbook answer. Build an interference graph where each node is a virtual register and each edge connects two registers live at the same point. Color the graph with k colors, one per physical register. If the graph is k-colorable, every virtual register gets a physical register with no conflicts. If not, simplify: remove low-degree nodes, spill high-degree nodes, and retry. Chaitin (1981) and Briggs (1994) refined this into iterated register coalescing, which merges compatible registers to eliminate move instructions.',
        'Graph coloring produces excellent code. It sees the global interference structure, finds optimal coalescing opportunities, and handles irregular register constraints through careful graph manipulation. LLVM uses a greedy graph-coloring variant. GCC uses a sophisticated IRA (Integrated Register Allocator) with graph coloring at its core. For ahead-of-time compilers that run once per build, the cost is justified.',
        'The approach works well for functions with hundreds of virtual registers. The interference graph is sparse enough to color quickly, and the resulting code runs millions of times, amortizing the compile cost. For a static compiler, graph coloring is not just reasonable -- it is often the right choice.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Graph coloring hits a wall when compilation is on the hot path. Building the interference graph requires comparing every pair of simultaneously live values. For a function with N virtual registers, the interference graph can have O(N^2) edges. Chaitin-style simplification iterates: color, fail, spill, rebuild, re-color. Each round re-does liveness analysis and graph construction. A single hot method in a Java application can have thousands of virtual registers after inlining.',
        'The JIT wall is not theoretical. HotSpot C1, the client compiler, must compile methods in under a millisecond to avoid visible pauses. V8 Maglev must compile JavaScript functions fast enough that the user never notices the transition from interpreter to compiled code. A graph-coloring pass that takes 5ms per method is a dealbreaker when the engine compiles hundreds of methods during page load.',
        {
          type: 'note',
          text: 'The wall is not just asymptotic. Graph coloring also has high constant factors: interference graph construction requires a hash set or bit matrix per live point, and coalescing passes walk the graph repeatedly. Linear scan replaces all of this with a single sorted array and one forward pass.',
        },
        'There is a second wall: implementation complexity. A production graph-coloring allocator needs coalescing, biased coloring, aggressive spill cost estimation, rematerialization, live range splitting, and careful handling of pre-colored (fixed) registers. Linear scan needs a sort, a sweep, and a spill heuristic. The simpler implementation is easier to maintain, debug, and port to new targets.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Linear scan reduces register allocation to a scheduling problem over one-dimensional intervals. Each virtual register is alive from its first definition to its last use. That span is its live interval. The allocator sorts all intervals by start position, then sweeps forward, maintaining an active set of intervals currently occupying physical registers.',
        {
          type: 'diagram',
          label: 'Live intervals sorted by start point',
          text: 'Position:  0   1   2   3   4   5   6   7   8   9\n           |---|---|---|---|---|---|---|---|---|---|\n  v1:      [===============================]         (0-8, gets R1)\n  v2:              [===========]                      (2-5, gets R2)\n  v3:                      [===================]     (4-9, spill or split)\n  v4:                              [=======]          (6-7, gets R2 after v2 expires)',
        },
        'The algorithm has three operations at each step. First, expire: remove any active interval whose end position is before the current interval\'s start, and return its physical register to the free pool. Second, allocate: if a free register exists, assign it to the current interval and add it to the active set. Third, spill: if no register is free, compare the current interval against active intervals and evict whichever is cheapest to spill.',
        {
          type: 'code',
          language: 'javascript',
          text: '// Core linear scan: expire old intervals, then allocate or spill\nfunction linearScan(intervals, numRegisters) {\n  intervals.sort((a, b) => a.start - b.start);\n  const active = [];  // sorted by end point\n  const free = Array.from({length: numRegisters}, (_, i) => i);\n\n  for (const current of intervals) {\n    // Expire: release registers from intervals that ended\n    for (let i = active.length - 1; i >= 0; i--) {\n      if (active[i].end < current.start) {\n        free.push(active[i].register);\n        active.splice(i, 1);\n      }\n    }\n    if (free.length > 0) {\n      // Allocate: free register available\n      current.register = free.pop();\n      active.push(current);\n      active.sort((a, b) => a.end - b.end);\n    } else {\n      // Spill: evict the interval that ends latest\n      const last = active[active.length - 1];\n      if (last.end > current.end) {\n        current.register = last.register;\n        last.register = null;  // spilled to stack\n        active.pop();\n        active.push(current);\n        active.sort((a, b) => a.end - b.end);\n      } else {\n        current.register = null;  // spill current\n      }\n    }\n  }\n}',
        },
        'The spill heuristic above picks the interval with the farthest end point. This is the simplest useful policy: evicting a long-lived interval frees a register for the longest stretch. Production allocators use richer heuristics -- next-use distance, loop nesting depth, spill weight, and rematerialization cost -- but the structural skeleton is the same: sort, sweep, expire, allocate-or-spill.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness rests on the liveness overlap invariant: two values can share a physical register if and only if their live intervals do not overlap. The sorted sweep guarantees that when the allocator processes interval I, every interval starting before I has already been assigned or spilled. The active set contains exactly the intervals that overlap I\'s start point. If the active set has fewer entries than the number of physical registers, a free register exists and the assignment is safe.',
        'Expiring is safe because an interval that ended before the current start cannot conflict with any future interval processed in the sweep. The register it held is genuinely free. Spilling is safe because the spilled value moves to memory, removing it from register contention. The compiler inserts stores and reloads around the spilled interval\'s uses to maintain program semantics.',
        'The monotonic property is that the scan position only moves forward. No interval is revisited. No assignment is reconsidered (in the basic algorithm). This is what makes the algorithm O(n log n) -- dominated by the initial sort -- compared to graph coloring\'s potential O(n^2) interference graph construction. The tradeoff is that linear scan makes local decisions at each step and cannot see global interference patterns that a graph-coloring allocator would exploit.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The initial sort is O(n log n) where n is the number of live intervals. The sweep is O(n) with O(n) active-set operations. If the active set is kept sorted by end point, each insertion is O(k) where k is the number of physical registers -- a small constant (16 on x86-64, 31 on AArch64). Total: O(n log n) time, O(n) space. Doubling the number of virtual registers roughly doubles compilation time.',
        {
          type: 'table',
          headers: ['Allocator', 'Time complexity', 'Code quality', 'Compile speed', 'Used in'],
          rows: [
            ['Graph coloring (Chaitin/Briggs)', 'O(n^2) worst case', 'Excellent -- global interference', 'Slow', 'GCC, LLVM (greedy variant)'],
            ['Linear scan (Poletto & Sarkar 1999)', 'O(n log n)', 'Good -- local heuristics', 'Fast', 'HotSpot C1, early V8'],
            ['LSRA with splitting (Wimmer & Franz 2010)', 'O(n log n)', 'Very good -- interval splitting', 'Fast', 'HotSpot C2 (Graal), V8 Maglev'],
            ['Second-chance binpacking (Traub et al. 1998)', 'O(n log n)', 'Good -- second pass reclaims', 'Fast', 'Intel icc, some GPU compilers'],
          ],
        },
        'Graph coloring pays O(n^2) for global visibility. Linear scan pays O(n log n) for speed. LSRA with interval splitting (Wimmer 2010) bridges the gap: it keeps linear scan\'s speed but splits long intervals at optimal points, recovering much of the code quality that basic linear scan loses. Second-chance binpacking (Traub 1998) makes two passes -- the second pass reassigns spilled intervals that fit in registers freed by the first pass -- adding modest cost for better spill decisions.',
        'In practice, the constant factors matter as much as the asymptotics. Linear scan avoids building an interference graph (which requires bit-matrix or hash-set storage per pair of live values), avoids iterative simplification, and avoids coalescing passes. On a function with 1,000 virtual registers, this can mean 10x-50x faster compilation than graph coloring with comparable spill counts.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Linear scan dominates JIT compilation. HotSpot\'s C1 (client) compiler uses linear scan because methods must compile in under a millisecond. V8\'s Maglev tier uses a linear-scan variant because JavaScript functions are compiled during page load and any compilation pause degrades user experience. The Graal compiler (used in GraalVM and HotSpot C2 mode) uses Wimmer\'s LSRA with interval splitting, which is linear scan with surgical precision on split points.',
        'It also fits well in tiered compilation systems. The baseline tier compiles fast with linear scan. If a method is hot enough to justify recompilation, a higher tier can apply graph coloring or a more aggressive LSRA variant. The key insight is that most compiled methods run few times -- only the hottest 5-10% justify expensive allocation. Linear scan makes the common case fast.',
        {
          type: 'bullets',
          items: [
            'JIT compilers (HotSpot C1, V8 Maglev, Graal): compilation latency is user-visible, so O(n log n) allocation is mandatory.',
            'GPU shader compilers: thousands of shaders compile at application startup; a slow allocator delays the first frame.',
            'Database query compilers (e.g., HyPer, Umbra): each query is compiled to machine code at execution time; register allocation must be sub-millisecond.',
            'WebAssembly baseline compilers (V8 Liftoff, SpiderMonkey baseline): compile-on-first-call semantics require single-pass or near-single-pass allocation.',
            'Debug/fast-build modes in AOT compilers: developers iterating on code want fast builds even if the generated code is slightly slower.',
          ],
        },
        'Another structural advantage: linear scan pairs naturally with SSA form. SSA gives each value a single definition point, making live intervals easy to compute. Many SSA values have short lifetimes (one instruction defines, the next few use). Linear scan handles these efficiently because they expire quickly and recycle their registers.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Linear scan makes local decisions. When register pressure spikes in a loop body, it cannot look ahead to see that a value is reused heavily after the loop. It may spill a value that is cheap to spill locally but expensive globally because it sits in an inner loop. Graph coloring sees the full interference structure and can make better global trade-offs.',
        'Complex control flow degrades interval quality. A value live along one branch but dead along another gets a single interval spanning both paths, wasting a register on the dead path. Lifetime holes (intervals with gaps) help, but computing them accurately requires more analysis. Functions with many exception handlers, deeply nested conditionals, or irreducible control flow stress linear scan because the intervals become poor approximations of true liveness.',
        {
          type: 'note',
          text: 'Linear scan also struggles with fixed-register constraints. If an x86 division requires the dividend in RAX and the remainder lands in RDX, the allocator must insert moves around these pinned registers. Graph coloring handles this through pre-coloring constraints on the interference graph. Linear scan handles it through ad-hoc move insertion and interval splitting, which can cascade into extra spills.',
        },
        'Correctness bugs in linear scan are subtle. If liveness analysis is wrong -- a value is marked dead too early or live too late -- the allocator reuses a register that still holds a needed value, producing silent data corruption. If call-clobber sets are incomplete, a caller-saved register is reused across a call that destroys it. These bugs are hard to reproduce because they depend on specific register assignments that change with unrelated code modifications.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Massimiliano Poletto and Vivek Sarkar, "Linear Scan Register Allocation," ACM TOPLAS 21(5), 1999 -- the original paper defining the algorithm, active set, and expire/spill logic.',
            'Christian Wimmer and Michael Franz, "Linear Scan Register Allocation on SSA Form," CGO 2010 -- extends linear scan with interval splitting, lifetime holes, and SSA-aware construction; used in Oracle Graal and HotSpot.',
            'Gregory Chaitin, "Register Allocation and Spilling via Graph Coloring," SIGPLAN 1982 -- the graph-coloring baseline that linear scan aims to replace in compile-time-sensitive contexts.',
            'Preston Briggs, Keith Cooper, and Linda Torczon, "Improvements to Graph Coloring Register Allocation," ACM TOPLAS 1994 -- iterated register coalescing; the gold standard for AOT allocators.',
            'Todd Traub, Glenn Holloway, and Michael Smith, "Quality and Speed in Linear-Scan Register Allocation," SIGPLAN 1998 -- second-chance binpacking approach that makes two passes for better spill recovery.',
          ],
        },
        'Study liveness analysis and control-flow graphs first -- linear scan is only as good as its input intervals. Then study SSA form and phi elimination, which determine how intervals are constructed. After that, study graph-coloring allocation (Chaitin/Briggs) to understand what linear scan gives up and why. For production depth, read the Graal compiler source (open-source, well-documented LSRA implementation) or the V8 register allocator source.',
        'Related topics: instruction selection (the pass before allocation), instruction scheduling (the pass after, which interacts with spill placement), calling conventions (which constrain register choice across calls), stack frame layout (where spills live), and JIT tiering (which determines when linear scan is used vs. a more expensive allocator).',
      ],
    },
  ],
};

