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
      heading: 'What it is',
      paragraphs: [
        'A semantic cache for LLMs stores prompts, embeddings, responses, and metadata so a future prompt can reuse an answer when it is meaningfully similar. The key move is replacing exact string equality with vector similarity. "How do I reset my password?" and "I forgot my password" may be different strings but the same support intent, so the application can sometimes answer from cache without calling the LLM.',
        'The cache is not just a performance trick. It is an application-level data structure: an embedding function, an approximate nearest-neighbor index such as HNSW, a response store, freshness metadata, admission and eviction rules, and safety gates. RedisVL describes semantic caching as combining Redis caching with vector search to store responses from previously answered questions: https://redis.io/docs/latest/develop/ai/redisvl/0.6.0/user_guide/llmcache/. GPTCache describes the same motivation for LLM applications in its open-source project: https://github.com/zilliztech/gptcache.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'On a request, the application normalizes the prompt, creates an embedding, and searches the cache index for nearby prior prompts. If the nearest candidate is above the similarity threshold, the system checks metadata before returning the cached answer. Useful metadata includes tenant, model id, system prompt version, tool permissions, retrieval corpus version, TTL, answer type, and policy labels.',
        'On a miss, the request goes to the LLM. The response may then be stored with its prompt embedding and metadata. Admission should be selective. A deterministic FAQ answer is cacheable. A personalized legal, medical, financial, or permissioned tool response may not be. The cache can use ordinary policies such as LRU, W-TinyLFU, TTL, byte-size limits, and invalidation hooks, but vector distance adds a second policy surface.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost equation compares embedding plus vector search against an LLM call. Semantic caching is attractive when many prompts are paraphrases, answers are stable, and the LLM call is expensive or slow. It is weaker when prompts are unique, context changes quickly, or the embedding/search overhead is close to the model-call cost. The GPT Semantic Cache paper reports large reductions in API calls on evaluated chatbot categories, but production systems still need domain-specific evaluation: https://arxiv.org/abs/2411.05276.',
        'The similarity threshold is the core tuning knob. A lower threshold increases hit rate and cost savings, but raises false-hit risk. A higher threshold protects correctness but may leave most savings on the table. Offline replay should measure hit rate, false-hit rate, user-visible latency, answer quality, and stale-answer incidents separately. One number is not enough.',
      ],
    },
    {
      heading: 'Real-world case study',
      paragraphs: [
        'A support chatbot is the cleanest fit. Users repeatedly ask the same few intents with different wording. A semantic cache can store canonical answers for password reset, shipping windows, refund status wording, and setup instructions. The vector index recovers paraphrases, while metadata gates prevent unsafe reuse across tenants, product versions, or policy versions.',
        'LangChain and Redis integrations show the practical shape: prompts are embedded, vector similarity finds candidate responses, and a score or distance threshold controls reuse. LangChain documents cache integrations for LLM calls at https://docs.langchain.com/oss/javascript/integrations/llm_caching, and RedisVL exposes distance-threshold checks in its LLM cache API at https://docs.redisvl.com/en/stable/api/cache.html.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not confuse semantic caching with prefix caching. Prefix caching and RadixAttention reuse KV state for shared prompt prefixes inside the inference runtime. Prompt Cache-Key Canonicalization Ledger explains the exact identity fields that make those prefix hits safe. Semantic caching reuses whole application answers by approximate meaning. They can stack, but they solve different problems.',
        'Do not let a close vector distance bypass authorization, freshness, or the current system prompt. A cached answer produced for one user, tool permission, corpus snapshot, or model version may be wrong for another. This is especially dangerous in RAG systems because retrieved evidence changes. Cache records should include the retrieval corpus version or evidence digest, not just the user question.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: RedisVL Semantic Caching for LLMs at https://redis.io/docs/latest/develop/ai/redisvl/0.6.0/user_guide/llmcache/, RedisVL cache API at https://docs.redisvl.com/en/stable/api/cache.html, GPTCache on GitHub at https://github.com/zilliztech/gptcache, GPTCache paper page at https://aclanthology.org/2023.nlposs-1.24/, GPT Semantic Cache at https://arxiv.org/abs/2411.05276, and MeanCache at https://arxiv.org/abs/2403.02694. Study Embeddings & Similarity, HNSW, LRU Cache, W-TinyLFU Cache Admission, Cache Invalidation & Versioning, RAG Pipeline, Agent Memory & Context Engineering Case Study, LLM Response Cache Safety Ledger, Prompt Cache-Key Canonicalization Ledger, Prefix Caching & RadixAttention, LLM Inference Cost Stack, LLM Inference Scaling Playbook, and On-Device LLM Inference Cost Crossover next.',
      ],
    },
  ],
};
