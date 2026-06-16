// Automerge implementation shape: change DAG, heads, op ids, JSON-like values,
// sync, compact binary storage, and columnar history.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'automerge-change-graph-columnar-case-study',
  title: 'Automerge Change Graph & Columnar Storage',
  category: 'Systems',
  summary: 'An Automerge implementation case study: document changes form a DAG with heads, operations carry object/key/action/value columns, and compact storage keeps full local-first history practical.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['change graph', 'columnar storage'], defaultValue: 'change graph' },
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

function graph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'root', label: 'root', x: 0.6, y: 4.0, note: notes.root ?? 'doc' },
      { id: 'c1', label: 'c1', x: 2.2, y: 3.0, note: notes.c1 ?? 'A:1' },
      { id: 'c2', label: 'c2', x: 2.2, y: 5.0, note: notes.c2 ?? 'B:1' },
      { id: 'merge', label: 'merge', x: 4.0, y: 4.0, note: notes.merge ?? 'deps' },
      { id: 'heads', label: 'heads', x: 5.8, y: 2.4, note: notes.heads ?? 'tips' },
      { id: 'doc', label: 'doc', x: 5.8, y: 5.6, note: notes.doc ?? 'material' },
      { id: 'sync', label: 'sync', x: 7.6, y: 4.0, note: notes.sync ?? 'missing' },
      { id: 'peer', label: 'peer', x: 9.2, y: 4.0, note: notes.peer ?? 'apply' },
    ],
    edges: [
      { id: 'e-root-c1', from: 'root', to: 'c1', weight: '' },
      { id: 'e-root-c2', from: 'root', to: 'c2', weight: '' },
      { id: 'e-c1-merge', from: 'c1', to: 'merge', weight: '' },
      { id: 'e-c2-merge', from: 'c2', to: 'merge', weight: '' },
      { id: 'e-merge-heads', from: 'merge', to: 'heads', weight: '' },
      { id: 'e-merge-doc', from: 'merge', to: 'doc', weight: '' },
      { id: 'e-heads-sync', from: 'heads', to: 'sync', weight: '' },
      { id: 'e-sync-peer', from: 'sync', to: 'peer', weight: '' },
    ],
  }, { title });
}

function* changeGraph() {
  yield {
    state: graph('Automerge history is a graph of changes'),
    highlight: { active: ['root', 'c1', 'c2', 'merge', 'e-root-c1', 'e-root-c2'], found: ['heads'] },
    explanation: 'An Automerge document keeps the full history of changes. Concurrent edits create multiple tips. Merging records dependencies so later replicas can understand which changes happened before which.',
    invariant: 'The visible document is derived from change history plus deterministic conflict resolution.',
  };

  yield {
    state: labelMatrix(
      'Change record anatomy',
      [
        { id: 'actor', label: 'actor' },
        { id: 'seq', label: 'seq' },
        { id: 'deps', label: 'deps' },
        { id: 'ops', label: 'ops' },
      ],
      [
        { id: 'meaning', label: 'meaning' },
        { id: 'why', label: 'why' },
      ],
      [
        ['who wrote', 'stable ids'],
        ['local order', 'causal chain'],
        ['parents', 'graph edges'],
        ['mutations', 'materialize'],
      ],
    ),
    highlight: { found: ['actor:why', 'deps:why'], active: ['ops:meaning'] },
    explanation: 'A change groups operations and names dependencies. The head set is the set of changes no known later change depends on. Multiple heads mean concurrent frontiers, not necessarily a user-visible conflict.',
  };

  yield {
    state: graph('Heads summarize concurrent frontiers', { heads: 'c1,c2', sync: 'compare', peer: 'needs c2' }),
    highlight: { active: ['c1', 'c2', 'heads', 'sync', 'e-merge-heads', 'e-heads-sync'], found: ['peer'] },
    explanation: 'Sync can compare heads and send missing changes. This is why the Local-First Sync Engine page treats heads as a data structure, not just a debug field.',
  };

  yield {
    state: labelMatrix(
      'JSON-like document model',
      [
        { id: 'map', label: 'map' },
        { id: 'list', label: 'list' },
        { id: 'text', label: 'text' },
        { id: 'counter', label: 'counter' },
      ],
      [
        { id: 'merge', label: 'merge shape' },
        { id: 'use', label: 'use' },
      ],
      [
        ['per key', 'objects'],
        ['ordered elems', 'arrays'],
        ['list chars', 'editors'],
        ['add deltas', 'counts'],
      ],
    ),
    highlight: { found: ['map:merge', 'list:merge', 'text:use'], compare: ['counter:merge'] },
    explanation: 'Automerge gives application developers a JSON-like model while tracking enough operation metadata to merge maps, lists, counters, and collaborative strings.',
  };

  yield {
    state: graph('Materialization turns history into current state', { doc: 'view', sync: 'send gaps', peer: 'same view' }),
    highlight: { active: ['merge', 'doc', 'heads', 'e-merge-doc'], found: ['peer'] },
    explanation: 'The runtime materializes a current object graph from the operation history. Storage and sync keep the history; application code reads and mutates the materialized document.',
  };
}

function* columnarStorage() {
  yield {
    state: labelMatrix(
      'Columnar change storage',
      [
        { id: 'actor', label: 'actor' },
        { id: 'obj', label: 'object' },
        { id: 'key', label: 'key/elem' },
        { id: 'action', label: 'action' },
        { id: 'value', label: 'value' },
      ],
      [
        { id: 'pattern', label: 'pattern' },
        { id: 'compress', label: 'compress' },
      ],
      [
        ['repeats', 'dictionary'],
        ['repeats', 'delta/id'],
        ['nearby', 'run/delta'],
        ['small enum', 'RLE'],
        ['typed', 'codec'],
      ],
    ),
    highlight: { active: ['actor:compress', 'action:compress'], found: ['key:compress'] },
    explanation: 'Automerge storage is built for repetitive history. Columnar layout groups similar fields together so actor ids, object ids, operation types, counters, and values can be compressed effectively.',
    invariant: 'Keeping history is practical only if history is stored compactly.',
  };

  yield {
    state: graph('Compressed storage serves both disk and sync', { merge: 'changes', doc: 'runtime', sync: 'wire', peer: 'load' }),
    highlight: { active: ['merge', 'heads', 'sync', 'peer', 'e-heads-sync', 'e-sync-peer'], compare: ['doc'] },
    explanation: 'The binary format is for storage or transfer. That aligns with the local-first goal: full history can survive offline, be synced later, and still be compact enough for real applications.',
  };

  yield {
    state: labelMatrix(
      'Runtime pressure',
      [
        { id: 'history', label: 'history' },
        { id: 'load', label: 'load' },
        { id: 'memory', label: 'memory' },
        { id: 'server', label: 'server' },
      ],
      [
        { id: 'problem', label: 'problem' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['many edits', 'columnar'],
        ['long replay', 'compact load'],
        ['big docs', 'compressed rt'],
        ['many docs', 'low resident'],
      ],
    ),
    highlight: { found: ['history:fix', 'memory:fix'], active: ['load:fix'] },
    explanation: 'Automerge 3.0 describes moving the compressed representation into runtime to reduce memory use. The lesson is broader: CRDT metadata needs systems-level storage design.',
  };

  yield {
    state: labelMatrix(
      'Document modeling choices',
      [
        { id: 'one', label: 'one doc' },
        { id: 'many', label: 'many docs' },
        { id: 'subdoc', label: 'subsections' },
        { id: 'refs', label: 'refs' },
      ],
      [
        { id: 'benefit', label: 'benefit' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['simple sync', 'large scope'],
        ['local scope', 'many syncs'],
        ['target edits', 'schema work'],
        ['focused read', 'lifetime'],
      ],
    ),
    highlight: { active: ['one:cost', 'many:cost'], found: ['subdoc:benefit', 'refs:benefit'] },
    explanation: 'Automerge modeling docs warn that choosing document boundaries is an application decision. Data structure design continues above the CRDT: what belongs in one document, and what should be a separate sync unit?',
  };

  yield {
    state: labelMatrix(
      'Links to adjacent topics',
      [
        { id: 'seq', label: 'seq CRDT' },
        { id: 'sync', label: 'sync engine' },
        { id: 'arrow', label: 'Arrow' },
        { id: 'yjs', label: 'Yjs' },
      ],
      [
        { id: 'shared', label: 'shared idea' },
        { id: 'contrast', label: 'contrast' },
      ],
      [
        ['stable order', 'different impl'],
        ['heads/gaps', 'repo layer'],
        ['columns', 'analytics file'],
        ['updates', 'struct store'],
      ],
    ),
    highlight: { found: ['arrow:shared', 'seq:shared'], compare: ['yjs:contrast'] },
    explanation: 'Automerge is a good crossroad: it is a CRDT, a sync protocol, a compact storage format, and a JSON-like data modeling layer.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'change graph') yield* changeGraph();
  else if (view === 'columnar storage') yield* columnarStorage();
  else throw new InputError('Pick an Automerge view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Automerge is a CRDT library for local-first collaborative applications. It gives developers a JSON-like document model while preserving the change history needed for offline work, merging, sync, conflict inspection, and version-oriented workflows.',
        'The implementation lesson is that the CRDT is not just a merge function. It is a change graph, head-set summary, operation identity scheme, sync protocol, storage format, and runtime representation.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'An Automerge document stores changes. Each change has an actor, sequence information, dependencies, and operations. Concurrent work creates multiple heads. Merging records dependency relationships and materializes a deterministic current document.',
        'The binary format specification describes serialized Automerge documents as containing complete history of changes and operations. The format is designed for compactness and fast parsing because that history can be large but repetitive. Automerge concepts also describe a compact binary storage format and a transport-agnostic per-document sync protocol.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The main cost is metadata. Collaborative strings may assign identifiers to fine-grained edits; maps and lists track object ids, keys, indexes, dependencies, and values. Without compression, memory and load time can dominate the application.',
        'Automerge 3.0 frames much of the technical work as making large histories practical. It describes compressed columnar storage and a runtime representation that keeps memory use lower for large documents and busy sync servers.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A user edits a project plan offline. Automerge records a local change with operations such as setting a map key, inserting a list item, and editing collaborative text. Another user concurrently edits another section. When the two devices sync, each compares heads, sends missing changes, merges dependencies, and materializes one document. If both users changed the same field, Automerge keeps deterministic conflict information instead of pretending there was no conflict.',
        'The storage layer persists complete history in a compact binary format. The sync layer sends missing changes rather than the whole document. The app layer decides document boundaries: one document per page, many documents per workspace, or a hybrid with refs and repositories.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Automerge does not remove modeling decisions. If an app puts an entire company workspace into one document, sync scope and load time can become the bottleneck. If it splits every tiny object into its own document, discovery and cross-document workflows become harder. CRDTs make merge local; they do not erase schema design.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Automerge binary format specification at https://automerge.org/automerge-binary-format-spec/, Automerge concepts at https://automerge.org/docs/reference/concepts/, Automerge modeling data guide at https://automerge.org/docs/cookbook/modeling-data/, and Automerge 3.0 post at https://automerge.org/blog/automerge-3/. Study Sequence CRDTs for Collaborative Text, Local-First Sync Engine Case Study, Delta-State CRDT Anti-Entropy Case Study, Apache Arrow Columnar Memory Case Study, Delta Bit-Packing Integer Compression, Yjs Struct Store & Updates, and CRDT Snapshot Compaction & Garbage Collection next.',
      ],
    },
  ],
};
