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
  {
    const highlight = { active: ['entity', 'sparse', 'row', 'e-entity-sparse', 'e-sparse-row'], found: ['denseIds', 'denseVals'] };
    const activeNodes = highlight.active.filter(id => !id.startsWith('e-'));
    const foundNodes = highlight.found;
    yield {
      state: sparseSetGraph('Sparse array points into dense arrays'),
      highlight,
      explanation: `A sparse set splits membership from iteration. The ${activeNodes.length} lookup nodes (${activeNodes.join(', ')}) trace the path from entity id to dense row, while the ${foundNodes.length} found nodes (${foundNodes.join(', ')}) store only live members.`,
      invariant: 'Entity e is present when denseEntities[sparse[e]] equals e.',
    };
  }

  {
    const rows = [
      { id: 'e3', label: 'entity 3' },
      { id: 'e7', label: 'entity 7' },
      { id: 'e42', label: 'entity 42' },
      { id: 'e99', label: 'entity 99' },
    ];
    const columns = [
      { id: 'sparse', label: 'sparse[id]' },
      { id: 'dense', label: 'dense[row]' },
      { id: 'present', label: 'present?' },
    ];
    const highlight = { active: ['e42:sparse', 'e42:dense', 'e42:present'], removed: ['e99:present'] };
    const removedCell = highlight.removed[0];
    yield {
      state: labelMatrix(
        'Membership check',
        rows,
        columns,
        [
          ['0', '3', 'yes'],
          ['2', '7', 'yes'],
          ['3', '42', 'yes'],
          ['3', '42', 'no'],
        ],
      ),
      highlight,
      explanation: `Across ${rows.length} entities and ${columns.length} columns, the final equality check matters. The ${highlight.active.length} active cells confirm entity 42, while ${removedCell} shows entity 99 fails the dense confirmation because the row does not actually belong to it.`,
    };
  }

  {
    const highlight = { active: ['denseIds', 'denseVals', 'iter', 'e-ids-iter', 'e-values-iter'], compare: ['sparse'], found: ['row'] };
    const activeNodes = highlight.active.filter(id => !id.startsWith('e-'));
    const activeEdges = highlight.active.filter(id => id.startsWith('e-'));
    yield {
      state: sparseSetGraph('Iteration ignores holes by scanning only the dense side'),
      highlight,
      explanation: `Dense iteration walks ${activeNodes.length} packed nodes (${activeNodes.join(', ')}) connected by ${activeEdges.length} edges. The ${highlight.compare[0]} array fades to a supporting role because the loop scans only packed component values rather than the entire entity-id range.`,
    };
  }

  {
    const rows = [
      { id: 'sparse', label: 'sparse index' },
      { id: 'packed', label: 'packed ids' },
      { id: 'values', label: 'component values' },
      { id: 'ticks', label: 'change ticks' },
    ];
    const columns = [
      { id: 'job', label: 'job' },
      { id: 'tradeoff', label: 'tradeoff' },
    ];
    const highlight = { active: ['sparse:job', 'packed:job', 'values:job'], found: ['ticks:job'], compare: ['packed:tradeoff'] };
    const foundLabel = rows.find(r => highlight.found[0].startsWith(r.id)).label;
    yield {
      state: labelMatrix(
        'Sparse set fields',
        rows,
        columns,
        [
          ['membership', 'big id space'],
          ['iteration order', 'swap changes order'],
          ['payload storage', 'component specific'],
          ['change detection', 'metadata bytes'],
        ],
      ),
      highlight,
      explanation: `A ${rows.length}-row by ${columns.length}-column breakdown shows ${highlight.active.length} core fields and 1 extension (${foundLabel}). Production ECS pools often add ${foundLabel}, tombstones, page allocation, sorting hooks, or pointer-stability policies around the same sparse/dense core.`,
    };
  }

  {
    const highlight = { active: ['sparse', 'denseIds', 'denseVals', 'iter'], found: ['entity', 'row'] };
    yield {
      state: sparseSetGraph('Complete case: component pool for renderable entities'),
      highlight,
      explanation: `With ${highlight.active.length} active nodes (${highlight.active.join(', ')}) and ${highlight.found.length} found nodes (${highlight.found.join(', ')}), a Renderable component pool answers "does entity 42 render?" in constant time while the render loop scans a compact array of only renderable entities.`,
    };
  }
}

function* swapRemoveAndJoin() {
  {
    const highlight = { active: ['denseIds', 'denseVals', 'remove', 'e-values-remove'], found: ['sparse'], compare: ['row'] };
    const activeNodes = highlight.active.filter(id => !id.startsWith('e-'));
    yield {
      state: sparseSetGraph('Removal swaps the last dense row into the hole'),
      highlight,
      explanation: `To remove an entity, the ${activeNodes.length} active nodes (${activeNodes.join(', ')}) participate in the swap: copy the last dense entity/value into the ${highlight.compare[0]} being removed, update ${highlight.found[0]}[movedEntity], and pop the last row to keep dense arrays compact.`,
      invariant: 'After a swap remove, update sparse[movedEntity] to the moved row.',
    };
  }

  {
    const rows = [
      { id: 'before', label: 'before' },
      { id: 'hole', label: 'remove e7' },
      { id: 'move', label: 'move e42' },
      { id: 'after', label: 'after' },
    ];
    const columns = [
      { id: 'row1', label: 'row 1' },
      { id: 'row3', label: 'last row' },
      { id: 'sparse', label: 'sparse fix' },
    ];
    const highlight = { active: ['move:row1', 'move:sparse'], found: ['after:row1'], removed: ['after:row3'] };
    yield {
      state: labelMatrix(
        'Swap-remove trace',
        rows,
        columns,
        [
          ['e7', 'e42', ''],
          ['hole', 'e42', ''],
          ['e42', 'old last', 'sparse[42]=1'],
          ['e42', 'pop', 'e7 absent'],
        ],
      ),
      highlight,
      explanation: `Across ${rows.length} trace steps and ${columns.length} columns, the ${highlight.active.length} active cells show the move, the ${highlight.removed.length} removed cell (${highlight.removed[0]}) is popped. The price is unstable order; if order matters, a sparse set needs a separate ordering layer.`,
    };
  }

  {
    const highlight = { active: ['driver', 'probe', 'system', 'e-driver-probe', 'e-probe-system'], found: ['hit'], removed: ['miss'] };
    const activeNodes = highlight.active.filter(id => !id.startsWith('e-'));
    yield {
      state: joinGraph('A multi-component query iterates one pool and probes the others'),
      highlight,
      explanation: `The join path flows through ${activeNodes.length} nodes (${activeNodes.join(', ')}): iterate one dense pool, usually the smaller one, probe with O(1) membership. Entities reaching ${highlight.found[0]} have both components; those at ${highlight.removed[0]} are skipped.`,
    };
  }

  {
    const rows = [
      { id: 'sparse', label: 'sparse set' },
      { id: 'archetype', label: 'archetype' },
      { id: 'bitset', label: 'bitset' },
      { id: 'hash', label: 'hash map' },
    ];
    const columns = [
      { id: 'wins', label: 'wins at' },
      { id: 'loses', label: 'loses at' },
    ];
    const highlight = { active: ['sparse:wins', 'archetype:wins'], compare: ['sparse:loses'], found: ['hash:loses'] };
    const activeLabels = highlight.active.map(cell => rows.find(r => cell.startsWith(r.id)).label);
    yield {
      state: labelMatrix(
        'Storage choices',
        rows,
        columns,
        [
          ['add/remove', 'joined scans'],
          ['wide scans', 'structural move'],
          ['membership', 'payload access'],
          ['sparse ids', 'iteration locality'],
        ],
      ),
      highlight,
      explanation: `Comparing ${rows.length} storage strategies across ${columns.length} dimensions, ${activeLabels.join(' and ')} are highlighted as complementary winners. Sparse sets make component churn cheap; archetypes make repeated multi-component scans faster when composition is stable.`,
    };
  }

  {
    const highlight = { active: ['pos', 'vel', 'driver', 'probe', 'hit'], compare: ['miss'] };
    yield {
      state: joinGraph('Complete case: EnTT-style sparse component pools'),
      highlight,
      explanation: `EnTT popularized a sparse-set-centered ECS design with ${highlight.active.length} active nodes (${highlight.active.join(', ')}) forming the join pipeline. Each component type owns an independent sparse set, and views join those ${highlight.active.length} pools without a global bitset, skipping entities at ${highlight.compare[0]}.`,
    };
  }
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
        'Read the sparse-set animation as two connected structures, not one array. Active highlights show the entity id lookup path, found highlights show confirmed dense rows, and removed highlights show rows that stop belonging to the set.',
        {type: 'callout', text: 'A sparse set separates addressability from iteration: sparse ids find rows, while dense rows stay compact for hot loops.'},
        'The safe inference rule is this: an entity is present only when `denseEntities[sparse[entity]] === entity`. The sparse entry proposes a row; the dense entity array confirms whether that row still belongs to the queried entity.',
        {type: 'image', src: './assets/gifs/sparse-set-entity-index.gif', alt: 'Animated walkthrough of the sparse set entity index visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A game or simulation often gives every object a numeric entity id, then stores components such as Position, Velocity, or Renderable only for some of those ids. The system needs fast membership checks, but it also needs tight loops over only the entities that actually have a component.',
        'A direct array indexed by entity id makes `has component` cheap, but a large id space turns iteration into a scan over holes. A sparse set separates those jobs: the sparse side answers lookup by id, and the dense side keeps live component rows packed for cache-friendly iteration.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/3/32/Column_vs_row.svg', alt: 'Column-oriented and row-oriented storage layouts compared', caption: 'Dense component pools behave like column-oriented storage: packed arrays let systems scan one component field without visiting absent entities. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Column_vs_row.svg.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious store is `components[entityId]`. If entity 42 has Velocity, put its value at index 42; if not, leave that slot empty or marked absent.',
        'That design is easy to explain and gives constant-time lookup. It works while ids are small, dense, and mostly occupied, because lookup and iteration both touch useful memory.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Entity ids are rarely compact forever. They may be recycled, generated with version bits, assigned by a server, or spread across scenes, so the largest id can be far larger than the number of live components.',
        'A direct array then makes absence part of the hot loop. If only 20,000 of 1,000,000 possible ids have Position, a full scan touches 980,000 holes before doing useful work.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A sparse set stores live ids twice, for two different reasons. `denseEntities` stores the ids that are present in rows `0..size-1`, while `sparse[entity]` stores the row where that entity should be found.',
        'The equality check ties the two sides together. Reading `sparse[99]` alone is unsafe because that slot may be uninitialized or stale; checking `denseEntities[row] === 99` proves that the row still belongs to entity 99.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Insertion appends the entity id to `denseEntities`, appends the component value to a parallel dense value array, and writes the new row into `sparse[entity]`. Contains reads the sparse row and confirms the dense id at that row.',
        'Removal uses swap-with-last. The removed row is overwritten with the final dense row, the moved entity sparse entry is updated to its new row, and the final dense slot is popped.',
        'A multi-component query usually iterates the smaller dense pool and probes the other pools with contains. The loop stays compact, and each extra component requirement becomes a constant-time filter.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The main invariant is bidirectional agreement: for every present entity `e`, `denseEntities[sparse[e]] === e`. If that is true, the sparse array can point into the dense array without false membership.',
        'The dense-prefix invariant is equally important. Every present entity occupies one row below `size`, and no absent entity appears in that prefix, so iteration over `0..size-1` visits exactly the live members.',
        'Swap-remove is correct because it repairs the only mapping it breaks. Moving the last entity changes that entity row, and updating `sparse[movedEntity]` restores agreement before any future lookup can observe the new layout.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Contains, insert, and swap-remove are O(1) in the usual flat-array layout. Iteration is O(k), where k is the number of present entities, so doubling the live component count roughly doubles scan work while the maximum possible id does not affect the scan.',
        'The space tax is the sparse index. A flat sparse array is very fast when ids are bounded, but huge id ranges need paging, chunks, or another sparse backing store.',
        'The behavior tax is unstable order. Swap-remove keeps deletion constant time by moving the last row, so deterministic order, stable pointers, or sorted traversal need an additional policy.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Entity-component-system libraries use sparse sets for component pools, tags, dirty sets, and view joins because membership changes often while systems scan component arrays every frame. The access pattern is many packed scans with many quick contains checks.',
        'Compiler and analysis code uses the same trick for integer-keyed worklists. If ids are cheap to index but the active set is small, sparse/dense storage gives fast membership, fast clearing, and iteration over only active ids.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Sparse sets are weaker when the same wide component bundle is scanned repeatedly. Archetype storage can put Position, Velocity, Renderable, and Health for the same entities in aligned columns, avoiding repeated sparse-set joins.',
        'They also fail when ids are extremely sparse and lookup is rare. A hash map may use less memory when the program mostly does occasional lookup and does not benefit from packed dense iteration.',
        'The common implementation bug is trusting the sparse row without dense confirmation. That can turn stale rows, recycled ids, or default zeroes into false positives.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose the dense entity rows are `[3, 7, 42, 99]`, and `sparse[3] = 0`, `sparse[7] = 1`, `sparse[42] = 2`, `sparse[99] = 3`. A contains check for 42 reads row 2 and confirms `denseEntities[2] === 42`, so 42 is present.',
        'Now remove entity 7 at row 1. Move the last row, entity 99, into row 1, set `sparse[99] = 1`, and pop the final row; the dense entities become `[3, 99, 42]`.',
        'A later check for 7 may still read a number from `sparse[7]`, but dense confirmation rejects it because row 1 now contains 99. The set stayed compact, and the stale sparse slot could not create membership.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Sources: EnTT sparse set documentation and implementation, Bevy ECS sparse-set storage docs, LLVM SparseSet source, and classic ECS storage discussions from game-engine architecture. Read the implementation code after the idea, because the generation and deletion policies are where real systems differ.',
        'Study Hash Table for sparse-key lookup, Generational Arena or Slot Map for safe entity handles, Archetype ECS Column Store for the contrasting storage model, Bitset Set Operations for dense membership masks, and Packed Memory Array for order-preserving packed storage.',
      ],
    },
  ],
};
