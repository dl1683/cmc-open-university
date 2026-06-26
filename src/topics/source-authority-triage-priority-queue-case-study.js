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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the graph as a research pipeline before citation. A query creates candidates, candidates are deduped and scored, the queue schedules reading, and the ledger records which claims each source can support. Active nodes are the current triage decision, compare nodes are lower-priority or risky alternatives, and found nodes are auditable records.',
        'The matrix view defines source classes. Authority means a source is allowed to support a kind of claim, not that it is universally trustworthy. A forum post can reveal a failure mode, while a paper, filing, or official doc may be needed to carry the final factual claim.',
        {type:'callout', text:'Source triage is a scheduling problem: read the evidence most likely to support, challenge, or change the report.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/6/69/Min-heap.png', alt:'Complete binary min heap with the smallest value at the root.', caption:'Complete binary min heap diagram by Vikingstad, Wikimedia Commons, public domain.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A research agent can retrieve more pages than it can read with care. The scarce resources are context window, time, attention, and claim capacity. A final report does not become stronger by citing many weak pages; it becomes stronger when each claim has the right evidence.',
        'A priority queue is a data structure that returns the highest-priority item next. Source triage uses that structure to spend reading budget on sources most likely to support, challenge, or change the answer. It makes source choice inspectable instead of letting search rank silently decide the report.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to read results in search order. This works for a narrow lookup when the top result is the official page or the original paper. It also feels efficient because retrieval rank is already available.',
        'Deep research breaks that habit. The top results may be summaries, duplicates, stale versions, vendor pages, or pages that are relevant but not authoritative for the exact claim. A result can be easy to find and still weak evidence.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that relevance, authority, freshness, novelty, and risk are different properties. A highly relevant benchmark blog may be weak for independent performance. An old paper may be strong for a method definition and weak for current production behavior.',
        'The second wall is duplicate pressure. Ten pages can repeat one press release and crowd out counterevidence. Without a queue and skip ledger, the final report may look sourced while being built on one underlying source family.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Treat source reading as scheduling under constraints. Each candidate receives features: source class, author or institution, date, version, novelty cluster, risk, accessibility, and allowed claim duty. The queue then chooses the next source for the current evidence gap.',
        'The source is not marked simply good or bad. It is marked good for definitions, numbers, legal text, implementation behavior, counterexamples, or leads. That distinction stops a weak source from carrying a strong claim while still preserving useful leads.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The retriever first returns candidates. Canonicalization collapses mirrored pages and duplicate URLs into one source cluster. The scorer then assigns a priority based on report gap, source authority, freshness requirement, novelty, and risk.',
        'When a source is read, exact evidence spans enter a claim ledger. When a source is skipped, the system stores a reason such as duplicate, stale, inaccessible, low authority, unsafe, or redundant. The audit path matters because skipped evidence can explain later bias.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The queue works because it preserves information that a single rank loses. A source can be relevant but risky, fresh but shallow, old but foundational, or novel but unsupported. Keeping those axes separate lets the system choose evidence by claim need.',
        'Correctness here means reviewability. The queue cannot prove it found the best source on the internet, but it can prove which policy selected each source and which gaps remained. If the answer is wrong, the audit can inspect weights, skipped clusters, and missing counterevidence.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost is front-loaded bookkeeping. Canonical URLs, date checks, source-class labels, dedupe clusters, and risk checks add latency before reading. For a quick stable lookup, this overhead is wasteful.',
        'For a 30-source investigation, the behavior changes. If dedupe collapses 80 retrieved pages into 24 source clusters, the agent can read 12 high-value clusters instead of 12 copies of the same claim. The queue spends more milliseconds before reading but saves minutes of context and reduces unsupported claims.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'This pattern fits legal research, market reports, benchmark analysis, incident review, medical or policy summaries, and source-grounded RAG systems. The common requirement is provenance: the reader must know why each claim can trust its source.',
        'It also fits autonomous research agents. A source queue can expose whether the agent overused vendor blogs, ignored filings, skipped paywalled primary documents, or failed to refresh time-sensitive facts. Those are operational failures, not style problems.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The queue can encode bias. Overweighting official sources can miss independent failures, while overweighting novelty can reward speculation. Overweighting freshness can discard stable foundational work.',
        'It also fails when the scoring fields become decorative. A skip reason copied mechanically is not an audit. The queue must be paired with real source reading, span extraction, contradiction checks, and human review for high-stakes claims.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a report needs to verify a claim about a model-serving feature released in 2026. The retriever returns 60 pages. Dedupe reduces them to 18 clusters: official docs, release notes, a GitHub issue, two benchmark posts, five news summaries, and user forum reports.',
        'The queue gives the official docs score 0.92 for product behavior, release notes 0.88 for date, the GitHub issue 0.76 for failure detail, benchmarks 0.70 with method risk, and forums 0.45 as leads. The agent reads the docs and release notes first, reads the issue for edge cases, and logs that news summaries were skipped as derivative. The final claim rests on primary sources while the failure section still benefits from user reports.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study priority queues for the scheduling primitive, W3C PROV for provenance vocabulary, search quality guidelines for source assessment, and deep-research system cards or papers for agent evidence workflows. Use primary or official sources for current factual claims because freshness requirements change by domain.',
        'Study claim graphs, citation span indexes, MinHash dedupe, contradiction resolution, freshness schedulers, and prompt-injection defenses next. They turn triage from a ranking table into a complete evidence pipeline.',
      ],
    },
  ],
};
