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
      heading: 'What it is',
      paragraphs: [
        'A KV Cache Tiered Offload Store moves reusable prompt KV blocks out of scarce GPU HBM into larger tiers such as pinned CPU memory, local SSD, or a remote distributed store. On a later request, the server can load the blocks back instead of recomputing prefill. This is the storage version of the same inference economics: trade memory and IO for fewer expensive prompt passes.',
        'vLLM documents an OffloadingConnector that extends prefix caching by offloading completed KV blocks to slower but larger tiers. The default CPU spec copies GPU blocks into pinned host memory, while a tiering spec uses CPU as the primary tier plus secondary tiers; secondary tiers are staged through CPU rather than talking directly to GPU: https://docs.vllm.ai/en/latest/features/kv_offloading_usage/.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The request is tokenized into exact prefix-block keys. The server checks hot GPU blocks first, then CPU, then storage or remote backends. A hit is promoted toward GPU and inserted into the local block table before decode reads it. A miss runs prefill and can asynchronously put completed blocks into lower tiers for future reuse.',
        'LMCache documents CPU RAM and local storage as non-GPU offload tiers, with disk backends creating one file per KV chunk, LRU eviction when capacity is exceeded, asynchronous puts, blocking gets, and prefetch from disk into CPU RAM: https://docs.lmcache.ai/kv_cache/local_storage.html. Ray Serve describes KV offloading as a way to extend capacity with CPU memory or local disk and preserve reusable prefills across turns: https://docs.ray.io/en/latest/serve/llm/user-guides/kv-cache-offloading.html.',
      ],
    },
    {
      heading: 'Complete case study: agentic traces',
      paragraphs: [
        'Agentic workloads often repeat a system prompt, tool schemas, repository instructions, and prior trace structure across many turns. Without a shared KV store, each node may recompute the same prefixes or miss because the next turn lands on a different worker. A tiered store gives the router a new option: route toward cache locality, or load the prefix from a shared store before prefill. SLO-Aware LLM Request Router explains how that option competes with queue depth, p99 budget, tenant policy, and fallback.',
        'The vLLM Mooncake Store integration frames this as a distributed KV cache pool for agentic workloads, reporting large throughput and TTFT improvements on its published traces when cache hit rate rises sharply: https://vllm.ai/blog/2026-05-06-mooncake-store. LMCache describes Mooncake as a distributed KV cache storage system that pools DRAM and SSD resources from multiple nodes and supports RDMA-oriented transfer paths: https://docs.lmcache.ai/kv_cache/storage_backends/mooncake.html.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Tiering adds new knobs and new failure modes. Hit rate, tier latency, bytes moved, CPU staging pressure, disk queue depth, remote congestion, eviction policy, freshness keys, and cleanup after aborted requests all matter. A cache that increases IO but rarely hits can make time to first token worse while looking busy.',
        'NVIDIA Dynamo documents multiple vLLM KV offloading backends, including a built-in KV Block Manager with CPU and disk tiers, LMCache with multi-level storage backends, and FlexKV with GPU, CPU, SSD, distributed reuse, io_uring, and GPUDirect Storage: https://docs.nvidia.com/dynamo/backends/v-llm/kv-cache-offloading. vLLM also exposes FlexKVConnectorV1 for a distributed KV store with CPU, SSD, and remote storage support: https://docs.vllm.ai/en/latest/api/vllm/distributed/kv_transfer/kv_connector/v1/flexkv_connector/.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not treat offload as free memory. CPU, SSD, and remote stores are slower tiers. They help when cache reuse is high enough to beat recomputation, not when every prompt is unique. Do not reuse KV across different tokens, model ids, adapters, RoPE positions, or cache formats. A false hit changes the model computation.',
        'Do not confuse tiered offload with KV Cache Transfer Fabric Case Study. Transfer fabric moves state between prefill and decode workers. Tiered offload preserves and reloads reusable KV state across requests, turns, or engine instances. Serious systems can use both, but they solve different placement problems.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary and official sources: vLLM KV Offloading Usage Guide at https://docs.vllm.ai/en/latest/features/kv_offloading_usage/, NVIDIA Dynamo KV Cache Offloading at https://docs.nvidia.com/dynamo/backends/v-llm/kv-cache-offloading, vLLM Mooncake Store blog at https://vllm.ai/blog/2026-05-06-mooncake-store, LMCache local storage docs at https://docs.lmcache.ai/kv_cache/local_storage.html, LMCache Mooncake backend docs at https://docs.lmcache.ai/kv_cache/storage_backends/mooncake.html, Ray Serve KV offloading guide at https://docs.ray.io/en/latest/serve/llm/user-guides/kv-cache-offloading.html, and vLLM FlexKVConnector docs at https://docs.vllm.ai/en/latest/api/vllm/distributed/kv_transfer/kv_connector/v1/flexkv_connector/.',
        'Study KV Cache Concurrency Capacity Model, Prefix Caching & RadixAttention, LLM Serving: PagedAttention, KV Cache Transfer Fabric Case Study, SLO-Aware LLM Request Router, KV Cache Quantization & Compression, Weka Filesystem Case Study, GPU Memory Pool Fragmentation Ledger, Distributed Tracing, Tail Latency & p99 Thinking, and LLM Unit Economics Ledger Case Study next.',
      ],
    },
  ],
};
