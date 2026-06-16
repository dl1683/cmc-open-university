// Evidence freshness refresh scheduler: assign claim TTLs, watch queries, and
// refresh jobs so date-sensitive research does not silently go stale.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'evidence-freshness-refresh-scheduler-case-study',
  title: 'Evidence Freshness Refresh Scheduler',
  category: 'AI & ML',
  summary: 'Track source dates, access dates, claim TTLs, watch queries, and refresh jobs so deep research can update stale evidence without rerunning everything.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['freshness ledger', 'refresh scheduler'], defaultValue: 'freshness ledger' },
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

function freshnessGraph(title) {
  return graphState({
    nodes: [
      { id: 'claim', label: 'claim', x: 0.8, y: 3.8, note: 'fact' },
      { id: 'source', label: 'source', x: 2.3, y: 2.2, note: 'URL' },
      { id: 'date', label: 'date', x: 2.3, y: 5.4, note: 'meta' },
      { id: 'ttl', label: 'TTL', x: 4.1, y: 3.8, note: 'policy' },
      { id: 'watch', label: 'watch', x: 5.8, y: 2.0, note: 'query' },
      { id: 'queue', label: 'queue', x: 5.8, y: 5.6, note: 'jobs' },
      { id: 'fetch', label: 'fetch', x: 7.4, y: 3.8, note: 'refresh' },
      { id: 'diff', label: 'diff', x: 8.7, y: 2.3, note: 'change' },
      { id: 'ledger', label: 'ledger', x: 8.7, y: 5.4, note: 'version' },
      { id: 'gate', label: 'gate', x: 10.0, y: 3.8, note: 'ship?' },
    ],
    edges: [
      { id: 'e-claim-source', from: 'claim', to: 'source' },
      { id: 'e-claim-date', from: 'claim', to: 'date' },
      { id: 'e-source-ttl', from: 'source', to: 'ttl' },
      { id: 'e-date-ttl', from: 'date', to: 'ttl' },
      { id: 'e-ttl-watch', from: 'ttl', to: 'watch' },
      { id: 'e-ttl-queue', from: 'ttl', to: 'queue' },
      { id: 'e-watch-fetch', from: 'watch', to: 'fetch' },
      { id: 'e-queue-fetch', from: 'queue', to: 'fetch' },
      { id: 'e-fetch-diff', from: 'fetch', to: 'diff' },
      { id: 'e-fetch-ledger', from: 'fetch', to: 'ledger' },
      { id: 'e-diff-gate', from: 'diff', to: 'gate' },
      { id: 'e-ledger-gate', from: 'ledger', to: 'gate' },
    ],
  }, { title });
}

function* freshnessLedger() {
  yield {
    state: freshnessGraph('Freshness is a claim property, not only a source property'),
    highlight: { active: ['claim', 'source', 'date', 'ttl', 'e-claim-source', 'e-claim-date', 'e-source-ttl', 'e-date-ttl'], found: ['gate'] },
    explanation: 'A source can be old while the claim is stable, or recent while the claim is fragile. The freshness ledger assigns TTLs to claims, not just URLs.',
  };

  yield {
    state: labelMatrix(
      'Claim freshness policy',
      [
        { id: 'defn', label: 'defn' },
        { id: 'price', label: 'price' },
        { id: 'law', label: 'law' },
        { id: 'bench', label: 'bench' },
        { id: 'model', label: 'model' },
        { id: 'sec', label: 'sec' },
      ],
      [
        { id: 'ttl', label: 'TTL' },
        { id: 'watch', label: 'watch' },
        { id: 'act', label: 'act' },
      ],
      [
        ['long', 'none', 'keep'],
        ['short', 'vendor', 'check'],
        ['med', 'reg', 'check'],
        ['short', 'leader', 'rerun'],
        ['med', 'release', 'check'],
        ['short', 'CVE', 'check'],
      ],
    ),
    highlight: { active: ['price:act', 'bench:act', 'sec:act'], compare: ['defn:act'], found: ['law:watch'] },
    explanation: 'Different claim classes get different TTLs. Definitions can last; prices, product behavior, legal status, security findings, and benchmark leaderboards need active refresh.',
    invariant: 'A citation should store both source date and access date.',
  };

  yield {
    state: freshnessGraph('Watch queries attach to fragile claims'),
    highlight: { active: ['ttl', 'watch', 'queue', 'e-ttl-watch', 'e-ttl-queue'], compare: ['source'], found: ['fetch'] },
    explanation: 'A watch query is a saved search or source-specific check for a fragile claim. It lets the system refresh only claims likely to drift instead of rerunning the whole research report.',
  };

  yield {
    state: labelMatrix(
      'Vers',
      [
        { id: 'v1', label: 'v1' },
        { id: 'v2', label: 'v2' },
        { id: 'v3', label: 'v3' },
        { id: 'v4', label: 'v4' },
      ],
      [
        { id: 'src', label: 'src' },
        { id: 'date', label: 'date' },
        { id: 'span', label: 'span' },
        { id: 'state', label: 'state' },
      ],
      [
        ['doc', '2024', 'p7', 'old'],
        ['doc', '2025', 'p9', 'new'],
        ['bench', '2026', 'tbl', 'new'],
        ['blog', '2023', 'q2', 'drop'],
      ],
    ),
    highlight: { active: ['v2:state', 'v3:date'], compare: ['v1:state'], removed: ['v4:state'] },
    explanation: 'Refresh should preserve versions. If a source changes, the ledger records the old support span, the new span, and whether the answer should be updated, narrowed, or left unchanged.',
  };
}

function* refreshScheduler() {
  yield {
    state: plotState({
      axes: { x: { label: 'days since check', min: 0, max: 120 }, y: { label: 'stale risk', min: 0, max: 1 } },
      series: [
        { id: 'stable', label: 'stable', points: [{ x: 0, y: 0.03 }, { x: 30, y: 0.06 }, { x: 60, y: 0.08 }, { x: 120, y: 0.12 }] },
        { id: 'product', label: 'product', points: [{ x: 0, y: 0.06 }, { x: 30, y: 0.28 }, { x: 60, y: 0.52 }, { x: 120, y: 0.8 }] },
        { id: 'security', label: 'security', points: [{ x: 0, y: 0.12 }, { x: 30, y: 0.58 }, { x: 60, y: 0.82 }, { x: 120, y: 0.96 }] },
      ],
      markers: [
        { id: 'due', x: 30, y: 0.58, label: 'due' },
      ],
    }),
    highlight: { active: ['security', 'due'], compare: ['stable', 'product'] },
    explanation: 'The scheduler computes stale risk from claim class, elapsed time, source volatility, user stakes, and downstream report dependence. High-risk claims refresh sooner.',
  };

  yield {
    state: labelMatrix(
      'Refresh queue',
      [
        { id: 'j1', label: 'j1' },
        { id: 'j2', label: 'j2' },
        { id: 'j3', label: 'j3' },
        { id: 'j4', label: 'j4' },
        { id: 'j5', label: 'j5' },
      ],
      [
        { id: 'risk', label: 'risk' },
        { id: 'cost', label: 'cost' },
        { id: 'block', label: 'block' },
        { id: 'act', label: 'act' },
      ],
      [
        ['hi', 'low', 'yes', 'now'],
        ['hi', 'med', 'no', 'soon'],
        ['med', 'low', 'no', 'batch'],
        ['low', 'low', 'no', 'park'],
        ['med', 'hi', 'yes', 'ask'],
      ],
    ),
    highlight: { active: ['j1:act', 'j2:risk', 'j5:block'], compare: ['j4:act'], found: ['j3:act'] },
    explanation: 'Refresh jobs are prioritized by stale risk, fetch cost, and whether the claim blocks a current answer. Some jobs run immediately, some batch overnight, and some require user approval or access.',
  };

  yield {
    state: freshnessGraph('Fetch, diff, and update only affected report sections'),
    highlight: { active: ['queue', 'fetch', 'diff', 'ledger', 'gate', 'e-queue-fetch', 'e-fetch-diff', 'e-fetch-ledger'], compare: ['claim'] },
    explanation: 'A refresh job should diff the new evidence against the old support span and update only dependent claims and report sections. This is cheaper and safer than regenerating the whole report.',
  };

  yield {
    state: labelMatrix(
      'Out',
      [
        { id: 'same', label: 'same' },
        { id: 'newer', label: 'newer' },
        { id: 'gone', label: 'gone' },
        { id: 'contra', label: 'contra' },
        { id: 'acl', label: 'ACL' },
      ],
      [
        { id: 'meaning', label: 'means' },
        { id: 'action', label: 'act' },
      ],
      [
        ['same', 'keep'],
        ['new', 'updt'],
        ['404', 'repl'],
        ['refut', 'reopen'],
        ['lock', 'redact'],
      ],
    ),
    highlight: { active: ['same:action', 'newer:action'], removed: ['contra:action'], compare: ['gone:action'], found: ['acl:action'] },
    explanation: 'Refresh is not always an update. A source can disappear, become access-restricted, contradict the old claim, or leave the old support unchanged. Each outcome has a different action.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'freshness ledger') yield* freshnessLedger();
  else if (view === 'refresh scheduler') yield* refreshScheduler();
  else throw new InputError('Pick an evidence-freshness view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'An evidence freshness refresh scheduler tracks which research claims can go stale, when they were last checked, which watch query can update them, and which report sections depend on them. It lets a deep research system refresh fragile evidence without rerunning the entire workflow.',
        'This module links Claim Graph & Source Ledger, Source Authority Triage Priority Queue, Research Contradiction Resolution Graph, Feature Freshness SLO Monitor, Cache Invalidation, and Temporal Workflow Case Study. The data-structure idea is familiar: stale state needs metadata, invalidation, priority, and repair.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Each claim gets source date, access date, claim class, volatility class, source authority, downstream report dependencies, TTL, watch query, last refresh result, and next due time. The scheduler does not refresh stable definitions on the same cadence as prices, laws, security advisories, product launches, or benchmark leaderboards.',
        'OpenAI describes deep research as reacting to real-time information and pivoting as it encounters new information: https://openai.com/index/introducing-deep-research/. The system card describes searching, interpreting files, analyzing data, and synthesizing many sources: https://openai.com/index/deep-research-system-card/. A freshness scheduler is the operational layer that decides when those actions need to happen again.',
      ],
    },
    {
      heading: 'Freshness metadata',
      paragraphs: [
        'The minimum metadata is published date, modified date if known, access date, source version, retrieval query, evidence span, claim class, and TTL policy. The access date matters because a source can be undated or silently changed. Version identifiers matter because official docs can move while old URLs keep working.',
        'Dublin Core metadata terms are useful background for source dates and lifecycle fields: https://www.dublincore.org/documents/dcmi-terms/. W3C PROV-DM is useful for modeling entities, activities, agents, and derivation: https://www.w3.org/TR/prov-dm/. OpenLineage shows how production lineage systems attach facets to runs, jobs, and datasets: https://openlineage.io/docs/spec/object-model/.',
      ],
    },
    {
      heading: 'Complete case study: benchmark watch report',
      paragraphs: [
        'A research agent writes a report comparing inference engines. The definitions of KV cache and PagedAttention are stable. The benchmark table, pricing, supported model list, CUDA version, and bug status are volatile. The freshness scheduler assigns short TTLs to benchmark and price claims, medium TTLs to product-support claims, and long TTLs to conceptual definitions.',
        'Two weeks later, a watch query finds a new release and a benchmark rerun. The scheduler fetches the new sources, diffs the benchmark row, updates only affected claims, and reopens a contradiction because the vendor table improved but an independent issue reports a regression on long-context prompts. The final report can be refreshed surgically.',
      ],
    },
    {
      heading: 'Scheduler design',
      paragraphs: [
        'The refresh queue is a priority queue over stale risk, downstream importance, fetch cost, and access requirements. A high-risk claim used in the executive summary refreshes before a low-risk appendix note. A cheap official-doc check can run more often than an expensive benchmark rerun. A private source refresh may need authorization before a tool opens it.',
        'The scheduler also needs diff semantics. Same source content means keep. New version means update and cite the version. Missing source means replace or downgrade. Contradictory source means reopen the contradiction graph. Access-restricted source means redact or reroute. These outcomes should be stored in the ledger, not hidden in a rewritten paragraph.',
      ],
    },
    {
      heading: 'Pitfalls and study next',
      paragraphs: [
        'Do not refresh every source equally. Do not treat publication date as the only freshness signal. Do not silently overwrite old evidence; preserve versions. Do not let stale claims survive because the report still reads well. Do not run watch queries that cross user permission boundaries. Do not use an old private file to answer a new public question without checking access scope.',
        'Study Claim Graph & Source Ledger, Deep Research Question Decomposition DAG, Source Authority Triage Priority Queue, Research Contradiction Resolution Graph, RAG Index Lifecycle and Alias Swap, Feature Freshness SLO Monitor, HTTP Cache ETag Revalidation, Cache Invalidation, Temporal Workflow Case Study, OpenLineage, W3C PROV-DM, Dublin Core Metadata Terms, and NIST AI RMF at https://www.nist.gov/itl/ai-risk-management-framework next.',
      ],
    },
  ],
};
