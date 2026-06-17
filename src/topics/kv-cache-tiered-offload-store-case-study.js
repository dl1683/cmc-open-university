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
      heading: `Why This Exists`,
      paragraphs: [
        `Transformer inference keeps a key-value cache for every generated context token. That cache is what lets decode attend to earlier tokens without recomputing all previous transformer layers. It is also huge. Long prompts, long conversations, tool traces, and many concurrent users can fill GPU HBM before arithmetic becomes the bottleneck.`,
        `Agentic workloads make the opportunity visible. The system prompt, tool instructions, repository context, policy text, and previous trace prefixes may repeat across turns. Recomputing that prefix every time wastes prefill compute and increases time to first token. Keeping every possible prefix in GPU memory is not possible either, because active decode needs that same HBM.`,
        `A tiered KV-cache offload store treats computed prompt state as a cacheable artifact with a memory hierarchy. Hot blocks stay in GPU HBM. Warm blocks can sit in pinned CPU memory. Colder blocks can spill to SSD or a remote pool. The goal is not to make slow memory behave like HBM. The goal is to reload reusable state when loading is cheaper than recomputing prefill.`,
      ],
    },
    {
      heading: `The Obvious Approach and the Wall`,
      paragraphs: [
        `The simplest approach is to keep KV cache only on the GPU and evict when memory is full. That is easy to reason about, but it wastes reuse. When a later request repeats a large prefix, the server must run prefill again even if another request just paid for that same computation.`,
        `The second tempting approach is to offload everything that does not fit. That turns a memory problem into a latency problem. CPU RAM, SSD, network storage, and remote cache nodes are slower tiers with their own queues, failures, and tail behavior. If every request blocks on cold storage, the cache can make the service worse while appearing busy.`,
        `The real wall is selectivity. A tiered store must know which blocks are safe to reuse, which blocks are likely to be reused, and which loads are worth delaying a request for. Without that discipline, offload becomes a larger trash can for state the product should have dropped.`,
      ],
    },
    {
      heading: `Core Invariant`,
      paragraphs: [
        `The invariant is exact computational equivalence: a loaded KV block must be the same state the model would have produced by prefilling the same token block under the same model contract. The placement can change. The semantics cannot.`,
        `That means the cache key is not just text. It must encode token ids, model identity, tokenizer version, adapter or LoRA identity, position scheme, attention layout, dtype or quantization format, block size, and any tenant or safety boundary that affects reuse. Two prompts that look similar to a person may still be a miss if tokenization, position, or adapter state differs.`,
        `This invariant is stricter than ordinary application caching. A stale HTML fragment may show old text. A stale KV block changes the model computation itself. The store needs versioning and invalidation rules that are closer to compiled artifact caching than to fuzzy semantic retrieval.`,
      ],
    },
    {
      heading: `Mechanism`,
      paragraphs: [
        `A request first becomes token blocks. The runtime hashes those blocks into prefix keys and asks the local block table whether they are already resident in GPU memory. If they are, decode can use them directly. If not, the runtime checks slower tiers in order: CPU staging memory, local SSD, remote cache pool, or another configured backend.`,
        `A cold hit must be promoted before attention can read it. A block stored on SSD is loaded into CPU memory, copied into GPU blocks, registered in the local block table, and then used by the model. A remote hit may add network transfer before the CPU and GPU staging steps. This promotion path is why the store must measure time to first token by tier, not just hit rate.`,
        `A miss runs normal prefill. After prefill completes a block, the runtime can asynchronously put that block into lower tiers for future requests. Reads often block the current request because decode needs the KV now. Writes can usually run in the background because the current request already has the state it needs.`,
      ],
    },
    {
      heading: `Animation Notes`,
      paragraphs: [
        `The tier-ladder view starts with a prefix key and shows the hierarchy. HBM is the only tier that directly feeds active attention. CPU is the staging tier. SSD and remote tiers buy capacity and sharing, but they must promote through the path that the engine can actually consume.`,
        `The promote-path view separates blocking gets from asynchronous puts. A get matters to the request in front of the user. A put matters to a future request. The eviction audit then shows the policy question: which blocks deserve scarce HBM, which deserve CPU or SSD, and which should be dropped because they are stale, low value, or unsafe.`,
      ],
    },
    {
      heading: `Tier Roles`,
      paragraphs: [
        `GPU HBM is for active decode and the hottest reusable prefixes. It has the bandwidth and latency attention needs, but it is scarce and expensive. Treating HBM as an archival cache is a fast path to out-of-memory errors and poor batching.`,
        `Pinned CPU memory is a useful staging area. It is much larger than HBM and can feed GPU transfers efficiently, but it still competes with other host memory needs. If CPU staging fills with low-value prefixes, GPU promotion slows down and the server may lose the latency benefit it hoped to gain.`,
        `SSD and remote tiers are capacity tiers. They are useful for repeated large prefixes, agent sessions that may return later, and multi-node reuse. They also introduce filesystem behavior, queue depth, network congestion, serialization costs, and cleanup problems. A system should be able to prove that a block loaded from these tiers is cheaper than recompute for the workload slice using it.`,
      ],
    },
    {
      heading: `Routing and Locality`,
      paragraphs: [
        `Tiered offload works better when the router understands cache locality. If a user session, agent loop, or repeated workload keeps bouncing between replicas, every turn may reload or recompute state. Sticky routing, prefix-aware placement, and shared remote stores all try to keep reusable KV close to the engine that needs it.`,
        `The router should not optimize hit rate alone. A GPU hit on a lightly loaded replica is very different from an SSD hit on a saturated node. A shorter prefix hit may be worse than a longer prefix miss if the miss can be prefetched while queued. Routing should consider reusable prefix length, tier, queue depth, model replica health, and service-level objective.`,
        `This is where tiered offload connects to the broader serving stack. Continuous batching decides how requests share decode steps. PagedAttention or block managers decide how KV is carved into reusable blocks. Prefix caching decides what can be reused. Offload extends the placement choices beyond HBM.`,
      ],
    },
    {
      heading: `Eviction Policy`,
      paragraphs: [
        `Eviction is the core product policy. The store should keep live decode state, likely next-turn prefixes, and expensive repeated prefixes. It should demote or drop one-off prompts, expired sessions, stale model versions, and prefixes whose load path is slower than recompute.`,
        `Plain LRU is a reasonable starting point but often too shallow. An agent session may pause for a while and then return with a highly reusable prefix. A popular system prompt may be reused across many users. A long customer-specific trace may be valuable only for that customer and unsafe for anyone else. The policy needs workload knowledge, not just last access time.`,
        `Eviction should happen before crisis. Waiting until the GPU allocator fails turns cache policy into an exception handler. A better system watches HBM pressure, CPU staging pressure, disk capacity, remote quota, and request mix, then demotes completed or inactive blocks before active decode is threatened.`,
      ],
    },
    {
      heading: `Economics`,
      paragraphs: [
        `The economic question is simple: did the cache reduce total cost or only move it? Prefill compute is expensive, but so are CPU copies, disk reads, network transfer, serialization, metadata operations, and larger failure domains. A tiered store earns its keep when it lowers time to first token, increases useful throughput, or reduces cost per accepted task on real traffic.`,
        `The best workloads have repeated prefixes: agent loops, chat sessions with stable system and tool context, retrieval flows that reuse large documents, customer support playbooks, codebase analysis, and applications with shared policy text. Random one-off prompts often do not benefit. For those, the store may add lookup overhead and eviction churn without saving prefill.`,
        `Measure by slice. A 90 percent hit rate on tiny blocks may not matter. A 20 percent hit rate on very long prefixes may be valuable. A disk hit that saves 800 milliseconds on average but adds a 5-second p99 may violate the product promise. The useful metric is not just hit rate; it is latency and cost saved per block loaded by tier.`,
      ],
    },
    {
      heading: `Implementation Guidance`,
      paragraphs: [
        `Start with a strict key schema and version it. Include model, tokenizer, adapter, position encoding, block size, dtype, quantization, safety boundary, and tenant scope. Make a cache miss the default for any unknown field. A false miss wastes compute; a false hit corrupts inference.`,
        `Make gets cancellable and bounded. If a request has a tight SLO, waiting for a slow SSD or remote read may be worse than recomputing. The runtime should have a policy for when to stop waiting, fall back to prefill, or serve from a shorter prefix. That policy belongs in code, not in an operator's head during an incident.`,
        `Make puts asynchronous but observable. A failed background put should not fail the current request, but it should count. Otherwise the system may believe it is preserving reuse while the lower tier is silently dropping state. Track put success, put latency, bytes written, evictions, and cleanup lag.`,
        `Protect the GPU allocator. Promotion should reserve destination blocks before loading from lower tiers. Partial promotions need rollback or cleanup. If the request is cancelled mid-transfer, the store must release HBM, CPU buffers, file handles, and remote references.`,
      ],
    },
    {
      heading: `Failure Modes`,
      paragraphs: [
        `Stale keys are the most dangerous failure. A model update, adapter swap, tokenizer change, position-scaling change, or dtype change can make old KV invalid. The store needs versioned namespaces and refusal rules that prefer recompute over unsafe reuse.`,
        `Tail latency is the most visible failure. A remote cache can look excellent in average latency and still ruin p99 when many requests fetch the same popular prefix or when disk queue depth spikes. Thundering herds need request coalescing, admission control, and prefetch policies.`,
        `Capacity leaks are common. Aborted requests, crashed workers, half-written files, forgotten remote references, and demoted blocks with no owner can fill lower tiers. Quotas and garbage collection are part of the cache design. They are not cleanup chores to add later.`,
        `Security boundaries also matter. KV state can encode prompt content and intermediate representations of sensitive context. Cross-tenant reuse should be opt-in, scoped, audited, and usually avoided unless the system can prove that the prefix is public and identical for all users.`,
      ],
    },
    {
      heading: `Where It Wins`,
      paragraphs: [
        `Tiered KV offload wins in long-context chat, coding agents, customer-support copilots, tool-using agents, retrieval systems with repeated documents, model gateways with shared system prompts, and multi-turn workflows where the same prefix is expensive to prefill repeatedly.`,
        `It is especially useful when the serving stack can combine three ideas: block-based KV management, prefix-aware routing, and tier-aware admission control. The block manager gives reusable units. The router finds locality. The admission policy decides when a cold hit is worth waiting for.`,
      ],
    },
    {
      heading: `Where It Fails`,
      paragraphs: [
        `It fails on mostly unique traffic. If every prompt is new and short, the store becomes overhead. It also fails when lower-tier bandwidth is weak, when routing is random, when keys are incomplete, or when the product SLO cannot tolerate blocking gets.`,
        `It fails when teams confuse offload with transfer fabric. Transfer fabric moves KV between prefill and decode workers or across engine roles. Tiered offload preserves reusable KV across time and memory tiers. A serious serving system may use both, but the design questions are different.`,
        `It fails when the cache is evaluated by aggregate dashboards only. You need per-tier hit rate, per-tier TTFT, bytes moved, promotion failures, eviction reason, stale-key rejection, cleanup lag, and cost per task. Without those, a tiered store can look sophisticated while quietly harming the service.`,
      ],
    },
    {
      heading: `Study Next`,
      paragraphs: [
        `Study KV Cache Concurrency Capacity Model first to understand why HBM pressure appears. Then read KV Cache, Prefix Caching and RadixAttention, LLM Serving PagedAttention, KV Cache Transfer Fabric Case Study, SLO-Aware LLM Request Router, KV Cache Quantization and Compression, GPU Memory Pool Fragmentation Ledger, Tail Latency, Distributed Tracing, and LLM Unit Economics Ledger Case Study.`,
        `For implementation context, compare the ideas used by vLLM offloading connectors, LMCache local and distributed storage, Ray Serve KV offloading, and NVIDIA Dynamo backends. Focus less on brand names and more on the common contract: exact keys, tiered placement, bounded promotion, observable eviction, and proof that reuse beats recompute for the workload.`,
      ],
    },
  ],
};
