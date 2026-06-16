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
  yield {
    state: arenaGraph('A handle is index plus generation'),
    highlight: { active: ['insert', 'arena', 'slot7', 'value', 'e-insert-arena', 'e-arena-slot', 'e-slot-value'], found: ['handle'] },
    explanation: 'A slot map stores values in an array of slots and returns a small handle. The handle does not point directly to memory. It names a slot index and the generation observed when the value was inserted.',
    invariant: 'A handle is valid only when handle.generation equals slot.generation and the slot is occupied.',
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
    explanation: 'Each slot carries metadata next to the payload: generation, occupancy, and optionally a next-free pointer. Free slots form a linked list without allocating separate node objects.',
  };

  yield {
    state: arenaGraph('Lookup checks the generation before returning the value'),
    highlight: { active: ['handle', 'slot7', 'value', 'e-handle-slot', 'e-slot-value'], removed: ['stale'], compare: ['arena'] },
    explanation: 'A lookup first indexes into the slot array. It returns the payload only if the generation matches and the slot is still occupied. Otherwise the handle is stale and lookup returns missing.',
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
    explanation: 'The common operations are constant time. Iteration can still scan holes unless the implementation keeps a dense live list or a second index.',
  };

  yield {
    state: arenaGraph('Complete case: game objects reference each other by handles'),
    highlight: { active: ['handle', 'arena', 'slot7', 'value'], removed: ['stale'], found: ['free'] },
    explanation: 'Games, editors, compilers, and graph tools often need objects with dynamic lifetimes and cross references. A generational arena gives stable, copyable ids while preventing old ids from silently reaching new occupants of the same slot.',
  };
}

function* freeListAndAba() {
  yield {
    state: arenaGraph('Deleting a value returns its slot to the free list'),
    highlight: { active: ['slot7', 'delete', 'free', 'e-slot-delete', 'e-delete-free'], compare: ['handle'], removed: ['value'] },
    explanation: 'Deletion does not move every later element. It marks the slot free, increments or otherwise changes its generation, and pushes the slot onto a free list for future inserts.',
    invariant: 'Reusing an index must change the generation before old handles can observe the new value.',
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
    explanation: 'The ABA bug is that index 7 can hold A, then nothing, then B. Without a generation, an old reference to A would accidentally read B. The generation makes the second A-like index distinguishable.',
  };

  yield {
    state: arenaGraph('Reuse is fast because the free list is inside the arena'),
    highlight: { active: ['free', 'arena', 'slot7', 'e-arena-slot'], found: ['insert', 'handle'], removed: ['stale'] },
    explanation: 'A new insert can pop the first free slot, write the payload, and return the new generation handle. The container avoids shifting elements, so external handles to other slots remain stable.',
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
    explanation: 'Slot maps are a family, not one exact layout. You tune for handle size, generation wrap risk, deletion rate, iteration speed, and pointer stability.',
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
    explanation: 'The pattern is strongest when the program needs many stable ids, frequent deletion, and explicit validity checks. It is the handle layer underneath many ECS and editor storage designs.',
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
    { heading: 'What it is', paragraphs: [
      'A generational arena, often called a slot map, is an array-backed owner for objects with dynamic lifetimes. Instead of giving callers raw references, it returns handles made from an index and a generation. The index finds the slot. The generation proves that the slot still contains the same logical object.',
      'This solves a common problem with plain arrays of optional values. If slot 7 contains object A, then A is deleted, then object B reuses slot 7, an old index-only reference to A would accidentally reach B. A generation mismatch makes that stale lookup fail.',
    ] },
    { heading: 'How it works', paragraphs: [
      'Each slot stores metadata and maybe a payload. Live slots contain a value and a generation. Free slots can reuse the payload field as a next-free pointer, making the free list live inside the arena. Insert pops a free slot or appends a new one, writes the value, and returns index plus generation. Remove clears the value, advances the generation, and pushes the slot back to the free list.',
      'Lookup is deliberately boring: read slot[handle.index], compare slot.generation to handle.generation, and return the value only if the slot is live. That small check is the data structure.',
    ] },
    { heading: 'Cost and complexity', paragraphs: [
      'Insert, remove, and get are typically O(1). Memory is mostly contiguous, handles are small, and deletion does not shift unrelated values. Iteration cost depends on the variant. A simple slot map scans all slots and skips holes. A dense variant keeps a live list and pays extra updates on deletion.',
      'Generation width is a real engineering decision. If a tiny generation counter wraps while stale handles still exist, stale detection can fail. Production designs choose enough bits, limit reuse, or combine generation with stronger lifetime policy.',
    ] },
    { heading: 'Complete case study', paragraphs: [
      'In a game world, AI targets, physics constraints, scripting callbacks, and UI debug panels may all hold references to entities. Raw object pointers are fragile when objects are destroyed and memory is reused. A generational arena lets each subsystem hold a compact handle. When the target dies, later lookups fail cleanly instead of operating on a different object that inherited the same slot.',
      'In a compiler or graph editor, nodes and edges can be allocated in arenas and cross-linked by handles. Rewriting a node can preserve its id. Deleting a node invalidates old handles without forcing every stored edge to be rewritten immediately.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Sources: generational-arena crate documentation, https://docs.rs/generational-arena/latest/generational_arena/; Catherine West RustConf 2018 ECS keynote referenced by that crate; and Bevy entity/storage documentation for production ECS handle use, https://docs.rs/bevy/latest/bevy/ecs/. Study ABA Tagged Pointer Stack, Sparse Set Entity Index, Archetype ECS Column Store, Slab Allocator & Size Classes, Hash Table, and Zipper Focused Tree next.',
    ] },
  ],
};
