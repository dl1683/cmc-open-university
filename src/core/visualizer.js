// Step player + SVG renderers + topic page runtime.
// This is the only module that touches the visualization DOM.
// Topic modules never reach in here: they yield steps, we draw them.

import { validateSteps, collectSteps, InputError } from './state.js';

const SVGNS = 'http://www.w3.org/2000/svg';

// ----------------------------------------------------------- svg helpers

function svg(tag, attrs = {}, parent = null) {
  const el = document.createElementNS(SVGNS, tag);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
  if (parent) parent.appendChild(el);
  return el;
}

function svgText(parent, x, y, text, cls = '') {
  const el = svg('text', { x, y, class: cls }, parent);
  el.textContent = text;
  return el;
}

function makeSvg(container, width, height) {
  container.replaceChildren();
  return svg('svg', {
    viewBox: `0 0 ${width} ${height}`,
    preserveAspectRatio: 'xMidYMid meet',
    role: 'img',
  }, container);
}

function highlightClassesFor(id, highlight) {
  let classes = '';
  for (const [key, ids] of Object.entries(highlight ?? {})) {
    if (ids && ids.includes(id)) classes += ` hl-${key}`;
  }
  return classes;
}

function emptyMessage(container, message) {
  const el = makeSvg(container, 320, 90);
  svgText(el, 160, 50, message, 'svg-muted svg-center');
}

// ------------------------------------------------------------ renderers

const BOX = 56;

function renderBoxRow(container, state, highlight, opts = {}) {
  const { items } = state;
  const pitch = opts.arrows ? BOX + 36 : BOX + 10;
  if (items.length === 0) {
    emptyMessage(container, opts.emptyText ?? '(empty)');
    return;
  }
  const width = 14 + items.length * pitch + (opts.arrows ? 30 : 4);
  const el = makeSvg(container, width, 132);
  if (opts.arrows) {
    const defs = svg('defs', {}, el);
    const marker = svg('marker', {
      id: 'arrowhead', viewBox: '0 0 10 10', refX: 9, refY: 5,
      markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse',
    }, defs);
    svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', class: 'svg-arrowhead' }, marker);
  }
  items.forEach((item, index) => {
    const x = 14 + index * pitch;
    const g = svg('g', { 'data-id': item.id, class: `cell${highlightClassesFor(item.id, highlight)}` }, el);
    svg('rect', { x, y: 30, width: BOX, height: BOX, rx: 8 }, g);
    svgText(g, x + BOX / 2, 30 + BOX / 2, String(item.value), 'cell-value svg-center');
    if (opts.indexLabels) svgText(el, x + BOX / 2, 110, String(index), 'svg-muted svg-center svg-small');
    if (opts.arrows && index < items.length) {
      const isLast = index === items.length - 1;
      svg('line', {
        x1: x + BOX + 3, y1: 58, x2: x + BOX + 31, y2: 58,
        class: 'svg-link', 'marker-end': 'url(#arrowhead)',
      }, el);
      if (isLast) svgText(el, x + BOX + 44, 58, '∅', 'svg-muted svg-center');
    }
  });
  if (opts.firstLabel) svgText(el, 14 + BOX / 2, 18, opts.firstLabel, 'svg-label svg-center');
  if (opts.lastLabel && items.length > 0) {
    svgText(el, 14 + (items.length - 1) * pitch + BOX / 2, 18, opts.lastLabel, 'svg-label svg-center');
  }
}

function renderArray(container, step) {
  renderBoxRow(container, step.state, step.highlight, { indexLabels: true, emptyText: '(empty array)' });
}

function renderQueue(container, step) {
  const labels = { firstLabel: 'front', lastLabel: 'back' };
  if (step.state.items.length === 1) labels.lastLabel = '';
  renderBoxRow(container, step.state, step.highlight, { ...labels, emptyText: '(empty queue)' });
}

function renderLinkedList(container, step) {
  renderBoxRow(container, step.state, step.highlight, {
    arrows: true, firstLabel: 'head', emptyText: 'head → ∅',
  });
}

function renderStack(container, step) {
  const { items } = step.state;
  const height = Math.max(150, 46 + items.length * 48 + 24);
  const el = makeSvg(container, 280, height);
  // open-top container bracket
  svg('path', { d: `M 58 24 V ${height - 14} H 222 V 24`, class: 'svg-bracket' }, el);
  if (items.length === 0) {
    svgText(el, 140, height / 2 + 6, '(empty stack)', 'svg-muted svg-center');
    return;
  }
  items.forEach((item, index) => {
    const y = 38 + index * 48;
    const g = svg('g', { 'data-id': item.id, class: `cell${highlightClassesFor(item.id, step.highlight)}` }, el);
    svg('rect', { x: 66, y, width: 148, height: 40, rx: 8 }, g);
    svgText(g, 140, y + 20, String(item.value), 'cell-value svg-center');
    if (index === 0) svgText(el, 232, y + 20, '← top', 'svg-label');
  });
}

function renderHashTable(container, step) {
  const { buckets, meta } = step.state;
  const twoColumns = buckets.length > 8;
  const perColumn = twoColumns ? Math.ceil(buckets.length / 2) : buckets.length;
  const width = twoColumns ? 600 : 320;
  const height = 14 + perColumn * 40 + 34;
  const el = makeSvg(container, width, height);
  buckets.forEach((bucket, index) => {
    const column = Math.floor(index / perColumn);
    const row = index % perColumn;
    const x = 48 + column * 290;
    const y = 14 + row * 40;
    svgText(el, x - 10, y + 16, String(bucket.index), 'svg-muted svg-right svg-small');
    const g = svg('g', { 'data-id': bucket.id, class: `cell${highlightClassesFor(bucket.id, step.highlight)}` }, el);
    svg('rect', { x, y, width: 210, height: 32, rx: 6, class: bucket.empty ? 'bucket-empty' : '' }, g);
    svgText(g, x + 105, y + 16, bucket.empty ? '—' : String(bucket.key), `cell-value svg-center${bucket.empty ? ' svg-muted' : ''}`);
  });
  if (meta && meta.capacity) {
    const used = meta.size ?? 0;
    svgText(el, 48, height - 8,
      `${used} of ${meta.capacity} buckets used — load factor ${(used / meta.capacity).toFixed(2)}`,
      'svg-muted svg-small');
  }
}

function renderTree(container, step) {
  const { nodes, rootId } = step.state;
  if (!rootId || nodes.length === 0) {
    emptyMessage(container, '(empty tree)');
    return;
  }
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const pos = new Map();
  let cursor = 0;
  let maxDepth = 0;
  (function walk(id, depth) {
    if (!id) return;
    const node = byId.get(id);
    maxDepth = Math.max(maxDepth, depth);
    walk(node.left, depth + 1);
    pos.set(id, { x: cursor++ * 64 + 44, y: depth * 76 + 42 });
    walk(node.right, depth + 1);
  })(rootId, 0);

  const el = makeSvg(container, cursor * 64 + 28, (maxDepth + 1) * 76 + 28);
  for (const node of nodes) {
    const from = pos.get(node.id);
    if (!from) continue;
    for (const childId of [node.left, node.right]) {
      const to = pos.get(childId);
      if (to) svg('line', { x1: from.x, y1: from.y, x2: to.x, y2: to.y, class: 'svg-link' }, el);
    }
  }
  for (const node of nodes) {
    const at = pos.get(node.id);
    if (!at) continue;
    const g = svg('g', { 'data-id': node.id, class: `cell${highlightClassesFor(node.id, step.highlight)}` }, el);
    svg('circle', { cx: at.x, cy: at.y, r: 22 }, g);
    svgText(g, at.x, at.y, String(node.value), 'cell-value svg-center');
  }
}

function renderCallTree(container, step) {
  const { frames } = step.state;
  if (frames.length === 0) {
    emptyMessage(container, '(no calls yet)');
    return;
  }
  const children = new Map(frames.map((frame) => [frame.id, []]));
  let rootId = frames[0].id;
  for (const frame of frames) {
    if (frame.parentId && children.has(frame.parentId)) children.get(frame.parentId).push(frame.id);
    if (!frame.parentId) rootId = frame.id;
  }
  const pos = new Map();
  let cursor = 0;
  let maxDepth = 0;
  (function place(id, depth) {
    maxDepth = Math.max(maxDepth, depth);
    const kids = children.get(id);
    let x;
    if (kids.length === 0) {
      x = cursor++;
    } else {
      for (const kid of kids) place(kid, depth + 1);
      x = (pos.get(kids[0]).slot + pos.get(kids[kids.length - 1]).slot) / 2;
    }
    pos.set(id, { slot: x, x: x * 124 + 72, y: depth * 72 + 34 });
  })(rootId, 0);

  const byId = new Map(frames.map((frame) => [frame.id, frame]));
  const el = makeSvg(container, cursor * 124 + 24, (maxDepth + 1) * 72 + 30);
  for (const frame of frames) {
    if (!frame.parentId || !pos.has(frame.parentId)) continue;
    const from = pos.get(frame.parentId);
    const to = pos.get(frame.id);
    svg('line', { x1: from.x, y1: from.y + 17, x2: to.x, y2: to.y - 17, class: 'svg-link' }, el);
  }
  for (const frame of frames) {
    const at = pos.get(frame.id);
    if (!at) continue;
    const g = svg('g', {
      'data-id': frame.id,
      class: `cell ct-${frame.status}${highlightClassesFor(frame.id, step.highlight)}`,
    }, el);
    svg('rect', { x: at.x - 54, y: at.y - 17, width: 108, height: 34, rx: 8 }, g);
    const label = frame.status === 'returned'
      ? `${frame.name}(${frame.args}) = ${frame.result}`
      : `${frame.name}(${frame.args})`;
    svgText(g, at.x, at.y, label, 'cell-value svg-center svg-small');
  }
}

function renderMatrix(container, step) {
  const { rows, columns, cells, title } = step.state;
  const CELL = 52;
  const PITCH = 57;
  const gx = 92;
  const gy = title ? 60 : 42;
  const el = makeSvg(container, gx + columns.length * PITCH + 14, gy + rows.length * PITCH + 12);
  if (title) svgText(el, 12, 20, title, 'svg-label');
  columns.forEach((column, c) => {
    const g = svg('g', { 'data-id': column.id, class: `mlabel${highlightClassesFor(column.id, step.highlight)}` }, el);
    svgText(g, gx + c * PITCH + CELL / 2, gy - 12, column.label, 'svg-label svg-center svg-small');
  });
  rows.forEach((row, r) => {
    const g = svg('g', { 'data-id': row.id, class: `mlabel${highlightClassesFor(row.id, step.highlight)}` }, el);
    svgText(g, gx - 10, gy + r * PITCH + CELL / 2, row.label, 'svg-label svg-right svg-small svg-center-y');
  });
  const rowIndex = new Map(rows.map((row, r) => [row.id, r]));
  const columnIndex = new Map(columns.map((column, c) => [column.id, c]));
  for (const cell of cells) {
    const x = gx + columnIndex.get(cell.column) * PITCH;
    const y = gy + rowIndex.get(cell.row) * PITCH;
    const g = svg('g', { 'data-id': cell.id, class: `mcell${highlightClassesFor(cell.id, step.highlight)}` }, el);
    svg('rect', {
      x, y, width: CELL, height: CELL, rx: 6,
      'fill-opacity': (0.08 + 0.8 * cell.intensity).toFixed(3),
    }, g);
    svgText(g, x + CELL / 2, y + CELL / 2, cell.label, 'cell-value svg-center svg-small');
  }
}

const RENDERERS = {
  array: renderArray,
  stack: renderStack,
  queue: renderQueue,
  'linked-list': renderLinkedList,
  'hash-table': renderHashTable,
  tree: renderTree,
  'call-tree': renderCallTree,
  matrix: renderMatrix,
};

export function renderStep(container, step) {
  RENDERERS[step.state.kind](container, step);
}

// --------------------------------------------------------------- player

// 1× is deliberately slow: people must be able to READ the explanation while
// the animation moves. Learners can speed up; a too-fast default teaches no one.
const READING_PACE_MS = 2000;

export function createPlayer(steps, hooks) {
  let index = 0;
  let timer = null;
  let delay = READING_PACE_MS;
  const total = steps.length;

  function emit() { hooks.onStep(steps[index], index, total); }
  function notify(playing) { if (hooks.onPlayState) hooks.onPlayState(playing); }

  function pause() {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
      notify(false);
    }
  }
  function play() {
    if (timer !== null || total < 2) return;
    if (index >= total - 1) { index = 0; emit(); }
    timer = setInterval(() => {
      index += 1;
      emit();
      if (index >= total - 1) pause();
    }, delay);
    notify(true);
  }
  function toggle() { (timer !== null) ? pause() : play(); }
  function next() { pause(); if (index < total - 1) { index += 1; emit(); } }
  function previous() { pause(); if (index > 0) { index -= 1; emit(); } }
  function reset() { pause(); index = 0; emit(); }
  function goTo(target) {
    pause();
    index = Math.max(0, Math.min(total - 1, Number(target)));
    emit();
  }
  function setSpeed(multiplier) {
    delay = Math.round(READING_PACE_MS / Number(multiplier));
    if (timer !== null) { clearInterval(timer); timer = null; play(); }
  }

  return {
    play, pause, toggle, next, previous, reset, goTo, setSpeed,
    get index() { return index; },
    get total() { return total; },
    get playing() { return timer !== null; },
  };
}

// -------------------------------------------------------- topic runtime

function buildControls(form, controls) {
  form.replaceChildren();
  for (const control of controls) {
    const label = document.createElement('label');
    const caption = document.createElement('span');
    caption.textContent = control.label;
    label.appendChild(caption);
    let input;
    if (control.type === 'select') {
      input = document.createElement('select');
      for (const option of control.options) {
        const el = document.createElement('option');
        el.value = option;
        el.textContent = option;
        input.appendChild(el);
      }
      input.value = control.defaultValue ?? control.options[0];
    } else {
      input = document.createElement('input');
      input.type = 'text';
      input.value = control.defaultValue ?? '';
      if (control.type === 'number') input.inputMode = 'numeric';
      input.autocomplete = 'off';
      input.spellcheck = false;
    }
    input.name = control.id;
    label.appendChild(input);
    form.appendChild(label);
  }
  const run = document.createElement('button');
  run.type = 'submit';
  run.className = 'btn btn-primary';
  run.textContent = 'Run ▸';
  form.appendChild(run);
}

function readControls(form, controls) {
  const data = new FormData(form);
  const input = {};
  for (const control of controls) input[control.id] = data.get(control.id);
  return input;
}

function defaultInput(controls) {
  const input = {};
  for (const control of controls) {
    input[control.id] = control.defaultValue ?? (control.options ? control.options[0] : '');
  }
  return input;
}

export function createTopicRuntime({ root, topic }) {
  const form = root.querySelector('[data-topic-controls]');
  const vis = root.querySelector('[data-visualization]');
  const explanationEl = root.querySelector('[data-explanation]');
  const invariantEl = root.querySelector('[data-invariant]');
  const progressText = root.querySelector('[data-progress-text]');
  const slider = root.querySelector('[data-slider]');
  const errorBox = root.querySelector('[data-error]');
  const toggleBtn = root.querySelector('[data-action="toggle"]');

  buildControls(form, topic.controls);
  let player = null;

  function onStep(step, index, total) {
    renderStep(vis, step);
    explanationEl.textContent = step.explanation;
    if (step.invariant) {
      invariantEl.hidden = false;
      invariantEl.textContent = `Invariant: ${step.invariant}`;
    } else {
      invariantEl.hidden = true;
    }
    progressText.textContent = `Step ${index + 1} of ${total}`;
    slider.max = String(total - 1);
    slider.value = String(index);
  }

  function onPlayState(playing) {
    toggleBtn.textContent = playing ? '❚❚ Pause' : '▶ Play';
    toggleBtn.setAttribute('aria-pressed', String(playing));
  }

  function runWith(input) {
    try {
      errorBox.hidden = true;
      const steps = validateSteps(collectSteps(topic.run(input), topic.id), topic.id);
      if (player) player.pause();
      player = createPlayer(steps, { onStep, onPlayState });
      player.reset();
      onPlayState(false);
    } catch (error) {
      if (error instanceof InputError) {
        errorBox.textContent = error.message;
        errorBox.hidden = false;
        return;
      }
      throw error;
    }
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    runWith(readControls(form, topic.controls));
  });
  root.querySelector('[data-action="reset"]').addEventListener('click', () => player && player.reset());
  root.querySelector('[data-action="prev"]').addEventListener('click', () => player && player.previous());
  root.querySelector('[data-action="next"]').addEventListener('click', () => player && player.next());
  toggleBtn.addEventListener('click', () => player && player.toggle());
  slider.addEventListener('input', () => player && player.goTo(slider.value));
  root.querySelector('[data-speed]').addEventListener('change', (event) => {
    if (player) player.setSpeed(event.target.value);
  });
  root.addEventListener('keydown', (event) => {
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target.tagName)) return;
    if (event.key === 'ArrowRight') { event.preventDefault(); player && player.next(); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); player && player.previous(); }
    if (event.key === ' ') { event.preventDefault(); player && player.toggle(); }
  });

  runWith(defaultInput(topic.controls));
}
