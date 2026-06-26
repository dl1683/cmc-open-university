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
    explanation: 'The parameter server separates compute from state ownership. Workers process mini-batches; server shards own parameter ranges; training is a repeated pull-compute-push loop.',
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
    explanation: 'The API looks simple: pull parameter slices, compute gradients, push updates. The hard part is making network cost, server hot spots, and consistency delays not erase the training speedup.',
    invariant: 'Server shards are the authority for their parameter ranges.',
  };

  yield {
    state: architecture('Range routing sends sparse updates to owning shards'),
    highlight: { active: ['router', 's1', 's2', 'e-router-s1', 'e-router-s2'], found: ['w1', 'w2'] },
    explanation: 'Range routing is why sparse models can be efficient. A worker that touches a small feature set can push only those parameter ranges instead of shipping the whole model every step.',
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
    explanation: 'Consistency is a training knob, not just a storage knob. Async updates may increase examples per second while hurting convergence; synchronous updates may be statistically cleaner but wait for stragglers.',
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
    explanation: 'Every mitigation has an optimization cost. Compression, caching, batching, and loose consistency can improve throughput while adding staleness, noise, or latency that slows final convergence.',
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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the graph as ownership, not as a message diagram. Active workers compute on mini-batches, found server shards own parameter ranges, and compare nodes show replication or consistency costs that appear after the simple push-pull loop begins.',
        'A parameter is a learned value such as a weight or embedding row. The safe inference rule is that a worker may compute locally, but the owning shard is the authority for its parameter range.',
        {type:'callout', text:'A parameter server turns model training into a sharded state-management system where consistency, ownership, and update routing are explicit design choices.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Large models and sparse feature spaces can have more state than one machine should own during training. A recommendation model may have 500 million embedding rows, while one mini-batch touches only 20,000 of them.',
        'A parameter server exists to split model state across server shards while workers process data in parallel. The system lets workers pull the slices they need, compute updates, and push changes back to the shards that own those keys.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is full replication. Give every worker a full model copy, compute gradients, then synchronize everyone at each step.',
        'That works for many dense models when all-reduce collectives are efficient. It is wasteful for sparse models because every worker communicates dense state even when its examples touched a tiny key subset.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The first wall is bandwidth. If a model has 10 GB of parameters and each step touches 50 MB of sparse rows, moving the whole model or a full dense gradient can waste two orders of magnitude of network traffic.',
        'The second wall is synchronization. A strict barrier waits for the slowest worker, so one straggler can idle a cluster even when the optimizer could tolerate some stale updates.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Make learned state a sharded distributed key-value store with machine-learning update semantics. Workers own compute; server shards own parameter ranges; a router maps keys to shards.',
        'Consistency becomes an algorithm choice. Synchronous, asynchronous, and bounded-stale training are not only storage modes, because they change which parameter version a gradient was computed against.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A worker reads a mini-batch, extracts the parameter keys it needs, pulls those values from the owning shards, computes gradients or updates, and pushes changed keys back. The server applies updates, stores optimizer state, checkpoints progress, and may replicate state for recovery.',
        'Sparse models benefit because the pull and push sets are much smaller than the model. Dense paths may still use collectives, while sparse embedding rows use server ownership and key routing.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness property is ownership. For any parameter key at a logical time, the system has a shard responsible for applying updates and serving reads, so workers do not invent conflicting authorities.',
        'Training correctness depends on the optimizer tolerance. If stale gradients still reduce the loss toward the target quality, asynchronous execution can improve time to quality; if staleness breaks convergence, the system must tighten barriers or staleness bounds.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Per step, the worker pays compute for the mini-batch and network for the pulled and pushed parameter slices. If 100 workers each touch 20 MB per step, the servers see about 2 GB of traffic per step before replication and protocol overhead.',
        'When workers double, compute capacity doubles only if shard bandwidth, hot-key load, and update locks keep up. The practical bottleneck is often a popular embedding range that receives far more updates than an even partition predicted.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Parameter servers fit sparse logistic regression, recommendation systems, ads models, topic models, large embedding tables, and older distributed neural-network training. The access pattern is keyed and sparse: each example touches a small fraction of a very large parameter space.',
        'The pattern also explains modern systems that look different on the surface. Distributed embeddings, actor-owned state, feature-store freshness, and model-serving state placement all ask who owns the value, who can update it, and how fresh a read must be.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails for balanced dense training when collectives can move gradients more efficiently than a routed server design. In that case, all workers need most parameters every step, so the key-value advantage disappears.',
        'It also fails when throughput metrics hide optimizer damage. A run can process 2 times more examples per second and still cost more if stale or noisy updates require 3 times more steps to reach the same validation score.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A model has 1,000,000 embedding rows, each 128 float32 values, so the embedding table is about 512 MB. A mini-batch touches 4,000 rows, which is about 2 MB of parameter data.',
        'With 50 workers, a parameter server design moves about 100 MB of pulls plus 100 MB of pushes per step before compression. Full dense synchronization would move 25.6 GB per direction for the embedding table alone, even though most rows were untouched.',
        'Now assume one feature row appears in 30 percent of examples. The shard that owns it becomes hot, so the system may need row replication, local caching, frequency-aware partitioning, or a separate dense-style path for that key.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study the OSDI parameter server paper at https://www.usenix.org/system/files/conference/osdi14/osdi14-paper-li_mu.pdf and the USENIX page at https://www.usenix.org/conference/osdi14/technical-sessions/presentation/li_mu. Read it for the ownership model, consistency choices, and sparse communication argument.',
        'Next, study Gradient Descent, Backpropagation, All-Reduce Collective Communication, TensorFlow Dataflow Case Study, Ray Distributed Execution Case Study, Feature Store Offline and Online Consistency, and LLM Inference Cost Stack. These topics show where parameter servers fit and where newer training systems choose different communication shapes.',
      ],
    },
  ],
};