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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the graph view as a history model, not as a picture of the current document. Active nodes are changes being considered, found nodes are known heads or materialized state, and compare nodes are changes whose dependency relation is being tested. A head is a change that no later known change depends on, so multiple heads usually mean normal concurrent editing.',
        'Read the column view as the cost model. Actor, object, key, action, and value columns show that a CRDT stores more than the latest JSON value. The safe inference rule is this: if two peers have the same set of changes, deterministic materialization must produce the same visible document.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Automerge exists for local-first software, where people can edit shared data while offline and merge later. A CRDT, or conflict-free replicated data type, is a data type whose replicas can accept local updates and later converge without a central lock. The hard requirement is not only saving edits; it is saving enough causal history to know which edits were concurrent.',
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/9/93/CRDT_Merge.svg', alt: 'CRDT merge operation', caption: 'CRDTs guarantee that concurrent edits merge deterministically without coordination — the mathematical foundation of Automerge. Source: Wikimedia Commons, CC BY-SA 4.0' },
        'A plain JSON document cannot answer that question. It tells you the latest value, but not which writer saw which earlier write. Automerge keeps changes as durable objects so sync, merge, undo, audit, and conflict display all have a shared source of truth.',
        { type: 'callout', text: 'Automerge\'s core invariant: any two peers that have seen the same set of changes will have identical document state, regardless of the order they received those changes.' },
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is last-writer-wins JSON. Each device saves the whole document, the server keeps the newest timestamp, and clients reload that value. This is easy to build for a single online writer because the timestamp acts like a cheap ordering rule.',
        'It fails as soon as two writers make independent edits while disconnected. A timestamp cannot distinguish replacement from concurrency, and sending the whole document makes a one-character edit cost as much as the full file. The system needs operation identity and dependencies, not only a newer blob.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is causality. If Alice changes the title and Bob adds a checklist item offline, neither edit should erase the other. If Alice and Bob both change the same title, the system must preserve enough information to expose a real conflict instead of hiding loss behind time order.',
        'The second wall is history size. Keeping every operation is useful only if the data remains cheap to load, store, and sync. A local-first document that needs 200 MB of metadata for a small project board is correct in theory and unusable in practice.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Store changes as a directed acyclic graph, or DAG. Each change names its actor, sequence, dependencies, and operations, and dependencies point to the changes this edit knew about. Concurrency is then visible: two changes are concurrent when neither depends on the other.',
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/1/1b/Lamport_clock.svg', alt: 'Lamport logical clock', caption: 'Automerge uses Lamport timestamps to establish a total order over operations from different peers. Source: Wikimedia Commons, CC BY-SA 4.0' },
        'The graph solves merge semantics, but columnar storage solves the systems cost. Operation histories repeat actors, object ids, keys, action kinds, and small counters. Grouping those fields into columns lets dictionaries, run-length encoding, deltas, and typed encodings compress the history.',
        { type: 'callout', text: 'The change graph is a DAG, not a linear log. Each change records its dependencies (parent hashes), so Automerge knows which changes are concurrent and which are causally ordered.' },
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A user edit creates operations such as setting a map key, inserting a list element, or incrementing a counter. The runtime appends those operations to a change whose dependencies are the current heads. The materialized document is then derived from the set of changes by deterministic rules.',
        'Sync compares heads first. If peer A has heads h1 and h2 and peer B has only h1, A can send the missing branch instead of replaying the whole document. A later merge change can depend on both h1 and h2, which records that it saw both branches.',
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/d/d2/Internet_map_1024.jpg', alt: 'Distributed network topology', caption: 'Automerge peers can sync through any network topology — direct, relayed, or store-and-forward — because merge is commutative and associative. Source: Wikimedia Commons, The Opte Project, CC BY 2.5' },
        'The stored representation is not one object per operation. It is a compact binary history with fields split into columns. That keeps the semantic model rich while making the physical format close to a database log.',
        { type: 'callout', text: 'Columnar encoding is not just compression — it enables efficient partial sync. A peer can request only the columns it needs for a particular merge operation.' },
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness comes from two invariants. First, dependencies preserve causal order, so a replica never has to guess whether one edit knew about another. Second, deterministic conflict rules mean the same set of changes produces the same document on every peer.',
        'Operation ids give later edits stable targets. A list insertion can refer to the element it follows, and a map update can refer to the object and key it changes. Those ids replace the missing central server order with names that survive across devices.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost is metadata. Every operation needs identity, dependencies, and enough information to replay or merge it. If a text editor records 50,000 small edits, the history can dominate the visible document unless compression and compaction are engineered carefully.',
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/4c/Row_and_column_major_order.svg', alt: 'Columnar data layout', caption: 'Automerge\'s columnar encoding stores operation fields in separate columns, achieving 10-100x compression over JSON change logs. Source: Wikimedia Commons, Cmglee, CC BY-SA 4.0' },
        'Columnar storage changes behavior when the document grows. Doubling the number of similar edits does not double every overhead field because repeated actors, object ids, and action names compress well. The dominant costs become load time, resident memory, sync payload, and conflict UI, not only file size.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Automerge fits shared notes, project plans, forms, boards, outlines, and structured documents where offline editing is normal. The access pattern is local mutation followed by later sync with peers that may have seen a different prefix of history. The product wants object-like data, but the system needs graph-like history.',
        'It also fits products where history is valuable in its own right. Version review, audit trails, local undo, and conflict explanation all benefit from named changes. The same graph that lets replicas converge also lets engineers explain why a value exists.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Automerge fails when teams treat CRDT merge as a substitute for product modeling. One giant document makes every small edit share one sync scope; thousands of tiny documents make discovery and cross-document consistency hard. The CRDT can merge correctly while the application boundary is still wrong.',
        'It also fails under high-churn data with little user value in history. Telemetry streams, counters updated many times per second, and generated bulk edits can create metadata pressure faster than users benefit from conflict-free merge. Those workloads often need aggregation, snapshots, or server-side logs instead.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a task document starts at change root. Alice edits offline and creates change A1 with dependency root: set title to Launch plan. Bob edits offline and creates B1 with dependency root: insert checklist item Buy domain. The document now has two heads, A1 and B1, and neither branch overwrites the other.',
        'When Alice receives B1, her device materializes title Launch plan plus the checklist item. It then creates merge change M1 with dependencies A1 and B1. If each change record were 220 bytes as JSON and 40 bytes in columnar binary form, 10,000 edits would drop from about 2.2 MB to about 0.4 MB before indexes and snapshots. The correctness does not come from compression; compression makes the correct history practical.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Use the Automerge documentation for the concepts guide, sync protocol, binary format, and data modeling guidance. Study CRDT papers for the convergence proof, Lamport clocks for causal ordering, and Apache Arrow or columnar database layouts for the storage idea. The important split is semantic merge first, physical encoding second.',
        'Study next by role: sequence CRDTs for collaborative text, delta-state CRDT anti-entropy for another sync style, local-first sync engines for repository design, and snapshot compaction for bounding history. Then compare Automerge with Yjs to see a different implementation of the same local-first pressure.',
      ],
    },
  ],
};
