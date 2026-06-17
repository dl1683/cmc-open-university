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
      heading: 'The distributed training problem',
      paragraphs: [
        'A parameter server is a distributed machine-learning architecture for a specific pressure: the model state is too large, too frequently updated, or too sparsely accessed for a simple single-machine loop. Workers process training data. Server nodes own shared parameters. Workers pull the parameter ranges they need, compute updates, and push those updates back to the servers that own the relevant state.',
        'The design matters because training is not only math. It is also a distributed state-management problem. Gradients have to move across the network. Model variables have to be partitioned, replicated, checkpointed, and recovered. Some algorithms need strict synchronization. Others can tolerate stale reads if the extra throughput improves wall-clock convergence. A parameter server makes those choices explicit instead of hiding them behind one vague idea of "distributed training."',
      ],
    },
    {
      heading: 'The naive approaches and their walls',
      paragraphs: [
        'The simplest approach is full replication. Give every worker a full copy of the model, let each worker compute gradients, then synchronize all workers at every step. That can work well for dense neural networks when collective communication is efficient. But it is painful for huge sparse models, recommendation features, embeddings, and workloads where each example touches only a tiny fraction of the parameters. Moving the whole model or all gradients on every step wastes bandwidth.',
        'The other simple approach is a central model owner. All workers send updates to one server. That quickly becomes a hot spot. The central server runs out of network, CPU, memory bandwidth, or lock capacity. Worse, one busy parameter range can slow the whole system. Large-scale training needs state ownership to be partitioned.',
        'Rigid synchronization is another wall. If every worker must finish every step before any worker can continue, the slowest worker controls the pace. In real clusters, stragglers happen. Machines vary, data partitions differ, network hiccups occur, and preemption or failure interrupts long jobs. Some ML algorithms can still make progress with stale or asynchronous updates, so a system that enforces strict barriers may leave performance unused.',
      ],
    },
    {
      heading: 'Core insight and architecture',
      paragraphs: [
        'The core move is to partition parameters across server shards. A worker reads a mini-batch, determines which parameters it needs, pulls those values from the owning shards, computes gradients or updates, and pushes the updates back. The routing layer maps parameter keys or ranges to server shards. Sparse models benefit because a worker communicates only with the shards for the features present in its data.',
        'This turns the model into a distributed key-value store with ML-specific semantics. The values are weights, embeddings, counters, accumulators, optimizer state, or other learned parameters. The operations are pull, push, update, aggregate, checkpoint, and recover. The system needs to handle sparse keys, dense tensors, hot parameters, stale values, and long-running failures.',
        'The architecture can also support replication. Parameter shards may have backups for fault tolerance or may be replicated for read scalability. Checkpointing is essential because training jobs can run for a long time and produce state that is expensive to reconstruct. A parameter server is therefore part storage system, part communication fabric, part optimizer runtime.',
      ],
    },
    {
      heading: 'Consistency is an algorithmic choice',
      paragraphs: [
        'Parameter-server systems are educational because consistency is not only a systems property; it changes the optimization algorithm. In synchronous training, workers compute updates from the same logical parameter version and the system applies a coordinated step. This gives cleaner reasoning but waits for stragglers. It can also require large synchronization traffic.',
        'In asynchronous training, workers pull parameters, compute updates, and push them without waiting for all other workers. Throughput can rise because workers keep moving, but a worker may compute from stale parameters. The update it sends may no longer match the current model. Sometimes that is acceptable. Sometimes it harms convergence or final quality. You cannot judge the system only by examples per second.',
        'Bounded staleness sits between those extremes. Workers may lag, but only within a configured limit. This preserves some throughput advantage while limiting how old the parameters can be. The important lesson is that the right consistency model depends on the model, data distribution, optimizer, loss surface, and quality target. Systems metrics and ML metrics must be measured together.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The design works when model access is naturally partitionable. Sparse feature models and embedding-heavy recommenders are classic fits. Each example touches a small set of keys, so workers avoid moving the whole model. Server shards let the system scale memory and update bandwidth across machines.',
        'It also works when the training algorithm can tolerate some communication delay. If staleness does not destroy convergence, asynchronous or bounded-stale execution can use more cluster capacity than strict barriers. This is the same systems trade seen elsewhere: give up some freshness to gain throughput, then verify that the final result still meets the quality target.',
        'The architecture gives operators explicit levers. They can change the sharding function, add server capacity, split hot ranges, checkpoint more or less often, tune staleness, or separate dense and sparse parameter paths. That visibility is useful. A distributed training job that hides all state movement inside a black-box collective may be simpler when it works, but harder to diagnose when a sparse feature range becomes hot.',
      ],
    },
    {
      heading: 'Where it matters',
      paragraphs: [
        'Parameter servers have been used in large-scale recommendation systems, ads models, sparse logistic regression, topic models, embeddings, and distributed neural-network training. They are especially natural when the parameter space is keyed and sparse: feature IDs, user IDs, item IDs, word IDs, or embedding rows.',
        'The pattern also helps explain later systems choices. TensorFlow variables, distributed embeddings, actor-based training systems, model-parallel serving, and feature-store consistency all contain echoes of the same question: who owns this state, who can update it, how fresh must reads be, and how does the system recover?',
        'Parameter servers are not the only answer. Dense data-parallel training often favors all-reduce collectives because every worker needs to communicate dense gradients and high-performance collective libraries can use the network efficiently. Sharded optimizers, model parallelism, pipeline parallelism, and fully sharded data parallelism solve different shapes. The parameter server remains a key conceptual tool because it makes ownership and consistency visible.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'Hot shards are the most obvious failure. A clean hash or range partition can still fail if a few popular features receive most updates. The server that owns those keys becomes the bottleneck. Sparse communication reduces total bytes but can increase skew. Good systems need hot-key detection, better partitioning, caching, replication, or special treatment for popular parameters.',
        'Staleness is the most subtle failure. Throughput can look excellent while the optimizer wastes work or converges to a worse model. The right metric is not examples per second. It is time to target quality, final model quality, and cost to reach that quality. A faster system that needs many more updates may be worse.',
        'Checkpointing and recovery are also central. A parameter server stores valuable learned state. If checkpoints are too frequent, IO can dominate. If they are too rare, failures lose too much work. Recovery must restore both parameter values and enough metadata to avoid applying stale or duplicated updates incorrectly.',
      ],
    },
    {
      heading: 'Practical guidance',
      paragraphs: [
        'Use a parameter-server design when model state is large, naturally keyed, sparsely updated, or too large for comfortable full replication, and when the algorithm can be evaluated under explicit consistency choices. Measure convergence time and final quality, not only throughput.',
        'Watch server shard load, hot key ranges, network bytes per step, pull latency, push latency, update staleness, checkpoint time, worker stragglers, retry rates, and recovery time. Split dense and sparse paths when needed. If the model is dense and balanced, collectives may be simpler and faster.',
      ],
    },
    {
      heading: 'What to remember',
      paragraphs: [
        'A parameter server is not just a box that stores weights. It is a distributed ownership model for learned state. Workers compute. Server shards own parameters. Consistency choices decide how old a worker view may be. Those choices change both systems performance and ML behavior.',
        'The deep lesson is to evaluate distributed training at the intersection of throughput and convergence. A system can move many examples per second and still be poor if it creates hot shards, excessive staleness, weak recovery, or lower final quality.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: OSDI paper at https://www.usenix.org/system/files/conference/osdi14/osdi14-paper-li_mu.pdf, USENIX page at https://www.usenix.org/conference/osdi14/technical-sessions/presentation/li_mu, and CMU abstract at https://www.cs.cmu.edu/~dga/papers/osdi14-paper-li_mu-abstract.html. Study Gradient Descent, Backpropagation, TensorFlow Dataflow Case Study, Ray Distributed Execution Case Study, Feature Store: Offline/Online Consistency, and LLM Inference Cost Stack next.',
      ],
    },
  ],
};
