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
      heading: 'What it is',
      paragraphs: [
        'WeakRef and FinalizationRegistry expose a small window into JavaScript object lifetime. WeakRef can point at an object without keeping it alive. FinalizationRegistry lets code request a cleanup callback after a registered target is reclaimed.',
        'The data-structure family also includes WeakMap and WeakSet. A WeakMap is an ephemeron table: the value is reachable through the map only while the key is alive elsewhere.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Strong references define reachability. Weak references do not. WeakRef.deref returns the target only if it has not been reclaimed. FinalizationRegistry stores the target weakly and stores the held value strongly so the cleanup callback has information to work with.',
        'Garbage collection is deliberately not a scheduling API. Cleanup can be late or absent. A target seen through WeakRef stays visible through the current job, but after that the engine may choose differently.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A component diagnostics tool wants per-DOM-node metrics without leaking removed nodes. It stores metrics in a WeakMap keyed by DOM node. It may register nodes with FinalizationRegistry to trim a secondary index. If cleanup does not run, the app is still correct; it may just keep some diagnostic bookkeeping longer.',
        'This connects V8 Generational Garbage Collection to JavaScript Lexical Environments & Closures. Closures and inline caches can keep things alive longer than code appears to. Weak structures must be designed around reachability, not wishful lifetime assumptions.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not use finalizers to close files, release locks, commit transactions, revoke credentials, or update user-visible logic. Use explicit dispose paths for essential resources and unregister finalization records after explicit cleanup.',
        'Do not put the target object inside heldValue or a cleanup closure. That can accidentally keep the target reachable and defeat the weak relationship.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: MDN WeakRef at https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakRef, MDN FinalizationRegistry at https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/FinalizationRegistry, V8 weak references and finalizers at https://v8.dev/features/weak-references, and TC39 WeakRefs proposal at https://github.com/tc39/proposal-weakrefs. Study V8 Generational Garbage Collection, JavaScript Lexical Environments & Closures, V8 Hidden Classes & Inline Caches, and JavaScript Proxy Trap & Inline Cache next.',
      ],
    },
  ],
};
