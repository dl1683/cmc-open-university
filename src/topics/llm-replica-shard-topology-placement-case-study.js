// Replica versus shard topology for inference: choose between full-model
// replicas and cross-device shards using latency, memory, and traffic shape.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'llm-replica-shard-topology-placement-case-study',
  title: 'LLM Replica vs Shard Topology Placement Case Study',
  category: 'Systems',
  summary: 'An inference-topology case study: full replicas minimize hops, shards fit bigger models, and the scheduler must account for queueing, collectives, memory, and p99.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['replica mode', 'shard mode'], defaultValue: 'replica mode' },
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

function replicaGraph(title) {
  return graphState({
    nodes: [
      { id: 'router', label: 'router', x: 0.7, y: 3.6, note: 'score' },
      { id: 'repA', label: 'replica A', x: 3.0, y: 1.8, note: 'full model' },
      { id: 'repB', label: 'replica B', x: 3.0, y: 3.6, note: 'full model' },
      { id: 'repC', label: 'replica C', x: 3.0, y: 5.4, note: 'full model' },
      { id: 'queue', label: 'queues', x: 5.2, y: 3.6, note: 'per rep' },
      { id: 'cache', label: 'cache', x: 7.0, y: 2.4, note: 'local' },
      { id: 'answer', label: 'answer', x: 8.7, y: 3.6, note: 'low hop' },
    ],
    edges: [
      { id: 'e-router-a', from: 'router', to: 'repA' },
      { id: 'e-router-b', from: 'router', to: 'repB' },
      { id: 'e-router-c', from: 'router', to: 'repC' },
      { id: 'e-repA-queue', from: 'repA', to: 'queue' },
      { id: 'e-repB-queue', from: 'repB', to: 'queue' },
      { id: 'e-repC-queue', from: 'repC', to: 'queue' },
      { id: 'e-queue-cache', from: 'queue', to: 'cache' },
      { id: 'e-cache-answer', from: 'cache', to: 'answer' },
    ],
  }, { title });
}

function shardGraph(title) {
  return graphState({
    nodes: [
      { id: 'router', label: 'router', x: 0.7, y: 3.6, note: 'assign' },
      { id: 'stage0', label: 'shard 0', x: 2.7, y: 1.8, note: 'layers' },
      { id: 'stage1', label: 'shard 1', x: 4.5, y: 1.8, note: 'layers' },
      { id: 'stage2', label: 'shard 2', x: 6.3, y: 1.8, note: 'layers' },
      { id: 'collective', label: 'collective', x: 4.5, y: 4.0, note: 'TP/PP' },
      { id: 'fabric', label: 'fabric', x: 6.3, y: 4.0, note: 'NVLink/IB' },
      { id: 'answer', label: 'answer', x: 8.3, y: 3.0, note: 'merged' },
    ],
    edges: [
      { id: 'e-router-stage0', from: 'router', to: 'stage0' },
      { id: 'e-stage0-stage1', from: 'stage0', to: 'stage1' },
      { id: 'e-stage1-stage2', from: 'stage1', to: 'stage2' },
      { id: 'e-stage0-collective', from: 'stage0', to: 'collective' },
      { id: 'e-stage1-collective', from: 'stage1', to: 'collective' },
      { id: 'e-stage2-collective', from: 'stage2', to: 'collective' },
      { id: 'e-collective-fabric', from: 'collective', to: 'fabric' },
      { id: 'e-fabric-answer', from: 'fabric', to: 'answer' },
    ],
  }, { title });
}

function* replicaMode() {
  yield {
    state: replicaGraph('Replicas trade VRAM for simpler routing'),
    highlight: { active: ['router', 'repA', 'repB', 'repC', 'e-router-a', 'e-router-b', 'e-router-c'], found: ['queue', 'cache'] },
    explanation: 'A replica is a full copy of the model on each serving unit. Replicas are easier to route and isolate. They are attractive when the model fits comfortably and latency matters more than squeezing maximum parameter count onto the fleet.',
    invariant: 'Replica routing is simple only while each replica has enough memory and queue headroom.',
  };

  yield {
    state: labelMatrix(
      'Replica scoreboard',
      [
        { id: 'a', label: 'rep A' },
        { id: 'b', label: 'rep B' },
        { id: 'c', label: 'rep C' },
      ],
      [
        { id: 'queue', label: 'queue' },
        { id: 'cache', label: 'cache' },
        { id: 'slo', label: 'SLO' },
        { id: 'score', label: 'score' },
      ],
      [
        ['deep', '80%', 'risk', 'hold'],
        ['low', '45%', 'ok', 'win'],
        ['empty', '0%', 'ok', 'maybe'],
      ],
    ),
    highlight: { active: ['b:score', 'b:queue', 'b:slo'], compare: ['a:cache', 'a:queue'] },
    explanation: 'Replica placement is a routing problem. A strong cache hit can lose to a lower queue if the request is interactive. A batch request might choose differently.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'model memory pressure', min: 0, max: 1 }, y: { label: 'p99 latency health', min: 0, max: 1 } },
      series: [
        { id: 'replica', label: 'replica', points: [{ x: 0.20, y: 0.92 }, { x: 0.45, y: 0.84 }, { x: 0.70, y: 0.60 }, { x: 0.92, y: 0.20 }] },
        { id: 'shard', label: 'shard', points: [{ x: 0.20, y: 0.68 }, { x: 0.45, y: 0.73 }, { x: 0.70, y: 0.76 }, { x: 0.92, y: 0.70 }] },
      ],
      markers: [
        { id: 'fit', x: 0.55, y: 0.78, label: 'fit line' },
      ],
    }),
    highlight: { active: ['replica', 'fit'], compare: ['shard'] },
    explanation: 'Replicas win while the model fits with enough KV headroom. As memory pressure rises, replicas lose concurrency and shards become necessary despite extra communication.',
  };

  yield {
    state: labelMatrix(
      'Replica pitfalls',
      [
        { id: 'vram', label: 'VRAM' },
        { id: 'cache', label: 'cache' },
        { id: 'hot', label: 'hot rep' },
        { id: 'roll', label: 'rollout' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'guard', label: 'guard' },
      ],
      [
        ['low concurrency', 'admission'],
        ['cold misses', 'sticky route'],
        ['queue spike', 'power-of-two'],
        ['mixed versions', 'canary'],
      ],
    ),
    highlight: { active: ['vram:guard', 'hot:guard', 'roll:guard'], found: ['cache:guard'] },
    explanation: 'Replicas are operationally clean but not effortless. They still need cache-aware routing, load balancing, canaries, and admission control when KV pressure eats concurrency.',
  };
}

function* shardMode() {
  yield {
    state: shardGraph('Shards fit large models by spending fabric'),
    highlight: { active: ['router', 'stage0', 'stage1', 'stage2', 'e-stage0-stage1', 'e-stage1-stage2'], found: ['collective', 'fabric'] },
    explanation: 'A shard splits the model across devices with tensor parallelism, pipeline parallelism, expert parallelism, or some mix. Sharding fits larger models, but each token now depends on cross-device coordination.',
  };

  yield {
    state: labelMatrix(
      'Shard topology ledger',
      [
        { id: 'tp', label: 'tensor' },
        { id: 'pp', label: 'pipeline' },
        { id: 'ep', label: 'expert' },
        { id: 'kv', label: 'KV' },
      ],
      [
        { id: 'moves', label: 'moves' },
        { id: 'needs', label: 'needs' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['activations', 'all-reduce', 'fabric p99'],
        ['microbatch', 'balance', 'bubble'],
        ['tokens', 'all-to-all', 'hot expert'],
        ['blocks', 'ownership', 'transfer'],
      ],
    ),
    highlight: { active: ['tp:needs', 'ep:needs', 'kv:needs'], compare: ['pp:risk'] },
    explanation: 'The topology ledger records what moves between devices. Tensor parallelism pays collectives, pipeline parallelism pays bubbles, expert parallelism pays all-to-all, and KV ownership affects routing.',
    invariant: 'A shard plan is only as good as the fabric path it assumes.',
  };

  yield {
    state: shardGraph('Fabric health becomes serving health'),
    highlight: { active: ['collective', 'fabric', 'answer', 'e-collective-fabric', 'e-fabric-answer'], compare: ['stage0', 'stage1', 'stage2'] },
    explanation: 'When the model is sharded, an unhealthy link or oversubscribed collective path affects every request using that shard group. Placement must join model topology with rack topology.',
  };

  yield {
    state: labelMatrix(
      'Replica or shard decision',
      [
        { id: 'small', label: 'fits well' },
        { id: 'large', label: 'too large' },
        { id: 'interactive', label: 'interactive' },
        { id: 'batch', label: 'batch' },
        { id: 'moe', label: 'MoE' },
      ],
      [
        { id: 'prefer', label: 'prefer' },
        { id: 'reason', label: 'reason' },
      ],
      [
        ['replica', 'low hop'],
        ['shard', 'memory'],
        ['replica', 'p99'],
        ['either', 'throughput'],
        ['shard group', 'experts'],
      ],
    ),
    highlight: { active: ['small:prefer', 'large:prefer', 'interactive:prefer'], found: ['moe:reason'] },
    explanation: 'The choice is workload-shaped. If the model fits and p99 matters, replicas are usually simpler. If memory or capacity forces sharding, the serving plan must price fabric cost explicitly.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'replica mode') yield* replicaMode();
  else if (view === 'shard mode') yield* shardMode();
  else throw new InputError('Pick a replica/shard topology view.');
}


export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation compares replica placement and shard placement for LLM serving. A replica is a complete copy of the model on one serving group, while a shard is only part of the model placed on one device. Active nodes are the devices being assigned now, visited nodes already have capacity committed, and found nodes form a usable serving group.',
        'The safe inference rule is that a request can run on any healthy replica, but it must visit every required shard in its group. That means replica placement spends memory to gain isolation, while shard placement spends coordination to fit larger models.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'LLM inference means running a trained language model to answer user requests. Large models may need more memory than one GPU can provide, and busy products need enough parallel capacity to meet latency targets. Placement decides which devices hold which model state.',
        'Topology means the physical and logical connection pattern between devices. Two GPUs in the same server may communicate much faster than two GPUs across racks. A placement plan that ignores topology can look correct on a diagram and fail under real token traffic.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to put one full model copy wherever there is free GPU memory. The scheduler counts available memory, picks the next device group, and routes traffic round-robin. This is easy to understand because every replica can answer the same request.',
        'It works for small models and moderate traffic. If the model fits inside one GPU or one fixed server, each replica is a clean failure boundary. Removing a bad replica reduces capacity but does not break the other replicas.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is model state. A 70 billion parameter model stored with 2 bytes per parameter needs about 140 GB for weights before runtime buffers and KV cache. One 80 GB GPU cannot hold that by itself, so a full replica on one device is impossible.',
        'A second wall appears when communication is treated as free. Sharding a model across devices creates collective operations, pipeline waits, or expert routing traffic. If a shard group crosses a slow link, each generated token can pay that penalty.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Placement is a choice between duplication and coordination. Replication duplicates the whole model to make each request independent. Sharding splits the model so a request can fit, then pays communication cost to make the pieces behave like one model.',
        'The invariant is that every admitted request must have enough weight memory, KV cache headroom, and communication bandwidth for its full token path. A device with free memory is not enough if it sits on the wrong side of a slow topology boundary.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A replica plan first defines a serving group that can hold the whole model and its expected KV cache. The scheduler places several identical groups, then routes each request to one group based on queue depth, cache locality, and health. Failures are local because each group is complete.',
        'A shard plan divides the model into required pieces. Tensor parallelism splits matrix work across devices, pipeline parallelism splits layers into stages, and expert parallelism places different experts on different devices. A request succeeds only if all required pieces are available and fast enough together.',
        'A topology-aware scheduler scores candidate groups before committing placement. It prefers devices with high-bandwidth links for tight shard groups and uses weaker links for replicas that do not exchange token-level traffic. The score is not just free memory; it is fit for the request path.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is resource completeness. A replica placement is correct when every chosen group contains all model state needed for a request. A shard placement is correct when the union of its shards contains all required state and the request route visits them in the right order.',
        'The performance argument follows the same boundary. Replicas avoid inter-device model communication during a token step, so queueing and cache state dominate. Shards add communication, so the placement must keep the tightest traffic on the fastest links.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Replication costs memory linearly in the number of copies. If one complete serving group needs 180 GB after weights, KV cache, and runtime buffers, four replicas need about 720 GB. Doubling replicas roughly doubles capacity and memory cost, but it does not double per-request communication.',
        'Sharding reduces per-device memory but adds coordination cost. If a token step needs an all-reduce across four GPUs, every generated token can wait on that group. When output length doubles, the communication tax also doubles because decode repeats the token step.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Replica placement fits low-latency chat tiers where the model fits and request isolation matters. It supports canaries, rollbacks, and tenant separation because one group can be drained without rewriting the whole topology. The access pattern is many independent requests.',
        'Shard placement fits very large model tiers and high-throughput batch jobs. The access pattern is one request needing more model state than a single device can hold, or a batch large enough to amortize coordination. It is common when quality requirements force a larger model than simple replication can serve.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Replication fails when memory duplication is the bottleneck. A fleet may have enough total GPU memory for many shards but not enough memory to duplicate the full model safely. It also wastes cache opportunities if routing ignores prefix reuse.',
        'Sharding fails when the scheduler hides fabric cost. Average GPU utilization can look healthy while p99 latency is bad because one stage or link is overloaded. It also makes failure handling stricter because one missing shard can remove the whole group.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Assume a model needs 140 GB for weights and 40 GB for runtime plus KV cache at the target context length. A full serving group therefore needs 180 GB. With 80 GB GPUs, a replica needs at least three GPUs even before headroom, so two replicas need six GPUs.',
        'Now compare a four-GPU tensor-parallel shard group. Each GPU holds about 45 GB of state, leaving 35 GB for headroom on an 80 GB device. The request fits, but every generated token pays group communication. If the workload generates 200 tokens per request and serves 20 requests per second, the shard group faces 4,000 token steps per second where topology matters.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study NVIDIA Triton model configuration for deployment vocabulary, Ray Serve autoscaling for serving groups, and tensor-parallel inference papers for communication cost. These sources show that placement is a serving contract, not only a memory packing exercise. Read hardware topology docs for the actual link speeds in any real fleet.',
        'Next, study tensor parallelism, pipeline parallelism, GPU all-reduce, SLO-aware routing, and KV-cache admission. Those topics explain why a placement can be correct, fast, or cheap, but rarely all three without workload-specific policy.',
      ],
    },
  ],
};
