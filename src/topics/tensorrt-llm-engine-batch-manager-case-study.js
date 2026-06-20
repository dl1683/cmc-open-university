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
      heading: 'Why this exists',
      paragraphs: [
        `A training checkpoint is not a production serving system. It is a set of weights and model metadata. A production LLM endpoint also needs kernels, precision choices, tensor-parallel layout, memory policy, batching policy, observability, rollback, and a way to keep latency inside a service goal while many users generate tokens at the same time.`,
        `TensorRT-LLM is useful to study because it makes those hidden serving decisions explicit. The deployed object is not just the model. It is a built engine, runtime configuration, paged KV cache, scheduler policy, and backend boundary that operations can test, canary, and roll back.`,
        {type:'callout', text:`TensorRT-LLM serving is a compiled engine contract plus a live scheduler whose real capacity is bounded by KV memory as much as compute.`},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        `A reasonable first stack loads a Hugging Face-style checkpoint in a flexible runtime, exposes an HTTP endpoint, and raises batch size until throughput looks acceptable. When latency rises, the team changes queue limits, adds GPUs, or reduces max tokens.`,
        `That is fine for early validation. It breaks when the route needs predictable p99 latency, high tokens per second, quantized precision, multi-GPU sharding, reproducible performance, and clear behavior when KV memory is nearly full. At that point the endpoint is no longer just running a model. It is running a scheduling system.`,
      ],
    },
    {
      heading: 'Where it breaks',
      paragraphs: [
        `A generic runtime hides constraints that matter. Precision, tensor parallelism, plugin kernels, attention implementation, max sequence length, max batch size, speculative decoding settings, and KV-cache layout all affect what the server can do efficiently. If those choices are implicit, a benchmark result is hard to reproduce and a production regression is hard to explain.`,
        `Naive batching also misses the shape of autoregressive generation. Prefill processes the prompt and creates KV cache in a burst. Decode advances each active sequence one token step at a time. Requests arrive and finish at different moments. The scheduler has to admit, pause, protect, or step requests based on live KV blocks, not just the number of HTTP requests in a queue.`,
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        `The system has two major record types. Build records describe the compiled contract: checkpoint revision, conversion metadata, dtype, quantization, tensor-parallel degree, plugin flags, attention mode, shape limits, engine files, and engine hash. Runtime records describe the live service: request state, prefill queue, decode set, KV block table, scheduler policy, backend config, and metrics.`,
        `The invariant is that serving capacity is constrained by both the built engine and live KV state. If the engine was built for one set of shape limits, the runtime cannot pretend those limits are larger. If KV blocks are exhausted, raw GPU FLOPs do not make another long sequence safe to admit. Memory policy is part of capacity.`,
      ],
    },
    {
      heading: 'What the animation teaches',
      paragraphs: [
        `The engine-build view follows the offline contract. Weights are converted, build knobs are selected, kernels and precision are fixed, an engine artifact is created, and the runtime or Triton backend serves from that artifact. The lesson is that specialization is purchased before the request arrives.`,
        `The batch-manager view follows the online contract. Requests enter a queue, prefill creates KV cache, decode steps consume scheduler slots, KV blocks become the admission boundary, and metrics decide whether the policy is working. The lesson is that a fast engine without a correct scheduler is not a reliable service.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `A typical deployment starts by converting a checkpoint into the format expected by the TensorRT-LLM build path. The team selects precision, quantization, tensor-parallel topology, context limits, plugin options, and attention/KV settings. The build creates an optimized engine artifact whose constraints become part of the deployment contract.`,
        `The serving layer then loads the engine through the TensorRT-LLM runtime or the Triton TensorRT-LLM backend. The backend adds model repository structure, configuration files, endpoint behavior, scheduler options, KV-cache parameters, and a standard operations surface for rollout and observation.`,
        `At request time, the batch manager handles in-flight batching. It can add new requests while older requests are already decoding, and it can remove finished requests between token steps. Prefill work is expensive and creates KV cache for the prompt. Decode work is repeated and usually advances one token per active sequence per step. The scheduler has to mix these phases without blowing memory or latency.`,
        `Paged KV cache is central. Instead of treating each sequence as one large contiguous memory allocation, the runtime accounts for KV memory in blocks. A request owns blocks as its prompt and generated tokens grow. The scheduler can reason about admission, reuse, pause, or eviction using block counts rather than vague batch size.`,
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        `Suppose a team serves a 70B chat model on multiple GPUs. Most prompts are short, but a few users paste long documents. If the server uses a fixed batch size, the long prompts can monopolize prefill time and KV memory. Short interactive chats then wait behind work that does not match their latency target.`,
        `With an engine and batch manager, the team first builds a contract: tensor parallelism, dtype, max context length, KV settings, and backend config. At runtime, the scheduler admits requests based on the active decode set and available KV blocks. It may chunk prefill, protect active decode latency, or choose a policy that maximizes utilization while accepting some pauses.`,
        `The correct metric is not only tokens per second. The team also watches time to first token, inter-token latency, p95 and p99 latency, KV block pressure, paused requests, rejected requests, and canary error rate. A policy that produces more total tokens but doubles p99 for chat traffic is a bad policy for that route.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `Engine building works because specialization removes runtime uncertainty. Once precision, kernels, parallelism, and shape limits are fixed, the runtime can use optimized execution paths instead of rediscovering choices for every request. The cost of deciding moves from request time to build time.`,
        `In-flight batching works because decode is stepwise. Requests do not all need to start together or finish together. They can enter and leave between token steps as long as the scheduler preserves request state, KV ownership, and ordering of generated tokens.`,
        `Paged KV cache works because memory becomes countable. A scheduler can ask whether enough blocks exist for a prompt and its expected generation. It can also expose memory pressure as a metric. That is better than treating an out-of-memory error as a surprise after admission has already happened.`,
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        `Specialization has a tax. Model changes, shape changes, precision changes, tensor-parallel changes, and some feature changes can become build-and-rollout events. A flexible runtime may accept a new variant immediately. A compiled engine may need conversion, build time, artifact storage, compatibility checks, and canarying.`,
        `Quantization can improve throughput and memory use but can hurt quality if the calibration and workload do not match. Tensor parallelism can make large models fit but adds communication cost. More aggressive scheduling can raise utilization but increase pauses, time to first token, or p99 latency.`,
        `A serious rollout ledger stores model revision, engine hash, dtype, quantization mode, tensor-parallel degree, max context, max batch settings, scheduler policy, KV-cache block size, backend version, time to first token, inter-token latency, tokens per second, p99, pause count, canary status, and rollback result. Without that ledger, performance becomes folklore.`,
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        `TensorRT-LLM-style serving wins when the model and workload are stable enough to justify a built artifact and demanding enough that kernel, memory, and scheduler efficiency matter. It fits high-throughput endpoints, latency-sensitive chat routes, quantized deployments, multi-GPU models, and teams that need a concrete artifact for canary and rollback.`,
        `It is also useful when the platform team wants clear ownership boundaries. Model researchers own the checkpoint and quality evaluation. Platform engineers own engine builds, backend configuration, capacity tests, canary gates, and SLO metrics. The engine artifact becomes the handoff object between those worlds.`,
        `This approach is not only about speed. It is about repeatability. If two canaries use different engine hashes, dtypes, or scheduler policies, their latency numbers are not comparable. A built engine makes the performance contract inspectable.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `This approach is a poor fit for rapid model experimentation where shapes, architectures, context lengths, and features change constantly. The build artifact can slow iteration. A flexible eager runtime may be better while the model is still moving every day.`,
        `It also fails when teams confuse an engine with a platform. The engine does not replace admission control, routing, autoscaling, prompt length limits, abuse controls, canarying, rollback, or quality evaluation. It is one optimized piece inside the serving system.`,
        `Operational failures often come from chasing aggregate throughput. A policy that maximizes tokens per second by admitting too much work can create high time to first token, long inter-token gaps, request pauses, and bad p99. Interactive traffic usually cares about latency distribution, not only GPU occupancy.`,
      ],
    },
    {
      heading: 'Common misconceptions',
      paragraphs: [
        `One misconception is that TensorRT-LLM is just a faster model loader. The important idea is the compiled serving contract plus the runtime scheduler. The speed comes from build-time specialization, optimized kernels, memory planning, and batching behavior working together.`,
        `Another misconception is that bigger batches are always better. Large batches can raise throughput while hurting time to first token and inter-token latency. For chat, a smaller or more carefully scheduled active set can be better than a full GPU that makes users wait.`,
        `A third misconception is that KV cache is an implementation detail. For long-context LLM serving, KV memory is often the binding resource. The scheduler that ignores KV pressure will eventually admit work it cannot serve well.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Primary sources: TensorRT-LLM docs at https://nvidia.github.io/TensorRT-LLM/, NVIDIA TensorRT-LLM GitHub at https://github.com/NVIDIA/TensorRT-LLM, Triton TensorRT-LLM backend docs at https://docs.nvidia.com/deeplearning/triton-inference-server/user-guide/docs/tensorrtllm_backend/README.html, TensorRT-LLM memory reference at https://nvidia.github.io/TensorRT-LLM/reference/memory.html, and TensorRT-LLM disaggregated serving notes at https://nvidia.github.io/TensorRT-LLM/blogs/tech_blog/blog5_Disaggregated_Serving_in_TensorRT-LLM.html.`,
        `Study next: LLM Continuous Batching for dynamic request mixing, Chunked Prefill Token Budget Scheduler for prefill/decode balance, LLM Serving: PagedAttention and KV Cache Concurrency Capacity Model for memory layout, Transformer Inference Roofline for hardware limits, Inference Kernel Fusion & CUDA Graphs and CUDA Graph Shape Cache for execution specialization, Speculative Decoding Runtime Controller Case Study for decode acceleration, and NVIDIA Dynamo Distributed Inference Control Plane for larger serving orchestration.`,
      ],
    },
  ],
};
