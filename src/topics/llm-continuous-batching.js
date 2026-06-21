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
        "Read the animation as the execution trace for LLM Continuous Batching. Iteration-level scheduling for LLM serving: admit and remove requests every token step instead of freezing a whole batch..",
        {type: 'callout', text: "Continuous batching treats the live batch as a token-step scheduling decision, not as a fixed request list."},
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      
        {type: 'image', src: './assets/gifs/llm-continuous-batching.gif', alt: 'Animated walkthrough of the llm continuous batching visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why it exists',
      paragraphs: [
        `Autoregressive LLM serving has a shape ordinary request batching does not handle well. Every active user needs one model step for each generated token, but users arrive at different times, send prompts of different lengths, and stop after different output lengths. A chat reply might finish in 80 tokens while an agent trace keeps going for 1,500. If the server freezes a batch until every request finishes, the short request leaves an idle lane while other users wait outside.`,
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/46/Colored_neural_network.svg', alt: 'Layered neural network diagram with colored nodes', caption: 'Every decode iteration reuses the same model layers across many live sequences, which is why empty lanes waste expensive weight reads. Source: Wikimedia Commons, Glosser.ca, CC BY-SA 3.0.'},
        `Continuous batching exists because decode work is repeated, synchronized, and weight-heavy. On each decode iteration, many sequences can share a read of the same model weights. An empty lane during that step is wasted GPU opportunity. The scheduler therefore treats the batch as a live set: completed sequences leave, waiting sequences enter, and the next token iteration runs with as many legal active requests as the memory and latency policy allow.`,
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        `The naive approach is static batching. Collect several requests, run them together, and keep the batch membership fixed until all of them finish. This works for many offline workloads because every item in the batch has roughly the same shape. It can also work for prompt prefill, where a set of prompts can be padded or packed and processed in a large parallel pass.`,
        `The wall appears during interactive decode. Output length variance turns static batching into head-of-line blocking. A large frozen batch waits for its slowest sequence. A short sequence that finished early cannot free its lane for a waiting request. Average tokens per second may look fine while time to first token and p99 streaming latency degrade. FIFO fairness has a different wall: it respects arrival order but ignores the fact that a 200-token chat, a 16k-token prefill, and a tool-constrained agent trace do not impose the same compute, memory, or tail-latency risk.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `The core insight is that the scheduling unit should be a decode iteration, not an entire request. A request is long and unpredictable. A decode iteration is short and repeatable: choose active sequences, run one token step, update their state, remove finished sequences, and admit new work for the next step. Orca called this iteration-level scheduling and paired it with selective batching for transformer operations: https://www.usenix.org/conference/osdi22/presentation/yu.`,
        `The invariant is simple: each decode iteration chooses a legal live set. A sequence may join decode only if its prompt has been processed, its KV cache is resident, its sampling state is valid, and the scheduler is willing to spend capacity on it. The batch is not a promise that every original request stays until the end. It is a snapshot of which sequences are eligible for the next model step.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `A continuous-batching scheduler loops over active requests. After each token step, it checks which sequences emitted an end token, hit a maximum length, violated a stop rule, or were cancelled by the client. Those sequences leave the live set and their KV cache blocks can be reclaimed. The scheduler then looks at the waiting queue, estimates whether each candidate fits available KV memory and policy constraints, and admits compatible requests before the next decode iteration.`,
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/6/69/Wikimedia_Foundation_Servers-8055_35.jpg', alt: 'Rows of servers in a datacenter', caption: 'Continuous batching lives inside each serving replica, but fleet-level routing still decides which machine receives the next request. Source: Wikimedia Commons, Victorgrigas, CC BY-SA 3.0.'},
        `Selective batching handles the fact that a transformer request is not one uniform operation. Dense attention and MLP kernels want large compatible batches because they reuse model weights well. Sampling may differ by request because temperature, top-p, penalties, grammar constraints, or structured-output masks vary. Cache updates are also per-request metadata operations. A good serving engine batches the operations that benefit from batching and keeps the request-specific pieces separate enough to preserve correctness.`,
        `Prefill complicates the loop. Prompt processing is large dense work; decode is many small repeated steps. If a long prompt monopolizes the GPU, already-streaming users freeze. Systems use policies such as chunked prefill, decode reservation, length-aware queues, and separate prefill/decode workers to keep first-token work from destroying time per output token. Continuous batching is therefore a scheduler plus a memory manager plus a latency policy, not just a bigger batch size.`,
      ],
    },
    {
      heading: 'How it works (2)',
      paragraphs: [
        `The static-vs-continuous view makes the wasted lane visible. In the static schedule, request A finishes early, but its lane stays idle while C, D, and E wait outside the frozen batch. In the continuous schedule, those waiting requests can enter on later iterations. The important move is not that the matrix has more colored cells. It is that admission happens after each token step rather than only after the original batch drains.`,
        `The selective-batching view proves a second point: continuous batching is not blind mixing. Attention and MLP work can be grouped because their kernel shapes are compatible after padding or packing. Sampling, stopping rules, cache metadata, and prefill chunks remain policy-controlled. The mixed schedule shows chunked prefill interleaved with decode so prompt work uses the GPU while streaming users still advance.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `Continuous batching works because decode iterations have a shared structure. Every active sequence needs the same model weights for the next step. By packing compatible sequences into the same iteration, the server amortizes weight reads and kernel launches across more useful tokens. Removing finished sequences immediately prevents output-length variance from wasting lanes.`,
        `Correctness comes from preserving per-sequence state. A sequence can be decoded in a different batch on every iteration as long as its KV cache, position, sampling parameters, stop criteria, and generated prefix remain intact. The batch is only an execution grouping. It is not part of the model's mathematical state. That separation is what lets schedulers rearrange live requests without changing each request's token history.`,
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        `The gain is throughput under latency constraints, not free capacity. More live sequences consume more KV cache, more scheduler bookkeeping, more sampling work, and sometimes longer per-request waits. If the scheduler admits too aggressively, it can increase total tokens per second while making p99 worse. If it admits too conservatively, the GPU sits underfilled and cost per token rises.`,
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/c/c3/Cache_hierarchy.svg', alt: 'Cache hierarchy diagram from CPU registers through storage', caption: 'KV cache pressure is a memory hierarchy problem: fast scarce memory must hold the active state needed by the next token step. Source: Wikimedia Commons, CC BY-SA 4.0.'},
        `Memory management is the hard systems partner. KV cache grows and shrinks dynamically as requests arrive, generate, and finish. PagedAttention attacks this by allocating cache in blocks, reducing fragmentation and enabling better sharing for common prefixes: https://arxiv.org/abs/2309.06180. Without a block allocator or equivalent memory plan, continuous admission can run into cache fragmentation, preemption churn, or outright memory deadlock.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `Continuous batching fits online LLM serving with many concurrent users: chat, coding assistants, agent backends, RAG systems, customer-support bots, and API platforms where requests arrive continuously rather than as a clean offline dataset. It sits inside a model replica, below the request router and above the model kernels. The router chooses a replica; the local scheduler chooses when a request gets prefill, when it joins decode, and when it must wait for memory.`,
        `It is most useful when paired with length-aware routing, chunked prefill, PagedAttention, admission control, speculative decoding, and phase-specific metrics. The production contract is not maximum occupancy. It is the best tokens per dollar that still respects time to first token, time per output token, queue age, memory safety, cancellation behavior, and p99 by request class.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `Continuous batching can fail by over-admitting. More live sequences mean more KV memory, more attention reads, and a larger scheduling surface. It can also starve awkward requests if short compatible jobs keep arriving and the policy has no queue-age protection. A long prefill can still freeze streaming users unless prefill and decode are separated, chunked, or rate-limited.`,
        `It also fails when metrics are too coarse. Aggregate tokens per second can hide users who wait too long for the first token. Average latency can hide a terrible p99. GPU utilization can look healthy while a subset of long-context users is constantly preempted. Measure TTFT, TPOT, cache occupancy, queue age, preemption, cancellation, admission rejects, and p99 by prompt length, output length, model, adapter, and request class.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Study Orca for iteration-level scheduling and selective batching, then PagedAttention for the memory allocator that makes high-churn KV cache practical. After that, study length-aware batching, chunked prefill token budgets, SLO-aware request routing, KV cache capacity models, prefill/decode disaggregation, transformer inference rooflines, backpressure, load balancers, and tail-latency thinking. The durable lesson is that LLM serving is a queueing system wrapped around model kernels; throughput numbers mean little without the scheduler state that produced them.`,
      ],
    },
      {
      heading: 'Why this exists',
      paragraphs: [
        "State the real constraint this topic fixes before introducing the mechanism.",
        "A good opening says what gets too slow, too fragile, or too hard to reason about under baseline behavior.",
        "Without that, every optimization appears decorative.",
      ],
    },

    {
      heading: 'The obvious approach',
      paragraphs: [
        "Name the reasonable first attempt and why teams reach for it.",
        "Then show the exact place that approach stops scaling or starts breaking.",
        "Treat this section as contrast, not a rejection.",
      ],
    },

    {
      heading: 'Worked example',
      paragraphs: [
        "Trace one representative example end-to-end so readers can watch state evolve across every step.",
        "Keep the walkthrough concise and precise: at each step, write current state, action taken, and resulting output.",
        "The goal is prediction, not a one-off demonstration.",
      ],
    },
    {
      heading: 'Learning map',
      paragraphs: [
        'Before this topic, check your prerequisites and map what is assumed, what is computed, and where this mechanism first appears in real systems.',
        'After this topic, follow each unlock topic and test whether you can explain why this mechanism unlocks it.',
        'Use the frame order to prove one invariant per frame and one cost consequence per major operation.',
      ],
    },

    {
      heading: 'Frame-by-frame checkpoints',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Pause on each state change and name exactly what data moved, which references changed, and why the move is legal.',
            'State the invariant that must remain true before the next frame starts.',
            'Track what changed in size, order, ownership, or topology for the operation you are watching.',
            'Translate the active frame into a one-line explanation as if teaching a teammate.',
          ],
        },
      ],
    },

    {
      heading: 'Micro checks',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Can you state one operation-level invariant in one sentence?',
            'Can you derive the time cost from the frame sequence without referencing external formulas?',
            'Can you name one hidden edge case where the naive implementation fails?',
            'Can you transfer this mechanism to one system from a different domain?',
          ],
        },
      ],
    },

    {
      heading: 'Try this now',
      paragraphs: [
        'Build one counterexample input by hand and predict every animation frame before running it; compare your prediction to the trace.',
        'Use this topic as a checkpoint: if you can explain why LLM Continuous Batching moves from input to output in the animation and where it fails, you are ready for the next topic.',
      ],
    },

      {
        heading: 'Sources and study next',
        paragraphs: [
          'Read one primary source, one implementation source, and one production case where this idea appears.',
          'If they disagree on a detail, prefer the source with the clearest constraint and define the simplification for this animation.',
          'Then choose three study topics: one prerequisite, one extension, and one case study for your next session.',
        ],
      },
],
};

