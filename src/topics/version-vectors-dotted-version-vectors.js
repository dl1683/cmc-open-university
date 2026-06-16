// Version vectors and dotted version vectors: causality metadata for
// optimistic replicated key-value stores.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'version-vectors-dotted-version-vectors',
  title: 'Version Vectors & Dotted Version Vectors',
  category: 'Systems',
  summary: 'Causality metadata for Dynamo/Riak-style stores: compare version vectors to detect descendants or siblings, then use dots to avoid false conflict explosions.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['version vectors', 'dotted vectors'], defaultValue: 'version vectors' },
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
  return matrixState({
    title,
    rows,
    columns,
    values: labelsByRow.map((row) => row.map(code)),
    format: (value) => labels[value],
  });
}

function metadataGraph(title) {
  return graphState({
    nodes: [
      { id: 'client', label: 'client', x: 0.8, y: 3.6, note: 'get/put' },
      { id: 'context', label: 'context', x: 2.6, y: 2.0, note: 'VV' },
      { id: 'replica', label: 'replica', x: 4.6, y: 3.6, note: 'key owner' },
      { id: 'stored', label: 'stored', x: 6.7, y: 2.0, note: 'value+VV' },
      { id: 'siblings', label: 'siblings', x: 6.7, y: 5.2, note: 'conflicts' },
      { id: 'app', label: 'app merge', x: 8.8, y: 3.6, note: 'policy' },
    ],
    edges: [
      { id: 'e-client-context', from: 'client', to: 'context', weight: 'read' },
      { id: 'e-context-replica', from: 'context', to: 'replica', weight: 'put' },
      { id: 'e-replica-stored', from: 'replica', to: 'stored', weight: 'descends?' },
      { id: 'e-replica-siblings', from: 'replica', to: 'siblings', weight: 'concurrent' },
      { id: 'e-siblings-app', from: 'siblings', to: 'app', weight: 'resolve' },
      { id: 'e-app-stored', from: 'app', to: 'stored', weight: 'new VV' },
    ],
  }, { title });
}

function dottedGraph(title) {
  return graphState({
    nodes: [
      { id: 'vv', label: 'VV', x: 1.0, y: 3.6, note: 'past' },
      { id: 'dot1', label: 'a:1', x: 3.0, y: 2.0, note: 'Bob' },
      { id: 'dot2', label: 'a:2', x: 3.0, y: 5.2, note: 'Sue' },
      { id: 'ctx', label: 'ctx a:1', x: 5.3, y: 3.6, note: 'seen' },
      { id: 'dot3', label: 'a:3', x: 7.2, y: 2.0, note: 'Rita' },
      { id: 'keep', label: 'keep', x: 8.9, y: 5.2, note: 'Sue' },
    ],
    edges: [
      { id: 'e-vv-dot1', from: 'vv', to: 'dot1', weight: 'event' },
      { id: 'e-vv-dot2', from: 'vv', to: 'dot2', weight: 'event' },
      { id: 'e-dot1-ctx', from: 'dot1', to: 'ctx', weight: 'covered' },
      { id: 'e-ctx-dot3', from: 'ctx', to: 'dot3', weight: 'new' },
      { id: 'e-dot2-keep', from: 'dot2', to: 'keep', weight: 'unseen' },
      { id: 'e-dot3-keep', from: 'dot3', to: 'keep', weight: 'sibling' },
    ],
  }, { title });
}

function* versionVectors() {
  yield {
    state: metadataGraph('Version vectors carry causal context with values'),
    highlight: { active: ['client', 'context', 'replica', 'e-client-context', 'e-context-replica'], compare: ['siblings'] },
    explanation: 'A replicated key-value store returns a value with a causal context. The client sends that context back on PUT, so the replica can tell whether the new write replaces older state or conflicts with it.',
    invariant: 'The metadata answers a narrow question: did this write observe that previous value?',
  };

  yield {
    state: labelMatrix(
      'Vector comparison for one key',
      [
        { id: 'old', label: 'old cart' },
        { id: 'desc', label: 'descendant' },
        { id: 'conc', label: 'concurrent' },
        { id: 'merge', label: 'merged cart' },
      ],
      [
        { id: 'vector', label: 'vector' },
        { id: 'decision' },
      ],
      [
        ['A:2 B:1 C:0', 'stored version'],
        ['A:2 B:2 C:0', 'replace old'],
        ['A:2 B:1 C:1', 'keep as sibling'],
        ['A:2 B:2 C:1', 'app resolved'],
      ],
    ),
    highlight: { found: ['desc:decision', 'merge:decision'], compare: ['conc:decision'] },
    explanation: 'Componentwise comparison gives the decision. If the incoming vector is greater-or-equal in every slot and larger somewhere, it descends from the old version. If neither vector dominates, the writes are concurrent and both values must survive as siblings.',
  };

  yield {
    state: metadataGraph('Concurrent versions become siblings, not automatic truth'),
    highlight: { active: ['replica', 'siblings', 'app', 'e-replica-siblings', 'e-siblings-app'], found: ['stored'] },
    explanation: 'Version vectors detect the conflict; they do not solve the business problem. A shopping cart can union item additions. A profile name, ledger entry, or permission rule may need a human policy or consensus instead.',
    invariant: 'Causality metadata separates systems conflict from product semantics.',
  };

  yield {
    state: labelMatrix(
      'Dynamo-style case study',
      [
        { id: 'get', label: 'GET cart' },
        { id: 'put1', label: 'PUT add book' },
        { id: 'put2', label: 'PUT add cable' },
        { id: 'read', label: 'read after heal' },
      ],
      [
        { id: 'context', label: 'context' },
        { id: 'result' },
      ],
      [
        ['A:4 B:2', 'client sees cart'],
        ['A:5 B:2', 'descends old'],
        ['A:4 B:3', 'concurrent sibling'],
        ['two values', 'merge required'],
      ],
    ),
    highlight: { active: ['put1:context', 'put2:context'], compare: ['read:result'] },
    explanation: 'This is the Dynamo/Riak shape: writes stay available during partitions, reads may later return siblings, and application reconciliation creates a new value with context that dominates the siblings it intentionally replaces.',
  };
}

function* dottedVectors() {
  yield {
    state: labelMatrix(
      'Where plain server vectors lose precision',
      [
        { id: 'bob', label: 'Bob' },
        { id: 'sue', label: 'Sue' },
        { id: 'rita', label: 'Rita' },
        { id: 'bad', label: 'stored set' },
      ],
      [
        { id: 'metadata', label: 'metadata' },
        { id: 'outcome' },
      ],
      [
        ['a:1', 'first value'],
        ['a:2', 'true sibling'],
        ['ctx a:1', 'should replace Bob'],
        ['a:3 for all', 'false siblings grow'],
      ],
    ),
    highlight: { removed: ['bad:outcome'], active: ['rita:metadata'] },
    explanation: 'If one server id summarizes multiple client writes, a merged vector can forget which exact event created each sibling. A later write may have seen Bob but not Sue, yet the server cannot tell and keeps too many siblings.',
  };

  yield {
    state: dottedGraph('A dot names the one event that created a value'),
    highlight: { active: ['dot1', 'dot2', 'ctx', 'dot3'], found: ['keep'], compare: ['vv'] },
    explanation: 'A dotted version vector separates the causal past from the latest event. The vector summarizes the past; the dot, such as a:2, names the exact update that introduced one value.',
    invariant: 'A dot is one event, not the whole prefix summarized by a vector entry.',
  };

  yield {
    state: labelMatrix(
      'Dotted update decision',
      [
        { id: 'bob', label: 'Bob dot a:1' },
        { id: 'sue', label: 'Sue dot a:2' },
        { id: 'rita', label: 'Rita dot a:3' },
        { id: 'final', label: 'final siblings' },
      ],
      [
        { id: 'seenByCtx', label: 'ctx a:1 sees?' },
        { id: 'decision' },
      ],
      [
        ['yes', 'discard Bob'],
        ['no', 'keep Sue'],
        ['new event', 'store Rita'],
        ['Sue + Rita', 'only real conflict'],
      ],
    ),
    highlight: { found: ['bob:decision', 'final:decision'], compare: ['sue:decision'] },
    explanation: "The incoming context a:1 covers Bob's dot, so Bob is obsolete. It does not cover Sue's dot a:2, so Sue is a true concurrent sibling. Rita receives the fresh dot a:3.",
  };

  yield {
    state: labelMatrix(
      'Metadata tradeoffs',
      [
        { id: 'client', label: 'client IDs' },
        { id: 'server', label: 'server IDs' },
        { id: 'prune', label: 'pruned VV' },
        { id: 'dvv', label: 'DVV' },
      ],
      [
        { id: 'good', label: 'strength' },
        { id: 'risk' },
      ],
      [
        ['accurate', 'grows with clients'],
        ['small', 'false conflicts'],
        ['bounded', 'lost causality'],
        ['accurate + small', 'more metadata logic'],
      ],
    ),
    highlight: { found: ['dvv:good'], compare: ['server:risk', 'prune:risk'] },
    explanation: 'Dotted vectors were designed for the production compromise. They keep server-sized metadata while retaining enough event precision to avoid sibling explosions and unsafe pruning behavior.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'version vectors') yield* versionVectors();
  else if (view === 'dotted vectors') yield* dottedVectors();
  else throw new InputError('Pick a version-vector view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A version vector is causality metadata attached to a replicated value. It tells a Dynamo/Riak-style store whether one value descends from another or whether two writes were concurrent. If the new write descends from the old one, the old value can be replaced. If neither vector dominates, both values are siblings and the application must reconcile them.',
        'A dotted version vector refines the idea by storing a compact causal past plus a dot for the exact event that created each value. The dot lets the store know which sibling a client actually observed and intended to replace. That precision matters when many clients write through a smaller set of server replicas.',
        'This topic builds on Clocks & Ordering, CRDTs, and Read/Write Quorums. It supplies the concrete metadata layer behind Amazon Dynamo Case Study and the sibling-resolution behavior discussed in CAP Theorem.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A version vector is a map from actor id to counter. To compare vectors, check every component. If vector X is less-than-or-equal to vector Y in every slot and strictly lower in at least one slot, then X happened before Y for that object. Y can safely replace X. If X is larger in one slot and Y is larger in another, neither write observed the other. They are concurrent and both must be retained.',
        'The client protocol is simple: GET returns value plus context, and PUT sends back the context the client saw. The server increments the appropriate actor entry and uses comparison to decide whether to discard old values or keep siblings. This is why version vectors are not just timestamps. A timestamp picks a winner. A vector can say "these are concurrent; no automatic winner exists."',
        'Dotted version vectors split metadata into a causal context and an event dot. The vector entry a:4 summarizes all events by actor a up through 4. The dot a:4 names only the fourth event. Storing one dot per sibling preserves which specific update created which value. When a client writes with context a:1, the store can discard a sibling whose dot is a:1, keep a sibling whose dot is a:2, and assign the new value dot a:3.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Client-id version vectors are precise, but metadata can grow with the number of clients that ever update a hot key. Server-id vectors are smaller, bounded by replica count, but can lose precision when one server proxies many clients. Pruning large vectors bounds space, but pruning can create false concurrency or even lost causal knowledge.',
        'Dotted vectors add per-sibling dots and more careful update logic, but they preserve accuracy with server-sized identifiers. The 2012 dotted-version-vector paper argues that the representation grows with the number of servers that register updates for a data element, bounded by replication degree, rather than with clients or updates.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'In a shopping-cart store, Client Y writes Bob with context empty and receives dot a:1. Client X concurrently writes Sue through the same vnode and receives dot a:2. A plain merged server vector may summarize both as a:2 and forget which sibling came from which event. When Y later writes Rita with context a:1, the correct behavior is to replace Bob and keep Sue, because Y saw Bob but not Sue.',
        "A dotted vector makes that decision mechanical. Bob is tagged a:1, Sue is tagged a:2, and Rita is assigned a:3. The incoming context a:1 covers Bob's dot, so Bob is obsolete. It does not cover Sue's dot, so Sue remains a true sibling. The final sibling set is Sue and Rita, not Bob, Sue, and Rita. That is the difference between surfacing real conflicts and manufacturing false ones.",
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Version vectors do not merge business meaning. They only reveal causal structure. If two values are concurrent, a cart can union additions, but a bank balance cannot simply keep both balances. Another misconception is that vector clocks, version vectors, and dotted version vectors are interchangeable. They share shape, but they answer different questions: event ordering across a distributed computation, replica-state comparison for an object, and precise sibling causality for optimistic key-value stores.',
        'A final trap is hiding conflicts with last-write-wins timestamps. LWW keeps the system simple but can silently drop a real update under clock skew. Version vectors and dotted vectors make the conflict explicit so the application or a CRDT-like merge can resolve it deliberately.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Riak dotted-vector explanation at https://riak.com/posts/technical/vector-clocks-revisited-part-2-dotted-version-vectors/index.html?p=9929.html, Riak DVV product note at https://riak.com/products/riak-kv/dotted-version-vectors/index.html?p=10941.html, Dotted Version Vectors paper at https://gsd.di.uminho.pt/members/vff/dotted-version-vectors-2012.pdf, and the DVVSet reference implementation at https://github.com/ricardobcl/Dotted-Version-Vectors. Study Amazon Dynamo Case Study, CRDTs, Delta-State CRDT Anti-Entropy Case Study, CAP Theorem, Read/Write Quorums, and Clocks & Ordering next.',
      ],
    },
  ],
};
