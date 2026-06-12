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
      heading: `What it is`,
      paragraphs: [
        `A browser turns bytes into pixels through a pipeline: parse HTML into the DOM, parse CSS into style rules, build the render tree, compute layout, paint draw commands, and composite layers onto the screen. The visualization starts after How DNS Works and TCP: Handshake & Congestion Control have delivered the bytes. From there, every performance trick is about skipping stages or batching work so the browser does not repeat an expensive pass.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Parsing is a Stack-shaped tree builder: opening tags push, closing tags pop, and the DOM forms as tokens stream in. Tree Traversals explains the later walks over that structure. CSS is matched against the DOM to compute final styles; in the demo, .hidden gets display:none, so it is dropped from the render tree. By contrast, visibility:hidden would still reserve layout space.`,
        `Layout assigns every visible box x, y, width, and height. The demo uses a 400px viewport and a 300px card, so 16px padding on both sides leaves the paragraph 268px wide. Text wrapping changes height, which can move later boxes. Paint turns boxes into draw commands, and compositing blends layers. At 60 fps the whole page has about 16.7 ms for The Event Loop, style, layout, paint, and composite together.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Parsing is roughly O(bytes). Style and layout scale with the number of affected nodes and rules, but layout can become global because one changed size can move everything after it. Paint scales with draw commands and pixels. The second visualization shows the classic footgun: write style.height, then read offsetHeight, then write again. A geometry read while layout is dirty forces synchronous layout inside your JavaScript loop. Three read-write iterations create three layouts where one batched pass would do.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Smooth animation usually means changing transform or opacity, because those properties can be handled by the compositor without rerunning layout or paint. Animating height does the opposite. Virtual DOM Reconciliation and other UI libraries batch DOM writes so layout happens once. Virtual scrolling keeps huge lists from becoming huge DOMs. CSS containment and content-visibility can fence off parts of a page so unrelated layout work does not spread as far. Web Workers: A Second Thread helps when the slow part is CPU work, but workers cannot touch the DOM, so final visual updates still return to the main thread.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `Do not assume JavaScript is the only bottleneck. A page can have fast code and still stall in layout or paint. Do not treat display:none and visibility:hidden as equivalent. Do not read geometry after every write. Batch reads first, then writes; or choose compositor-only properties. DevTools Performance traces make this visible by marking forced layout, paint, and long tasks separately. Measure the stage that is slow before optimizing the wrong layer.`,
        `Service Workers & Offline-First and CDN Request Flow can make bytes arrive faster, but they cannot rescue a page that spends 80 ms laying itself out after the file arrives. Frontend performance is the full path from URL to pixels, not just network latency.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study Tree Traversals and Stack for the parser and DOM walks, then The Event Loop for when rendering gets a turn. How DNS Works, TCP: Handshake & Congestion Control, and CDN Request Flow cover the network path before parsing. Virtual DOM Reconciliation shows why UI libraries batch writes against this exact pipeline.`,
      ],
    },
  ],
};
