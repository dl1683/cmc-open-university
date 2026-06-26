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
  const activeChain = ['root', 'player', 'weapon', 'muzzle', 'e-root-player', 'e-player-weapon', 'e-weapon-muzzle'];
  const derivedNodes = ['bounds'];
  yield {
    state: sceneGraph('A scene graph stores local transforms in a tree'),
    highlight: { active: activeChain, found: derivedNodes },
    explanation: `A scene graph is a retained tree of visual objects. Here ${activeChain.length} elements (${activeChain.filter(n => !n.startsWith('e-')).join(', ')} and their ${activeChain.filter(n => n.startsWith('e-')).length} edges) form an active chain. Each node stores a local transform relative to its parent. A traversal composes parent world transform with child local transform to produce child world transform, with ${derivedNodes[0]} derived at the leaves.`,
    invariant: 'world(child) = world(parent) composed with local(child).',
  };

  const tfRows = [
    { id: 'root', label: 'root' },
    { id: 'player', label: 'player' },
    { id: 'weapon', label: 'weapon' },
    { id: 'muzzle', label: 'muzzle fx' },
  ];
  const tfCols = [
    { id: 'local', label: 'local' },
    { id: 'parent', label: 'parent' },
    { id: 'world', label: 'world' },
  ];
  const tfActiveWorlds = ['player:world', 'weapon:world', 'muzzle:world'];
  const tfFoundWorld = ['root:world'];
  yield {
    state: labelMatrix(
      'Transform fields',
      tfRows,
      tfCols,
      [
        ['identity', '-', 'identity'],
        ['move 10,2', 'root', '10,2'],
        ['rotate 15', 'player', '10,2 + rot'],
        ['offset 1,0', 'weapon', 'barrel tip'],
      ],
    ),
    highlight: { active: tfActiveWorlds, found: tfFoundWorld },
    explanation: `This ${tfRows.length}x${tfCols.length} matrix shows how each node's ${tfCols.map(c => c.label).join(', ')} fields relate. The cached world transform is derived data across ${tfActiveWorlds.length} active cells (${tfActiveWorlds.map(c => c.split(':')[0]).join(', ')}), with ${tfFoundWorld[0].split(':')[0]} as the ${tfFoundWorld[0].split(':')[1]} anchor. It is fast to read during rendering, culling, physics debug drawing, or picking, but it must be invalidated when an ancestor changes.`,
  };

  const boundsActive = ['player', 'weapon', 'hand', 'bounds', 'e-player-bounds'];
  const boundsCompare = ['camera'];
  const boundsFound = ['muzzle'];
  yield {
    state: sceneGraph('Bounds and culling are also derived from the hierarchy'),
    highlight: { active: boundsActive, compare: boundsCompare, found: boundsFound },
    explanation: `A parent can aggregate child bounds across ${boundsActive.filter(n => !n.startsWith('e-')).length} active nodes (${boundsActive.filter(n => !n.startsWith('e-')).join(', ')}). Frustum culling against the ${boundsCompare[0]} can reject an entire subtree when its world-space bounds are outside the view. The found node ${boundsFound[0]} is skipped entirely when parent bounds fail the test, turning tree structure into rendering work avoidance.`,
  };

  const payloadRows = [
    { id: 'transform', label: 'transform' },
    { id: 'mesh', label: 'mesh ref' },
    { id: 'bounds', label: 'bounds' },
    { id: 'flags', label: 'flags' },
  ];
  const payloadCols = [
    { id: 'stores', label: 'stores' },
    { id: 'why', label: 'why' },
  ];
  const payloadActive = ['transform:stores', 'bounds:stores'];
  const payloadFound = ['flags:why'];
  yield {
    state: labelMatrix(
      'Common node payloads',
      payloadRows,
      payloadCols,
      [
        ['local + world', 'placement'],
        ['asset handle', 'draw lookup'],
        ['local + world AABB', 'cull/pick'],
        ['visible/dirty/static', 'skip work'],
      ],
    ),
    highlight: { active: payloadActive, found: payloadFound },
    explanation: `The graph carries ${payloadRows.length} payload types (${payloadRows.map(r => r.label).join(', ')}) across ${payloadCols.length} columns. The ${payloadActive.length} active cells (${payloadActive.map(c => c.split(':')[0]).join(' and ')}) show core storage, while ${payloadFound[0].split(':')[0]} flags (${payloadFound[0].split(':')[1]}: skip work) keep the cache honest. Nodes carry asset handles, bounds, visibility, animation state, and dirty flags around the same parent-child core.`,
  };

  const completeActive = ['player', 'weapon', 'muzzle'];
  const completeFound = ['bounds'];
  const completeCompare = ['ui'];
  yield {
    state: sceneGraph('Complete case: attach weapon effects to a moving player'),
    highlight: { active: completeActive, found: completeFound, compare: completeCompare },
    explanation: `A weapon muzzle flash follows the player because it is attached below ${completeActive.length} linked nodes (${completeActive.join(' -> ')}). The ${completeFound[0]} node tracks the aggregate extent while ${completeCompare[0]} remains unaffected. The application edits a local transform, while the graph composes the final world position for rendering and effects.`,
  };
}

function* dirtySubtreeUpdate() {
  const dirtyActive = ['player', 'weapon', 'hand', 'muzzle', 'e-player-weapon', 'e-player-hand', 'e-weapon-muzzle'];
  const dirtyCompare = ['camera', 'ui'];
  const dirtyNodes = dirtyActive.filter(n => !n.startsWith('e-'));
  const dirtyEdges = dirtyActive.filter(n => n.startsWith('e-'));
  yield {
    state: sceneGraph('Changing a parent marks descendants dirty'),
    highlight: { active: dirtyActive, compare: dirtyCompare },
    explanation: `If the player moves, the ${dirtyCompare.length} unaffected branches (${dirtyCompare.join(' and ')}) do not need new world transforms. The ${dirtyNodes.length} dirty nodes (${dirtyNodes.join(', ')}) connected by ${dirtyEdges.length} edges do. Dirty flags let the engine recalculate only affected descendants.`,
    invariant: 'A clean child under a dirty parent cannot trust its cached world transform.',
  };

  const propRows = [
    { id: 'edit', label: 'edit local' },
    { id: 'mark', label: 'mark dirty' },
    { id: 'walk', label: 'walk subtree' },
    { id: 'clear', label: 'clear clean' },
  ];
  const propCols = [
    { id: 'action', label: 'action' },
    { id: 'scope', label: 'scope' },
  ];
  const propActive = ['mark:action', 'walk:action'];
  const propFound = ['clear:action'];
  yield {
    state: labelMatrix(
      'Dirty propagation',
      propRows,
      propCols,
      [
        ['player local changes', 'one node'],
        ['player descendants', 'subtree'],
        ['recompute world', 'dirty nodes'],
        ['cache valid', 'visited nodes'],
      ],
    ),
    highlight: { active: propActive, found: propFound },
    explanation: `Dirty propagation follows ${propRows.length} phases (${propRows.map(r => r.label).join(' -> ')}), each with ${propCols.length} dimensions: ${propCols.map(c => c.label).join(' and ')}. The ${propActive.length} active steps (${propActive.map(c => c.split(':')[0]).join(', ')}) drive the work; the ${propFound[0].split(':')[0]} step confirms the cache is honest again. This is a data-structure policy: preserve cached derived values, but attach a precise invalidation path so the cache never lies.`,
  };

  const staticActive = ['ui', 'bounds'];
  const staticFound = ['camera'];
  const staticCompare = ['player', 'weapon'];
  yield {
    state: sceneGraph('Static subtrees can be frozen or flattened'),
    highlight: { active: staticActive, found: staticFound, compare: staticCompare },
    explanation: `The ${staticActive.length} static nodes (${staticActive.join(', ')}) can be frozen, while the ${staticCompare.length} dynamic nodes (${staticCompare.join(', ')}) stay hierarchical because edits are expected. The ${staticFound[0]} node is found as a special case: mostly static but requiring view-dependent updates. A mostly static UI panel, map tile layer, or environment prop hierarchy can be flattened into a draw list or cached layer.`,
  };

  const repRows = [
    { id: 'pointers', label: 'pointers' },
    { id: 'indices', label: 'indices' },
    { id: 'ecs', label: 'ECS rows' },
    { id: 'flat', label: 'flat list' },
  ];
  const repCols = [
    { id: 'helps', label: 'helps' },
    { id: 'cost', label: 'cost' },
  ];
  const repActive = ['indices:helps', 'ecs:helps'];
  const repCompare = ['pointers:cost'];
  const repFound = ['flat:helps'];
  yield {
    state: labelMatrix(
      'Representation choices',
      repRows,
      repCols,
      [
        ['easy edits', 'pointer chasing'],
        ['arena storage', 'id indirection'],
        ['batch systems', 'parent lookup'],
        ['draw speed', 'hard edits'],
      ],
    ),
    highlight: { active: repActive, compare: repCompare, found: repFound },
    explanation: `Scene graph is the abstraction, but ${repRows.length} storage strategies exist (${repRows.map(r => r.label).join(', ')}). The ${repActive.length} active choices (${repActive.map(c => c.split(':')[0]).join(' and ')}) highlight modern approaches, while ${repCompare[0].split(':')[0]} shows the classic ${repCompare[0].split(':')[1]} tradeoff and ${repFound[0].split(':')[0]} storage maximizes ${repFound[0].split(':')[1]}. The workload decides which representation wins.`,
  };

  const editorActive = ['player', 'weapon', 'muzzle'];
  const editorRemoved = ['camera', 'ui'];
  const editorFound = ['bounds'];
  yield {
    state: sceneGraph('Complete case: editor selection moves one subtree'),
    highlight: { active: editorActive, removed: editorRemoved, found: editorFound },
    explanation: `A level editor dragging a parent object updates ${editorActive.length} nodes in the dirty subtree (${editorActive.join(' -> ')}), skips ${editorRemoved.length} unrelated branches (${editorRemoved.join(', ')}), and refreshes the ${editorFound[0]} node for selection feedback. Dirty subtree traversal is the core trick: immediate visual feedback for all children with no wasted recalculation.`,
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
    { heading: 'How to read the animation', paragraphs: [
      'The animation shows a scene graph, which is a parent-child structure for visual objects. Active nodes are the branch being composed, and found marks derived data such as bounds.',
      {type: 'image', src: './assets/gifs/scene-graph-transform-hierarchy.gif', alt: 'Animated walkthrough of the scene graph transform hierarchy visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
    ]},
    { heading: 'Why this exists', paragraphs: [
      'Visual objects often move as groups: a muzzle flash follows a weapon, the weapon follows a hand, and the hand follows a player. A scene graph stores that relationship once instead of making every system manually chase world positions.',
      {type: 'callout', text: 'A scene graph stores relationship once, then derives world transforms and bounds by traversing the affected subtree.'},
    ]},
    { heading: 'The obvious approach', paragraphs: [
      'The obvious approach is to store one world transform per object. That works for independent objects and is attractive because rendering can read a flat list directly.',
    ]},
    { heading: 'The wall', paragraphs: [
      'World-only storage fails when attachment is the source of truth. If the player moves, child objects, labels, effects, and bounds must move consistently, or the scene develops stale positions and duplicated offset logic.',
    ]},
    { heading: 'The core insight', paragraphs: [
      'Store local transforms and parent links, then cache world transforms as derived data. The invariant is world(child) = world(parent) composed with local(child), so parents must be visited before children.',
      {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with nodes connected by arrows', caption: 'A transform hierarchy is a directed parent-child graph; traversal order gives each child valid parent input before composition. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Directed_graph_no_background.svg.'},
    ]},
    { heading: 'How it works', paragraphs: [
      'Each node stores a local transform, cached world transform, children, and dirty flags. When a local transform changes, the node and descendants become dirty, and the update pass recomputes only that subtree.',
      {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/R-tree.svg/500px-R-tree.svg.png', alt: 'R-tree diagram with object rectangles grouped by blue parent bounding rectangles', caption: 'Hierarchical bounds let systems prune whole groups; scene graphs use the same summary idea for culling and picking. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:R-tree.svg.'},
    ]},
    { heading: 'Why it works', paragraphs: [
      'Correctness follows by induction over the tree. The root world transform is valid by definition, and if a parent world transform is valid, composing it with the child local transform gives a valid child world transform.',
    ]},
    { heading: 'Cost and complexity', paragraphs: [
      'A full update costs O(n) for n nodes, while a dirty-subtree update costs O(k) for k affected descendants. The price is bookkeeping: reparenting, cycle prevention, matrix convention choices, and invalidation of bounds or render lists.',
    ]},
    { heading: 'Real-world uses', paragraphs: [
      'Scene graphs appear in game engines, UI frameworks, CAD tools, animation packages, SVG, glTF, browser rendering internals, robotics visualization, and level editors. They are strongest when relationship and editing semantics matter.',
    ]},
    { heading: 'Where it fails', paragraphs: [
      'A scene graph is not ideal for particles, grass, crowds, tiles, or thousands of similar props. Dense arrays, instanced batches, spatial indexes, or ECS archetypes often serve repeated objects better.',
    ]},
    { heading: 'Worked example', paragraphs: [
      'Let the player world position be (10, 2), the weapon local offset be (1, 0), and the muzzle local offset be (2, 0). Ignoring rotation, the weapon is at (11, 2) and the muzzle is at (13, 2).',
      'Move the player by (+3, 0). The player becomes (13, 2), the weapon becomes (14, 2), and the muzzle becomes (16, 2), while unrelated camera and UI branches stay clean.',
    ]},
    { heading: 'Sources and study next', paragraphs: [
      'Study the glTF 2.0 node transform specification, Unity Transform documentation, Godot scene tree documentation, tree traversal, matrix multiplication, quaternion rotation, dirty flags, dynamic AABB trees, ECS storage, and render graphs.',
    ]},
  ],
};