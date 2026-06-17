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
    {
      heading: 'Why This Exists',
      paragraphs: [
        'Scene graphs exist because visual objects are rarely independent. A hand follows an arm, a weapon follows a character, a muzzle flash follows the weapon, a UI badge follows its parent panel, and a camera rig follows a target. The system needs a way to express those relationships directly instead of rewriting positions everywhere.',
        'The main idea is to store local transforms in a hierarchy. A child is placed relative to its parent. The runtime composes those local transforms into world transforms when it needs to render, cull, pick, simulate, or show editor handles. Relationship is stored once, and derived world-space data is produced from it.',
        'This is both a data-structure topic and a graphics topic. The tree gives ownership, traversal order, invalidation scope, and editing semantics. The transforms give the math that moves points from local space to parent space to world space.',
      ],
    },
    {
      heading: 'Why World Coordinates Fail',
      paragraphs: [
        'The obvious approach is to store every object directly in world coordinates. That works for independent objects. It even feels simpler because rendering can read a single transform for each object without walking a parent chain.',
        'The approach fails when attachment and grouping matter. If the player moves, the weapon, hand marker, muzzle flash, nameplate, and selection bounds must move consistently. Without hierarchy, each system has to remember which objects follow which other objects. Bugs become stale positions, double-applied offsets, drifting effects, or bounds that no longer cover the visible object.',
        'World-only storage also makes authoring awkward. Artists and editors usually want to say "this object is one meter in front of that object" or "this icon is anchored to this panel." A local transform expresses that intent. A world transform is only the result after the parent chain is evaluated.',
      ],
    },
    {
      heading: 'Core Mechanism',
      paragraphs: [
        'Each node stores a parent reference, zero or more children, and a local transform. The local transform may be represented as translation, rotation, and scale; as a matrix; or as engine-specific components such as quaternion plus vector. The cached world transform is derived data.',
        'The invariant is world(child) = world(parent) composed with local(child). The root usually has an identity or explicit world transform. A parent-before-child traversal computes each node world transform after its parent world transform is current. Rendering and picking can then read the cached world values quickly.',
        'Composition order matters. Matrix conventions differ across engines, and non-uniform scale combined with rotation can produce shear-like effects. A scene graph article is not complete without saying this plainly: the structure is simple, but transform math must follow one consistent convention everywhere.',
      ],
    },
    {
      heading: 'Derived Data',
      paragraphs: [
        'World transforms are not the only derived values. A node may also cache world-space bounds, aggregate subtree bounds, visibility state, render-layer membership, picking identifiers, physics debug transforms, or editor gizmo positions. These values are fast to read but must be invalidated when the source hierarchy changes.',
        'Bounds show why the hierarchy is useful beyond placement. A parent can aggregate child bounds into one world-space box or sphere. If that aggregate bound is outside the camera frustum, a renderer can reject an entire subtree before visiting each child mesh. The same idea helps editor selection and broad-phase collision systems.',
        'The scene graph is therefore not just a render list. It is a relationship structure that feeds render lists, culling, picking, animation, UI layout, and tools. Production engines often flatten the final draw work, but the hierarchy remains valuable for editing and transform propagation.',
      ],
    },
    {
      heading: 'Dirty Subtree Updates',
      paragraphs: [
        'Recomputing every world transform every frame is correct but wasteful when only a few objects move. Dirty flags turn transform propagation into a cache-invalidation problem. When a node local transform changes, that node and its descendants can no longer trust their cached world transforms. Unrelated branches remain clean.',
        'The update step walks only dirty subtrees, recomputes world transforms from valid parent data, updates derived bounds, and clears the dirty flags. If a parent is dirty, a child must be treated as dirty even if the child local transform did not change. A clean child under a dirty parent is using stale input.',
        'This changes the cost model. A full update is O(n) for n nodes. A dirty subtree update is O(k) for k affected descendants, plus any cost to update aggregate bounds or flattened render data. The improvement is large when scenes are mostly static and edits are localized.',
      ],
    },
    {
      heading: 'Why It Works',
      paragraphs: [
        'Correctness comes from traversal order. If the root is valid and every child is visited after its parent, then each child world transform is computed from valid inputs. The proof follows the tree: root is current, children of root become current, grandchildren become current, and so on.',
        'Dirty propagation is the proof that cached data is safe. A local edit marks the node. An ancestor edit marks descendants. Reparenting marks the moved subtree and often requires a choice: preserve local transform and change world placement, or preserve world transform and recompute local transform relative to the new parent.',
        'The tree also gives natural scope. Moving a player affects the player subtree, not the camera or unrelated UI. Hiding a parent can hide children. Rejecting a parent bound can skip child bounds. Selecting a group can operate on a branch. The structure turns relationship into an efficient traversal boundary.',
      ],
    },
    {
      heading: 'Worked Example',
      paragraphs: [
        'Consider a character node at world position (10, 2). A weapon node is a child with local rotation 15 degrees and local offset from the hand. A muzzle-flash node is a child of the weapon with local offset at the barrel tip. The application edits the character movement and weapon recoil locally.',
        'During update, the character world transform is computed from the root. The weapon world transform is character world composed with weapon local. The muzzle world transform is weapon world composed with muzzle local. The effect appears at the barrel because the graph composes the parent chain every time the source transforms change.',
        'Now the editor drags the character three meters right. The character subtree becomes dirty. Weapon, hand marker, muzzle flash, and character bounds update. The camera and UI panel do not update unless they are attached to that same branch. The user sees immediate consistent motion without every tool owning separate follow logic.',
      ],
    },
    {
      heading: 'Representation Choices',
      paragraphs: [
        'The abstraction is a hierarchy, but storage can vary. Pointer nodes are easy to edit and common in simple engines. Arena or slot-map indices avoid dangling pointers and make serialization easier. Flat arrays sorted so parents appear before children are cache-friendly. ECS designs may store parent, local transform, world transform, and dirty flags as components.',
        'No representation wins everywhere. Pointer graphs are flexible but can chase memory. Flat arrays scan well but make insertion and reparenting more deliberate. ECS rows batch systems well but need parent lookup and careful ordering. Many engines keep an authoring tree, a runtime transform hierarchy, and a separate flattened render list.',
        'The choice should follow the workload. A level editor values reparenting, selection, undo, and serialization. A renderer values dense arrays and stable draw batches. A UI system values layout invalidation and clipping. A skeletal animation system may use a specialized bone hierarchy rather than a general scene graph node for every bone.',
      ],
    },
    {
      heading: 'Operational Guidance',
      paragraphs: [
        'Prevent cycles. A scene graph transform hierarchy must be a tree or a directed acyclic structure with clear ownership rules. If a node becomes its own ancestor, parent-before-child traversal no longer makes sense. Reparent operations should validate the new parent and update dirty state immediately.',
        'Define transform conventions once. Choose row-major or column-major matrices, pre-multiply or post-multiply order, handedness, angle units, and whether scale is inherited. Document how to preserve world transform during reparenting. Many transform bugs are not data-structure bugs; they are convention mismatches exposed by hierarchy.',
        'Track derived-data ownership. If bounds, render lists, physics proxies, or editor handles cache world-space values, they need invalidation hooks or version checks. A transform system that updates matrices but leaves stale bounds can render correctly while culling, picking, or collisions fail.',
      ],
    },
    {
      heading: 'Failure Modes',
      paragraphs: [
        'A common failure is overusing the scene graph as the only runtime structure. Particles, crowds, tile maps, grass, and thousands of similar props may be better represented as dense arrays, instanced draw batches, spatial indexes, or ECS archetypes. A hierarchy is useful for relationship, not for every repeated object.',
        'Another failure is mixing visual hierarchy with simulation authority without a clear boundary. Physics may own the world transform of a rigid body. Animation may own bone transforms. UI layout may own child positions. If several systems write the same local transform without ordering rules, the graph becomes a conflict point.',
        'Precision and scale can also fail. Deep hierarchies accumulate floating-point error. Non-uniform scale can distort children. Negative scale can flip handedness. Large worlds may need origin rebasing or double precision for high-level transforms while keeping local render data in smaller coordinates.',
      ],
    },
    {
      heading: 'Where It Matters',
      paragraphs: [
        'Scene graph transform hierarchies appear in game engines, UI frameworks, CAD tools, animation packages, SVG, glTF, browser rendering internals, robotics visualization, and level editors. The shared need is not just drawing; it is preserving relationship while objects move, group, attach, hide, select, and update.',
        'They are especially important in tools. A user dragging a parent expects children, bounds, handles, labels, and snapping guides to follow. A model imported from glTF expects node transforms to compose according to the file format. A UI panel expects child controls to inherit placement and clipping from the parent.',
      ],
    },
    {
      heading: 'Cost And Tradeoffs',
      paragraphs: [
        'The main cost is traversal and invalidation complexity. Full traversal is simple and predictable but can waste time. Dirty traversal is efficient but requires careful propagation. Flattened render lists are fast to draw but must be rebuilt or patched when hierarchy affects visibility, bounds, material grouping, or draw order.',
        'The graph also does not solve the whole renderer. Draw ordering, GPU resource lifetimes, render-pass dependencies, visibility buffers, damage regions, and batching belong to render lists, render graphs, spatial indexes, and dirty-region systems. A scene graph is the relationship layer that supplies transforms and scope to those systems.',
      ],
    },
    {
      heading: 'Study Next',
      paragraphs: [
        'Primary references to compare include the glTF 2.0 node hierarchy and transform specification, Unity Transform documentation, Godot scene tree documentation, and engine architecture texts that separate scene hierarchy from render submission. Read them with one question: where is relationship stored, and where is draw work flattened?',
        'Inside this curriculum, study Tree Traversals, Matrix Multiplication, Quaternion Rotation, Generational Arena Slot Map, Archetype ECS Column Store, Dirty Rectangle Damage Tracking, Dynamic AABB Tree Broad Phase, Depth Buffer Z-Test, Deferred G-Buffer, and Render Graph Framegraph Resource Lifetimes.',
      ],
    },
  ],
};
