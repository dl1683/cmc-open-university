// LLM continuous batching: schedule at decode-iteration granularity so the GPU
// stays packed while variable-length requests arrive and finish.

import { matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'llm-continuous-batching',
  title: 'LLM Continuous Batching',
  category: 'Systems',
  summary: 'Iteration-level scheduling for LLM serving: admit and remove requests every token step instead of freezing a whole batch.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['static vs continuous', 'selective batching'], defaultValue: 'static vs continuous' },
  ],
  run,
};

const rows = [
  { id: 't1', label: 'iteration 1' },
  { id: 't2', label: 'iteration 2' },
  { id: 't3', label: 'iteration 3' },
  { id: 't4', label: 'iteration 4' },
  { id: 't5', label: 'iteration 5' },
];

const columns = [
  { id: 'a', label: 'A' },
  { id: 'b', label: 'B' },
  { id: 'c', label: 'C' },
  { id: 'd', label: 'D' },
  { id: 'e', label: 'E' },
];

function schedule(title, values, labels) {
  return matrixState({
    title,
    rows,
    columns,
    values,
    format: (value) => labels[value] ?? '',
  });
}

function labelMatrix(title, rowDefs, columnDefs, labelsByRow) {
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
    rows: rowDefs,
    columns: columnDefs,
    values: labelsByRow.map((row) => row.map(code)),
    format: (value) => labels[value],
  });
}

function* staticVsContinuous() {
  yield {
    state: schedule('Static batching: batch membership is frozen', [
      [1, 1, 0, 0, 0],
      [1, 1, 0, 0, 0],
      [2, 1, 0, 0, 0],
      [2, 1, 0, 0, 0],
      [2, 2, 0, 0, 0],
    ], { 0: '', 1: 'decode', 2: 'idle' }),
    highlight: { active: ['t3:a', 't4:a', 't5:a', 't5:b'], compare: ['t3:c', 't4:d', 't5:e'] },
    explanation: 'Static batching groups requests and keeps the group fixed until the batch finishes. Request A ends early, but its lane stays idle while C, D, and E wait outside the batch. Variable output length becomes wasted GPU capacity.',
  };

  yield {
    state: schedule('Continuous batching: refill lanes every iteration', [
      [1, 1, 0, 0, 0],
      [1, 1, 1, 0, 0],
      [0, 1, 1, 1, 0],
      [0, 1, 0, 1, 1],
      [0, 0, 0, 1, 1],
    ], { 0: '', 1: 'decode' }),
    highlight: { found: ['t2:c', 't3:d', 't4:e'], active: ['t3:b', 't4:d', 't5:e'] },
    explanation: 'Continuous batching schedules at token-iteration granularity. When a request finishes, a waiting request can join on the next decode step. The unit of fairness is no longer the whole request; it is the next model iteration.',
    invariant: 'The batch is a live set, not a fixed list.',
  };

  yield {
    state: labelMatrix(
      'Why this helps decode',
      [
        { id: 'reuse', label: 'weight reuse' },
        { id: 'variance', label: 'length variance' },
        { id: 'queue', label: 'arrival stream' },
        { id: 'memory', label: 'cache pressure' },
      ],
      [
        { id: 'pressure', label: 'pressure' },
        { id: 'batching', label: 'continuous response' },
      ],
      [
        ['same weights read per step', 'pack many sequences together'],
        ['users stop at different times', 'remove finished lanes immediately'],
        ['new requests arrive anytime', 'admit without waiting for a round'],
        ['KV cache is finite', 'combine with block allocation'],
      ],
    ),
    highlight: { active: ['reuse:batching', 'variance:batching'], found: ['memory:batching'] },
    explanation: 'Decode is attractive to batch because many users can share a weight read. It is also hard to batch because each sequence has a different length and cache footprint. Continuous batching is the scheduler answer to that mismatch.',
  };

  yield {
    state: labelMatrix(
      'Scheduler knobs',
      [
        { id: 'admit', label: 'admission' },
        { id: 'prefill', label: 'prefill split' },
        { id: 'evict', label: 'preemption' },
        { id: 'fair', label: 'fairness' },
      ],
      [
        { id: 'decision', label: 'decision' },
        { id: 'failure', label: 'failure if wrong' },
      ],
      [
        ['who joins next iteration', 'queue explosion'],
        ['when prompt work runs', 'decode stalls'],
        ['what cache can be reclaimed', 'memory deadlock'],
        ['whose latency is protected', 'p99 collapse'],
      ],
    ),
    highlight: { active: ['admit:decision', 'prefill:decision', 'fair:failure'], found: ['evict:decision'] },
    explanation: 'Continuous batching is not just a throughput trick. It is a control loop over admission, prefill/decode interference, cache memory, and p99 latency.',
  };
}

function* selectiveBatching() {
  yield {
    state: labelMatrix(
      'Transformer generation has different operation shapes',
      [
        { id: 'attn', label: 'attention' },
        { id: 'mlp', label: 'MLP' },
        { id: 'sample', label: 'sampling' },
        { id: 'cache', label: 'cache update' },
      ],
      [
        { id: 'batchable', label: 'batching choice' },
        { id: 'reason', label: 'reason' },
      ],
      [
        ['batch together', 'same kernel shape after padding'],
        ['batch together', 'dense matmul reuse'],
        ['may differ', 'temperature or constraints vary'],
        ['per request metadata', 'different cache blocks'],
      ],
    ),
    highlight: { active: ['attn:batchable', 'mlp:batchable'], compare: ['sample:batchable', 'cache:batchable'] },
    explanation: 'Selective batching groups compatible operations, not blindly every piece of every request. Dense model operations want big batches, while sampling logic and cache metadata often remain request-specific.',
  };

  yield {
    state: labelMatrix(
      'Prefill/decode interference',
      [
        { id: 'long_prompt', label: 'long prompt' },
        { id: 'chat_decode', label: 'chat decode' },
        { id: 'chunk', label: 'chunked prefill' },
        { id: 'policy', label: 'policy' },
      ],
      [
        { id: 'wants', label: 'wants' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['large dense batch', 'blocks streaming users'],
        ['short repeated steps', 'starves behind prompts'],
        ['split prompt into pieces', 'more scheduling choices'],
        ['reserve decode slots', 'less peak throughput'],
      ],
    ),
    highlight: { active: ['long_prompt:risk', 'chat_decode:risk'], found: ['chunk:wants', 'policy:wants'] },
    explanation: 'A server must decide how prompt prefill and token decode share the GPU. Chunked prefill and decode reservation are common ways to keep first-token work from ruining streaming latency.',
  };

  yield {
    state: schedule('A mixed schedule reserves room for decode', [
      [3, 3, 1, 1, 0],
      [3, 1, 1, 1, 0],
      [3, 3, 1, 0, 1],
      [0, 3, 1, 1, 1],
      [0, 0, 1, 1, 1],
    ], { 0: '', 1: 'decode', 3: 'prefill' }),
    highlight: { active: ['t1:a', 't2:a', 't3:a', 't4:b'], found: ['t1:c', 't3:e', 't5:e'] },
    explanation: 'The scheduler can interleave chunked prefill with decode iterations. Prompt work uses the GPU efficiently, but decode lanes remain present so already-streaming users do not freeze.',
  };

  yield {
    state: labelMatrix(
      'What changes in production',
      [
        { id: 'metric', label: 'metric split' },
        { id: 'memory', label: 'memory manager' },
        { id: 'routing', label: 'routing' },
        { id: 'rollback', label: 'fallback' },
      ],
      [
        { id: 'need', label: 'need' },
        { id: 'example', label: 'example' },
      ],
      [
        ['phase-aware dashboards', 'TTFT vs TPOT'],
        ['block tables', 'PagedAttention'],
        ['model and prompt buckets', 'length-aware queues'],
        ['admission control', 'shed or downgrade'],
      ],
    ),
    highlight: { found: ['metric:example', 'memory:example', 'routing:example'], active: ['rollback:need'] },
    explanation: 'The real system is a queueing system wrapped around model kernels. Metrics, memory, routing, and fallback policy matter as much as the batching loop.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'static vs continuous') yield* staticVsContinuous();
  else if (view === 'selective batching') yield* selectiveBatching();
  else throw new InputError('Pick a continuous-batching view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'LLM Continuous Batching is the serving pattern where the runtime changes batch membership after every decode iteration. Traditional batching is request-level: gather a group, run the group, wait for it to finish, then start the next group. That wastes capacity because language-model outputs have different lengths. Continuous batching keeps the batch as a live set. Finished sequences leave, waiting sequences enter, and the GPU keeps processing useful tokens.',
        'The idea is especially important for autoregressive decode. Each generated token needs a model step, but many users can share the same model weights during that step. The scheduler wants large batches for throughput, but users want low latency and fair streaming. Continuous batching is the compromise: refill lanes aggressively without making everyone wait for the slowest request.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The scheduler tracks active sequences, waiting requests, KV Cache blocks, and phase information. At each iteration it chooses which sequences run next. If a sequence finished or hit a stop condition, it is removed. If memory and latency budgets allow, a waiting request is admitted. Some systems also separate prompt prefill from token decode, because a long prompt can monopolize compute and delay already-streaming users. Chunked Prefill Token Budget Scheduler is the dedicated follow-up for that problem: decode runs first, and leftover max_num_batched_tokens is spent on bounded prefill chunks. SLO-Aware LLM Request Router sits one layer above the scheduler, deciding which replica should receive the request before local batching begins.',
        'Orca named this iteration-level scheduling and paired it with selective batching. Dense transformer operations can be batched together, while request-specific work such as sampling, stopping criteria, and cache metadata may remain separate. LLM Serving: PagedAttention complements the scheduler by making cache allocation block-based, so admitting and removing requests does not strand large contiguous slabs of GPU memory.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Continuous batching improves throughput, but it turns serving into a control problem. Large batches reuse weights better but raise per-user latency. Small batches feel responsive but waste GPU bandwidth. Long prompts, long outputs, tool-calling agents, and structured-output requests all have different cost shapes. The scheduler must also prevent starvation: a stream of short requests should not permanently delay a long one, and a long prefill should not freeze every decode lane.',
        'Good systems measure time to first token, time per output token, aggregate tokens per second, cache occupancy, queue age, and p99 latency separately. A single tokens-per-second graph can hide a broken product if a subset of users waits too long.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Continuous batching appears in modern LLM serving systems such as Orca, vLLM, SGLang-style runtimes, and commercial inference stacks. Chat applications use it to support many concurrent conversations. RAG Pipeline systems use it because retrieved prompts vary in length. Coding agents need it because traces can grow long and outputs can stop unpredictably. Batch summarization systems use similar scheduling to maximize tokens per dollar.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Continuous batching is not the same as simply increasing batch size. It changes the scheduling granularity. It also does not remove memory pressure: more active sequences mean more KV cache. Another misconception is that maximizing GPU occupancy is always best. If the scheduler overfills the batch, individual users experience slow streaming or high tail latency. The target is not full hardware at any cost; it is the best throughput that still honors the latency contract.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Orca, A Distributed Serving System for Transformer-Based Generative Models at https://www.usenix.org/conference/osdi22/presentation/yu, Efficient Memory Management for Large Language Model Serving with PagedAttention at https://arxiv.org/abs/2309.06180, and the JAX inference scaling chapter at https://jax-ml.github.io/scaling-book/inference/. Study Length-Aware Batching for LLM Serving, Chunked Prefill Token Budget Scheduler, SLO-Aware LLM Request Router, Queue, Load Balancer, Backpressure, KV Cache, Transformer Inference Roofline, and Tail Latency & p99 Thinking next.',
      ],
    },
  ],
};
