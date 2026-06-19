// Sparse set: O(1) membership plus dense iteration for entity-component pools.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'sparse-set-entity-index',
  title: 'Sparse Set Entity Index',
  category: 'Data Structures',
  summary: 'Keep a sparse entity-id array pointing into dense packed arrays, so membership is O(1), iteration is cache-friendly, and removal is swap-with-last.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['dense sparse mapping', 'swap remove and join'], defaultValue: 'dense sparse mapping' },
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

function sparseSetGraph(title) {
  return graphState({
    nodes: [
      { id: 'entity', label: 'e42', x: 0.8, y: 3.5, note: 'query' },
      { id: 'sparse', label: 'sparse', x: 2.7, y: 3.5, note: 'id -> row' },
      { id: 'denseIds', label: 'entities', x: 4.8, y: 2.2, note: 'packed' },
      { id: 'denseVals', label: 'values', x: 4.8, y: 5.0, note: 'packed' },
      { id: 'row', label: 'row 3', x: 6.9, y: 3.5, note: 'match' },
      { id: 'iter', label: 'scan', x: 8.8, y: 2.2, note: 'dense' },
      { id: 'remove', label: 'swap', x: 8.8, y: 5.0, note: 'delete' },
    ],
    edges: [
      { id: 'e-entity-sparse', from: 'entity', to: 'sparse', weight: '' },
      { id: 'e-sparse-row', from: 'sparse', to: 'row', weight: '' },
      { id: 'e-row-ids', from: 'row', to: 'denseIds', weight: '' },
      { id: 'e-row-values', from: 'row', to: 'denseVals', weight: '' },
      { id: 'e-ids-iter', from: 'denseIds', to: 'iter', weight: '' },
      { id: 'e-values-iter', from: 'denseVals', to: 'iter', weight: '' },
      { id: 'e-values-remove', from: 'denseVals', to: 'remove', weight: '' },
    ],
  }, { title });
}

function joinGraph(title) {
  return graphState({
    nodes: [
      { id: 'pos', label: 'Position', x: 0.9, y: 2.0, note: 'dense' },
      { id: 'vel', label: 'Velocity', x: 0.9, y: 5.0, note: 'dense' },
      { id: 'driver', label: 'small pool', x: 3.0, y: 3.5, note: 'iterate' },
      { id: 'probe', label: 'contains?', x: 5.1, y: 3.5, note: 'O(1)' },
      { id: 'system', label: 'system', x: 7.1, y: 3.5, note: 'move' },
      { id: 'miss', label: 'skip', x: 9.0, y: 2.0, note: 'no vel' },
      { id: 'hit', label: 'update', x: 9.0, y: 5.0, note: 'has both' },
    ],
    edges: [
      { id: 'e-pos-driver', from: 'pos', to: 'driver', weight: '' },
      { id: 'e-vel-driver', from: 'vel', to: 'driver', weight: '' },
      { id: 'e-driver-probe', from: 'driver', to: 'probe', weight: '' },
      { id: 'e-probe-system', from: 'probe', to: 'system', weight: '' },
      { id: 'e-system-miss', from: 'system', to: 'miss', weight: '' },
      { id: 'e-system-hit', from: 'system', to: 'hit', weight: '' },
    ],
  }, { title });
}

function* denseSparseMapping() {
  yield {
    state: sparseSetGraph('Sparse array points into dense arrays'),
    highlight: { active: ['entity', 'sparse', 'row', 'e-entity-sparse', 'e-sparse-row'], found: ['denseIds', 'denseVals'] },
    explanation: 'A sparse set splits membership from iteration. The sparse array is indexed by entity id and stores the dense row. The dense arrays store only live members.',
    invariant: 'Entity e is present when denseEntities[sparse[e]] equals e.',
  };

  yield {
    state: labelMatrix(
      'Membership check',
      [
        { id: 'e3', label: 'entity 3' },
        { id: 'e7', label: 'entity 7' },
        { id: 'e42', label: 'entity 42' },
        { id: 'e99', label: 'entity 99' },
      ],
      [
        { id: 'sparse', label: 'sparse[id]' },
        { id: 'dense', label: 'dense[row]' },
        { id: 'present', label: 'present?' },
      ],
      [
        ['0', '3', 'yes'],
        ['2', '7', 'yes'],
        ['3', '42', 'yes'],
        ['3', '42', 'no'],
      ],
    ),
    highlight: { active: ['e42:sparse', 'e42:dense', 'e42:present'], removed: ['e99:present'] },
    explanation: 'The final equality check matters. Sparse entries can contain old row numbers or default values. The dense entity id confirms that the row actually belongs to the queried entity.',
  };

  yield {
    state: sparseSetGraph('Iteration ignores holes by scanning only the dense side'),
    highlight: { active: ['denseIds', 'denseVals', 'iter', 'e-ids-iter', 'e-values-iter'], compare: ['sparse'], found: ['row'] },
    explanation: 'Dense iteration is the reason sparse sets are useful in ECS systems. The loop walks packed component values rather than scanning the entire possible entity-id range.',
  };

  yield {
    state: labelMatrix(
      'Sparse set fields',
      [
        { id: 'sparse', label: 'sparse index' },
        { id: 'packed', label: 'packed ids' },
        { id: 'values', label: 'component values' },
        { id: 'ticks', label: 'change ticks' },
      ],
      [
        { id: 'job', label: 'job' },
        { id: 'tradeoff', label: 'tradeoff' },
      ],
      [
        ['membership', 'big id space'],
        ['iteration order', 'swap changes order'],
        ['payload storage', 'component specific'],
        ['change detection', 'metadata bytes'],
      ],
    ),
    highlight: { active: ['sparse:job', 'packed:job', 'values:job'], found: ['ticks:job'], compare: ['packed:tradeoff'] },
    explanation: 'Production ECS pools often add change ticks, tombstones, page allocation, sorting hooks, or pointer-stability policies around the same sparse/dense core.',
  };

  yield {
    state: sparseSetGraph('Complete case: component pool for renderable entities'),
    highlight: { active: ['sparse', 'denseIds', 'denseVals', 'iter'], found: ['entity', 'row'] },
    explanation: 'A Renderable component pool can answer "does entity 42 render?" in constant time while the render loop scans a compact array of only renderable entities.',
  };
}

function* swapRemoveAndJoin() {
  yield {
    state: sparseSetGraph('Removal swaps the last dense row into the hole'),
    highlight: { active: ['denseIds', 'denseVals', 'remove', 'e-values-remove'], found: ['sparse'], compare: ['row'] },
    explanation: 'To remove an entity, swap the last dense entity/value into the removed row, update that moved entity sparse entry, and pop the last row. This keeps dense arrays compact.',
    invariant: 'After a swap remove, update sparse[movedEntity] to the moved row.',
  };

  yield {
    state: labelMatrix(
      'Swap-remove trace',
      [
        { id: 'before', label: 'before' },
        { id: 'hole', label: 'remove e7' },
        { id: 'move', label: 'move e42' },
        { id: 'after', label: 'after' },
      ],
      [
        { id: 'row1', label: 'row 1' },
        { id: 'row3', label: 'last row' },
        { id: 'sparse', label: 'sparse fix' },
      ],
      [
        ['e7', 'e42', ''],
        ['hole', 'e42', ''],
        ['e42', 'old last', 'sparse[42]=1'],
        ['e42', 'pop', 'e7 absent'],
      ],
    ),
    highlight: { active: ['move:row1', 'move:sparse'], found: ['after:row1'], removed: ['after:row3'] },
    explanation: 'The price is unstable order. If order matters, a sparse set needs a separate ordering layer or a slower stable delete policy.',
  };

  yield {
    state: joinGraph('A multi-component query iterates one pool and probes the others'),
    highlight: { active: ['driver', 'probe', 'system', 'e-driver-probe', 'e-probe-system'], found: ['hit'], removed: ['miss'] },
    explanation: 'To run a movement system needing Position and Velocity, iterate one dense pool, usually the smaller one, and use O(1) sparse membership checks against the other pools.',
  };

  yield {
    state: labelMatrix(
      'Storage choices',
      [
        { id: 'sparse', label: 'sparse set' },
        { id: 'archetype', label: 'archetype' },
        { id: 'bitset', label: 'bitset' },
        { id: 'hash', label: 'hash map' },
      ],
      [
        { id: 'wins', label: 'wins at' },
        { id: 'loses', label: 'loses at' },
      ],
      [
        ['add/remove', 'joined scans'],
        ['wide scans', 'structural move'],
        ['membership', 'payload access'],
        ['sparse ids', 'iteration locality'],
      ],
    ),
    highlight: { active: ['sparse:wins', 'archetype:wins'], compare: ['sparse:loses'], found: ['hash:loses'] },
    explanation: 'Sparse sets and archetypes are complementary. Sparse sets make component churn cheap. Archetypes make repeated multi-component scans faster when composition is stable.',
  };

  yield {
    state: joinGraph('Complete case: EnTT-style sparse component pools'),
    highlight: { active: ['pos', 'vel', 'driver', 'probe', 'hit'], compare: ['miss'] },
    explanation: 'EnTT popularized a sparse-set-centered ECS design. Each component type can own an independent sparse set, and views join those pools without needing a global bitset of every component combination.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'dense sparse mapping') yield* denseSparseMapping();
  else if (view === 'swap remove and join') yield* swapRemoveAndJoin();
  else throw new InputError('Pick a sparse-set view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        "Read the animation as the execution trace for Sparse Set Entity Index. Keep a sparse entity-id array pointing into dense packed arrays, so membership is O(1), iteration is cache-friendly, and removal is swap-with-last..",
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Entity-component systems need two operations that pull storage in opposite directions. Gameplay code asks, "does entity 42 have Velocity?" Render, physics, and AI loops ask, "scan every entity with this component."',
        'A flat array indexed by entity id gives direct lookup, but a large or recycled id space becomes mostly holes. A hash map avoids holes, but iteration jumps around memory. A sparse set splits the two jobs: use a sparse id-to-row index for membership and dense packed arrays for iteration.',
        'That split is why sparse sets show up in ECS libraries, compiler worklists, and other integer-keyed sets with frequent membership checks and hot iteration loops.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The simplest component store is an array indexed directly by entity id. `components[42]` either holds Velocity or says absent. Contains is easy, and the code is almost too simple to justify an abstraction.',
        'The wall is sparsity. Entity ids often come from generational allocators, network handles, scene graphs, or recycled slots. The maximum id can be much larger than the number of live components. Iterating the direct array makes absence part of the hot loop.',
        'A hash map fixes wasted scans but loses packed traversal. The CPU can no longer stream through component values. A sparse set keeps the direct id lookup path while moving live ids and payloads into dense arrays.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A sparse set has at least two arrays. `denseEntities` stores the entity ids that are present, packed from row 0 to row `size - 1`. `sparse` is indexed by entity id and stores the row where that entity should appear in `denseEntities`.',
        'A component pool usually adds `denseValues` beside `denseEntities`. Row `i` in `denseValues` is the component value for entity `denseEntities[i]`. The dense side is the iteration order; the sparse side is only an index into that order.',
        'The membership check is `row = sparse[e]`, then `row < size && denseEntities[row] === e`. The equality check is not decoration. It rejects uninitialized sparse entries, stale rows left behind by removal, and ids that collide through default values.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Insertion appends the entity id to `denseEntities`, appends the payload to `denseValues`, and writes `sparse[entity] = newRow`. Contains is one sparse read plus one dense confirmation.',
        'Removal uses swap-with-last. Find the row for the removed entity, copy the last dense entity and value into that row, update `sparse[movedEntity]` to the new row, then pop the last dense row. That keeps the dense arrays hole-free.',
        'A join over two component pools usually iterates the smaller dense pool and probes the other pool with `contains(entity)`. This is why sparse sets are useful in ECS views: one loop streams through packed data while other component requirements become constant-time filters.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose the Position pool contains entities `[3, 7, 42]` in dense rows `[0, 1, 2]`. The sparse array has `sparse[3] = 0`, `sparse[7] = 1`, and `sparse[42] = 2`.',
        'To check entity 42, read row 2 and confirm `denseEntities[2] === 42`. To check entity 99, the sparse entry may hold an old number or a default zero, but the dense confirmation fails because the dense row does not contain 99.',
        'To remove entity 7, move the last row, entity 42, into row 1. Then set `sparse[42] = 1` and pop the old last row. The dense list becomes `[3, 42]`. The set stayed compact, but order changed.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The main invariant is bidirectional agreement: for every present entity `e`, `denseEntities[sparse[e]] === e`. The sparse array points to the dense row, and the dense row confirms the identity.',
        'The dense arrays also maintain the no-holes invariant. Every live element occupies one row below `size`, and no absent entity appears in that prefix. Iteration can therefore scan rows `0..size-1` without testing holes.',
        'Swap-remove is correct because it repairs the only mapping it breaks. Moving the last entity changes that entity row, so updating `sparse[movedEntity]` restores bidirectional agreement.',
      ],
    },
    {
      heading: 'How it works (2)',
      paragraphs: [
        'In the dense-sparse mapping view, follow the query entity into the sparse array and then back into the dense entity row. The highlighted dense confirmation is the safety check that stops stale sparse entries from pretending to be membership.',
        'When the animation switches to dense iteration, the sparse side fades into a supporting role. The scan walks only packed entity and value rows. That state change is the performance win: absence has left the loop.',
        'In the swap-remove view, watch the moved last row and the sparse fix together. The swap keeps the dense arrays compact, but the sparse update is what keeps future membership checks correct. In the join view, the smaller pool is the driver and the other pool is a constant-time filter.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'In the common layout, insert, remove, and contains are O(1). Iteration is O(k), where k is the number of present ids, not O(maxEntityId). If the live set doubles, a full scan roughly doubles; the maximum possible id does not matter to iteration.',
        'The memory cost is the sparse index. A flat sparse array is fast but can be wasteful for a huge id universe. Production systems often page the sparse side so only touched id ranges allocate memory.',
        'The hidden cost is order instability. Swap-remove changes dense order. If systems depend on stable order, deterministic replay, pointer stability, or sorted iteration, the storage layer must add a separate ordering or stable-delete policy.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Sparse sets win for single-component pools, optional components, tags, dirty sets, selection sets, visibility sets, and other collections where membership changes often and iteration must stay packed.',
        'They are strong when systems can iterate one dense pool and probe a few others. A movement system can scan Position or Velocity and skip entities that lack the companion component without building a global table of every component combination.',
        'They also fit compiler and analysis code where ids are dense enough to index but the active set is small. The same sparse/dense trick gives fast clear and fast iteration over only active integers.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Sparse sets are weaker for stable, repeated scans over many components at once. An archetype column store can keep Position, Velocity, Health, and Renderable together for entities that share the same component bundle, reducing repeated sparse-set joins.',
        'They are awkward when entity ids are unbounded and cannot be paged efficiently. A hash map may be better for extremely sparse, low-iteration workloads.',
        'They are also awkward when removal must preserve order. Stable deletion can be implemented, but it gives up the clean O(1) swap-remove behavior or adds another index layer.',
      ],
    },
    {
      heading: 'Where it fails (2)',
      paragraphs: [
        'The classic bug is forgetting to update the moved entity sparse entry during removal. The dense array still looks compact, but the next contains check for the moved entity points at the wrong row.',
        'Another bug is trusting `sparse[e]` without checking `denseEntities[row] === e`. Uninitialized memory, stale rows, and recycled ids can all produce false membership.',
        'Entity reuse needs generations or another freshness check. If entity 42 is destroyed and a new entity reuses the same numeric slot, old sparse entries and external handles must not accidentally refer to the new object.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Sources: EnTT Entity Component System wiki at https://github.com/skypjack/entt/wiki/Entity-Component-System, EnTT sparse set implementation at https://github.com/skypjack/entt/blob/master/src/entt/entity/sparse_set.hpp, Bevy ComponentSparseSet docs at https://docs.rs/bevy/latest/bevy/ecs/storage/struct.ComponentSparseSet.html, and LLVM SparseSet source at https://llvm.org/doxygen/SparseSet_8h_source.html.',
        'Study Generational Arena Slot Map for safe entity handles, Archetype ECS Column Store for the contrasting storage model, Roaring Bitmaps for compressed set membership, Hash Table for sparse-key lookup, and Packed Memory Array for order-preserving packed storage.',
      ],
    },
      {
      heading: 'The wall',
      paragraphs: [
        "Every topic in this pattern has a hard boundary where a tempting shortcut fails; define that boundary first.",
        "State the exact invariant that must hold, show one operation sequence that can break it, and explain what changes after a failure and why.",
        "If you can reproduce this wall in one example, the rest of the page is motivated.",
      ],
    },
    {
      heading: 'Learning map',
      paragraphs: [
        'Before this topic, check your prerequisites and map what is assumed, what is computed, and where this mechanism first appears in real systems.',
        'After this topic, follow each unlock topic and test whether you can explain why this mechanism unlocks it.',
        'Use the frame order to prove one invariant per frame and one cost consequence per major operation.',
      ],
    },

    {
      heading: 'Frame-by-frame checkpoints',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Pause on each state change and name exactly what data moved, which references changed, and why the move is legal.',
            'State the invariant that must remain true before the next frame starts.',
            'Track what changed in size, order, ownership, or topology for the operation you are watching.',
            'Translate the active frame into a one-line explanation as if teaching a teammate.',
          ],
        },
      ],
    },

    {
      heading: 'Micro checks',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Can you state one operation-level invariant in one sentence?',
            'Can you derive the time cost from the frame sequence without referencing external formulas?',
            'Can you name one hidden edge case where the naive implementation fails?',
            'Can you transfer this mechanism to one system from a different domain?',
          ],
        },
      ],
    },

    {
      heading: 'Try this now',
      paragraphs: [
        'Build one counterexample input by hand and predict every animation frame before running it; compare your prediction to the trace.',
        'Use this topic as a checkpoint: if you can explain why Sparse Set Entity Index moves from input to output in the animation and where it fails, you are ready for the next topic.',
      ],
    },

      {
        heading: 'Sources and study next',
        paragraphs: [
          'Read one primary source, one implementation source, and one production case where this idea appears.',
          'If they disagree on a detail, prefer the source with the clearest constraint and define the simplification for this animation.',
          'Then choose three study topics: one prerequisite, one extension, and one case study for your next session.',
        ],
      },
],
};

