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
    { heading: 'What it is', paragraphs: ['Replica-versus-shard placement is the serving decision between running many full model copies or splitting one model across several devices. Replicas spend memory for simpler routing and lower hops. Shards spend fabric bandwidth and coordination so a larger model or larger KV state can fit.', 'The local inference-scaling notes summarize the production tradeoff: replicas keep latency low but cost VRAM, while shards save memory but turn every inference step into a cross-device conversation.'] },
    { heading: 'How it works', paragraphs: ['Replica mode gives the router independent full-model workers. It can score queue depth, cache locality, SLO class, and version policy. Shard mode gives the router shard groups whose internal topology matters: tensor collectives, pipeline stages, expert all-to-all, and KV ownership.', 'Triton exposes model instance groups and dynamic batching as serving primitives. LLM stacks add KV-cache routing, tensor parallelism, and SLO-aware routing. The important data structure is a topology ledger that maps model partitions to GPUs, links, queues, cache blocks, and health.'] },
    { heading: 'Complete case study', paragraphs: ['A 7B assistant model fits in one GPU with room for KV cache. The serving team runs eight replicas and routes by queue depth plus prefix-cache hit. A 70B model does not fit that way. It runs as a tensor-parallel shard group across eight GPUs. Now the scheduler must place requests on healthy fabric islands and monitor all-reduce p99, not only per-replica queue depth.', 'A product with both workloads should not use one placement policy. Short interactive requests prefer replicas when possible. Long batch jobs can tolerate shard overhead. MoE workloads require expert-capacity and all-to-all ledgers.'] },
    { heading: 'Pitfalls', paragraphs: ['Do not treat sharding as a free way to fit bigger models. It trades local memory for communication, placement constraints, and coordinated failure domains. Do not treat replicas as stateless either; prefix caches, KV blocks, warm weights, and version can make one replica much better than another.'] },
    { heading: 'Sources and study next', paragraphs: ['Primary sources: NVIDIA Triton model configuration at https://docs.nvidia.com/deeplearning/triton-inference-server/user-guide/docs/user_guide/model_configuration.html, NVIDIA Triton dynamic batching at https://docs.nvidia.com/deeplearning/triton-inference-server/user-guide/docs/user_guide/batcher.html, and Ray Serve autoscaling at https://docs.ray.io/en/latest/serve/advanced-guides/advanced-autoscaling.html. Study Tensor Parallelism, Pipeline Parallelism, GPU All-Reduce, SLO-Aware LLM Request Router, MoE Expert Capacity Ledger, and AI Rack Topology Power Thermal Ledger next.'] },
  ],
};
