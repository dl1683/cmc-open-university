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
    explanation: 'Automerge stores history, not just current JSON. Concurrent edits create multiple tips, and merge records dependencies so later replicas can tell which changes knew about which earlier changes.',
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
    explanation: 'A change record carries actor, sequence, dependencies, and operations. Heads are the current frontier: changes no known later change depends on. Multiple heads often mean normal concurrency, not an error.',
  };

  yield {
    state: graph('Heads summarize concurrent frontiers', { heads: 'c1,c2', sync: 'compare', peer: 'needs c2' }),
    highlight: { active: ['c1', 'c2', 'heads', 'sync', 'e-merge-heads', 'e-heads-sync'], found: ['peer'] },
    explanation: 'Heads make sync incremental. If a peer reports heads that exclude c2, the sender can transmit the missing change instead of replaying or shipping the entire document.',
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
    explanation: 'The JSON-like model is the developer surface. Under it, Automerge tracks object IDs, keys, list positions, counters, text operations, and conflicts so normal-looking data can still merge offline work.',
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
    explanation: 'Columnar storage exploits repetition in history. Actor IDs repeat, object IDs repeat, action kinds repeat, and counters often delta well. Grouping similar fields makes full history cheaper to keep.',
    invariant: 'Keeping history is practical only if history is stored compactly.',
  };

  yield {
    state: graph('Compressed storage serves both disk and sync', { merge: 'changes', doc: 'runtime', sync: 'wire', peer: 'load' }),
    highlight: { active: ['merge', 'heads', 'sync', 'peer', 'e-heads-sync', 'e-sync-peer'], compare: ['doc'] },
    explanation: 'The same compact representation supports disk and wire use. That matters for local-first apps: keeping full history is useful only if loading, saving, and syncing it are not dominated by metadata overhead.',
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
    explanation: 'Document boundaries are an application data-structure decision. One huge document simplifies references but broadens every sync. Many tiny documents reduce scope but make discovery, transactions, and lifecycle harder.',
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
    explanation: 'Automerge sits at a useful crossroads: CRDT semantics, change DAG, sync frontier, compact storage, and JSON-like modeling. Studying it shows why local-first design is more than a merge function.',
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
      heading: 'Why this exists',
      paragraphs: [
        `Automerge exists for local-first software, where users can edit shared data without assuming one always-reachable server orders every write. A notes app, task board, design tool, or project planner may need to work on a train, across devices, through flaky networks, or against several sync servers. The user still expects the document to merge later without losing work.`,
        `The product surface is intentionally familiar. Application code works with a JSON-like document made of maps, lists, text, counters, and simple values. The implementation underneath is not a plain JSON object. It is a durable history of changes, operation IDs, dependencies, conflicts, and sync state. That hidden structure is what lets offline replicas become consistent again.`,
      ],
    },
    {
      heading: 'The naive approach',
      paragraphs: [
        `The simple answer is to store the latest JSON blob and let the server choose a winner. On each save, overwrite the old value. On conflict, keep the newest timestamp, ask the user to choose, or merge fields with a few custom rules. This works for single-user settings and small server-centered apps.`,
        `It breaks when two users edit different parts of the same document while disconnected. Last writer wins can erase a paragraph, a list insertion, or a counter increment that was never logically in conflict. A timestamp also cannot tell which write knew about which earlier write. Without causal information, the system cannot distinguish "this update replaces that value" from "these two updates were concurrent."`,
        `Shipping the whole JSON document on every sync is also wasteful. A one-character edit should not require sending a megabyte document. More importantly, sending only the current state loses the reason that state exists. A peer that missed one old change needs that missing change, not a vague statement that the final object is different.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `The core insight is to store changes as the source of truth and derive the visible document from them. Each change has an actor, local sequence information, dependencies, and operations. Dependencies form a directed acyclic graph. The current heads are the frontier: changes that no known later change depends on.`,
        `This gives sync a compact question to ask. If two peers compare heads, each can infer which changes the other may be missing. They can exchange changes rather than whole materialized documents. Concurrent edits create multiple heads. A later merge change records both heads as dependencies, so the graph remembers that the merge saw both branches.`,
        `The second insight is that complete history must be stored like a systems problem, not like a pile of objects. Operation histories are repetitive. Actor IDs repeat, object IDs repeat, action kinds repeat, counters move by small deltas, and keys cluster. Automerge's binary format uses columnar storage so similar fields sit together and compress well.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `A user edit becomes one or more operations inside a change. Setting a map key, inserting a list element, editing collaborative text, or incrementing a counter is recorded with object identity and operation identity. The application reads a materialized document, but the durable record is the change history.`,
        `When two actors edit offline, each actor extends its own causal branch. The document now has multiple heads. That is not an error. It is the honest representation of concurrent work. When a replica receives both branches, it can apply deterministic merge rules to produce a current view while still preserving conflict information where application code may need to show or resolve it.`,
        `Sync uses the change graph. A peer can advertise the heads it has. Another peer can walk dependencies and send the missing changes. This is much cheaper and clearer than replaying every document version or sending the whole current JSON value. The graph also supports history inspection and version-oriented workflows because old changes remain named objects, not vanished intermediate states.`,
        `Storage uses a different shape from the developer API. Instead of keeping every operation as a verbose object with repeated field names, the binary representation groups fields into columns. One column may describe actors, another object references, another keys or elements, another actions, and another values. Compression works because each column has a narrow vocabulary or predictable numeric pattern.`,
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        `The change-graph visual proves that a local-first document is not a single mutable blob. The root, concurrent branches, merge node, heads, materialized document, sync node, and peer show different roles. Heads summarize the frontier. Dependencies show causality. The materialized document is a view derived from history, not the storage contract itself.`,
        `The columnar-storage visual proves the hidden cost of CRDT design. Keeping every change is useful only if the history stays cheap enough to load, store, and transmit. The table turns "CRDT metadata" into concrete fields: actor, object, key, action, and value. The point is not that columns are fashionable. The point is that similar data compresses better when the format respects its shape.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `The change graph works because dependencies preserve causality. If change B lists change A as a dependency, every replica knows B was made with knowledge of A. If two changes do not depend on each other, they are concurrent. Deterministic merge rules can then make every replica compute the same current value from the same set of changes.`,
        `Operation identity gives the system stable references. A list insertion, object creation, or text edit can be named by the actor and counter that created it. That lets later operations refer to earlier structure without trusting local memory addresses or server order. The graph and operation IDs together replace the missing central clock.`,
        `Columnar storage works because the history has regularity. A document may contain thousands of operations from the same actor against nearby objects and repeated action types. General-purpose object serialization repeats too much structure. A columnar format spends bytes on the changing values and lets runs, dictionaries, deltas, and typed encodings do their job.`,
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        `Automerge trades server simplicity and offline mergeability for metadata. Every meaningful operation needs identity, causal context, and enough information to replay or merge it. Text editing can create many small operations. Long-lived documents can accumulate long histories. Compression reduces this cost, but it does not make history free.`,
        `Runtime representation matters as much as file size. A document that is compact on disk can still become expensive if loading expands the history into many heap objects. Automerge 3's move toward using compressed representation at runtime is an example of the broader lesson: CRDT correctness has to meet memory, load-time, and sync-budget constraints.`,
        `Document boundaries are an application data-structure choice. One large document makes references and transactions easier, but it widens sync scope and load cost. Many small documents make independent sharing and retention easier, but discovery, cross-document references, and lifecycle management become harder. Local-first design moves some server coordination into product modeling.`,
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        `Automerge fits collaborative notes, project plans, shared settings, structured documents, whiteboards, kanban boards, and local-first tools where offline edits are normal rather than exceptional. It is strongest when users need a familiar object model but the product cannot rely on one always-online writer.`,
        `A good example is a project plan. One person edits a task description offline. Another inserts a checklist item. A third increments a counter or changes ownership. When devices reconnect, the peers compare heads, exchange missing changes, merge the graph, and materialize the same document. If two people changed the same field, the conflict remains inspectable instead of being silently erased by time order.`,
        `It also wins when history is part of the product. Version review, audit trails, local undo, conflict explanation, and multi-device repair all benefit from having a graph of changes rather than only the latest state. The same structure that makes merge possible makes debugging possible.`,
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        `The first failure mode is pretending that CRDTs remove schema design. They do not. A bad document boundary can make every small edit sync a huge workspace. A too-fragmented model can make ordinary product actions span many documents with weak transaction semantics. The CRDT can merge each document correctly while the product still feels slow or inconsistent.`,
        `The second failure mode is unbounded history pressure. Busy collaborative text, generated content, or high-frequency object updates can create large histories. Teams need metrics for resident memory, load time, sync payload size, number of heads, and document churn. These are product health signals, not internal curiosities.`,
        `The third failure mode is conflict complacency. Deterministic conflict handling is not the same as user intent. If two people edit the same title, the system can preserve both values or choose a display rule, but the product may still need a clear conflict UI. Automerge prevents silent loss; it does not automatically design the human workflow.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Study Sequence CRDTs for Collaborative Text to understand ordered insertion. Study Delta-State CRDT Anti-Entropy for another sync style, Local-First Sync Engine for repository-level concerns, Yjs Struct Store for a contrasting implementation, and CRDT Snapshot Compaction for history management.`,
        `For storage, read Apache Arrow Columnar Memory and Delta Bit-Packing Integer Compression. For primary Automerge references, use the Automerge concepts guide, binary format specification, modeling-data guide, and Automerge 3.0 post. The key habit is to separate semantic merge from storage engineering. A real local-first system needs both.`,
      ],
    },
  ],
};
