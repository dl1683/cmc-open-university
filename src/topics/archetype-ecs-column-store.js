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
  const components = ['pos', 'vel', 'entity'];
  yield {
    state: archetypeGraph('Entities with the same component set share an archetype'),
    highlight: { active: ['world', 'archPV', 'chunk', 'e-world-pv', 'e-pv-chunk'], found: components },
    explanation: `An archetype is the exact component signature of an entity. All entities with ${components[0][0].toUpperCase() + components[0].slice(1)}ition and ${components[1][0].toUpperCase() + components[1].slice(1)}ocity, and no extra table components, can live together in the same storage group.`,
    invariant: `One archetype owns rows whose entities share the same ${components.length}-component set.`,
  };

  const chunkRows = [
    { id: 'row0', label: 'row 0' },
    { id: 'row1', label: 'row 1' },
    { id: 'row2', label: 'row 2' },
    { id: 'row3', label: 'row 3' },
  ];
  const chunkCols = [
    { id: 'entity', label: 'Entity' },
    { id: 'pos', label: 'Position' },
    { id: 'vel', label: 'Velocity' },
  ];
  yield {
    state: labelMatrix(
      'Chunk columns',
      chunkRows,
      chunkCols,
      [
        ['e12', '(4,8)', '(1,0)'],
        ['e19', '(6,7)', '(0,1)'],
        ['e31', '(9,2)', '(-1,0)'],
        ['e44', '(2,5)', '(0,-1)'],
      ],
    ),
    highlight: { active: chunkRows.map(r => r.id + ':pos'), found: chunkRows.map(r => r.id + ':vel') },
    explanation: `Inside a chunk, each of the ${chunkCols.length} component columns is stored as a tight array across ${chunkRows.length} rows. A movement system can stream ${chunkCols[1].label} and ${chunkCols[2].label} columns in row order with predictable memory access.`,
  };

  const queryTargets = ['pos', 'vel'];
  yield {
    state: archetypeGraph('Queries cache matching archetypes and scan their chunks'),
    highlight: { active: ['query', ...queryTargets, 'e-pos-query', 'e-vel-query'], compare: ['archPR'], found: ['chunk'] },
    explanation: `A query for ${queryTargets.map(t => t[0].toUpperCase() + t.slice(1)).join(' plus ')} does not inspect every entity. It finds matching archetypes, then scans their chunks. That is why archetype sets tend to stabilize and become cacheable.`,
  };

  const speedReasons = [
    { id: 'scan', label: 'linear scan' },
    { id: 'cache', label: 'cache lines' },
    { id: 'simd', label: 'SIMD' },
    { id: 'parallel', label: 'parallel jobs' },
  ];
  yield {
    state: labelMatrix(
      'Why column chunks are fast',
      speedReasons,
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
    highlight: { active: speedReasons.slice(0, 3).map(r => r.id + ':benefit'), found: ['parallel:benefit'] },
    explanation: `The structure converts object-oriented pointer chasing into columnar loops with ${speedReasons.length} speed advantages: ${speedReasons.map(r => r.label).join(', ')}. It is especially strong for transforms, physics integration, visibility, particles, and repeated simulation systems.`,
  };

  const activeNodes = ['archPV', 'chunk', 'pos', 'vel', 'query'];
  yield {
    state: archetypeGraph('Complete case: update many moving entities'),
    highlight: { active: activeNodes, found: ['entity'], compare: ['archPR'] },
    explanation: `A frame update touches ${activeNodes.length} nodes in the pipeline — archetype, chunk, and both columns through the query — streaming through Position and Velocity while skipping unrelated entities entirely. The cost is paid when entity composition changes.`,
  };
}

function* structuralChange() {
  const moveSteps = ['row', 'remove', 'copy', 'add', 'dest'];
  yield {
    state: moveGraph('Adding a component moves the entity to another archetype'),
    highlight: { active: [...moveSteps, 'e-row-remove', 'e-remove-copy', 'e-copy-add', 'e-copy-dest'], found: ['fix'] },
    explanation: `When an entity gains Health, it no longer belongs in the Position+Velocity archetype. The ECS performs ${moveSteps.length} steps: ${moveSteps.join(' -> ')}, copying retained columns to a Position+Velocity+Health row, initializing Health, and updating the entity location index.`,
    invariant: `Component composition is encoded by storage location, so composition changes require ${moveSteps.length - 1} data moves plus a fix step.`,
  };

  const traceSteps = [
    { id: 'source', label: 'source P+V' },
    { id: 'copy', label: 'copy retained' },
    { id: 'init', label: 'init Health' },
    { id: 'index', label: 'entity index' },
  ];
  yield {
    state: labelMatrix(
      'Structural change trace',
      traceSteps,
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
    explanation: `This is why adding and removing components in tight loops is expensive. Each structural change touches ${traceSteps.length} phases — ${traceSteps.map(s => s.label).join(', ')} — changing storage groups, not just a flag.`,
  };

  const swapNodes = ['remove', 'swap', 'fix'];
  yield {
    state: moveGraph('Swap-with-last keeps source chunks packed'),
    highlight: { active: [...swapNodes, 'e-remove-swap', 'e-swap-fix'], found: ['dest'], compare: ['copy'] },
    explanation: `Removing a row from the source chunk involves ${swapNodes.length} operations: ${swapNodes.join(', ')}. The last row moves into the hole, and the moved entity's location must be repaired, just like swap-remove in a sparse set.`,
  };

  const storageKinds = [
    { id: 'archetype', label: 'archetype table' },
    { id: 'sparse', label: 'sparse component' },
  ];
  yield {
    state: labelMatrix(
      'Archetype versus sparse-set storage',
      [
        ...storageKinds,
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
    highlight: { active: storageKinds.map(k => k.id + ':best'), compare: ['archetype:watch'], found: ['query:best'] },
    explanation: `Modern ECS engines often support both ${storageKinds[0].label} and ${storageKinds[1].label} storage because each one makes a different workload cheap.`,
  };

  const hotActive = ['add', 'dest', 'fix'];
  const deferredOps = ['copy', 'swap'];
  yield {
    state: moveGraph('Complete case: stage structural changes outside hot simulation loops'),
    highlight: { active: hotActive, compare: deferredOps, found: ['row'] },
    explanation: `A common engine rule is to batch structural changes at command-buffer boundaries. Hot systems stream chunks while ${deferredOps.length} expensive operations (${deferredOps.join(', ')}) are staged so storage moves do not interrupt tight loops.`,
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
        'The animation walks through two views. The first view shows archetype chunks: the world owns archetypes, each archetype owns chunks, and each chunk stores Position, Velocity, and Entity columns aligned by row. A query for Position+Velocity finds matching archetypes and scans their chunks without touching unrelated entities.',
        {type: 'callout', text: 'Archetype ECS makes component composition a storage location, so stable queries become column scans and structural changes become row moves.'},
        'The second view shows a structural change: adding Health to an entity forces it out of the Position+Velocity archetype and into Position+Velocity+Health. Watch the remove, copy, init, and fix steps, then notice swap-with-last filling the hole in the source chunk. Active highlights mark the current operation; found markers show completed state.',
        {type: 'image', src: './assets/gifs/archetype-ecs-column-store.gif', alt: 'Animated walkthrough of the archetype ecs column store visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Game engines and simulations spend most of their time running the same operation over many similar things. A movement system reads Position and Velocity for thousands of entities. A renderer reads Transform and Mesh. The work per entity is trivial, but the data volume is large enough that memory layout determines whether a frame finishes on time.',
        'The problem is that these systems only need a few fields per entity, but the entities themselves can have wildly different component sets. If you store entities as objects, a movement loop touches object headers, vtable pointers, unrelated fields, and null checks before it reaches the two arrays it actually needs. That pointer-chasing pattern destroys cache utilization.',
        'Archetype ECS exists to turn that pointer chase into a flat data scan. It groups entities by exact component signature, packs each component type into a dense column array, and lets systems stream through matching columns in row order. The layout makes the hot path fast by construction.',
        {type: 'image', src: 'https://rams3s.github.io/assets/img/blog/ecs_deep_dive/4.png', alt: 'ECS archetype layout diagram grouping entities by component signature.', caption: 'Archetype storage groups entities by shape so hot systems scan matching rows. (Source: rams3s.github.io)'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The natural first attempt is a sparse-set ECS: one dense array per component type, each mapping entity IDs to component values. Position lives in one array, Velocity in another, Health in a third. Adding or removing a single component is cheap because you only touch that component\'s storage.',
        'This works well for single-component lookups and for games where components are constantly toggled. EnTT, one of the most popular C++ ECS libraries, uses this layout as its primary storage model.',
        'The approach stops scaling at multi-component queries. A movement system needs the intersection of entities that have both Position and Velocity. With sparse sets, you must iterate the smaller set and probe the larger one for each entity. That probe is O(1) amortized, but the indirection and branch prediction misses add up fast when you are doing it millions of times per frame.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall hits when your systems routinely read three, four, or five components together. A renderer might need Transform, Mesh, Material, and Visibility. With sparse-set storage, the system must join four independent arrays, probing membership for every entity. The actual math per entity is cheap, but the join dominates.',
        'Object-oriented layouts hit the opposite wall. They keep an entity conceptually together, but systems rarely want all fields at once. They want two fields from 50,000 entities. The CPU cache loads 64-byte lines whether the system uses those bytes or not, so unrelated fields waste bandwidth on every access.',
        'Both walls come from the same root cause: the storage layout does not match the access pattern. Systems scan by component subset, but sparse sets scatter components and objects bundle too much. The layout you want is one where rows already share the same component set, so a multi-component scan becomes a linear sweep.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Component composition can be encoded by storage location. An entity with Position and Velocity lives in the {Position, Velocity} archetype table. An entity with Position, Velocity, and Health lives in a different table. The archetype is not a tag attached to the entity; it is the table that owns the entity\'s row.',
        'Inside each archetype, data is stored in fixed-capacity chunks. A chunk holds one dense array per component type plus an entity ID array. Row 3 of the Position column, row 3 of the Velocity column, and row 3 of the Entity column all describe the same entity. That per-row alignment is the invariant that eliminates joins.',
        {type: 'image', src: 'https://rams3s.github.io/assets/img/blog/ecs_deep_dive/8.png', alt: 'ECS chunk layout diagram with component columns.', caption: 'Chunk columns make Position, Velocity, and entity ids line up by row. (Source: rams3s.github.io)'},
        'This is the same instinct as columnar databases. Analytical databases store values by column so a scan touches only the fields the query needs. Archetype ECS applies that idea to live simulation entities, with the added twist that rows can move between tables when their component set changes.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The storage hierarchy is world, archetype, chunk, column, row. The world maintains an entity-location index mapping each entity ID to its current archetype, chunk index, and row index. Each archetype holds chunks for exactly one component signature. Each chunk holds fixed-capacity arrays for the components in that signature.',
        'A query for Position+Velocity walks the archetype list and collects every archetype whose signature is a superset of {Position, Velocity}. It caches that list and only invalidates when a new archetype is created. Then it iterates the matched chunks, reading Position and Velocity columns in row order. No per-entity membership check happens inside the loop.',
        {type: 'image', src: 'https://rams3s.github.io/assets/img/blog/ecs_deep_dive/6.png', alt: 'ECS storage diagram showing archetypes and chunks.', caption: 'The world to archetype to chunk hierarchy explains why queries avoid per-entity membership checks. (Source: rams3s.github.io)'},
        'Structural changes are where you pay for this layout. Adding Health to entity e means e no longer belongs in the {Position, Velocity} archetype. The ECS finds or creates the {Position, Velocity, Health} archetype, allocates a row in one of its chunks, copies Position and Velocity from the old row, initializes Health, removes the old row using swap-with-last to keep the source chunk dense, and updates the entity-location index for both e and the swapped entity.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness rests on the row-alignment invariant. Within a chunk, every component column has the same set of occupied rows. If a system reads row i, the Position at row i and the Velocity at row i belong to the same entity. No join is needed because the storage layout has already performed it.',
        'The entity-location index preserves identity across moves. Game code holds a stable entity handle; the index translates that handle to the current archetype, chunk, and row. After every structural change, two index entries must be updated: the moved entity\'s new location and the swapped entity\'s repaired location.',
        'The signature invariant is what makes query caching possible. If an archetype\'s signature does not include Velocity, then zero rows in any of its chunks can satisfy a Position+Velocity query. One metadata check eliminates every row in that archetype. Conversely, if the signature does include both, every occupied row is guaranteed to have them, so the scan runs without per-row branching.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Iteration is O(n) where n is the number of matching entities, with excellent cache behavior because columns are contiguous. Query setup is O(a) where a is the number of archetypes, but that cost is amortized by caching. In a stable simulation with a handful of archetypes and thousands of entities, the per-frame query overhead is negligible.',
        'Structural changes are expensive: O(c) per move where c is the number of component columns to copy, plus a constant for index updates and swap-with-last. If a system adds and removes a tag component every frame on 10,000 entities, the copy and bookkeeping cost can exceed the cost of running every simulation system.',
        'Memory cost is the sum of all component columns across all chunks, plus entity IDs, chunk metadata, and the entity-location index. Archetype explosion is the pathological case: if the game creates hundreds of rare component combinations, you get many nearly-empty chunks and the query cache must track many archetypes. Good design keeps the archetype count small by avoiding one-off component combinations.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Unity DOTS (Entities package) is the most prominent production archetype ECS. Every entity belongs to an archetype, data lives in chunks sized to 16 KB, and the job system schedules work at chunk granularity. Bevy (Rust) uses a similar archetype model with automatic query caching and change detection per archetype.',
        'The pattern fits any simulation where systems scan stable component sets: movement, physics integration, particle updates, animation sampling, visibility culling, AI perception, audio emitter ticking. The common thread is "same few columns, many rows, rare composition changes."',
        'Outside games, the same layout appears in scientific simulations and agent-based models where entities share a fixed schema for long stretches of simulated time. The archetype model trades structural flexibility for scan throughput, which is exactly the tradeoff those workloads want.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'High-churn optional state is the primary failure mode. If a Stunned component is added for one frame and removed the next on thousands of entities, every add and remove triggers a full row move. Sparse-set storage, bitflags, side tables, or event queues handle that pattern better because toggling existence does not require copying data between archetypes.',
        'Relationship-heavy data does not fit the model well. Parent-child transforms, scene graphs, skeletal hierarchies, and dependency graphs need tree traversals, topological sorts, or adjacency lists. ECS can store components that reference those structures, but the archetype layout itself does not accelerate graph traversal.',
        'Over-componentization is a design trap. If every small piece of state becomes its own component type, archetype count explodes, chunks become sparse, and queries get harder to reason about. The rule of thumb: put hot, frequently-scanned data in archetype-table components, and keep rare or high-churn state in sparse storage or side channels.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Start with four entities in the {Position, Velocity} archetype. One chunk holds them all, with three columns: Entity = [e12, e19, e31, e44], Position = [(4,8), (6,7), (9,2), (2,5)], Velocity = [(1,0), (0,1), (-1,0), (0,-1)]. A movement system queries Position+Velocity, finds this archetype, and scans all four rows: for each row, it writes Position[i] += Velocity[i]. After the system runs, Position = [(5,8), (6,8), (8,2), (2,4)].',
        'Now entity e19 gains a Health component. The ECS finds or creates archetype {Position, Velocity, Health}. It allocates row 0 in a chunk of that archetype and copies e19\'s Position (6,8) and Velocity (0,1) into the new row, then initializes Health to its default. Back in the source chunk, e19 was at row 1. The last occupied row is row 3 (entity e44). Swap-with-last moves e44\'s data into row 1 and decrements the chunk count to 3. The entity-location index is updated: e19 now points to {P+V+H, chunk 0, row 0}, and e44 now points to {P+V, chunk 0, row 1}.',
        'After the move, the source chunk holds Entity = [e12, e44, e31], Position = [(5,8), (2,4), (8,2)], Velocity = [(1,0), (0,-1), (-1,0)]. The destination chunk holds Entity = [e19], Position = [(6,8)], Velocity = [(0,1)], Health = [100]. Next frame, the movement system scans both archetypes because both contain Position and Velocity. The scan is still linear within each chunk, no per-entity membership check needed.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary references: Unity Entities archetype documentation (docs.unity3d.com/Packages/com.unity.entities); Bevy ECS archetype module (docs.rs/bevy/latest/bevy/ecs/archetype); rams3s "ECS Deep Dive" blog series which provided the diagrams above.',
        'Study Sparse Set Entity Index for the contrasting per-component storage model. Study Generational Arena Slot Map for the stable entity handle pattern. Study Apache Arrow Columnar Memory for the columnar layout idea applied to analytics. Study Dynamic AABB Tree Broad Phase for a spatial structure that ECS storage does not replace. The broader lesson: pick the layout that matches your dominant access pattern, then name the tax it creates and decide whether you can afford it.',
      ],
    },
  ],
};
