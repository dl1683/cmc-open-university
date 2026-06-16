// Dirty rectangle / damage tracking: repaint only the regions invalidated by changes.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'dirty-rectangle-damage-tracking',
  title: 'Dirty Rectangle Damage Tracking',
  category: 'Systems',
  summary: 'Track changed screen regions as rectangles, merge or clip them into repaint damage, and avoid repainting pixels whose visual inputs did not change.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['damage accumulation', 'region merge tradeoff'], defaultValue: 'damage accumulation' },
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

function damageGraph(title) {
  return graphState({
    nodes: [
      { id: 'state', label: 'state', x: 0.8, y: 3.6, note: 'changed' },
      { id: 'node', label: 'node', x: 2.6, y: 2.0, note: 'dirty' },
      { id: 'old', label: 'old rect', x: 2.6, y: 5.1, note: 'erase' },
      { id: 'new', label: 'new rect', x: 4.8, y: 2.0, note: 'paint' },
      { id: 'region', label: 'region', x: 4.8, y: 5.1, note: 'union' },
      { id: 'clip', label: 'clip', x: 7.0, y: 2.0, note: 'viewport' },
      { id: 'paint', label: 'paint', x: 7.0, y: 5.1, note: 'only damage' },
      { id: 'layers', label: 'layers', x: 9.0, y: 3.6, note: 'composite' },
    ],
    edges: [
      { id: 'e-state-node', from: 'state', to: 'node', weight: '' },
      { id: 'e-state-old', from: 'state', to: 'old', weight: '' },
      { id: 'e-node-new', from: 'node', to: 'new', weight: '' },
      { id: 'e-old-region', from: 'old', to: 'region', weight: '' },
      { id: 'e-new-region', from: 'new', to: 'region', weight: '' },
      { id: 'e-region-clip', from: 'region', to: 'clip', weight: '' },
      { id: 'e-region-paint', from: 'region', to: 'paint', weight: '' },
      { id: 'e-paint-layers', from: 'paint', to: 'layers', weight: '' },
      { id: 'e-clip-layers', from: 'clip', to: 'layers', weight: '' },
    ],
  }, { title });
}

function* damageAccumulation() {
  yield {
    state: damageGraph('A visual change invalidates old and new bounds'),
    highlight: { active: ['state', 'node', 'old', 'new', 'e-state-node', 'e-state-old', 'e-node-new'], found: ['region'] },
    explanation: 'When a visual node moves, the old rectangle must be repainted to erase it, and the new rectangle must be painted to show it. Damage tracking records both regions before paint.',
    invariant: 'Damage must cover every pixel whose final color could change.',
  };

  yield {
    state: labelMatrix(
      'Damage records',
      [
        { id: 'move', label: 'move card' },
        { id: 'text', label: 'text edit' },
        { id: 'opacity', label: 'opacity layer' },
        { id: 'scroll', label: 'scroll' },
      ],
      [
        { id: 'old', label: 'old area' },
        { id: 'new', label: 'new area' },
        { id: 'paint', label: 'paint need' },
      ],
      [
        ['old rect', 'new rect', 'union'],
        ['line box', 'line box', 'line'],
        ['layer bounds', 'layer bounds', 'maybe composite'],
        ['exposed strip', 'shifted region', 'partial'],
      ],
    ),
    highlight: { active: ['move:old', 'move:new', 'move:paint'], found: ['scroll:paint'], compare: ['opacity:paint'] },
    explanation: 'Different changes generate different damage. Moving content needs old plus new areas. Text edits often damage line boxes. Scrolling can reuse most pixels and paint only newly exposed strips.',
  };

  yield {
    state: damageGraph('The damage region is clipped to viewport and layer boundaries'),
    highlight: { active: ['region', 'clip', 'paint', 'e-region-clip', 'e-region-paint'], found: ['layers'], compare: ['old', 'new'] },
    explanation: 'Damage rectangles are usually clipped by viewport, stacking context, scroll container, or composited layer. The goal is to reduce paint work without missing pixels.',
  };

  yield {
    state: labelMatrix(
      'Pipeline placement',
      [
        { id: 'layout', label: 'layout' },
        { id: 'paint', label: 'paint' },
        { id: 'raster', label: 'raster' },
        { id: 'composite', label: 'composite' },
      ],
      [
        { id: 'uses', label: 'uses damage?' },
        { id: 'lesson', label: 'lesson' },
      ],
      [
        ['marks boxes', 'find changed geometry'],
        ['yes', 'emit draw commands'],
        ['yes', 'raster dirty tiles'],
        ['layer damage', 'blend changed layers'],
      ],
    ),
    highlight: { active: ['paint:uses', 'raster:uses', 'composite:uses'], found: ['layout:lesson'] },
    explanation: 'Damage tracking links layout, paint, raster, and compositing. It is a region data structure sitting between high-level UI changes and low-level pixel work.',
  };

  yield {
    state: damageGraph('Complete case: a blinking caret damages a tiny strip'),
    highlight: { active: ['node', 'new', 'region', 'paint'], compare: ['layers'], removed: ['old'] },
    explanation: 'A text caret blink should not repaint the full document. The caret node toggles visibility, the damage is a narrow rectangle, and raster work stays local.',
  };
}

function* regionMergeTradeoff() {
  yield {
    state: damageGraph('Many small dirty rects can be merged into fewer regions'),
    highlight: { active: ['old', 'new', 'region'], found: ['paint'], compare: ['clip'] },
    explanation: 'Tracking every tiny rectangle can reduce pixel work but increase bookkeeping and clipping overhead. Merging rectangles lowers overhead but may repaint extra pixels.',
    invariant: 'Merging may overpaint, but must not underpaint.',
  };

  yield {
    state: labelMatrix(
      'Merge choices',
      [
        { id: 'many', label: 'many rects' },
        { id: 'union', label: 'one union' },
        { id: 'tiles', label: 'dirty tiles' },
        { id: 'layer', label: 'whole layer' },
      ],
      [
        { id: 'benefit', label: 'benefit' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['least overpaint', 'complex clips'],
        ['simple paint', 'extra pixels'],
        ['GPU friendly', 'tile granularity'],
        ['cheap tracking', 'large overpaint'],
      ],
    ),
    highlight: { active: ['many:benefit', 'tiles:benefit'], compare: ['union:cost', 'layer:cost'] },
    explanation: 'The right region representation depends on the renderer. CPU paint may prefer exact rectangles. GPU tiled rasterizers often reason in dirty tiles.',
  };

  yield {
    state: damageGraph('Containment limits how far damage can spread'),
    highlight: { active: ['node', 'region', 'clip'], found: ['paint'], compare: ['layers'] },
    explanation: 'CSS containment, canvas layers, editor panes, and scene graph subtrees can bound invalidation. A small change inside a contained subtree should not force the whole application to be treated as dirty.',
  };

  yield {
    state: labelMatrix(
      'Pitfalls',
      [
        { id: 'shadow', label: 'shadow' },
        { id: 'blur', label: 'blur' },
        { id: 'transform', label: 'transform' },
        { id: 'cache', label: 'cache' },
      ],
      [
        { id: 'why', label: 'why hard' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['extends bounds', 'inflate damage'],
        ['samples neighbors', 'pad region'],
        ['moves pixels', 'old + new bounds'],
        ['stale bitmap', 'invalidate key'],
      ],
    ),
    highlight: { active: ['shadow:fix', 'blur:fix', 'transform:fix'], found: ['cache:fix'] },
    explanation: 'Paint effects can make the damaged pixel set larger than the object geometry. A correct implementation inflates damage by shadows, filters, antialiasing, and cached surface dependencies.',
  };

  yield {
    state: damageGraph('Complete case: document editor repaint budgeting'),
    highlight: { active: ['region', 'clip', 'paint', 'layers'], compare: ['state'], found: ['node'] },
    explanation: 'A document editor typing one character wants to repaint the line, cursor, selection overlay, and maybe page shadow, not every page. Region tracking is what turns a semantic edit into bounded rendering work.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'damage accumulation') yield* damageAccumulation();
  else if (view === 'region merge tradeoff') yield* regionMergeTradeoff();
  else throw new InputError('Pick a dirty-rectangle view.');
}

export const article = {
  sections: [
    { heading: 'What it is', paragraphs: [
      'Dirty rectangle tracking, also called damage tracking, records which screen regions may have changed since the last frame. Instead of repainting everything, the renderer repaints only the damaged region, possibly overpainting a little for simplicity.',
      'The structure is deceptively small: a set of rectangles, regions, or dirty tiles. The correctness rule is strict. Damage may be conservative, but it must include every pixel whose final color could change.',
    ] },
    { heading: 'How it works', paragraphs: [
      'When content moves, the old bounds and new bounds are damaged. When text changes, the affected line boxes are damaged. When scrolling, most content can be copied or shifted and only newly exposed strips need paint. The renderer clips damage through viewports, scroll containers, stacking contexts, and composited layers.',
      'Real systems balance exactness and overhead. Many small rectangles reduce overpaint but cost more to track and clip. One union rectangle is simple but can repaint many unchanged pixels. Tiled renderers often mark dirty tiles because raster work is already tile-based.',
    ] },
    { heading: 'Cost and complexity', paragraphs: [
      'Damage accumulation is usually proportional to the number of changed objects plus region merge cost. Paint cost is proportional to the damaged pixel area and the draw commands intersecting it. The best case is tiny damage. The worst case is full-window damage, where the bookkeeping bought little.',
      'Effects complicate the math. Shadows, filters, transforms, antialiasing, and cached surfaces can expand damage beyond object bounds. Underestimating damage creates stale pixels. Overestimating damage wastes work but stays correct.',
    ] },
    { heading: 'Complete case study', paragraphs: [
      'In a browser or document editor, typing one character should damage a text line, caret, selection overlay, and maybe nearby decorations. It should not repaint the whole document. Damage regions are the bridge from DOM or document model changes to paint and raster work.',
      'In a 2D game UI, moving a health bar damages the old and new bar rectangles. Static background tiles can remain cached. The scene graph says what changed; dirty rectangles say where pixels might change.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Sources: MDN critical rendering path, https://developer.mozilla.org/en-US/docs/Web/Performance/Guides/Critical_rendering_path; Chrome rendering performance documentation, https://developer.chrome.com/docs/devtools/rendering/performance; Chromium paint property tree and rendering architecture notes at https://chromium.googlesource.com/chromium/src/+/main/docs/how_cc_works.md. Study Scene Graph Transform Hierarchy, Browser Rendering, Virtual DOM Reconciliation, Texture Atlas & Mipmaps, Depth Buffer Z-Test, Render Graph Framegraph Resource Lifetimes, and Cache Invalidation next.',
    ] },
  ],
};
