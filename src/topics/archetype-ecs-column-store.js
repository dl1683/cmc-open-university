// Archetype ECS storage: columnar chunks grouped by component signature.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'archetype-ecs-column-store',
  title: 'Archetype ECS Column Store',
  category: 'Data Structures',
  summary: 'Group entities by exact component set, store each group in packed column chunks, and move rows when components are added or removed.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['archetype chunks', 'structural change'], defaultValue: 'archetype chunks' },
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

function archetypeGraph(title) {
  return graphState({
    nodes: [
      { id: 'world', label: 'world', x: 0.8, y: 3.5, note: 'entities' },
      { id: 'archPV', label: 'P+V', x: 2.8, y: 2.0, note: 'archetype' },
      { id: 'archPR', label: 'P+R', x: 2.8, y: 5.0, note: 'archetype' },
      { id: 'chunk', label: 'chunk', x: 4.9, y: 2.0, note: 'rows' },
      { id: 'pos', label: 'Position[]', x: 7.0, y: 1.0, note: 'column' },
      { id: 'vel', label: 'Velocity[]', x: 7.0, y: 2.8, note: 'column' },
      { id: 'entity', label: 'Entity[]', x: 7.0, y: 4.6, note: 'ids' },
      { id: 'query', label: 'query', x: 9.0, y: 2.8, note: 'P,V' },
    ],
    edges: [
      { id: 'e-world-pv', from: 'world', to: 'archPV', weight: '' },
      { id: 'e-world-pr', from: 'world', to: 'archPR', weight: '' },
      { id: 'e-pv-chunk', from: 'archPV', to: 'chunk', weight: '' },
      { id: 'e-chunk-pos', from: 'chunk', to: 'pos', weight: '' },
      { id: 'e-chunk-vel', from: 'chunk', to: 'vel', weight: '' },
      { id: 'e-chunk-entity', from: 'chunk', to: 'entity', weight: '' },
      { id: 'e-pos-query', from: 'pos', to: 'query', weight: '' },
      { id: 'e-vel-query', from: 'vel', to: 'query', weight: '' },
    ],
  }, { title });
}

function moveGraph(title) {
  return graphState({
    nodes: [
      { id: 'row', label: 'entity e', x: 0.8, y: 3.5, note: 'P+V' },
      { id: 'remove', label: 'remove row', x: 2.8, y: 2.0, note: 'source' },
      { id: 'copy', label: 'copy cols', x: 4.8, y: 3.5, note: 'P,V' },
      { id: 'add', label: 'add H', x: 6.8, y: 2.0, note: 'new comp' },
      { id: 'dest', label: 'P+V+H', x: 6.8, y: 5.0, note: 'target' },
      { id: 'fix', label: 'fix loc', x: 8.8, y: 3.5, note: 'entity index' },
      { id: 'swap', label: 'swap last', x: 2.8, y: 5.0, note: 'fill gap' },
    ],
    edges: [
      { id: 'e-row-remove', from: 'row', to: 'remove', weight: '' },
      { id: 'e-remove-copy', from: 'remove', to: 'copy', weight: '' },
      { id: 'e-copy-add', from: 'copy', to: 'add', weight: '' },
      { id: 'e-copy-dest', from: 'copy', to: 'dest', weight: '' },
      { id: 'e-add-dest', from: 'add', to: 'dest', weight: '' },
      { id: 'e-dest-fix', from: 'dest', to: 'fix', weight: '' },
      { id: 'e-remove-swap', from: 'remove', to: 'swap', weight: '' },
      { id: 'e-swap-fix', from: 'swap', to: 'fix', weight: '' },
    ],
  }, { title });
}

function* archetypeChunks() {
  yield {
    state: archetypeGraph('Entities with the same component set share an archetype'),
    highlight: { active: ['world', 'archPV', 'chunk', 'e-world-pv', 'e-pv-chunk'], found: ['pos', 'vel', 'entity'] },
    explanation: 'An archetype is the exact component signature of an entity. All entities with Position and Velocity, and no extra table components, can live together in the same storage group.',
    invariant: 'One archetype owns rows whose entities have the same component set.',
  };

  yield {
    state: labelMatrix(
      'Chunk columns',
      [
        { id: 'row0', label: 'row 0' },
        { id: 'row1', label: 'row 1' },
        { id: 'row2', label: 'row 2' },
        { id: 'row3', label: 'row 3' },
      ],
      [
        { id: 'entity', label: 'Entity' },
        { id: 'pos', label: 'Position' },
        { id: 'vel', label: 'Velocity' },
      ],
      [
        ['e12', '(4,8)', '(1,0)'],
        ['e19', '(6,7)', '(0,1)'],
        ['e31', '(9,2)', '(-1,0)'],
        ['e44', '(2,5)', '(0,-1)'],
      ],
    ),
    highlight: { active: ['row0:pos', 'row1:pos', 'row2:pos', 'row3:pos'], found: ['row0:vel', 'row1:vel', 'row2:vel', 'row3:vel'] },
    explanation: 'Inside a chunk, each component type is stored as a tight array. A movement system can stream Position and Velocity columns in row order with predictable memory access.',
  };

  yield {
    state: archetypeGraph('Queries cache matching archetypes and scan their chunks'),
    highlight: { active: ['query', 'pos', 'vel', 'e-pos-query', 'e-vel-query'], compare: ['archPR'], found: ['chunk'] },
    explanation: 'A query for Position plus Velocity does not inspect every entity. It finds matching archetypes, then scans their chunks. That is why archetype sets tend to stabilize and become cacheable.',
  };

  yield {
    state: labelMatrix(
      'Why column chunks are fast',
      [
        { id: 'scan', label: 'linear scan' },
        { id: 'cache', label: 'cache lines' },
        { id: 'simd', label: 'SIMD' },
        { id: 'parallel', label: 'parallel jobs' },
      ],
      [
        { id: 'benefit', label: 'benefit' },
        { id: 'condition', label: 'condition' },
      ],
      [
        ['few branches', 'stable query'],
        ['packed fields', 'hot columns'],
        ['same operation', 'numeric data'],
        ['chunk splitting', 'no conflicts'],
      ],
    ),
    highlight: { active: ['scan:benefit', 'cache:benefit', 'simd:benefit'], found: ['parallel:benefit'] },
    explanation: 'The structure converts object-oriented pointer chasing into columnar loops. It is especially strong for transforms, physics integration, visibility, particles, and repeated simulation systems.',
  };

  yield {
    state: archetypeGraph('Complete case: update many moving entities'),
    highlight: { active: ['archPV', 'chunk', 'pos', 'vel', 'query'], found: ['entity'], compare: ['archPR'] },
    explanation: 'A frame update can find every chunk containing Position and Velocity, stream through those columns, and skip unrelated entities entirely. The cost is paid when entity composition changes.',
  };
}

function* structuralChange() {
  yield {
    state: moveGraph('Adding a component moves the entity to another archetype'),
    highlight: { active: ['row', 'remove', 'copy', 'add', 'dest', 'e-row-remove', 'e-remove-copy', 'e-copy-add', 'e-copy-dest'], found: ['fix'] },
    explanation: 'When an entity gains Health, it no longer belongs in the Position+Velocity archetype. The ECS copies the retained columns to a Position+Velocity+Health row, initializes Health, and updates the entity location index.',
    invariant: 'Component composition is encoded by storage location, so composition changes are storage moves.',
  };

  yield {
    state: labelMatrix(
      'Structural change trace',
      [
        { id: 'source', label: 'source P+V' },
        { id: 'copy', label: 'copy retained' },
        { id: 'init', label: 'init Health' },
        { id: 'index', label: 'entity index' },
      ],
      [
        { id: 'action', label: 'action' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['remove row', 'swap gap'],
        ['P and V columns', 'copy bytes'],
        ['write H column', 'constructor'],
        ['new archetype,row', 'bookkeeping'],
      ],
    ),
    highlight: { active: ['copy:action', 'init:action'], found: ['index:action'], compare: ['source:cost'] },
    explanation: 'This is why adding and removing components in tight loops is expensive. The operation changes storage groups, not just a flag.',
  };

  yield {
    state: moveGraph('Swap-with-last keeps source chunks packed'),
    highlight: { active: ['remove', 'swap', 'fix', 'e-remove-swap', 'e-swap-fix'], found: ['dest'], compare: ['copy'] },
    explanation: 'Removing a row from the source chunk usually moves the last row into the hole. The moved entity location must be repaired, just like swap-remove in a sparse set.',
  };

  yield {
    state: labelMatrix(
      'Archetype versus sparse-set storage',
      [
        { id: 'archetype', label: 'archetype table' },
        { id: 'sparse', label: 'sparse component' },
        { id: 'chunk', label: 'chunk metadata' },
        { id: 'query', label: 'query cache' },
      ],
      [
        { id: 'best', label: 'best at' },
        { id: 'watch', label: 'watch out' },
      ],
      [
        ['wide iteration', 'composition churn'],
        ['frequent add/remove', 'join probes'],
        ['batch scheduling', 'fragmentation'],
        ['stable signatures', 'invalidations'],
      ],
    ),
    highlight: { active: ['archetype:best', 'sparse:best'], compare: ['archetype:watch'], found: ['query:best'] },
    explanation: 'Modern ECS engines often support both table/archetype storage and sparse-set storage because each one makes a different workload cheap.',
  };

  yield {
    state: moveGraph('Complete case: stage structural changes outside hot simulation loops'),
    highlight: { active: ['add', 'dest', 'fix'], compare: ['copy', 'swap'], found: ['row'] },
    explanation: 'A common engine rule is to batch structural changes at command-buffer boundaries. Hot systems stream chunks. Spawn/despawn and add/remove operations are staged so storage moves do not interrupt tight loops.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'archetype chunks') yield* archetypeChunks();
  else if (view === 'structural change') yield* structuralChange();
  else throw new InputError('Pick an archetype-ECS view.');
}

export const article = {
  sections: [
    { heading: 'What it is', paragraphs: [
      'An archetype ECS stores entities by exact component set. Entities with Position and Velocity live in one group. Entities with Position, Velocity, and Health live in another. Each group stores component data in packed columns, usually inside fixed-size chunks.',
      'This is a data-structure choice, not just an architecture label. It turns repeated systems into columnar scans over dense arrays, similar in spirit to analytical column stores, but tuned for mutable simulation worlds.',
    ] },
    { heading: 'How it works', paragraphs: [
      'The world keeps an entity-location index that maps each entity id to an archetype, chunk, and row. A query for Position and Velocity finds matching archetypes, then iterates chunks and reads the Position and Velocity columns in row order.',
      'When a component is added or removed, the entity changes archetype. The ECS copies retained component columns to the target archetype, initializes or drops the changed component, fills the source row gap, and repairs entity locations.',
    ] },
    { heading: 'Cost and complexity', paragraphs: [
      'The fast path is scanning stable component sets. Query iteration can be cache-friendly, branch-light, SIMD-friendly, and easy to split across jobs by chunk. The expensive path is structural change: add/remove component, spawn, despawn, or any operation that moves rows between archetypes.',
      'Archetype explosion is another cost. If a program creates many rare component combinations, metadata and empty archetypes can accumulate. Real engines cache queries and expect archetype sets to stabilize after startup or level load.',
    ] },
    { heading: 'Complete case study', paragraphs: [
      'A character simulation has thousands of entities with Transform, Velocity, and Collider. The movement system scans exactly those chunks and updates positions. Rendering scans Transform plus Mesh. The engine batches commands that add Stunned, Invisible, or NetworkOwned components so those structural moves happen outside the tight simulation loop.',
      'Unity DOTS stores archetype chunks as packed arrays per component type. Bevy documents archetypes as unique component combinations and distinguishes archetypes from tables and sparse-set components. The shared lesson is the same: choose archetype tables for stable, repeated scans and sparse sets for high-churn optional components.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Sources: Unity Entities archetype concepts, https://docs.unity3d.com/Packages/com.unity.entities%401.0/manual/concepts-archetypes.html; Bevy archetype module docs, https://docs.rs/bevy/latest/bevy/ecs/archetype/index.html; Bevy ComponentSparseSet docs, https://docs.rs/bevy/latest/bevy/ecs/storage/struct.ComponentSparseSet.html. Study Sparse Set Entity Index, Generational Arena Slot Map, Apache Arrow Columnar Memory, Dynamic AABB Tree Broad Phase, and Data Structure Design Patterns Primer next.',
    ] },
  ],
};
