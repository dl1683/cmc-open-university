// Generational arena / slot map: stable handles with stale-reference defense.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'generational-arena-slot-map',
  title: 'Generational Arena Slot Map',
  category: 'Data Structures',
  summary: 'Store objects in reusable slots, return index+generation handles, and reject stale references when a freed slot is reused.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['handle lifecycle', 'free list and ABA'], defaultValue: 'handle lifecycle' },
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

function arenaGraph(title) {
  return graphState({
    nodes: [
      { id: 'insert', label: 'insert', x: 0.9, y: 2.0, note: 'value' },
      { id: 'handle', label: '7:g3', x: 0.9, y: 5.0, note: 'handle' },
      { id: 'arena', label: 'arena', x: 3.0, y: 3.5, note: 'slots' },
      { id: 'slot7', label: 'slot 7', x: 5.0, y: 2.0, note: 'gen 3' },
      { id: 'value', label: 'value', x: 7.1, y: 2.0, note: 'object' },
      { id: 'delete', label: 'remove', x: 5.0, y: 5.1, note: 'free' },
      { id: 'free', label: 'free list', x: 7.1, y: 5.1, note: '7 -> 2' },
      { id: 'stale', label: '7:g2', x: 9.0, y: 3.5, note: 'stale' },
    ],
    edges: [
      { id: 'e-insert-arena', from: 'insert', to: 'arena', weight: '' },
      { id: 'e-arena-slot', from: 'arena', to: 'slot7', weight: '' },
      { id: 'e-slot-value', from: 'slot7', to: 'value', weight: '' },
      { id: 'e-arena-handle', from: 'arena', to: 'handle', weight: '' },
      { id: 'e-handle-slot', from: 'handle', to: 'slot7', weight: '' },
      { id: 'e-slot-delete', from: 'slot7', to: 'delete', weight: '' },
      { id: 'e-delete-free', from: 'delete', to: 'free', weight: '' },
      { id: 'e-stale-slot', from: 'stale', to: 'slot7', weight: '' },
    ],
  }, { title });
}

function* handleLifecycle() {
  const exampleIndex = 7;
  const exampleGen = 3;
  const slotCount = 4;
  const operations = ['insert', 'get', 'remove', 'iterate'];

  yield {
    state: arenaGraph('A handle is index plus generation'),
    highlight: { active: ['insert', 'arena', 'slot7', 'value', 'e-insert-arena', 'e-arena-slot', 'e-slot-value'], found: ['handle'] },
    explanation: `A slot map stores values in an array of slots and returns a small handle. The handle does not point directly to memory. It names slot index ${exampleIndex} and generation ${exampleGen} observed when the value was inserted.`,
    invariant: `A handle like ${exampleIndex}:g${exampleGen} is valid only when handle.generation equals slot.generation and the slot is occupied.`,
  };

  yield {
    state: labelMatrix(
      'Slot table',
      [
        { id: 'slot2', label: 'slot 2' },
        { id: 'slot7', label: 'slot 7' },
        { id: 'slot8', label: 'slot 8' },
        { id: 'slot9', label: 'slot 9' },
      ],
      [
        { id: 'gen', label: 'generation' },
        { id: 'state', label: 'state' },
        { id: 'payload', label: 'payload/next' },
      ],
      [
        ['5', 'free', 'next 9'],
        ['3', 'live', 'enemy#41'],
        ['1', 'live', 'door#12'],
        ['8', 'free', 'end'],
      ],
    ),
    highlight: { active: ['slot7:gen', 'slot7:state', 'slot7:payload'], found: ['slot2:payload', 'slot9:payload'] },
    explanation: `Each of the ${slotCount} slots carries metadata next to the payload: generation, occupancy, and optionally a next-free pointer. Free slots form a linked list without allocating separate node objects.`,
  };

  yield {
    state: arenaGraph('Lookup checks the generation before returning the value'),
    highlight: { active: ['handle', 'slot7', 'value', 'e-handle-slot', 'e-slot-value'], removed: ['stale'], compare: ['arena'] },
    explanation: `A lookup first indexes into the slot array at position ${exampleIndex}. It returns the payload only if generation ${exampleGen} matches and the slot is still occupied. Otherwise the handle is stale and lookup returns missing.`,
  };

  yield {
    state: labelMatrix(
      'Operations',
      [
        { id: 'insert', label: 'insert' },
        { id: 'get', label: 'get' },
        { id: 'remove', label: 'remove' },
        { id: 'iterate', label: 'iterate' },
      ],
      [
        { id: 'work', label: 'work' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['pop free slot', 'generation overflow'],
        ['index + gen check', 'stale handle'],
        ['bump gen + link free', 'double remove'],
        ['scan occupied slots', 'holes'],
      ],
    ),
    highlight: { active: ['insert:work', 'get:work', 'remove:work'], compare: ['iterate:risk'], found: ['get:risk'] },
    explanation: `All ${operations.length} operations — ${operations.join(', ')} — are constant time except iteration, which can still scan holes unless the implementation keeps a dense live list or a second index.`,
  };

  yield {
    state: arenaGraph('Complete case: game objects reference each other by handles'),
    highlight: { active: ['handle', 'arena', 'slot7', 'value'], removed: ['stale'], found: ['free'] },
    explanation: `Games, editors, compilers, and graph tools often need objects with dynamic lifetimes and cross references. A generational arena gives stable, copyable ids like ${exampleIndex}:g${exampleGen} while preventing old ids from silently reaching new occupants of the same slot.`,
  };
}

function* freeListAndAba() {
  const abaIndex = 7;
  const oldGen = 2;
  const newGen = 3;
  const designChoices = ['dense live list', 'slot scan', 'wide generation', 'packed handle'];
  const useCases = ['ECS entities', 'graphs', 'compiler IR', 'UI nodes'];

  yield {
    state: arenaGraph('Deleting a value returns its slot to the free list'),
    highlight: { active: ['slot7', 'delete', 'free', 'e-slot-delete', 'e-delete-free'], compare: ['handle'], removed: ['value'] },
    explanation: `Deletion does not move every later element. It marks slot ${abaIndex} free, increments its generation from ${oldGen} to ${newGen}, and pushes the slot onto a free list for future inserts.`,
    invariant: `Reusing index ${abaIndex} must change the generation before old handles carrying generation ${oldGen} can observe the new value.`,
  };

  yield {
    state: labelMatrix(
      'ABA sequence',
      [
        { id: 'a', label: 'A' },
        { id: 'delete', label: 'delete' },
        { id: 'b', label: 'B' },
        { id: 'old', label: 'old handle' },
      ],
      [
        { id: 'index', label: 'index' },
        { id: 'generation', label: 'generation' },
        { id: 'result', label: 'result' },
      ],
      [
        ['7', '2', 'handle 7:g2'],
        ['7', '3', 'slot freed'],
        ['7', '3', 'handle 7:g3'],
        ['7', '2', 'reject'],
      ],
    ),
    highlight: { active: ['old:result', 'delete:generation', 'b:generation'], found: ['a:result'] },
    explanation: `The ABA bug is that index ${abaIndex} can hold A, then nothing, then B. Without a generation, an old reference at g${oldGen} to A would accidentally read B at g${newGen}. The generation makes the second A-like index distinguishable.`,
  };

  yield {
    state: arenaGraph('Reuse is fast because the free list is inside the arena'),
    highlight: { active: ['free', 'arena', 'slot7', 'e-arena-slot'], found: ['insert', 'handle'], removed: ['stale'] },
    explanation: `A new insert can pop the first free slot at index ${abaIndex}, write the payload, and return a handle with generation ${newGen}. The container avoids shifting elements, so external handles to other slots remain stable.`,
  };

  yield {
    state: labelMatrix(
      'Design choices',
      [
        { id: 'dense', label: 'dense live list' },
        { id: 'holes', label: 'slot scan' },
        { id: 'wide', label: 'wide generation' },
        { id: 'packed', label: 'packed handle' },
      ],
      [
        { id: 'helps', label: 'helps' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['fast iteration', 'extra index updates'],
        ['simple storage', 'skip holes'],
        ['wrap safety', 'larger handle'],
        ['cache/key size', 'bit limits'],
      ],
    ),
    highlight: { active: ['dense:helps', 'packed:helps'], compare: ['holes:cost'], found: ['wide:cost'] },
    explanation: `Slot maps are a family, not one exact layout. These ${designChoices.length} design choices — ${designChoices.join(', ')} — tune for handle size, generation wrap risk, deletion rate, iteration speed, and pointer stability.`,
  };

  yield {
    state: labelMatrix(
      'Where it fits',
      [
        { id: 'ecs', label: 'ECS entities' },
        { id: 'graphs', label: 'graphs' },
        { id: 'compiler', label: 'compiler IR' },
        { id: 'ui', label: 'UI nodes' },
      ],
      [
        { id: 'why', label: 'why' },
        { id: 'neighbor', label: 'study next' },
      ],
      [
        ['stable ids', 'sparse set'],
        ['delete nodes', 'arena + edges'],
        ['compact ids', 'union-find'],
        ['dynamic tree', 'zipper'],
      ],
    ),
    highlight: { active: ['ecs:why', 'graphs:why'], found: ['ecs:neighbor', 'ui:neighbor'] },
    explanation: `The pattern is strongest across ${useCases.length} domains — ${useCases.join(', ')} — where the program needs many stable ids, frequent deletion, and explicit validity checks. It is the handle layer underneath many ECS and editor storage designs.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'handle lifecycle') yield* handleLifecycle();
  else if (view === 'free list and ABA') yield* freeListAndAba();
  else throw new InputError('Pick a generational-arena view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Follow the visualization step by step. Each frame shows one operation with the current state highlighted. Use the slider or play button to control playback.',
        {type: 'image', src: './assets/gifs/generational-arena-slot-map.gif', alt: 'Animated walkthrough of the generational arena slot map visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A generational arena, also called a slot map, owns objects in an array of reusable slots and gives callers compact handles instead of raw references. A handle contains a slot index and a generation. The index finds a storage position. The generation proves that the position still contains the logical object the handle originally named.',
        'The structure exists for programs with dynamic lifetimes and cross references: games, editors, graph algorithms, compiler IRs, simulations, UI trees, and ECS storage. These programs need stable ids, cheap deletion, and a way to reject old references after storage is reused.',
        {type: 'callout', text: 'A generational handle separates location from identity: the index finds a slot, and the generation proves the current occupant is the one the handle meant.'},
        'The problem is not just memory allocation. It is identity over time. Programs want to delete an object and reuse its storage without letting old ids accidentally reach the next object placed in that slot.',
      ],
    },
    {
      heading: 'The obvious approach and the wall',
      paragraphs: [
        'The obvious approach is a plain array plus integer ids. Store object A at index 7, hand out 7, and use array[7] later. This is fast until deletion arrives. If removal shifts the array, every later id changes. If removal leaves holes, the program now has to manage reuse.',
        'A Vec<Option<T>> or array of nullable slots fixes shifting but creates the ABA bug. Slot 7 can hold A, then be empty, then hold B. An old index-only reference to A still says 7, so it can accidentally read B. The index did not change, but the identity did.',
        'Raw pointers and borrowed references have a different wall. They bind callers to a lifetime the program may not be able to express across undo logs, graph edges, serialized scenes, scripting callbacks, or dynamic entity deletion. A handle is explicit data. It can be stored, copied, serialized, compared, and rejected.',
      ],
    },
    {
      heading: 'Core insight and invariant',
      paragraphs: [
        'Reuse must change the name. A slot index tells you where to look; a generation tells you which occupant you expected to find there. Handle 7:g2 and handle 7:g3 name the same storage position but different lifetimes.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/a/a1/Linked_list.svg', alt: 'Singly linked list with nodes connected by pointers', caption: 'Free slots often form an internal linked list: the arena reuses empty storage without allocating a separate node for every hole. Source: Wikimedia Commons, Lasindi, public domain.'},
        'The invariant is small enough to audit: a handle is valid only when the index is in range, the slot is occupied, and the slot generation equals the handle generation. Insert, remove, free-list linking, and generation-wrap policy all exist to preserve that sentence.',
      ],
    },
    {
      heading: 'Animation and readouts',
      paragraphs: [
        'In the handle-lifecycle view, the graph separates the handle from the payload on purpose. The handle node points to slot 7, but it does not own the value and it is not a memory address. The lookup succeeds only because slot 7 is live and its generation matches the handle.',
        'The slot-table frame shows the hidden storage layout. Live rows store payloads. Free rows reuse their payload field as a next-free pointer, so the arena does not allocate a separate linked-list node for every hole. The highlighted generation cell is the stale-reference guard.',
        'In the ABA view, watch the old handle stay visually unchanged while the slot changes generation. That generation bump is the stale-reference defense. Reusing index 7 is safe only because the old 7:g2 handle is no longer accepted after slot 7 moves to generation 3.',
        'The readout does not prove a full production design by itself. It does not show generation wrap, concurrent mutation, serialization policy, or dense-iteration side indexes. Those choices decide whether the same invariant remains strong under long runtimes and larger systems.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Each slot stores a generation, an occupancy bit or enum, and either a payload or a next-free pointer. Insert pops the head of the free list when one exists, writes the payload, marks the slot live, and returns a handle containing the slot index and current generation. If no free slot exists, insert appends a new slot.',
        'Remove checks the handle first. If it is valid, the arena clears the payload, advances the slot generation, marks the slot free, and links the slot into the free list. A double remove should fail because the slot is no longer occupied or the generation no longer matches.',
        'Lookup is deliberately boring: read slots[handle.index], check occupied, compare generations, and return the payload only on a match. That one comparison turns a raw location into a revocable authority.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The generation is a version number for the lifetime of the slot occupant. Any handle created before removal carries the old version. Any value inserted after removal gets a newer version. Because lookup requires equality, an old handle cannot silently reach the new value.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/3/3d/Process_states.svg', alt: 'Process state transition diagram', caption: 'Generation checks turn slot reuse into a state transition: live, freed, then live again with a new version. Source: Wikimedia Commons, state transition diagram.'},
        'This is the same defense shape as tagged pointers in ABA-resistant concurrent structures: location alone is not enough when storage can leave and return to the same address or index. Add a tag, advance the tag on reuse, and stale observations become detectable.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A game creates enemy#41 in slot 7 and returns handle 7:g3. The AI system stores that handle as its target. The enemy dies. Remove validates 7:g3, clears the payload, advances slot 7 to generation 4, and pushes slot 7 onto the free list.',
        'A door object is inserted later and reuses slot 7. It receives handle 7:g4. The AI still holding 7:g3 tries to read its target. The index lands on slot 7, but the generation check fails, so the lookup returns missing instead of attacking the door.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'Insert, remove, and get are O(1) in the usual design. Memory is mostly contiguous, handles are small, and deletion does not move unrelated values. The free list keeps reuse cheap because a free slot already contains the pointer to the next free slot.',
        'Iteration depends on the variant. A simple arena scans every slot and skips holes, so iteration is O(capacity). A dense slot map keeps a compact live list and pays extra bookkeeping so iteration is O(live count). Pick based on whether your workload does more random handle lookup or more full scans.',
        'Generation width is not cosmetic. If a small generation counter wraps while stale handles still exist, stale detection can fail. Production designs use enough bits, delay reuse, avoid exposing handles across unbounded lifetimes, or combine the handle with a stronger external identity when serialization requires it.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Generational arenas win when objects need stable ids, frequent deletion, compact ownership, and cheap validity checks. They fit ECS entities, compiler IR nodes, UI widgets, scene graph nodes, graph vertices, simulation objects, and editor resources.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with arrows between nodes', caption: 'Graphs and scene structures need stable cross references even as nodes are deleted and reused. Source: Wikimedia Commons, David W., public domain.'},
        'They are often simpler than reference counting for cyclic graphs and safer than naked indices for reusable storage. They also make debugging easier because a failed lookup is explicit: the handle is stale, out of range, or points at a freed slot.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A slot map is not a universal ownership model. It does not by itself solve concurrent mutation, stable iteration order, referential integrity across durable databases, or memory compaction with borrowed references into payloads. The handle validates the slot; it does not validate every semantic relationship around the object.',
        'It can also waste scan time when many slots are holes. If most work is dense iteration over live objects, pair the arena with a dense live list, a sparse set, or an archetype store. If ids must be public and permanent, use a domain id and treat the arena handle as an internal cache key.',
      ],
    },
    {
      heading: 'Practical guidance',
      paragraphs: [
        'Use handles as capabilities, not as array indexes exposed for casual arithmetic. Keep handle construction inside the arena, validate handles on every public get or remove, and make failed lookup a normal result instead of an exception path.',
        'Pick generation width from the lifetime of stale handles, not from the current demo size. If handles can be serialized, stored in undo logs, or held by scripts for a long time, a tiny generation counter is a bug waiting for wraparound. If iteration is the main workload, add a dense live list early instead of discovering later that every frame scans a mostly empty capacity.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary references: generational-arena crate docs at https://docs.rs/generational-arena/latest/generational_arena/, slotmap crate docs at https://docs.rs/slotmap/latest/slotmap/, and Bevy ECS entity docs at https://docs.rs/bevy/latest/bevy/ecs/entity/index.html. These sources describe generational indices, persistent unique keys, and entity ids used in production ECS-style storage.',
        'Study ABA Tagged Pointer Stack for the version-tag pattern under concurrency, Sparse Set Entity Index for dense iteration plus membership, Archetype ECS Column Store for stable component bundles, Slab Allocator and Size Classes for slot reuse without generations, and Hash Table for a contrasting id-to-object map.',
      ],
    },
  ],
};
