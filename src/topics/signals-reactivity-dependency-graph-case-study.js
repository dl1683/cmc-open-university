// Signals and fine-grained reactivity: dependency tracking on reads, targeted
// invalidation on writes, memoized derivations, and effect scheduling.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'signals-reactivity-dependency-graph-case-study',
  title: 'Signals Reactivity Dependency Graph',
  category: 'Systems',
  summary: 'A fine-grained reactivity case study: signals, computed values, effects, dynamic dependency tracking, batching, equality, and stale-node cleanup.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['dependency graph', 'dynamic deps'], defaultValue: 'dependency graph' },
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

function signalGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'qty', label: 'qty', x: 0.9, y: 5.2, note: notes.qty ?? 'signal' },
      { id: 'price', label: 'price', x: 0.9, y: 3.6, note: notes.price ?? 'signal' },
      { id: 'coupon', label: 'coupon', x: 0.9, y: 2.0, note: notes.coupon ?? 'signal' },
      { id: 'subtotal', label: 'subtotal', x: 3.2, y: 4.6, note: notes.subtotal ?? 'computed' },
      { id: 'total', label: 'total', x: 5.4, y: 3.6, note: notes.total ?? 'computed' },
      { id: 'effect', label: 'effect', x: 7.4, y: 4.6, note: notes.effect ?? 'render text' },
      { id: 'dom', label: 'DOM', x: 9.0, y: 4.6, note: notes.dom ?? '$19.98' },
    ],
    edges: [
      { id: 'e-qty-subtotal', from: 'qty', to: 'subtotal', weight: '' },
      { id: 'e-price-subtotal', from: 'price', to: 'subtotal', weight: '' },
      { id: 'e-subtotal-total', from: 'subtotal', to: 'total', weight: '' },
      { id: 'e-coupon-total', from: 'coupon', to: 'total', weight: '' },
      { id: 'e-total-effect', from: 'total', to: 'effect', weight: '' },
      { id: 'e-effect-dom', from: 'effect', to: 'dom', weight: '' },
    ],
  }, { title });
}

function* dependencyGraph() {
  yield {
    state: signalGraph('Reads create dependency edges'),
    highlight: { active: ['qty', 'price', 'subtotal', 'total', 'effect', 'e-qty-subtotal', 'e-price-subtotal', 'e-subtotal-total', 'e-total-effect'], found: ['dom'] },
    explanation: 'A signal stores a value and a subscriber set. When a computed value or effect reads a signal, the runtime records an edge from the signal to that subscriber.',
    invariant: 'Dependency tracking happens on read, not by scanning the whole app.',
  };

  yield {
    state: signalGraph('A write marks only downstream subscribers dirty', { qty: 'set(3)', subtotal: 'dirty', total: 'dirty', effect: 'queued' }),
    highlight: { active: ['qty', 'subtotal', 'total', 'effect', 'e-qty-subtotal', 'e-subtotal-total', 'e-total-effect'], compare: ['coupon'] },
    explanation: 'Updating qty does not re-run unrelated UI. The runtime follows subscriber edges and marks only downstream computations dirty.',
  };

  yield {
    state: signalGraph('Computed values memoize until read again', { subtotal: 'recalc once', total: 'uses cached', effect: 'runs once' }),
    highlight: { found: ['subtotal', 'total', 'effect', 'dom'], active: ['e-effect-dom'] },
    explanation: 'Computed values are cached derivations. Multiple reads in the same clean state reuse the memoized value instead of recomputing every expression in the component tree.',
  };

  yield {
    state: labelMatrix(
      'Runtime records',
      [
        { id: 'signal', label: 'signal' },
        { id: 'computed', label: 'computed' },
        { id: 'effect', label: 'effect' },
        { id: 'batch', label: 'batch' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'job', label: 'job' },
      ],
      [
        ['value+subs', 'notify'],
        ['cached val', 'derive'],
        ['cleanup', 'side effect'],
        ['queue', 'flush once'],
      ],
    ),
    highlight: { found: ['signal:stores', 'computed:stores', 'batch:job'], compare: ['effect:job'] },
    explanation: 'The implementation is a graph engine: sources hold subscribers, derived nodes cache values, effects run side effects, and batching coalesces many writes into one flush.',
  };

  yield {
    state: signalGraph('Fine-grained updates can skip a virtual tree diff', { qty: 'changed', subtotal: 'new', total: 'new', dom: 'text node' }),
    highlight: { found: ['dom', 'effect', 'total'], removed: ['coupon'] },
    explanation: 'In a fine-grained UI runtime, a DOM text node can subscribe to the exact computed value it needs. Updating qty can patch that text node without re-rendering a whole component subtree.',
  };
}

function* dynamicDeps() {
  yield {
    state: signalGraph('Dynamic branches change dependencies', { coupon: 'disabled', total: 'skips coupon' }),
    highlight: { active: ['subtotal', 'total', 'effect'], removed: ['coupon', 'e-coupon-total'] },
    explanation: 'Dependencies are often dynamic. If a computed total does not read coupon while discounts are disabled, coupon should not remain a live dependency.',
    invariant: 'The latest run owns the latest dependency set.',
  };

  yield {
    state: signalGraph('Re-running cleans old edges and records new ones', { coupon: 'enabled', total: 'reads coupon' }),
    highlight: { found: ['coupon', 'e-coupon-total', 'total'], active: ['subtotal'] },
    explanation: 'When the branch changes, the runtime cleans previous subscriptions and tracks the signals read during the new run. This prevents stale dependencies from causing unnecessary work.',
  };

  yield {
    state: labelMatrix(
      'Invalidation rules',
      [
        { id: 'equal', label: 'equal' },
        { id: 'batch', label: 'batch' },
        { id: 'cycle', label: 'cycle' },
        { id: 'effect', label: 'effect' },
      ],
      [
        { id: 'rule', label: 'rule' },
        { id: 'reason', label: 'reason' },
      ],
      [
        ['skip notify', 'same value'],
        ['one flush', 'less churn'],
        ['reject', 'no fixed pt'],
        ['last step', 'side effects'],
      ],
    ),
    highlight: { found: ['equal:rule', 'batch:rule'], removed: ['cycle:rule'], compare: ['effect:rule'] },
    explanation: 'Good reactive graphs need equality checks, batching, cycle protection, and disciplined effect timing. Otherwise the graph becomes a hidden event storm.',
  };

  yield {
    state: signalGraph('A stale cleanup prevents ghost subscribers', { qty: 'unmounted', subtotal: 'cleanup', total: 'detached', effect: 'disposed' }),
    highlight: { removed: ['qty', 'subtotal', 'total', 'effect', 'e-qty-subtotal', 'e-subtotal-total', 'e-total-effect'], found: ['dom'] },
    explanation: 'When UI is removed, effects and subscriptions must be disposed. A leaked subscriber keeps old nodes alive and can update invisible UI.',
  };

  yield {
    state: labelMatrix(
      'Framework mapping',
      [
        { id: 'solid', label: 'Solid' },
        { id: 'angular', label: 'Angular' },
        { id: 'vue', label: 'Vue' },
        { id: 'tc39', label: 'TC39' },
      ],
      [
        { id: 'primitive', label: 'primitive' },
        { id: 'lesson', label: 'lesson' },
      ],
      [
        ['signal', 'fine grain'],
        ['signal', 'granular'],
        ['ref/reactive', 'track/trigger'],
        ['proposal', 'not final'],
      ],
    ),
    highlight: { found: ['solid:lesson', 'angular:lesson', 'vue:lesson'], compare: ['tc39:lesson'] },
    explanation: 'Signals are not one framework trick. Solid, Angular, Vue refs, and the TC39 proposal all expose the same core idea: track reads, trigger dependent computations on writes, and keep updates local.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'dependency graph') yield* dependencyGraph();
  else if (view === 'dynamic deps') yield* dynamicDeps();
  else throw new InputError('Pick a signals view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as a dependency graph built while code runs. A signal is a stored value with subscribers, a computed value is a cached derivation, and an effect is code that performs side effects after dependencies change. Active nodes are the value being read, written, invalidated, or recomputed.',
        {type:'callout', text:'The runtime becomes efficient when it records the dependency graph while values are read and uses that graph to invalidate only downstream work.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/f/fe/Tred-G.svg', alt:'Directed acyclic graph with five labeled nodes and arrows showing dependencies.', caption:'Directed acyclic graph diagram by Lyonsam, Wikimedia Commons, public domain.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Interactive interfaces are dependency graphs. A total depends on subtotal and coupon, and a button may depend on validation, inventory, and a pending request flag. The runtime needs to update only the consequences of a changed value without asking engineers to wire every edge by hand.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is broad rerendering: store state, rerun a component or subtree, and let rendering rediscover the screen. The opposite approach is manual callbacks such as updateSubtotal then updateTotal. One revisits too much code, and the other creates a second dependency program that drifts.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is dynamic dependencies. A total may read coupon only when discounts are enabled, so coupon should stop invalidating total when that branch is off. Static dependency lists are too broad, and manual unsubscribe logic is a common source of stale edges and leaks.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Record dependencies during reads. While a computed value or effect is running, the runtime stores it as the current observer, and signal getters register edges to that observer. Before rerun, old edges are removed, so the latest execution becomes the dependency truth.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A signal stores a value and subscriber set. A computed node stores a function, cached value, dirty flag, dependencies, and subscribers. A write compares old and new values, marks downstream computed nodes dirty, and schedules effects through a queue so batches of writes can flush once.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The invariant is that a clean computed value was produced from the current values of every signal in its recorded dependency set. If none of those signals changes, the cache is safe. If one changes, the dirty mark prevents stale reuse before the value can be observed again.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'A tracked signal read can update subscriber sets and dependency lists, so it costs more than a plain property access. A signal write costs proportional to the affected subscriber graph rather than the whole UI tree. If 10,000 signals each feed 3 computations, the runtime owns about 30,000 dependency edges plus caches and queues.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Signals fit forms, spreadsheets, dashboards, derived totals, validation graphs, template bindings, and direct text or attribute updates. They are strongest when many small dependencies are stable and one value change should update a small downstream slice of the interface.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Signals fail when effects become hidden control flow. An effect that writes a signal it also reads can loop, and chains of effects can hide ownership better expressed by events or reducers. They also fail when disposed UI keeps subscriptions or equality rules hide meaningful mutations.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Start with qty = 2, price = 10, coupon = 5, and discountsEnabled = false. Subtotal reads qty and price, so subtotal = 20; total reads subtotal and discountsEnabled, but not coupon, so coupon has no edge to total. When qty becomes 3, subtotal and total recompute once and the text changes to 30; when discountsEnabled later becomes true, total reads coupon and future coupon changes invalidate it.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Solid fine-grained reactivity documentation, Angular Signals documentation, Vue reactivity in depth, and the TC39 signals proposal. Study virtual DOM reconciliation, topological sort, event-loop scheduling, graph traversal, UI state machines, and query-cache invalidation.',
      ],
    },
  ],
};