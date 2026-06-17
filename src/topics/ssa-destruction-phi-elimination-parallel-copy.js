// SSA destruction: lower phi nodes into edge-specific parallel copies, then
// schedule those copies safely into ordinary non-SSA moves.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'ssa-destruction-phi-elimination-parallel-copy',
  title: 'SSA Destruction Phi Elimination & Parallel Copy',
  category: 'Concepts',
  summary: 'Leave SSA form safely: convert phi nodes into predecessor-edge parallel copies, split critical edges, resolve cycles, and emit ordinary moves.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['phi to copies', 'cycle resolution'], defaultValue: 'phi to copies' },
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

function ssaOutGraph(title) {
  return graphState({
    nodes: [
      { id: 'p1', label: 'P1', x: 0.9, y: 2.5, note: 'x1' },
      { id: 'p2', label: 'P2', x: 0.9, y: 5.2, note: 'x2' },
      { id: 'edge1', label: 'copy', x: 2.8, y: 2.5, note: 'x=x1' },
      { id: 'edge2', label: 'copy', x: 2.8, y: 5.2, note: 'x=x2' },
      { id: 'join', label: 'join', x: 4.8, y: 3.8, note: 'phi' },
      { id: 'pcopy', label: 'pcopy', x: 6.5, y: 3.8, note: 'parallel' },
      { id: 'temp', label: 'tmp', x: 8.0, y: 2.5, note: 'cycle' },
      { id: 'moves', label: 'moves', x: 9.2, y: 3.8, note: 'emit' },
    ],
    edges: [
      { id: 'e-p1-edge1', from: 'p1', to: 'edge1' },
      { id: 'e-p2-edge2', from: 'p2', to: 'edge2' },
      { id: 'e-edge1-join', from: 'edge1', to: 'join' },
      { id: 'e-edge2-join', from: 'edge2', to: 'join' },
      { id: 'e-join-pcopy', from: 'join', to: 'pcopy' },
      { id: 'e-pcopy-temp', from: 'pcopy', to: 'temp' },
      { id: 'e-temp-moves', from: 'temp', to: 'moves' },
      { id: 'e-pcopy-moves', from: 'pcopy', to: 'moves' },
    ],
  }, { title });
}

function* phiToCopies() {
  yield {
    state: ssaOutGraph('A phi node becomes edge-specific copies'),
    highlight: { active: ['p1', 'p2', 'join', 'e-edge1-join', 'e-edge2-join'], compare: ['moves'] },
    explanation: 'A phi chooses a value based on the predecessor edge. To leave SSA, insert the corresponding copy on each incoming edge before control reaches the join.',
  };
  yield {
    state: labelMatrix(
      'Phi lowering',
      [
        { id: 'phi', label: 'x=phi(x1,x2)' },
        { id: 'p1', label: 'edge P1' },
        { id: 'p2', label: 'edge P2' },
        { id: 'join', label: 'join block' },
      ],
      [
        { id: 'before', label: 'before' },
        { id: 'after', label: 'after' },
      ],
      [
        ['SSA choice', 'removed'],
        ['x1 live', 'x=x1'],
        ['x2 live', 'x=x2'],
        ['uses x', 'ordinary var'],
      ],
    ),
    highlight: { active: ['p1:after', 'p2:after'], found: ['phi:after'], compare: ['join:before'] },
    explanation: 'The copies must execute only on the path they belong to. Critical edges often need splitting so there is a safe place to put edge-specific code.',
    invariant: 'A phi assignment is conceptually parallel at block entry, not an ordered list of assignments.',
  };
  yield {
    state: ssaOutGraph('After phi elimination, later passes see ordinary moves'),
    highlight: { active: ['edge1', 'edge2', 'moves', 'e-p1-edge1', 'e-p2-edge2'], found: ['pcopy'] },
    explanation: 'Once phi nodes become moves, the backend can allocate registers, schedule instructions, and emit code using the normal machine model.',
  };
}

function* cycleResolution() {
  yield {
    state: ssaOutGraph('Parallel copies can contain cycles'),
    highlight: { active: ['pcopy', 'temp', 'e-pcopy-temp'], compare: ['moves'], found: ['join'] },
    explanation: 'A parallel copy such as (a,b) := (b,a) cannot be emitted as a naive ordered list. The first move would overwrite a value still needed by the second move.',
  };
  yield {
    state: labelMatrix(
      'Resolving (a,b) := (b,a)',
      [
        { id: 'm1', label: 'save' },
        { id: 'm2', label: 'move a' },
        { id: 'm3', label: 'move b' },
        { id: 'done', label: 'done' },
      ],
      [
        { id: 'move', label: 'move' },
        { id: 'why', label: 'why' },
      ],
      [
        ['tmp=a', 'break cycle'],
        ['a=b', 'safe now'],
        ['b=tmp', 'restore'],
        ['no phi', 'non-SSA'],
      ],
    ),
    highlight: { active: ['m1:move', 'm2:move', 'm3:move'], found: ['done:why'] },
    explanation: 'Cycle resolution introduces a temporary location or uses a swap instruction when available. The algorithm must preserve the simultaneous meaning of the original parallel copy.',
  };
  yield {
    state: ssaOutGraph('SSA destruction is part of backend correctness'),
    highlight: { active: ['join', 'pcopy', 'moves', 'e-join-pcopy', 'e-pcopy-moves'], compare: ['temp'] },
    explanation: 'Incorrect phi elimination can silently compile the wrong program. This small pass is where elegant SSA semantics meet messy machine moves.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'phi to copies') yield* phiToCopies();
  else if (view === 'cycle resolution') yield* cycleResolution();
  else throw new InputError('Pick an SSA-destruction view.');
}

export const article = {
  sections: [
    {
      heading: 'The problem SSA creates on purpose',
      paragraphs: [
        'Static single assignment form gives every computed value a distinct name. That one rule makes many compiler questions easier. A constant propagation pass can ask where a value came from without worrying that a later assignment changed the same variable. A dead-code pass can count uses of a definition. A value-numbering pass can compare definitions instead of reconstructing all the stores that might have reached a source-level variable.',
        'The price is the phi node. At a control-flow join, a value may have different definitions depending on which predecessor executed. SSA represents that choice explicitly: `x3 = phi [x1, then], [x2, else]`. The phi says that uses of `x3` in the join block should read `x1` when control arrived from `then`, and `x2` when control arrived from `else`.',
        'That is a clean mathematical model, but real processors do not execute phi instructions. A machine has registers, stack slots, moves, calls that clobber registers, and branch instructions that arrive at labels. When the backend leaves SSA, it must replace the abstract edge-dependent choice with ordinary movement of values. SSA destruction is the compiler pass that does this without changing program meaning.',
      ],
    },
    {
      heading: 'Why the naive lowering is wrong',
      paragraphs: [
        'The first tempting rewrite is to put assignments at the beginning of the join block. For `x3 = phi [x1, then], [x2, else]`, that means emitting both `x3 = x1` and `x3 = x2` in the join. This is not merely inefficient; it is semantically wrong. The join block no longer knows which predecessor was taken once both assignments are placed inside the common block. One of them will run on the wrong path.',
        'The second tempting rewrite is to put moves in predecessor blocks. This is closer, but still incomplete. If a predecessor has several successors, a move needed only for one successor must not run before the branch to a different successor. The move belongs to the edge from a particular predecessor to a particular successor. When that edge is critical, meaning the predecessor has multiple successors and the successor has multiple predecessors, there may be no existing basic block where the edge-specific move can safely live. The compiler often has to split the edge by inserting a tiny block just for those copies.',
        'The third tempting rewrite is to emit the moves in any sequential order. That fails because phi assignments are simultaneous at the top of the destination block. If the parallel copy is `(a, b) := (b, a)`, the sequence `a = b; b = a` loses the original value of `a`. If there are three values in a rotation, the same clobbering problem appears with a longer cycle. The pass must preserve the old source values until every destination that needs them has received them.',
      ],
    },
    {
      heading: 'Core insight: phis become edge copies',
      paragraphs: [
        'A phi node is best understood as a set of copies attached to incoming control-flow edges. For every phi in a join block, take each `(value, predecessor)` pair and emit a copy on that predecessor edge. After lowering, the join block reads an ordinary non-SSA location. The selected value has already been placed there before control arrives.',
        'For one phi, this is easy to picture. Suppose `join` contains `x3 = phi [x1, left], [x2, right]`. The edge `left -> join` receives a copy `x3 = x1`; the edge `right -> join` receives `x3 = x2`. The use of `x3` inside `join` no longer needs to know anything about predecessors. It just reads `x3`.',
        'Real blocks often contain several phis. Those phis are simultaneous. If `join` contains `a2 = phi [a1, p], [b1, q]` and `b2 = phi [b1, p], [a1, q]`, then on edge `q -> join` the compiler conceptually has `(a2, b2) := (b1, a1)`. This is a parallel copy, not a list. The lowering process usually has two stages: first collect the edge parallel copies, then schedule each parallel copy into a legal sequence of machine moves.',
        'Critical-edge splitting is the placement side of the same idea. If the edge has no safe location for code that runs only for that edge, create one. That tiny block may look like clutter in the control-flow graph, but it is what makes the transformation path-sensitive instead of accidentally predecessor-wide or successor-wide.',
      ],
    },
    {
      heading: 'A concrete example',
      paragraphs: [
        'Consider a simple absolute-value shape. The entry block branches to `neg` when `n < 0` and to `pos` otherwise. `neg` computes `v1 = -n`; `pos` computes `v2 = n`; the join computes `r = phi [v1, neg], [v2, pos]` and returns `r`. SSA makes the dataflow obvious: `r` is the value that came from the path that actually ran.',
        'After phi elimination, the `neg -> join` edge copies `r = v1`, and the `pos -> join` edge copies `r = v2`. If the target machine returns values in a specific register, later register allocation may coalesce `r` with `v1` on one edge and `r` with `v2` on another, removing some moves. But the semantic obligation is present even if the final machine code has no visible copy because coalescing made the source and destination the same physical location.',
        'Now consider a loop. The header may contain `i2 = phi [0, preheader], [i3, latch]`. On the preheader edge, `i2 = 0`. On the loop latch edge, `i2 = i3`. The phi describes loop-carried state. Destroying SSA does not remove the loop-carried dependency; it places the copy exactly where the previous iteration transfers control back to the header.',
        'The cyclic-copy case is the example to keep in mind for correctness. A swap needs a temporary: `tmp = a; a = b; b = tmp`, unless the target provides a real swap instruction that fits the constraints. Longer cycles are broken the same way. Acyclic copies can be scheduled by repeatedly moving sources whose destination is no longer needed as a source. Cycles require saving one value before it is overwritten.',
      ],
    },
    {
      heading: 'Why the transformation is correct',
      paragraphs: [
        'The correctness argument has two parts. First, placement must match the phi selection rule. For each incoming edge, the inserted copy assigns exactly the value that the phi would choose for that edge. Because the copy executes only when that edge is taken, the destination location contains the same value the phi would have produced at block entry.',
        'Second, scheduling must preserve parallel-copy meaning. At the moment the edge copy begins, each source name denotes an old value. At the moment it finishes, each destination must contain the corresponding old source value. Any sequential implementation is valid only if it does not overwrite a source before all destinations that need that old source have been filled. Temporaries, swaps, and careful dependency ordering are tools for meeting that obligation.',
        'This is why phi elimination is often intertwined with register coalescing. If the source and destination can share a register without creating interference, the best move is no move at all. Coalescing improves code quality, but it must not blur the semantic distinction between simultaneous phi assignments and ordered machine instructions. The pass can remove copies only after proving that the chosen locations still deliver the same edge-specific values.',
      ],
    },
    {
      heading: 'How it fits with register allocation',
      paragraphs: [
        'Some compilers destroy SSA before register allocation. Others keep SSA-like structure deeper into the backend and lower phis around allocation. Either way, the allocator must eventually assign virtual values to physical registers or stack slots, and phi-related copies become part of that location problem.',
        'A phi copy is cheap when the source and destination can occupy the same location. It is expensive when the move crosses register classes, interacts with fixed instruction operands, or forces a spill. A well-designed backend uses coalescing to remove harmless copies and live-range splitting to avoid making one long merged range that increases pressure everywhere.',
        'There is a tension here. If the compiler aggressively coalesces all phi-related values into one location, it may reduce moves but create a larger live range that overlaps more values and causes spills. If it refuses to coalesce, it preserves shorter ranges but may emit many copies at block boundaries. Good allocators treat phi elimination, coalescing, and spilling as connected decisions rather than isolated cleanup steps.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'The obvious cost is extra move instructions and extra blocks from critical-edge splitting. A naive phi destruction pass can make the control-flow graph noisier and the generated code slower. A good backend then removes many of those copies through coalescing, but it must do so without creating new interference or hiding correctness constraints.',
        'The deeper tradeoff is timing. Destroy SSA early and later backend passes see ordinary machine-like code, but some SSA structure that helped analysis is gone. Keep SSA longer and optimization remains cleaner, but the eventual lowering has to coordinate with register allocation, calling conventions, and target-specific move constraints.',
      ],
    },
    {
      heading: 'Failure modes and operational signals',
      paragraphs: [
        'The most dangerous failures are silent miscompiles. A copy placed in a predecessor block instead of on an edge can run before the wrong successor is chosen. A copy placed in the join can mix values from mutually exclusive paths. A cycle emitted as a naive list can overwrite a value before it is consumed. A backend that ignores register-class or calling-convention constraints can create code that is logically lowered but impossible for the target machine.',
        'Useful compiler engineering signals include the number of critical edges split for phi lowering, the number of parallel copies emitted, the fraction of copies removed by coalescing, spill growth after coalescing, and verifier checks that no phi remains after the destruction point. Differential testing is also valuable: run optimized and unoptimized builds over the same randomized programs and look for output divergence. Phi bugs often appear only in branchy code, loops with carried state, exception edges, and blocks with several interacting phis.',
        'SSA destruction is small compared with the optimizer around it, but it sits at the boundary where elegant IR semantics become concrete machine movement. Treat it as a correctness pass, not as formatting.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study static single assignment and phi nodes first, then dominance, liveness, interference graphs, iterated register coalescing, linear scan register allocation, SSA-based register allocation, calling conventions, and instruction selection. A useful exercise is to lower two interacting phi nodes by hand, then schedule the resulting parallel copy without clobbering any source value.',
      ],
    },
  ],
};
