// Tiered KV-cache offload: keep scarce GPU HBM for active decode while using
// CPU, SSD, and remote stores to preserve reusable prompt state.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'kv-cache-tiered-offload-store-case-study',
  title: 'KV Cache Tiered Offload Store',
  category: 'Systems',
  summary: 'A multi-tier KV-cache case study: GPU HBM, pinned CPU memory, SSD or remote stores, async puts, blocking gets, promotion, eviction, and cache-aware routing.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['tier ladder', 'promote path', 'eviction audit'], defaultValue: 'tier ladder' },
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

function tierGraph(title) {
  return graphState({
    nodes: [
      { id: 'req', label: 'req', x: 0.7, y: 3.5, note: 'prompt' },
      { id: 'hash', label: 'hash', x: 2.0, y: 3.5, note: 'blocks' },
      { id: 'gpu', label: 'HBM', x: 3.6, y: 1.4, note: 'hot' },
      { id: 'cpu', label: 'CPU', x: 3.6, y: 3.5, note: 'pinned' },
      { id: 'ssd', label: 'SSD', x: 3.6, y: 5.6, note: 'files' },
      { id: 'remote', label: 'remote', x: 5.6, y: 5.6, note: 'pool' },
      { id: 'prefill', label: 'pre', x: 5.6, y: 3.5, note: 'miss' },
      { id: 'decode', label: 'dec', x: 7.6, y: 2.0, note: 'needs KV' },
      { id: 'route', label: 'route', x: 8.8, y: 4.8, note: 'hit' },
    ],
    edges: [
      { id: 'e-req-hash', from: 'req', to: 'hash', weight: '' },
      { id: 'e-hash-gpu', from: 'hash', to: 'gpu', weight: 'hit' },
      { id: 'e-hash-cpu', from: 'hash', to: 'cpu', weight: 'hit' },
      { id: 'e-hash-ssd', from: 'hash', to: 'ssd', weight: 'hit' },
      { id: 'e-ssd-remote', from: 'ssd', to: 'remote', weight: '' },
      { id: 'e-cpu-gpu', from: 'cpu', to: 'gpu', weight: 'DMA' },
      { id: 'e-ssd-cpu', from: 'ssd', to: 'cpu', weight: 'stage' },
      { id: 'e-remote-cpu', from: 'remote', to: 'cpu', weight: 'fetch' },
      { id: 'e-gpu-decode', from: 'gpu', to: 'decode', weight: 'use' },
      { id: 'e-hash-prefill', from: 'hash', to: 'prefill', weight: 'miss' },
      { id: 'e-prefill-gpu', from: 'prefill', to: 'gpu', weight: 'KV' },
      { id: 'e-decode-route', from: 'decode', to: 'route', weight: 'stats' },
    ],
  }, { title });
}

function promoteGraph(title) {
  return graphState({
    nodes: [
      { id: 'lookup', label: 'lookup', x: 0.7, y: 3.5, note: 'key' },
      { id: 'disk', label: 'disk', x: 2.1, y: 5.2, note: 'chunk' },
      { id: 'cpu', label: 'CPU', x: 3.8, y: 5.2, note: 'stage' },
      { id: 'gpu', label: 'HBM', x: 5.5, y: 3.5, note: 'local' },
      { id: 'attn', label: 'attn', x: 7.1, y: 2.1, note: 'reads' },
      { id: 'decode', label: 'dec', x: 8.7, y: 3.5, note: 'token' },
      { id: 'async', label: 'put', x: 3.8, y: 1.8, note: 'async' },
      { id: 'evict', label: 'evict', x: 5.5, y: 5.7, note: 'LRU' },
    ],
    edges: [
      { id: 'e-lookup-disk', from: 'lookup', to: 'disk', weight: 'get' },
      { id: 'e-disk-cpu', from: 'disk', to: 'cpu', weight: 'load' },
      { id: 'e-cpu-gpu', from: 'cpu', to: 'gpu', weight: 'DMA' },
      { id: 'e-gpu-attn', from: 'gpu', to: 'attn', weight: 'KV' },
      { id: 'e-attn-decode', from: 'attn', to: 'decode', weight: '' },
      { id: 'e-gpu-async', from: 'gpu', to: 'async', weight: 'save' },
      { id: 'e-async-disk', from: 'async', to: 'disk', weight: '' },
      { id: 'e-gpu-evict', from: 'gpu', to: 'evict', weight: '' },
      { id: 'e-evict-cpu', from: 'evict', to: 'cpu', weight: 'spill' },
    ],
  }, { title });
}

function hitPlot(markers = []) {
  return plotState({
    axes: { x: { label: 'hit rate %', min: 0, max: 100 }, y: { label: 'TTFT ms', min: 0, max: 1400 } },
    series: [
      { id: 'recompute', label: 'recompute', points: [{ x: 0, y: 1200 }, { x: 25, y: 930 }, { x: 50, y: 660 }, { x: 75, y: 390 }, { x: 95, y: 170 }] },
      { id: 'cpu', label: 'CPU hit', points: [{ x: 0, y: 1200 }, { x: 25, y: 820 }, { x: 50, y: 480 }, { x: 75, y: 250 }, { x: 95, y: 120 }] },
      { id: 'disk', label: 'disk hit', points: [{ x: 0, y: 1200 }, { x: 25, y: 980 }, { x: 50, y: 720 }, { x: 75, y: 430 }, { x: 95, y: 260 }] },
    ],
    markers,
  });
}

function* tierLadder() {
  yield {
    state: tierGraph('Tiered KV offload extends the prefix cache'),
    highlight: { active: ['req', 'hash', 'gpu', 'cpu', 'ssd', 'remote', 'e-req-hash'], found: ['decode'] },
    explanation: 'A tiered KV store treats computed prompt state as reusable cache blocks. The lookup starts with a block key, checks GPU HBM first, then CPU, then disk or a remote pool before deciding to recompute prefill.',
  };

  yield {
    state: labelMatrix(
      'Tier contract',
      [
        { id: 'hbm', label: 'HBM' },
        { id: 'cpu', label: 'CPU' },
        { id: 'ssd', label: 'SSD' },
        { id: 'remote', label: 'remote' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['active', 'scarce'],
        ['stage', 'PCIe'],
        ['persist', 'tail'],
        ['share', 'net'],
      ],
    ),
    highlight: { active: ['hbm:role', 'cpu:role'], found: ['ssd:role', 'remote:role'], compare: ['ssd:risk', 'remote:risk'] },
    explanation: 'Only the hot tier should feed active attention. CPU is the staging tier for GPU transfers. SSD and remote tiers buy capacity and reuse, but they add tail latency and consistency questions.',
    invariant: 'Offload is useful only when loading KV is cheaper than recomputing prefill.',
  };

  yield {
    state: tierGraph('Secondary tiers promote through CPU'),
    highlight: { active: ['ssd', 'remote', 'cpu', 'gpu', 'e-ssd-cpu', 'e-remote-cpu', 'e-cpu-gpu'], compare: ['decode'] },
    explanation: 'The common connector shape is a ladder. GPU cannot directly consume every secondary tier. Storage and remote hits are staged through pinned CPU memory, then copied into GPU blocks before decode can use them.',
  };

  yield {
    state: labelMatrix(
      'Cache key ingredients',
      [
        { id: 'tokens', label: 'tokens' },
        { id: 'model', label: 'model' },
        { id: 'adapter', label: 'adapter' },
        { id: 'pos', label: 'pos' },
        { id: 'dtype', label: 'dtype' },
      ],
      [
        { id: 'field', label: 'field' },
        { id: 'miss', label: 'miss if' },
      ],
      [
        ['hash', 'text edit'],
        ['id', 'new base'],
        ['LoRA', 'swap'],
        ['RoPE', 'shift'],
        ['fp8/int4', 'format'],
      ],
    ),
    highlight: { active: ['tokens:field', 'model:field', 'adapter:field'], found: ['pos:miss', 'dtype:miss'] },
    explanation: 'A KV hit is exact, not semantic. Token prefix, model, adapter, position scheme, and cache format must match. Otherwise the offload store returns state for the wrong computation.',
  };

  yield {
    state: tierGraph('A miss falls back to prefill and async put'),
    highlight: { active: ['hash', 'prefill', 'gpu', 'e-hash-prefill', 'e-prefill-gpu'], found: ['cpu', 'ssd'] },
    explanation: 'On a miss, the server recomputes prefill and can asynchronously write completed blocks down the tier ladder. That creates future hits without blocking the current decode path.',
  };
}

function* promotePath() {
  yield {
    state: promoteGraph('Blocking get promotes a cold hit'),
    highlight: { active: ['lookup', 'disk', 'cpu', 'gpu', 'e-lookup-disk', 'e-disk-cpu', 'e-cpu-gpu'], found: ['attn', 'decode'] },
    explanation: 'A disk or remote hit is usually a blocking get from the request point of view. The block must be staged, copied to GPU memory, and registered in the local block table before attention reads it.',
  };

  yield {
    state: promoteGraph('Async put avoids slowing the hot path'),
    highlight: { active: ['gpu', 'async', 'disk', 'e-gpu-async', 'e-async-disk'], compare: ['decode'], found: ['evict'] },
    explanation: 'Stores can often be asynchronous. When a prompt finishes prefill, the connector can copy completed blocks to lower tiers in the background while the model continues serving.',
  };

  yield {
    state: labelMatrix(
      'Put/get semantics',
      [
        { id: 'put', label: 'put' },
        { id: 'get', label: 'get' },
        { id: 'prefetch', label: 'prefetch' },
        { id: 'drop', label: 'drop' },
      ],
      [
        { id: 'mode', label: 'mode' },
        { id: 'danger', label: 'danger' },
      ],
      [
        ['async', 'lost save'],
        ['block', 'TTFT hit'],
        ['early', 'waste IO'],
        ['LRU', 'bad miss'],
      ],
    ),
    highlight: { active: ['put:mode', 'get:mode', 'prefetch:mode'], compare: ['get:danger'], found: ['drop:danger'] },
    explanation: 'Writes should not slow active inference, but reads gate correctness. Prefetch can hide disk latency, and eviction policy decides whether the next turn gets a hit or a recompute bill.',
  };

  yield {
    state: hitPlot([
      { id: 'agent', x: 92, y: 130, label: 'agent' },
      { id: 'cold', x: 5, y: 1150, label: 'cold' },
    ]),
    highlight: { active: ['cpu', 'disk', 'agent'], compare: ['recompute', 'cold'] },
    explanation: 'The economics depend on hit rate. Agentic workloads with repeated prefixes can benefit sharply. Random one-off prompts mostly pay connector overhead and storage cost.',
  };

  yield {
    state: labelMatrix(
      'Agentic trace route',
      [
        { id: 'sys', label: 'sys' },
        { id: 'tools', label: 'tools' },
        { id: 'repo', label: 'repo' },
        { id: 'turn', label: 'turn' },
      ],
      [
        { id: 'hit', label: 'hit' },
        { id: 'route', label: 'route' },
      ],
      [
        ['yes', 'load KV'],
        ['yes', 'sticky'],
        ['maybe', 'prefetch'],
        ['new', 'prefill'],
      ],
    ),
    highlight: { active: ['sys:hit', 'tools:hit', 'sys:route'], found: ['repo:route'], compare: ['turn:route'] },
    explanation: 'An agent loop has stable system and tool prefixes, semi-stable repository context, and new user/tool outputs. A cache-aware router should steer turns toward the node or store with the best reusable prefix.',
  };
}

function* evictionAudit() {
  yield {
    state: labelMatrix(
      'Eviction ledger',
      [
        { id: 'hot', label: 'hot' },
        { id: 'warm', label: 'warm' },
        { id: 'cold', label: 'cold' },
        { id: 'bad', label: 'bad' },
      ],
      [
        { id: 'signal', label: 'signal' },
        { id: 'choice', label: 'choice' },
      ],
      [
        ['live dec', 'keep HBM'],
        ['next turn', 'CPU'],
        ['rare', 'SSD'],
        ['stale', 'drop'],
      ],
    ),
    highlight: { active: ['hot:choice', 'warm:choice'], found: ['cold:choice'], removed: ['bad:choice'] },
    explanation: 'A good eviction policy is not just LRU. It separates live decode state, likely next-turn prefixes, rare-but-expensive state, and invalid state that must be dropped.',
  };

  yield {
    state: promoteGraph('Eviction spills before HBM pressure becomes OOM'),
    highlight: { active: ['gpu', 'evict', 'cpu', 'disk', 'e-gpu-evict', 'e-evict-cpu'], found: ['lookup'] },
    explanation: 'The offload store should spill completed or inactive blocks before the GPU allocator hits an OOM path. That makes capacity policy visible instead of reactive.',
  };

  yield {
    state: labelMatrix(
      'Failure modes',
      [
        { id: 'stale', label: 'stale' },
        { id: 'slow', label: 'slow' },
        { id: 'frag', label: 'frag' },
        { id: 'storm', label: 'storm' },
        { id: 'leak', label: 'leak' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'guard', label: 'guard' },
      ],
      [
        ['wrong KV', 'key ver'],
        ['TTFT p99', 'SLO gate'],
        ['no blocks', 'compact'],
        ['many gets', 'rate cap'],
        ['full tier', 'quota'],
      ],
    ),
    highlight: { active: ['stale:guard', 'slow:guard', 'storm:guard'], compare: ['frag:symptom'], found: ['leak:guard'] },
    explanation: 'Tiering introduces storage-system failures: stale keys, slow gets, block fragmentation, thundering herds after a popular prefix, and leaked capacity after aborted requests.',
  };

  yield {
    state: hitPlot([
      { id: 'keep', x: 80, y: 250, label: 'keep' },
      { id: 'drop', x: 20, y: 980, label: 'drop' },
    ]),
    highlight: { active: ['keep', 'cpu', 'disk'], removed: ['drop'], compare: ['recompute'] },
    explanation: 'Eviction is a product decision. Keeping the right prefixes can reduce TTFT and recompute cost. Keeping the wrong prefixes burns CPU, disk, and network capacity without user-visible benefit.',
  };

  yield {
    state: labelMatrix(
      'Ship checklist',
      [
        { id: 'hit', label: 'hit' },
        { id: 'ttft', label: 'TTFT' },
        { id: 'bytes', label: 'bytes' },
        { id: 'fresh', label: 'fresh' },
        { id: 'cost', label: 'cost' },
      ],
      [
        { id: 'metric', label: 'metric' },
        { id: 'gate', label: 'gate' },
      ],
      [
        ['prefix', 'route'],
        ['by tier', 'SLO'],
        ['IO GB', 'cap'],
        ['version', 'deny'],
        ['$/task', 'ship'],
      ],
    ),
    highlight: { active: ['hit:metric', 'ttft:metric', 'cost:metric'], found: ['fresh:gate'], compare: ['bytes:gate'] },
    explanation: 'Before shipping tiered KV offload, require hit-rate slices, tier-specific TTFT, bytes moved, freshness checks, and cost per accepted task. Otherwise the cache can look busy while making the product worse.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'tier ladder') yield* tierLadder();
  else if (view === 'promote path') yield* promotePath();
  else if (view === 'eviction audit') yield* evictionAudit();
  else throw new InputError('Pick a tiered KV offload view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The tier-ladder view shows the full lookup path from a hashed prefix key through four storage tiers: GPU HBM, pinned CPU memory, local SSD, and a remote cache pool. Active (highlighted) nodes are the ones participating in the current lookup. The "dec" node at the end represents active decode, which can only consume KV blocks that have been promoted into HBM.',
        'The promote-path view isolates the two asymmetric data flows. A blocking get loads a cold block upward through staging tiers into HBM before decode can proceed. An async put copies completed blocks downward for future reuse without stalling the current request. The eviction audit view shows the policy layer: which blocks earn scarce HBM, which spill to cheaper tiers, and which get dropped.',
        {type: 'callout', text: 'A tiered KV cache works only when exact block identity and promotion cost decide whether to reuse state, spill it, or recompute it.'},
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/0/0c/ComputerMemoryHierarchy.svg', alt: 'Diagram of a computer memory hierarchy from CPU registers and caches down to disk storage.', caption: 'Computer memory hierarchy diagram by Danlash, vectorized by Fred the Oyster, Wikimedia Commons, public domain.'},
        {
          type: 'note',
          text: 'Inference rule for the animation: if a block key matches on all fields (token prefix, model id, adapter, position scheme, dtype, block size) and the block is resident in HBM, attention can read it directly. If the key matches but the block is in a lower tier, promotion must complete before decode uses it. If no key matches, prefill recomputes the block from scratch.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Transformer inference keeps a key-value cache for every token in the context. That cache is what lets decode attend to earlier tokens without rerunning all previous layers. It is also enormous. A single Llama-70B request with a 4,096-token context at FP16 needs roughly 5 GB of KV state across 80 layers, 64 heads, and 128-dimensional head vectors. Long prompts, long conversations, tool traces, and concurrent users can fill GPU HBM before arithmetic becomes the bottleneck.',
        {
          type: 'table',
          headers: ['Model', 'Context length', 'KV bytes per request (FP16)', 'Requests to fill 80 GB HBM'],
          rows: [
            ['Llama-7B', '4,096', '~500 MB', '~160'],
            ['Llama-70B', '4,096', '~5 GB', '~16'],
            ['Llama-70B', '32,768', '~40 GB', '~2'],
            ['Mixtral 8x22B', '65,536', '~54 GB', '~1.5'],
          ],
        },
        'Agentic workloads make the reuse opportunity visible. The system prompt, tool definitions, repository context, policy text, and previous trace prefixes repeat across turns. Recomputing that prefix each time wastes prefill FLOPs and inflates time to first token (TTFT). But keeping every possible prefix in GPU memory is impossible because active decode needs that same HBM.',
        'A tiered KV-cache offload store treats computed prompt state as a cacheable artifact with a memory hierarchy. Hot blocks stay in GPU HBM. Warm blocks sit in pinned CPU memory. Cold blocks spill to SSD or a remote pool. The goal is not to make slow memory behave like HBM. The goal is to reload reusable state when loading is cheaper than recomputing prefill.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first thing every serving team tries is a single-tier prefix cache: keep computed KV blocks in GPU HBM, keyed by token prefix hash. If a new request shares a prefix with an existing block, skip prefill for that prefix and decode from the cached state. This is what vLLM calls "automatic prefix caching" and what SGLang calls "RadixAttention."',
        'Single-tier prefix caching works well when traffic is bursty and prefixes cluster. A chatbot with a shared system prompt hits the same prefix hundreds of times per minute. The cache pays for itself immediately.',
        {
          type: 'quote',
          attribution: 'vLLM documentation on prefix caching',
          text: 'Automatic prefix caching caches the KV cache of existing queries, so a new query can directly reuse the KV cache if it shares the same prefix with one of the existing queries, allowing the new query to skip the computation of the shared part.',
        },
        'The approach stops working when the working set exceeds GPU memory. An 80 GB H100 serving Llama-70B may have 30-40 GB free after model weights. That holds KV state for roughly 6-8 long-context requests. Once the cache fills, new requests evict old prefixes. If traffic is diverse -- many distinct system prompts, different tool sets, varied document contexts -- the cache churns and hit rates drop below 10%. The reuse opportunity is real, but the hot tier cannot hold it.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is the gap between cache capacity and reusable working set. A production serving cluster may handle hundreds of distinct prefix families: different customers, different system prompts, different LoRA adapters, different document contexts. The total reusable KV state can be hundreds of gigabytes per GPU, but HBM holds tens.',
        {
          type: 'table',
          headers: ['Problem', 'What breaks', 'Visible symptom'],
          rows: [
            ['HBM-only cache with diverse prefixes', 'Eviction rate exceeds reuse rate', 'Hit rate below 10%, no TTFT improvement'],
            ['Offload everything to CPU/SSD', 'Promotion latency exceeds prefill latency', 'TTFT increases despite high hit rate'],
            ['No eviction policy beyond LRU', 'One-off long prompts evict shared system prompts', 'Frequent users get slower, not faster'],
            ['Cache without versioning', 'Model update serves stale KV', 'Silent quality degradation, wrong outputs'],
          ],
        },
        'Dumping everything to slower tiers is the second trap. CPU memory has 10-50x the bandwidth of SSD and 100-1000x that of network storage. An NVMe SSD reads at 7 GB/s; promoting a 5 GB KV block takes 700 ms. Recomputing that same block on an H100 via prefill at 10,000 tokens/second may take only 400 ms. The cache "hit" is slower than the "miss."',
        'The real wall is selective placement. A tiered store must know which blocks are safe to reuse, which are likely to be reused, which loads are worth delaying a request for, and when recompute is actually cheaper than promotion. Without that discipline, offload becomes a larger trash can for state the product should have dropped.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The central invariant is exact computational equivalence: a loaded KV block must produce the same state the model would have computed by prefilling the same tokens under the same model contract. Placement can change. Semantics cannot.',
        {
          type: 'note',
          text: 'This is stricter than ordinary application caching. A stale HTML fragment shows old text. A stale KV block silently changes every downstream attention score, corrupting the model output in ways that are difficult to detect or debug.',
        },
        'The cache key is not just text. It must encode token ids, model checkpoint hash, tokenizer version, LoRA adapter identity, positional encoding scheme (ALiBi vs RoPE vs absolute), attention layout (MHA vs GQA vs MQA), dtype or quantization format, block size, and any tenant or safety boundary. Two prompts that look identical to a human are a miss if the tokenizer version changed or the adapter was swapped.',
        {
          type: 'code',
          language: 'python',
          body: [
            '# Cache key composition for a KV block',
            'def block_key(tokens, config):',
            '    return hash_combine(',
            '        hash_tokens(tokens),       # prefix token ids',
            '        config.model_id,            # checkpoint hash',
            '        config.tokenizer_version,   # tokenizer identity',
            '        config.adapter_id,          # LoRA / adapter',
            '        config.pos_encoding,        # RoPE, ALiBi, etc.',
            '        config.attn_layout,         # MHA, GQA, MQA',
            '        config.kv_dtype,            # fp16, fp8, int4',
            '        config.block_size,          # tokens per block',
            '        config.tenant_scope,        # isolation boundary',
            '    )',
          ].join('\n'),
          text: [
            '# Cache key composition for a KV block',
            'def block_key(tokens, config):',
            '    return hash_combine(',
            '        hash_tokens(tokens),       # prefix token ids',
            '        config.model_id,            # checkpoint hash',
            '        config.tokenizer_version,   # tokenizer identity',
            '        config.adapter_id,          # LoRA / adapter',
            '        config.pos_encoding,        # RoPE, ALiBi, etc.',
            '        config.attn_layout,         # MHA, GQA, MQA',
            '        config.kv_dtype,            # fp16, fp8, int4',
            '        config.block_size,          # tokens per block',
            '        config.tenant_scope,        # isolation boundary',
            '    )',
          ].join('\n'),
        },
        'The second insight is that promotion cost, not just hit/miss, determines whether offload helps. A cache hit from SSD is only useful if the time to load, stage through CPU, and copy into GPU is less than the time to recompute via prefill. This inequality depends on block size, tier bandwidth, GPU prefill throughput, and current system load. The store must evaluate it per lookup, not once at configuration time.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A request arrives as a token sequence. The runtime splits it into fixed-size blocks (typically 16 or 32 tokens) and hashes each block into a prefix key. The lookup walks the tiers in order.',
        {
          type: 'diagram',
          alt: 'KV block lookup through four storage tiers',
          label: 'Tier lookup waterfall',
          body: [
            'Request tokens: [sys_prompt | tool_defs | user_query | new_turn]',
            '                     |            |           |           |',
            '                     v            v           v           v',
            '              block_key_0   block_key_1  block_key_2  block_key_3',
            '                     |            |           |           |',
            '                     v            v           v           v',
            '              +------+------+-----+-----+-----+-----+----+------+',
            '              | GPU HBM     | CPU pinned | Local SSD | Remote   |',
            '              | (< 1 us)    | (10-50 us) | (0.1-1 ms)| (1-10ms) |',
            '              +------+------+-----+-----+-----+-----+----+------+',
            '              | block_key_0 |            |           |          |',
            '              | HIT         |            |           |          |',
            '              +------+------+-----+-----+-----+-----+----+------+',
            '              |             | block_key_1|           |          |',
            '              |             | HIT->stage |           |          |',
            '              +------+------+-----+-----+-----+-----+----+------+',
            '              |             |            |           | (miss)   |',
            '              |             |            |           | PREFILL  |',
            '              +------+------+-----+-----+-----+-----+----+------+',
          ].join('\n'),
          text: [
            'Request tokens: [sys_prompt | tool_defs | user_query | new_turn]',
            '                     |            |           |           |',
            '                     v            v           v           v',
            '              block_key_0   block_key_1  block_key_2  block_key_3',
            '                     |            |           |           |',
            '                     v            v           v           v',
            '              +------+------+-----+-----+-----+-----+----+------+',
            '              | GPU HBM     | CPU pinned | Local SSD | Remote   |',
            '              | (< 1 us)    | (10-50 us) | (0.1-1 ms)| (1-10ms) |',
            '              +------+------+-----+-----+-----+-----+----+------+',
            '              | block_key_0 |            |           |          |',
            '              | HIT         |            |           |          |',
            '              +------+------+-----+-----+-----+-----+----+------+',
            '              |             | block_key_1|           |          |',
            '              |             | HIT->stage |           |          |',
            '              +------+------+-----+-----+-----+-----+----+------+',
            '              |             |            |           | (miss)   |',
            '              |             |            |           | PREFILL  |',
            '              +------+------+-----+-----+-----+-----+----+------+',
          ].join('\n'),
        },
        'A GPU hit is immediate: the block table already maps the key to resident HBM pages. A CPU hit requires DMA transfer through PCIe (roughly 25 GB/s on Gen5, so a 500 MB block takes ~20 ms). An SSD hit adds a read from NVMe into CPU memory before the GPU copy. A remote hit adds a network fetch before the SSD/CPU staging.',
        'On a complete miss, the server runs normal prefill. After prefill finishes each block, the runtime can asynchronously put completed blocks into lower tiers for future requests. This asymmetry is fundamental: reads usually block (decode needs the KV now) while writes usually run in the background (the current request already has its state).',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness rests on two properties: key exactness and promotion equivalence.',
        'Key exactness means the hash function includes every parameter that affects the numerical value of the KV tensors. If any field differs -- different adapter, different quantization, different RoPE base frequency -- the lookup returns a miss rather than silently serving wrong state. False misses waste compute. False hits corrupt inference. The system must always err toward misses.',
        'Promotion equivalence means that a block loaded from any tier and placed into HBM produces the same attention output as a block that was computed in-place via prefill. This holds as long as the block was written correctly, the dtype round-trip is lossless (or the quantization scheme is part of the key), and no bits were corrupted in transit. Checksums on stored blocks and verification after GPU copy close this gap.',
        {
          type: 'quote',
          attribution: 'LMCache design principle',
          text: 'The KV cache is a deterministic function of the input tokens and the model parameters. Any system that stores and retrieves this cache must guarantee that the retrieved tensors are bitwise identical to what the model would have produced.',
        },
        'The promotion-cost inequality is the economic correctness condition. Let T_prefill be the time to recompute a block via prefill, and T_promote(tier) be the time to load from that tier. Offload helps only when T_promote(tier) < T_prefill for the blocks being served. When traffic changes and this inequality flips, the system should fall back to recompute gracefully, not block on a slow tier.',
      ],
    },
    {
      heading: 'Tier roles',
      paragraphs: [
        {
          type: 'table',
          headers: ['Tier', 'Capacity', 'Bandwidth', 'Latency', 'Role', 'Risk'],
          rows: [
            ['GPU HBM', '40-80 GB', '2-3.4 TB/s', '< 1 us', 'Active decode + hot prefixes', 'Scarce, OOM under pressure'],
            ['CPU pinned', '256-2048 GB', '100-200 GB/s (local)', '10-50 us', 'Staging for GPU promotion', 'Competes with host processes'],
            ['NVMe SSD', '1-30 TB', '5-14 GB/s', '0.1-1 ms', 'Persistent reusable blocks', 'Tail latency, wear, queue depth'],
            ['Remote pool', '100+ TB', '10-100 Gbps network', '1-10 ms', 'Cross-node sharing, cold archive', 'Network congestion, consistency'],
          ],
        },
        'GPU HBM feeds active attention. It has the bandwidth attention needs (2-3 TB/s on H100) but is scarce and expensive. Treating HBM as an archival cache causes OOM errors and poor batching. Only live decode state and the hottest reusable prefixes belong here.',
        'Pinned CPU memory is the staging layer. On an 8-GPU server with 2 TB of host RAM, 500 GB can be reserved for KV staging -- 10x the HBM budget. CPU-to-GPU DMA over PCIe Gen5 achieves ~25 GB/s per direction. A 500 MB block promotes in ~20 ms, fast enough to beat prefill for long prompts.',
        'SSD and remote tiers are capacity tiers. They store blocks that may be needed again -- agent sessions that pause and return, large document contexts, popular system prompts evicted from faster tiers. They also introduce filesystem behavior, queue depth contention, network congestion, serialization cost, and cleanup problems. A block loaded from these tiers must be cheaper than recompute, or the system is burning IO for nothing.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The core cost tradeoff is prefill FLOPs saved versus promotion bandwidth consumed. For a Llama-70B block of 32 tokens at FP16:',
        {
          type: 'table',
          headers: ['Operation', 'Resource', 'Time (H100)', 'Scales with'],
          rows: [
            ['Prefill 32 tokens', '~0.14 TFLOPs', '~0.4 ms', 'Model params x tokens'],
            ['GPU HBM read', '40 KB block table lookup', '< 0.01 ms', 'Constant'],
            ['CPU -> GPU DMA', '~10 MB over PCIe Gen5', '~0.4 ms', 'Block size x layers x heads'],
            ['SSD -> CPU read', '~10 MB over NVMe', '~1.5 ms', 'Block size + queue depth'],
            ['Remote -> CPU fetch', '~10 MB over 100 Gbps', '~3 ms', 'Block size + network RTT'],
          ],
        },
        'For short prefixes (< 256 tokens), prefill on an H100 is often faster than promotion from any tier below HBM. Offload earns its keep on long prefixes: a 4,096-token system prompt takes ~50 ms to prefill but only ~8 ms to promote from CPU staging. The crossover point depends on model size, GPU speed, and tier bandwidth.',
        'Metadata cost is constant per lookup: one hash, one index probe per tier. Storage cost grows linearly with the number of cached blocks times block size. The practical bound is not algorithmic but economic: how much CPU memory, SSD capacity, and network bandwidth the operator is willing to dedicate to KV storage versus other uses.',
        'Doubling the number of cached prefix families doubles storage but does not change lookup or promotion time per block. Doubling block size doubles promotion time and storage per block. The design knob is block granularity: smaller blocks give finer reuse but more metadata overhead; larger blocks reduce metadata but waste storage when only part of a prefix matches.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'An agent session sends five turns to a Llama-70B server. The system prompt is 2,048 tokens. Tool definitions add 512 tokens. Each user turn adds 200-400 new tokens. Block size is 32 tokens. HBM can hold 200 blocks of KV cache. CPU staging holds 2,000 blocks. SSD is available but slow.',
        {
          type: 'code',
          language: 'text',
          body: [
            'Turn 1: [sys_2048 + tools_512 + user_256] = 2,816 tokens = 88 blocks',
            '  Lookup: all miss (cold start)',
            '  Action: prefill all 88 blocks, async put blocks 0-87 to CPU staging',
            '  HBM: blocks 0-87 (88 used / 200 capacity)',
            '  CPU: blocks 0-87 (88 used / 2000 capacity)',
            '',
            'Turn 2: [sys_2048 + tools_512 + user_384] = 2,944 tokens = 92 blocks',
            '  Lookup: blocks 0-79 (sys+tools) HIT in HBM, blocks 80-91 MISS',
            '  Action: skip prefill for 80 blocks, prefill 12 new blocks',
            '  Saved: 80 blocks x 32 tokens x 0.4 ms = ~12.8 ms TTFT reduction',
            '  HBM: blocks 0-91 (92 used / 200 capacity)',
            '',
            'Turn 3: [sys_2048 + tools_512 + user_320] = 2,880 tokens = 90 blocks',
            '  Lookup: blocks 0-79 HIT in HBM (from turn 2 eviction, some in CPU)',
            '  Suppose HBM pressure caused blocks 0-39 to spill to CPU after turn 2.',
            '  Action: promote 40 blocks from CPU (40 x 0.4 ms = 16 ms),',
            '          prefill would have cost 40 x 0.4 ms = 16 ms -- break even.',
            '          Remaining 40 blocks HIT in HBM. 10 new blocks prefilled.',
            '',
            'Turn 4: Same sys+tools prefix, 400 new tokens',
            '  Blocks 0-79 now warm in CPU staging (last 2 turns used them)',
            '  Promotion cost for 80 blocks: ~32 ms',
            '  Prefill cost for 80 blocks: ~32 ms -- still break even on short prefix',
            '  But sys+tools is 2,560 tokens (80 blocks). At full prefix length:',
            '  Prefill 2,560 tokens on 70B: ~50 ms. Promote from CPU: ~32 ms.',
            '  Net TTFT savings: ~18 ms per turn.',
            '',
            'Turn 5: sys prompt changed (new adapter loaded)',
            '  Lookup: block_key includes adapter_id, ALL keys miss',
            '  Action: full prefill, old blocks marked stale, new blocks cached',
            '  This is correct: the old KV state is wrong for the new adapter.',
          ].join('\n'),
          text: [
            'Turn 1: [sys_2048 + tools_512 + user_256] = 2,816 tokens = 88 blocks',
            '  Lookup: all miss (cold start)',
            '  Action: prefill all 88 blocks, async put blocks 0-87 to CPU staging',
            '  HBM: blocks 0-87 (88 used / 200 capacity)',
            '  CPU: blocks 0-87 (88 used / 2000 capacity)',
            '',
            'Turn 2: [sys_2048 + tools_512 + user_384] = 2,944 tokens = 92 blocks',
            '  Lookup: blocks 0-79 (sys+tools) HIT in HBM, blocks 80-91 MISS',
            '  Action: skip prefill for 80 blocks, prefill 12 new blocks',
            '  Saved: 80 blocks x 32 tokens x 0.4 ms = ~12.8 ms TTFT reduction',
            '  HBM: blocks 0-91 (92 used / 200 capacity)',
            '',
            'Turn 3: [sys_2048 + tools_512 + user_320] = 2,880 tokens = 90 blocks',
            '  Lookup: blocks 0-79 HIT in HBM (from turn 2 eviction, some in CPU)',
            '  Suppose HBM pressure caused blocks 0-39 to spill to CPU after turn 2.',
            '  Action: promote 40 blocks from CPU (40 x 0.4 ms = 16 ms),',
            '          prefill would have cost 40 x 0.4 ms = 16 ms -- break even.',
            '          Remaining 40 blocks HIT in HBM. 10 new blocks prefilled.',
            '',
            'Turn 4: Same sys+tools prefix, 400 new tokens',
            '  Blocks 0-79 now warm in CPU staging (last 2 turns used them)',
            '  Promotion cost for 80 blocks: ~32 ms',
            '  Prefill cost for 80 blocks: ~32 ms -- still break even on short prefix',
            '  But sys+tools is 2,560 tokens (80 blocks). At full prefix length:',
            '  Prefill 2,560 tokens on 70B: ~50 ms. Promote from CPU: ~32 ms.',
            '  Net TTFT savings: ~18 ms per turn.',
            '',
            'Turn 5: sys prompt changed (new adapter loaded)',
            '  Lookup: block_key includes adapter_id, ALL keys miss',
            '  Action: full prefill, old blocks marked stale, new blocks cached',
            '  This is correct: the old KV state is wrong for the new adapter.',
          ].join('\n'),
        },
        'The pattern is clear: tiered offload saves the most on repeated long prefixes across many turns. It breaks even or loses on short unique prompts. The adapter change in turn 5 shows key exactness working as intended -- stale state is refused, not served.',
      ],
    },
    {
      heading: 'Routing and locality',
      paragraphs: [
        'Tiered offload multiplies its value when the request router understands cache locality. If a user session, agent loop, or repeated workload bounces between replicas, every turn may reload or recompute state that already exists on another node.',
        {
          type: 'bullets',
          items: [
            'Sticky routing: pin a session to the replica that already holds its KV prefix. Reduces promotion traffic and increases HBM hit rate.',
            'Prefix-aware placement: hash the system-prompt prefix to a consistent set of replicas. All requests with that prefix land on nodes likely to have it cached.',
            'Shared remote pool: when a prefix is popular across many nodes, store it in a shared tier (Redis, distributed cache) so any node can fetch it without recompute.',
            'Prefetch on queue entry: if the router knows which prefix a request needs and that prefix is on SSD, start the read while the request waits in the batch queue. Promotion overlaps with queuing delay.',
          ],
        },
        'The router should not optimize hit rate alone. A GPU hit on a lightly loaded replica is different from an SSD hit on a saturated node. Routing should weigh reusable prefix length, tier location, queue depth, model replica health, and SLO budget. A short prefix hit may be worse than a long prefix miss if the miss can be prefetched while the request is queued.',
      ],
    },
    {
      heading: 'Eviction policy',
      paragraphs: [
        'Eviction is the core product policy. Plain LRU is a reasonable starting point but often too shallow for tiered KV workloads.',
        {
          type: 'table',
          headers: ['Block class', 'Signal', 'Policy', 'Rationale'],
          rows: [
            ['Live decode', 'Active sequence id', 'Never evict from HBM', 'Evicting breaks the running request'],
            ['Hot shared prefix', 'High ref count, recent access', 'Keep in HBM', 'System prompts used by many concurrent requests'],
            ['Warm session prefix', 'Single user, recent turn', 'Demote to CPU', 'Likely next turn will reuse, CPU promotion is fast'],
            ['Cold agent trace', 'No access for minutes', 'Demote to SSD', 'Agent may return; SSD is cheap and persistent'],
            ['Stale versioned block', 'Model or adapter changed', 'Drop immediately', 'Wrong KV state, reuse would corrupt output'],
            ['Orphaned block', 'No owning sequence, no ref', 'Drop and reclaim', 'Leaked by crashed request or aborted transfer'],
          ],
        },
        'An agent session may pause for minutes and return with a highly reusable prefix. A popular system prompt may be shared across hundreds of concurrent users. A long customer trace may be valuable only for one tenant. The eviction policy needs workload knowledge, not just last access time.',
        'Eviction should happen before crisis. Waiting until the GPU allocator fails turns cache policy into an exception handler. A better system watches HBM pressure, CPU staging occupancy, and request mix, then demotes completed or inactive blocks before active decode is threatened. The eviction trigger should be a watermark (e.g., "demote when HBM is 85% full"), not an OOM exception.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        {
          type: 'table',
          headers: ['Workload', 'Prefix reuse pattern', 'Why offload helps'],
          rows: [
            ['Coding agent', 'Stable sys + tools + repo context, new user turn', 'System prompt (2-8K tokens) reused across 10-50 turns per session'],
            ['Customer support copilot', 'Shared policy + product docs, per-ticket context', 'Policy prefix shared across all agents, document prefix shared per product'],
            ['RAG pipeline', 'Same retrieved documents for related queries', 'Document chunks cached; second query on same docs skips embedding-to-KV'],
            ['Multi-tenant gateway', 'Per-tenant system prompt', 'Hundreds of tenants, each with a stable 1-4K prompt; HBM cannot hold all'],
            ['Chat with long history', 'Growing prefix, each turn appends', 'Prior conversation KV is immutable; only new turn needs prefill'],
          ],
        },
        'The common pattern: the workload has a stable, expensive prefix that repeats across requests or turns. Offload earns its keep when the ratio of prefix reuse to unique suffix is high. A 4,096-token system prompt reused 50 times saves 49 prefill passes.',
        'The serving stack gets the most from offload when it combines three ideas: block-based KV management (PagedAttention), prefix-aware routing (consistent hashing on prefix), and tier-aware admission control (promote only when faster than recompute). The block manager provides reusable units. The router finds locality. The admission policy gates cold hits.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Stale keys: a model update, adapter swap, tokenizer change, or RoPE base-frequency change makes old KV invalid. Without versioned namespaces and refusal rules, the store serves wrong state silently.',
            'Tail latency: a remote cache can show excellent average latency and ruin p99 when many requests fetch the same popular prefix (thundering herd) or disk queue depth spikes.',
            'Capacity leaks: aborted requests, crashed workers, half-written files, and demoted blocks with no owner fill lower tiers. Quotas and garbage collection are part of the cache design, not cleanup chores.',
            'Cross-tenant leakage: KV state encodes prompt content and intermediate representations of sensitive context. Cross-tenant reuse must be opt-in, scoped, and audited.',
            'Promotion-cost inversion: when GPU prefill speed improves (faster hardware, quantized prefill, speculative decoding), the crossover point shifts. A tier that was faster than recompute on H100 may be slower on B200.',
          ],
        },
        'It fails on mostly unique traffic. If every prompt is new and short, the store adds lookup overhead and eviction churn without saving prefill. It also fails when teams confuse offload with transfer fabric. Transfer fabric moves KV between prefill and decode workers within a single request. Tiered offload preserves reusable KV across requests and time. A production system may use both, but the design questions are different.',
        'It fails when the cache is evaluated by aggregate dashboards only. Per-tier hit rate, per-tier TTFT, bytes moved, promotion failures, eviction reasons, stale-key rejections, cleanup lag, and cost per task are all required. Without them, a tiered store can look busy while making the product worse.',
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        {
          type: 'code',
          language: 'python',
          body: [
            '# Promotion decision pseudocode',
            'def should_promote(block_key, tier, request_slo_budget_ms):',
            '    est_promote_ms = estimate_promotion_time(block_key, tier)',
            '    est_prefill_ms = estimate_prefill_time(block_key.num_tokens)',
            '    ',
            '    if est_promote_ms > request_slo_budget_ms:',
            '        return False  # promotion would blow the SLO',
            '    if est_promote_ms > est_prefill_ms * 0.8:',
            '        return False  # recompute is nearly as fast',
            '    if not reserve_hbm_blocks(block_key.num_gpu_pages):',
            '        return False  # no space to land the promoted block',
            '    return True',
          ].join('\n'),
          text: [
            '# Promotion decision pseudocode',
            'def should_promote(block_key, tier, request_slo_budget_ms):',
            '    est_promote_ms = estimate_promotion_time(block_key, tier)',
            '    est_prefill_ms = estimate_prefill_time(block_key.num_tokens)',
            '    ',
            '    if est_promote_ms > request_slo_budget_ms:',
            '        return False  # promotion would blow the SLO',
            '    if est_promote_ms > est_prefill_ms * 0.8:',
            '        return False  # recompute is nearly as fast',
            '    if not reserve_hbm_blocks(block_key.num_gpu_pages):',
            '        return False  # no space to land the promoted block',
            '    return True',
          ].join('\n'),
        },
        'Start with a strict key schema and version it from day one. Make a cache miss the default for any unknown field. A false miss wastes compute; a false hit corrupts inference.',
        'Make gets cancellable and bounded. If a request has a tight SLO, waiting for a slow SSD read may be worse than recomputing. The runtime needs a policy for when to stop waiting, fall back to prefill, or serve from a shorter prefix.',
        'Make puts asynchronous but observable. A failed background put should not fail the current request, but it should count in metrics. Otherwise the system believes it is preserving reuse while the lower tier silently drops state.',
        'Protect the GPU allocator. Promotion must reserve destination blocks before loading from lower tiers. Partial promotions need rollback. If a request is cancelled mid-transfer, the store must release HBM pages, CPU buffers, file handles, and remote references.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Primary source: "Efficient Memory Management for Large Language Model Serving with PagedAttention" (Kwon et al., 2023) introduces the block-based KV management that makes tiered offload possible.',
            'Implementation source: vLLM CPU/disk offloading connector and LMCache (Yu et al., 2024) implement the local and distributed tiered store described here. LMCache adds remote pooling and prefix-aware routing.',
            'Production case: NVIDIA Dynamo KV cache routing and TensorRT-LLM offloading backends show how production serving stacks integrate tiered placement with continuous batching and SLO-aware scheduling.',
          ],
        },
        {
          type: 'table',
          headers: ['Role', 'Topic', 'Why'],
          rows: [
            ['Prerequisite', 'KV Cache Concurrency Capacity Model', 'Explains why HBM pressure appears and how concurrent requests compete for KV memory'],
            ['Prerequisite', 'LLM Serving PagedAttention', 'Block-based KV management is the foundation that makes offload blocks portable between tiers'],
            ['Extension', 'Prefix Caching and RadixAttention', 'The single-tier prefix cache that offload extends to multiple tiers'],
            ['Extension', 'KV Cache Quantization and Compression', 'Reducing block size via quantization changes the promotion-cost crossover point'],
            ['Contrast', 'KV Cache Transfer Fabric Case Study', 'Transfer fabric moves KV within a request; offload preserves it across requests'],
            ['Operational', 'SLO-Aware LLM Request Router', 'The router that decides whether a cold hit is worth waiting for'],
            ['Economics', 'LLM Unit Economics Ledger Case Study', 'Measuring whether offload reduces cost-per-task on real traffic'],
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
            'Can you state why a cache key must include adapter identity, not just token content?',
            'Can you explain why reads block but writes can be async?',
            'Can you name a workload where tiered offload makes TTFT worse, not better?',
            'Can you calculate the crossover point where CPU promotion beats prefill for a given model size and prefix length?',
            'Can you describe what happens when a model checkpoint changes but the store still holds old KV blocks?',
          ],
        },
      ],
    },
    {
      heading: 'Try this now',
      paragraphs: [
        'Open the tier-ladder view and trace a request from "req" through "hash" to the tier that holds its prefix. Predict whether each block key will hit HBM, CPU, SSD, or miss entirely based on the prefix reuse pattern.',
        'Switch to the eviction audit view. For each block class (hot, warm, cold, bad), predict which tier it should be placed in and why. Then check whether the animation agrees.',
        'Finally, take a concrete workload you care about -- a chat application, a coding agent, a RAG pipeline -- and estimate the ratio of reusable prefix tokens to unique suffix tokens per request. If the ratio is above 3:1 and the prefix exceeds 1,024 tokens, tiered offload is likely worth the complexity. If the ratio is below 1:1, single-tier prefix caching is probably enough.',
      ],
    },
  ],
};

