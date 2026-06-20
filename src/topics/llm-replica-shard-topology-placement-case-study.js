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
  references: [
    { title: 'NVIDIA Triton Model Configuration', url: 'https://docs.nvidia.com/deeplearning/triton-inference-server/user-guide/docs/user_guide/model_configuration.html' },
    { title: 'NVIDIA Triton Dynamic Batcher', url: 'https://docs.nvidia.com/deeplearning/triton-inference-server/user-guide/docs/user_guide/batcher.html' },
    { title: 'Ray Serve Autoscaling Guide', url: 'https://docs.ray.io/en/latest/serve/advanced-guides/advanced-autoscaling.html' },
  ],
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        `A model-serving fleet has two very different ways to use more GPUs. It can run more full copies of the model, or it can split one model across several devices and make those devices act as one serving unit. Both choices add hardware. They do not add the same kind of capacity.`,
        `Replica-versus-shard placement exists because LLM serving is constrained by weight memory, KV-cache memory, interconnect bandwidth, queueing, and tail latency at the same time. A full replica keeps the token path short, but it duplicates weights on every serving unit. A shard group fits larger models and more complex parallelism, but every request now depends on coordination inside the group.`,
        {type: `callout`, text: `Treat topology as a priced serving choice, not a GPU count.`},
        {type: `image`, src: `https://upload.wikimedia.org/wikipedia/commons/9/9a/NetApp_ONTAP_AI.jpg`, alt: `A rack containing a NetApp storage system and NVIDIA DGX supercomputer hardware.`, caption: `NetApp All-Flash FAS system with NVIDIA DGX supercomputer, photo by Qdrddr, Wikimedia Commons, CC BY-SA 4.0.`},
        `The practical question is not "how many GPUs do we have?" The question is "what topology is the request entering?" If the topology is a single warm replica, the router mostly cares about queue depth, cache locality, version, and memory headroom. If the topology is a shard group, the router must also care about tensor-parallel collectives, pipeline balance, expert placement, fabric health, and group-level failure.`,
      ],
    },
    {
      heading: 'The simple plan and the wall',
      paragraphs: [
        `The simple plan is to replicate everything. Put the same model on many workers, send each request to one worker, and avoid cross-device communication during generation. This is attractive because the failure boundary is easy to understand. If a replica is unhealthy, remove it from the pool. If one replica is overloaded, route to another one.`,
        `This plan works well for smaller models and latency-sensitive products, but it runs into the memory wall. A model may fit on one GPU only if there is almost no room left for KV cache. It may fit for short prompts but collapse under long-context traffic. It may fit at low concurrency but fail once enough users stream tokens at the same time.`,
        `The other wall is waste. Eight replicas of the same model store eight copies of the weights. That can be the right price for low p99, but it is still a price. If the model is large enough, or if the product needs more context and more concurrent sessions, full replication can waste the exact memory the system needs most.`,
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        `The core insight is that placement is a topology decision, not a device decision. The router should not think it is choosing between GPU 3 and GPU 4 as independent slots. It is choosing between a full-model replica, a colder replica with more queue headroom, or a multi-device shard group whose internal links must stay healthy for the request to finish.`,
        `That changes what the scheduler must measure. Replica placement needs per-replica queue depth, prefix-cache state, model version, tenant policy, and memory pressure. Shard placement needs all of that plus group membership, fabric locality, parallelism mode, KV ownership, collective latency, and whether the group can survive a slow stage.`,
        `A strong serving system prices the topology explicitly. It does not hide sharding behind a fake "server" label, and it does not treat replicas as stateless when their KV cache and warm prefixes affect real latency. The right abstraction is a serving placement with measurable cost, not a generic backend slot.`,
      ],
    },
    {
      heading: 'What the animation teaches',
      paragraphs: [
        `The replica view shows the low-hop path. The router scores full-model copies, compares queue and cache state, and chooses one replica for the request. The important detail is that a warm cache is not always enough to win. A replica with a deep queue can lose to a colder replica when the request has an interactive deadline.`,
        `The shard view shows why fitting the model is not the end of the problem. A sharded model needs stages, tensor-parallel or expert-parallel communication, and a healthy fabric path. The request is assigned to a group, not to a lone worker. One slow link, overloaded expert, or imbalanced pipeline stage can become visible as serving latency.`,
        `The decision chart is the bridge between the two modes. Replicas look best while memory pressure is low and p99 matters most. Shards become necessary when the model or KV state no longer fits with useful headroom. The point is not that one topology is universally better. The point is that the workload decides which cost matters.`,
      ],
    },
    {
      heading: 'Replica mode',
      paragraphs: [
        `In replica mode, each serving unit has the full model weights. The router receives a request, filters out unhealthy or incompatible replicas, then scores the remaining choices. A reasonable score can include active requests, queued prefill work, available KV blocks, prefix-cache hit probability, model version, tenant isolation, and the user's latency class.`,
        `The path is simple once the request lands. Prefill and decode run inside one replica, so token generation avoids the cross-device coordination that shard groups pay. This is why replicas are often the default for interactive chat, coding assistants, and other products where p99 is more important than maximizing parameter count per rack.`,
        `Replica mode is not the same as random load balancing. A sticky route can preserve prefix cache. A power-of-two choice can avoid a hot replica without scanning the whole fleet. Admission control can reject or delay work before KV pressure creates a p99 collapse. The topology is simple, but the routing policy still matters.`,
      ],
    },
    {
      heading: 'Shard mode',
      paragraphs: [
        `In shard mode, the model is divided across devices. Tensor parallelism splits matrix work and usually pays all-reduce or similar collective communication. Pipeline parallelism splits layers and pays for bubbles when stages wait on each other. Expert parallelism routes tokens to expert capacity and can pay all-to-all movement. KV ownership may also be distributed, which affects where follow-up tokens should run.`,
        `The router now chooses a group with internal structure. It has to know whether the devices sit on the same NVLink island, the same host, the same rack, or across an InfiniBand path with more variable latency. It must watch group-level health because a request cannot finish if one required participant is missing or slow.`,
        `Sharding is still the right move when the model does not fit any other way. It can also improve throughput when large batches amortize communication. But the scheduler must stop pretending that "capacity" is just a count of GPUs. The fabric, parallelism plan, and request shape are part of capacity.`,
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        `Suppose a team serves a 7B assistant model for short interactive chats. The model fits on one GPU with enough room for KV cache, so the team deploys eight full replicas. The router uses a score built from queue depth, prefix-cache hits, and available KV blocks. A request with a warm prefix may prefer the warm replica, unless that replica already has a deep queue.`,
        `Now suppose the same product adds a 70B model. A single GPU no longer has enough room for weights and useful KV headroom. The team creates an eight-GPU tensor-parallel group. The group fits the model, but every decode step now depends on collective communication. A router decision must include whether the group is on a fast fabric island and whether its current queue can meet the deadline.`,
        `The two deployments can exist in the same fleet. Short premium-chat traffic may use the 7B replicas for low p99. Batch summarization may use the 70B shard group because throughput and quality matter more than the extra hop cost. The correct design is a placement table with workload classes, not a single global rule.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `Replicas work because they remove coordination from the hot token path. If the model and KV state fit with headroom, adding replicas mostly adds independent queues. The router can reduce tail latency by steering away from busy replicas, keeping cache locality when it is worth it, and isolating failures to one serving unit.`,
        `Shards work because they reduce the memory burden on each device. Splitting weights, layers, or experts lets a larger model run at all. Splitting can also expose more compute to a large batch. The cost is a stronger invariant: the assigned group must complete the internal communication plan for every token.`,
        `Both strategies are valid because they optimize different scarce resources. Replicas spend memory to save coordination. Shards spend coordination to save memory. A placement system that names those resources can switch policies as the model, context length, and traffic mix change.`,
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        `Replica costs are mostly memory and fragmentation. Every replica duplicates the weights. KV cache can be spread across workers in a way that makes warm state hard to reuse. A naive router can create hot replicas. A rolling deploy can leave some replicas warm on the old version while new replicas are correct but cold.`,
        `Shard costs are communication and operational coupling. A tensor-parallel group may be fast inside one host and slow across hosts. A pipeline can waste time when one stage is slower than the rest. MoE routing can overload a hot expert even when average GPU utilization looks healthy. Observability has to explain the group, not just the node.`,
        `The tradeoff also affects failure handling. Losing one replica reduces capacity. Losing one device inside a required shard group can take the whole group out. That is why shard placement needs stricter health checks, clear drain behavior, and fabric-aware scheduling.`,
      ],
    },
    {
      heading: 'Where it wins and where it does not',
      paragraphs: [
        `Replicas win when the model fits comfortably, traffic is interactive, p99 matters, and simple isolation is worth the memory duplication. They are also friendly to canaries and rollbacks because one replica can be removed or replaced without rebuilding a multi-device topology.`,
        `Shards win when the model is too large, KV headroom is too tight, expert capacity spans devices, or batch throughput justifies the fabric cost. Long-running offline jobs, high-quality batch generation, and very large model tiers can tolerate coordination that would be painful for a short chat turn.`,
        `Both fail when the policy ignores the workload. Replica placement fails if it routes only by round-robin while cache and queue state diverge. Shard placement fails if it treats the fabric as free or hides stage imbalance behind average GPU utilization. Mixed products need request classes, not slogans.`,
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        `A common misconception is that replicas are the "simple" option and therefore do not need a scheduler. They still need health checks, draining, cache-aware routing, KV admission, rollout policy, and fairness between tenants. The difference is that their token path is simpler, not that operations disappear.`,
        `Another misconception is that sharding only has a one-time setup cost. In generation, the communication cost is paid repeatedly. Every token can touch the same collective or stage boundary. A benchmark that reports mean throughput but hides p99, fabric placement, and long-context concurrency can make a shard plan look safer than it is.`,
        `A third mistake is comparing model sizes without comparing service classes. A 7B low-latency chat tier and a 70B batch tier can both be correct. The bad design is forcing both through one topology because the platform lacks a placement ledger.`,
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        `Primary sources: NVIDIA Triton model configuration at https://docs.nvidia.com/deeplearning/triton-inference-server/user-guide/docs/user_guide/model_configuration.html, NVIDIA Triton dynamic batching at https://docs.nvidia.com/deeplearning/triton-inference-server/user-guide/docs/user_guide/batcher.html, and Ray Serve autoscaling at https://docs.ray.io/en/latest/serve/advanced-guides/advanced-autoscaling.html.`,
        `Study Tensor Parallelism for collective cost, Pipeline Parallelism for stage bubbles, GPU All-Reduce for fabric behavior, SLO-Aware LLM Request Router for topology-aware routing, MoE Expert Capacity Ledger for expert hot spots, NUMA GPU Affinity Serving Placement Case Study for host-level locality, and AI Rack Topology Power Thermal Ledger for rack-level placement.`,
        `The next useful exercise is to write a placement score by hand. Include queue depth, cache hit probability, KV headroom, fabric class, and request deadline. Then ask which fields matter for a full replica, which matter for a tensor-parallel group, and which become irrelevant for a batch-only workload.`,
      ],
    },
  ],
};
