// Parameter server case study: distributed ML workers push gradients and pull
// parameters from sharded server nodes under flexible consistency models.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'parameter-server-case-study',
  title: 'Parameter Server Case Study',
  category: 'Papers',
  summary: 'Parameter servers as the distributed-ML lesson: workers push gradients, servers shard model state, and consistency is a knob.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['push pull training', 'consistency and sharding'], defaultValue: 'push pull training' },
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

function architecture(title) {
  return graphState({
    nodes: [
      { id: 'w1', label: 'worker 1', x: 0.9, y: 1.8, note: 'mini-batch' },
      { id: 'w2', label: 'worker 2', x: 0.9, y: 4.0, note: 'mini-batch' },
      { id: 'w3', label: 'worker 3', x: 0.9, y: 6.2, note: 'mini-batch' },
      { id: 'router', label: 'range router', x: 3.0, y: 4.0, note: 'key ranges' },
      { id: 's1', label: 'server shard A', x: 5.3, y: 2.4, note: 'w[0..999]' },
      { id: 's2', label: 'server shard B', x: 5.3, y: 5.6, note: 'w[1000..]' },
      { id: 'replica', label: 'replica', x: 7.7, y: 4.0, note: 'fault tolerance' },
    ],
    edges: [
      { id: 'e-w1-router', from: 'w1', to: 'router', weight: 'push/pull' },
      { id: 'e-w2-router', from: 'w2', to: 'router', weight: 'push/pull' },
      { id: 'e-w3-router', from: 'w3', to: 'router', weight: 'push/pull' },
      { id: 'e-router-s1', from: 'router', to: 's1', weight: 'range A' },
      { id: 'e-router-s2', from: 'router', to: 's2', weight: 'range B' },
      { id: 'e-s1-replica', from: 's1', to: 'replica', weight: 'checkpoint' },
      { id: 'e-s2-replica', from: 's2', to: 'replica', weight: 'checkpoint' },
    ],
  }, { title });
}

function* pushPullTraining() {
  yield {
    state: architecture('Workers train on data; servers own parameters'),
    highlight: { active: ['w1', 'w2', 'w3', 'router', 's1', 's2'], compare: ['replica'] },
    explanation: 'A parameter server splits model parameters across server nodes. Workers process mini-batches, pull needed parameters, compute gradients, and push updates back.',
  };

  yield {
    state: labelMatrix(
      'One training step',
      [
        { id: 'pull', label: 'pull' },
        { id: 'compute', label: 'compute' },
        { id: 'push', label: 'push' },
        { id: 'update', label: 'server update' },
      ],
      [
        { id: 'data', label: 'data moved' },
        { id: 'owner', label: 'owner' },
        { id: 'cost', label: 'cost pressure' },
      ],
      [
        ['parameter slices', 'servers -> workers', 'network'],
        ['gradients', 'workers', 'CPU/GPU'],
        ['gradient slices', 'workers -> servers', 'network'],
        ['new parameters', 'servers', 'staleness/locking'],
      ],
    ),
    highlight: { active: ['pull:data', 'compute:data', 'push:data'], found: ['update:owner'] },
    explanation: 'The abstraction is simple: push and pull key ranges of vectors or matrices. The hard part is communication volume and consistency: workers must not spend all their time waiting for parameter movement.',
    invariant: 'Server shards are the authority for their parameter ranges.',
  };

  yield {
    state: architecture('Range routing sends sparse updates to owning shards'),
    highlight: { active: ['router', 's1', 's2', 'e-router-s1', 'e-router-s2'], found: ['w1', 'w2'] },
    explanation: 'The parameter server paper emphasizes range-based push and pull, sparse updates, replication, and flexible consistency. Sparse models can update only the parameter slices they touched.',
  };

  yield {
    state: labelMatrix(
      'Why ML systems needed this pattern',
      [
        { id: 'dense', label: 'dense model' },
        { id: 'sparse', label: 'sparse model' },
        { id: 'elastic', label: 'elastic workers' },
        { id: 'fault', label: 'worker/server failure' },
      ],
      [
        { id: 'pressure', label: 'pressure' },
        { id: 'response', label: 'response' },
      ],
      [
        ['large matrices', 'shard parameters'],
        ['huge feature space', 'range sparse updates'],
        ['cluster changes', 'server membership'],
        ['long jobs', 'checkpoint and recover'],
      ],
    ),
    highlight: { found: ['dense:response', 'sparse:response', 'fault:response'], compare: ['elastic:pressure'] },
    explanation: 'Distributed ML is not just parallel math. It is a state-management problem over enormous dense and sparse parameters.',
  };
}

function* consistencyAndSharding() {
  yield {
    state: labelMatrix(
      'Consistency models',
      [
        { id: 'sync', label: 'synchronous' },
        { id: 'async', label: 'asynchronous' },
        { id: 'bounded', label: 'bounded staleness' },
      ],
      [
        { id: 'benefit', label: 'benefit' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['stable updates', 'wait for slow workers'],
        ['high throughput', 'stale gradients'],
        ['balance', 'needs staleness tracking'],
      ],
    ),
    highlight: { active: ['sync:benefit', 'async:benefit', 'bounded:benefit'], compare: ['async:cost'] },
    explanation: 'The parameter server makes consistency a knob. Some algorithms tolerate stale gradients. Others need synchronized updates. Throughput and statistical efficiency must be measured together.',
  };

  yield {
    state: architecture('Hot parameter ranges become bottlenecks'),
    highlight: { active: ['s1', 'e-router-s1', 'w1', 'w2', 'w3'], compare: ['s2'] },
    explanation: 'If many workers update the same parameter range, the owning server shard can become hot. Sharding by key range is simple, but model and feature distributions decide the real load.',
  };

  yield {
    state: labelMatrix(
      'Mitigations',
      [
        { id: 'partition', label: 'partition parameters' },
        { id: 'compress', label: 'compress gradients' },
        { id: 'cache', label: 'local cache' },
        { id: 'batch', label: 'batch updates' },
      ],
      [
        { id: 'helps', label: 'helps' },
        { id: 'danger', label: 'danger' },
      ],
      [
        ['spread load', 'bad partition creates hot shard'],
        ['less network', 'lossy updates can hurt convergence'],
        ['fewer pulls', 'stale parameters'],
        ['amortize overhead', 'higher latency'],
      ],
    ),
    highlight: { found: ['partition:helps', 'compress:helps', 'batch:helps'], compare: ['cache:danger'] },
    explanation: 'The systems knobs interact with optimization. A communication trick that improves throughput can still slow model convergence if it increases staleness or noise too much.',
  };

  yield {
    state: labelMatrix(
      'How the pattern evolved',
      [
        { id: 'ps', label: 'parameter server' },
        { id: 'tensorflow', label: 'TensorFlow' },
        { id: 'collective', label: 'collectives' },
        { id: 'ray', label: 'Ray actors' },
      ],
      [
        { id: 'state', label: 'state model' },
        { id: 'good_for', label: 'good for' },
      ],
      [
        ['server-owned parameters', 'sparse/dense shared state'],
        ['graph variables', 'tensor graph training'],
        ['replica all-reduce', 'balanced dense training'],
        ['actor-owned state', 'dynamic AI workloads'],
      ],
    ),
    highlight: { found: ['ps:state', 'tensorflow:state'], compare: ['collective:good_for', 'ray:state'] },
    explanation: 'Parameter servers are one major point in the distributed-ML design space. They explain why state ownership, consistency, and communication shape training systems.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'push pull training') yield* pushPullTraining();
  else if (view === 'consistency and sharding') yield* consistencyAndSharding();
  else throw new InputError('Pick a parameter-server view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A parameter server is a distributed ML architecture where worker nodes compute updates and server nodes maintain shared model parameters. Workers pull parameter ranges, compute gradients, and push updates back.',
        'The case study matters because model training is a stateful distributed system. Parameters are huge, updates can be sparse or dense, and the right consistency model depends on both systems throughput and optimization behavior.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Parameters are partitioned across server shards. Workers process data partitions and communicate with the shards that own the relevant parameter ranges. The framework supports push, pull, sparse updates, replication, elastic membership, and flexible consistency models.',
        'Consistency can be synchronous, asynchronous, or bounded-stale. Synchronous training avoids stale gradients but waits for slow workers. Asynchronous training improves throughput but may use stale parameters.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The dominant costs are network communication, server hot spots, staleness, checkpointing, and recovery. Sparse models can reduce communication but create skew. Dense models can saturate network links. Consistency choices must be evaluated with final model quality, not only examples per second.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Parameter servers have been used in large-scale recommendation, ads, sparse logistic regression, embeddings, and distributed neural network training. The pattern also explains later ML systems choices around variables, collectives, actors, and model-parallel serving.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'More workers do not automatically mean faster training. Communication, staleness, hot shards, and stragglers can dominate. Another misconception is that the parameter server is only an implementation detail; it changes the optimization dynamics by changing when workers see updates.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: OSDI paper at https://www.usenix.org/system/files/conference/osdi14/osdi14-paper-li_mu.pdf, USENIX page at https://www.usenix.org/conference/osdi14/technical-sessions/presentation/li_mu, and CMU abstract at https://www.cs.cmu.edu/~dga/papers/osdi14-paper-li_mu-abstract.html. Study Gradient Descent, Backpropagation, TensorFlow Dataflow Case Study, Ray Distributed Execution Case Study, and Feature Store: Offline/Online Consistency next.',
      ],
    },
  ],
};
