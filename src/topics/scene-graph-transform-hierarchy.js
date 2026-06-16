// Scene graph transform hierarchy: local transforms compose into world space.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'scene-graph-transform-hierarchy',
  title: 'Scene Graph Transform Hierarchy',
  category: 'Data Structures',
  summary: 'Represent a visual world as parent-child nodes, compose local transforms into world transforms, and propagate dirty flags only through affected subtrees.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['transform propagation', 'dirty subtree update'], defaultValue: 'transform propagation' },
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

function sceneGraph(title) {
  return graphState({
    nodes: [
      { id: 'root', label: 'root', x: 4.8, y: 0.3, note: 'world' },
      { id: 'camera', label: 'cam', x: 2.0, y: 3.0, note: 'view' },
      { id: 'player', label: 'player', x: 4.8, y: 3.0 },
      { id: 'ui', label: 'UI', x: 7.6, y: 3.0, note: 'screen' },
      { id: 'weapon', label: 'gun', x: 3.7, y: 5.2, note: 'child' },
      { id: 'hand', label: 'hand', x: 5.9, y: 5.2, note: 'child' },
      { id: 'muzzle', label: 'fx', x: 3.7, y: 7.2, note: 'grandchild' },
      { id: 'bounds', label: 'bounds', x: 7.8, y: 6.2, note: 'cull' },
    ],
    edges: [
      { id: 'e-root-camera', from: 'root', to: 'camera', weight: '' },
      { id: 'e-root-player', from: 'root', to: 'player', weight: '' },
      { id: 'e-root-ui', from: 'root', to: 'ui', weight: '' },
      { id: 'e-player-weapon', from: 'player', to: 'weapon', weight: '' },
      { id: 'e-player-hand', from: 'player', to: 'hand', weight: '' },
      { id: 'e-weapon-muzzle', from: 'weapon', to: 'muzzle', weight: '' },
      { id: 'e-player-bounds', from: 'player', to: 'bounds', weight: '' },
      { id: 'e-ui-bounds', from: 'ui', to: 'bounds', weight: '' },
    ],
  }, { title });
}

function* transformPropagation() {
  yield {
    state: sceneGraph('A scene graph stores local transforms in a tree'),
    highlight: { active: ['root', 'player', 'weapon', 'muzzle', 'e-root-player', 'e-player-weapon', 'e-weapon-muzzle'], found: ['bounds'] },
    explanation: 'A scene graph is a retained tree of visual objects. Each node stores a local transform relative to its parent. A traversal composes parent world transform with child local transform to produce child world transform.',
    invariant: 'world(child) = world(parent) composed with local(child).',
  };

  yield {
    state: labelMatrix(
      'Transform fields',
      [
        { id: 'root', label: 'root' },
        { id: 'player', label: 'player' },
        { id: 'weapon', label: 'weapon' },
        { id: 'muzzle', label: 'muzzle fx' },
      ],
      [
        { id: 'local', label: 'local' },
        { id: 'parent', label: 'parent' },
        { id: 'world', label: 'world' },
      ],
      [
        ['identity', '-', 'identity'],
        ['move 10,2', 'root', '10,2'],
        ['rotate 15', 'player', '10,2 + rot'],
        ['offset 1,0', 'weapon', 'barrel tip'],
      ],
    ),
    highlight: { active: ['player:world', 'weapon:world', 'muzzle:world'], found: ['root:world'] },
    explanation: 'The cached world transform is derived data. It is fast to read during rendering, culling, physics debug drawing, or picking, but it must be invalidated when an ancestor changes.',
  };

  yield {
    state: sceneGraph('Bounds and culling are also derived from the hierarchy'),
    highlight: { active: ['player', 'weapon', 'hand', 'bounds', 'e-player-bounds'], compare: ['camera'], found: ['muzzle'] },
    explanation: 'A parent can aggregate child bounds. Frustum culling can reject an entire subtree when its world-space bounds are outside the camera. That turns tree structure into rendering work avoidance.',
  };

  yield {
    state: labelMatrix(
      'Common node payloads',
      [
        { id: 'transform', label: 'transform' },
        { id: 'mesh', label: 'mesh ref' },
        { id: 'bounds', label: 'bounds' },
        { id: 'flags', label: 'flags' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'why', label: 'why' },
      ],
      [
        ['local + world', 'placement'],
        ['asset handle', 'draw lookup'],
        ['local + world AABB', 'cull/pick'],
        ['visible/dirty/static', 'skip work'],
      ],
    ),
    highlight: { active: ['transform:stores', 'bounds:stores'], found: ['flags:why'] },
    explanation: 'The graph is a relationship structure, not just a render list. Nodes often carry asset handles, bounds, visibility, animation state, and dirty flags around the same parent-child core.',
  };

  yield {
    state: sceneGraph('Complete case: attach weapon effects to a moving player'),
    highlight: { active: ['player', 'weapon', 'muzzle'], found: ['bounds'], compare: ['ui'] },
    explanation: 'A weapon muzzle flash follows the player because it is attached below player and weapon nodes. The application edits a local transform, while the graph composes the final world position for rendering and effects.',
  };
}

function* dirtySubtreeUpdate() {
  yield {
    state: sceneGraph('Changing a parent marks descendants dirty'),
    highlight: { active: ['player', 'weapon', 'hand', 'muzzle', 'e-player-weapon', 'e-player-hand', 'e-weapon-muzzle'], compare: ['camera', 'ui'] },
    explanation: 'If the player moves, the camera and UI do not need new world transforms. The player subtree does. Dirty flags let the engine recalculate only affected descendants.',
    invariant: 'A clean child under a dirty parent cannot trust its cached world transform.',
  };

  yield {
    state: labelMatrix(
      'Dirty propagation',
      [
        { id: 'edit', label: 'edit local' },
        { id: 'mark', label: 'mark dirty' },
        { id: 'walk', label: 'walk subtree' },
        { id: 'clear', label: 'clear clean' },
      ],
      [
        { id: 'action', label: 'action' },
        { id: 'scope', label: 'scope' },
      ],
      [
        ['player local changes', 'one node'],
        ['player descendants', 'subtree'],
        ['recompute world', 'dirty nodes'],
        ['cache valid', 'visited nodes'],
      ],
    ),
    highlight: { active: ['mark:action', 'walk:action'], found: ['clear:action'] },
    explanation: 'Dirty propagation is a data-structure policy: preserve cached derived values, but attach a precise invalidation path so the cache never lies.',
  };

  yield {
    state: sceneGraph('Static subtrees can be frozen or flattened'),
    highlight: { active: ['ui', 'bounds'], found: ['camera'], compare: ['player', 'weapon'] },
    explanation: 'A mostly static UI panel, map tile layer, or environment prop hierarchy can be flattened into a draw list or cached layer. Dynamic subtrees stay hierarchical because edits are expected.',
  };

  yield {
    state: labelMatrix(
      'Representation choices',
      [
        { id: 'pointers', label: 'pointers' },
        { id: 'indices', label: 'indices' },
        { id: 'ecs', label: 'ECS rows' },
        { id: 'flat', label: 'flat list' },
      ],
      [
        { id: 'helps', label: 'helps' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['easy edits', 'pointer chasing'],
        ['arena storage', 'id indirection'],
        ['batch systems', 'parent lookup'],
        ['draw speed', 'hard edits'],
      ],
    ),
    highlight: { active: ['indices:helps', 'ecs:helps'], compare: ['pointers:cost'], found: ['flat:helps'] },
    explanation: 'Scene graph is the abstraction. The storage can be pointer nodes, slot-map indices, ECS components, flat arrays sorted by parent, or a hybrid. The workload decides.',
  };

  yield {
    state: sceneGraph('Complete case: editor selection moves one subtree'),
    highlight: { active: ['player', 'weapon', 'muzzle'], removed: ['camera', 'ui'], found: ['bounds'] },
    explanation: 'A level editor dragging a parent object needs immediate visual feedback for all children, updated bounds for selection, and no wasted recalculation for unrelated branches. Dirty subtree traversal is the core trick.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'transform propagation') yield* transformPropagation();
  else if (view === 'dirty subtree update') yield* dirtySubtreeUpdate();
  else throw new InputError('Pick a scene-graph view.');
}

export const article = {
  sections: [
    { heading: 'What it is', paragraphs: [
      'A scene graph is a parent-child data structure for visual objects. Each node has a local transform relative to its parent, and the renderer or editor derives a world transform by traversing from ancestors to descendants.',
      'The structure appears in game engines, UI frameworks, CAD tools, animation packages, SVG, glTF, and browser rendering internals. It is not always stored as object pointers; production engines often store node ids in arenas, ECS components, or flat arrays while preserving the same parent-child meaning.',
    ] },
    { heading: 'How it works', paragraphs: [
      'The core operation is transform composition. If the player moves, the weapon attached to the player and the muzzle flash attached to the weapon inherit that movement. A tree traversal recomputes world transforms in parent-before-child order.',
      'Engines cache derived data such as world transforms and world bounds because rendering, culling, picking, and physics debug views read them often. Dirty flags mark the affected subtree when local transforms change.',
    ] },
    { heading: 'Cost and complexity', paragraphs: [
      'A full update is O(n) for n nodes. Dirty-subtree update is O(k) for k affected descendants. The catch is invalidation correctness: any child whose ancestor changed cannot trust its cached world transform, even if the child local transform is unchanged.',
      'Pointer-heavy scene graphs are easy to edit but can be cache-poor. Flat arrays and ECS storage scan better but make parent-child updates and reparenting more explicit. Many engines use both: an authoring graph, a runtime transform hierarchy, and a flattened render list.',
    ] },
    { heading: 'Complete case study', paragraphs: [
      'A game character has a root node, skeleton bones, a weapon attachment, and effects under the weapon. The player movement system edits the character local transform. The transform update marks the subtree dirty, recomputes world transforms for the descendants, updates aggregate bounds, and feeds the renderer and broad phase.',
      'A level editor uses the same structure. Dragging a parent prop updates child props, selection bounds, snapping guides, and viewport redraw regions. The graph supplies identity and relationship; damage tracking and render graphs decide what pixels and GPU passes must update.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Sources: glTF 2.0 node hierarchy and transform specification, https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html; Unity Transform component manual, https://docs.unity3d.com/Manual/class-Transform.html; and Godot scene tree documentation, https://docs.godotengine.org/en/stable/tutorials/scripting/scene_tree.html. Study Depth Buffer Z-Test, Deferred G-Buffer, Dirty Rectangle Damage Tracking, Render Graph Framegraph Resource Lifetimes, Tree Traversals, Generational Arena Slot Map, Archetype ECS Column Store, and Dynamic AABB Tree Broad Phase next.',
    ] },
  ],
};
