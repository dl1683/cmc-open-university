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
    { heading: 'What it is', paragraphs: [
      'A sparse set represents a set of integer ids with two coordinated arrays. The sparse side is indexed by id and stores a dense row. The dense side stores the ids that are actually present, usually alongside payload values. Membership is constant time, and iteration touches only present elements.',
      'The core check is sparse plus dense confirmation. Given id e, read row = sparse[e]. The id is present only if row is in range and dense[row] equals e. That equality check protects against uninitialized sparse entries and stale row numbers.',
    ] },
    { heading: 'How it works', paragraphs: [
      'Insertion appends the entity id to denseEntities, appends the component value to denseValues, and writes sparse[entity] = newRow. Removal swaps the last dense row into the removed row, updates the moved entity sparse entry, and pops the arrays.',
      'The result is an excellent component pool. The ECS can iterate only entities that have a component, while point queries such as "does entity 42 have Velocity?" stay O(1).',
    ] },
    { heading: 'Cost and complexity', paragraphs: [
      'Insert, remove, and contains are O(1) in the common layout. Iteration is O(k) for k present ids, not O(maxEntityId). The tradeoff is memory for the sparse array and unstable dense order after swap-remove.',
      'Large id spaces often use paged sparse arrays instead of one giant flat allocation. Production systems may add change ticks, stable deletion modes, sorting, tombstones, or separate component payload arrays.',
    ] },
    { heading: 'Complete case study', paragraphs: [
      'A game ECS stores Position in one sparse set and Velocity in another. The movement system iterates the smaller dense pool and probes the other pool by entity id. Entities without both components are skipped. Entities that gain or lose one component update only that component pool, avoiding a whole-archetype move.',
      'This design fits highly dynamic components such as tags, marker states, visibility, selection, networking ownership, or short-lived gameplay effects. Stable, wide scans over many components often move toward archetype column stores instead.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Sources: EnTT Entity Component System wiki, https://github.com/skypjack/entt/wiki/Entity-Component-System; EnTT sparse set implementation, https://github.com/skypjack/entt/blob/master/src/entt/entity/sparse_set.hpp; Bevy ComponentSparseSet docs, https://docs.rs/bevy/latest/bevy/ecs/storage/struct.ComponentSparseSet.html. Study Generational Arena Slot Map, Archetype ECS Column Store, Roaring Bitmaps, Hash Table, and Packed Memory Array next.',
    ] },
  ],
};
