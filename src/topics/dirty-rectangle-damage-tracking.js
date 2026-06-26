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
  const damagePath = ['state', 'node', 'old', 'new'];
  yield {
    state: damageGraph('A visual change invalidates old and new bounds'),
    highlight: { active: [...damagePath, 'e-state-node', 'e-state-old', 'e-node-new'], found: ['region'] },
    explanation: `When a visual node moves, the "${damagePath[2]}" rectangle must be repainted to erase it, and the "${damagePath[3]}" rectangle must be painted to show it. Damage tracking records both regions through ${damagePath.length} stages before paint.`,
    invariant: `Damage across all ${damagePath.length} stages must cover every pixel whose final color could change.`,
  };

  const damageTypes = [
    { id: 'move', label: 'move card' },
    { id: 'text', label: 'text edit' },
    { id: 'opacity', label: 'opacity layer' },
    { id: 'scroll', label: 'scroll' },
  ];
  const damageCols = [
    { id: 'old', label: 'old area' },
    { id: 'new', label: 'new area' },
    { id: 'paint', label: 'paint need' },
  ];
  yield {
    state: labelMatrix(
      'Damage records',
      damageTypes,
      damageCols,
      [
        ['old rect', 'new rect', 'union'],
        ['line box', 'line box', 'line'],
        ['layer bounds', 'layer bounds', 'maybe composite'],
        ['exposed strip', 'shifted region', 'partial'],
      ],
    ),
    highlight: { active: ['move:old', 'move:new', 'move:paint'], found: ['scroll:paint'], compare: ['opacity:paint'] },
    explanation: `${damageTypes.length} different change types (${damageTypes.map(d => d.label).join(', ')}) generate different damage across ${damageCols.length} columns. Moving content needs ${damageCols[0].label} plus ${damageCols[1].label}. Text edits often damage line boxes. Scrolling can reuse most pixels and paint only newly exposed strips.`,
  };

  const clipPath = ['region', 'clip', 'paint'];
  yield {
    state: damageGraph('The damage region is clipped to viewport and layer boundaries'),
    highlight: { active: [...clipPath, 'e-region-clip', 'e-region-paint'], found: ['layers'], compare: ['old', 'new'] },
    explanation: `Damage rectangles flow through ${clipPath.length} stages ("${clipPath.join('" then "')}"), usually clipped by viewport, stacking context, scroll container, or composited layer. The goal is to reduce paint work without missing pixels.`,
  };

  const pipelineRows = [
    { id: 'layout', label: 'layout' },
    { id: 'paint', label: 'paint' },
    { id: 'raster', label: 'raster' },
    { id: 'composite', label: 'composite' },
  ];
  yield {
    state: labelMatrix(
      'Pipeline placement',
      pipelineRows,
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
    explanation: `Damage tracking links ${pipelineRows.length} pipeline stages (${pipelineRows.map(r => r.label).join(', ')}). It is a region data structure sitting between high-level UI changes and low-level pixel work.`,
  };

  const caretNodes = ['node', 'new', 'region', 'paint'];
  yield {
    state: damageGraph('Complete case: a blinking caret damages a tiny strip'),
    highlight: { active: caretNodes, compare: ['layers'], removed: ['old'] },
    explanation: `A text caret blink should not repaint the full document. The caret "${caretNodes[0]}" toggles visibility, the damage flows through ${caretNodes.length} stages, and raster work stays local.`,
  };
}

function* regionMergeTradeoff() {
  const mergeNodes = ['old', 'new', 'region'];
  yield {
    state: damageGraph('Many small dirty rects can be merged into fewer regions'),
    highlight: { active: mergeNodes, found: ['paint'], compare: ['clip'] },
    explanation: `Tracking every tiny rectangle across "${mergeNodes[0]}" and "${mergeNodes[1]}" into "${mergeNodes[2]}" can reduce pixel work but increase bookkeeping and clipping overhead. Merging rectangles lowers overhead but may repaint extra pixels.`,
    invariant: `Merging ${mergeNodes.length} rect sources may overpaint, but must not underpaint.`,
  };

  const mergeRows = [
    { id: 'many', label: 'many rects' },
    { id: 'union', label: 'one union' },
    { id: 'tiles', label: 'dirty tiles' },
    { id: 'layer', label: 'whole layer' },
  ];
  yield {
    state: labelMatrix(
      'Merge choices',
      mergeRows,
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
    explanation: `The ${mergeRows.length} merge strategies (${mergeRows.map(r => r.label).join(', ')}) depend on the renderer. CPU paint may prefer exact rectangles. GPU tiled rasterizers often reason in "${mergeRows[2].label}".`,
  };

  const containmentNodes = ['node', 'region', 'clip'];
  yield {
    state: damageGraph('Containment limits how far damage can spread'),
    highlight: { active: containmentNodes, found: ['paint'], compare: ['layers'] },
    explanation: `CSS containment, canvas layers, editor panes, and scene graph subtrees can bound invalidation through ${containmentNodes.length} stages ("${containmentNodes.join('", "')}"). A small change inside a contained subtree should not force the whole application to be treated as dirty.`,
  };

  const pitfallRows = [
    { id: 'shadow', label: 'shadow' },
    { id: 'blur', label: 'blur' },
    { id: 'transform', label: 'transform' },
    { id: 'cache', label: 'cache' },
  ];
  yield {
    state: labelMatrix(
      'Pitfalls',
      pitfallRows,
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
    explanation: `${pitfallRows.length} paint effects (${pitfallRows.map(r => r.label).join(', ')}) can make the damaged pixel set larger than the object geometry. A correct implementation inflates damage by shadows, filters, antialiasing, and cached surface dependencies.`,
  };

  const editorNodes = ['region', 'clip', 'paint', 'layers'];
  yield {
    state: damageGraph('Complete case: document editor repaint budgeting'),
    highlight: { active: editorNodes, compare: ['state'], found: ['node'] },
    explanation: `A document editor typing one character wants to repaint the line, cursor, selection overlay, and maybe page shadow through ${editorNodes.length} stages, not every page. Region tracking is what turns a semantic edit into bounded rendering work.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'The visualization has two views. The "damage accumulation" view shows a graph of pipeline stages: a visual change flows from a state node through old bounds and new bounds into a merged damage region, then through clipping and painting into final composited layers. Each step highlights the active stage and shows how damage propagates. The "region merge tradeoff" view shows the same pipeline but focuses on the tension between tracking many small rectangles versus merging them into fewer, larger ones.',
        {type: 'image', src: './assets/gifs/dirty-rectangle-damage-tracking.gif', alt: 'Animated walkthrough of the dirty rectangle damage tracking visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'The matrix tables that appear mid-animation map change types (move, text edit, opacity, scroll) to their damage characteristics. Each row shows what old area and new area look like for that change type, and what paint work results. The pipeline placement table shows which rendering stages consume damage information: layout marks changed geometry, paint emits draw commands, raster marks dirty tiles, and compositing blends changed layers.',
        'Watch for the caret-blink case at the end of the damage accumulation view. A single toggling node produces a tiny damage strip that flows through the full pipeline without ever touching the rest of the document. That case demonstrates the entire value proposition: bounded damage means bounded work.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Most frames do not change most pixels. A cursor blinks, one line of text reflows, a tooltip appears, a scroll bar moves, a counter increments. On a 1920x1080 display at 32 bits per pixel, a full repaint touches 8.3 million bytes of pixel data. At 60 Hz, that is 500 MB/s of pixel throughput for content that is 99% identical to the previous frame. The waste is not just CPU cycles -- it is memory bandwidth, GPU texture uploads, battery drain, and thermal throttle risk on mobile devices.',
        {
          type: 'callout',
          text: `Damage tracking is conservative: repainting too much is slow, repainting too little is wrong.`,
        },
        'Dirty rectangle tracking (also called damage tracking or invalidation) solves this by answering a spatial question: which rectangular regions of the screen might have different pixel values than they did last frame? The application reports semantic changes -- "this node moved," "this text changed." The damage tracker converts those into pixel-space rectangles that bound every possibly-changed pixel. Only those rectangles get repainted.',
        'The technique appears in every major rendering system: browser engines (Blink, WebKit, Gecko), OS compositors (DWM, Quartz, Wayland), UI toolkits (Qt, GTK, WPF, SwiftUI), 2D game engines, terminal emulators, document editors, and canvas applications. It is not an optimization bolted on after the fact -- it is a structural component of the rendering pipeline, sitting between model-level change detection and pixel-level rasterization.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The simplest rendering strategy is full repaint: clear the framebuffer, walk the entire scene graph, issue every draw command, rasterize every visible object, and composite the result. This is correct by construction -- if the drawing code produces the right pixels, the output is right. There is no bookkeeping, no invalidation logic, no stale-pixel risk. Many tutorials and small applications start here because it eliminates an entire class of bugs.',
        'Full repaint also has predictable cost: every frame takes roughly the same time regardless of what changed. There are no worst-case spikes from damage merging or cache invalidation. For scenes where most pixels change every frame -- full-screen video, 3D games with a moving camera, particle systems -- full repaint is actually the right choice because there is no prior work worth preserving.',
        'The approach holds up as long as the scene is small enough to redraw within the frame budget. A 400x300 canvas with 50 draw commands can be fully repainted in well under a millisecond. A full-page browser document with 10,000 DOM elements, complex text layout, shadows, gradients, and transparency layers cannot.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'At 60 Hz the frame budget is 16.7 ms. At 120 Hz it is 8.3 ms. A full repaint of a complex document or application UI can take 5-50 ms depending on scene complexity, resolution, and hardware. When a single-character keystroke triggers a 20 ms full repaint on a 16.7 ms budget, the frame drops. The user sees jank -- a visible stutter that breaks the illusion of responsiveness.',
        'The cost breaks down across pipeline stages. Layout recomputes geometry for every element: positions, sizes, line breaks. Paint walks the element tree and emits draw commands: fills, strokes, text runs, images. Rasterization converts those draw commands into pixel grids, applying antialiasing, blending, and filters. Compositing layers the rasterized tiles into the final framebuffer. Each stage is proportional to the number of elements it processes, and a full repaint forces every stage to process everything.',
        'The waste is measurable. If a caret blink changes a 2x16 pixel strip on a 1920x1080 screen, a full repaint does 64,800 times more pixel work than necessary. On a battery-powered device, that wasted work translates directly into wasted milliwatt-hours. Mobile browsers and OS compositors treat unnecessary repaints as power bugs.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The renderer can skip pixels whose visual inputs have not changed since the last frame. If the previous frame is still in the framebuffer (or in a cached layer texture), and no input to a pixel has changed -- no geometry moved over it, no text reflowed into it, no style changed under it -- then its color is still correct. Preserving it is free. Recomputing it is pure waste.',
        'This insight converts the rendering problem from "draw everything" to "draw only the damage." Damage is defined as the set of pixels whose final color might differ between the old frame and the new frame. The word "might" is critical: the tracker does not need to prove that a pixel actually changed color. It only needs to guarantee that every pixel that could have changed is inside the damage region. Overpainting is wasteful but harmless. Underpainting is a correctness bug -- stale pixels remain visible.',
        'The formal invariant: repainting exactly the damage region from the current scene state, while preserving every pixel outside the damage region from the previous frame, must produce the same image as a full repaint. If this invariant holds, the optimization is invisible to the user. If it fails, visual artifacts appear -- ghosts of moved objects, stale text, shadow remnants, clipped edges.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'When a visual property changes -- position, size, text content, color, opacity, visibility, transform -- the renderer computes two rectangles. The old bounds enclose the object\'s previous screen footprint. The new bounds enclose its current screen footprint. Both rectangles are marked as damaged because the old location must be erased (repainted with whatever is behind it) and the new location must be painted with the object\'s new appearance. If the object has visual effects like shadows, outlines, or blur, both rectangles are inflated to include the effect extent.',
        'The individual damage rectangles are accumulated into a damage region. The simplest region is a list of rectangles. A more compact representation is a single bounding rectangle (the union of all individual rectangles), which trades precision for simplicity. Some renderers use a tile grid: the screen is divided into fixed-size tiles (commonly 256x256 pixels), and any damage rectangle touching a tile marks that tile dirty. The tile approach aligns with GPU texture upload granularity and raster cache management.',
        {
          type: 'image',
          src: `https://learn.microsoft.com/en-us/windows/win32/direct3ddxgi/images/track-dirty-rects-scroll-rects.png`,
          alt: `Two-frame dirty rectangle tracking diagram showing copied intersections and updated regions`,
          caption: `Dirty rectangles across frames require tracking overlaps so stale back-buffer pixels are repaired. Source: Microsoft Learn, https://learn.microsoft.com/en-us/windows/win32/direct3ddxgi/dxgi-1-2-presentation-improvements.`,
        },
        'The damage region is clipped to visibility boundaries -- the viewport, scroll container, composited layer, or stacking context. Damage outside the viewport produces no visible pixels and can be discarded. Damage inside a composited layer stays within that layer\'s coordinate space and does not propagate to sibling layers. Finally, the clipped damage region is handed to the paint stage, which re-executes draw commands that intersect it, and to the raster stage, which regenerates dirty tiles. The compositor blends the updated tiles or layers into the final framebuffer, preserving everything outside the damage region from the previous frame.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument rests on temporal coherence: consecutive frames are overwhelmingly similar. User interfaces change in response to discrete events -- keystrokes, clicks, scrolls, timers -- and each event typically affects a small spatial region. Between events, the scene is static. If the renderer can identify the small region affected by each event, it can reuse the vast majority of the previous frame\'s pixel work.',
        'Formally, partition the screen into two pixel sets: damaged (pixels inside the damage region) and undamaged (everything else). For undamaged pixels, no visual input has changed, so their previous color is their correct current color -- preserving them is equivalent to repainting them. For damaged pixels, the renderer repaints from current scene state, which produces the correct current color by definition. The union of correct preserved pixels and correct repainted pixels equals a correct full frame.',
        'Region merging preserves this argument. If two disjoint dirty rectangles are replaced by their bounding union, the union strictly contains the original damage. Every changed pixel is still inside the region. The renderer repaints extra unchanged pixels inside the union, which wastes work but does not produce incorrect output. Region clipping also preserves the argument, but only when the clip boundary is a true visibility boundary -- clipping damage to a viewport is safe because pixels outside the viewport are never displayed.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Damage accumulation cost is O(k) where k is the number of changed objects per frame. Each change produces one or two rectangles (old bounds and new bounds). Rectangle merging -- computing the bounding union of n rectangles -- is O(n). Tile-grid marking is O(n * t) where t is the number of tiles each rectangle touches, typically a small constant. These costs are negligible compared to actual pixel work.',
        'Paint cost is proportional to the damaged pixel area multiplied by the draw command density in that area. A 100x100 damage rectangle in a region with 5 overlapping draw commands costs roughly 50,000 pixel operations. The same rectangle in a sparse region might cost 10,000. Full repaint of a 1920x1080 screen with uniform density would cost 2,073,600 times the per-pixel work. The ratio of damaged area to total area is the savings factor.',
        'The overhead of damage tracking -- maintaining rectangle lists, testing draw command intersection, coordinating tile caches -- is typically under 1% of frame time for well-implemented systems. The break-even point is around 60-80% screen coverage: when more than that fraction of the screen changes, the bookkeeping overhead exceeds the paint savings, and a full repaint is cheaper. Mature renderers detect this case and fall back automatically.',
        'Memory cost depends on the caching strategy. A tiled renderer caches rasterized tiles in GPU memory, typically 256x256 pixels at 4 bytes per pixel = 256 KB per tile. A 1920x1080 screen requires about 32 tiles, consuming 8 MB of GPU memory for the tile cache. Layer-based compositors cache entire layer textures, which can consume tens or hundreds of megabytes for complex scenes. The damage system decides which cached surfaces to preserve and which to regenerate.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Browser engines. Chromium\'s Blink engine maintains a display item list and a tile grid. When the DOM changes, the layout and paint stages mark affected display items and tiles dirty. The raster stage regenerates only dirty tiles, and the compositor uploads only changed tiles to the GPU. Chrome DevTools\' "Paint Flashing" overlay visualizes damage rectangles in real time -- green flashes show which screen regions the engine is repainting each frame.',
        'OS compositors. Windows DWM (Desktop Window Manager) tracks dirty rectangles per window surface. When an application updates part of its window, it reports the damaged region to DWM via DXGI present. DWM composites only the affected screen region with desktop background, other windows, and transparency effects. macOS Quartz Compositor and Wayland compositors use analogous damage protocols.',
        'Document editors. Microsoft Word, Google Docs, and VS Code track damage at the line or paragraph level. Typing a character damages the current line box and caret region. Scrolling damages the exposed strip. Selection changes damage the old and new selection overlays. The rest of the document remains in cached paint output, avoiding redundant text layout and glyph rasterization.',
        'Game UI and 2D engines. HUD elements (health bars, minimaps, score displays) change infrequently relative to the 3D scene. By placing UI on a separate composited layer with its own damage tracking, the engine avoids re-rendering static UI elements every frame. The 3D scene may have its own full-repaint pipeline, but the UI layer benefits from damage tracking because most of it is static most of the time.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Full-screen motion defeats damage tracking. Video playback, 3D rendering with a moving camera, animated backgrounds, and global shader effects change every pixel every frame. The damage region equals the entire screen, so the bookkeeping cost of computing and merging rectangles is pure overhead on top of the full repaint that would happen anyway. Renderers that detect full-screen damage skip the tracking machinery entirely.',
        'Visual effects that extend beyond object geometry cause underpainting bugs when the damage tracker does not account for them. A box-shadow with a 20px blur radius extends the object\'s visual footprint 20px in every direction. If the damage tracker uses the object\'s CSS box as the damage rectangle without inflating for the shadow, moving the object leaves shadow remnants at the old location. The same problem affects filters (blur, drop-shadow), outlines, antialiasing fringes, and transforms that change the screen-space bounding box.',
        'Dependency tracking failures cause stale pixels even without geometric changes. A cached raster tile may depend on a theme color, font metric, image decode, or shader uniform. If any dependency changes but the damage tracker only watches geometry, the stale tile persists on screen. Correct damage tracking requires invalidating not just "what moved" but "what depends on something that changed." This is the hardest part of the implementation.',
        'Region explosion is a performance failure mode. If thousands of small objects change simultaneously (a particle system, a table with many updating cells, a physics simulation), the damage list grows to thousands of rectangles. Intersecting each rectangle against each draw command becomes O(k * d) where both k and d are large. Mature renderers collapse the list into a single bounding union or switch to full repaint when rectangle count exceeds a threshold.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Scenario: a document editor at 1920x1080 resolution, 60 Hz. The user types the letter "x" into line 47. The line box for line 47 occupies screen coordinates (100, 740) to (1820, 760) -- a 1720x20 pixel strip. The caret occupies (450, 740) to (452, 758) -- a 2x18 pixel strip. No other content changes.',
        'Step 1, damage accumulation: the text layout engine marks line 47\'s glyph run as dirty (text content changed). The caret position shifts right by one glyph width. Old caret bounds: (448, 740, 450, 758). New caret bounds: (450, 740, 452, 758). Line damage: (100, 740, 1820, 760). Three rectangles enter the damage list.',
        'Step 2, region merge: the line rectangle fully contains both caret rectangles, so merging produces a single rectangle: (100, 740, 1820, 760). Total damaged area: 1720 * 20 = 34,400 pixels. Full screen: 1920 * 1080 = 2,073,600 pixels. Damage ratio: 1.66%. The renderer saves 98.3% of pixel work compared to a full repaint.',
        'Step 3, clip and paint: the damage rectangle is clipped to the visible viewport (it is fully inside, so no clipping occurs) and to the document layer (the toolbar and sidebar layers are unaffected). Paint re-executes draw commands that intersect the damage rectangle: the line 47 text run, the caret, and the selection overlay (empty in this case). Raster regenerates the two 256x256 tiles that the damage rectangle touches. The compositor uploads those two tiles to the GPU and blends them with the unchanged framebuffer. Total raster work: 2 tiles * 256 * 256 = 131,072 pixels, not 2 million.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Microsoft Learn, "DXGI 1.2 Presentation Improvements" -- documents the dirty rectangle and scroll rectangle APIs for Windows swap chains, with diagrams of multi-frame damage tracking and back-buffer coordination. Chromium source code, cc/trees/layer_tree_host_impl.cc and cc/tiles/tile_manager.cc -- the production implementation of tile-based damage tracking in the world\'s most-used browser engine.',
        'Prerequisites: Scene Graph Transform Hierarchy (understanding old and new bounds through transforms), Browser Rendering Pipeline (layout, paint, raster, compositing stages), and Cache Invalidation (the general principle that every reused result needs a correct dependency key -- damage tracking is a spatial specialization of this principle).',
        'Related topics: Virtual DOM Reconciliation handles model-level invalidation (which nodes changed?) while damage tracking handles pixel-level invalidation (which screen regions changed?). Texture Atlas and Mipmaps are the raster cache structures that damage tracking decides to preserve or regenerate. Depth Buffer Z-Test solves a related visibility problem in 3D. Render Graph and Framegraph Resource Lifetimes manage GPU resource dependencies, which intersect with damage tracking when cached surfaces have cross-frame lifetimes.',
        'For hands-on exploration, open Chrome DevTools, navigate to Rendering settings, and enable "Paint Flashing." Every green flash shows a damage rectangle that the browser repainted. Scroll, type, hover, and resize to see how damage regions grow and shrink. Compare a static page (almost no flashing) with a page running animations (continuous flashing in animation regions). The visual feedback makes the abstract concept concrete.',
      ],
    },
  ],
};
