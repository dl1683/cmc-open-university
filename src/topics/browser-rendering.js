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
  yield {
    state: arrayState(['<html>', '<head>', '<style>', '<body>', '<h1>', 'Hello', '<div class="card">', '…']),
    highlight: { range: ['i0', 'i1', 'i2', 'i3', 'i4', 'i5', 'i6', 'i7'] },
    explanation: 'A page begins as BYTES streaming over the network (see How DNS Works and TCP Handshake for the journey here). The browser tokenizes the HTML as it arrives — it does not wait for the full file — turning the character stream into a stream of tags and text. Each token feeds the next stage immediately: the pipeline is a conveyor belt, not a series of batch jobs.',
  };

  for (const step of ['html', 'body', 'card']) {
    yield {
      state: domTree(step),
      highlight: { active: [step] },
      explanation: step === 'html'
        ? 'Stage 1 — PARSE: tokens become the DOM, a tree of element nodes (the same parent/child shape as every tree on this site). The parser pushes open tags onto a stack and pops them on close tags — a stack validating nested structure, exactly like balanced parentheses.'
        : step === 'body'
          ? 'Note what is IN the tree: <head> and <style> are real DOM nodes even though they will never produce pixels. The DOM is the document\'s STRUCTURE, not its appearance — JavaScript can query and mutate every one of these nodes via document.querySelector, which is just a tree search.'
          : 'A wrinkle worth knowing: if the parser hits a <script> tag without async/defer, it STOPS — the script might document.write new HTML, so parsing cannot safely continue. This is why "scripts at the bottom" and `defer` became performance gospel: a blocked parser is a blank page.',
      invariant: 'The DOM is a tree: every node except the root has exactly one parent.',
    };
  }

  const selectors = [
    { id: 's_body', label: 'body' },
    { id: 's_h1', label: 'h1' },
    { id: 's_card', label: '.card' },
    { id: 's_hidden', label: '.hidden' },
  ];
  yield {
    state: matrixState({
      title: 'CSSOM: every rule parsed, specificity resolved',
      rows: selectors,
      columns: [{ id: 'fs', label: 'font-size' }, { id: 'w', label: 'width' }, { id: 'pad', label: 'padding' }, { id: 'disp', label: 'display' }],
      values: [[16, 400, 8, 1], [32, 384, 0, 1], [16, 300, 16, 1], [16, 0, 0, 0]],
      format: (v) => (v === 0 ? '—' : v === 1 ? 'yes' : `${v}px`),
    }),
    highlight: { removed: ['s_hidden:disp'] },
    explanation: 'Stage 2 — STYLE: in parallel, the CSS is parsed into the CSSOM and matched against the DOM. For every element, the browser resolves WHICH rules win (specificity, cascade order) and computes the final value of every property — inherited font sizes, percentage widths made concrete. Spot the landmine in the last row: .hidden carries display:none. That one property decides the element\'s entire fate in the next stage.',
  };

  yield {
    state: domTree(null),
    highlight: { removed: INVISIBLE },
    explanation: 'Stage 3a — build the RENDER TREE: walk the DOM, attach computed styles, and DROP everything that produces no pixels — <head>, <style>, and our display:none span. This is the tree the visual stages actually consume. (Contrast: visibility:hidden elements STAY in the render tree — they occupy space, they are just painted invisible. The two "hiding" properties diverge exactly here.)',
  };

  const boxes = [
    { id: 'b_body', label: '<body>' },
    { id: 'b_h1', label: '<h1>' },
    { id: 'b_card', label: '<div.card>' },
    { id: 'b_p', label: '<p>' },
  ];
  yield {
    state: matrixState({
      title: 'Layout: every box gets exact geometry (viewport 400px wide)',
      rows: boxes,
      columns: [{ id: 'x', label: 'x' }, { id: 'y', label: 'y' }, { id: 'w', label: 'width' }, { id: 'h', label: 'height' }],
      values: [[0, 0, 400, 138], [8, 8, 384, 40], [8, 56, 300, 66], [24, 72, 268, 34]],
      format: (v) => `${v}px`,
    }),
    highlight: { active: ['b_card:w', 'b_p:w'] },
    explanation: 'Stage 3b — LAYOUT (a.k.a. reflow): solve for the exact position and size of every box. This is a constraint-solving pass over the whole tree: the card\'s 300px width caps the paragraph at 268px (300 − 2×16 padding); the paragraph\'s text then wraps, which sets its height, which pushes everything below it down. Geometry flows DOWN and sizes bubble UP — change one box and the effects ripple. That ripple is why layout is the most expensive stage.',
    invariant: 'Layout is global: one box\'s size can move every box after it.',
  };

  yield {
    state: arrayState(['fill body bg', 'fill card bg + border', 'draw h1 glyphs', 'draw p glyphs']),
    highlight: { sorted: ['i0', 'i1'], active: ['i2', 'i3'] },
    explanation: 'Stage 4 — PAINT: turn each box into actual draw commands — fill this rectangle, stroke this border, rasterize these glyphs — executed back-to-front like a painter layering a canvas (the z-index wars are fought over this ordering). The output is bitmaps in memory, not yet on screen.',
  };

  yield {
    state: arrayState(['layer: page content', 'layer: (future) sticky header', 'GPU: blend layers → screen']),
    highlight: { found: ['i2'] },
    explanation: 'Stage 5 — COMPOSITE: painted layers are shipped to the GPU and blended into the final frame. Elements with transform or opacity animations get their OWN layer — moving one then costs only re-blending, no layout, no paint. The whole pipeline has a deadline: at 60fps you get 16.7ms per frame for JS + style + layout + paint + composite. Miss it and the page stutters. Every frontend performance technique is a scheme to skip stages — and the next view shows the classic way to accidentally re-run the worst one.',
  };
}

function* thrash() {
  const reads = [];
  const rows = () => reads.map((r, i) => ({ id: `it${i}`, label: `iteration ${i + 1}` }));
  yield {
    state: matrixState({
      title: 'The setup: a loop that grows 3 boxes to match a target',
      rows: [{ id: 'plan', label: 'per iteration' }],
      columns: [{ id: 'read', label: 'read offsetHeight' }, { id: 'write', label: 'write style.height' }],
      values: [[1, 1]],
      format: (v) => `${v}×`,
    }),
    highlight: {},
    explanation: 'The pipeline is LAZY: when JavaScript writes a style, the browser just marks layout "dirty" and plans to recompute once, before the next frame. But there is a trapdoor — if JS READS a geometry property (offsetHeight, getBoundingClientRect, scrollTop) while layout is dirty, the browser must compute layout RIGHT NOW, synchronously, to give a correct answer. Now watch a loop that alternates read, write, read, write…',
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
        ? 'Iteration 1: the read finds layout clean — cheap. Then the write dirties it. The trap is armed.'
        : `Iteration ${i + 1}: the read arrives with layout DIRTY from the previous write, so the browser stops everything and recomputes layout for the whole tree — synchronously, inside your loop. Write dirties it again. This read-write-read-write rhythm is LAYOUT THRASHING: ${i + 1} full layouts where one would do.`,
      invariant: 'A geometry read while layout is dirty forces a full synchronous layout.',
    };
  }

  yield {
    state: matrixState({
      title: 'Fix 1 — batch: all reads first, then all writes',
      rows: [{ id: 'reads', label: 'phase 1: 3 reads' }, { id: 'writes', label: 'phase 2: 3 writes' }],
      columns: [{ id: 'forced', label: 'layouts forced' }],
      values: [[1], [0]],
      format: (v) => String(v),
    }),
    highlight: { found: ['reads:forced', 'writes:forced'] },
    explanation: 'The fix is reordering, not less work: do ALL the reads (layout computes once, then stays clean for the remaining reads), then ALL the writes (each just re-dirties the same flag — the browser coalesces them into ONE layout before the next frame). Same operations, 3 layouts → 1. Libraries like FastDOM and React\'s batched DOM updates are this exact idea institutionalized.',
  };

  yield {
    state: matrixState({
      title: 'Fix 2 — skip layout entirely: animate transform/opacity',
      rows: [{ id: 'height', label: 'animate height' }, { id: 'transform', label: 'animate transform' }],
      columns: [{ id: 'layout', label: 'layout' }, { id: 'paint', label: 'paint' }, { id: 'composite', label: 'composite' }],
      values: [[1, 1, 1], [0, 0, 1]],
      format: (v) => (v ? 'runs' : 'skipped'),
    }),
    highlight: { found: ['transform:layout', 'transform:paint'], active: ['transform:composite'] },
    explanation: 'The deeper win: choose properties that enter the pipeline LATE. Animating height re-runs layout + paint + composite every frame; animating transform: translateY() touches only the compositor — the element already lives on its own GPU layer, so the browser just re-blends. That is why smooth UIs animate transform and opacity and almost nothing else, and why a janky animation is usually a layout property in disguise. DevTools\' Performance panel paints forced layouts as angry purple — now you know exactly what it is accusing your code of.',
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
      heading: 'The problem',
      paragraphs: [
        'A browser has to turn a stream of HTML, CSS, images, fonts, and JavaScript into pixels while the user is waiting. The hard part is that the page is not static. JavaScript can change the DOM, CSS can change which nodes are visible, text can wrap differently after a font arrives, and the user expects scrolling and animation to keep running at frame rate.',
        'The rendering pipeline is the browser answer to that problem. It breaks the work into parse, style, layout, paint, and composite stages. Frontend performance is mostly the art of avoiding repeated work in the expensive stages, especially layout and paint.',
      ],
    },
    {
      heading: 'Context',
      paragraphs: [
        'This topic starts after the network topics have delivered bytes to the browser. How DNS Works, TCP: Handshake & Congestion Control, CDN Request Flow, and Resource Hints explain how resources arrive. Browser rendering explains what the engine does once it has enough input to begin building a page.',
        'The same pipeline also explains UI jank. The Event Loop decides when JavaScript runs. requestAnimationFrame gives code a chance to update before a frame. PerformanceObserver Long Task Attribution tells you when code blocks the main thread. But a page can still stutter even when JavaScript is short if style, layout, paint, or compositing work exceeds the frame budget.',
      ],
    },
    {
      heading: 'Core idea',
      paragraphs: [
        'The core idea is a dependency graph from document structure to pixels. HTML creates the DOM tree. CSS creates style rules and computed values. The render tree keeps the visible styled boxes. Layout assigns geometry. Paint records drawing commands. Compositing blends painted layers into the final frame.',
        'Each later stage depends on some earlier stage, but not every change invalidates the whole pipeline. Changing text content can require layout and paint. Changing `background-color` can usually skip layout but still paint. Changing `transform` or `opacity` on a composited layer can often skip layout and paint and only ask the compositor to blend layers differently.',
      ],
    },
    {
      heading: 'Mechanism',
      paragraphs: [
        'Parsing is a stack-shaped tree-building process. Opening tags push, closing tags pop, and DOM nodes become parents and children. CSS parsing and selector matching compute styles for those nodes. The engine then filters out nodes that produce no boxes, such as `display: none`, before layout assigns each remaining box an exact position and size.',
        'Layout is where relative declarations become geometry: percentages become pixels, text wraps, children influence parent height, and later boxes may move. Paint converts geometry and style into drawing commands such as fill this background, draw this border, and rasterize these glyphs. Compositing takes painted layers, often including GPU-backed layers, and produces the final screen image.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'The demo page contains `<html>`, `<head>`, `<style>`, `<body>`, an `<h1>`, a card `<div>`, a paragraph, and a hidden span. The DOM includes all of them because the DOM is document structure, not only visible output. The render tree drops `<head>`, `<style>`, and the `display: none` span because they do not create visible boxes.',
        'In the layout frame, the viewport is 400px wide. The card is 300px wide with 16px padding on both sides, so the paragraph has 268px of content width. If the paragraph wraps onto more lines, the paragraph becomes taller, the card becomes taller, and everything below the card may move. That is why a small style change can become a page-wide geometry update.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The pipeline works because each stage gives the next stage a more concrete representation. Bytes become tokens. Tokens become nodes. Rules become computed styles. Styled boxes become geometry. Geometry and style become draw commands. Draw commands become pixels.',
        'The performance model works because invalidation can be narrower than a full reload. The browser can batch many DOM writes and run layout once before the next frame. It can repaint only damaged regions in some cases. It can animate compositor-friendly properties without recalculating layout. Good UI code cooperates with those boundaries instead of forcing the engine to cross them repeatedly.',
      ],
    },
    {
      heading: 'Animation guide',
      paragraphs: [
        'In the page-load view, read left to right as a pipeline. The first array is the incoming HTML token stream. The tree frames show DOM construction, including nodes that will never paint. The CSS matrix shows computed values, and the removed `display: none` row explains why the render tree is smaller than the DOM. The layout matrix is the first moment where boxes get exact coordinates.',
        'In the layout-thrash view, watch the dirty-layout flag even though it is not drawn as a separate variable. A style write marks layout dirty. A later geometry read such as `offsetHeight` needs a correct answer immediately, so the browser synchronously runs layout inside the JavaScript loop. The fix frames show the two real remedies: batch reads before writes, or choose properties such as `transform` and `opacity` that enter late in the pipeline.',
      ],
    },
    {
      heading: 'Tradeoffs',
      paragraphs: [
        'The browser pipeline is a huge win because it separates concerns and lets engines skip work. The cost is that performance is now stage-specific. A program can have efficient JavaScript and still be slow because it forces layout, paints too many pixels, creates too many layers, or invalidates style across a large subtree.',
        'Compositor-only animation is also a tradeoff, not a universal rule. Extra layers consume memory and can increase upload or blending cost. CSS containment and `content-visibility` can fence work, but they also change how the browser reasons about layout and visibility. The right optimization depends on the stage that profiling shows is actually slow.',
      ],
    },
    {
      heading: 'Limits',
      paragraphs: [
        'The five-stage model is a teaching model. Real engines have preload scanners, style sharing, incremental layout, display lists, damage tracking, raster worker threads, GPU processes, font loading rules, async scrolling paths, and many heuristics. The stages are still useful, but browser internals are not one simple function call per stage.',
        'The model also does not erase main-thread constraints. Web Workers can move CPU work away from the main thread, but they cannot directly mutate the DOM. Eventually visual changes return to the rendering pipeline. Service workers and CDNs can make resources arrive faster, but they cannot rescue a page that spends too long laying itself out after arrival.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'The classic failure mode is layout thrashing: code alternates writes that dirty layout with reads that demand fresh geometry. The browser cannot safely return an old `getBoundingClientRect` or `offsetHeight`, so it does the expensive work immediately and repeatedly.',
        'Other failures include animating layout properties such as `height`, inserting thousands of DOM nodes instead of virtualizing, using selectors or style invalidations that touch too much of the tree, loading fonts in a way that shifts layout, and treating `display: none` and `visibility: hidden` as equivalent. They diverge exactly because one removes a box from layout and the other leaves the box in place.',
      ],
    },
    {
      heading: 'Practical use',
      paragraphs: [
        'When a page janks, profile first. If the trace shows long JavaScript tasks, reduce work or move safe computation off-thread. If it shows forced layout, batch reads before writes. If it shows paint cost, reduce invalidated pixels, expensive effects, and overdraw. If animation is the problem, prefer `transform` and `opacity` where the visual design allows it.',
        'UI frameworks, virtual DOM reconciliation, requestAnimationFrame scheduling, virtual scrolling, CSS containment, and image lazy-loading are all practical ways of cooperating with the same pipeline. The goal is not to memorize one trick. The goal is to know which stage you are making the browser repeat.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        "MDN's critical rendering path guide covers the path from HTML, CSS, and JavaScript to pixels: https://developer.mozilla.org/en-US/docs/Web/Performance/Guides/Critical_rendering_path. MDN's browser overview adds the broader navigation-to-rendering context: https://developer.mozilla.org/en-US/docs/Web/Performance/Guides/How_browsers_work. web.dev covers rendering performance and compositor-friendly animations at https://web.dev/articles/rendering-performance and https://web.dev/articles/animations-guide. Chrome documents forced reflow at https://developer.chrome.com/docs/performance/insights/forced-reflow.",
        'Study Tree Traversals and Stack for parsing, then The Event Loop, Promise Microtask Queue, requestAnimationFrame Frame Budget, Browser Scheduler postTask Priority Queue, requestIdleCallback Idle Deadline Queue, and PerformanceObserver Long Task Attribution for when rendering work gets a turn. Virtual DOM Reconciliation, Dirty Rectangle Damage Tracking, OffscreenCanvas Worker Renderer, WebGPU Swapchain Frame Pacing, and Render Graph Framegraph Resource Lifetimes continue the path from changed UI state to bounded paint and GPU work.',
      ],
    },
  ],
};
