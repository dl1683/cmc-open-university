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
    explanation: 'A deep research agent cannot read every search hit. It needs a triage queue that dedupes candidates, ranks authority, checks freshness, and schedules the few sources most likely to change the answer.',
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
    explanation: 'The source row stores authority, freshness, novelty, risk, access scope, and the next action. That row lets the agent justify why a source was read, skipped, downgraded, or sent to audit.',
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
    explanation: 'A high retrieval score does not erase source risk. The priority queue should preserve both: relevance decides whether to inspect; authority and support decide whether the source can carry a final claim.',
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
      heading: 'What it is',
      paragraphs: [
        'A source authority triage priority queue ranks candidate sources before the research agent spends context, tool time, or report trust on them. It is the missing structure between retrieval and citation. Retrieval finds candidates; triage decides which candidates deserve reading, which deserve skepticism, and which should be skipped with an audit reason.',
        'This module extends Multi-Index RAG, Claim Graph & Source Ledger, and Deep Research Question Decomposition DAG. Multi-Index RAG can retrieve many hits. The claim ledger can store exact evidence. The triage queue decides which source objects are worth converting into evidence rows.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Each source candidate gets a feature row: source class, publisher, author or organization, primary versus secondary role, publication date, access date, version, retrieval score, novelty cluster, permission scope, prompt-injection risk, and proposed action. The queue score should not be a single opaque model score. It should be decomposable so a later audit can explain why a source was selected.',
        'The Google Search Quality Rater Guidelines are useful source-quality background because they separate page quality from needs met and give raters a common evaluation frame: https://guidelines.raterhub.com/searchqualityevaluatorguidelines.pdf. Google also summarizes Search Quality Rater Guideline updates in official Search Central posts: https://developers.google.com/search/blog/2023/11/search-quality-rater-guidelines-update. A research agent should not copy that rubric blindly, but the distinction between relevance and quality is exactly the data-structure lesson here.',
      ],
    },
    {
      heading: 'Priority features',
      paragraphs: [
        'Authority is domain-specific. Official docs are high authority for product behavior but weak for independent performance claims. Papers are strong for methods but may be stale for production availability. Filings can be strong for dates and business commitments. Forums can be strong for discovering user pain, but weak for broad generalization. The queue should store source duty, not just source rank.',
        'Freshness matters only for date-sensitive claims. A proof, API design, or mathematical definition can be stable for years. A price, product feature, regulation, benchmark leaderboard, or CEO quote can change tomorrow. Evidence Freshness Refresh Scheduler turns that distinction into TTLs and watch queries.',
      ],
    },
    {
      heading: 'Complete case study: vendor benchmark report',
      paragraphs: [
        'A user asks whether a vendor benchmark proves leadership. Raw search returns the vendor post, a press article, a GitHub issue, an old paper, two benchmark repos, and a social thread. The queue reads the benchmark repo and method notes first, reads the vendor post for claims, reads the paper for method lineage, skims the article for context, and flags the social thread as a lead rather than a citable source.',
        'The ledger then stores exact benchmark version, hardware, workload, batch size, data date, and whether the vendor compared against current baselines. If the vendor post and benchmark repo disagree, Research Contradiction Resolution Graph classifies the conflict before the report writes a conclusion.',
      ],
    },
    {
      heading: 'Operational details',
      paragraphs: [
        'The queue needs dedupe. The same press release may appear as a vendor blog, copied article, newsletter summary, and social post. MinHash, canonical URLs, source clusters, and claim similarity prevent duplicate material from filling the context window. RAG Dedup, MinHash, and Chunk Canonicalization covers the adjacent corpus-level problem; this module applies the same idea to research-source scheduling.',
        'The queue also needs a skip ledger. A skipped source can matter later if the final answer is challenged. The skip record should say whether the source was duplicate, low authority, stale, inaccessible, out of scope, unsafe, or redundant after stronger evidence was found. That turns source selection into an auditable decision rather than hidden model taste.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: OpenAI Deep Research system card at https://openai.com/index/deep-research-system-card/, OpenAI WebGPT at https://openai.com/index/webgpt/ and https://arxiv.org/abs/2112.09332, STORM project page at https://storm-project.stanford.edu/research/storm/, STORM paper at https://arxiv.org/abs/2402.14207, Anthropic multi-agent research system at https://www.anthropic.com/engineering/multi-agent-research-system, W3C PROV-DM at https://www.w3.org/TR/prov-dm/, and Google Search Quality Rater Guidelines at https://guidelines.raterhub.com/searchqualityevaluatorguidelines.pdf.',
        'Study Deep Research Question Decomposition DAG, Research Contradiction Resolution Graph, Evidence Freshness Refresh Scheduler, Claim Graph & Source Ledger, RAG Citation Span Index, RAG Claim Verification Support Ledger, RAG Dedup MinHash Chunk Canonicalization, Multi-Index RAG, Filtered Vector Search Bitset, Prompt Injection Threat Model, Zanzibar Authorization Case Study, and Distributed Tracing next.',
      ],
    },
  ],
};
