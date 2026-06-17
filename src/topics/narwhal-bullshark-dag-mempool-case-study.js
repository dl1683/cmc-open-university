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
      heading: 'What it is',
      paragraphs: [
        'Narwhal is a DAG-based mempool for Byzantine validators. Its main idea is to separate reliable transaction dissemination from transaction ordering. Instead of making the consensus leader collect and re-broadcast all transaction data, validators and workers create certified batch vertices in a shared DAG. Consensus can then order references to data that has already been disseminated.',
        'Bullshark is a consensus protocol that interprets that DAG. It uses deterministic anchors, strong support, waves, and topological ordering to turn the partially ordered DAG into a linear ledger. The useful mental model is two layers: Narwhal builds an availability-certified causal history; Bullshark reads commitment decisions out of that history.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The classic BFT approach asks a leader to propose transaction batches and gather votes. That is conceptually clean, but the leader can become the data bottleneck. If the leader has to move all transaction bytes, ordering progress is tied to one node\'s bandwidth and scheduling.',
        'Another simple approach is to make the mempool an ordinary gossip layer and let consensus pull from it. That spreads bytes, but it leaves the ordering protocol with weaker evidence about who actually has the data. A digest in consensus is unsafe if honest parties cannot fetch the payload it names.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Separate data availability from ordering, but make the separation cryptographic. Narwhal turns batch dissemination into certified DAG vertices. Bullshark then orders the certified history rather than dragging transaction bytes through every consensus proposal.',
        'This is a data-structure idea before it is a blockchain idea. The mempool becomes a signed, content-addressed DAG with rounds, authors, parent certificates, and availability evidence. Consensus becomes a deterministic interpretation over that DAG.',
      ],
    },
    {
      heading: 'What the animation teaches',
      paragraphs: [
        'The DAG-mempool view shows why a vertex is more than a batch pointer. It includes availability evidence and parent links to prior certified vertices. Those parent links make causal history inspectable.',
        'The Bullshark-order view shows how a partial order becomes a ledger. Anchors and strong support identify what can be committed; deterministic topological ordering linearizes newly committed ancestors.',
      ],
    },
    {
      heading: 'DAG mempool as a data structure',
      paragraphs: [
        'A Narwhal vertex contains a batch digest, author, round, parent certificates, and signatures or acknowledgments that prove enough validators have stored the data. Edges point backward to certified vertices from previous rounds. The graph is acyclic because rounds increase monotonically. The parent set is a causal-history commitment: a vertex does not only say "here are my transactions"; it says "these earlier certified batches were visible to me."',
        'The certificate is the availability proof. With 3f + 1 validators, n - f acknowledgments show that enough replicas have the batch, so later validators and clients can fetch it even if f validators are faulty. This does not remove storage, fetch, or garbage-collection problems. It makes them explicit data-structure problems instead of hiding them inside the consensus leader.',
      ],
    },
    {
      heading: 'Bullshark ordering',
      paragraphs: [
        'A DAG is only a partial order. Bullshark turns it into a ledger order by selecting anchor vertices in waves and checking whether later DAG vertices strongly support those anchors. Once an anchor commits, each honest validator deterministically orders the newly reachable, previously unordered ancestors. That final step is topological sorting with a deterministic tie-breaker, not magic consensus dust.',
        'This is why DAG-BFT can avoid some leader bottlenecks. Many validators keep producing vertices at the same time. Faults become missing vertices, invalid certificates, or failed waves rather than one leader blocking every transaction payload. A bad anchor may fail to commit, but honest parties can keep extending the DAG and interpret the next wave.',
      ],
    },
    {
      heading: 'Complete case study: Sui-style consensus evolution',
      paragraphs: [
        'The original Narwhal and Tusk paper framed the bottleneck bluntly: a better mempool, with reliable distribution and storage of transaction causal histories, can unlock high-throughput BFT ledgers. The paper reported large throughput improvements when Narwhal was composed with HotStuff, because the leader no longer re-sent transaction data in the ordering path.',
        'Mysten Labs open-sourced Narwhal/Tusk and Bullshark as a high-throughput mempool and consensus engine. The Sui research-paper index later lists Mysticeti as a deployed continuation of the DAG-consensus lineage. For this curriculum, the sequence matters more than the brand: HotStuff teaches quorum certificates for ordering, Narwhal teaches certified data availability, Bullshark teaches deterministic ordering over a DAG, and Mysticeti teaches how far latency can be reduced when the DAG layer is redesigned again.',
      ],
    },
    {
      heading: 'Systems lessons',
      paragraphs: [
        'The clean separation is the main lesson. Mempool is not a bag of pending transactions; at this scale it is a replicated, signed, content-addressed DAG. Consensus is not responsible for dragging bytes around; it is responsible for choosing an order over already-certified data references. Execution and state sync then need to fetch data, validate certificates, apply transactions, and retain enough history for late peers.',
        'This connects directly to Message Queue, Content-Addressed Merkle DAG Object Store, Topological Sort, HotStuff BFT Quorum Certificate Case Study, Distributed Tracing, Backpressure, and Rate Limiter. A production DAG-BFT system needs all of them: queues for inbound transactions, hashes for identity, graph indexes for ancestors, consensus certificates for safety, tracing for fetch paths, and backpressure for validators that fall behind.',
        'The model also clarifies accountability. If a transaction is delayed, the operator can ask whether it was batched, certified, linked into the DAG, committed by an anchor, fetched for execution, or blocked in state application. Each stage has a different proof object and a different failure mode.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not confuse "DAG" with "no ordering." The DAG is a partial order plus evidence. The ledger still needs a deterministic linearization rule. Do not confuse availability certificates with execution success. A certified batch proves data was disseminated; it does not prove the transactions are valid, non-conflicting, or already applied to state.',
        'Do not ignore garbage collection. If a node prunes a batch before all honest peers can fetch and execute it, certificates become frustrating proof objects pointing to missing data. Do not ignore duplicate transactions either. Many validators can include the same client transaction in different certified batches; execution or a transaction manager must deduplicate by transaction identity. Finally, DAG-BFT reduces leader bottlenecks but does not erase network, storage, crypto, or adversarial scheduling costs.',
      ],
    },
    {
      heading: 'Operational review',
      paragraphs: [
        'A validator implementation needs indexes by round, author, digest, parent, certificate, and commit status. It also needs fetch queues for missing batches, rate limits for peers, signature-verification accounting, and garbage-collection cuts tied to execution progress. The DAG is not useful if the node cannot find, fetch, and retain the vertices that certificates name.',
        'A performance review should separate batch dissemination throughput, certificate formation latency, DAG construction, anchor commitment, deterministic ordering, execution, and state sync. Collapsing those into one transactions-per-second number hides whether the bottleneck is network, crypto, storage, consensus interpretation, or application execution.',
        'Garbage collection is a safety topic, not just a disk topic. A node should prune only below cuts that are no longer needed for fetching, ordering, execution, or late-peer recovery. If pruning outruns those guarantees, certificates become pointers to missing evidence.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Narwhal and Tusk at https://arxiv.org/abs/2105.11827, Facebook Research Narwhal/Tusk page at https://research.facebook.com/publications/narwhal-and-tusk-a-dag-based-mempool-and-efficient-bft-consensus/, Bullshark at https://arxiv.org/abs/2201.05677, partially synchronous Bullshark at https://arxiv.org/abs/2209.05633, Mysten Labs Narwhal repository at https://github.com/MystenLabs/narwhal, Sui Narwhal/Tusk open-source announcement at https://blog.sui.io/narwhal-tusk-open-source/, Mysticeti at https://arxiv.org/abs/2310.14821, and Sui research papers at https://docs.sui.io/references/research-papers.',
        'Study Data Availability Sampling & Erasure Coding Case Study, Namespaced Merkle Tree Proof Case Study, HotStuff BFT Quorum Certificate Case Study, Byzantine Fault Tolerance: When Nodes Lie, Topological Sort, Graph BFS, Message Queue, Content-Addressed Merkle DAG Object Store, Merkle Tree, Distributed Tracing, Backpressure, and Rate Limiter next.',
      ],
    },
  ],
};
