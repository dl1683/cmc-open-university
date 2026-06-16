// Length-aware batching for LLM serving: group similar prompt/decode shapes so
// continuous batching wastes fewer padded tokens and protects tail latency.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'length-aware-batching-llm-scheduler',
  title: 'Length-Aware Batching for LLM Serving',
  category: 'Systems',
  summary: 'A serving scheduler data structure: bucket requests by prompt length, output budget, and cache footprint so batching improves throughput without wrecking p99.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['bucket queues', 'latency tradeoffs'], defaultValue: 'bucket queues' },
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

function schedulerGraph(title) {
  return graphState({
    nodes: [
      { id: 'arrival', label: 'arrive', x: 0.7, y: 3.8, note: 'requests' },
      { id: 'classify', label: 'key', x: 2.2, y: 3.8, note: 'shape' },
      { id: 'short', label: 'short', x: 3.9, y: 1.6, note: '<1k' },
      { id: 'medium', label: 'mid', x: 3.9, y: 3.8, note: '1k-8k' },
      { id: 'long', label: 'long', x: 3.9, y: 6.0, note: '8k+' },
      { id: 'prefill', label: 'pre', x: 5.6, y: 2.4, note: 'chunks' },
      { id: 'decode', label: 'decode', x: 5.4, y: 5.2, note: 'live lanes' },
      { id: 'kv', label: 'KV', x: 7.0, y: 3.8, note: 'blocks' },
      { id: 'admit', label: 'admit', x: 8.4, y: 2.4, note: 'policy' },
      { id: 'serve', label: 'serve', x: 9.4, y: 5.2, note: 'tokens' },
    ],
    edges: [
      { id: 'e-arrival-classify', from: 'arrival', to: 'classify' },
      { id: 'e-classify-short', from: 'classify', to: 'short' },
      { id: 'e-classify-medium', from: 'classify', to: 'medium' },
      { id: 'e-classify-long', from: 'classify', to: 'long' },
      { id: 'e-short-prefill', from: 'short', to: 'prefill' },
      { id: 'e-medium-prefill', from: 'medium', to: 'prefill' },
      { id: 'e-long-prefill', from: 'long', to: 'prefill' },
      { id: 'e-prefill-kv', from: 'prefill', to: 'kv' },
      { id: 'e-kv-decode', from: 'kv', to: 'decode' },
      { id: 'e-decode-admit', from: 'decode', to: 'admit' },
      { id: 'e-admit-serve', from: 'admit', to: 'serve' },
      { id: 'e-decode-serve', from: 'decode', to: 'serve' },
    ],
  }, { title });
}

function* bucketQueues() {
  yield {
    state: schedulerGraph('Length-aware queues sit in front of continuous batching'),
    highlight: { active: ['arrival', 'classify', 'short', 'medium', 'long', 'e-arrival-classify', 'e-classify-short', 'e-classify-medium', 'e-classify-long'], compare: ['serve'] },
    explanation: 'Continuous batching refills live lanes every decode iteration. Length-aware scheduling decides which waiting request should enter next by grouping similar prompt lengths, output budgets, and cache footprints before admission.',
  };

  yield {
    state: labelMatrix(
      'Shape key for a waiting request',
      [
        { id: 'prompt', label: 'prompt tokens' },
        { id: 'maxout', label: 'max output' },
        { id: 'mode', label: 'mode' },
        { id: 'prefix', label: 'prefix hit' },
        { id: 'sla', label: 'SLA class' },
      ],
      [
        { id: 'bucket field', label: 'bucket field' },
        { id: 'why', label: 'why it matters' },
      ],
      [
        ['length bin', 'prefill padding'],
        ['budget bin', 'decode residency'],
        ['chat/RAG/agent', 'different p99 target'],
        ['cacheable flag', 'prefill skipped'],
        ['priority', 'fairness and cost'],
      ],
    ),
    highlight: { active: ['prompt:bucket field', 'maxout:bucket field', 'sla:bucket field'], found: ['prefix:why'] },
    explanation: 'The scheduler key is not only batch size. It should encode the parts that change compute, memory, and latency: prompt length, output budget, mode, prefix-cache hit, and service class.',
    invariant: 'Batch compatible shapes; do not batch incompatible promises.',
  };

  yield {
    state: schedulerGraph('Admission merges queue shape with live KV capacity'),
    highlight: { active: ['short', 'medium', 'long', 'prefill', 'kv', 'decode', 'admit', 'e-prefill-kv', 'e-kv-decode', 'e-decode-admit'], found: ['serve'] },
    explanation: 'A request can be the perfect length match and still be inadmissible if the KV pool is full. The admission policy combines queue age, shape fit, memory blocks, and p99 protection.',
  };

  yield {
    state: labelMatrix(
      'Queue policy choices',
      [
        { id: 'fifo', label: 'FIFO' },
        { id: 'bucket', label: 'length buckets' },
        { id: 'priority', label: 'priority queues' },
        { id: 'aging', label: 'aging' },
      ],
      [
        { id: 'win', label: 'win' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['simple fairness', 'padding waste'],
        ['less waste', 'starvation risk'],
        ['protect paid/SLA', 'unfairness'],
        ['bounded wait', 'less perfect batches'],
      ],
    ),
    highlight: { active: ['bucket:win', 'aging:win'], compare: ['bucket:risk', 'priority:risk'] },
    explanation: 'The scheduler is usually a hybrid: length buckets for efficiency, priorities for product promises, and aging so long or awkward requests eventually run.',
  };
}

function* latencyTradeoffs() {
  yield {
    state: plotState({
      axes: { x: { label: 'number of length buckets', min: 1, max: 12 }, y: { label: 'relative cost', min: 0, max: 1 } },
      series: [
        { id: 'padding', label: 'padding waste', points: [{ x: 1, y: 0.88 }, { x: 2, y: 0.6 }, { x: 4, y: 0.35 }, { x: 8, y: 0.2 }, { x: 12, y: 0.15 }] },
        { id: 'wait', label: 'queue wait', points: [{ x: 1, y: 0.18 }, { x: 2, y: 0.24 }, { x: 4, y: 0.36 }, { x: 8, y: 0.58 }, { x: 12, y: 0.76 }] },
      ],
      markers: [
        { id: 'knee', x: 4, y: 0.36, label: 'good knee' },
      ],
    }),
    highlight: { active: ['padding', 'wait', 'knee'] },
    explanation: 'More buckets reduce padding and shape mismatch, but too many buckets fragment the queue and make users wait for a perfect batch. The best point is workload-dependent.',
  };

  yield {
    state: labelMatrix(
      'Prefill and decode need different batching instincts',
      [
        { id: 'prefill', label: 'prefill' },
        { id: 'decode', label: 'decode' },
        { id: 'chunk', label: 'chunked prefill' },
        { id: 'agent', label: 'agent trace' },
      ],
      [
        { id: 'good bucket', label: 'good bucket' },
        { id: 'protect', label: 'protect' },
      ],
      [
        ['similar prompt length', 'GPU occupancy'],
        ['similar live cache', 'streaming p99'],
        ['chunk size', 'decode lanes'],
        ['context growth', 'KV budget'],
      ],
    ),
    highlight: { found: ['prefill:good bucket', 'decode:good bucket', 'chunk:protect'], compare: ['agent:protect'] },
    explanation: 'Prefill buckets reduce padding in dense prompt work. Decode buckets manage live cache and streaming smoothness. Chunked prefill intentionally breaks long prompts so decode traffic keeps moving.',
  };

  yield {
    state: schedulerGraph('Aging prevents shape buckets from becoming prisons'),
    highlight: { active: ['long', 'admit', 'serve', 'e-decode-admit', 'e-admit-serve'], compare: ['short', 'medium'], found: ['kv'] },
    explanation: 'A pure throughput scheduler can keep admitting easy short requests while long prompts age forever. Production schedulers need maximum wait, reserved capacity, or preemption rules for awkward shapes.',
    invariant: 'Throughput without fairness becomes a p99 incident.',
  };

  yield {
    state: labelMatrix(
      'Metrics that prove the scheduler works',
      [
        { id: 'ttft', label: 'TTFT by bin' },
        { id: 'tpot', label: 'TPOT by bin' },
        { id: 'age', label: 'queue age' },
        { id: 'kv', label: 'KV blocks' },
        { id: 'hit', label: 'prefix hits' },
      ],
      [
        { id: 'question', label: 'question' },
        { id: 'failure', label: 'failure caught' },
      ],
      [
        ['who waits first?', 'long prompts punished'],
        ['who streams slowly?', 'decode crowding'],
        ['who starves?', 'bucket prison'],
        ['who blocks memory?', 'admission deadlock'],
        ['who skips prefill?', 'bad normalization'],
      ],
    ),
    highlight: { active: ['ttft:failure', 'age:failure', 'kv:failure'], found: ['hit:failure'] },
    explanation: 'A scheduler without sliced metrics is invisible. Measure by length bin, service class, prefix-hit state, and mode, or the average will hide the users being harmed.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'bucket queues') yield* bucketQueues();
  else if (view === 'latency tradeoffs') yield* latencyTradeoffs();
  else throw new InputError('Pick a length-aware batching view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Length-aware batching is the queueing layer that decides which LLM requests are compatible enough to run together. Continuous batching changes batch membership at decode-iteration granularity. Length-aware scheduling decides the waiting order using prompt length, output budget, cache footprint, prefix-cache state, and service class. The point is to reduce wasted padding and memory churn without letting awkward requests starve.',
        'Orca introduced iteration-level scheduling and selective batching for transformer serving, scheduling at the granularity of one generation iteration rather than one full request: https://www.usenix.org/conference/osdi22/presentation/yu and https://www.usenix.org/system/files/osdi22-yu.pdf. vLLM documents continuous batching, chunked prefill, prefix caching, PagedAttention, and CUDA graph execution as part of the serving engine: https://docs.vllm.ai/. NVIDIA TensorRT-LLM describes in-flight batching, chunked context, KV cache, and request scheduling: https://nvidia.github.io/TensorRT-LLM/.',
      ],
    },
    {
      heading: 'Data structure',
      paragraphs: [
        'The scheduler keeps multiple queues rather than one FIFO. A request receives a shape key: model id, prompt length bin, output budget bin, decoding mode, prefix-hit state, service class, and sometimes adapter or tool-mode constraints. Each bin can be a FIFO, priority queue, or age-adjusted queue. The admission loop inspects queue heads, live decode lanes, KV-cache capacity, and p99 guardrails before selecting the next request or prefill chunk. Chunked Prefill Token Budget Scheduler drills into that last decision with a visible chunk cursor and max_num_batched_tokens ledger.',
        'This is a data-structure problem because the scheduler must answer repeated questions quickly: which waiting requests fit the current batch, which ones would waste padding, which ones are about to violate latency targets, and which ones would exceed KV memory. Hash tables map shape keys to queues. Priority queues rank by deadline or service class. Aging counters prevent starvation. The KV block manager provides the memory constraint.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Imagine three users arrive together: a short customer-support chat, a medium RAG prompt with repeated system instructions, and a long coding-agent trace. A pure FIFO scheduler may batch them together and pay heavy padding. A pure length-bucket scheduler may run the short chat quickly but leave the long coding trace waiting. A production scheduler does better: it uses the prefix hit to skip some RAG prefill, chunks the long prompt, reserves decode lanes for active streams, admits compatible short jobs, and ages the long job so it eventually receives service.',
        'The result is not maximum theoretical throughput. It is useful throughput under user promises. Time to first token remains bounded, time per output token stays smooth, and cache memory does not deadlock. Tail Latency matters because a serving system that looks efficient on average can still be unusable for the users in the wrong bucket.',
      ],
    },
    {
      heading: 'Pitfalls and study next',
      paragraphs: [
        'Do not confuse length-aware batching with sorting a dataset offline. Online serving has arrivals, cancellations, cache pressure, streaming, and service classes. Do not create too many buckets; queue fragmentation raises wait time. Do not optimize padding while ignoring KV memory. Do not report only aggregate tokens per second. Slice TTFT, TPOT, queue age, prefill chunking, and cache occupancy by bucket.',
        'Study LLM Continuous Batching, Chunked Prefill Token Budget Scheduler, Prefill/Decode Disaggregation Case Study, LLM Serving: PagedAttention, Prefix Caching & RadixAttention, KV Cache, Tail Latency, Backpressure, Load Balancer, Priority Queue, and LLM Inference Cost Stack next. Local source: Inference Scaling.txt in the provided document corpus.',
      ],
    },
  ],
};
