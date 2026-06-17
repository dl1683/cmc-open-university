// Source authority triage priority queue: rank, dedupe, and schedule sources
// before they become evidence in a deep research report.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'source-authority-triage-priority-queue-case-study',
  title: 'Source Authority Triage Priority Queue',
  category: 'AI & ML',
  summary: 'Rank research sources by authority, freshness, novelty, access, and risk before spending context or turning them into claims.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['triage queue', 'source budget'], defaultValue: 'triage queue' },
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

function triageGraph(title) {
  return graphState({
    nodes: [
      { id: 'query', label: 'query', x: 0.7, y: 3.8, note: 'need' },
      { id: 'cand', label: 'cands', x: 2.1, y: 3.8, note: 'many' },
      { id: 'dedupe', label: 'dedupe', x: 3.6, y: 2.3, note: 'same' },
      { id: 'auth', label: 'auth', x: 3.6, y: 4.0, note: 'rank' },
      { id: 'fresh', label: 'fresh', x: 3.6, y: 5.7, note: 'date' },
      { id: 'queue', label: 'queue', x: 5.5, y: 3.8, note: 'score' },
      { id: 'read', label: 'read', x: 7.2, y: 2.1, note: 'spans' },
      { id: 'skip', label: 'skip', x: 7.2, y: 5.5, note: 'low' },
      { id: 'ledger', label: 'ledger', x: 9.0, y: 2.9, note: 'claims' },
      { id: 'audit', label: 'audit', x: 9.0, y: 5.0, note: 'why' },
    ],
    edges: [
      { id: 'e-query-cand', from: 'query', to: 'cand' },
      { id: 'e-cand-dedupe', from: 'cand', to: 'dedupe' },
      { id: 'e-cand-auth', from: 'cand', to: 'auth' },
      { id: 'e-cand-fresh', from: 'cand', to: 'fresh' },
      { id: 'e-dedupe-queue', from: 'dedupe', to: 'queue' },
      { id: 'e-auth-queue', from: 'auth', to: 'queue' },
      { id: 'e-fresh-queue', from: 'fresh', to: 'queue' },
      { id: 'e-queue-read', from: 'queue', to: 'read' },
      { id: 'e-queue-skip', from: 'queue', to: 'skip' },
      { id: 'e-read-ledger', from: 'read', to: 'ledger' },
      { id: 'e-skip-audit', from: 'skip', to: 'audit' },
      { id: 'e-ledger-audit', from: 'ledger', to: 'audit' },
    ],
  }, { title });
}

function* triageQueue() {
  yield {
    state: triageGraph('Source triage happens before reading everything'),
    highlight: { active: ['query', 'cand', 'dedupe', 'auth', 'fresh', 'e-query-cand', 'e-cand-dedupe', 'e-cand-auth', 'e-cand-fresh'], found: ['queue'] },
    explanation: 'The naive baseline is to read search results in rank order. A better agent dedupes candidates, separates relevance from authority, checks freshness, and spends context on the sources most likely to change the answer.',
  };

  yield {
    state: labelMatrix(
      'Source feature row',
      [
        { id: 'paper', label: 'paper' },
        { id: 'docs', label: 'docs' },
        { id: 'blog', label: 'blog' },
        { id: 'news', label: 'news' },
        { id: 'forum', label: 'forum' },
        { id: 'filing', label: 'filing' },
      ],
      [
        { id: 'auth', label: 'auth' },
        { id: 'fresh', label: 'fresh' },
        { id: 'novel', label: 'novel' },
        { id: 'risk', label: 'risk' },
        { id: 'act', label: 'act' },
      ],
      [
        ['hi', 'med', 'hi', 'low', 'read'],
        ['hi', 'hi', 'med', 'low', 'read'],
        ['med', 'hi', 'med', 'med', 'skim'],
        ['med', 'hi', 'low', 'med', 'skim'],
        ['low', 'hi', 'hi', 'hi', 'flag'],
        ['hi', 'med', 'hi', 'low', 'read'],
      ],
    ),
    highlight: { active: ['paper:auth', 'docs:act', 'filing:act'], compare: ['forum:risk'], found: ['blog:novel'] },
    explanation: 'The source row stores authority, freshness, novelty, risk, access scope, and the next action. It makes source choice reviewable: why this source was read, why another was skipped, and what kind of claim each source is allowed to support.',
    invariant: 'Source rank is not the same as retrieval rank.',
  };

  yield {
    state: triageGraph('The priority queue feeds the source reader'),
    highlight: { active: ['queue', 'read', 'ledger', 'e-queue-read', 'e-read-ledger'], compare: ['skip'], found: ['audit'] },
    explanation: 'High-value sources enter the reader, which extracts exact spans into the claim ledger. Low-value sources are not silently ignored; their skip reason is stored so later audits can ask whether the queue was biased.',
  };

  yield {
    state: labelMatrix(
      'Use',
      [
        { id: 'primary', label: 'primary' },
        { id: 'official', label: 'official' },
        { id: 'bench', label: 'bench' },
        { id: 'media', label: 'media' },
        { id: 'ugc', label: 'UGC' },
      ],
      [
        { id: 'use', label: 'use' },
        { id: 'guard', label: 'guard' },
      ],
      [
        ['anch', 'scope'],
        ['fact', 'ver'],
        ['number', 'method'],
        ['ctx', 'check'],
        ['lead', 'nocit'],
      ],
    ),
    highlight: { active: ['primary:use', 'official:use', 'bench:guard'], compare: ['media:guard'], removed: ['ugc:use'] },
    explanation: 'Different source classes get different duties. A forum post can reveal a failure mode, but it should not carry a broad factual claim. A benchmark can carry numbers only if method and version survive audit.',
  };
}

function* sourceBudget() {
  yield {
    state: plotState({
      axes: { x: { label: 'sources read', min: 0, max: 60 }, y: { label: 'report value', min: 0, max: 1 } },
      series: [
        { id: 'triage', label: 'triaged', points: [{ x: 5, y: 0.34 }, { x: 10, y: 0.58 }, { x: 20, y: 0.78 }, { x: 35, y: 0.87 }, { x: 60, y: 0.9 }] },
        { id: 'crawl', label: 'raw crawl', points: [{ x: 5, y: 0.26 }, { x: 10, y: 0.38 }, { x: 20, y: 0.48 }, { x: 35, y: 0.54 }, { x: 60, y: 0.57 }] },
      ],
      markers: [
        { id: 'budget', x: 20, y: 0.78, label: 'budget' },
      ],
    }),
    highlight: { active: ['triage', 'budget'], compare: ['crawl'] },
    explanation: 'Triage raises the value per source. Reading twenty carefully selected sources can beat reading sixty near-duplicates if the queue covers primary facts, methods, counterclaims, and current updates.',
  };

  yield {
    state: labelMatrix(
      'Budget slices',
      [
        { id: 'defs', label: 'defs' },
        { id: 'facts', label: 'facts' },
        { id: 'nums', label: 'nums' },
        { id: 'contra', label: 'contra' },
        { id: 'cases', label: 'cases' },
      ],
      [
        { id: 'quota', label: 'quota' },
        { id: 'spent', label: 'spent' },
        { id: 'state', label: 'state' },
      ],
      [
        ['2', '2', 'done'],
        ['5', '4', 'more'],
        ['3', '3', 'done'],
        ['3', '1', 'gap'],
        ['2', '2', 'done'],
      ],
    ),
    highlight: { active: ['defs:state', 'nums:state', 'cases:state'], compare: ['facts:state'], removed: ['contra:state'] },
    explanation: 'Budgeting by report slice prevents one source family from dominating the answer. If counterevidence is under-read, the queue should search for it instead of adding another friendly vendor blog.',
  };

  yield {
    state: triageGraph('Dedupe and novelty prevent source pileups'),
    highlight: { active: ['cand', 'dedupe', 'queue', 'e-cand-dedupe', 'e-dedupe-queue'], compare: ['auth', 'fresh'], found: ['read'] },
    explanation: 'Near-duplicate search hits should collapse into one canonical source cluster. The queue can then prefer the original, most complete, or most current version, and use duplicates only as corroboration.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'queue score', min: 0, max: 1 }, y: { label: 'audit risk', min: 0, max: 1 } },
      series: [
        { id: 'primary', label: 'primary', points: [{ x: 0.2, y: 0.55 }, { x: 0.45, y: 0.34 }, { x: 0.7, y: 0.18 }, { x: 0.9, y: 0.12 }] },
        { id: 'lowauth', label: 'low auth', points: [{ x: 0.2, y: 0.88 }, { x: 0.45, y: 0.72 }, { x: 0.7, y: 0.58 }, { x: 0.9, y: 0.5 }] },
      ],
      markers: [
        { id: 'gate', x: 0.7, y: 0.18, label: 'cite ok' },
      ],
    }),
    highlight: { active: ['primary', 'gate'], compare: ['lowauth'] },
    explanation: 'A high retrieval score does not erase source risk. Relevance decides whether to inspect; authority, freshness, method, and support spans decide whether the source can carry a final claim.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'triage queue') yield* triageQueue();
  else if (view === 'source budget') yield* sourceBudget();
  else throw new InputError('Pick a source-triage view.');
}

export const article = {
  sections: [
    {
      heading: 'Why This Exists',
      paragraphs: [
        'A research system can find more sources than it can read well. Search engines, vector indexes, news feeds, academic databases, and internal corpora all return candidates. The scarce resource is not only web bandwidth. It is attention, context window, citation trust, and the number of claims a final report can support without becoming a pile of weak references.',
        'A source authority triage priority queue sits between retrieval and citation. Retrieval says this item might be relevant. Triage says this item deserves reading now, this one is a duplicate, this one is stale, this one is useful only as a lead, and this one is too risky to quote. The data structure turns source choice into an auditable scheduling problem.',
      ],
    },
    {
      heading: 'The Obvious Approach',
      paragraphs: [
        'The obvious approach is to read search results in retrieval order. The first result feels important because the search engine ranked it highly. The second and third may repeat the same facts in different packaging. The agent keeps reading until the report feels sourced, then cites whatever was easiest to quote.',
        'That approach is not foolish. Retrieval rank often captures relevance. For simple factual questions, the top official page may be enough. The failure appears in deep research: many top results are duplicates, summaries, SEO pages, vendor claims, old versions, or pages that are relevant to the query but not authoritative for the claim the report needs to make.',
      ],
    },
    {
      heading: 'The Wall',
      paragraphs: [
        'The wall is that source rank is not the same as retrieval rank. A forum post can be highly relevant because it names the exact failure mode, but it should not carry a broad factual claim. A vendor benchmark can be relevant and official, but weak for independent performance. A paper can be authoritative for method lineage and stale for current production behavior. A news article can provide context while being too indirect to support technical details.',
        'The second wall is budget shape. If the agent reads ten near-duplicates, it may look busy while learning one fact. If it reads only friendly sources, it may miss counterevidence. If it reads only primary sources, it may miss how the idea fails in practice. Deep research needs coverage across source duties: definitions, primary facts, methods, numbers, current updates, counterclaims, and concrete cases.',
      ],
    },
    {
      heading: 'Core Insight',
      paragraphs: [
        'The useful abstraction is a priority queue of source candidates with decomposable scores and explicit duties. A source is not simply good or bad. It is good for some claims and weak for others. The queue should store authority, freshness, novelty, risk, accessibility, source class, and proposed use. It should also store why a candidate was skipped.',
        'This is a data-structure boundary. A retriever returns candidates. The triage queue schedules reading. A source reader extracts exact spans. A claim ledger attaches spans to claims. A contradiction resolver handles disagreements. When these jobs collapse into one opaque prompt, the final report cannot explain why it trusted one page and ignored another.',
      ],
    },
    {
      heading: 'Mechanism',
      paragraphs: [
        'Each candidate becomes a feature row. The row can include URL, canonical URL, title, publisher, author or organization, source class, publication date, access date, version, retrieval score, novelty cluster, primary-or-secondary role, claim duty, prompt-injection risk, access restrictions, and next action. The point is not to create bureaucracy. The point is to make source selection inspectable.',
        'The priority score should be decomposable. Relevance answers whether the source is worth considering. Authority answers whether it can carry a claim. Freshness answers whether the date is acceptable for the claim type. Novelty answers whether the source adds information beyond already-read material. Risk answers whether the content is unsafe, user-generated, unverifiable, or likely to manipulate the agent.',
        'The queue pops the highest-value source for the current report gap. After reading, the extracted spans enter a claim ledger. Duplicates collapse into clusters so one press release does not occupy five read slots. Skipped sources leave records: duplicate, stale, low authority, inaccessible, out of scope, unsafe, or redundant after stronger evidence. The skip ledger is what makes later audits possible.',
      ],
    },
    {
      heading: 'Visual Proof',
      paragraphs: [
        'The triage view proves that reading everything is not the algorithm. Candidates first pass through dedupe, authority, and freshness checks. Only then do they enter the read queue. The skip path is visible because skipped sources still matter: a report should be able to say which candidates were ignored and why.',
        'The source feature table proves that authority is contextual. Papers, official docs, blogs, news, forums, and filings can all be useful, but not for the same job. A filing can anchor dates and commitments. Official docs can anchor product behavior. A benchmark can support a number only when its method survives audit. User-generated content can reveal a failure mode, but it should usually be treated as a lead rather than final evidence.',
        'The budget view proves why source count is a weak metric. Twenty carefully selected sources can beat sixty near-duplicates if the smaller set covers primary facts, methods, numbers, counterevidence, and current updates. The curve rises when the queue improves value per source, not when the agent reads more pages indiscriminately.',
      ],
    },
    {
      heading: 'Why It Works',
      paragraphs: [
        'The queue works because it preserves distinctions that raw retrieval collapses. Relevance, authority, freshness, novelty, and risk are different axes. A source can score high on one and low on another. Keeping those axes separate lets the research system choose sources by the claim it needs to support rather than by a single attractive rank.',
        'Correctness here means auditability, not mathematical optimality. The queue does not prove that the top source is objectively best. It gives the system a repeatable policy for spending source budget and a record that can be challenged. If the final answer is wrong, the audit can inspect whether the queue overtrusted a source class, missed counterevidence, accepted stale data, or let duplicates crowd out original material.',
      ],
    },
    {
      heading: 'Cost and Tradeoffs',
      paragraphs: [
        'The cost is bookkeeping and latency before reading. Feature extraction, canonicalization, dedupe, risk checks, and scoring all take time. For a simple question, that overhead may be unnecessary. For a high-stakes report, the overhead is cheaper than filling the context window with weak sources and discovering the evidence gap after the conclusion is written.',
        'The scoring policy can also bias the report. Overweighting official sources can miss independent failures. Overweighting freshness can discard stable foundational work. Overweighting novelty can reward speculation. Overweighting low risk can suppress useful counterexamples from messy public forums. The queue should expose weights and duties so the policy can be tuned by report type.',
        'Freshness is claim-dependent. A mathematical proof, protocol definition, or historical paper can remain useful for years. A product feature, pricing claim, regulation, benchmark leaderboard, or executive statement may need live verification. The queue should attach freshness requirements to claim classes instead of treating every old source as bad or every new source as better.',
      ],
    },
    {
      heading: 'Uses and Failure Modes',
      paragraphs: [
        'This structure fits deep research agents, legal and policy review, technical due diligence, benchmark analysis, incident retrospectives, market reports, and any RAG system that must cite evidence rather than merely retrieve context. It is especially useful when the final artifact must explain provenance: where a claim came from, why that source was trusted, and what competing evidence was considered.',
        'It is the wrong tool when source choice is obvious or the task is purely exploratory. A quick lookup of a stable API parameter may not need a full triage queue. A brainstorming session may benefit from messy breadth before scoring. The queue should be activated when source budget, claim support, freshness, or risk matters.',
        'The failure modes are familiar ranking failures. The queue can amplify an authority prior and ignore marginalized evidence. It can overfit to recency and miss original sources. It can treat access restrictions as low value and ignore paywalled primary documents. It can log skip reasons mechanically without real review. It can also be attacked by prompt-injection content, which is why source risk and tool permissions belong in the feature row.',
      ],
    },
    {
      heading: 'Study Next',
      paragraphs: [
        'Primary sources: OpenAI Deep Research system card at https://openai.com/index/deep-research-system-card/, OpenAI WebGPT at https://openai.com/index/webgpt/ and https://arxiv.org/abs/2112.09332, STORM project page at https://storm-project.stanford.edu/research/storm/, STORM paper at https://arxiv.org/abs/2402.14207, Anthropic multi-agent research system at https://www.anthropic.com/engineering/multi-agent-research-system, W3C PROV-DM at https://www.w3.org/TR/prov-dm/, and Google Search Quality Rater Guidelines at https://guidelines.raterhub.com/searchqualityevaluatorguidelines.pdf.',
        'Study Priority Queue for the scheduling base. Study Deep Research Question Decomposition DAG for deciding what evidence gaps exist. Study Claim Graph and Source Ledger for attaching spans to claims. Study Research Contradiction Resolution Graph for disagreements. Study Evidence Freshness Refresh Scheduler for time-sensitive claims, RAG Citation Span Index for quote-level support, RAG Dedup MinHash Chunk Canonicalization for duplicate control, Prompt Injection Threat Model for hostile source content, and Distributed Tracing for audit patterns.',
      ],
    },
  ],
};
