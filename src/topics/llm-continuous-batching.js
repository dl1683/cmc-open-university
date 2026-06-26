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
    explanation: `Static batching groups ${columns.length} requests and keeps the group fixed until the batch finishes. Request ${columns[0].label} ends early, but its lane stays idle while ${columns[2].label}, ${columns[3].label}, and ${columns[4].label} wait outside the batch. Variable output length becomes wasted GPU capacity.`,
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
    explanation: `Continuous batching schedules at token-iteration granularity across ${rows.length} iterations. When a request finishes, a waiting request can join on the next decode step. The unit of fairness is no longer the whole request; it is the next model iteration.`,
    invariant: `The batch is a live set across ${columns.length} lanes, not a fixed list.`,
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
    explanation: `Decode is attractive to batch because many users can share a weight read. It is also hard to batch because each sequence has a different length and cache footprint. ${topic.title} is the scheduler answer to that mismatch.`,
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
    explanation: `${topic.title} is not just a throughput trick. It is a control loop over admission, prefill/decode interference, cache memory, and p99 latency.`,
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
    explanation: `Selective batching groups compatible operations, not blindly every piece of every request. Dense model operations want big batches across ${columns.length} lanes, while sampling logic and cache metadata often remain request-specific.`,
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
    explanation: `A server must decide how prompt prefill and token decode share the GPU across ${rows.length} iterations. Chunked prefill and decode reservation are common ways to keep first-token work from ruining streaming latency.`,
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
    explanation: `The scheduler can interleave chunked prefill with decode across ${rows.length} iterations and ${columns.length} lanes. Prompt work uses the GPU efficiently, but decode lanes remain present so already-streaming users do not freeze.`,
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
    explanation: `The real ${topic.title} system is a queueing system wrapped around model kernels. Metrics, memory, routing, and fallback policy matter as much as the batching loop.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'Read each row as one decode iteration, meaning one model step that produces the next token for every active sequence. Active cells are requests being decoded now, and empty cells are unused GPU lanes. The safe inference is that a finished request can leave after one token step, so a waiting request can join before the old batch drains.',
        {type: 'callout', text: "Continuous batching treats the live batch as a token-step scheduling decision, not as a fixed request list."},
        {type: 'image', src: './assets/gifs/llm-continuous-batching.gif', alt: 'Animated walkthrough of the llm continuous batching visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Autoregressive large language models generate one token at a time. Each live request repeatedly reads the same model weights, but requests arrive at different times and finish after different output lengths. Continuous batching exists because fixed request batches waste expensive GPU work whenever short outputs leave lanes idle.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/46/Colored_neural_network.svg', alt: 'Layered neural network diagram with colored nodes', caption: 'Every decode iteration reuses the same model layers across many live sequences, which is why empty lanes waste expensive weight reads. Source: Wikimedia Commons, Glosser.ca, CC BY-SA 3.0.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is static batching. Gather several requests, pad them to compatible shapes, run them together, and wait until the batch finishes. That works for offline inference and for prompt prefill when many items have similar work.',
        'It is reasonable because GPUs like large dense batches. The model weights are read once for many examples, and kernel launch overhead is amortized. The problem is that interactive decode is not a fixed batch job; it is a stream of live conversations with uneven lengths.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is output-length variance. If request A finishes after 20 tokens while request B continues for 300, static batching leaves A lane empty or waits for a full batch boundary before admitting new work. The server can report high utilization while users wait because available token slots are stranded inside a frozen batch.',
        'Prefill creates another wall. A long prompt wants a large dense pass, while active chats need small repeated decode steps. If the scheduler lets prefill monopolize the GPU, time to first token may improve for one request while streaming latency gets worse for many others.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The scheduling unit should be a token step, not a whole request. After each decode iteration, the scheduler removes finished sequences, keeps unfinished sequences, and admits waiting sequences whose prompt state and KV cache are ready. The batch becomes a live set that changes between iterations.',
        'This is safe because the request state is not the batch identity. The state is the generated prefix, position, sampling parameters, stop rules, and KV cache. If those fields are preserved, a sequence can move through different batch memberships without changing its model computation.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The scheduler keeps queues for waiting prefill work and active decode work. On every iteration, it chooses compatible sequences, runs one model step, updates token state, frees completed requests, and checks memory before admitting more. The key loop is admission, decode, retire, and refill.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/6/69/Wikimedia_Foundation_Servers-8055_35.jpg', alt: 'Rows of servers in a datacenter', caption: 'Continuous batching lives inside each serving replica, but fleet-level routing still decides which machine receives the next request. Source: Wikimedia Commons, Victorgrigas, CC BY-SA 3.0.'},
        'Selective batching means the system batches the operations that can share shape. Attention and MLP kernels want compatible groups, while sampling, grammar constraints, penalties, stop rules, and cache metadata may remain request-specific. A production engine therefore combines batching policy with memory policy.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works because decode iterations have repeated structure. Every active sequence needs the same model layers for the next token, so grouping compatible sequences improves weight reuse and kernel efficiency. Removing completed sequences immediately prevents length variance from turning into idle lanes.',
        'Correctness follows from per-sequence state preservation. A request gets the same next-token distribution as long as the model reads the correct prefix state, position, cache, and sampling settings. Batch membership is only an execution grouping, so changing it between iterations does not change the mathematical request history.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost is scheduler and memory pressure. More live sequences increase KV cache use, queue bookkeeping, sampling work, and fairness decisions. When demand doubles, a naive scheduler may double queue age or memory pressure before it doubles useful tokens per second.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/c/c3/Cache_hierarchy.svg', alt: 'Cache hierarchy diagram from CPU registers through storage', caption: 'KV cache pressure is a memory hierarchy problem: fast scarce memory must hold the active state needed by the next token step. Source: Wikimedia Commons, CC BY-SA 4.0.'},
        'Good cost behavior is measured by tokens per dollar under latency limits, not by occupancy alone. Over-admission can raise throughput while hurting p99 latency. Under-admission keeps latency clean but leaves GPU lanes empty.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Continuous batching fits chat APIs, coding assistants, retrieval-augmented generation, agent backends, and any online LLM service with steady arrivals. It sits inside one serving replica, below fleet routing and above model kernels. The router chooses a machine; the local scheduler chooses when each sequence gets prefill and decode.',
        'It becomes stronger with chunked prefill, PagedAttention, length-aware queues, admission control, and phase-specific metrics. Time to first token, time per output token, queue age, cache occupancy, and p99 by request class are the signals that tell whether the policy is actually serving users.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when the scheduler treats all requests as equal. Short compatible jobs can starve long prompts, long prompts can freeze streaming users, and aggressive admission can exhaust KV cache. Fairness needs queue age, priority, memory footprint, and latency-class information.',
        'It also fails when metrics hide slices. Average tokens per second can improve while long-context users suffer constant preemption. A serving team needs per-phase and per-class dashboards, because the scheduler can make one slice better by moving pain into another.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Assume four decode lanes and requests A, B, C, D, E with output lengths 2, 5, 2, 3, and 2 tokens. Static batching starts A and B, then waits for B to finish; after token step 2, A lane is idle for steps 3, 4, and 5. Across five steps, 10 lane-slots exist and only 7 produce useful tokens.',
        'Continuous batching starts A and B, admits C when A finishes, admits D when C finishes, and admits E when B finishes if memory fits. The same first five steps can produce about 10 useful token computations instead of 7. The exact gain depends on cache memory and compatibility, but the arithmetic shows why refilling at token boundaries changes cost.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Read Orca for iteration-level scheduling and selective batching at https://www.usenix.org/conference/osdi22/presentation/yu. Then read PagedAttention at https://arxiv.org/abs/2309.06180 because continuous admission needs a KV-cache allocator that survives churn.',
        'Study load balancing for replica choice, queueing theory for waiting time, PagedAttention for memory blocks, chunked prefill for prompt interference, and tail latency for p99 behavior. The durable lesson is that LLM serving is a scheduling system wrapped around transformer kernels.',
      ],
    },
  ],
};
