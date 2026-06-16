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
      heading: 'What it is',
      paragraphs: [
        'Signals are reactive cells. A signal holds a value and notifies consumers when it changes. Computed values derive from signals and cache their result. Effects subscribe to signals or computed values and perform side effects such as updating DOM, logging, or integrating with a framework render queue.',
        'The data structure is a dynamic dependency graph. Reads create edges from source nodes to subscribers. Writes mark downstream nodes dirty. Batching and scheduling decide when dirty nodes recompute or effects flush.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A runtime keeps a current observer while evaluating a computed value or effect. When that observer reads a signal, the signal adds the observer to its subscriber set. Later, a setter follows that subscriber set and invalidates only the affected path.',
        'Dynamic dependencies matter. If a computed value reads coupon only when discounts are enabled, coupon should be subscribed only in that branch. Correct runtimes clean old dependencies and record the dependencies from the latest execution.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A shopping-cart total depends on quantity, price, tax, and maybe a coupon. With a virtual DOM approach, a component often re-renders and then diffs. With fine-grained reactivity, the total text node can subscribe to the computed total directly. Changing quantity marks subtotal and total dirty, then patches the text node. It does not re-run the sidebar, unrelated cards, or route shell.',
        'This page connects Virtual DOM Reconciliation and React Fiber Scheduler Case Study to a different runtime shape. Fiber schedules component-tree work. Signals schedule data-dependency work. Both are attempts to avoid unnecessary browser rendering work.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Fine-grained does not mean free. Deep graphs can leak if effects are not disposed. Cycles must be rejected or carefully controlled. Effects that write to signals can create loops. Equality functions can skip useful updates if they are wrong. Debugging can be harder when dependencies are implicit and dynamic.',
        'Signals also do not eliminate state design. They make the update path precise, but they do not decide which state is canonical, which state is derived, or which side effects are safe.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Solid fine-grained reactivity at https://docs.solidjs.com/advanced-concepts/fine-grained-reactivity, Solid intro to reactivity at https://docs.solidjs.com/concepts/intro-to-reactivity, Angular Signals at https://angular.dev/guide/signals, Vue Reactivity in Depth at https://vuejs.org/guide/extras/reactivity-in-depth, Vue Reactivity Fundamentals at https://vuejs.org/guide/essentials/reactivity-fundamentals.html, and the TC39 signals proposal at https://github.com/tc39/proposal-signals. Study Virtual DOM Reconciliation, React Fiber Scheduler Case Study, The Event Loop, Topological Sort, Graph BFS, UI State Machine Workflow, Query Cache: Stale Time & GC, and Form Validation Dependency Graph next.',
      ],
    },
  ],
};
