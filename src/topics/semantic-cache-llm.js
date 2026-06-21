// Semantic caching for LLM applications: use embeddings and vector search to
// reuse answers when a new prompt is meaningfully close to a safe cached prompt.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'semantic-cache-llm',
  title: 'Semantic Cache for LLMs',
  category: 'Systems',
  summary: 'Cache LLM responses by meaning instead of exact prompt text, using embeddings, vector search, thresholds, and freshness gates.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['semantic hit path', 'threshold and gates'], defaultValue: 'semantic hit path' },
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

function pipelineGraph(title) {
  return graphState({
    nodes: [
      { id: 'prompt', label: 'prompt', x: 0.8, y: 3.2, note: 'new ask' },
      { id: 'embed', label: 'embed', x: 2.5, y: 3.2, note: 'vector' },
      { id: 'index', label: 'ANN', x: 4.2, y: 3.2, note: 'similar' },
      { id: 'gate', label: 'gate', x: 5.9, y: 3.2, note: 'safe?' },
      { id: 'hit', label: 'hit', x: 7.6, y: 4.15, note: 'reuse' },
      { id: 'llm', label: 'LLM', x: 7.6, y: 2.25, note: 'miss' },
      { id: 'store', label: 'store', x: 9.2, y: 2.25, note: 'answer' },
    ],
    edges: [
      { id: 'e-prompt-embed', from: 'prompt', to: 'embed' },
      { id: 'e-embed-index', from: 'embed', to: 'index' },
      { id: 'e-index-gate', from: 'index', to: 'gate' },
      { id: 'e-gate-hit', from: 'gate', to: 'hit', weight: 'pass' },
      { id: 'e-gate-llm', from: 'gate', to: 'llm', weight: 'miss' },
      { id: 'e-llm-store', from: 'llm', to: 'store' },
    ],
  }, { title });
}

function* semanticHitPath() {
  yield {
    state: pipelineGraph('A semantic cache is a vector index in front of the LLM'),
    highlight: { active: ['prompt', 'embed', 'index', 'e-prompt-embed', 'e-embed-index'], compare: ['llm'], found: ['hit'] },
    explanation: 'An exact cache asks whether the prompt string is identical. A semantic cache embeds the new prompt, searches prior prompt embeddings, and asks whether the nearest cached answer is close enough to reuse.',
  };

  yield {
    state: labelMatrix(
      'Exact cache versus semantic cache',
      [
        { id: 'p0', label: 'reset password?' },
        { id: 'p1', label: 'forgot password' },
        { id: 'p2', label: 'refund status' },
        { id: 'p3', label: 'reset admin pwd' },
      ],
      [
        { id: 'exact', label: 'exact' },
        { id: 'semantic', label: 'semantic' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['hit', 'hit', 'low'],
        ['miss', 'hit', 'low'],
        ['miss', 'miss', 'topic drift'],
        ['miss', 'gate', 'permissions'],
      ],
    ),
    highlight: { active: ['p1:semantic'], compare: ['p1:exact'], removed: ['p3:risk'] },
    explanation: 'The win is near-duplicate wording. The danger is semantic overreach: a similar-looking prompt may require different permissions, fresher data, or a different tool context.',
    invariant: 'Similarity is only a candidate; policy decides whether reuse is allowed.',
  };

  yield {
    state: pipelineGraph('A hit still needs metadata checks'),
    highlight: { active: ['index', 'gate', 'e-index-gate'], found: ['hit'], removed: ['llm'] },
    explanation: 'The gate checks distance, tenant, model name, system-prompt digest, retrieval corpus version, tool permissions, TTL, and any domain-specific freshness rule before returning a cached answer.',
  };

  yield {
    state: labelMatrix(
      'Cache record shape',
      [
        { id: 'vector', label: 'query vector' },
        { id: 'answer', label: 'answer' },
        { id: 'meta', label: 'metadata' },
        { id: 'policy', label: 'policy' },
      ],
      [
        { id: 'data', label: 'stored data' },
        { id: 'why', label: 'why it matters' },
      ],
      [
        ['embedding', 'nearest-neighbor search'],
        ['text/tool result', 'what may be reused'],
        ['model, tenant, data version', 'validity boundary'],
        ['ttl, threshold, hit count', 'admission and eviction'],
      ],
    ),
    highlight: { active: ['vector:data', 'meta:data', 'policy:data'], found: ['answer:why'] },
    explanation: 'The data structure is not just a vector index. It is a vector index plus an ordinary cache record, policy metadata, and an invalidation contract.',
  };
}

function* thresholdAndGates() {
  yield {
    state: plotState({
      axes: { x: { label: 'similarity threshold', min: 0.70, max: 0.99 }, y: { label: 'rate', min: 0, max: 1.0 } },
      series: [
        { id: 'hit', label: 'hit rate', points: [{ x: 0.70, y: 0.82 }, { x: 0.78, y: 0.70 }, { x: 0.86, y: 0.51 }, { x: 0.92, y: 0.34 }, { x: 0.99, y: 0.05 }] },
        { id: 'safe', label: 'safe precision', points: [{ x: 0.70, y: 0.72 }, { x: 0.78, y: 0.83 }, { x: 0.86, y: 0.92 }, { x: 0.92, y: 0.97 }, { x: 0.99, y: 0.995 }] },
      ],
    }),
    highlight: { active: ['safe'], compare: ['hit'] },
    explanation: 'Lower thresholds save more calls but increase false hits. Higher thresholds are safer but may erase the savings. The threshold is a product and risk decision, not a magic constant.',
  };

  yield {
    state: labelMatrix(
      'Gate checklist',
      [
        { id: 'dist', label: 'distance' },
        { id: 'tenant', label: 'tenant' },
        { id: 'model', label: 'model' },
        { id: 'data', label: 'data version' },
        { id: 'tools', label: 'tools' },
      ],
      [
        { id: 'pass', label: 'pass rule' },
        { id: 'bad', label: 'bad hit if ignored' },
      ],
      [
        ['above threshold', 'wrong intent'],
        ['same boundary', 'data leak'],
        ['same behavior', 'format drift'],
        ['fresh corpus', 'stale answer'],
        ['same permission', 'forbidden action'],
      ],
    ),
    highlight: { active: ['tenant:bad', 'data:bad', 'tools:bad'], found: ['dist:pass'] },
    explanation: 'Most production mistakes are not ANN mistakes. They are boundary mistakes: sharing across tenants, reusing stale RAG answers, or replaying an answer produced under a different system prompt.',
    invariant: 'Never let vector distance override authorization, freshness, or prompt contract.',
  };

  yield {
    state: pipelineGraph('Misses are useful training data'),
    highlight: { active: ['llm', 'store', 'e-gate-llm', 'e-llm-store'], compare: ['gate'], found: ['index'] },
    explanation: 'A miss calls the model and then stores a new record if the response is cacheable. Some responses should not be cached: personalized decisions, rapidly changing facts, secrets, and tool outputs with narrow permissions.',
  };

  yield {
    state: labelMatrix(
      'Semantic cache versus prefix cache',
      [
        { id: 'semantic', label: 'semantic cache' },
        { id: 'prefix', label: 'prefix/KV cache' },
        { id: 'rag', label: 'RAG result cache' },
        { id: 'exact', label: 'exact cache' },
      ],
      [
        { id: 'key', label: 'key' },
        { id: 'stores', label: 'stores' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['embedding similarity', 'answer', 'false hit'],
        ['shared prompt prefix', 'KV state', 'stale prompt state'],
        ['query + corpus version', 'retrieval set', 'stale corpus'],
        ['string hash', 'answer', 'low recall'],
      ],
    ),
    highlight: { active: ['semantic:key', 'prefix:stores', 'rag:risk'], compare: ['exact:risk'] },
    explanation: 'These caches live at different layers. Semantic caching skips a whole LLM call. Prefix caching reuses model state inside inference. RAG result caching reuses retrieval work. Exact caching is safest but misses paraphrases.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'semantic hit path') yield* semanticHitPath();
  else if (view === 'threshold and gates') yield* thresholdAndGates();
  else throw new InputError('Pick a semantic cache view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        `LLM applications often pay repeatedly for the same intent. One user asks, "How do I reset my password?" Another asks, "I forgot my password. What should I do?" An exact string cache misses the second prompt even when the safe answer is identical. The result is extra latency, extra model cost, and extra load on a system that already has expensive tail behavior.`,
        `A semantic cache exists to recover those paraphrase hits. It embeds the incoming prompt, searches a vector index of previous prompts or prompt-response records, and reuses an answer only when the nearest candidate passes similarity and policy gates. RedisVL's SemanticCache documentation describes the same goal: use semantic similarity to retrieve cached responses instead of making redundant LLM calls.`,
        {type: `callout`, text: `A semantic cache is safe only when approximate similarity proposes candidates and exact metadata gates decide reuse.`},
        `This is an application-level cache, not a transformer runtime cache. It stores prompts, embeddings, responses, metadata, admission decisions, eviction rules, TTLs, and invalidation contracts. It can skip a whole model call. It can also return a confident wrong answer if the cache treats approximate similarity as proof of equivalence.`,
      ],
    },
    {
      heading: 'The obvious approach and the wall',
      paragraphs: [
        `The obvious first cache is an exact key-value cache. Hash the normalized prompt, model name, system prompt, and maybe a retrieval version. If the same request arrives again, return the stored answer. This is safe when the cache key captures the full contract, and it is useful for repeated API calls, retries, batch jobs, and deterministic FAQ flows.`,
        {type: `image`, src: `https://upload.wikimedia.org/wikipedia/commons/thumb/d/d0/Hash_table_5_0_1_1_1_1_1_LL.svg/3840px-Hash_table_5_0_1_1_1_1_1_LL.svg.png`, alt: `Hash table diagram mapping keys into buckets with collision chains`, caption: `Exact caching starts as key lookup: identical keys hit, paraphrases miss. Source: Wikimedia Commons, Jorge Stolfi, CC BY-SA 3.0.`},
        `The wall is wording. Natural-language users do not repeat the exact same bytes. They use synonyms, change word order, add politeness, or ask the same support question with a different sentence. Exact caching has high precision and low recall. It avoids many false hits, but it leaves most paraphrase savings unused.`,
        `A tempting second attempt is to trust vector distance alone. That is the dangerous wall on the other side. Similarity can find candidates, but it cannot decide tenant boundaries, permissions, freshness, tool access, system-prompt versions, or whether the answer type is cacheable. A nearby vector can still be the wrong answer for the user in front of the system.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `The core insight is to treat semantic similarity as candidate generation, then make policy decide reuse. The vector index answers, "Which stored prompt is close to this prompt?" The gate answers, "Is it allowed to reuse this stored answer for this request now?" Keeping those questions separate is the difference between a useful cache and a production incident.`,
        `The invariant is simple: vector distance cannot override authorization, freshness, or prompt contract. A record can be reused only if the candidate is close enough and the metadata still matches the application boundary. That metadata may include tenant, user role, model id, system prompt digest, tool permissions, retrieval corpus version, locale, answer schema, safety label, timestamp, and TTL.`,
        `The cache entry is therefore richer than an embedding. It is a vector-search key plus an ordinary cache record plus policy fields. GPTCache's project documentation calls out false positives and false negatives as semantic-cache realities. That is the right mental model: semantic caching is approximate retrieval wrapped in exact safety checks.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `A request enters the semantic cache before the expensive model call. The application normalizes fields that are meant to be semantic, embeds the prompt with a chosen embedding model, and queries an approximate nearest-neighbor index such as HNSW, IVF, or a managed vector-search backend. The index returns candidate records with distances or similarities.`,
        {type: `image`, src: `https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg`, alt: `Directed graph with nodes connected by arrows`, caption: `Graph-style neighbor search is a useful mental model for ANN indexes: find nearby candidates first, then let policy decide whether any candidate can be reused. Source: Wikimedia Commons, David W., public domain.`},
        `The gate then applies exact checks. Distance must pass the threshold. Tenant and permission boundaries must match. The model behavior must be compatible. The system prompt, tool set, output schema, and retrieval corpus version must match the stored answer's assumptions. The record must not be expired. Domain rules may reject personalized decisions, regulated advice, secrets, or tool results that depended on short-lived state.`,
        `On a safe hit, the cached answer returns without calling the LLM. On a miss, the request follows the normal LLM path. The resulting answer is stored only if admission rules allow it. Normal cache mechanics still matter: TTL, byte limits, eviction policy, hit counters, negative caching, audit logs, and invalidation hooks. Semantic search changes the lookup; it does not remove cache engineering.`,
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        `The semantic-hit path proves that the vector index is not the cache by itself. The prompt becomes an embedding, the embedding finds a neighbor, and only then does the policy gate decide hit or miss. The gate is where correctness lives. Without it, a vector index can cross tenants, stale corpora, tool permissions, or system prompts because those boundaries are not geometry.`,
        `The threshold plot proves the product tradeoff. Lower thresholds increase hit rate and cost savings, but they also admit more false hits. Higher thresholds increase safe precision, but they may erase most savings. RedisVL exposes a distance threshold as an explicit parameter, which matches the lesson: the threshold is a risk control, not a universal constant.`,
        `The cache comparison proves the layer boundary. Exact response caching uses string or structured keys. Semantic caching reuses whole answers by approximate meaning. RAG result caching reuses retrieval sets or context assembly. Prefix or KV caching reuses model state for shared token prefixes. These can stack, but a bug in one layer should not be hidden by another.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `Semantic caching works when embedding geometry groups prompts whose safe answers are interchangeable for the application's domain. In a support FAQ, "reset password" and "forgot password" can map to the same answer because the underlying intent, policy, and source knowledge are stable. The vector index recovers that cluster even when surface wording changes.`,
        `The correctness argument is a two-stage filter. Approximate nearest-neighbor search provides recall: it proposes records worth checking. Exact gates provide precision over non-semantic boundaries: identity, permissions, data versions, prompt contracts, and time. If either stage is missing, the cache is wrong in a different way. With no vector stage, paraphrases miss. With no exact gate, unsafe hits pass.`,
        `Evaluation must measure the same two-stage behavior. Hit rate alone is not enough. A cache that returns many answers can still harm users if false hits are high. A cache with perfect safety may be useless if embedding and ANN overhead consume the saved latency. Useful metrics include hit rate, false-hit rate, stale-hit rate, answer quality deltas, p50 and p95 latency, model-call reduction, token cost reduction, and incident classes by rejected gate.`,
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        `The cache adds an embedding call or local embedding computation, ANN lookup, metadata filtering, serialization, and cache storage. If the model call is cheap, short, or local, the semantic cache may cost more than it saves. If the model call is expensive and the intent distribution is repetitive, the cache can reduce both latency and spend.`,
        `Threshold choice is a business and safety decision. A customer-support bot for public documentation can use a lower threshold than a system that answers account-specific billing questions or invokes tools. Some teams use multiple thresholds: one for automatic reuse, one for "suggest answer to agent," and one for guaranteed miss. Domain-specific replay sets are better than guessing.`,
        `Invalidation is harder than lookup. A cached answer may become stale when product docs change, a retrieval corpus is reindexed, a tool permission changes, a policy changes, a model is upgraded, or a prompt template is edited. Exact cache keys fail closed when a version field changes. Semantic caches need the same version fields in metadata gates or they will serve old answers to new contracts.`,
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        `Semantic caching wins in stable, repetitive, high-volume flows: support bots, internal help desks, documentation Q&A, onboarding assistants, coding assistants over fixed policies, and low-risk summarization templates. The workload should have many paraphrases of a smaller set of intents, and the answer should not depend on rapidly changing private state.`,
        `It also works as a cost-control layer for fallback models. A product may check exact cache, semantic cache, retrieval cache, then call a smaller model or larger model depending on risk. The semantic cache is especially useful when it prevents not just generation tokens but also retrieval, reranking, tool calls, and downstream validation.`,
        `A clean production design records why a hit was allowed. Store candidate id, distance, threshold, metadata versions, gate results, and response provenance. That audit trail lets engineers replay misses, investigate false hits, tune thresholds, and decide which answer categories should be admitted or banned from the cache.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `It fails when prompts are unique, long-tail, or context-heavy. If each request includes fresh private data, current market prices, live account state, or a unique document, semantic similarity to an old prompt says little about answer validity. It also fails when the answer depends on exact wording, such as legal disclaimers, safety-sensitive constraints, or tool instructions.`,
        `It is dangerous across boundaries. Cross-tenant reuse can leak data. Cross-permission reuse can reveal forbidden actions. Cross-corpus reuse can serve outdated RAG answers. Cross-model reuse can break output format or policy assumptions. Cross-system-prompt reuse can ignore a changed role or safety contract. These are not ANN problems; they are cache-key and policy failures.`,
        `It can also fail operationally. Embedding models change. Vector indexes need rebuilds. ANN search has recall tradeoffs. Popular bad records can become high-impact false hits. Eviction can remove exactly the stable answers that made the cache valuable if the policy only follows recency. Semantic caches need monitoring, replay evaluation, and conservative admission.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Study embeddings and similarity search first, then HNSW and approximate nearest-neighbor indexing. Then study LRU, W-TinyLFU admission, TTL caches, cache invalidation, RAG pipelines, prompt cache-key canonicalization, prefix caching, RadixAttention, LLM inference cost models, and safety ledgers for tool-using agents.`,
        `Primary sources worth reading are RedisVL's semantic cache guide at https://redis.io/docs/latest/develop/ai/redisvl/user_guide/llmcache/, GPTCache at https://github.com/zilliztech/gptcache, the GPTCache paper page at https://aclanthology.org/2023.nlposs-1.24/, GPT Semantic Cache at https://arxiv.org/abs/2411.05276, and MeanCache at https://arxiv.org/abs/2403.02694.`,
      ],
    },
  ],
};
