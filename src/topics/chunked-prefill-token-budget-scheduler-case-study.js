// Chunked prefill scheduling: split long prompt work into token-budgeted chunks
// so decode iterations stay responsive while the GPU still receives dense work.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'chunked-prefill-token-budget-scheduler-case-study',
  title: 'Chunked Prefill Token Budget Scheduler',
  category: 'Systems',
  summary: 'An LLM serving scheduler pattern: prioritize decode, spend leftover max_num_batched_tokens on bounded prefill chunks, and tune ITL/TTFT tradeoffs with a chunk ledger.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['token budget', 'chunk ledger', 'stall audit'], defaultValue: 'token budget' },
  ],
  run,
};

const iterRows = [
  { id: 'i1', label: 'i1' },
  { id: 'i2', label: 'i2' },
  { id: 'i3', label: 'i3' },
  { id: 'i4', label: 'i4' },
  { id: 'i5', label: 'i5' },
];

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
      { id: 'arrive', label: 'arrive', x: 0.7, y: 3.5, note: 'reqs' },
      { id: 'decodeQ', label: 'dec q', x: 2.1, y: 2.0, note: 'streams' },
      { id: 'prefillQ', label: 'pre q', x: 2.1, y: 5.0, note: 'prompts' },
      { id: 'budget', label: 'budget', x: 4.0, y: 3.5, note: 'tokens' },
      { id: 'chunker', label: 'chunker', x: 5.7, y: 5.0, note: 'cursor' },
      { id: 'batch', label: 'batch', x: 6.4, y: 2.5, note: 'mixed' },
      { id: 'kv', label: 'KV', x: 7.8, y: 5.0, note: 'blocks' },
      { id: 'stream', label: 'stream', x: 9.0, y: 2.5, note: 'ITL' },
    ],
    edges: [
      { id: 'e-arrive-decode', from: 'arrive', to: 'decodeQ', weight: '' },
      { id: 'e-arrive-prefill', from: 'arrive', to: 'prefillQ', weight: '' },
      { id: 'e-decode-budget', from: 'decodeQ', to: 'budget', weight: 'first' },
      { id: 'e-budget-batch', from: 'budget', to: 'batch', weight: '' },
      { id: 'e-prefill-chunker', from: 'prefillQ', to: 'chunker', weight: '' },
      { id: 'e-budget-chunker', from: 'budget', to: 'chunker', weight: 'left' },
      { id: 'e-chunker-batch', from: 'chunker', to: 'batch', weight: 'pre' },
      { id: 'e-chunker-kv', from: 'chunker', to: 'kv', weight: 'KV' },
      { id: 'e-batch-stream', from: 'batch', to: 'stream', weight: 'dec' },
      { id: 'e-kv-stream', from: 'kv', to: 'stream', weight: '' },
    ],
  }, { title });
}

function chunkGraph(title) {
  return graphState({
    nodes: [
      { id: 'req', label: 'long req', x: 0.6, y: 3.6, note: '16k' },
      { id: 'cursor', label: 'cursor', x: 2.0, y: 3.6, note: 'done' },
      { id: 'c0', label: 'c0', x: 3.4, y: 1.8, note: 'ready' },
      { id: 'c1', label: 'c1', x: 4.7, y: 3.0, note: 'ready' },
      { id: 'c2', label: 'c2', x: 6.0, y: 4.2, note: 'next' },
      { id: 'c3', label: 'c3', x: 7.3, y: 5.4, note: 'wait' },
      { id: 'kv', label: 'KV', x: 7.5, y: 2.0, note: 'paged' },
      { id: 'first', label: 'first', x: 9.0, y: 3.2, note: 'token' },
    ],
    edges: [
      { id: 'e-req-cursor', from: 'req', to: 'cursor', weight: '' },
      { id: 'e-cursor-c0', from: 'cursor', to: 'c0', weight: '' },
      { id: 'e-c0-c1', from: 'c0', to: 'c1', weight: '' },
      { id: 'e-c1-c2', from: 'c1', to: 'c2', weight: '' },
      { id: 'e-c2-c3', from: 'c2', to: 'c3', weight: '' },
      { id: 'e-c0-kv', from: 'c0', to: 'kv', weight: 'KV' },
      { id: 'e-c1-kv', from: 'c1', to: 'kv', weight: 'KV' },
      { id: 'e-c2-kv', from: 'c2', to: 'kv', weight: 'KV' },
      { id: 'e-c3-kv', from: 'c3', to: 'kv', weight: 'KV' },
      { id: 'e-kv-first', from: 'kv', to: 'first', weight: 'done' },
    ],
  }, { title });
}

function tradeoffPlot(markers = []) {
  return plotState({
    axes: { x: { label: 'chunk toks', min: 0, max: 9000 }, y: { label: 'score', min: 0, max: 100 } },
    series: [
      { id: 'itl', label: 'ITL good', points: [{ x: 512, y: 94 }, { x: 1024, y: 88 }, { x: 2048, y: 78 }, { x: 4096, y: 56 }, { x: 8192, y: 28 }] },
      { id: 'ttft', label: 'TTFT good', points: [{ x: 512, y: 30 }, { x: 1024, y: 45 }, { x: 2048, y: 68 }, { x: 4096, y: 82 }, { x: 8192, y: 92 }] },
      { id: 'util', label: 'util', points: [{ x: 512, y: 44 }, { x: 1024, y: 58 }, { x: 2048, y: 75 }, { x: 4096, y: 86 }, { x: 8192, y: 90 }] },
    ],
    markers,
  });
}

function* tokenBudget() {
  yield {
    state: schedulerGraph('Decode gets first claim on each iteration'),
    highlight: { active: ['decodeQ', 'budget', 'batch', 'stream', 'e-decode-budget', 'e-budget-batch', 'e-batch-stream'], compare: ['prefillQ', 'chunker'] },
    explanation: 'Chunked prefill starts with a priority rule: pending decode streams get batched first because users feel inter-token latency. Prefill is admitted only after the decode work has claimed its share of the iteration.',
  };

  yield {
    state: labelMatrix(
      'One scheduler iteration',
      [
        { id: 'decode', label: 'decode' },
        { id: 'left', label: 'left' },
        { id: 'pre', label: 'pre' },
        { id: 'result', label: 'result' },
      ],
      [
        { id: 'tokens', label: 'tokens' },
        { id: 'choice', label: 'choice' },
      ],
      [
        ['640', 'must run'],
        ['1408', 'budget'],
        ['1024', 'chunk'],
        ['384', 'slack'],
      ],
    ),
    highlight: { active: ['decode:tokens', 'left:tokens', 'pre:tokens'], found: ['result:choice'] },
    explanation: 'If max_num_batched_tokens is 2048 and live decodes consume 640 token slots, the scheduler can spend the remaining 1408 on prefill. A 1024-token chunk fits; the whole 16k prompt does not.',
    invariant: 'Chunk size is a scheduling budget, not a model architecture change.',
  };

  yield {
    state: schedulerGraph('Leftover budget becomes prefill chunks'),
    highlight: { active: ['prefillQ', 'chunker', 'budget', 'e-prefill-chunker', 'e-budget-chunker', 'e-chunker-batch', 'e-chunker-kv'], found: ['kv'], compare: ['decodeQ'] },
    explanation: 'The long prompt is not rejected. It receives a cursor and advances by chunks across several iterations, writing KV blocks as it goes. Decode stays present in every mixed batch.',
  };

  yield {
    state: labelMatrix(
      'Budgeted schedule',
      iterRows,
      [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
        { id: 'c', label: 'C' },
        { id: 'pre', label: 'pre' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['dec', 'dec', '', 'p0', 'ok'],
        ['dec', 'dec', 'dec', 'p1', 'ok'],
        ['', 'dec', 'dec', 'p2', 'ok'],
        ['dec', '', 'dec', 'p3', 'ok'],
        ['dec', 'dec', 'dec', '', 'low'],
      ],
    ),
    highlight: { active: ['i1:pre', 'i2:pre', 'i3:pre', 'i4:pre'], found: ['i2:a', 'i4:c'], compare: ['i5:risk'] },
    explanation: 'A stall-free schedule interleaves decode lanes with bounded prompt chunks. The prefill request progresses, but it does not turn one iteration into a multi-second wall for active streams.',
  };

  yield {
    state: labelMatrix(
      'What the scheduler stores',
      [
        { id: 'cursor', label: 'cursor' },
        { id: 'remain', label: 'remain' },
        { id: 'kv', label: 'KV' },
        { id: 'age', label: 'age' },
        { id: 'class', label: 'class' },
      ],
      [
        { id: 'field', label: 'field' },
        { id: 'why', label: 'why' },
      ],
      [
        ['next', 'resume'],
        ['tokens', 'budget'],
        ['blocks', 'reuse'],
        ['wait', 'fair'],
        ['SLO', 'policy'],
      ],
    ),
    highlight: { active: ['cursor:field', 'remain:field', 'kv:field'], found: ['age:why', 'class:why'] },
    explanation: 'The data structure is a chunk ledger: next prompt token, remaining tokens, allocated KV blocks, queue age, service class, and SLO budget. Without it, chunking becomes guesswork.',
  };
}

function* chunkLedger() {
  yield {
    state: chunkGraph('A long prompt becomes a resumable chunk chain'),
    highlight: { active: ['req', 'cursor', 'c0', 'c1', 'c2', 'e-req-cursor', 'e-c0-c1', 'e-c1-c2'], compare: ['c3'], found: ['kv'] },
    explanation: 'Chunked prefill turns one long prompt operation into a resumable chain. The cursor says which token range is next, and each completed chunk appends KV state.',
  };

  yield {
    state: labelMatrix(
      'Chunk ledger',
      [
        { id: 'c0', label: 'c0' },
        { id: 'c1', label: 'c1' },
        { id: 'c2', label: 'c2' },
        { id: 'c3', label: 'c3' },
      ],
      [
        { id: 'range', label: 'range' },
        { id: 'state', label: 'state' },
        { id: 'kv', label: 'KV' },
      ],
      [
        ['0-2k', 'done', 'blk 0'],
        ['2-4k', 'done', 'blk 1'],
        ['4-6k', 'next', 'hold'],
        ['6-8k', 'wait', 'none'],
      ],
    ),
    highlight: { active: ['c0:state', 'c1:state', 'c2:state'], found: ['c0:kv', 'c1:kv'], compare: ['c3:kv'] },
    explanation: 'Each row is small but important: token range, state, and KV block ownership. If a request is cancelled, the scheduler can free exactly the chunks that exist.',
  };

  yield {
    state: chunkGraph('The first token waits for the final prompt chunk'),
    highlight: { active: ['c2', 'c3', 'kv', 'first', 'e-c2-kv', 'e-c3-kv', 'e-kv-first'], compare: ['c0', 'c1'] },
    explanation: 'Chunking improves interference, not causality. The model still needs the full prompt prefilled before the first generated token, unless a different algorithm changes the prompt semantics.',
    invariant: 'Chunked prefill protects other streams; it does not make one long prompt logically complete early.',
  };

  yield {
    state: labelMatrix(
      'Bad chunk choices',
      [
        { id: 'tiny', label: 'tiny' },
        { id: 'huge', label: 'huge' },
        { id: 'uneven', label: 'uneven' },
        { id: 'blind', label: 'blind' },
        { id: 'cancel', label: 'cancel' },
      ],
      [
        { id: 'risk', label: 'risk' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['overhead', 'raise'],
        ['ITL hit', 'lower'],
        ['bubbles', 'size by work'],
        ['p99 miss', 'trace'],
        ['leaks', 'GC'],
      ],
    ),
    highlight: { active: ['tiny:risk', 'huge:risk', 'uneven:risk'], found: ['blind:fix', 'cancel:fix'] },
    explanation: 'Too-small chunks create overhead. Too-large chunks stall decode. Uneven chunks create pipeline bubbles. A serious implementation tunes by measured work, not just token count.',
  };

  yield {
    state: labelMatrix(
      'Complete agent case',
      [
        { id: 'repo', label: 'repo' },
        { id: 'tools', label: 'tools' },
        { id: 'chat', label: 'chat' },
        { id: 'policy', label: 'policy' },
      ],
      [
        { id: 'shape', label: 'shape' },
        { id: 'move', label: 'move' },
      ],
      [
        ['ctx', 'chunk'],
        ['schema', 'prefix'],
        ['live', 'dec'],
        ['p99', 'cap'],
      ],
    ),
    highlight: { active: ['repo:move', 'chat:move', 'policy:move'], found: ['tools:move'] },
    explanation: 'A coding-agent request may carry a long repository prompt, stable tool schema, and live chat stream. The scheduler chunks the long context, reuses stable prefix KV when possible, and keeps decode-first policy for active users.',
  };
}

function* stallAudit() {
  yield {
    state: tradeoffPlot([
      { id: 'sweet', x: 2048, y: 75, label: 'sweet' },
      { id: 'stall', x: 8192, y: 28, label: 'stall' },
    ]),
    highlight: { active: ['itl', 'stall'], found: ['ttft', 'util', 'sweet'] },
    explanation: 'Chunk size is a tradeoff curve. Smaller chunks protect inter-token latency. Larger chunks improve prefill progress and utilization. The right value depends on workload, hardware, and SLO.',
  };

  yield {
    state: labelMatrix(
      'Tuning gates',
      [
        { id: 'itl', label: 'ITL' },
        { id: 'ttft', label: 'TTFT' },
        { id: 'util', label: 'util' },
        { id: 'kv', label: 'KV' },
        { id: 'age', label: 'age' },
        { id: 'p99', label: 'p99' },
      ],
      [
        { id: 'watch', label: 'watch' },
        { id: 'action', label: 'action' },
      ],
      [
        ['stream gap', 'lower chunk'],
        ['first token', 'raise chunk'],
        ['GPU idle', 'raise'],
        ['preempt', 'lower seqs'],
        ['starve', 'age boost'],
        ['tail miss', 'canary'],
      ],
    ),
    highlight: { active: ['itl:action', 'ttft:action', 'util:action'], found: ['age:action', 'p99:action'] },
    explanation: 'A chunk-size change should pass gates. Better TTFT is not a win if stream gaps fail. Better ITL is not a win if long prompts starve. The scheduler needs canary metrics by prompt length and service class.',
  };

  yield {
    state: schedulerGraph('Chunked prefill is local; disaggregation is remote'),
    highlight: { active: ['budget', 'chunker', 'batch', 'stream', 'e-budget-chunker', 'e-chunker-batch'], compare: ['kv'], found: ['decodeQ'] },
    explanation: 'Chunking is the local-server answer to prefill/decode interference. Full disaggregation moves phases across workers and then needs a KV Cache Transfer Fabric. Both protect decode latency, but with different complexity.',
  };

  yield {
    state: labelMatrix(
      'Choose the lever',
      [
        { id: 'small', label: 'small srv' },
        { id: 'long', label: 'long ctx' },
        { id: 'multi', label: 'multi rack' },
        { id: 'strict', label: 'strict ITL' },
      ],
      [
        { id: 'try', label: 'try' },
        { id: 'watch', label: 'watch' },
      ],
      [
        ['chunk', 'simple'],
        ['chunk+prefix', 'TTFT'],
        ['P/D split', 'KV xfer'],
        ['split', 'cost'],
      ],
    ),
    highlight: { active: ['small:try', 'long:try'], found: ['multi:try', 'strict:try'], compare: ['multi:watch'] },
    explanation: 'If one server can meet the SLO, chunking is simpler than remote P/D disaggregation. If strict latency, heterogeneous hardware, or huge load forces phase separation, the transfer fabric becomes worth the complexity.',
  };

  yield {
    state: tradeoffPlot([
      { id: 'ship', x: 2048, y: 75, label: 'ship' },
      { id: 'roll', x: 4096, y: 56, label: 'rollbk' },
    ]),
    highlight: { active: ['ship', 'itl', 'ttft', 'util'], removed: ['roll'] },
    explanation: 'A production rollout should pin a chunk-size hypothesis, watch ITL, TTFT, utilization, preemption, queue age, and p99, then roll back if any protected slice gets worse.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'token budget') yield* tokenBudget();
  else if (view === 'chunk ledger') yield* chunkLedger();
  else if (view === 'stall audit') yield* stallAudit();
  else throw new InputError('Pick a chunked-prefill view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the token-budget view as one scheduler iteration. Prefill means reading a prompt and writing KV cache for each prompt token; decode means producing the next generated token for an active stream. The active cells show which work claims the iteration budget first.',
        'Read the chunk ledger as the state that makes prefill resumable. A cursor records the next prompt token to process, and allocated KV blocks record the cache already written. The safe inference is that chunking protects other streams; it does not let a request generate before its full prompt has been processed.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'LLM serving has two different kinds of work. Prefill is large and compute dense because the model reads the whole prompt. Decode is small but latency sensitive because users notice pauses between streamed tokens. A scheduler must serve both without letting one long prompt freeze everyone else.',
        'Chunked prefill exists because long prompts are normal in coding agents, retrieval systems, and enterprise assistants. A request may include tool schemas, repository summaries, retrieved files, and conversation history. If the server treats a 32k-token prompt as one indivisible job, active streams wait behind it.',
        {type:'callout', text:'Chunked prefill turns long prompt work into resumable budgeted slices so decode latency stays protected without starving new requests.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious scheduler runs each phase to completion. It takes a prompt, prefills all tokens, then moves to the next request. That works in an empty benchmark because the GPU stays busy and no competing stream is waiting.',
        'The opposite obvious scheduler always prioritizes decode. That protects streams already generating, but new long prompts can starve. Time to first token, the delay before a new request emits its first output token, becomes unbounded under heavy decode load.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is head-of-line blocking. One 64k-token prefill can occupy an iteration while dozens of streams need one decode step each. The GPU may report high utilization while users see visible gaps in streamed output.',
        'There is also a fairness wall. If decode always wins, long prompts never reach the point where they can decode. A serving system must protect inter-token latency for active streams and time to first token for waiting prompts.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to turn long prefill into resumable chunks under a per-iteration token budget. A setting such as max_num_batched_tokens is an accounting boundary, not just a capacity knob. Decode claims part of the budget first, and prefill receives only the remaining safe slice.',
        'The invariant is exact prompt order and exact KV ownership. The scheduler may split a prompt into chunks, but chunk 3 must attend to cache from chunks 1 and 2 and then write the next cache range. If the cursor, cache blocks, or cancellation state are wrong, the generated output is no longer conditioned on the intended prompt.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Each iteration starts by listing decode-ready requests. Every active stream needs one next-token step, so the scheduler accounts for those tokens first. It then computes the remaining token budget and admits prefill chunks that fit memory and policy constraints.',
        'The chunk ledger stores request id, prompt cursor, remaining tokens, allocated KV blocks, queue age, service class, cancellation state, and deadline. After a chunk runs, the cursor advances and the KV blocks become owned by that request. When the cursor reaches the end of the prompt, the request becomes decode-ready.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Chunking works because transformer prefill over a prefix can be resumed when causal order and KV cache state are preserved. Earlier prompt tokens have already produced keys and values. The next chunk can attend to that cache and write more cache for later tokens and decode.',
        'The correctness argument is ordered cache construction. The scheduler is free to interleave other requests between chunks, but it is not free to skip a token, reuse another request\'s cache, or generate early. Exact cursor advancement and ownership of KV blocks preserve the same prompt state as one large prefill.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Chunk size controls the tradeoff. Tiny chunks protect decode but add scheduler overhead, more kernel launches, and lower prefill density. Huge chunks improve prefill throughput but recreate decode stalls. If a server has a 4096-token iteration budget and 96 decode streams need one token each, only 4000 tokens remain for prefill in that iteration.',
        'The cost moves into policy. The scheduler must track memory pressure, queue age, service class, cancellation, prefix reuse, and p99 latency by prompt length. Doubling prompt length roughly doubles total prefill work, but chunking spreads that work across more iterations instead of one blocking wall.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Chunked prefill wins on mixed workloads where short chats, long prompts, and active streams share one replica. It is especially useful before a team adopts full prefill-decode disaggregation, where separate workers handle the two phases. One worker can keep scheduling local while avoiding the worst long-prompt stalls.',
        'It also fits agentic requests. A coding assistant may send a stable tool schema, retrieved files, and live conversation state. Prefix caching can reuse stable cache, while chunked prefill schedules the remaining prompt so active decode streams stay present in mixed batches.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when tuning follows one metric. Larger chunks can lower time to first token for long prompts while damaging inter-token latency for active streams. Smaller chunks can smooth streaming while letting long prompts age in the queue. The right setting is visible only by prompt-length slice and service class.',
        'It also fails when teams confuse local chunking with remote prefill-decode disaggregation. Chunking schedules phases on the same worker. Disaggregation moves phases across workers and then needs a KV-cache transfer fabric, backpressure, and failure handling for remote state movement.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose one iteration has a 4096-token budget. There are 120 active decode streams, so decode consumes 120 token slots. A new request has a 12,000-token prompt. The scheduler can admit a 3976-token prefill chunk, leaving the request cursor at token 3976 after the iteration.',
        'On the next two iterations, if decode again consumes about 120 slots, two more chunks advance the cursor to 7952 and 11,928. A final 72-token chunk completes the prompt and the request becomes decode-ready. Active streams were delayed by bounded chunks instead of waiting behind one 12,000-token prefill.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary references include vLLM optimization and chunked-prefill documentation at https://docs.vllm.ai/en/stable/configuration/optimization/, Sarathi-Serve at https://arxiv.org/abs/2403.02310, Orca iteration-level scheduling at https://www.usenix.org/conference/osdi22/presentation/yu, TensorRT-LLM at https://nvidia.github.io/TensorRT-LLM/, and the Triton TensorRT-LLM backend documentation. Read them for the scheduler contract between token budgets, KV cache, and streaming latency.',
        'Study continuous batching, length-aware batching, transformer inference rooflines, PagedAttention, prefix caching, prefill-decode disaggregation, KV-cache transfer, SLO-aware routing, admission-control goodput, backpressure, tail latency, and LLM inference cost models next. The common thread is that serving quality is controlled by queues, memory, and latency budgets rather than by model weights alone.',
      ],
    },
  ],
};