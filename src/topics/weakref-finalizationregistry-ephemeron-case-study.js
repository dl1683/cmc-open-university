// Weak references, ephemerons, and finalizers: weak reachability, WeakMap
// metadata, WeakRef.deref, FinalizationRegistry, and GC timing caveats.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'weakref-finalizationregistry-ephemeron-case-study',
  title: 'WeakRef & FinalizationRegistry',
  category: 'Data Structures',
  summary: 'A JavaScript heap-lifetime case study: WeakMap ephemerons, WeakRef.deref, FinalizationRegistry registrations, held values, unregister tokens, and GC timing traps.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['weak cache', 'finalizer caveats'], defaultValue: 'weak cache' },
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

function weakGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'root', label: 'root', x: 0.8, y: 4.8, note: notes.root ?? 'stack/global' },
      { id: 'obj', label: 'object', x: 2.8, y: 4.8, note: notes.obj ?? 'target' },
      { id: 'weakmap', label: 'WeakMap', x: 4.8, y: 5.8, note: notes.weakmap ?? 'key -> meta' },
      { id: 'weakref', label: 'WeakRef', x: 4.8, y: 3.6, note: notes.weakref ?? 'deref?' },
      { id: 'gc', label: 'GC', x: 6.6, y: 4.8, note: notes.gc ?? 'mark' },
      { id: 'registry', label: 'registry', x: 8.4, y: 5.8, note: notes.registry ?? 'target+held' },
      { id: 'cleanup', label: 'cleanup', x: 8.4, y: 3.6, note: notes.cleanup ?? 'later maybe' },
      { id: 'resource', label: 'resource', x: 9.8, y: 4.8, note: notes.resource ?? 'external' },
    ],
    edges: [
      { id: 'e-root-obj', from: 'root', to: 'obj', weight: 'strong' },
      { id: 'e-obj-weakmap', from: 'obj', to: 'weakmap', weight: 'key' },
      { id: 'e-weakref-obj', from: 'weakref', to: 'obj', weight: 'weak' },
      { id: 'e-obj-gc', from: 'obj', to: 'gc', weight: '' },
      { id: 'e-reg-obj', from: 'registry', to: 'obj', weight: 'weak' },
      { id: 'e-reg-clean', from: 'registry', to: 'cleanup', weight: '' },
      { id: 'e-clean-resource', from: 'cleanup', to: 'resource', weight: '' },
    ],
  }, { title });
}

function* weakCache() {
  yield {
    state: weakGraph('A strong reference keeps the target alive'),
    highlight: { active: ['root', 'obj', 'e-root-obj'], found: ['weakmap', 'weakref'] },
    explanation: 'A normal JavaScript reference keeps an object reachable. WeakMap, WeakSet, WeakRef, and FinalizationRegistry are special because their relationships do not by themselves keep the target alive.',
    invariant: 'Only strong reachability keeps an object alive.',
  };

  yield {
    state: weakGraph('WeakMap metadata is an ephemeron relation', { weakmap: 'metadata', obj: 'key alive' }),
    highlight: { found: ['weakmap'], active: ['obj', 'e-obj-weakmap'], compare: ['weakref'] },
    explanation: 'A WeakMap entry behaves like metadata attached to the key. While the key is strongly reachable, the value can be found. Once the key is gone, the entry no longer keeps the key alive.',
  };

  yield {
    state: weakGraph('WeakRef gives a maybe-pointer through deref', { weakref: 'deref()', gc: 'not yet', cleanup: 'none' }),
    highlight: { active: ['weakref', 'obj', 'e-weakref-obj'], compare: ['gc'] },
    explanation: 'WeakRef.deref returns the target if it is still alive, or undefined if it was reclaimed. Code must be ready for either answer.',
  };

  yield {
    state: weakGraph('After the strong root disappears, GC may reclaim later', { root: 'gone', obj: 'unreached?', gc: 'maybe collect', weakref: 'maybe undef' }),
    highlight: { removed: ['root', 'e-root-obj'], active: ['gc', 'weakref', 'registry'], compare: ['obj'] },
    explanation: 'Dropping the last strong reference does not synchronously destroy the object. The engine chooses when or whether to collect it, and that choice can vary by engine, version, pressure, and job timing.',
  };

  yield {
    state: labelMatrix(
      'Weak tools',
      [
        { id: 'weakmap', label: 'WeakMap' },
        { id: 'weakset', label: 'WeakSet' },
        { id: 'weakref', label: 'WeakRef' },
        { id: 'final', label: 'FinalReg' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'danger', label: 'danger' },
      ],
      [
        ['key meta', 'hidden life'],
        ['weak keys', 'same'],
        ['maybe obj', 'racy'],
        ['cleanup', 'not timely'],
      ],
    ),
    highlight: { found: ['weakmap:stores', 'weakref:stores'], compare: ['final:danger'] },
    explanation: 'The safe default is WeakMap metadata. WeakRef and FinalizationRegistry are advanced tools for rare cases where explicit lifetime management is impossible.',
  };
}

function* finalizerCaveats() {
  yield {
    state: weakGraph('A registry stores target weakly and held value strongly', { registry: 'held token', cleanup: 'callback', resource: 'id only' }),
    highlight: { active: ['registry', 'obj', 'cleanup', 'resource', 'e-reg-obj', 'e-reg-clean', 'e-clean-resource'], compare: ['root'] },
    explanation: 'FinalizationRegistry.register records a target and a held value. The target is weak. The held value is kept so the callback can receive cleanup information later.',
    invariant: 'Never make heldValue keep the target alive.',
  };

  yield {
    state: weakGraph('Cleanup callbacks are later, maybe, never synchronous', { gc: 'collected', cleanup: 'queued?', weakref: 'undefined' }),
    highlight: { active: ['gc', 'registry', 'cleanup'], removed: ['obj', 'e-weakref-obj'], compare: ['resource'] },
    explanation: 'Cleanup callbacks do not run synchronously. A conforming implementation is not required to call them at all, so they cannot own essential correctness.',
  };

  yield {
    state: weakGraph('Unregister tokens let explicit cleanup win', { registry: 'token', cleanup: 'skip', resource: 'disposed now' }),
    highlight: { found: ['resource'], removed: ['cleanup'], active: ['registry'] },
    explanation: 'The robust pattern is explicit dispose plus unregister. Finalization can be a backstop for memory pressure, not the primary release path for critical resources.',
  };

  yield {
    state: labelMatrix(
      'Bad patterns',
      [
        { id: 'final', label: 'finalizer' },
        { id: 'held', label: 'heldValue' },
        { id: 'timing', label: 'timing' },
        { id: 'logic', label: 'logic' },
      ],
      [
        { id: 'bug', label: 'bug' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['closes file', 'dispose'],
        ['captures obj', 'store id'],
        ['assumed now', 'no rely'],
        ['core flow', 'explicit'],
      ],
    ),
    highlight: { removed: ['final:bug', 'held:bug', 'logic:bug'], found: ['final:fix', 'held:fix'] },
    explanation: 'The main mistakes are using finalizers for essential resources, accidentally capturing the target in the held value, and assuming GC timing is predictable.',
  };

  yield {
    state: weakGraph('The case study is a diagnostic side cache', { root: 'component', obj: 'DOM node', weakmap: 'metrics', weakref: 'optional', registry: 'drop row', cleanup: 'trim cache' }),
    highlight: { found: ['weakmap', 'registry', 'cleanup'], compare: ['weakref'] },
    explanation: 'A reasonable use is a diagnostic cache keyed by DOM nodes. If the node disappears, losing the metric row is acceptable. Correctness does not depend on the cleanup callback firing immediately.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'weak cache') yield* weakCache();
  else if (view === 'finalizer caveats') yield* finalizerCaveats();
  else throw new InputError('Pick a weak-reference view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'JavaScript code often wants to remember data about an object without becoming the reason that object stays alive. A profiler may want per-DOM-node counters. A library may want private metadata for user objects. A renderer may want a wrapper cache that disappears when the wrapped object disappears.',
        'Normal ownership is too strong for those cases. If the side table keeps an object alive, optional metadata becomes a leak. WeakMap, WeakSet, WeakRef, and FinalizationRegistry exist for code that needs to express a relationship without turning that relationship into ordinary reachability.',
      ],
    },
    {
      heading: 'The obvious approach and the wall',
      paragraphs: [
        'The obvious approach is a side cache: `const meta = new Map()`. Put the object in as the key and store counters, parsed data, layout state, or a wrapper as the value. The API is nice. You can look up, update, iterate, and measure the cache.',
        'The wall is lifetime. A Map key is a strong reference. If the Map is module-level or long-lived, every key can stay alive until someone deletes it. That may be impossible when the object is a DOM node owned by the browser, a user object owned by application code, or a wrapper passed through plugins.',
        'Manual deletion is good when ownership is clear. Weak structures are for the cases where ownership is not clear and forgetting to delete is worse than losing optional metadata.',
      ],
    },
    {
      heading: 'Reachability model',
      paragraphs: [
        'Garbage collection starts from roots such as the stack, globals, module state, closures, and engine internals. Anything reachable from those roots through strong references must stay alive. The collector can choose when to run, but it cannot collect an object that is still strongly reachable.',
        'A weak edge is different. A WeakMap key slot, WeakSet entry, WeakRef target, or FinalizationRegistry target does not by itself keep the target alive. If only weak edges remain, the collector may reclaim the object at a time chosen by the engine.',
        'This means weak tools are about permission, not scheduling. They let collection happen. They do not command collection to happen now.',
      ],
    },
    {
      heading: 'Core insight and invariant',
      paragraphs: [
        'The core insight is to keep metadata attached to object reachability without making the metadata table an owner. WeakMap gives the common form: if the key is alive from somewhere else, the value can be found; if the key is not alive, the entry does not rescue it.',
        'The invariant is simple: only strong reachability keeps an object alive. Weak structures may observe or follow liveness, but they do not create liveness. Any design that accidentally stores the target strongly has left the weak model.',
        'FinalizationRegistry adds another invariant: the held value must not keep the target alive. Store an id, token, path, or external handle. Do not store the target object or a closure that captures it.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'The weak-cache view starts with a strong edge from root to object. While that edge exists, WeakMap metadata and WeakRef both have a meaningful target. When the strong edge disappears, the important change is not instant destruction. The important change is that weak edges no longer prove liveness.',
        'The finalizer-caveats view separates three things beginners often merge: the weak target, the strongly held cleanup value, and the later callback. The registry can remember an id for cleanup without keeping the target alive. If the held value contains the target, the model is broken and the program leaks.',
      ],
    },
    {
      heading: 'Mechanism',
      paragraphs: [
        'WeakMap is an ephemeron table. The key is weak, but the value is available when the key is strongly reachable from somewhere else. This is why WeakMap is the default answer for per-object metadata and private library state.',
        'WeakRef is a maybe-pointer. Calling `deref()` returns the target if it is still alive, or `undefined` if it was reclaimed. Code must be correct for both answers every time. A WeakRef is not a promise that the object will stay available later.',
        'FinalizationRegistry records a target weakly and a held value strongly. If the target is collected, the engine may later call the cleanup callback with the held value. The callback is not synchronous, not prompt, and not guaranteed before shutdown.',
        'Unregister tokens let explicit cleanup win. A robust design calls dispose, releases the resource directly, unregisters the finalizer entry, and treats the registry as a nonessential backstop.',
      ],
    },
    {
      heading: 'Why ephemerons matter',
      paragraphs: [
        'A plain weak pointer is not enough to explain WeakMap. The useful rule is conditional reachability. If the key is alive through a real owner, the map can expose the value. If the key is dead, the entry can vanish. The value does not save the key just because it sits in the same table entry.',
        'That detail prevents a subtle leak. Metadata often points back to its owner. In a strong Map, key and value can keep each other reachable through the cache. In a WeakMap, the entry is considered only after the collector has evidence that the key is alive from outside the table.',
      ],
    },
    {
      heading: 'Correctness',
      paragraphs: [
        'The design works because it preserves the collector invariant. Strong references define liveness. Weak structures can depend on liveness without becoming part of the proof of liveness.',
        'WeakRef has a small safety rule. If `deref()` returns an object, that object is kept alive through the current job, so code can use the returned reference during that turn. This is only a local safety rule. It does not say when collection will run.',
        'FinalizationRegistry is correct only as optional cleanup. A program that depends on the callback for correctness is depending on an event the engine is free to delay or skip. Essential cleanup needs an explicit path.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Imagine a UI diagnostics panel that stores `{ paints, lastLayoutMs }` for each DOM node it has observed. With `const metrics = new WeakMap()`, the node is the key and the metrics object is the value. As long as the node is part of the page or reachable from component state, `metrics.get(node)` works.',
        'When the component unmounts and no strong reference to the node remains, the WeakMap entry stops mattering. The diagnostics panel does not need to hear about the unmount. It also cannot enumerate all keys, because enumeration would expose collector timing as program behavior.',
        'If the panel has a secondary table keyed by numeric node id, a FinalizationRegistry can be a backstop that later removes that secondary row. The held value should be the id, not the DOM node and not a closure that captures the DOM node. If the callback never runs before process exit, correctness should still hold.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'WeakMap wins for private metadata, memoization tied to object identity, wrapper caches, per-DOM-node diagnostics, library state that should not mutate user objects, and optional metadata for platform-owned objects.',
        'WeakRef can fit optional caches where every access can tolerate a missing value. For example, a cache may keep a weak reference to a large derived object and rebuild it when `deref()` returns `undefined`.',
        'FinalizationRegistry can fit secondary bookkeeping cleanup where delayed cleanup is acceptable. It is a backstop for rows, ids, counters, or external indexes that are safe to leak temporarily and safe to clean later.',
      ],
    },
    {
      heading: 'Limits and failure modes',
      paragraphs: [
        'The first failure mode is accidentally keeping the target alive. A held value that contains the target, a cleanup closure that closes over the target, an event listener, a pending promise, or a normal Map elsewhere can defeat the weak design.',
        'The second failure mode is treating finalization as a lifecycle event. Do not use FinalizationRegistry to close files, release locks, commit transactions, revoke credentials, update UI, or make correctness visible to users. Use explicit cleanup for essential resources, then call `unregister` so the backstop does not run stale work later.',
        'The third failure mode is timing dependence. Collection can be delayed by memory pressure, engine heuristics, object generations, process shutdown, or embedding behavior. Code that passes only when a forced-GC test runs at a certain moment is not production-safe.',
        'The fourth failure mode is using weak tools to hide ownership mistakes. If there is a clear owner and a clear disposal point, explicit ownership is simpler and easier to test than weak reachability.',
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        'Choose WeakMap first. It is the high-level tool that usually matches the problem: attach metadata to an object without owning the object. Avoid wrapping it in APIs that expose size, enumeration, or cleanup timing.',
        'Use WeakRef only behind a narrow abstraction. Every call site should handle `undefined`. Do not read a weak target, schedule work, and assume the target will still be there later unless a strong reference is held for the work that needs it.',
        'For FinalizationRegistry, keep the held value small and target-free. Use ids, tokens, or resource handles. Pair registration with explicit dispose and unregister. Make the cleanup callback idempotent because it may run after explicit cleanup or after related state changed.',
      ],
    },
    {
      heading: 'Testing and operations',
      paragraphs: [
        'Test the deterministic parts: explicit dispose, unregister behavior, duplicate cleanup safety, and behavior when `deref()` returns `undefined`. Do not make correctness depend on forcing a collector at a precise point.',
        'Use memory profiling to confirm that weak caches are not hiding strong references elsewhere. Common hidden owners include closures, event listeners, arrays used for debugging, pending tasks, console history, and normal Maps that were added for observability.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study MDN WeakMap, WeakRef, and FinalizationRegistry, the TC39 WeakRefs proposal, V8 weak references and finalizers, ephemeron tables, generational garbage collection, JavaScript closures, event listeners, LRU caches, and browser DOM lifetime. They explain why weak reachability is useful, narrow, and easy to misuse.',
      ],
    },
  ],
};
