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
  const actors = ['A', 'B', 'C'];
  const numActors = actors.length;
  const ops = { read: 'read', put: 'put', descends: 'descends?', concurrent: 'concurrent', resolve: 'resolve', newVV: 'new VV' };
  const oldVector = 'A:2 B:1 C:0';
  const descVector = 'A:2 B:2 C:0';
  const concVector = 'A:2 B:1 C:1';
  const mergedVector = 'A:2 B:2 C:1';

  yield {
    state: metadataGraph('Version vectors carry causal context with values'),
    highlight: { active: ['client', 'context', 'replica', 'e-client-context', 'e-context-replica'], compare: ['siblings'] },
    explanation: `A replicated key-value store returns a value with a causal context. The client sends that context back on ${ops.put.toUpperCase()}, so the replica can tell whether the new write ${ops.descends} from older state or is ${ops.concurrent} with it.`,
    invariant: `The metadata answers a narrow question for ${numActors} actors: did this write observe that previous value?`,
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
    explanation: `Componentwise comparison across ${numActors} actors (${actors.join(', ')}) gives the decision. If the incoming vector like ${descVector} is greater-or-equal in every slot than ${oldVector} and larger somewhere, it descends. If neither dominates, as with ${concVector}, the writes are ${ops.concurrent} and both survive as siblings.`,
  };

  yield {
    state: metadataGraph('Concurrent versions become siblings, not automatic truth'),
    highlight: { active: ['replica', 'siblings', 'app', 'e-replica-siblings', 'e-siblings-app'], found: ['stored'] },
    explanation: `Version vectors detect the conflict via the ${ops.concurrent} edge; they do not ${ops.resolve} the business problem. A shopping cart can union item additions. A profile name, ledger entry, or permission rule may need a human policy — the ${ops.newVV} edge only records the merged outcome.`,
    invariant: `Causality metadata separates systems conflict from product semantics — the ${ops.resolve} step is always application-owned.`,
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
    explanation: `This is the Dynamo/Riak shape: writes stay available during partitions, reads may later return siblings. When the merged result ${mergedVector} dominates both ${descVector} and ${concVector}, application reconciliation has intentionally replaced the siblings it observed.`,
  };
}

function* dottedVectors() {
  const dots = { bob: 'a:1', sue: 'a:2', rita: 'a:3' };
  const ctx = `ctx ${dots.bob}`;
  const numDots = Object.keys(dots).length;

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
    explanation: `If one server id summarizes multiple client writes, a merged vector can forget which exact event (${dots.bob}, ${dots.sue}) created each sibling. A later write with ${ctx} may have seen Bob but not Sue, yet the server cannot tell and keeps too many siblings.`,
  };

  yield {
    state: dottedGraph('A dot names the one event that created a value'),
    highlight: { active: ['dot1', 'dot2', 'ctx', 'dot3'], found: ['keep'], compare: ['vv'] },
    explanation: `A dotted version vector separates the causal past from the latest event. The vector summarizes the past; the dot, such as ${dots.sue}, names the exact update that introduced one value. With ${numDots} dots tracked, each sibling keeps its individual event identity.`,
    invariant: `A dot like ${dots.bob} is one event, not the whole prefix summarized by a vector entry.`,
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
    explanation: `The incoming ${ctx} covers Bob's dot ${dots.bob}, so Bob is obsolete. It does not cover Sue's dot ${dots.sue}, so Sue is a true concurrent sibling. Rita receives the fresh dot ${dots.rita}.`,
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
    explanation: `Dotted vectors were designed for the production compromise. With ${numDots} dots (${dots.bob}, ${dots.sue}, ${dots.rita}), they keep server-sized metadata while retaining enough event precision to avoid sibling explosions and unsafe pruning behavior.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'The version-vector view compares replicated values using causal metadata. A version vector is a map from actor id to counter, where each counter records how far that actor has advanced.',
        {type: 'image', src: './assets/gifs/version-vectors-dotted-version-vectors.gif', alt: 'Animated walkthrough of the version vectors dotted version vectors visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'The safe inference is dominance. If every component of vector A is less than or equal to vector B, and at least one is smaller, then B includes the causal history of A and can replace it.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Replicated databases need to know whether one write supersedes another or conflicts with it. Physical clocks cannot answer that safely because two replicas can accept writes concurrently while their clocks disagree.',
        {
          type: 'callout',
          text: 'Version vectors make replacement a causality question instead of a clock-sorting guess.',
        },
        'Version vectors exist to preserve updates instead of hiding uncertainty behind last-write-wins. Dotted version vectors refine the same idea when many client writes pass through a smaller set of replica actors.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is one integer version per key. A primary replica can increment it on each write, and the largest number wins.',
        'That breaks when two primaries both accept writes from version 6 and each creates version 7. The number 7 no longer says which value observed the other, so replacing one with the other can delete real work.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Wall-clock last-write-wins is operationally tempting because it always returns one value. The wall is that timestamp order is not causal order.',
        'If Alice adds milk to a cart on replica A while Bob adds eggs on replica B, the later timestamp does not mean the later write saw the earlier one. Keeping only the latest value silently drops one user action.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is partial order. A vector [A:2, B:1] is newer than [A:1, B:1] because it includes all of that history plus one more A event.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/5/55/Vector_Clock.svg', alt: 'Vector clock diagram showing causal and independent events across processes', caption: 'The vector-clock picture shows the same partial-order idea used by version vectors: some events dominate, while independent events remain concurrent. Source: Wikimedia Commons, Schoreck, CC BY-SA 3.0.'},
        'A dotted version vector separates the summary of causal past from the exact event that created one sibling. The context says what the client had seen, and the dot says which actor-counter event produced this value.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A read returns the current value or siblings plus context. A write sends that context back, and the receiving replica increments its own actor counter to create a new event dot.',
        'The store compares the incoming context with existing siblings. Any sibling covered by the context is obsolete; any sibling not covered remains concurrent and must be returned or merged later.',
        'Dotted vectors matter when two siblings share the same actor summary. The dot keeps each sibling identifiable even when the context compresses the rest of the causal past.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The invariant is monotonic counters per actor. If a replica has seen actor A at counter 5, it has incorporated A events through 5 under the representation contract.',
        'Dominance across all actors proves causal replacement. Concurrency is detected when each vector is larger in some component, meaning neither value contains the full history of the other.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Comparison costs O(a), where a is the number of actors in the vector. Storage also grows with actor count, so client-id vectors are precise but can become large.',
        'Server-id vectors bound metadata by replica count, but they can blur distinct client events. Dots add per-sibling precision, which costs a little extra metadata to avoid deleting siblings the client never observed.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Version vectors fit eventually consistent stores that prefer availability and explicit conflict handling over global locking. Shopping carts, offline documents, replicated object stores, and Dynamo-style systems are natural examples.',
        'They are also diagnostic. If an active-active system claims safe writes but only keeps timestamps, it is choosing a conflict policy that can discard concurrent updates.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Causal metadata does not solve semantic merging. It can say two cart updates are concurrent, but the application must decide whether to union items, sum quantities, reject the write, or ask a user.',
        'Vectors can also grow or create many siblings when clients repeatedly write without reading current context. Systems need pruning, read repair, merge functions, or explicit limits, and each choice changes conflict behavior.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Start with key cart at context [A:0, B:0]. Alice writes through replica A, which creates value milk with dot A:1 and context [A:1, B:0].',
        'Bob concurrently writes through replica B from the old context, creating eggs with dot B:1 and context [A:0, B:1]. Neither vector dominates because milk is ahead on A and eggs is ahead on B.',
        'A later client reads both siblings and writes merged cart [milk, eggs] through A. The write carries context [A:1, B:1], creates dot A:2, and covers both older siblings, so the store can replace them with the merged value.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources are Lamport, Time, Clocks, and the Ordering of Events in a Distributed System; Fidge and Mattern on vector clocks; the Amazon Dynamo paper; and Almeida et al. on dotted version vectors. These cover happened-before, replica metadata, siblings, and dot precision.',
        'Study logical clocks, vector clocks, read/write quorums, Dynamo, CRDTs, delta-state anti-entropy, and CAP tradeoffs next. The central lesson is that causality tells you when replacement is safe, while the application owns the merge policy.',
      ],
    },
  ],
};
