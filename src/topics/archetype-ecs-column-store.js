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
    {
      heading: 'How to read the animation',
      paragraphs: [
        "Read the animation as the execution trace for Archetype ECS Column Store. Group entities by exact component set, store each group in packed column chunks, and move rows when components are added or removed..",
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Game engines and simulation systems spend much of their time doing the same operation to many similar things. A movement system updates positions from velocities. A visibility system reads transforms and bounds. A physics system reads colliders, masses, and transforms. The work is simple, but the data volume is large enough that memory layout can decide whether a frame fits its budget.',
        'The object-oriented version looks natural at first. Each entity is an object, and each object owns fields or pointers to components. That design is easy to explain, but it scatters hot data across the heap. A loop over moving entities may touch object headers, unrelated fields, missing components, and pointers before it reaches the two arrays it really needs: Position and Velocity.',
        'An archetype ECS exists to make the hot loop look like a data scan instead of a pile of object questions. It groups entities by exact component set, then stores each component type as a dense column inside chunks. Once a system has found chunks containing Position and Velocity, it can stream those columns in row order and ignore every entity with the wrong shape.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'A reasonable first ECS design stores one collection per component type. Position has a dense set, Velocity has a dense set, Health has a dense set, and each set maps entity ids to component values. That sparse-set style is good for adding and removing individual components because a component can appear or disappear without moving the rest of the entity. It also makes single-component access direct.',
        'The wall appears in multi-component systems. A movement system needs the intersection of entities that have Position and Velocity. A renderer may need Transform, Mesh, Material, and Visibility. If every component owns its own sparse set, the system must join sets, probe membership, and chase component locations before it can do useful work. The loop spends time proving that rows line up instead of streaming aligned data.',
        'An object layout has the opposite wall. It keeps an entity conceptually together, but systems rarely want all fields of one entity at once. They want one or two fields from many entities. The CPU cache pays for nearby bytes whether the system uses them or not. Archetype storage is the layout that says the hot access pattern is the system scan, not the single object.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is that component composition can be encoded by storage location. An entity with Position and Velocity belongs in the Position+Velocity archetype. An entity with Position, Velocity, and Health belongs in a different archetype. The archetype is not a tag stored beside the row; it is the table shape that owns the row.',
        'Inside an archetype, data is stored in chunks. A chunk contains one dense array per component type plus entity ids and metadata. Row 12 of the Position column, row 12 of the Velocity column, and row 12 of the Entity column describe the same entity. That row alignment is the invariant that turns a query into a linear scan.',
        'This is why archetype ECS feels like a column store. Analytical databases group values by column so scans touch only the fields a query needs. Archetype ECS uses the same memory instinct, but the rows are live simulation entities that can move between tables when their component set changes.',
      ],
    },
    {
      heading: 'Storage flow',
      paragraphs: [
        'The storage hierarchy is world, archetype, chunk, column, row. The world owns an entity-location index that maps each entity id to its current archetype, chunk, and row. Each archetype owns chunks for one exact component signature. Each chunk owns fixed-capacity arrays for the components in that signature.',
        'A query for Position and Velocity first finds archetypes whose signatures contain both component types. It does this using cached archetype metadata, not by asking every entity. Then it iterates the matching chunks. Inside each chunk, Position and Velocity are read by row index. If the system writes Position, it writes the Position column in the same row order.',
        'The structural-change path is the price of this layout. Adding Health to an entity is not a field assignment inside its old row. The entity no longer belongs in Position+Velocity, so the ECS allocates a row in Position+Velocity+Health, copies retained component bytes, initializes Health, removes the old row, and updates the entity-location index. Removing a component performs the same move in the other direction.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Chunk layout is usually fixed-size storage chosen to fit cache, allocator, and scheduling constraints. A chunk may store occupancy, change versions, enabled masks, shared component values, and links into a scheduler. The important property is that a chunk is a natural unit of work. A job can process one chunk or a range of chunks without inventing a partition for every system.',
        'Query caching matters because archetypes are metadata objects, not individual entities. Once a query knows which archetypes match Position and Velocity, it can reuse that list until a new archetype appears or an old one stops matching. Runtime work shifts from repeated per-entity tests to occasional query-cache invalidation.',
        'Removal keeps chunks dense with swap-with-last. If row 7 is removed, the last occupied row can move into row 7, and the moved entity location is repaired. That makes iteration compact, but it means storage order is not stable by default. Any system that needs presentation order, deterministic order, or parent-before-child order needs a separate ordering rule.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness comes from the row-alignment invariant. In one chunk, every component column has the same occupied row set. If a query scans row i of a matching chunk, the Position at row i and Velocity at row i belong to the same entity. The system does not need a join because the storage layout has already performed the join.',
        'The entity-location index preserves identity while the storage moves. Game code can keep an entity handle even though the entity changes rows during structural changes. After every move, the index must point to the new archetype, chunk, and row. If swap-with-last moved another entity into the old hole, that moved entity must also be repaired.',
        'The signature invariant explains why queries can skip work. If an archetype signature does not include Velocity, no row in any of its chunks can satisfy a Position+Velocity query. One metadata check eliminates every row in that archetype. If the signature does include both components, every occupied row has them, so the scan can run without per-row component checks.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The fast path is stable iteration. Query setup pays for matching archetypes. The scan then costs proportional to the number of rows in matching chunks, with tight memory access over the columns the system asked for. When the number of entities doubles inside the same few archetypes, scan work roughly doubles, but branch cost and lookup overhead stay low.',
        'Memory cost is the sum of component columns, entity ids, chunk metadata, query caches, and the entity-location index. Sparse optional components can waste space if they force many small archetypes or mostly empty chunks. Archetype explosion happens when the world creates many rare component combinations, each with its own metadata and query-cache interactions.',
        'The expensive path is structural change. Add component, remove component, spawn, despawn, and some prefab operations move bytes between archetypes and update indexes. If a system toggles tags every frame on thousands of entities, it can spend more time reshaping storage than running simulation. Engines often stage these changes in command buffers so hot systems get stable chunk scans and structural moves happen at known boundaries.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Consider a character simulation. Most active characters have Transform, Velocity, Collider, AnimationState, and Health. The movement system reads Transform and Velocity, so it scans every chunk whose archetype contains both. The animation system reads Transform and AnimationState. The health system scans Health. Each system gets a compact view of the columns it needs.',
        'Temporary state is where the design choice becomes visible. A Stunned component could be a real component if many systems query it and entities keep it for meaningful spans. If it appears for one frame and disappears immediately, moving rows between archetypes may be too expensive. A command buffer, sparse marker, timer wheel, or bitset can be a better fit.',
        'Projectile entities show the happy path. A projectile is born with Position, Velocity, Collider, and Lifetime. It keeps that shape until it despawns. Every frame, movement and collision systems stream the same chunks. The component set is stable, so archetype storage pays a small setup cost and gets many dense scans in return.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Archetype storage wins when systems repeatedly scan stable component sets. Movement, animation sampling, particle updates, broadphase preparation, visibility classification, audio emitter updates, and many AI perception passes have this shape. The system asks for a few columns across many entities, and most entities keep the same component set for many frames.',
        'It also helps scheduling. Chunks give the engine a natural unit for parallel jobs and conflict analysis. If one job writes Position and another reads Health, their component access declarations can be checked before execution. Chunk boundaries make it easier to split work while keeping cache-local loops.',
        'It is a good default for data that is hot, uniform, and scanned often. The more a field participates in wide systems, the more it benefits from being packed with rows that share the same query shape.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Archetype storage is weaker for high-churn optional state. If a component is constantly added and removed, the storage moves can dominate. Sparse-set storage, side tables, flags, event queues, or command buffers may be better because they make existence changes cheap even if iteration is less perfectly aligned.',
        'It is also not a replacement for relationship data structures. Parent-child transforms, scene graphs, navigation links, skeletal hierarchies, and dependency graphs may still need trees, adjacency lists, dirty queues, or topological order. ECS storage can store the components that reference those structures, but it does not make graph traversal disappear.',
        'The layout can mislead teams into over-componentizing. If every tiny state becomes its own component, the number of archetypes grows and queries become harder to reason about. Good ECS design keeps hot scan data in archetype tables and moves rare, relational, or high-churn state into structures that match those access patterns.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary references: Unity Entities archetype concepts, https://docs.unity3d.com/Packages/com.unity.entities%401.0/manual/concepts-archetypes.html; Bevy archetype module docs, https://docs.rs/bevy/latest/bevy/ecs/archetype/index.html; Bevy ComponentSparseSet docs, https://docs.rs/bevy/latest/bevy/ecs/storage/struct.ComponentSparseSet.html.',
        'Study Sparse Set Entity Index to understand the contrasting component-store design. Study Generational Arena Slot Map for stable entity handles. Study Apache Arrow Columnar Memory for the columnar layout instinct. Study Dynamic AABB Tree Broad Phase for a case where the engine needs a separate spatial structure. Study Dirty Rectangle Damage Tracking and Data Structure Design Patterns Primer for the broader lesson: choose the structure that matches the dominant access pattern, then name the tax it creates.',
      ],
    },
      {
      heading: 'The obvious approach',
      paragraphs: [
        "Name the reasonable first attempt and why teams reach for it.",
        "Then show the exact place that approach stops scaling or starts breaking.",
        "Treat this section as contrast, not a rejection.",
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
        'Use this topic as a checkpoint: if you can explain why Archetype ECS Column Store moves from input to output in the animation and where it fails, you are ready for the next topic.',
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
