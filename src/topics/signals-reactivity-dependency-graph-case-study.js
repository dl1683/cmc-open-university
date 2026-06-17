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
      heading: 'The problem',
      paragraphs: [
        'Interactive interfaces are dependency graphs whether the framework admits it or not. A subtotal depends on quantity and price. A total depends on subtotal and coupon. A text node depends on total. A disabled button may depend on validation state, inventory state, and a pending request flag. When one small value changes, the user expects only the consequences of that value to update.',
        'The problem is discovering and maintaining those consequences without asking the engineer to wire every edge by hand. If the runtime knows exactly which computations read a signal, a write can travel through a small graph. If it does not, the system either reruns broad code or trusts manual callbacks to stay correct.',
      ],
    },
    {
      heading: 'The naive approaches',
      paragraphs: [
        'The simplest approach is broad rerendering. Store state, rerun a component or template when that state changes, and let the render pass rediscover what the screen should look like. This is robust and often fast enough. The cost is that the runtime may revisit a large subtree to update one derived value or one text node.',
        'The opposite approach is manual wiring. After quantity changes, call updateSubtotal. After subtotal changes, call updateTotal. After total changes, call updateDom. This looks efficient at first, but the dependency list becomes a second program. It is easy to forget one callback, run callbacks in the wrong order, or leave a stale callback after a branch stops using a value.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall appears when dependencies are dynamic. A computed total may read coupon only when discounts are enabled. When discounts are disabled, coupon should no longer wake that computation. A static dependency list is too broad, while manual subscribe and unsubscribe calls are error-prone. The latest execution is the only reliable source of the latest dependency set.',
        'The wall also appears in scheduling. A single user action can set several signals. Without batching, each write may trigger repeated recomputation and repeated effects. Without equality checks, setting a signal to the same value can still churn the graph. Without cycle protection, an effect that writes to a signal it depends on can create an update loop.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'A signal runtime records dependencies during reads. While a computed value or effect is running, the runtime stores it as the current observer. When that observer reads a signal, the signal adds the observer to its subscriber set, and the observer records the signal as one of its dependencies. The graph is discovered by executing normal user code.',
        'Writes then use the graph. When a signal changes, it notifies subscribers instead of scanning the whole application. Computed values become dirty and can recompute lazily or during a scheduled flush. Effects are queued for later execution so side effects happen at a disciplined point rather than in the middle of every setter.',
      ],
    },
    {
      heading: 'Mechanics',
      paragraphs: [
        'A signal stores a current value and a set of subscribers. A computed node stores a derivation function, cached value, dirty flag, subscriber set, and the list of dependencies from its latest run. An effect stores a function that performs side effects plus cleanup logic for disposal. Those records are enough to build a small graph engine inside the UI runtime.',
        'Evaluation uses an observer stack. Before a computed node or effect runs, the runtime pushes it as the current observer. Signal getters check whether an observer is active. If so, the getter registers an edge from the signal to the observer. When the function returns, the runtime pops the observer and the node now owns the dependency set it actually used during that run.',
        'Writes start at the source signal. If the new value is equal to the old value under the configured equality rule, the runtime can skip notification. Otherwise it marks downstream computed nodes dirty and schedules effects. Batching groups many writes so that each affected effect runs once after the batch rather than once per setter.',
      ],
    },
    {
      heading: 'Dynamic dependencies',
      paragraphs: [
        'Dynamic dependency tracking requires cleanup. Before a computed node reruns, the runtime removes old edges from the signals it previously read. The new run then records the signals read this time. This is how a branch can stop depending on coupon after discounts are disabled. The edge disappears because the latest run did not read coupon.',
        'This cleanup is also a memory-management rule. If a component or effect is disposed, its subscriptions must be removed. Otherwise old signals keep references to old observers, which keeps invisible UI alive and can trigger updates into dead state. Fine-grained reactivity is only fine-grained when stale edges are removed.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The key invariant is that a clean computed value was produced from the current values of every signal in its recorded dependency set. If one of those signals changes, the computed node is marked dirty before its cached value can be trusted again. If none of those signals changes, the cached value can be reused safely.',
        'The latest-run rule preserves that invariant across branches. A computation depends on what it read during its most recent execution, not on every signal it has ever read. That rule avoids ghost dependencies and lets the runtime handle ordinary control flow without a separate dependency declaration language.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Consider a checkout summary. The signal qty is 2, price is 10, and coupon is disabled. A computed subtotal reads qty and price, so the graph has edges from qty and price to subtotal. A computed total reads subtotal and, because discounts are disabled, does not read coupon. The render effect reads total and writes the text node.',
        'Now qty changes from 2 to 3. The qty signal marks subtotal dirty. Subtotal marks total dirty. Total schedules the effect. Coupon is untouched because it is not in the dependency chain for the current branch. When the effect flushes, it reads total, total reads subtotal, subtotal recomputes once from qty and price, and the DOM text changes.',
        'Later discounts are enabled and total reruns. This time total reads coupon. The runtime records the coupon edge. A future coupon change now invalidates total. If discounts are disabled again and total reruns without reading coupon, cleanup removes that edge. The graph follows the actual control flow instead of a stale guess.',
      ],
    },
    {
      heading: 'Animation guide',
      paragraphs: [
        'The dependency graph view shows the normal path: reads create edges from source signals to derived computations and effects, then a write to qty travels only through subtotal, total, the effect, and the DOM text that depends on it. The coupon node stays out of the update when the current graph does not need it.',
        'The dynamic deps view teaches the cleanup rule. A disabled branch removes the coupon dependency. Enabling the branch records it again. The stale-cleanup frame shows why disposal matters: subscriptions are references, and references keep nodes alive unless the runtime removes them deliberately.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'A signal read is no longer just a property access when tracking is active. It may update subscriber sets and dependency lists. A signal write costs proportional to the subscribers it reaches, not to the size of the whole UI tree. That is the core performance trade: pay graph bookkeeping so updates can be targeted.',
        'The space cost is the graph itself. Signals hold subscriber sets. Computed nodes hold cached values, dirty flags, and dependency lists. Effects hold cleanup functions. The scheduler holds queues. In small interfaces the overhead may not matter, but in very large graphs the shape of subscriptions and effects becomes a real performance object.',
        'Scheduling policy is also a tradeoff. Lazy computed values avoid work until someone reads them, but they must propagate dirty state correctly. Eager flushing gives predictable timing but can do unnecessary work. Batching reduces repeated recomputation, but it can make timing less immediate for code that expects every setter to synchronously update every effect.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Signals win when an interface has many small, stable dependencies. Forms, spreadsheets, dashboards, derived totals, template bindings, validation graphs, and direct text or attribute updates are natural fits. A write to one value can update the exact computations and DOM bindings that depend on it without rerunning a broad tree.',
        'They also work well when the framework wants reactive values to be ordinary JavaScript reads. Solid signals, Angular signals, Vue refs and reactive objects, and the TC39 proposal all express the same shape: track reads, trigger dependent computations on writes, and keep recomputation near the changed value.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Signals fail when engineers treat effects as general control flow. Effects are side-effect boundaries, not a place to hide arbitrary state transitions. An effect that writes a signal it also depends on can create a loop. A chain of effects can become harder to reason about than a direct event handler or reducer.',
        'They also fail when ownership is unclear. Signals tell the runtime what depends on what, but they do not decide which value is canonical, which value is derived, which update should be transactional, or which side effect is allowed. A precise dependency graph can still encode a confused application model.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'The first failure mode is leaked subscribers. If disposed UI keeps subscriptions, old observers remain reachable and may continue to run. The symptom can look like duplicate effects, memory growth, or invisible UI reacting to new state. Cleanup is therefore part of the algorithm, not an optional finalizer.',
        'The second failure mode is stale dependency edges. If a runtime fails to remove coupon after the branch stops reading it, coupon changes will invalidate total unnecessarily. That may be a performance bug, but it can also be a behavior bug if effects run in response to state they no longer semantically use.',
        'The third failure mode is bad equality. Equality that is too shallow can rerun work for no visible change. Equality that is too aggressive can hide updates that downstream code expects. Mutable objects make this especially subtle because the reference may remain equal while internal fields change.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: Solid fine-grained reactivity at https://docs.solidjs.com/advanced-concepts/fine-grained-reactivity, Solid intro to reactivity at https://docs.solidjs.com/concepts/intro-to-reactivity, Angular Signals at https://angular.dev/guide/signals, Vue Reactivity in Depth at https://vuejs.org/guide/extras/reactivity-in-depth, Vue Reactivity Fundamentals at https://vuejs.org/guide/essentials/reactivity-fundamentals.html, and the TC39 signals proposal at https://github.com/tc39/proposal-signals.',
        'Study Virtual DOM Reconciliation to compare broad rerendering with fine-grained updates, React Fiber Scheduler Case Study for scheduling tradeoffs, The Event Loop for flush timing, Topological Sort for dependency ordering, Graph BFS for propagation intuition, UI State Machine Workflow for ownership, Query Cache: Stale Time & GC for cache invalidation, and Form Validation Dependency Graph for another small reactive graph.',
      ],
    },
  ],
};
