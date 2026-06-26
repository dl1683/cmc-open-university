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
        'The visualization offers two views. "Handle lifecycle" shows how an arena stores a value, issues a handle, and validates lookups against the slot\'s generation counter. "Free list and ABA" shows what happens when a slot is freed, reused by a new value, and an old handle tries to reach the old occupant.',
        'Each frame highlights the active nodes and edges in the graph or matrix. Green marks the path the current operation follows; red marks rejected or stale elements. Step through slowly the first time to watch how the generation counter changes on deletion and how the free list threads through empty slots.',
        {type: 'image', src: './assets/gifs/generational-arena-slot-map.gif', alt: 'Animated walkthrough of the generational arena slot map visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Programs that manage many objects with dynamic lifetimes need a way to name those objects. Games track thousands of entities that spawn and die every frame. Compilers build intermediate representations whose nodes are created and deleted during optimization passes. Graph editors let users add and remove vertices while edges still reference them. All of these need stable identifiers that survive deletion and reuse of storage.',
        'A generational arena (also called a slot map) solves this by storing objects in a flat array of reusable slots and returning compact handles instead of raw pointers or plain indices. Each handle pairs a slot index with a generation counter. The index says where to look; the generation says which occupant the caller expects to find there.',
        {type: 'callout', text: 'A generational handle separates location from identity: the index finds a slot, and the generation proves the current occupant is the one the handle meant.'},
        'The core problem is identity over time. When an object is deleted and its storage is reused, old references must not silently reach the new occupant. The generation counter makes reuse visible.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Store objects in an array and hand out integer indices. Object A goes into slot 7, so the caller remembers 7 and later reads array[7]. Insertion is O(1) by appending. Lookup is O(1) by indexing. This works well until objects are deleted.',
        'If deletion shifts the array to fill the gap, every index above the deleted position becomes wrong. If deletion leaves a hole (sets slot 7 to null), the index still works but the program must track which slots are empty so it can reuse them. Neither option addresses the deeper issue: the index 7 is now ambiguous.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The ambiguity is called the ABA problem. Slot 7 holds object A, then A is deleted, then object B is inserted into the same slot. An old reference that remembers index 7 now silently reaches B instead of A. The index did not change, but the identity behind it did. In a game, this means an AI targeting a dead enemy starts attacking a door that happened to reuse the same slot.',
        'Raw pointers and borrowed references avoid the index ambiguity but create a different wall. They tie the caller to a memory lifetime the program may not be able to express across undo histories, serialized save files, scripting language boundaries, or dynamic entity graphs. Handles are plain data: they can be copied, serialized, compared, and stored anywhere without lifetime entanglement.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Attach a version number to each slot. Every time a slot is freed, increment its version (called the generation). The handle records both the index and the generation observed at insertion time. On lookup, compare the handle\'s generation to the slot\'s current generation. If they differ, the handle is stale and the lookup is rejected.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/a/a1/Linked_list.svg', alt: 'Singly linked list with nodes connected by pointers', caption: 'Free slots often form an internal linked list: the arena reuses empty storage without allocating a separate node for every hole. Source: Wikimedia Commons, Lasindi, public domain.'},
        'The invariant fits one sentence: a handle is valid only when the index is in range, the slot is occupied, and the slot\'s generation equals the handle\'s generation. Every operation in the data structure exists to preserve this invariant.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Each slot stores three fields: a generation counter, an occupancy flag (live or free), and either a payload or a next-free pointer. Free slots reuse their payload field to store the index of the next free slot, forming an intrusive linked list inside the array. This avoids allocating separate list nodes for free-slot tracking.',
        'Insert pops the head of the free list. If the free list is empty, it appends a new slot to the array. It writes the payload into the slot, marks it live, and returns a handle containing the slot index and the slot\'s current generation. The generation is not incremented on insert; it was already incremented when the slot was freed.',
        'Remove validates the handle first. If the handle\'s generation matches the slot\'s generation and the slot is occupied, the arena clears the payload, increments the slot\'s generation, marks the slot free, and pushes the slot index onto the free list. A second remove with the same handle fails because the generation no longer matches.',
        'Lookup reads slots[handle.index], checks that the slot is occupied, and compares generations. On a match it returns the payload. On a mismatch it returns nothing. That single integer comparison is the entire stale-reference defense.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The generation counter partitions the timeline of a slot into epochs. Handle 7:g2 names the second epoch of slot 7. When that epoch ends (the object is deleted), the slot advances to generation 3. Any handle still carrying generation 2 will fail the equality check against generation 3, so it cannot reach the next occupant.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/3/3d/Process_states.svg', alt: 'Process state transition diagram', caption: 'Generation checks turn slot reuse into a state transition: live, freed, then live again with a new version. Source: Wikimedia Commons, state transition diagram.'},
        'This is the same defense used in ABA-resistant concurrent data structures with tagged pointers. The tag (generation) makes it possible to distinguish "same address, different lifetime" from "same address, same lifetime." The principle is general: whenever storage can be recycled, attach a monotonically increasing version so that stale observers can detect the change.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Insert is O(1): pop the free list head (or append) and write the payload. Remove is O(1): validate, clear, bump generation, push onto free list. Lookup is O(1): one array index, one comparison, one conditional return. Memory is contiguous, so cache behavior is good for random access patterns.',
        'Iteration is where variants diverge. A simple arena scans every slot and skips freed ones, making iteration O(capacity) rather than O(live count). If 10,000 slots exist but only 200 are live, iteration wastes time on 9,800 holes. A dense slot map adds a secondary compact array of live indices so iteration is O(live count), at the cost of extra bookkeeping on insert and remove.',
        'Handle size depends on how many bits are allocated to the index and the generation. A 32-bit handle might pack 20 bits of index (1M slots) and 12 bits of generation (4,096 reuses before wrap). A 64-bit handle can afford 32 bits for each, giving billions of slots and billions of reuses. The generation width determines how many times a single slot can be recycled before the counter wraps and old handles become falsely valid again.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Entity-component-system (ECS) frameworks use generational arenas as their entity storage. Bevy (Rust game engine) stores entities in a generational arena and exposes entity ids that are index-generation pairs. The slotmap and generational-arena Rust crates provide ready-made implementations used across the ecosystem.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with arrows between nodes', caption: 'Graphs and scene structures need stable cross references even as nodes are deleted and reused. Source: Wikimedia Commons, David W., public domain.'},
        'Compiler intermediate representations use slot maps for instruction and basic-block identifiers. Graph editors use them so that edge endpoints remain valid even after vertex deletion. UI frameworks use them for widget trees where nodes are frequently created and destroyed. In all cases the pattern is the same: many objects with dynamic lifetimes, cross-references between them, and a need for cheap validity checks.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Generation wrap is the fundamental weakness. If a slot is freed and reused 2^N times (where N is the generation bit width), the counter wraps to its original value and a stale handle becomes falsely valid. With a 12-bit generation, this happens after 4,096 reuses of a single slot. Long-running systems with high churn on a small number of slots are at risk.',
        'Dense iteration requires extra machinery. A bare arena with many holes forces O(capacity) scans. If the workload is dominated by iterating all live objects (as in game physics), the arena alone is not enough; it must be paired with a dense live list or a sparse set.',
        'The handle validates the slot, not the semantic relationship. An arena cannot enforce that deleting entity A should also clean up every edge pointing to A. Referential integrity across a graph requires additional bookkeeping on top of the arena. The handle is a revocable capability for one slot, not a garbage collector.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Start with an arena of 10 slots, all free, all at generation 0. The free list chains them: head -> 0 -> 1 -> 2 -> ... -> 9 -> end.',
        'Insert enemy#41. Pop slot 0 from the free list. Write enemy#41 as the payload, mark slot 0 live. Slot 0\'s generation is still 0. Return handle {index: 0, gen: 0}. The AI system stores this handle as its target.',
        'Insert door#12. Pop slot 1. Write door#12, mark live. Return handle {index: 1, gen: 0}.',
        'The enemy dies. Remove is called with handle {index: 0, gen: 0}. Check: slot 0 is live and its generation (0) matches the handle\'s generation (0). Valid. Clear the payload, increment slot 0\'s generation to 1, mark it free, push slot 0 onto the free list head. Free list is now: head -> 0 -> 2 -> 3 -> ... -> 9 -> end.',
        'Insert crate#7. Pop slot 0 from the free list. Write crate#7, mark live. Slot 0\'s generation is now 1. Return handle {index: 0, gen: 1}.',
        'The AI system tries to read its stored target using the old handle {index: 0, gen: 0}. Slot 0 is live, but its generation is 1, not 0. The comparison fails. Lookup returns nothing. The AI detects that its target no longer exists instead of accidentally targeting crate#7. Total cost of that safety check: one integer comparison.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'The generational-arena crate (https://docs.rs/generational-arena/latest/generational_arena/) and slotmap crate (https://docs.rs/slotmap/latest/slotmap/) document the two main Rust implementations with different design tradeoffs. Bevy\'s entity system (https://docs.rs/bevy/latest/bevy/ecs/entity/index.html) shows how generational indices work inside a production game engine. Catherine West\'s RustConf 2018 closing keynote, "Using Rust for Game Development," walks through why generational arenas replaced reference-counted pointers in game entity storage.',
        'Study next: ABA Tagged Pointer Stack for the version-tag pattern under concurrency. Sparse Set Entity Index for dense iteration with O(1) membership testing. Archetype ECS Column Store for how ECS frameworks group components by type. Slab Allocator and Size Classes for slot reuse without generation counters. Hash Table for comparison: O(1) lookup by key but no contiguous storage or handle compactness.',
      ],
    },
  ],
};
