// TensorRT-LLM production serving: build an optimized engine, manage in-flight
// batches, allocate paged KV cache, and expose it through Triton.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'tensorrt-llm-engine-batch-manager-case-study',
  title: 'TensorRT-LLM Engine & Batch Manager Case Study',
  category: 'Systems',
  summary: 'A TensorRT-LLM serving case study: checkpoint conversion, engine build artifacts, in-flight batching, scheduler policy, paged KV cache, Triton backend, and deployment gates.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['engine build', 'batch manager'], defaultValue: 'engine build' },
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

function engineGraph(title) {
  return graphState({
    nodes: [
      { id: 'hf', label: 'HF', x: 0.6, y: 3.5, note: 'weights' },
      { id: 'convert', label: 'convert', x: 2.2, y: 3.5, note: 'ckpt' },
      { id: 'config', label: 'config', x: 3.8, y: 2.0, note: 'dtype/TP' },
      { id: 'plugins', label: 'plugins', x: 3.8, y: 5.0, note: 'kernels' },
      { id: 'build', label: 'build', x: 5.5, y: 3.5, note: 'engine' },
      { id: 'repo', label: 'repo', x: 7.0, y: 2.0, note: 'Triton' },
      { id: 'runtime', label: 'run', x: 7.0, y: 5.0, note: 'C++/Py' },
      { id: 'serve', label: 'serve', x: 8.8, y: 3.5, note: 'API' },
    ],
    edges: [
      { id: 'e-hf-convert', from: 'hf', to: 'convert' },
      { id: 'e-convert-config', from: 'convert', to: 'config' },
      { id: 'e-convert-plugins', from: 'convert', to: 'plugins' },
      { id: 'e-config-build', from: 'config', to: 'build' },
      { id: 'e-plugins-build', from: 'plugins', to: 'build' },
      { id: 'e-build-repo', from: 'build', to: 'repo' },
      { id: 'e-build-runtime', from: 'build', to: 'runtime' },
      { id: 'e-repo-serve', from: 'repo', to: 'serve' },
      { id: 'e-runtime-serve', from: 'runtime', to: 'serve' },
    ],
  }, { title });
}

function batchGraph(title) {
  return graphState({
    nodes: [
      { id: 'queue', label: 'q', x: 0.7, y: 3.5, note: 'reqs' },
      { id: 'policy', label: 'policy', x: 2.1, y: 3.5, note: 'sched' },
      { id: 'ctx', label: 'ctx', x: 3.7, y: 2.0, note: 'prefill' },
      { id: 'gen', label: 'gen', x: 3.7, y: 5.0, note: 'decode' },
      { id: 'kv', label: 'KV', x: 5.5, y: 3.5, note: 'blocks' },
      { id: 'pause', label: 'pause', x: 7.0, y: 2.0, note: 'evict' },
      { id: 'step', label: 'step', x: 7.0, y: 5.0, note: 'token' },
      { id: 'metrics', label: 'metrics', x: 8.8, y: 3.5, note: 'p99' },
    ],
    edges: [
      { id: 'e-queue-policy', from: 'queue', to: 'policy' },
      { id: 'e-policy-ctx', from: 'policy', to: 'ctx' },
      { id: 'e-policy-gen', from: 'policy', to: 'gen' },
      { id: 'e-ctx-kv', from: 'ctx', to: 'kv' },
      { id: 'e-gen-kv', from: 'gen', to: 'kv' },
      { id: 'e-kv-pause', from: 'kv', to: 'pause' },
      { id: 'e-kv-step', from: 'kv', to: 'step' },
      { id: 'e-pause-policy', from: 'pause', to: 'policy' },
      { id: 'e-step-metrics', from: 'step', to: 'metrics' },
      { id: 'e-policy-metrics', from: 'policy', to: 'metrics' },
    ],
  }, { title });
}

function* engineBuild() {
  yield {
    state: engineGraph('Serving starts with a built engine artifact'),
    highlight: { active: ['hf', 'convert', 'config', 'plugins', 'build'], found: ['serve'] },
    explanation: 'TensorRT-LLM is not only a request loop. A production route often begins by converting a model checkpoint and building a specialized engine with chosen precision, tensor parallelism, plugin kernels, and KV-cache settings.',
  };

  yield {
    state: labelMatrix(
      'Build knobs',
      [
        { id: 'dtype', label: 'dtype' },
        { id: 'tp', label: 'TP' },
        { id: 'kv', label: 'KV' },
        { id: 'spec', label: 'spec' },
        { id: 'shape', label: 'shape' },
      ],
      [
        { id: 'sets', label: 'sets' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['fp8/int4', 'quality'],
        ['shards', 'comm'],
        ['paged', 'HBM'],
        ['EAGLE', 'mask'],
        ['limits', 'rebuild'],
      ],
    ),
    highlight: { active: ['dtype:sets', 'kv:sets', 'shape:risk'], compare: ['spec:risk'] },
    explanation: 'The engine is a compiled serving contract. Its precision, parallelism, attention kernels, speculative modes, and shape limits decide what the runtime can do without rebuilding.',
  };

  yield {
    state: engineGraph('Triton backend wraps the runtime contract'),
    highlight: { active: ['build', 'repo', 'runtime', 'serve', 'e-build-repo', 'e-build-runtime'], found: ['e-repo-serve'] },
    explanation: 'The Triton TensorRT-LLM backend adds the deployment boundary: model repository layout, config fields, batch scheduling policy, KV-cache parameters, and endpoints that operations teams can roll out.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'specialization', min: 0, max: 10 }, y: { label: 'deployment flexibility', min: 0, max: 10 } },
      series: [
        { id: 'engine', label: 'built engine', points: [{ x: 2, y: 9 }, { x: 4, y: 7 }, { x: 6, y: 5 }, { x: 8, y: 3 }, { x: 10, y: 2 }] },
        { id: 'eager', label: 'eager runtime', points: [{ x: 2, y: 7 }, { x: 4, y: 6 }, { x: 6, y: 5.5 }, { x: 8, y: 5 }, { x: 10, y: 4 }] },
      ],
      markers: [
        { id: 'build', x: 8, y: 3, label: 'fast path' },
      ],
    }),
    highlight: { active: ['engine', 'build'], compare: ['eager'] },
    explanation: 'This tradeoff is why TensorRT-LLM belongs in the platform curriculum. More specialization can buy throughput, but it also makes model, shape, and feature changes into build-and-rollout events.',
  };
}

function* batchManager() {
  yield {
    state: batchGraph('In-flight batching schedules token steps'),
    highlight: { active: ['queue', 'policy', 'ctx', 'gen', 'step', 'e-queue-policy', 'e-policy-gen'], found: ['metrics'] },
    explanation: 'TensorRT-LLM uses a batch manager for in-flight batching: requests can enter and leave while generation continues. The scheduler has to mix context work, generation work, and available KV-cache blocks.',
  };

  yield {
    state: labelMatrix(
      'Scheduler policies',
      [
        { id: 'max', label: 'max' },
        { id: 'noevict', label: 'noevict' },
        { id: 'chunk', label: 'chunk' },
        { id: 'reuse', label: 'reuse' },
      ],
      [
        { id: 'goal', label: 'goal' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['util', 'pause'],
        ['stable', 'idle'],
        ['TTFT', 'ITL'],
        ['skip', 'stale'],
      ],
    ),
    highlight: { active: ['max:goal', 'noevict:goal', 'chunk:goal'], compare: ['max:risk', 'chunk:risk'] },
    explanation: 'The backend exposes scheduler policies such as maximizing utilization versus avoiding eviction. The difference is not cosmetic: one can admit more work and later pause requests; the other protects active requests at the cost of lower utilization.',
  };

  yield {
    state: batchGraph('Paged KV cache is the admission boundary'),
    highlight: { active: ['kv', 'pause', 'step', 'e-kv-pause', 'e-kv-step'], compare: ['ctx', 'gen'], found: ['metrics'] },
    explanation: 'In-flight batching only works while there are enough KV-cache blocks. The scheduler should treat HBM blocks as a first-class resource, not an afterthought hidden behind batch size.',
    invariant: 'Serving capacity is often KV-block capacity, not raw FLOPs.',
  };

  yield {
    state: labelMatrix(
      'Deployment gate',
      [
        { id: 'build', label: 'build' },
        { id: 'serve', label: 'serve' },
        { id: 'metric', label: 'metric' },
        { id: 'roll', label: 'roll' },
      ],
      [
        { id: 'artifact', label: 'art' },
        { id: 'gate', label: 'gate' },
      ],
      [
        ['engine', 'hash'],
        ['config', 'dryrun'],
        ['p99/KV', 'pass'],
        ['canary', 'ramp'],
      ],
    ),
    highlight: { active: ['build:gate', 'serve:gate', 'metric:gate', 'roll:gate'] },
    explanation: 'A serious TensorRT-LLM rollout tracks the engine hash, backend config, KV-cache policy, scheduler policy, p99 latency, and canary status. The engine artifact is part of the deployable system.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'engine build') yield* engineBuild();
  else if (view === 'batch manager') yield* batchManager();
  else throw new InputError('Pick a TensorRT-LLM view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the engine-build view as the offline contract and the batch-manager view as the online scheduler. The engine fixes precision, tensor-parallel layout, plugins, shape limits, and KV-cache settings before requests arrive.',
        'Read KV cache as a first-class memory resource. KV cache stores attention keys and values for prior tokens, and the safe inference rule is that a request cannot be admitted just because compute is free if there are not enough KV blocks to serve it.',
        {type:'callout', text:`TensorRT-LLM serving is a compiled engine contract plus a live scheduler whose real capacity is bounded by KV memory as much as compute.`},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A training checkpoint is not a production LLM service. Serving also needs optimized kernels, precision choices, tensor parallelism, batching, memory policy, backend configuration, observability, rollback, and latency control.',
        'TensorRT-LLM exists in this curriculum because it makes the deployment artifact visible. The serving system is a built engine plus a runtime scheduler, not only a model loaded into memory.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to load a Hugging Face-style checkpoint in a flexible runtime, expose an endpoint, and increase batch size until throughput looks acceptable. That is a reasonable first validation path.',
        'When latency rises, the simple response is to add GPUs, lower max tokens, or tune a queue size. Those controls help, but they do not explain engine specialization, prefill cost, decode cost, or KV memory pressure.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Autoregressive generation has two different phases. Prefill processes the prompt and creates KV cache in a burst, while decode advances active sequences one token step at a time.',
        'Requests arrive with different prompt lengths and finish at different times. A fixed batch-size mental model misses the real bottleneck because live capacity depends on engine limits, active sequence count, token growth, and available KV blocks.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Separate build-time specialization from runtime scheduling. Build records describe checkpoint revision, dtype, quantization, tensor-parallel degree, plugin flags, attention mode, shape limits, engine files, and engine hash.',
        'Runtime records describe request state, prefill queue, decode set, KV block ownership, scheduler policy, backend config, and metrics. The invariant is that the runtime cannot safely exceed either the compiled engine contract or the live memory contract.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A deployment starts by converting the checkpoint into the TensorRT-LLM build path. The team selects precision, quantization, tensor parallelism, context limits, plugins, and attention or KV settings, then builds an optimized engine artifact.',
        'The runtime or Triton TensorRT-LLM backend loads that engine and exposes a serving boundary. Backend configuration defines scheduling behavior, model repository layout, KV-cache parameters, endpoints, and operational settings.',
        'The batch manager performs in-flight batching. New requests can enter while older requests decode, completed requests leave between token steps, and the scheduler mixes prefill and decode work while accounting for KV blocks.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Engine building works because many expensive decisions move out of the request path. Once precision, kernels, parallelism, and shape limits are fixed, execution can use specialized paths instead of rediscovering choices for every request.',
        'In-flight batching works because decode is stepwise. The scheduler can update the active set between token steps as long as it preserves request state, token order, and KV ownership.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Specialization has a rollout cost. Model changes, context-limit changes, precision changes, tensor-parallel changes, and some feature changes can require conversion, engine build time, artifact storage, compatibility checks, canaries, and rollback plans.',
        'Runtime cost is bounded by compute and memory together. A policy that raises total tokens per second can still be bad if time to first token, inter-token latency, p99 latency, pause count, or rejected requests violate the service goal.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'TensorRT-LLM-style serving fits stable high-throughput or latency-sensitive LLM endpoints where optimized kernels, quantization, multi-GPU layout, and repeatable rollout matter. It is useful for chat, summarization, coding, retrieval-augmented generation, and other routes with measurable service goals.',
        'It also creates a clean handoff between teams. Model owners provide checkpoint and quality gates, while platform owners manage engine builds, backend config, capacity tests, canary metrics, and rollback.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It is a poor fit for rapid experimentation where architectures, shapes, context lengths, and features change every day. A flexible eager runtime may move faster until the workload stabilizes.',
        'It also fails when teams treat the engine as the whole platform. Admission control, routing, autoscaling, prompt limits, abuse controls, canarying, rollback, and quality evaluation still have to exist around it.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a 70B chat model is served on multiple GPUs with 16,000-token context support. One user sends a 12,000-token prompt while 100 users send 400-token prompts, so prefill and KV allocation for the long request can hurt time to first token for everyone else.',
        'A disciplined rollout records engine hash, dtype, tensor-parallel degree, max context, scheduler policy, KV block settings, time to first token, inter-token latency, p99, pause count, and rejection count. If a new policy increases total tokens per second by 15 percent but doubles p99 latency for short chats, it is the wrong policy for that route.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources include TensorRT-LLM documentation at https://nvidia.github.io/TensorRT-LLM/, NVIDIA TensorRT-LLM GitHub at https://github.com/NVIDIA/TensorRT-LLM, Triton TensorRT-LLM backend docs at https://docs.nvidia.com/deeplearning/triton-inference-server/user-guide/docs/tensorrtllm_backend/README.html, and the memory reference at https://nvidia.github.io/TensorRT-LLM/reference/memory.html. Study continuous batching, paged KV cache, chunked prefill, transformer inference rooflines, CUDA graphs, speculative decoding, and disaggregated serving next.',
      ],
    },
  ],
};
