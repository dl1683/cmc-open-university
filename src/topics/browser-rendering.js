// How a browser paints: HTML and CSS go in, pixels come out, and in between
// runs a five-stage pipeline — parse, style, layout, paint, composite — that
// every frontend performance trick is really about skipping stages of.

import { callTreeState, arrayState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'browser-rendering',
  title: 'How a Browser Paints a Page',
  category: 'Systems',
  summary: 'HTML in, pixels out: the parse → style → layout → paint → composite pipeline, and the JS loop that breaks it.',
  controls: [
    { id: 'view', label: 'Follow', type: 'select', options: ['a page load, HTML to pixels', 'the layout-thrash trap'], defaultValue: 'a page load, HTML to pixels' },
  ],
  run,
};

// The toy page: <html><head><style/></head><body><h1/><div.card><p/><span.hidden/></div></body></html>
const DOM = [
  { id: 'html', parentId: null, name: '<html>', args: '' },
  { id: 'head', parentId: 'html', name: '<head>', args: '' },
  { id: 'style', parentId: 'head', name: '<style>', args: '4 rules' },
  { id: 'body', parentId: 'html', name: '<body>', args: '' },
  { id: 'h1', parentId: 'body', name: '<h1>', args: '"Hello"' },
  { id: 'card', parentId: 'body', name: '<div>', args: 'class="card"' },
  { id: 'p', parentId: 'card', name: '<p>', args: '"Welcome…"' },
  { id: 'hidden', parentId: 'card', name: '<span>', args: 'class="hidden"' },
];
const INVISIBLE = ['head', 'style', 'hidden'];
const domTree = (activeId, drop = []) =>
  callTreeState(
    DOM.filter((n) => !drop.includes(n.id)).map((n) => ({ ...n, status: n.id === activeId ? 'active' : 'returned' })),
    { label: drop.length ? 'render tree' : 'DOM tree' },
  );

function* pageLoad() {
  const tokens = ['<html>', '<head>', '<style>', '<body>', '<h1>', 'Hello', '<div class="card">', '…'];
  yield {
    state: arrayState(tokens),
    highlight: { range: ['i0', 'i1', 'i2', 'i3', 'i4', 'i5', 'i6', 'i7'] },
    explanation: `A page begins as BYTES streaming over the network (see How DNS Works and TCP Handshake for the journey here). The browser tokenizes the HTML as it arrives — it does not wait for the full file — turning the character stream into a stream of ${tokens.length} tags and text tokens. Each token feeds the next stage immediately: the pipeline is a conveyor belt, not a series of batch jobs.`,
  };

  for (const step of ['html', 'body', 'card']) {
    const stepNode = DOM.find((n) => n.id === step);
    const visibleNodes = DOM.filter((n) => !INVISIBLE.includes(n.id));
    yield {
      state: domTree(step),
      highlight: { active: [step] },
      explanation: step === 'html'
        ? `Stage 1 — PARSE: ${tokens.length} tokens become the DOM, a tree of ${DOM.length} element nodes (the same parent/child shape as every tree on this site). The parser pushes open tags onto a stack and pops them on close tags — a stack validating nested structure, exactly like balanced parentheses. Active node: ${stepNode.name}.`
        : step === 'body'
          ? `Note what is IN the tree: all ${DOM.length} nodes including ${INVISIBLE.map((id) => DOM.find((n) => n.id === id).name).join(', ')} — ${INVISIBLE.length} nodes that will never produce pixels. The DOM is the document's STRUCTURE, not its appearance — JavaScript can query and mutate every one of these ${DOM.length} nodes via document.querySelector, which is just a tree search.`
          : `A wrinkle worth knowing: the tree now has ${DOM.length} nodes (${visibleNodes.length} visible, ${INVISIBLE.length} invisible: ${INVISIBLE.join(', ')}). If the parser hits a <script> tag without async/defer, it STOPS — the script might document.write new HTML, so parsing cannot safely continue. This is why "scripts at the bottom" and \`defer\` became performance gospel: a blocked parser is a blank page.`,
      invariant: 'The DOM is a tree: every node except the root has exactly one parent.',
    };
  }

  const selectors = [
    { id: 's_body', label: 'body' },
    { id: 's_h1', label: 'h1' },
    { id: 's_card', label: '.card' },
    { id: 's_hidden', label: '.hidden' },
  ];
  const cssomValues = [[16, 400, 8, 1], [32, 384, 0, 1], [16, 300, 16, 1], [16, 0, 0, 0]];
  const hiddenRow = cssomValues[3];
  yield {
    state: matrixState({
      title: 'CSSOM: every rule parsed, specificity resolved',
      rows: selectors,
      columns: [{ id: 'fs', label: 'font-size' }, { id: 'w', label: 'width' }, { id: 'pad', label: 'padding' }, { id: 'disp', label: 'display' }],
      values: cssomValues,
      format: (v) => (v === 0 ? '—' : v === 1 ? 'yes' : `${v}px`),
    }),
    highlight: { removed: ['s_hidden:disp'] },
    explanation: `Stage 2 — STYLE: in parallel, the CSS is parsed into the CSSOM and matched against the DOM. ${selectors.length} rules are resolved — for every element, the browser decides WHICH rules win (specificity, cascade order) and computes the final value of every property — inherited font sizes, percentage widths made concrete. Spot the landmine in the last row: ${selectors[3].label} carries display value ${hiddenRow[3]} (${hiddenRow[3] === 0 ? 'none' : 'block'}). That one property decides the element's entire fate in the next stage.`,
  };

  const visibleCount = DOM.length - INVISIBLE.length;
  yield {
    state: domTree(null),
    highlight: { removed: INVISIBLE },
    explanation: `Stage 3a — build the RENDER TREE: walk the DOM's ${DOM.length} nodes, attach computed styles, and DROP the ${INVISIBLE.length} that produce no pixels — ${INVISIBLE.map((id) => DOM.find((n) => n.id === id).name).join(', ')}. ${visibleCount} visible nodes survive into the tree the visual stages actually consume. (Contrast: visibility:hidden elements STAY in the render tree — they occupy space, they are just painted invisible. The two "hiding" properties diverge exactly here.)`,
  };

  const boxes = [
    { id: 'b_body', label: '<body>' },
    { id: 'b_h1', label: '<h1>' },
    { id: 'b_card', label: '<div.card>' },
    { id: 'b_p', label: '<p>' },
  ];
  const layoutValues = [[0, 0, 400, 138], [8, 8, 384, 40], [8, 56, 300, 66], [24, 72, 268, 34]];
  const viewportW = layoutValues[0][2];
  const cardW = layoutValues[2][2];
  const cardPad = cssomValues[2][2];
  const paraW = layoutValues[3][2];
  yield {
    state: matrixState({
      title: 'Layout: every box gets exact geometry (viewport 400px wide)',
      rows: boxes,
      columns: [{ id: 'x', label: 'x' }, { id: 'y', label: 'y' }, { id: 'w', label: 'width' }, { id: 'h', label: 'height' }],
      values: layoutValues,
      format: (v) => `${v}px`,
    }),
    highlight: { active: ['b_card:w', 'b_p:w'] },
    explanation: `Stage 3b — LAYOUT (a.k.a. reflow): solve for the exact position and size of every box. This is a constraint-solving pass over the whole tree: the card's ${cardW}px width caps the paragraph at ${paraW}px (${cardW} − 2×${cardPad} padding); the paragraph's text then wraps, which sets its height, which pushes everything below it down. Viewport is ${viewportW}px wide. Geometry flows DOWN and sizes bubble UP — change one box and the effects ripple. That ripple is why layout is the most expensive stage.`,
    invariant: 'Layout is global: one box\'s size can move every box after it.',
  };

  const paintCmds = ['fill body bg', 'fill card bg + border', 'draw h1 glyphs', 'draw p glyphs'];
  yield {
    state: arrayState(paintCmds),
    highlight: { sorted: ['i0', 'i1'], active: ['i2', 'i3'] },
    explanation: `Stage 4 — PAINT: turn each box into ${paintCmds.length} draw commands — fill this rectangle, stroke this border, rasterize these glyphs — executed back-to-front like a painter layering a canvas (the z-index wars are fought over this ordering). The output is bitmaps in memory, not yet on screen.`,
  };

  const layers = ['layer: page content', 'layer: (future) sticky header', 'GPU: blend layers → screen'];
  yield {
    state: arrayState(layers),
    highlight: { found: ['i2'] },
    explanation: `Stage 5 — COMPOSITE: ${layers.length - 1} painted layers are shipped to the GPU and blended into the final frame. Elements with transform or opacity animations get their OWN layer — moving one then costs only re-blending, no layout, no paint. The whole pipeline has a deadline: at 60fps you get 16.7ms per frame for JS + style + layout + paint + composite. Miss it and the page stutters. Every frontend performance technique is a scheme to skip stages — and the next view shows the classic way to accidentally re-run the worst one.`,
  };
}

function* thrash() {
  const reads = [];
  const rows = () => reads.map((r, i) => ({ id: `it${i}`, label: `iteration ${i + 1}` }));
  const planValues = [[1, 1]];
  yield {
    state: matrixState({
      title: 'The setup: a loop that grows 3 boxes to match a target',
      rows: [{ id: 'plan', label: 'per iteration' }],
      columns: [{ id: 'read', label: 'read offsetHeight' }, { id: 'write', label: 'write style.height' }],
      values: planValues,
      format: (v) => `${v}×`,
    }),
    highlight: {},
    explanation: `The pipeline is LAZY: when JavaScript writes a style, the browser just marks layout "dirty" and plans to recompute once, before the next frame. But there is a trapdoor — if JS READS a geometry property (offsetHeight, getBoundingClientRect, scrollTop) while layout is dirty, the browser must compute layout RIGHT NOW, synchronously, to give a correct answer. Each iteration does ${planValues[0][0]} read and ${planValues[0][1]} write. Now watch a loop that alternates read, write, read, write…`,
  };

  for (let i = 0; i < 3; i++) {
    reads.push([1, 1, i + 1]);
    yield {
      state: matrixState({
        title: `Forced synchronous layouts so far: ${i + 1}`,
        rows: rows(),
        columns: [{ id: 'read', label: 'read (dirty? → LAYOUT)' }, { id: 'write', label: 'write (marks dirty)' }, { id: 'forced', label: 'layouts forced' }],
        values: reads,
        format: (v) => String(v),
      }),
      highlight: { swap: [`it${i}:read`], active: [`it${i}:write`] },
      explanation: i === 0
        ? `Iteration ${i + 1}: the read finds layout clean — cheap. Then the write dirties it. The trap is armed. Accumulated reads so far: ${reads.length}.`
        : `Iteration ${i + 1}: the read arrives with layout DIRTY from the previous write, so the browser stops everything and recomputes layout for the whole tree — synchronously, inside your loop. Write dirties it again. ${reads.length} accumulated reads, ${i + 1} forced layouts where 1 would do — this is LAYOUT THRASHING.`,
      invariant: 'A geometry read while layout is dirty forces a full synchronous layout.',
    };
  }

  const batchValues = [[1], [0]];
  yield {
    state: matrixState({
      title: 'Fix 1 — batch: all reads first, then all writes',
      rows: [{ id: 'reads', label: 'phase 1: 3 reads' }, { id: 'writes', label: 'phase 2: 3 writes' }],
      columns: [{ id: 'forced', label: 'layouts forced' }],
      values: batchValues,
      format: (v) => String(v),
    }),
    highlight: { found: ['reads:forced', 'writes:forced'] },
    explanation: `The fix is reordering, not less work: do ALL the reads (layout computes once — ${batchValues[0][0]} forced layout for the read phase — then stays clean for the remaining reads), then ALL the writes (each just re-dirties the same flag — ${batchValues[1][0]} forced layouts for the write phase, the browser coalesces them into ONE layout before the next frame). Same operations, ${reads.length} layouts → ${batchValues[0][0]}. Libraries like FastDOM and React's batched DOM updates are this exact idea institutionalized.`,
  };

  const skipValues = [[1, 1, 1], [0, 0, 1]];
  yield {
    state: matrixState({
      title: 'Fix 2 — skip layout entirely: animate transform/opacity',
      rows: [{ id: 'height', label: 'animate height' }, { id: 'transform', label: 'animate transform' }],
      columns: [{ id: 'layout', label: 'layout' }, { id: 'paint', label: 'paint' }, { id: 'composite', label: 'composite' }],
      values: skipValues,
      format: (v) => (v ? 'runs' : 'skipped'),
    }),
    highlight: { found: ['transform:layout', 'transform:paint'], active: ['transform:composite'] },
    explanation: `The deeper win: choose properties that enter the pipeline LATE. Animating height runs ${skipValues[0].filter((v) => v).length} of 3 stages (layout + paint + composite) every frame; animating transform: translateY() runs only ${skipValues[1].filter((v) => v).length} (composite) — layout ${skipValues[1][0] ? 'runs' : 'skipped'}, paint ${skipValues[1][1] ? 'runs' : 'skipped'}. The element already lives on its own GPU layer, so the browser just re-blends. That is why smooth UIs animate transform and opacity and almost nothing else, and why a janky animation is usually a layout property in disguise. DevTools's Performance panel paints forced layouts as angry purple — now you know exactly what it is accusing your code of.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'a page load, HTML to pixels') yield* pageLoad();
  else if (view === 'the layout-thrash trap') yield* thrash();
  else throw new InputError('Pick a view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The visualization has two views, selected at the top. The "page load" view walks the full five-stage pipeline from raw HTML tokens to composited pixels. The "layout-thrash trap" view isolates the single most common performance bug in frontend code and shows why it is expensive.',
        'In the page-load view, each frame advances one pipeline stage. The first frame shows 8 HTML tokens arriving as an array. The next three frames build the DOM tree node by node, highlighting invisible nodes that will be pruned later. The CSSOM matrix shows 4 selectors with their computed property values, and the highlighted removal of the display:none row explains why the render tree is smaller than the DOM. The layout matrix is the first frame where every box gets exact pixel coordinates. Paint and composite finish the journey to the screen.',
        {type: 'image', src: './assets/gifs/browser-rendering.gif', alt: 'Animated walkthrough of the browser rendering visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'In the layout-thrash view, track the implicit dirty flag. Each style write marks layout dirty. Each geometry read (offsetHeight, getBoundingClientRect) that arrives while layout is dirty forces the browser to synchronously recompute layout inside your JavaScript loop. The fix frames show two remedies: batching all reads before all writes, and choosing compositor-only properties like transform and opacity that skip layout entirely.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A browser receives a stream of bytes -- HTML, CSS, images, fonts, scripts -- and must produce pixels on screen while the user is already watching. The hard part is not doing this once; it is doing it again every time something changes, 60 times per second during animation, without the user seeing a stutter.',
        {
          type: 'callout',
          text: 'Browser rendering is a staged dependency graph: each change is expensive only to the stages it invalidates.',
        },
        'The rendering pipeline is the engine\'s answer. It breaks the work into five stages -- parse, style, layout, paint, composite -- each producing a more concrete representation than the last. Frontend performance boils down to one question: which stages does your change force the browser to re-run?',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The simplest mental model treats rendering as a single function: give it the DOM, get back pixels. Under this model, any change to the page means recomputing everything from scratch. This is how early browsers actually worked -- Netscape\'s rendering engine would rebuild the entire page layout whenever the DOM changed.',
        'For a static page loaded once, this works fine. The browser parses the HTML, applies the CSS, computes geometry, paints, and the user sees the result. The cost is paid once during load, and nobody notices. Most tutorials stop here because the pipeline is easy to understand as a one-shot process.',
        'This model also makes JavaScript interaction straightforward to reason about. Change a style? Recompute everything. Add a node? Recompute everything. The programmer does not need to think about which stages are affected because the answer is always "all of them."',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The one-shot model collapses the moment the page is interactive. At 60fps, the browser has 16.67ms per frame for all work: running JavaScript, recalculating styles, computing layout, painting, and compositing. A full pipeline run on a page with 1,000 DOM nodes can easily take 10-15ms. If JavaScript triggers two full pipeline runs per frame, the budget is blown and the page stutters.',
        'The specific invariant that breaks is: a geometry read must return a value consistent with all prior writes. If your JavaScript writes element.style.height = "200px" and then reads element.offsetHeight, the browser cannot return the old height. It must synchronously run layout right now, inside your script, to produce the correct answer. This is called a forced synchronous layout.',
        'A loop that alternates write-read-write-read forces N full layouts instead of 1. With 100 elements, that is 100 layouts in a single frame where the browser planned to do one. The frame takes 100x longer than it should. This is layout thrashing, and it is the wall that separates pages that feel smooth from pages that feel broken.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The pipeline is a dependency graph, not a monolithic function. Each stage depends on specific earlier stages, and changes only invalidate downstream. If you change text content, the browser must re-run layout (text reflows) and paint (new glyphs), but it does not need to re-parse CSS or rebuild the CSSOM. If you change background-color, layout can be skipped entirely because no geometry changed -- only paint and composite run. If you animate transform or opacity on a composited layer, even paint is skipped -- only the compositor re-blends existing bitmaps.',
        {
          type: 'image',
          src: 'https://developer.chrome.com/static/docs/chromium/renderingng/image/sketch-the-different-ele-d9f18c1bd6186.jpg',
          alt: 'Chromium RenderingNG pipeline sketch showing script style layout paint composite raster and draw',
          caption: 'RenderingNG separates main-thread work, compositor work, raster, and final drawing. Source: Chrome for Developers, https://developer.chrome.com/docs/chromium/renderingng.',
        },
        'This is why the pipeline exists as separate stages rather than one function. The browser can be lazy: it marks stages dirty when a change occurs but delays recomputation until the next frame. Multiple DOM writes between two frames dirty the same stages, but the browser runs each stage only once. The entire performance model rests on this deferred-batch-invalidation design.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Stage 1, Parse: the browser tokenizes HTML as bytes arrive over the network (it does not wait for the full file). Each token -- an opening tag, a closing tag, a text node -- feeds a stack-based tree builder. Open tags push onto the stack and become children of the current top; close tags pop. The result is the DOM tree, a tree data structure where every node except the root has exactly one parent. A document with 8 tags and text nodes becomes a tree of 8 nodes. If the parser hits a <script> tag without async or defer, it stops and hands control to JavaScript, because the script might call document.write() and inject new HTML. This is why scripts at the bottom of <body> became standard advice: a blocked parser means a blank screen.',
        'Stage 2, Style: the CSS is parsed into the CSSOM (CSS Object Model), a parallel tree of style rules. The browser matches selectors against DOM nodes and resolves the cascade -- specificity, source order, !important -- to compute a final value for every property on every element. Percentages become concrete values relative to the parent, inherited properties propagate down the tree. For a page with 4 CSS rules and 8 DOM nodes, this produces a matrix of computed values: each row is a selector, each column is a property, each cell is the resolved value in pixels or keywords.',
        'Stage 3, Layout (also called reflow): the browser walks the render tree -- the DOM minus invisible nodes like display:none elements and <head> -- and solves for exact geometry. Each box gets an x, y, width, and height in pixels. This is a constraint problem: a parent\'s width constrains its children, but children\'s content height determines the parent\'s height. Sizes flow down, heights bubble up. Change one box and every subsequent sibling and ancestor may shift. Layout is the most expensive stage because its effects are global.',
        'Stage 4, Paint: each laid-out box becomes a sequence of draw commands -- fill this rectangle with a background color, stroke this border, rasterize these text glyphs at these coordinates. Commands execute back-to-front (the painter\'s algorithm), and z-index determines ordering. The output is bitmaps in memory, not yet on screen.',
        'Stage 5, Composite: the browser splits the page into layers. Elements with transform, opacity, will-change, or certain other properties get their own GPU-backed layer. The compositor takes all painted layers and blends them into the final frame. Moving a composited layer means re-blending, not re-painting or re-laying-out. This is why transform animations are cheap and height animations are expensive.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The pipeline works because each stage refines the representation toward pixels. Bytes become tokens. Tokens become a tree. Rules become computed styles. Styled nodes become geometry. Geometry becomes draw commands. Draw commands become bitmaps. Bitmaps become pixels on glass. No stage needs to understand the full picture; it only needs the output of the stage before it.',
        'The performance model works because invalidation is selective. The browser tracks which stages are dirty and skips clean ones. If JavaScript makes 50 DOM writes in a single event handler, the browser does not run layout 50 times. It marks layout dirty on the first write and ignores the flag on subsequent writes. Before the next frame, it runs layout once. This batching is automatic and free -- unless your code forces the browser\'s hand by reading geometry between writes.',
        'Compositing works because the GPU is a parallel blending machine. Once a layer is painted to a bitmap, moving it, fading it, or rotating it costs only a texture upload and a matrix multiply on the GPU -- operations that take microseconds. The main thread is not involved. This is why compositor-only animations (transform, opacity) can run at 60fps even while JavaScript is busy on the main thread.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Parse is O(n) in document size and runs once on load. Re-parsing is rare; the HTML parser is a streaming state machine that produces DOM nodes incrementally. Style computation is O(n * s) where n is DOM nodes and s is CSS rules, because each rule must be tested against each node. Modern engines use bloom filters and rule hashing to avoid the full cross-product, but complex selectors (descendant combinators, :nth-child) still cost more than simple class selectors.',
        'Layout is the expensive stage. In the worst case it is O(n) over the entire render tree, because changing one node\'s height can shift every node below it. In practice, browsers use incremental layout to limit work to dirty subtrees, but forced synchronous layout defeats this optimization by demanding a full recomputation immediately. A loop that forces layout k times costs O(k * n) instead of O(n).',
        'Paint cost depends on the number of pixels invalidated and the complexity of drawing operations (gradients, shadows, and text rendering are expensive). Composite cost depends on the number of layers and their total pixel area -- each layer consumes GPU memory (a 1920x1080 layer at 4 bytes/pixel is about 8MB). Too many layers can exhaust GPU memory or slow down the compositor itself.',
        'The practical budget at 60fps is 16.67ms per frame. A typical breakdown: JavaScript 0-6ms, style recalc 1-2ms, layout 1-4ms, paint 1-3ms, composite 0.5-1ms. If any single stage exceeds the remaining budget, the frame drops. DevTools\' Performance panel breaks down each frame into these stages so you can see exactly which one is the bottleneck.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'React, Vue, and other virtual DOM frameworks exist largely to batch DOM writes and avoid layout thrashing. React collects all state changes, diffs a virtual tree, and applies the minimal set of DOM mutations in one batch before yielding to the browser. The browser then runs style, layout, paint, and composite once for the entire batch. This is the batching principle applied at the framework level.',
        'CSS animations and transitions on transform/opacity are the standard technique for smooth UI motion. Dropdown menus, modals, page transitions, and scroll-linked effects all use compositor-only properties to avoid main-thread work. The will-change CSS property hints the browser to promote an element to its own layer before the animation starts, avoiding a layout spike on the first frame.',
        'Virtual scrolling (used by large lists in Slack, Twitter, and VS Code) keeps only visible rows in the DOM. A list of 10,000 items renders maybe 30 DOM nodes and swaps their content as the user scrolls. This keeps layout cost proportional to the viewport, not the data size. Content-visibility: auto achieves a similar effect by telling the browser to skip layout and paint for off-screen sections entirely.',
        'requestAnimationFrame (rAF) lets JavaScript schedule work just before the browser\'s next render. Writes inside rAF execute, then the browser runs style-layout-paint-composite as one batch. This is the correct place to make visual DOM changes. setTimeout or setInterval writes can fire at arbitrary times, potentially splitting reads and writes across frame boundaries.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The five-stage model is a teaching simplification. Real engines have preload scanners (which look ahead in HTML for resources to fetch while the parser is blocked on a script), style sharing (which reuses computed styles for siblings with identical rules), incremental layout (which tries to recompute only dirty subtrees), display lists, damage tracking, raster worker threads, GPU process isolation, and dozens of heuristics. The stages are accurate as a mental model, but the actual code path in Chromium\'s RenderingNG is far more complex.',
        'Layout thrashing is the most common failure, but not the only one. Animating layout properties like height, width, top, or left forces layout+paint+composite on every frame. Inserting thousands of DOM nodes without virtualizing forces massive layout. Complex CSS selectors (e.g., .parent > .child:nth-child(3n+1)) can make style recalculation expensive. Font loading that changes glyph metrics triggers a layout shift after the page appears stable. Excessive layer promotion (too many will-change declarations) wastes GPU memory and can make compositing itself the bottleneck.',
        'The model also cannot help with main-thread contention. Web Workers can offload CPU-heavy JavaScript, but they cannot touch the DOM. Any visual change must eventually return to the main thread and pass through the rendering pipeline. A 200ms JavaScript task blocks the entire pipeline for 200ms -- that is 12 dropped frames at 60fps, regardless of how well-optimized the CSS is.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'The demo page has 8 DOM nodes: <html>, <head>, <style> (with 4 CSS rules), <body>, <h1> ("Hello"), <div class="card">, <p> ("Welcome..."), and <span class="hidden">. The DOM tree includes all 8 because the DOM represents document structure, not visual output.',
        'Style computation resolves 4 selectors. The body gets font-size 16px, width 400px, padding 8px. The h1 gets font-size 32px, width 384px (400 - 2*8 body padding). The .card gets font-size 16px, width 300px, padding 16px. The .hidden span gets display: none -- this single property removes it from the render tree entirely. After pruning, 5 nodes survive (all 8 minus <head>, <style>, and the hidden span).',
        'Layout runs on the 5-node render tree with a 400px viewport. The body box is at (0, 0) with width 400px and height 138px. The h1 box is at (8, 8) -- offset by body padding -- with width 384px and height 40px. The card starts at (8, 56) with width 300px. The paragraph inside the card is at (24, 72) with width 268px (300 - 2*16 card padding) and height 34px. If the paragraph\'s text were longer and wrapped to a second line, its height would increase, pushing the card\'s height up, and anything below the card would shift down. That cascading recalculation is why layout is expensive.',
        'Now consider layout thrashing. Suppose JavaScript loops over 3 boxes, reading offsetHeight then writing style.height on each iteration. Iteration 1: layout is clean, so the read is cheap (no forced layout). The write marks layout dirty. Iteration 2: the read finds layout dirty, so the browser stops and runs a full synchronous layout to return the correct offsetHeight. The write dirties it again. Iteration 3: same forced layout. Total: 3 forced layouts where 1 would suffice. The fix: read all 3 heights first (1 layout, then stays clean for remaining reads), then write all 3 heights (each just re-dirties the same flag, browser coalesces into 1 layout before the next frame). Same operations, 3 layouts reduced to 1.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'MDN\'s critical rendering path guide covers parse-to-pixel in detail: https://developer.mozilla.org/en-US/docs/Web/Performance/Guides/Critical_rendering_path. MDN\'s "How browsers work" adds navigation and network context: https://developer.mozilla.org/en-US/docs/Web/Performance/Guides/How_browsers_work. web.dev covers rendering performance at https://web.dev/articles/rendering-performance and compositor-friendly animations at https://web.dev/articles/animations-guide. Chrome documents forced reflow triggers at https://developer.chrome.com/docs/performance/insights/forced-reflow. The RenderingNG architecture is detailed at https://developer.chrome.com/docs/chromium/renderingng.',
        'For prerequisites, study Tree Traversals (the DOM is a tree) and Stack (the parser uses a stack). For the JavaScript execution model that interleaves with rendering, study The Event Loop, requestAnimationFrame Frame Budget, and PerformanceObserver Long Task Attribution. For what comes after rendering, study Virtual DOM Reconciliation (how frameworks batch DOM writes), Dirty Rectangle Damage Tracking (how engines minimize repaint area), and WebGPU Swapchain Frame Pacing (how GPU-driven rendering manages frame delivery).',
      ],
    },
  ],
};

