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
  const pipelineStages = ['prompt', 'embed', 'index', 'gate', 'hit', 'llm', 'store'];
  const stageCount = 7;
  const gateChecks = ['distance', 'tenant', 'model name', 'system-prompt digest', 'corpus version', 'tool permissions', 'TTL'];
  const gateCheckCount = 7;
  const cacheRecordFields = ['query vector', 'answer', 'metadata', 'policy'];
  const fieldCount = 4;

  yield {
    state: pipelineGraph('A semantic cache is a vector index in front of the LLM'),
    highlight: { active: ['prompt', 'embed', 'index', 'e-prompt-embed', 'e-embed-index'], compare: ['llm'], found: ['hit'] },
    explanation: `An exact cache asks whether the prompt string is identical. A semantic cache embeds the new prompt, searches prior prompt embeddings, and asks whether the nearest cached answer is close enough to reuse. The pipeline has ${stageCount} stages: ${pipelineStages.join(' → ')}.`,
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
    explanation: `The win is near-duplicate wording. The danger is semantic overreach: a similar-looking prompt may require different permissions, fresher data, or a different tool context. The gate enforces ${gateCheckCount} checks before any hit is returned.`,
    invariant: `Similarity is only a candidate; the ${pipelineStages[3]} decides whether reuse is allowed.`,
  };

  yield {
    state: pipelineGraph('A hit still needs metadata checks'),
    highlight: { active: ['index', 'gate', 'e-index-gate'], found: ['hit'], removed: ['llm'] },
    explanation: `The gate checks ${gateChecks.join(', ')}, and any domain-specific freshness rule — ${gateCheckCount} checks in total before returning a cached answer.`,
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
    explanation: `The data structure is not just a vector index. Each cache record holds ${fieldCount} fields — ${cacheRecordFields.join(', ')} — combining a vector index with an ordinary cache record, policy metadata, and an invalidation contract.`,
  };
}

function* thresholdAndGates() {
  const thresholdMin = 0.70;
  const thresholdMax = 0.99;
  const gateCount = 5;
  const cacheTypes = ['semantic cache', 'prefix/KV cache', 'RAG result cache', 'exact cache'];
  const cacheTypeCount = 4;
  const boundaryRisks = ['data leak', 'format drift', 'stale answer', 'forbidden action'];

  yield {
    state: plotState({
      axes: { x: { label: 'similarity threshold', min: 0.70, max: 0.99 }, y: { label: 'rate', min: 0, max: 1.0 } },
      series: [
        { id: 'hit', label: 'hit rate', points: [{ x: 0.70, y: 0.82 }, { x: 0.78, y: 0.70 }, { x: 0.86, y: 0.51 }, { x: 0.92, y: 0.34 }, { x: 0.99, y: 0.05 }] },
        { id: 'safe', label: 'safe precision', points: [{ x: 0.70, y: 0.72 }, { x: 0.78, y: 0.83 }, { x: 0.86, y: 0.92 }, { x: 0.92, y: 0.97 }, { x: 0.99, y: 0.995 }] },
      ],
    }),
    highlight: { active: ['safe'], compare: ['hit'] },
    explanation: `Lower thresholds (toward ${thresholdMin}) save more calls but increase false hits. Higher thresholds (toward ${thresholdMax}) are safer but may erase the savings. The threshold is a product and risk decision, not a magic constant.`,
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
    explanation: `Most production mistakes are not ANN mistakes. They are boundary mistakes — ${boundaryRisks.join(', ')} — from sharing across tenants, reusing stale RAG answers, or replaying an answer produced under a different system prompt. All ${gateCount} gate checks must pass.`,
    invariant: `Never let vector distance override authorization, freshness, or prompt contract. Each of the ${gateCount} gates exists to block a specific boundary failure.`,
  };

  yield {
    state: pipelineGraph('Misses are useful training data'),
    highlight: { active: ['llm', 'store', 'e-gate-llm', 'e-llm-store'], compare: ['gate'], found: ['index'] },
    explanation: `A miss calls the model and then stores a new record if the response is cacheable. Some responses should not be cached: personalized decisions, rapidly changing facts, secrets, and tool outputs with narrow permissions. A well-tuned threshold (between ${thresholdMin} and ${thresholdMax}) keeps miss volume manageable.`,
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
    explanation: `These ${cacheTypeCount} cache types — ${cacheTypes.join(', ')} — live at different layers. Semantic caching skips a whole LLM call. Prefix caching reuses model state inside inference. RAG result caching reuses retrieval work. Exact caching is safest but misses paraphrases.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'The animation shows a request entering a cache before an LLM call. LLM means large language model; a semantic cache tries to reuse an old answer when a new prompt has the same intent in different words.',
        {type: 'image', src: './assets/gifs/semantic-cache-llm.gif', alt: 'Animated walkthrough of the semantic cache llm visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'Active state marks embedding and nearest-neighbor lookup, found state marks a candidate cached answer, and compare state marks policy gates. The safe inference is: vector similarity may propose a hit, but metadata gates decide whether reuse is allowed.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'LLM applications often pay repeatedly for the same intent. One user asks how to reset a password; another says they forgot their password, and the safe answer may be identical.',
        {type: 'callout', text: 'A semantic cache is safe only when approximate similarity proposes candidates and exact metadata gates decide reuse.'},
        'An exact string cache misses paraphrases, causing extra latency, token spend, and model load. A semantic cache exists to recover some of those paraphrase hits without treating wording as the cache key.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious cache is a key-value cache. Hash the normalized prompt, model name, system prompt, tool set, and retrieval version, then return the stored response on an exact key match.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d0/Hash_table_5_0_1_1_1_1_1_LL.svg/3840px-Hash_table_5_0_1_1_1_1_1_LL.svg.png', alt: 'Hash table diagram mapping keys into buckets with collision chains', caption: 'Exact caching starts as key lookup: identical keys hit, paraphrases miss. Source: Wikimedia Commons, Jorge Stolfi, CC BY-SA 3.0.'},
        'This is safe when the key captures the full contract. It works for retries, batch jobs, deterministic FAQ flows, and repeated API calls with identical inputs.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is natural language variation. Users ask the same intent with different words, order, politeness, and context, so exact keys have high precision but low recall.',
        'Trusting vector distance alone creates the opposite problem. A nearby prompt can cross tenants, permissions, freshness boundaries, prompt versions, output schemas, or tool contracts.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Separate candidate generation from reuse authority. The vector index answers which previous prompts are close; the policy gate answers whether a candidate may be reused now.',
        'The invariant is that similarity cannot override authorization, freshness, or prompt contract. A reusable record must pass distance threshold, tenant boundary, permissions, model version, system-prompt digest, retrieval corpus version, TTL, and domain rules.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The application embeds the incoming prompt with an embedding model, then queries an approximate nearest-neighbor index such as HNSW, IVF, or managed vector search. The index returns candidate cache records with distances or similarity scores.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with nodes connected by arrows', caption: 'Graph-style neighbor search is a useful mental model for ANN indexes: find nearby candidates first, then let policy decide whether any candidate can be reused. Source: Wikimedia Commons, David W., public domain.'},
        'The gate checks exact metadata. If distance, tenant, permission, model, prompt, tool, schema, corpus, safety, and TTL conditions all pass, the cached answer returns without an LLM call.',
        'On a miss, the system calls the normal LLM path and stores the new answer only if admission rules allow it. Normal cache mechanics still matter: eviction, invalidation, audit logs, byte limits, and replay tests.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works when embedding geometry clusters prompts whose safe answers are interchangeable in the application domain. Password-reset paraphrases can share a public documentation answer because the policy and source are stable.',
        'The correctness argument is two-stage filtering. Approximate nearest-neighbor search provides recall over paraphrases, while exact gates provide precision over boundaries that vectors do not understand.',
        'If either stage is missing, the cache fails differently. Without vectors, paraphrases miss; without gates, unsafe or stale hits can pass.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The semantic cache adds embedding cost, vector lookup, metadata filtering, serialization, storage, and monitoring. It is worth it only when the saved model call is more expensive than those steps.',
        'Thresholds control behavior. Lower thresholds raise hit rate and false-hit risk; higher thresholds protect precision but may erase most savings.',
        'Invalidation is the hard cost. Product docs, retrieval corpora, tool permissions, model versions, prompt templates, and policies can change, so each must appear in metadata or the cache may serve old answers under a new contract.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Semantic caches fit stable, repetitive, high-volume flows such as support bots, internal help desks, documentation Q&A, onboarding assistants, and low-risk summarization templates. The workload should contain many paraphrases of a smaller set of intents.',
        'They also fit cost-control stacks. A system can check exact cache, semantic cache, retrieval cache, and then choose a small or large model based on risk.',
        'Good deployments record why a hit was allowed: candidate id, distance, threshold, metadata versions, gate results, source provenance, and admission policy.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when prompts are unique, long-tail, personalized, or tied to live state. Current prices, account balances, private documents, and tool results usually should not be reused from semantic similarity alone.',
        'It is dangerous across security boundaries. Cross-tenant, cross-permission, cross-corpus, cross-model, and cross-system-prompt reuse are policy failures, not vector-index failures.',
        'It can also fail operationally. Embedding models change, ANN recall is approximate, stale records become popular, and eviction may remove exactly the stable answers that made the cache useful.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A support bot receives 10,000 daily password-reset questions. Suppose exact caching hits 500 repeated prompts, while semantic caching finds another 3,000 paraphrases at a safe threshold.',
        'If an LLM call costs 800 ms and the semantic lookup costs 40 ms, each safe semantic hit saves about 760 ms of model latency. Across 3,000 hits, that is about 38 minutes of aggregate waiting removed per day.',
        'Now add a tenant gate. If 50 nearby candidates belong to another tenant, all 50 must miss even when their vectors are close, because reuse would leak or misapply private context.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary implementation references include RedisVL semantic cache documentation at https://redis.io/docs/latest/develop/ai/redisvl/user_guide/llmcache/ and GPTCache at https://github.com/zilliztech/gptcache. Related papers include GPTCache at https://aclanthology.org/2023.nlposs-1.24/, GPT Semantic Cache at https://arxiv.org/abs/2411.05276, and MeanCache at https://arxiv.org/abs/2403.02694.',
        'Study embeddings, cosine similarity, HNSW, approximate nearest-neighbor indexing, LRU, W-TinyLFU, TTL caches, RAG pipelines, prompt cache keys, prefix caching, RadixAttention, and LLM inference cost models.',
      ],
    },
  ],
};
