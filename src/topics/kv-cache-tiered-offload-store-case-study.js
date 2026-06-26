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
        'The tier-ladder view shows a lookup through GPU HBM, pinned CPU memory, local SSD, and a remote pool. HBM is high-bandwidth memory on the GPU, and it is the only tier active decode can read directly. Lower tiers can preserve state, but they must promote blocks into HBM before attention uses them.',
        'The promote-path view separates blocking reads from background writes. A get can delay time to first token because decode needs the block now. A put can often run after the current request has its state. The safe inference is that a lower-tier hit is useful only when promotion is cheaper than recomputing prefill.',
        {type: 'callout', text: 'A tiered KV cache works only when exact block identity and promotion cost decide whether to reuse state, spill it, or recompute it.'},
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/0/0c/ComputerMemoryHierarchy.svg', alt: 'Diagram of a computer memory hierarchy from CPU registers and caches down to disk storage.', caption: 'Computer memory hierarchy diagram by Danlash, vectorized by Fred the Oyster, Wikimedia Commons, public domain.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A transformer KV cache stores key and value tensors for previous tokens so decode can attend to history without recomputing the full prompt. The cache is deterministic state, not a summary. Long prompts, tool traces, and conversations can fill GPU HBM before arithmetic becomes the main limit.',
        'For a 70B model with 80 layers, 8 key-value heads, head dimension 128, FP16 values, and a 4,096-token prompt, KV size is about 2 times 80 times 8 times 128 times 4,096 times 2 bytes, or about 1.34 GiB. Ten such active or reusable prefixes can consume more than 13 GiB of scarce HBM. Tiered offload exists because useful KV state can outgrow the hot tier.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is a single HBM prefix cache. Hash the token prefix, keep the computed KV blocks on the GPU, and skip prefill when a later request shares the same prefix. This works well for repeated system prompts and short bursts.',
        'Another obvious approach is to spill everything cold to CPU or SSD. That increases capacity, but it can make time to first token worse. A cache hit that takes longer to load than to recompute is not a win.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is the reusable working set. Production traffic may include many tenants, system prompts, tools, adapters, document contexts, and conversation histories. HBM can hold only the hot slice of that state.',
        'The second wall is identity. A KV block is valid only for the exact token ids, model weights, tokenizer, adapter, position scheme, attention layout, dtype, and block size that produced it. A false miss wastes compute, but a false hit corrupts every later attention score.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A tiered KV store is a memory hierarchy plus an exact identity contract. The key must encode every parameter that affects the numerical KV tensors. The placement policy can move a block between tiers, but the meaning of the block cannot change.',
        'The useful decision is not hit or miss; it is promote or recompute. Promotion cost depends on bytes, bandwidth, queue depth, and available HBM pages. Recompute cost depends on prompt length, model size, batching, and GPU load.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The runtime splits a prompt into fixed-size token blocks, often 16 or 32 tokens, and computes a key for each prefix block. Lookup checks HBM first, then CPU memory, then SSD or a remote pool if configured. A hit below HBM reserves destination pages and copies the block upward before decode reads it.',
        'On a miss, the model runs normal prefill and produces the KV block. Afterward, the runtime can write the block to lower tiers for future reuse. Eviction demotes completed or inactive blocks before HBM pressure threatens active decode.',
      ],
    },    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness rests on key exactness and promotion equivalence. Key exactness means any field that changes the tensor value changes the key. Promotion equivalence means the bytes loaded into HBM represent the same KV state that prefill would have produced.',
        'The cost rule protects latency. If a 320 MiB CPU-resident block crosses PCIe at 25 GB/s, the copy takes about 12.8 ms before overhead. If recomputing the same prefix costs 30 ms, promotion helps; if recomputing costs 5 ms, promotion hurts and should be skipped.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Storage grows linearly with cached blocks times bytes per block. If one 32-token block for the 70B example is about 10.5 MiB, 1,000 cached blocks need about 10.5 GiB before metadata and allocator overhead. Doubling block count doubles storage; doubling block size doubles storage and transfer time.',
        'Metadata is small but operationally critical. The system must track key fields, tier location, reference counts, checksums, HBM reservations, pending transfers, eviction reasons, stale-version rejections, and failed background writes. Cost as behavior means the store can improve TTFT on repeated long prefixes while making short unique prompts slower.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Tiered offload fits coding agents, support copilots, RAG systems, and long chat sessions where a large prefix repeats across turns. A 4,096-token repository context reused for 20 turns avoids 19 prefill passes if the prefix remains valid and cheap to promote.',
        'It also fits multi-tenant gateways with many stable prompts. HBM can keep the hottest prefixes, CPU can hold warm session prefixes, and SSD can hold cold traces that may return. The router should prefer replicas with local warm state only when the transfer path still fits the request SLO.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails on mostly unique or short prompts. The lookup, metadata, and transfer path add overhead while saving little prefill. It also fails when the cache key ignores adapter, tokenizer, dtype, position encoding, or model version.',
        'Lower tiers can damage tail latency. SSD queue depth, remote network congestion, partial transfers, and HBM reservation failures can turn a nominal hit into a p99 spike. The fallback to recompute must be explicit and bounded.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A session uses a 2,560-token shared prefix with 32-token blocks, so the reusable prefix has 80 blocks. Each block is 10.5 MiB, so the prefix is about 840 MiB. HBM can spare 400 MiB for reusable KV, so only about 38 blocks fit hot; the other 42 blocks spill to CPU.',
        'On the next turn, 38 blocks hit HBM and 42 blocks promote from CPU. At 25 GB/s, copying 42 times 10.5 MiB is about 441 MiB, or 17.6 ms before overhead. If recomputing those 42 blocks would cost 35 ms, promotion saves about 17 ms of TTFT.',
        'Now the tenant switches to a new LoRA adapter. The adapter id is part of the key, so all 80 old blocks miss. That is correct because the old KV tensors were computed under different weights and would produce wrong attention.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: vLLM automatic prefix caching and KV offloading documentation at https://docs.vllm.ai/, LMCache documentation at https://docs.lmcache.ai/, and the PagedAttention paper at https://arxiv.org/abs/2309.06180. Hardware numbers should be checked against the deployed GPU, CPU, PCIe, NVMe, and network.',
        'Study KV Cache Concurrency Capacity Model, PagedAttention, Prefix Caching and RadixAttention, KV Cache Quantization, KV Cache Transfer Fabric, SLO-Aware LLM Request Router, GPU memory pools, and cache eviction policy next.',
      ],
    },
  ],
};