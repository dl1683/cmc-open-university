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
        `A browser is a five-stage pipeline. HTML arrives as bytes from the network, gets tokenized and parsed into a DOM tree (parent-child structure like every tree on this site), matched against CSS rules and styled, solved for exact layout geometry, painted into draw commands, and finally composited onto your screen — all five stages, every frame, to turn text and styling into pixels. Understanding this pipeline is how every "make my page faster" technique works. Skip a stage and you save milliseconds. Run a stage you did not mean to and you stutter the frame rate.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Parse: the tokenizer chops HTML into tags and text, feeding them to a parser that pushes opening tags onto a stack and pops them on close tags — exactly the balanced-parentheses validation from other tree topics. As soon as a tag closes, the node joins the DOM tree; the browser does not wait for the full file. One landmine: if the parser hits a \`<script>\` tag without \`async\` or \`defer\`, it stops dead — scripts can call \`document.write\`, so parsing must pause. This is why "scripts at the bottom" became performance gospel. Meanwhile, CSS gets parsed into the CSSOM (style object model).`,
        `Style: the browser walks every DOM node, applies CSS rules, and resolves specificity battles. Each property gets a final computed value. In the visualization, the .hidden element gets display:none — that one property decides it vanishes from the next stage.`,
        `Layout: solve for exact geometry. Every box gets x, y, width, height. The card is 300px wide, so the paragraph inside shrinks to 268px (300 minus 2×16 padding). Text wraps, setting the paragraph's height, which pushes everything below it down. Change one box and ripples cascade through the tree. This is the most expensive stage.`,
        `Paint and composite: turn geometry into draw commands (fill rectangles, rasterize text), executed back-to-front like a painter layering canvas. Finally, ship layers to the GPU and blend them into the frame. A 60fps page gets 16.7ms per frame for all five stages plus JavaScript.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Parsing is O(N) where N is HTML bytes. Layout is O(DOM nodes) because every node might move — it is the bottleneck. Paint is O(draw commands). Memory: the DOM tree lives in RAM (a few MB for typical pages; JavaScript can read and mutate any node, so trees persist until the page dies). The render tree is ephemeral, recomputed each layout run. Most pages keep DOM node counts under 10,000; a million-node page will stutter on mobile devices.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Animations use \`transform: translateY()\` and \`opacity\` because they skip layout and paint — they touch only the compositor, the fastest stage. display:none removes nodes from the render tree entirely; visibility:hidden hides them but keeps space. Libraries like React batch DOM mutations to run layout once instead of thrashing it. Virtual scrolling (render only visible rows) keeps the DOM small. DevTools' Performance panel profiles all five stages; purple blocks flag forced synchronous layout thrashing.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `"I can fix this page by optimizing JavaScript." False — a slow page usually stalls in layout or paint, not JS. "Visibility:hidden and display:none are the same." No — display:none removes the node; visibility:hidden hides it but leaves space. "Animating height is fine." Wrong — it re-runs layout every frame. Animating \`transform: scaleY()\` is pure composite, smooth.`,
        `The layout-thrash trap: read a geometry property (offsetHeight, getBoundingClientRect) while layout is dirty and the browser recomputes layout synchronously, right then, inside your loop. A read-write-read-write loop forces layout repeatedly when one would do. The fix: batch all reads first, then all writes. Layout runs once; reads stay clean; writes flag dirty for one batch layout before the next frame.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Tree Traversals teaches the tree-walk algorithms browsers use. How DNS Works and TCP Handshake & Congestion Control cover the network stage before parsing starts. Topological Sort covers layout dependency chains (parent sizes depend on children; sizes bubble up, geometry flows down). CDN Request Flow explains how static assets reach browsers quickly. These five topics form the complete path from URL to pixels.`,
      ],
    },
  ],
};

