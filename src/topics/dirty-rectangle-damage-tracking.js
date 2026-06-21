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
    {
      heading: 'Why This Exists',
      paragraphs: [
        `Dirty rectangle tracking, also called damage tracking, exists because most frames do not change every pixel. A caret blinks, one line of text changes, a popover moves, a scroll view exposes a strip, or a small counter updates. Redrawing the whole window for every tiny change wastes CPU time, GPU bandwidth, memory bandwidth, battery, and frame budget.`,
        {
          type: 'callout',
          text: `Damage tracking is conservative: repainting too much is slow, repainting too little is wrong.`,
        },
        `The renderer's job is to turn semantic changes into pixel work. The application says "this node moved" or "this text changed." The display system needs to answer a different question: which pixels might have a different final color than they had last frame? Dirty rectangles are the bridge between those two levels.`,
        `The idea appears in browsers, UI toolkits, terminals, document editors, 2D games, map panes, canvas applications, and compositors. It is not only a performance trick. It is also a correctness discipline: if the damaged region misses a pixel, stale visual data remains on screen.`,
      ],
    },
    {
      heading: 'The Obvious Approach',
      paragraphs: [
        `The obvious approach is full repaint. Throw away the previous frame, redraw the whole scene, rasterize every visible object, and composite the result. It is simple, and it is correct as long as the drawing code itself is correct. Many small examples start this way because it avoids bookkeeping.`,
        `The wall is scale. A large document, browser tab, dashboard, or editor may contain thousands of draw commands. At 60Hz the frame budget is about 16.7 milliseconds; at 120Hz it is about 8.3 milliseconds. Full repaint spends that budget even when a one-pixel caret blink was the only change. On mobile devices, wasted repaint also becomes wasted power.`,
        `Full repaint can still be the right choice for small canvases, video, full-screen games, and scenes where most pixels change anyway. Dirty rectangle tracking is useful only when unchanged pixels are common enough that preserving prior work is cheaper than proving what changed.`,
      ],
    },
    {
      heading: 'Core Insight',
      paragraphs: [
        `The core insight is conservative coverage. The damage region may be too large, but it must never be too small. Overpainting wastes work. Underpainting shows stale pixels. A correct damage tracker is allowed to repaint extra area for simplicity; it is not allowed to miss any pixel whose final color could change.`,
        `That rule changes the problem from model invalidation to spatial invalidation. A scene graph node, DOM element, text run, sprite, layer, or cached surface changes. The renderer expands that change into old bounds, new bounds, effect bounds, clip bounds, and layer bounds. The result is a region: rectangles, a more exact region object, or dirty tiles.`,
        `The invariant is: repainting the damage region and preserving everything outside it must produce the same final image as a full repaint. Every implementation choice is a tradeoff around that invariant.`,
      ],
    },
    {
      heading: 'Visualization Guide',
      paragraphs: [
        `In the damage-accumulation view, old bounds and new bounds both matter. If an object moves, the old area must be repainted to erase it and the new area must be painted to show it. The region node is the conservative set of pixels whose final color might differ from the previous frame.`,
        `In the region-merge view, watch the tradeoff between bookkeeping and overpaint. Many small rectangles are precise but expensive to clip against. One merged rectangle is cheap but repaints extra pixels. A correct renderer may overpaint; it must not underpaint.`,
        `The pipeline placement table shows that damage is not owned by one stage. Layout marks changed geometry, paint emits or reuses draw commands, raster marks dirty tiles, and compositing tracks layer damage. The same spatial record moves down the rendering pipeline in increasingly pixel-oriented forms.`,
      ],
    },
    {
      heading: 'How It Works',
      paragraphs: [
        `When content moves, both old and new bounds are damaged. The old bounds must be repainted because the object is no longer there. The new bounds must be painted because the object appears there. If the object has a shadow or blur, both rectangles must be inflated to include the effect. If it is transformed, the renderer uses transformed bounds rather than local geometry alone.`,
        `When text changes, the damaged area is often the affected line box plus cursor and selection overlays. Text is tricky because glyph antialiasing, ligatures, fallback fonts, line wrapping, and subpixel positioning can make a small edit affect nearby pixels. Editors often damage a whole line or paragraph because a slightly larger repaint is safer than stale glyph fragments.`,
        `When scrolling, many pixels can be copied, shifted, or reused. The new damage is the exposed strip plus overlays that depend on scroll position. A tiled renderer may mark only the exposed dirty tiles. A compositor may move a layer without repainting its contents if the layer texture is still valid.`,
      ],
    },
    {
      heading: 'Why It Works',
      paragraphs: [
        `It works because user interfaces usually have temporal coherence. Consecutive frames are similar. Most objects keep the same position, style, text, and pixels. If the renderer can identify the small region whose inputs changed, it can reuse the rest of the previous frame.`,
        `The proof idea is direct. Suppose the damage region contains every pixel whose final color depends on changed inputs. Repaint every pixel in that region from current scene state. Keep every pixel outside the region from the previous frame. Since outside pixels had no changed inputs, their previous color is still correct. The result matches a full repaint.`,
        `Region merging preserves this proof when it grows the region. If two dirty rectangles are replaced by their bounding union, every changed pixel is still inside. The renderer may paint more pixels, but the final image remains correct. Region clipping is safe only when the clip is a real visibility boundary, such as a viewport, scroll container, or layer mask.`,
      ],
    },
    {
      heading: 'Data Structures',
      paragraphs: [
        `The simplest representation is a list of rectangles. It is easy to append old and new bounds, easy to intersect with clips, and easy to hand to paint code. The cost is that many rectangles can become expensive to compare against draw commands. A region object can merge rectangles and represent more exact unions, but it is more complex.`,
        `A tile grid is common in GPU-oriented renderers. The screen or layer is divided into fixed-size tiles, and any rectangle touching a tile marks that tile dirty. This can overpaint at tile granularity, but it matches how raster caches and GPU uploads often work. A whole-layer dirty flag is the coarsest representation. It is cheap to track but can discard a large cached surface for a tiny change.`,
        {
          type: 'image',
          src: `https://learn.microsoft.com/en-us/windows/win32/direct3ddxgi/images/track-dirty-rects-scroll-rects.png`,
          alt: `Two-frame dirty rectangle tracking diagram showing copied intersections and updated regions`,
          caption: `Dirty rectangles across frames require tracking overlaps so stale back-buffer pixels are repaired. Source: Microsoft Learn, https://learn.microsoft.com/en-us/windows/win32/direct3ddxgi/dxgi-1-2-presentation-improvements.`,
        },
        `Good systems often use several representations. High-level invalidation may track rectangles in scene coordinates. Raster may track dirty tiles in layer coordinates. The compositor may track damaged layer regions in screen coordinates. Each conversion must preserve conservative coverage.`,
      ],
    },
    {
      heading: 'Worked Example',
      paragraphs: [
        `A text caret blinks in a document editor. The document tree changes only at the caret node, so the damage is a narrow strip around the caret plus antialiasing padding. The renderer clips that strip to the visible viewport and repaints it, leaving the rest of the page cached. A full repaint of the document would be correct, but it would waste almost all of the frame.`,
        `Now move a floating toolbar. The old toolbar bounds and new toolbar bounds are both dirty. If the toolbar has a shadow, the damage rectangles must be inflated to include the shadow blur. If the toolbar overlaps text, the old area must repaint the text that was underneath it. Missing the old bounds leaves a ghost; missing the inflated bounds leaves stale shadow pixels.`,
      ],
    },
    {
      heading: 'Cost And Behavior',
      paragraphs: [
        `Damage accumulation is usually proportional to the number of changed objects plus the cost of merging or clipping regions. Paint cost is proportional to damaged pixel area and the draw commands that intersect it. Raster cost depends on dirty tile count, pixel format, antialiasing, filters, and whether cached surfaces can be reused.`,
        `The main tradeoff is precision versus overhead. Many small rectangles reduce overpaint but increase bookkeeping and clipping. One union rectangle is cheap to track but may repaint a large unchanged area. Dirty tiles often match GPU rasterization better than exact vector regions, but tile size decides how much extra work is paid for small changes.`,
        `A practical renderer sets thresholds. If the rectangle list grows too long, merge it. If damage covers most of a layer, repaint the layer. If region math costs more than painting, stop optimizing that frame. Damage tracking should save frame budget, not become the frame budget.`,
      ],
    },
    {
      heading: 'Implementation Guidance',
      paragraphs: [
        `Store bounds in clear coordinate spaces. A common bug is mixing local object coordinates, layer coordinates, viewport coordinates, and device pixels. Convert rectangles explicitly and round outward, not inward. Fractional transforms and high-DPI scaling can otherwise shave off a pixel and create a stale edge.`,
        `Inflate damage for effects. Shadows, blur, filters, outlines, antialiasing, strokes, and cached textures can sample outside the object's logical bounds. Invalidate dependencies too: if a cached surface, glyph atlas entry, theme color, font, image decode, or shader input changes, every consumer may need damage even when geometry is unchanged.`,
        `Make debugging visible. Many UI frameworks expose paint flashing, dirty-region overlays, or raster tile borders. These tools show whether the system is repainting too much or too little. Too much hurts performance; too little is a correctness bug.`,
      ],
    },
    {
      heading: 'Where It Wins',
      paragraphs: [
        `Damage tracking wins in browsers, document editors, terminals, spreadsheets, diagrams, map panes, dashboards, UI toolkits, canvas apps, and 2D games where localized edits are common. It is strongest when large static layers can be cached and dynamic changes are spatially small.`,
        `It also wins when the renderer is bandwidth-bound. Reusing cached tiles avoids CPU paint, GPU raster, texture upload, and memory traffic. On battery-powered devices, avoiding unnecessary work can matter as much as raw frame time.`,
      ],
    },
    {
      heading: 'Where It Fails',
      paragraphs: [
        `It fails when most of the screen changes every frame: video, full-screen 3D, global shader effects, animated backgrounds, or large transforms that move nearly everything. In those cases region bookkeeping may cost more than repainting directly.`,
        `It also fails when dependencies are underestimated. A blur samples neighboring pixels. A shadow extends beyond geometry. A transform changes old and new screen bounds. A cached bitmap can be stale even when the object rectangle did not move. Stale pixels are worse than overpaint, so conservative damage is the rule.`,
        `Another failure mode is region explosion. Thousands of tiny dirty rectangles can make clipping and command intersection slower than painting one larger area. Mature renderers collapse complex damage when precision stops paying for itself.`,
      ],
    },
    {
      heading: 'Complete Case Study',
      paragraphs: [
        `In a browser or document editor, typing one character can change the glyph run, caret, selection overlay, line metrics, and maybe nearby decorations. The system damages the affected line or paragraph, clips it to the viewport, marks relevant raster tiles dirty, and composites the updated tiles. The rest of the document remains cached.`,
        `In a 2D game UI, moving a health bar damages the old and new bar rectangles plus any outline or glow. The static background remains cached. If the health bar lives on its own layer, compositing may move or update that layer without repainting the world. The scene graph says what changed; dirty rectangles say where pixels might change.`,
      ],
    },
    {
      heading: 'Study Next',
      paragraphs: [
        `Study Scene Graph Transform Hierarchy to understand old and new bounds through transforms. Study Browser Rendering for layout, paint, raster, and compositing stages. Study Virtual DOM Reconciliation for model-level invalidation, Texture Atlas & Mipmaps for raster caches, Depth Buffer Z-Test for visibility, Render Graph Framegraph Resource Lifetimes for graphics dependency tracking, and Cache Invalidation for the broader rule: every reused result needs a correct dependency key.`,
        `Useful references include MDN's critical rendering path, Chrome rendering performance documentation, and Chromium's compositor and paint-property-tree notes. Read them with the damage invariant in mind: every optimization is safe only if it preserves every pixel that could change.`,
      ],
    },
  ],
};
