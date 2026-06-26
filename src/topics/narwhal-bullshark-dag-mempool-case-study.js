// Narwhal and Bullshark: DAG mempool certificates, reliable dissemination,
// causal histories, anchor commits, and deterministic topological ordering.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'narwhal-bullshark-dag-mempool-case-study',
  title: 'Narwhal Bullshark DAG Mempool Case Study',
  category: 'Systems',
  summary: 'A DAG-BFT case study: separate transaction dissemination from ordering with worker batches, certified vertices, causal DAG rounds, Bullshark anchors, and deterministic ancestor ordering.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['dag mempool', 'bullshark order'], defaultValue: 'dag mempool' },
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

function pipelineGraph(title) {
  return graphState({
    nodes: [
      { id: 'client', label: 'client', x: 0.7, y: 3.8, note: 'txs' },
      { id: 'w1', label: 'worker', x: 2.3, y: 2.1, note: 'batch' },
      { id: 'w2', label: 'worker', x: 2.3, y: 5.5, note: 'batch' },
      { id: 'digest', label: 'digest', x: 4.0, y: 3.8, note: 'hash' },
      { id: 'primary', label: 'primary', x: 5.7, y: 3.8, note: 'vertex' },
      { id: 'acks', label: 'acks', x: 7.0, y: 2.1, note: '2f+1' },
      { id: 'cert', label: 'cert', x: 7.0, y: 5.5, note: 'proof' },
      { id: 'dag', label: 'DAG', x: 8.7, y: 3.8, note: 'rounds' },
    ],
    edges: [
      { id: 'e-client-w1', from: 'client', to: 'w1' },
      { id: 'e-client-w2', from: 'client', to: 'w2' },
      { id: 'e-w1-digest', from: 'w1', to: 'digest' },
      { id: 'e-w2-digest', from: 'w2', to: 'digest' },
      { id: 'e-digest-primary', from: 'digest', to: 'primary' },
      { id: 'e-primary-acks', from: 'primary', to: 'acks' },
      { id: 'e-acks-cert', from: 'acks', to: 'cert' },
      { id: 'e-cert-dag', from: 'cert', to: 'dag' },
      { id: 'e-primary-dag', from: 'primary', to: 'dag' },
    ],
  }, { title });
}

function dagGraph(title) {
  const xs = [1.0, 3.0, 5.0, 7.0];
  const ys = [1.4, 3.0, 4.6, 6.2];
  const vals = ['A', 'B', 'C', 'D'];
  const nodes = [];
  for (let r = 1; r <= 4; r += 1) {
    for (let i = 0; i < vals.length; i += 1) {
      nodes.push({
        id: `${vals[i].toLowerCase()}${r}`,
        label: `${vals[i]}${r}`,
        x: xs[r - 1],
        y: ys[i],
        note: `r${r}`,
      });
    }
  }
  const edges = [
    { id: 'e-a2-a1', from: 'a2', to: 'a1' },
    { id: 'e-a2-b1', from: 'a2', to: 'b1' },
    { id: 'e-a2-c1', from: 'a2', to: 'c1' },
    { id: 'e-b2-b1', from: 'b2', to: 'b1' },
    { id: 'e-b2-c1', from: 'b2', to: 'c1' },
    { id: 'e-b2-d1', from: 'b2', to: 'd1' },
    { id: 'e-c2-a1', from: 'c2', to: 'a1' },
    { id: 'e-c2-c1', from: 'c2', to: 'c1' },
    { id: 'e-c2-d1', from: 'c2', to: 'd1' },
    { id: 'e-a3-a2', from: 'a3', to: 'a2' },
    { id: 'e-a3-b2', from: 'a3', to: 'b2' },
    { id: 'e-a3-c2', from: 'a3', to: 'c2' },
    { id: 'e-b3-a2', from: 'b3', to: 'a2' },
    { id: 'e-b3-b2', from: 'b3', to: 'b2' },
    { id: 'e-b3-c2', from: 'b3', to: 'c2' },
    { id: 'e-c3-b2', from: 'c3', to: 'b2' },
    { id: 'e-c3-c2', from: 'c3', to: 'c2' },
    { id: 'e-c3-d2', from: 'c3', to: 'd2' },
    { id: 'e-a4-a3', from: 'a4', to: 'a3' },
    { id: 'e-a4-b3', from: 'a4', to: 'b3' },
    { id: 'e-a4-c3', from: 'a4', to: 'c3' },
    { id: 'e-b4-a3', from: 'b4', to: 'a3' },
    { id: 'e-b4-b3', from: 'b4', to: 'b3' },
    { id: 'e-b4-c3', from: 'b4', to: 'c3' },
  ];
  return graphState({ nodes, edges }, { title });
}

function orderGraph(title) {
  return graphState({
    nodes: [
      { id: 'a1', label: 'A1', x: 0.8, y: 4.0, note: 'anchor' },
      { id: 'b1', label: 'B1', x: 0.8, y: 2.4, note: 'batch' },
      { id: 'c1', label: 'C1', x: 0.8, y: 5.6, note: 'batch' },
      { id: 'a2', label: 'A2', x: 3.0, y: 4.0, note: 'anchor' },
      { id: 'b2', label: 'B2', x: 3.0, y: 2.4, note: 'support' },
      { id: 'c2', label: 'C2', x: 3.0, y: 5.6, note: 'support' },
      { id: 'a3', label: 'A3', x: 5.2, y: 4.0, note: 'anchor' },
      { id: 'b3', label: 'B3', x: 5.2, y: 2.4, note: 'support' },
      { id: 'c3', label: 'C3', x: 5.2, y: 5.6, note: 'support' },
      { id: 'order', label: 'order', x: 7.5, y: 4.0, note: 'toposort' },
      { id: 'ledger', label: 'ledger', x: 9.0, y: 4.0, note: 'commit' },
    ],
    edges: [
      { id: 'e-a2-a1', from: 'a2', to: 'a1' },
      { id: 'e-b2-a1', from: 'b2', to: 'a1' },
      { id: 'e-c2-a1', from: 'c2', to: 'a1' },
      { id: 'e-a3-a2', from: 'a3', to: 'a2' },
      { id: 'e-b3-a2', from: 'b3', to: 'a2' },
      { id: 'e-c3-a2', from: 'c3', to: 'a2' },
      { id: 'e-a1-order', from: 'a1', to: 'order' },
      { id: 'e-b1-order', from: 'b1', to: 'order' },
      { id: 'e-c1-order', from: 'c1', to: 'order' },
      { id: 'e-order-ledger', from: 'order', to: 'ledger' },
    ],
  }, { title });
}

function* dagMempool() {
  yield {
    state: pipelineGraph('Narwhal separates data dissemination from ordering'),
    highlight: { active: ['client', 'w1', 'w2', 'digest', 'primary', 'e-client-w1', 'e-client-w2', 'e-w1-digest', 'e-w2-digest', 'e-digest-primary'], compare: ['acks', 'cert'], found: ['dag'] },
    explanation: 'Classic leader-based BFT often makes the consensus leader carry transaction data. Narwhal moves that job into a reliable DAG mempool: workers batch transactions, hash them, and primaries turn available batches into certified vertices.',
    invariant: 'Consensus should order certified data references, not repeatedly redistribute the same payloads.',
  };

  yield {
    state: labelMatrix(
      'A batch certificate is an availability proof',
      [
        { id: 'v1', label: 'v1' },
        { id: 'v2', label: 'v2' },
        { id: 'v3', label: 'v3' },
        { id: 'v4', label: 'v4' },
      ],
      [
        { id: 'has', label: 'has data' },
        { id: 'ack', label: 'acks' },
        { id: 'effect', label: 'effect' },
      ],
      [
        ['yes', 'signed', 'in cert'],
        ['yes', 'signed', 'in cert'],
        ['yes', 'signed', 'in cert'],
        ['maybe', 'silent', 'not needed'],
      ],
    ),
    highlight: { active: ['v1:ack', 'v2:ack', 'v3:ack'], found: ['v1:effect', 'v2:effect', 'v3:effect'], compare: ['v4:has'] },
    explanation: 'With f = 1, three acknowledgments certify that enough validators have stored the batch. Later consensus can safely refer to the digest because honest validators can fetch the data from the certificate holders.',
  };

  yield {
    state: dagGraph('Each round links to a quorum of prior-round vertices'),
    highlight: { active: ['a2', 'a1', 'b1', 'c1', 'e-a2-a1', 'e-a2-b1', 'e-a2-c1'], compare: ['d1'], found: ['a3', 'b3', 'c3'] },
    explanation: 'A Narwhal vertex names its own batch certificate and a set of parent certificates from the previous round. The parent set is a compact causal history: if you have the vertex, you know which earlier certified batches it depends on.',
    invariant: 'The DAG edge is a data-availability dependency, not merely a scheduling hint.',
  };

  yield {
    state: dagGraph('Quorum parent links make missing data bounded'),
    highlight: { active: ['a3', 'a2', 'b2', 'c2', 'e-a3-a2', 'e-a3-b2', 'e-a3-c2'], found: ['a1', 'b1', 'c1'], removed: ['d2'] },
    explanation: 'Because each vertex links to a quorum of prior-round vertices, one missing or faulty validator does not stop the DAG. The strong links also give consensus protocols a common structure to interpret locally.',
  };

  yield {
    state: labelMatrix(
      'What HotStuff no longer carries',
      [
        { id: 'classic', label: 'classic' },
        { id: 'narwhal', label: 'Narwhal' },
        { id: 'hot', label: 'N-HotStuff' },
        { id: 'client', label: 'client' },
      ],
      [
        { id: 'payload', label: 'payload' },
        { id: 'order', label: 'order' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['leader sends', 'leader votes', 'bottleneck'],
        ['workers send', 'DAG certs', 'storage'],
        ['hash refs', 'HotStuff', 'latency'],
        ['proof fetch', 'verify', 'missing data'],
      ],
    ),
    highlight: { compare: ['classic:payload'], active: ['narwhal:payload', 'hot:payload'], found: ['client:order'] },
    explanation: 'Narwhal-HotStuff lets the HotStuff leader propose references to certified data instead of re-broadcasting all transactions. That removes the leader data bottleneck but keeps the ordering proof familiar.',
  };

  yield {
    state: labelMatrix(
      'Data-structure cost map',
      [
        { id: 'batch', label: 'batch' },
        { id: 'cert', label: 'cert' },
        { id: 'dag', label: 'DAG' },
        { id: 'gc', label: 'GC' },
        { id: 'trace', label: 'trace' },
      ],
      [
        { id: 'stores' },
        { id: 'checks' },
        { id: 'pitfall' },
      ],
      [
        ['tx bytes', 'hash', 'large blobs'],
        ['sig set', '2f+1', 'bad signer'],
        ['parents', 'acyclic', 'fork refs'],
        ['round cut', 'commit', 'prune early'],
        ['cert ids', 'fetch path', 'blind spots'],
      ],
    ),
    highlight: { active: ['cert:checks', 'dag:checks', 'gc:checks'], compare: ['batch:pitfall', 'gc:pitfall'] },
    explanation: 'The performance win creates new bookkeeping. You need batch storage, certificate verification, a DAG index by round and authority, garbage collection below committed cuts, and tracing from ledger order back to the batch fetch path.',
  };
}

function* bullsharkOrder() {
  yield {
    state: dagGraph('Bullshark reads consensus structure out of the DAG'),
    highlight: { active: ['a1', 'b1', 'c1', 'a2', 'b2', 'c2', 'a3', 'b3', 'c3'], compare: ['d1', 'd2'] },
    explanation: 'Bullshark runs on top of the Narwhal DAG. Validators keep producing certified vertices every round. Consensus does not require a separate all-to-all view-change protocol; parties interpret the same DAG edges with deterministic rules.',
  };

  yield {
    state: orderGraph('Anchors are deterministic vertices inside waves'),
    highlight: { active: ['a1', 'a2', 'a3'], compare: ['b1', 'c1', 'b2', 'c2', 'b3', 'c3'] },
    explanation: 'Bullshark organizes rounds into waves and selects deterministic anchor vertices. The anchor is not a special payload broadcaster. It is a vertex in the already-certified DAG whose support can be checked by following edges.',
    invariant: 'The leader role becomes a vertex-selection rule over an existing DAG.',
  };

  yield {
    state: orderGraph('Strong support commits an anchor and its history'),
    highlight: { active: ['a1', 'a2', 'b2', 'c2', 'e-a2-a1', 'e-b2-a1', 'e-c2-a1'], found: ['order'], compare: ['a3'] },
    explanation: 'If enough next-round vertices strongly support an anchor, honest parties can commit it. The committed payload is not only the anchor: its uncommitted causal ancestors are pulled into the ledger order.',
  };

  yield {
    state: orderGraph('Committed ancestors are ordered by a deterministic toposort'),
    highlight: { active: ['a1', 'b1', 'c1', 'order', 'ledger', 'e-a1-order', 'e-b1-order', 'e-c1-order', 'e-order-ledger'], compare: ['a2'] },
    explanation: 'After an anchor commits, each node orders the newly reachable, not-yet-ordered ancestors with the same deterministic topological rule. That is the data-structure bridge between a partial-order DAG and a linear ledger.',
    invariant: 'The ledger is a deterministic linearization of certified DAG ancestors.',
  };

  yield {
    state: labelMatrix(
      'Faults become missing vertices, not stalled leaders',
      [
        { id: 'slow', label: 'slow node' },
        { id: 'bad', label: 'bad node' },
        { id: 'net', label: 'net jitter' },
        { id: 'anchor', label: 'bad anchor' },
      ],
      [
        { id: 'effect' },
        { id: 'repair' },
      ],
      [
        ['gap', 'fetch later'],
        ['bad cert', 'reject'],
        ['late edge', 'next wave'],
        ['no commit', 'skip wave'],
      ],
    ),
    highlight: { active: ['slow:repair', 'bad:repair', 'anchor:repair'], compare: ['anchor:effect'] },
    explanation: 'DAG-BFT does not make faults disappear. It changes their shape. A slow validator creates a gap. A Byzantine validator creates invalid certificates. A bad anchor wave can fail to commit. The useful part is that honest validators keep building the DAG in parallel.',
  };

  yield {
    state: labelMatrix(
      'DAG-BFT lineage',
      [
        { id: 'nar', label: 'Narwhal' },
        { id: 'tusk', label: 'Tusk' },
        { id: 'bull', label: 'Bullshark' },
        { id: 'myst', label: 'Mysticeti' },
      ],
      [
        { id: 'main' },
        { id: 'trade' },
        { id: 'study' },
      ],
      [
        ['mempool', 'storage', 'DAG certs'],
        ['async', 'latency', 'waves'],
        ['fast path', 'anchors', 'toposort'],
        ['low delay', 'proof load', 'uncert DAG'],
      ],
    ),
    highlight: { active: ['nar:main', 'bull:main'], found: ['myst:main'], compare: ['tusk:trade'] },
    explanation: 'Narwhal is the data-dissemination layer. Tusk and Bullshark are consensus interpretations on top of the DAG. Mysticeti is a later production lineage that lowers latency further, but it is still best understood after the Narwhal/Bullshark data-structure split.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'dag mempool') yield* dagMempool();
  else if (view === 'bullshark order') yield* bullsharkOrder();
  else throw new InputError('Pick a Narwhal/Bullshark view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation shows Narwhal and Bullshark, a design that separates transaction data dissemination from consensus ordering. Narwhal builds a certified directed acyclic graph, or DAG, of batches, and Bullshark deterministically orders that DAG.',
        'Active nodes show certificates being linked or ordered, compare marks missing parents or insufficient votes, and found marks a batch that has enough support to be used by ordering. The safe inference rule is this: once a certificate names its parents and has quorum support, later ordering can refer to it by digest without moving the full batch again.',
        {type:'callout', text:'Narwhal moves byte dissemination out of the ordering bottleneck by making the mempool itself a certified DAG that Bullshark can deterministically linearize.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/c/c6/Topological_Ordering.svg', alt:'Directed acyclic graph arranged so all arrows point forward in topological order.', caption:'Topological ordering shows how a DAG can be read as a sequence while respecting causal edges. Source: Wikimedia Commons, David Eppstein, CC0'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Consensus systems must both spread transaction bytes and agree on an order. When those jobs are fused, the ordering protocol can become clogged by data transfer, slow validators, or repeated retransmission.',
        'Narwhal and Bullshark exist to decouple the jobs. The mempool makes data available and certified first, then consensus orders compact references to that already-available data.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is leader-based consensus that proposes blocks containing transaction bytes. The leader gathers transactions, broadcasts a block, and replicas vote on the ordered block.',
        'That is simple and works well at modest scale. It becomes fragile when the leader must be both the data broadcaster and the ordering coordinator under high throughput.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is the bandwidth bottleneck around the leader and the ordered block path. If every round depends on one leader pushing all bytes fast enough, slow broadcast becomes slow consensus.',
        'Failures also tangle the two jobs. A leader that withholds data, equivocates, or sends bytes unevenly can force replicas to spend ordering time discovering that the data path was broken.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Narwhal turns the mempool into a certified DAG. Validators create batches, collect signatures into certificates, and link each certificate to parent certificates from earlier rounds.',
        'Bullshark then orders the DAG by deterministic rules over certificates and rounds. The ordering layer moves digests and votes, while the heavy transaction bytes have already been disseminated by the mempool layer.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A validator packages transactions into a batch and broadcasts it. Other validators acknowledge the batch after receiving the data, and enough acknowledgments form a certificate for that batch digest.',
        'Each new certificate references parents from the previous round, creating a DAG with causal edges. Bullshark selects leaders or anchors by round and commits certificates when enough linked structure proves that honest validators will see the same ordering evidence.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness starts with availability. A certificate means a quorum acknowledged the batch data, so ordering a certificate should not refer to unknown bytes under the normal fault assumptions.',
        'Ordering correctness comes from quorum intersection and DAG causality. If two quorums overlap in at least one honest validator, conflicting histories cannot both gather independent support without sharing evidence that deterministic ordering rules can resolve.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost shifts from leader broadcast to many-to-many dissemination. With 100 validators, a round of certificates can involve thousands of acknowledgments, but the work is spread rather than concentrated on one leader.',
        'If batch size doubles, data bandwidth roughly doubles in the mempool layer, while consensus messages over digests change much less. The behavioral win is that ordering latency is less tied to one leader ability to push every byte.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'This design fits high-throughput Byzantine fault tolerant ledgers and blockchain systems where transaction dissemination is a major bottleneck. The access pattern is many validators receiving many batches before a final total order is chosen.',
        'It is also useful for systems that want pipelining. While one set of certificates is being ordered, later rounds can keep disseminating data and building the DAG.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The design is complex. Operators must manage batch storage, certificate exchange, garbage collection, parent availability, equivocation handling, and backpressure between mempool and consensus.',
        'It also needs enough network capacity for broad dissemination. If validators cannot exchange batch data fast enough, certifying a DAG does not remove the underlying bandwidth limit.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose there are 10 validators and the fault model allows f = 3 Byzantine validators, so quorum is 2f + 1 = 7 signatures. Validator A broadcasts a 1 MB batch, receives 7 acknowledgments, and forms certificate A5 for round 5.',
        'In round 6, other certificates include A5 as a parent. Bullshark can order A5 by digest once the DAG contains the required support pattern, without asking the leader to rebroadcast that 1 MB batch inside the ordering message.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: the Narwhal and Tusk paper, the Bullshark paper, and production documentation from systems that adopted DAG mempools. Use BFT consensus papers for quorum-intersection assumptions.',
        'Study next: Byzantine fault tolerance, quorum certificates, DAG topological ordering, mempool design, reliable broadcast, HotStuff, data availability, and consensus garbage collection.',
      ],
    },
  ],
};
