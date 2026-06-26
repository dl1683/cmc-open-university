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
    explanation: `${topic.title} decides which waiting request should enter a continuous-batching loop next. The ${topic.category} scheduler groups similar prompt lengths, output budgets, and cache footprints before admission so live decode lanes refill with compatible work.`,
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
    explanation: `The ${topic.title} scheduler key is not only batch size. It encodes the 5 dimensions that change compute, memory, and latency: prompt length, output budget, mode, prefix-cache hit, and service class.`,
    invariant: `In ${topic.category} scheduling, batch compatible shapes; do not batch incompatible promises.`,
  };

  yield {
    state: schedulerGraph('Admission merges queue shape with live KV capacity'),
    highlight: { active: ['short', 'medium', 'long', 'prefill', 'kv', 'decode', 'admit', 'e-prefill-kv', 'e-kv-decode', 'e-decode-admit'], found: ['serve'] },
    explanation: `In ${topic.title}, a request can be the perfect length match and still be inadmissible if the KV pool is full. The admission policy combines queue age, shape fit, memory blocks, and p99 protection.`,
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
    explanation: `The ${topic.title} scheduler is usually a hybrid of all 4 policies: length buckets for efficiency, priorities for product promises, and aging so long or awkward requests in this ${topic.category} layer eventually run.`,
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
    explanation: `More buckets reduce padding and shape mismatch in ${topic.title}, but too many buckets fragment the queue and make users wait for a perfect batch. The plot's 2 series (padding waste vs. queue wait) cross near the knee at bucket count 4.`,
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
    explanation: `In this ${topic.category} view of ${topic.title}, prefill buckets reduce padding in dense prompt work. Decode buckets manage live cache and streaming smoothness. Chunked prefill intentionally breaks long prompts so decode traffic keeps moving.`,
  };

  yield {
    state: schedulerGraph('Aging prevents shape buckets from becoming prisons'),
    highlight: { active: ['long', 'admit', 'serve', 'e-decode-admit', 'e-admit-serve'], compare: ['short', 'medium'], found: ['kv'] },
    explanation: `A pure throughput ${topic.title} scheduler can keep admitting easy short requests while long prompts age forever. Production ${topic.category} schedulers need maximum wait, reserved capacity, or preemption rules for awkward shapes.`,
    invariant: `In ${topic.title}, throughput without fairness becomes a p99 incident.`,
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
    explanation: `A ${topic.title} scheduler without sliced metrics across all 5 dimensions is invisible. Measure by length bin, service class, prefix-hit state, and mode, or the average will hide the users being harmed.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'Each request has a prompt length and a remaining generation budget. The active queue is the scheduler deciding which requests can share one GPU step. A batch is valid only if its total token work and key-value cache memory fit the serving limit.',
        'Treat padding as visible waste. If a request with 32 tokens and a request with 2048 tokens run in the same prefill batch, the short request waits behind work shaped by the long one. Length-aware batching groups similar shapes so the GPU does less empty work and long requests do not quietly dominate latency.',
        {type: 'image', src: './assets/gifs/length-aware-batching-llm-scheduler.gif', alt: 'Animated walkthrough of the length aware batching llm scheduler visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Large language model serving is not just function calls. Each request consumes compute for prompt processing, memory for key-value cache entries, and repeated decode steps for generated tokens. A scheduler must decide which requests run together without exceeding GPU memory or hurting tail latency.',
        'Length-aware batching exists because request shape controls cost. A 40-token chat and a 4000-token document summary are not interchangeable jobs even if both ask the same model for one answer. The scheduler needs request length as an admission signal.',
        {type: 'callout', text: `Length-aware batching is admission control over request shape: it spends a little queue structure to save GPU memory, padding work, and p99 latency.`},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious scheduler batches requests in arrival order. Take the next k requests, pad them to the longest sequence in the batch, run the GPU kernel, and repeat. This is easy to implement and gives decent throughput when requests have similar lengths.',
        'First-in first-out also feels fair because older requests are served first. It avoids complex queues and makes debugging simple. The policy fails only when the shape of the workload becomes mixed.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is padding, cache residency, and tail latency. If a batch contains prompts of length 64, 128, 4096, and 5120, the short prompts wait for kernels sized around the long prompts. During decode, every active request also holds key-value cache memory until it finishes.',
        'A single long request can reduce the number of other requests that fit on the GPU. When memory is tight, admitting the wrong mix causes out-of-memory errors, excessive preemption, or p99 latency spikes. The arrival order did not encode the resource shape.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/d/d3/Nvidia_GV100_GPU.png', alt: 'Nvidia GV100 GPU die showing many compute units on one accelerator.', caption: `GPU serving throughput depends on feeding dense kernels without letting memory residency dominate admission. Source: Wikimedia Commons, Nvidia, public domain.`},
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Batching is a packing problem over token shapes, not a pure queue problem. Similar prompt lengths reduce padding during prefill, and similar remaining decode lengths reduce churn during generation. The scheduler should group requests by the resource they actually consume.',
        'The invariant is capacity feasibility. At every step, the chosen batch must fit compute and memory budgets, and the policy should prefer combinations that waste fewer padded tokens. Fairness still matters, so age or priority usually stays in the rule as a tiebreaker or starvation guard.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The scheduler records each request with prompt tokens, generated tokens so far, maximum output tokens, priority, and arrival time. It places requests into length buckets such as 0-256, 257-1024, and 1025-4096 prompt tokens. Inside each bucket, it can keep FIFO order or priority order.',
        'For prefill, it selects a bucket whose requests have similar prompt lengths and admits as many as fit the token and memory budget. For decode, it tracks active sequences and estimates cache use as layers times heads times head dimension times tokens times bytes. Finished requests free their cache slots.',
        'Some systems split prefill and decode scheduling because the bottlenecks differ. Prefill is large matrix work over many prompt tokens. Decode is repeated one-token work over resident cache. Length-aware policy can choose different queues for each phase.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with nodes connected by arrows.', caption: `A serving path is a directed flow from router to scheduler to KV manager to decode loop; length-aware policy lives on those admission edges. Source: Wikimedia Commons, David W., public domain.`},
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is a resource invariant. A request can run only when the scheduler has reserved enough batch slots, token budget, and key-value cache memory for it. If every admission preserves those bounds, the batch cannot exceed the modeled capacity.',
        'The latency benefit follows from reducing wasted padded work. Grouping similar prompt lengths makes the maximum length in a batch closer to the average length. Starvation is prevented only if the policy also ages waiting requests or reserves capacity for long buckets; length awareness alone is not a fairness proof.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Queue operations are usually O(log b) or O(1), where b is the number of buckets, because a request is inserted into one length class and later removed. The expensive cost is the model step, so scheduler overhead must stay tiny compared with GPU compute. Memory overhead is O(r) for r queued or active requests plus accounting metadata.',
        'When requests double, the queue metadata doubles, but GPU feasibility depends on total tokens and cache bytes, not request count alone. A batch of 64 short requests may fit where 8 long requests do not. The dominant behavior is the maximum sequence length in each batch and the resident cache footprint.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'LLM inference servers use length-aware scheduling to improve throughput under mixed chat, retrieval-augmented generation, summarization, and agent workloads. The access pattern is a stream of heterogeneous requests competing for one or more accelerators. The policy turns request metadata into safer batch formation.',
        'It is also useful in offline embedding or scoring jobs. Grouping documents by token length can reduce padding and improve accelerator utilization. The same idea appears in training data loaders, where bucketing examples by sequence length reduces wasted compute.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Length buckets can starve long requests if the service always prefers short batches. They can also fragment capacity, leaving one bucket full while another has unusable slack. Production schedulers need age limits, priority policy, cancellation handling, and backpressure.',
        'The model can be wrong. Tokenization happens after request parsing, generated length is uncertain, and memory use changes with quantization, attention implementation, parallelism, and cache paging. A simple length heuristic is useful, but it is not a replacement for live capacity accounting.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a GPU step allows at most 8192 prompt tokens. Four requests arrive with prompt lengths 200, 240, 3900, and 4100. FIFO batching all four pads to 4100, so the effective prompt work is 4 * 4100 = 16400 token positions, which does not fit.',
        'Length-aware batching forms one short batch with 200 and 240, padded to 240 for 480 token positions. It forms one long batch with 3900 and 4100, padded to 4100 for 8200 token positions, which is slightly over the limit and must be split or delayed. The scheduler avoids making the short requests wait behind the long batch and avoids pretending that four very different shapes fit together.',
        'If the long limit is raised to 9000, the long pair fits and wastes 200 padded positions. The FIFO four-request batch would waste 7960 padded positions against the real token sum of 8440. The behavior difference is visible before any kernel runs.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study continuous batching, vLLM paged attention, Orca-style iteration-level scheduling, TensorRT-LLM serving, and SGLang request scheduling for production context. The stable principle is resource-shaped admission: prompt length, decode length, and cache residency determine behavior.',
        'Study next by layer. For algorithms, review priority queues, bin packing, and fair scheduling. For systems, review GPU memory hierarchy, key-value cache layout, prefill versus decode, and backpressure in online services.',
      ],
    },
  ],
};
