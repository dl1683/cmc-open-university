// Curated learning paths over the topic registry.
// Categories answer "what domain is this in?"; tracks answer "what should I
// study, in what order, and what does it unlock?"

export const learningTracks = [
  {
    id: 'beginner-cs-foundations',
    title: 'Beginner CS Foundations',
    shortTitle: 'Beginner CS',
    level: 'Beginner',
    pace: '18 topics',
    audience: 'New programmers, self-taught learners, and students who want the mental models before the jargon.',
    summary: 'Build the basic vocabulary of computing: storage, order, search, recursion, trees, graphs, cost, and one modern AI bridge.',
    outcome: 'You can explain why a program uses a stack, queue, hash table, tree, graph, cache, or vector operation instead of treating them as names to memorize.',
    useWhen: 'Start here if the site feels too large or if terms like heap, traversal, Big-O, and attention are not automatic yet.',
    capstone: 'Trace one real feature, such as autocomplete or route finding, from simple containers through search strategy and cost.',
    nextTrackIds: ['interview-dsa', 'production-data-structures', 'ai-ml-foundations'],
    modules: [
      {
        title: 'Containers You Can See',
        goal: 'Learn how programs arrange things before they do anything clever with them.',
        topicIds: ['linked-list', 'stack', 'queue', 'hash-table', 'recursion'],
      },
      {
        title: 'Search, Sort, and Cost',
        goal: 'Connect motion in the animation to the amount of work the machine performs.',
        topicIds: ['linear-search', 'binary-search', 'bubble-sort', 'merge-sort', 'big-o-growth'],
      },
      {
        title: 'Trees, Graphs, and Paths',
        goal: 'Move from lists to branching structures and learn why shape controls speed.',
        topicIds: ['binary-search-tree', 'tree-traversals', 'binary-heap', 'graph-bfs', 'dijkstra'],
      },
      {
        title: 'The Bridge to Modern Systems',
        goal: 'See how the same simple ideas reappear in caching, probabilistic filters, and AI.',
        topicIds: ['memoization', 'lru-cache', 'bloom-filter', 'tokenization-bpe', 'attention'],
      },
    ],
  },
  {
    id: 'interview-dsa',
    title: 'Interview DSA and Problem Solving',
    shortTitle: 'Interview DSA',
    level: 'Beginner to Intermediate',
    pace: '24 topics',
    audience: 'Learners preparing for interviews or trying to turn scattered algorithm practice into a coherent toolkit.',
    summary: 'A practical sequence for arrays, pointers, stacks, queues, binary search, sorting, trees, graphs, range queries, and strings.',
    outcome: 'You can look at a problem and recognize the likely tool: two pointers, sliding window, heap, graph traversal, union-find, trie, or range structure.',
    useWhen: 'Use this when you need transfer: not just knowing a structure, but spotting when it applies.',
    capstone: 'Solve a mixed problem set where each prompt hides the intended pattern instead of naming it.',
    nextTrackIds: ['production-data-structures', 'databases-storage-systems', 'distributed-systems-reliability'],
    modules: [
      {
        title: 'Linear Patterns',
        goal: 'Handle most array and stream questions without nested loops.',
        topicIds: ['two-pointers', 'sliding-window', 'monotonic-stack', 'monotonic-queue'],
      },
      {
        title: 'Divide, Order, and Priority',
        goal: 'Understand the standard ways to cut a search space or keep the next best candidate ready.',
        topicIds: ['binary-search', 'merge-sort', 'quick-sort', 'heap-sort', 'binary-exponentiation', 'binary-heap'],
      },
      {
        title: 'Trees and Graphs',
        goal: 'Recognize when relationships, not arrays, are the real problem.',
        topicIds: ['tree-traversals', 'binary-search-tree', 'union-find', 'graph-bfs', 'dijkstra', 'topological-sort'],
      },
      {
        title: 'Range and String Tooling',
        goal: 'Build the advanced structures that turn repeated questions into fast lookups.',
        topicIds: ['fenwick-tree', 'segment-tree', 'sparse-table', 'trie', 'kmp-prefix-function', 'rolling-hash-rabin-karp'],
      },
    ],
  },
  {
    id: 'production-data-structures',
    title: 'Production Data Structures',
    shortTitle: 'Production DS',
    level: 'Intermediate',
    pace: '25 topics',
    audience: 'Engineers who know textbook structures and want to understand the versions that survive real workloads.',
    summary: 'Move from classroom containers to allocators, cache-aware maps, probabilistic filters, text buffers, indexes, and concurrent structures.',
    outcome: 'You can explain why production systems care about locality, fragmentation, false positives, compaction, and memory reclamation.',
    useWhen: 'Use this after basic DSA, or whenever a system topic mentions free lists, bloom filters, indexes, RCU, or lock-free structures.',
    capstone: 'Design the in-memory layer for a search or game-engine workload and justify each structure by access pattern.',
    nextTrackIds: ['databases-storage-systems', 'distributed-systems-reliability', 'browser-web-platform'],
    modules: [
      {
        title: 'Memory Layout and Locality',
        goal: 'See how physical layout changes performance even when Big-O is unchanged.',
        topicIds: ['ring-buffer', 'double-ended-queue-deque', 'buddy-allocator-free-lists', 'slab-allocator-size-classes', 'sparse-set-entity-index', 'archetype-ecs-column-store'],
      },
      {
        title: 'Maps, Filters, and Sketches',
        goal: 'Trade exactness, memory, and speed deliberately.',
        topicIds: ['swisstable-hash-map', 'bloom-filter', 'cuckoo-filter', 'quotient-filter', 'count-min-sketch', 'hyperloglog'],
      },
      {
        title: 'Text, Spatial, and Search Indexes',
        goal: 'Choose structures for edits, regions, text search, and compressed membership.',
        topicIds: ['text-rope-data-structure', 'piece-table-text-buffer', 'r-tree', 'quadtree-spatial-index-map-tiles', 'inverted-index', 'roaring-bitmaps'],
      },
      {
        title: 'Concurrency and Lifetime',
        goal: 'Understand the correctness layer behind high-performance shared structures.',
        topicIds: ['lock-free-queue', 'linearizability-history-checker-case-study', 'hazard-pointers-epoch-reclamation', 'read-copy-update-rcu', 'sequence-lock-seqlock'],
      },
    ],
  },
  {
    id: 'databases-storage-systems',
    title: 'Databases and Storage Systems',
    shortTitle: 'Databases',
    level: 'Intermediate to Advanced',
    pace: '23 topics',
    audience: 'Backend, data, and infra engineers who want to understand why databases behave the way they do.',
    summary: 'Follow data from indexes and pages through logs, transactions, compaction, replication, and analytical execution.',
    outcome: 'You can reason about read/write amplification, transaction anomalies, compaction debt, recovery, sharding, and analytical query shape.',
    useWhen: 'Use this when database performance, correctness, or architecture feels like a black box.',
    capstone: 'Explain one user-visible database incident in terms of index choice, log/recovery behavior, isolation, and replication.',
    nextTrackIds: ['distributed-systems-reliability', 'production-data-structures'],
    modules: [
      {
        title: 'Access Paths',
        goal: 'Understand how databases avoid scanning everything.',
        topicIds: ['database-indexing', 'b-tree', 'b-plus-tree-leaf-sibling-scan-case-study', 'lsm-tree', 'sstable-block-index-filter-case-study', 'rocksdb-lsm-case-study'],
      },
      {
        title: 'Transactions and Recovery',
        goal: 'Learn what keeps data correct after crashes and concurrent edits.',
        topicIds: ['write-ahead-log', 'isolation-levels', 'mvcc-vacuum', 'postgres-wal-checkpoint-recovery-case-study', 'postgres-buffer-pool-clock-sweep-case-study'],
      },
      {
        title: 'Distribution',
        goal: 'See how databases split, replicate, and order work across machines.',
        topicIds: ['sharding', 'consistent-hashing', 'raft-log-replication', 'spanner-case-study', 'calvin-deterministic-db-case-study'],
      },
      {
        title: 'Analytics and Lakehouse Execution',
        goal: 'Connect columnar memory, vectorized execution, table formats, and merge trees.',
        topicIds: ['apache-arrow-columnar-memory-case-study', 'duckdb-vectorized-execution-case-study', 'clickhouse-mergetree-case-study', 'delta-lake-case-study', 'apache-paimon-streaming-lakehouse-case-study'],
      },
    ],
  },
  {
    id: 'distributed-systems-reliability',
    title: 'Distributed Systems and Reliability',
    shortTitle: 'Distributed Systems',
    level: 'Intermediate to Advanced',
    pace: '27 topics',
    audience: 'Engineers building services, queues, workflows, observability, and incident response systems.',
    summary: 'A reliability path through load, latency, retries, clocks, consensus, queues, tracing, rollouts, and failure analysis.',
    outcome: 'You can separate local correctness from distributed correctness, and explain how retries, clocks, queues, and traces change system behavior.',
    useWhen: 'Use this when a system has multiple services and the hard bugs are timing, ownership, visibility, or recovery.',
    capstone: 'Design a fault-tolerant payment or job-processing workflow with backpressure, idempotency, tracing, and rollback.',
    nextTrackIds: ['databases-storage-systems', 'security-trust-verification', 'transformers-llm-systems'],
    modules: [
      {
        title: 'Load and Failure Boundaries',
        goal: 'Protect services before failures cascade.',
        topicIds: ['load-balancer', 'rate-limiter', 'circuit-breakers', 'retries-jitter', 'backpressure', 'tail-latency'],
      },
      {
        title: 'Time, Agreement, and Coordination',
        goal: 'Understand why distributed state is harder than shared memory.',
        topicIds: ['logical-clocks', 'cap-theorem', 'raft-election', 'raft-log-replication', 'paxos', 'two-phase-commit', 'saga-pattern'],
      },
      {
        title: 'Streams and Observability',
        goal: 'See logs, schemas, queues, traces, and metrics as the nervous system of production software.',
        topicIds: ['message-queue', 'kafka-log-case-study', 'schema-registry-case-study', 'distributed-tracing', 'dapper-tracing-case-study', 'opentelemetry-tail-sampling-policy-case-study'],
      },
      {
        title: 'Operations and Change',
        goal: 'Make failures explainable and changes reversible.',
        topicIds: ['incident-causal-candidate-graph-case-study', 'slo-error-budget-burn-rate-alert-case-study', 'feature-flag-control-plane', 'idempotency', 'transactional-outbox', 'runbook-automation-approval-ledger-case-study'],
      },
    ],
  },
  {
    id: 'ai-ml-foundations',
    title: 'AI and ML Foundations',
    shortTitle: 'AI/ML Foundations',
    level: 'Beginner to Intermediate',
    pace: '23 topics',
    audience: 'Software engineers and students who want practical ML concepts before jumping into large models.',
    summary: 'Build from vectors and optimization into models, evaluation, leakage, calibration, and causal decision-making.',
    outcome: 'You can tell whether a model is learning, overfitting, leaking data, miscalibrated, or being evaluated with the wrong metric.',
    useWhen: 'Use this before advanced LLM topics or whenever ML terms feel disconnected from engineering decisions.',
    capstone: 'Evaluate a model change with a train/test split, calibration view, threshold policy, and leakage audit.',
    nextTrackIds: ['transformers-llm-systems', 'security-trust-verification'],
    modules: [
      {
        title: 'Vectors and Optimization',
        goal: 'Understand the numerical substrate of ML.',
        topicIds: ['embeddings-similarity', 'softmax-temperature', 'entropy', 'gradient-descent', 'backpropagation'],
      },
      {
        title: 'Model Families',
        goal: 'Compare simple, tree-based, clustered, and linear-algebraic models.',
        topicIds: ['logistic-regression', 'random-forest', 'gradient-boosting', 'k-means', 'pca', 'svd'],
      },
      {
        title: 'Evaluation Discipline',
        goal: 'Avoid fooling yourself with the wrong split, metric, or threshold.',
        topicIds: ['cross-validation', 'data-leakage', 'calibration-curves', 'roc-auc', 'precision-recall', 'threshold-optimization'],
      },
      {
        title: 'Causal and Decision Systems',
        goal: 'Move from prediction to decisions under uncertainty.',
        topicIds: ['ab-testing', 'causal-graphs', 'doubly-robust', 'thompson-sampling', 'contextual-bandit-logged-policy-evaluation-case-study', 'difference-in-differences'],
      },
    ],
  },
  {
    id: 'transformers-llm-systems',
    title: 'Transformers and LLM Systems',
    shortTitle: 'LLM Systems',
    level: 'Intermediate to Advanced',
    pace: '27 topics',
    audience: 'AI engineers, infra engineers, and product engineers building with retrieval, agents, serving, and safety layers.',
    summary: 'Connect transformer math to serving systems, retrieval, structured generation, tracing, cost, and guardrails.',
    outcome: 'You can reason across the full stack: tokens, attention, KV cache, batching, retrieval, constrained decoding, routing, cost, and safety.',
    useWhen: 'Use this after AI/ML foundations, or when LLM behavior and LLM serving costs need to be understood together.',
    capstone: 'Design an LLM feature with RAG, constrained outputs, cost controls, telemetry, fallback, and a risk gate.',
    nextTrackIds: ['distributed-systems-reliability', 'security-trust-verification'],
    modules: [
      {
        title: 'Transformer Core',
        goal: 'Learn the inside of the model before optimizing or wrapping it.',
        topicIds: ['tokenization-bpe', 'attention', 'multi-head-attention', 'positional-encoding', 'rope', 'transformer-block', 'kv-cache'],
      },
      {
        title: 'Serving Cost and Throughput',
        goal: 'Understand why inference bottlenecks are memory, batching, cache, kernels, and tail latency.',
        topicIds: ['transformer-layer-flops-cost-model', 'transformer-inference-roofline', 'llm-continuous-batching', 'llm-serving-pagedattention', 'prefix-caching-radixattention', 'speculative-decoding', 'quantization'],
      },
      {
        title: 'Retrieval, Agents, and Structured Output',
        goal: 'Build model systems that use external evidence and produce controlled actions.',
        topicIds: ['rag-pipeline', 'hnsw-search', 'cross-encoder-reranker', 'constrained-decoding', 'agentic-ai-patterns-planning-tools-memory', 'prompt-injection-threat-model'],
      },
      {
        title: 'Production Control Plane',
        goal: 'Add routing, telemetry, safety, and operational economics around the model.',
        topicIds: ['llm-inference-cost-stack-case-study', 'llm-serving-admission-control-goodput-gate-case-study', 'genai-trace-token-cost-ledger-case-study', 'llm-guardrail-policy-engine', 'kserve-llmd-inference-service-control-plane-case-study', 'nvidia-dynamo-distributed-inference-control-plane-case-study'],
      },
    ],
  },
  {
    id: 'browser-web-platform',
    title: 'Browser and Web Platform',
    shortTitle: 'Web Platform',
    level: 'Intermediate',
    pace: '25 topics',
    audience: 'Frontend, full-stack, and performance engineers who want to understand the browser as a runtime and distributed cache.',
    summary: 'Study the event loop, workers, rendering, storage, cache, security boundaries, WebAssembly, WebGPU, and accessibility.',
    outcome: 'You can reason about jank, lifecycle, cache correctness, cross-origin boundaries, client storage, and browser execution limits.',
    useWhen: 'Use this when web performance or browser behavior feels magical despite knowing JavaScript.',
    capstone: 'Diagnose a slow, offline-capable web app from event loop through cache, storage, rendering, and security policy.',
    nextTrackIds: ['security-trust-verification', 'distributed-systems-reliability'],
    modules: [
      {
        title: 'Runtime and Concurrency',
        goal: 'Understand how JavaScript work is scheduled and moved off the main thread.',
        topicIds: ['event-loop', 'javascript-promise-microtask-queue-case-study', 'web-workers', 'sharedarraybuffer-atomics-wait-notify-case-study', 'web-streams-backpressure-queue-case-study'],
      },
      {
        title: 'Rendering and Lifecycle',
        goal: 'Connect frames, page lifecycle, service workers, and preload races.',
        topicIds: ['browser-rendering', 'requestanimationframe-frame-budget-case-study', 'bfcache-page-lifecycle-case-study', 'service-workers', 'service-worker-navigation-preload-race-case-study'],
      },
      {
        title: 'Network, Cache, and Web Security',
        goal: 'See browser performance and security as shared cache-key and origin-boundary problems.',
        topicIds: ['dns-resolution', 'cdn-request-flow', 'http-cache-etag-revalidation-case-study', 'cors-preflight-cache-case-study', 'samesite-cookie-csrf-case-study', 'content-security-policy-nonce-hash-case-study'],
      },
      {
        title: 'Storage, Compute, and Access',
        goal: 'Use modern browser APIs without losing track of memory, quotas, and user-facing semantics.',
        topicIds: ['indexeddb-object-store-case-study', 'opfs-origin-private-file-system-case-study', 'webassembly-linear-memory-case-study', 'webgpu-buffer-bind-group-case-study', 'accessibility-tree-action-target-case-study'],
      },
    ],
  },
  {
    id: 'security-trust-verification',
    title: 'Security, Trust, and Verification',
    shortTitle: 'Security and Trust',
    level: 'Intermediate to Advanced',
    pace: '25 topics',
    audience: 'Engineers responsible for web security, supply chain, authorization, agent safety, or auditability.',
    summary: 'A path through browser defenses, integrity systems, identity, capability security, policy engines, and AI safety.',
    outcome: 'You can place a risk in the right layer: origin policy, crypto proof, authorization graph, supply chain provenance, model behavior, or audit trail.',
    useWhen: 'Use this when correctness is not enough and the question becomes who can do what, with what evidence, under what policy.',
    capstone: 'Build a threat model for an AI-powered web workflow with browser boundaries, permissions, provenance, and model-safety controls.',
    nextTrackIds: ['distributed-systems-reliability', 'transformers-llm-systems'],
    modules: [
      {
        title: 'Browser and App Boundaries',
        goal: 'Defend the places where untrusted content meets application authority.',
        topicIds: ['url-origin-parser-case-study', 'content-security-policy-nonce-hash-case-study', 'cors-preflight-cache-case-study', 'trusted-types-dom-xss-sink-case-study', 'fetch-metadata-request-gate-case-study', 'samesite-cookie-csrf-case-study'],
      },
      {
        title: 'Integrity and Provenance',
        goal: 'Learn how systems prove what happened and what artifact can be trusted.',
        topicIds: ['merkle-tree', 'transparency-log-witnessing-case-study', 'software-supply-chain-provenance-graph', 'slsa-build-source-trust-ladder', 'tuf-update-metadata-case-study', 'sigstore-keyless-signing-transparency'],
      },
      {
        title: 'Identity, Policy, and Capabilities',
        goal: 'Separate identity from authorization and model authority as something that can be attenuated.',
        topicIds: ['oauth-pkce-token-lifecycle-case-study', 'webauthn-passkey-credential-flow-case-study', 'capability-security-attenuation', 'zanzibar-authorization-case-study', 'opa-rego-policy-decision-graph', 'agent-tool-permission-lattice'],
      },
      {
        title: 'AI Risk and Guardrails',
        goal: 'Treat model misuse and model failure as systems risks with tests, ledgers, and controls.',
        topicIds: ['adversarial-examples', 'prompt-injection-threat-model', 'llm-guardrail-policy-engine', 'ai-audit-evidence-packet-case-study', 'llm-red-team-attack-taxonomy-queue-case-study', 'ai-safety-eval-slice-risk-register-case-study'],
      },
    ],
  },
];

export const domainGuides = {
  'Data Structures': {
    summary: 'Memory layouts, indexes, queues, trees, graphs, filters, sketches, and text structures.',
    useWhen: 'Use this domain when the question is how data should be arranged to make operations cheap.',
    starterTopicIds: ['linked-list', 'hash-table', 'binary-search-tree', 'graph-bfs'],
  },
  Sorting: {
    summary: 'Classic ordering algorithms and the tradeoffs behind comparison cost, stability, and partitioning.',
    useWhen: 'Use this domain when order is the primitive that unlocks faster search or grouping.',
    starterTopicIds: ['bubble-sort', 'merge-sort', 'quick-sort', 'heap-sort'],
  },
  Searching: {
    summary: 'Direct lookup patterns before the data becomes a tree, graph, index, or vector store.',
    useWhen: 'Use this domain when you need the simplest contrast between scanning and cutting the search space.',
    starterTopicIds: ['linear-search', 'binary-search'],
  },
  Algorithms: {
    summary: 'General-purpose techniques for geometry, dynamic programming, exact cover, and path planning.',
    useWhen: 'Use this domain when the reusable idea is the procedure rather than the container.',
    starterTopicIds: ['convex-hull-monotone-chain', 'sweep-line-segment-intersection', 'delaunay-triangulation-voronoi-dual', 'a-star'],
  },
  Concepts: {
    summary: 'The mental models underneath many systems: recursion, Big-O, finite states, parsing, statistics, and causality.',
    useWhen: 'Use this domain when several concrete topics keep pointing at the same abstract idea.',
    starterTopicIds: ['recursion', 'big-o-growth', 'finite-state-machine', 'causal-graphs'],
  },
  Systems: {
    summary: 'Production software behavior: databases, queues, browsers, kernels, networking, observability, serving, and reliability.',
    useWhen: 'Use this domain when machines, networks, caches, logs, or operational control planes shape the answer.',
    starterTopicIds: ['lru-cache', 'database-indexing', 'raft-log-replication', 'distributed-tracing'],
  },
  Security: {
    summary: 'Boundaries, proofs, policies, crypto systems, browser security, supply chain trust, and agent authority.',
    useWhen: 'Use this domain when a wrong answer becomes unauthorized access, tampering, exfiltration, or unverifiable provenance.',
    starterTopicIds: ['capability-security-attenuation', 'content-security-policy-nonce-hash-case-study', 'software-supply-chain-provenance-graph', 'prompt-injection-threat-model'],
  },
  'AI & ML': {
    summary: 'Vectors, optimization, model families, evaluation, retrieval, agents, and modern model operations.',
    useWhen: 'Use this domain when behavior is learned from data or controlled by probabilistic model outputs.',
    starterTopicIds: ['embeddings-similarity', 'gradient-descent', 'attention', 'rag-pipeline'],
  },
  Papers: {
    summary: 'Influential papers and systems case studies translated into the same step-by-step visual grammar.',
    useWhen: 'Use this domain when you want the original architecture idea, not just the local implementation pattern.',
    starterTopicIds: ['mapreduce-case-study', 'spanner-case-study', 'flashattention-case-study', 'dapper-tracing-case-study'],
  },
};

export function trackTopicIds(track) {
  return track.modules.flatMap((module) => module.topicIds);
}

export function uniqueTrackTopicIds(track) {
  return [...new Set(trackTopicIds(track))];
}

export function getTrackById(id) {
  return learningTracks.find((track) => track.id === id) ?? null;
}

export function getTopicTrackPlacements(topicId) {
  const placements = [];
  for (const track of learningTracks) {
    let absoluteIndex = 0;
    const flatIds = trackTopicIds(track);
    for (const module of track.modules) {
      const localIndex = module.topicIds.indexOf(topicId);
      if (localIndex !== -1) {
        placements.push({
          track,
          module,
          moduleIndex: track.modules.indexOf(module),
          localIndex,
          absoluteIndex: absoluteIndex + localIndex,
          total: flatIds.length,
          previousId: flatIds[absoluteIndex + localIndex - 1] ?? null,
          nextId: flatIds[absoluteIndex + localIndex + 1] ?? null,
        });
      }
      absoluteIndex += module.topicIds.length;
    }
  }
  return placements;
}

export function searchTracks(rawQuery) {
  const query = String(rawQuery ?? '').trim().toLowerCase();
  if (!query) return [];
  const words = query.split(/\s+/);
  return learningTracks.filter((track) => {
    const haystack = [
      track.title,
      track.shortTitle,
      track.level,
      track.audience,
      track.summary,
      track.outcome,
      track.useWhen,
      track.capstone,
      ...track.modules.flatMap((module) => [module.title, module.goal, ...module.topicIds]),
    ].join(' ').toLowerCase();
    return words.every((word) => haystack.includes(word));
  });
}
