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
        'Follow the visualization step by step. Each frame shows one operation with the current state highlighted. Use the slider or play button to control playback.',
        {type: 'image', src: './assets/gifs/length-aware-batching-llm-scheduler.gif', alt: 'Animated walkthrough of the length aware batching llm scheduler visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why This Exists',
      paragraphs: [
        `Length-aware batching exists because LLM requests do not cost the same amount of GPU time. A 200-token chat prompt, a 60,000-token retrieval prompt, a short classification output, and a long agent trace can all arrive at the same model server. If the scheduler treats them as interchangeable, batching improves average throughput while wasting padding, crowding KV cache, and damaging tail latency.`,
        `Continuous batching answers when live decode lanes can accept more work. Length-aware batching answers which waiting request should enter next. That choice has to account for prompt length, output budget, prefix-cache hits, service class, and memory footprint. The goal is not perfect sorting. The goal is enough shape awareness to batch compatible work without starving awkward requests.`,
        {type: 'callout', text: `Length-aware batching is admission control over request shape: it spends a little queue structure to save GPU memory, padding work, and p99 latency.`},
      ],
    },
    {
      heading: 'The Obvious Approach',
      paragraphs: [
        `The obvious baseline is one FIFO queue feeding a continuous-batching loop. FIFO is easy to reason about and fair by arrival order. It works when requests are roughly similar. It breaks when one long prefill monopolizes compute, one long output keeps KV blocks resident, or a stream of easy short prompts keeps jumping through the system while long-context users wait.`,
        `The opposite mistake is offline sorting: create many fine-grained buckets and wait for perfect matches. Padding falls, but queueing delay rises. Online serving cannot wait forever for a beautiful batch. Users care about time to first token and time per output token, not only aggregate tokens per second.`,
      ],
    },
    {
      heading: 'The Wall',
      paragraphs: [
        `The wall is that LLM serving has two different phases with different shapes. Prefill processes the prompt and is mostly dense parallel work over many input tokens. Decode emits one token at a time for each active sequence and keeps KV cache alive. A good prefill batch is not always a good decode batch.`,
        `The second wall is memory residency. A request can be a good length match and still be inadmissible if its KV footprint does not fit. Prefix caching can make a long prompt cheap if the prefix hits, while a modest prompt with a long output can occupy memory for many iterations. A scheduler that sees only arrival order misses the real bottleneck.`,
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/d/d3/Nvidia_GV100_GPU.png', alt: 'Nvidia GV100 GPU die showing many compute units on one accelerator.', caption: `GPU serving throughput depends on feeding dense kernels without letting memory residency dominate admission. Source: Wikimedia Commons, Nvidia, public domain.`},
      ],
    },
    {
      heading: 'Core Insight',
      paragraphs: [
        `The core insight is to turn each waiting request into a coarse shape key before admission. The key is not only batch size. It can include model id, prompt-length bin, output-budget bin, mode, prefix-cache state, adapter or tool constraints, tenant priority, and service-level objective.`,
        `The invariant is: batch compatible shapes, but do not let shape become a prison. Similar prompt lengths reduce prefill padding. Similar live-cache footprints make decode smoother. Aging, reserved capacity, and deadline boosts keep rare or long requests moving. This is a scheduler data structure, not a static preprocessing pass.`,
      ],
    },
    {
      heading: 'How It Works',
      paragraphs: [
        `On arrival, the router chooses a replica or engine. The local scheduler computes a shape key and places the request into a bucket queue. A bucket can be FIFO inside the shape, priority-ordered, or age-adjusted. The admission loop then inspects queue heads, live decode lanes, KV block availability, prefix-cache state, and p99 guardrails.`,
        `If decode lanes are under pressure, the scheduler may delay or chunk long prefill work. If KV memory is full, it may reject, preempt, or wait. If a premium service class has a deadline, it may admit a less efficient batch to protect latency. The policy is usually hybrid: length buckets for efficiency, priority for product promises, aging for fairness, and memory checks for safety.`,
      ],
    },
    {
      heading: 'What the Visual Proves',
      paragraphs: [
        `The bucket-queue view proves that admission starts before the GPU kernel. Requests first become comparable shapes: short, mid, long, cacheable, priority, or agent-like. The important edge is the one from raw arrival to shape key, because that is where a flat queue becomes a set of scheduling choices.`,
        `The latency plot proves the tuning problem. More buckets reduce padding and shape mismatch, but too many buckets fragment the queue. The good operating point is the knee where padding waste has fallen and queue wait is still acceptable. The aging view proves the fairness rule: a shape bucket must never become a waiting room with no exit.`,
      ],
    },
    {
      heading: 'Why It Works',
      paragraphs: [
        `Batching helps because GPUs like dense repeated work. Length awareness improves batching by reducing wasted work inside a batch. Similar prompt lengths reduce padded prefill. Similar output budgets reduce surprise residency. Similar KV footprints reduce decode stalls and memory-pressure churn.`,
        `The fairness mechanisms work by adding time back into the key. A request starts in a shape bucket, but its age, deadline, and service class can raise its admission priority. That keeps the scheduler from optimizing only for easy requests. The policy is correct only relative to explicit goals: protect p99, keep GPUs busy, respect memory limits, and bound starvation.`,
      ],
    },
    {
      heading: 'Cost and Behavior',
      paragraphs: [
        `The data-structure cost is modest. A hash map from shape keys to queues gives O(1) expected insertion. Picking the next request can be O(number of active buckets), O(log buckets) with a heap, or policy-specific if the scheduler scores candidates. The real cost is operational: more queues, more metrics, more tuning, and more ways to create unfairness.`,
        `The hidden cost is delayed admission. A narrow bucket lowers compute waste but may wait longer to fill. A broad bucket fills quickly but wastes padding or KV budget. Length-aware batching is a tradeoff curve, not a free optimization. Every production setting needs knobs for bucket boundaries, max wait, prefill chunk size, priority boosts, and memory reserve.`,
      ],
    },
    {
      heading: 'Where It Fits',
      paragraphs: [
        `Length-aware batching sits between global routing and the local engine loop. A load balancer or request router chooses a model replica. The local scheduler decides which waiting request or prefill chunk consumes the next admission opportunity. The KV block manager supplies a hard constraint, and the continuous-batching loop executes the admitted work one iteration at a time.`,
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with nodes connected by arrows.', caption: `A serving path is a directed flow from router to scheduler to KV manager to decode loop; length-aware policy lives on those admission edges. Source: Wikimedia Commons, David W., public domain.`},
        `This pattern lines up with modern serving systems. Orca introduced iteration-level scheduling and selective batching for transformer serving. vLLM documents continuous batching, chunked prefill, prefix caching, PagedAttention, and CUDA graph execution. TensorRT-LLM documents in-flight batching, chunked context, KV cache management, and request scheduling. Length-aware queues are one control layer around those mechanisms.`,
      ],
    },
    {
      heading: 'Where It Wins',
      paragraphs: [
        `It wins on mixed traffic: chat plus RAG, agents plus short classification, shared-prefix workloads plus one-off prompts, and deployments with multiple service classes. It is especially useful when long prompts can be chunked, when prefix-cache hits change prefill cost, or when output budgets vary enough to change KV residency.`,
        `It also wins when the platform has enough observability to tune policy by bucket. If TTFT, TPOT, queue age, admission rejects, KV blocks, prefix hits, prefill chunking, cancellation rate, and service class are all visible by shape, the scheduler can be adjusted with evidence instead of averages.`,
      ],
    },
    {
      heading: 'Failure Modes',
      paragraphs: [
        `Length-aware batching fails when the shape key omits the real bottleneck. Prompt length alone is not enough if prefix hits, output budget, LoRA adapter, guided-decoding grammar, tool mode, tenant priority, or KV pressure dominates. It also fails when bucket boundaries are copied from a benchmark instead of measured on live traffic.`,
        `It can starve long or rare shapes. It can improve average throughput while making p99 worse. It can overload memory by admitting requests that look short but decode for a long time. It can hide damage if dashboards aggregate all users into one mean latency. The fix is sliced metrics and explicit starvation guards.`,
        `Measure time to first token by prompt-length bin, time per output token by live batch size, queue age by bucket, KV blocks reserved and evicted, prefix-cache hit rate, prefill chunk sizes, decode-lane occupancy, admission rejects, preemptions, cancellations, and p95/p99 by service class. A scheduler without sliced metrics is mostly invisible.`,
        `Test adversarial mixes: many short prompts during one very long prefill, long outputs that exceed their declared budget, shared-prefix floods, cache-miss bursts, priority traffic during memory pressure, and cancellations while chunks are queued. The question is not whether the scheduler is clever. The question is whether every request class has a bounded path to service.`,
      ],
    },
    {
      heading: 'Study Next',
      paragraphs: [
        `Study LLM Continuous Batching first, because it explains the live decode batch this scheduler feeds. Then study Chunked Prefill Token Budget Scheduler, PagedAttention, Prefix Caching and RadixAttention, KV Cache, Tail Latency, Backpressure, Priority Queue, Load Balancer, and LLM Inference Cost Stack.`,
        `Primary references for the serving layer are Orca at https://www.usenix.org/conference/osdi22/presentation/yu, vLLM documentation at https://docs.vllm.ai/, and TensorRT-LLM documentation at https://nvidia.github.io/TensorRT-LLM/. Use them to separate the engine mechanisms from this topic's scheduling question: which waiting shape should enter next?`,
      ],
    },
  ],
};
