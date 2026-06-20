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
    explanation: 'The naive baseline is to mark a whole source as fresh or stale. A better ledger assigns freshness to claims: an old definition may still be stable, while a recent price, release note, or security finding may already be fragile.',
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
    explanation: 'A watch query is a saved search or source-specific check for a fragile claim. It lets the system refresh the few claims likely to drift instead of rerunning the whole research report.',
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
    explanation: 'A refresh job should diff new evidence against the old support span and update only dependent claims and report sections. Surgical refresh is cheaper and safer than regenerating a whole report from scratch.',
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
      heading: 'Why it exists',
      paragraphs: [
        'An evidence freshness refresh scheduler exists because research does not age evenly. A definition from a standard may remain useful for years. A cloud price, product limit, security advisory, model leaderboard, legal rule, release note, or benchmark result can become stale in days. Deep research systems often produce long reports with many claims. Rerunning the whole report every time one source changes is expensive, but leaving date-sensitive claims untouched is how confident answers become quietly wrong.',
        'The scheduler turns freshness into a claim-level property. It tracks when a claim was supported, what source and span supported it, what kind of claim it is, how volatile that class is, which watch query can update it, and which report sections depend on it. This connects claim graphs, source ledgers, cache invalidation, feature freshness SLOs, and temporal workflows. The basic engineering lesson is simple: state that can go stale needs metadata, invalidation rules, repair jobs, and version history.',
        {type:'callout', text:'Freshness becomes maintainable when each claim has its own support ledger, TTL, dependency edges, and refresh job instead of inheriting a report-level date.'},
      ],
    },
    {
      heading: 'The naive baseline',
      paragraphs: [
        'The naive baseline is to mark a source as fresh or stale. That fails because a source contains many claims with different lifetimes. A three-year-old paper may still define a method correctly while its benchmark comparison is obsolete. A vendor documentation page may have a current access date but still describe a feature that changed last week on a different page. Freshness belongs to the claim and its use, not only to the URL.',
        'The other naive baseline is to rerun the entire research workflow on a schedule. That is safe only when the report is small and refresh cost is low. For serious research, full reruns waste time, reopen stable sections, and create new opportunities for drift in unrelated prose. The better approach is surgical refresh: identify fragile claims, fetch targeted evidence, diff against old support, and update only dependent claims and sections.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core insight is to treat a research report like a dependency graph. A conclusion depends on section claims. Section claims depend on evidence spans. Evidence spans depend on sources, dates, access permissions, and retrieval queries. If one volatile source changes, the system should be able to identify exactly which claims and sections are affected. That is the same idea as build systems, cache invalidation, lineage graphs, and database refresh plans.',
        'A freshness scheduler does not ask, "Is this report old?" It asks, "Which important claims are likely to have changed enough to affect a decision, and what is the cheapest trustworthy way to check them?" That question combines stale risk, source authority, claim class, elapsed time, downstream importance, fetch cost, and user stakes. It makes freshness a prioritization problem rather than a vague feeling.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The freshness-ledger visual proves that a claim has more than citation text. It has a source, a source date, an access date, a TTL policy, a watch query, and a report gate. The matrix of claim classes shows why definitions, prices, laws, benchmarks, model capabilities, and security findings cannot share one refresh cadence. A stable definition can stay. A benchmark claim may need a rerun. A security claim may need a new advisory check.',
        'The scheduler visual proves that refresh work should be queued by risk and consequence. The stale-risk plot separates stable, product, and security claims over time. The queue table adds cost and blocking status. The fetch-diff-ledger path then shows the expected outcome: fetch new evidence, compare it with the old support span, preserve versions, update affected claims, and reopen contradictions when the new evidence changes the answer.',
      ],
    },
    {
      heading: 'How the data model works',
      paragraphs: [
        'A useful claim record stores the claim text, report section, source pointer, exact evidence span, source date, access date, source version, retrieval query, claim class, volatility class, authority label, TTL, last refresh time, next due time, watch query, and dependency edges. A source pointer can be a URL, PDF page, repository commit, command output, dataset version, or private file handle. The exact span matters because a page can support one sentence and not the next.',
        'The scheduler records jobs separately. A job has a claim ID or claim group, stale-risk score, fetch plan, expected cost, permission requirement, blocking status, owner, and outcome. Outcomes include unchanged, updated, source gone, access restricted, contradicted, superseded, or manually escalated. Keeping those states explicit prevents a dangerous shortcut where the system silently rewrites a paragraph and loses why the old claim changed.',
        'The metadata has roots in older standards and systems. Dublin Core is useful background for source dates and lifecycle fields. W3C PROV-DM models entities, activities, agents, and derivation. OpenLineage shows how production lineage systems attach metadata to jobs, runs, and datasets. A freshness scheduler applies the same lineage discipline to research claims.',
      ],
    },
    {
      heading: 'How the scheduler works',
      paragraphs: [
        'The scheduler begins by classifying claims. Definitions, historical facts, prices, product limits, laws, security advisories, benchmark results, model capabilities, and availability claims get different TTL policies. The policy can be fixed, learned from source volatility, or adjusted by user stakes. A medical, legal, or financial claim gets a shorter leash than a stable computer-science definition because the cost of stale advice is higher.',
        'Next, the system generates watch queries. A watch can be a source-specific fetch, an official release-page check, a CVE query, a benchmark repository run, a documentation diff, a regulatory update search, or a manual reminder. Jobs enter a priority queue ordered by stale risk, downstream importance, blocking status, cost, and permissions. Cheap high-risk checks can run immediately. Expensive benchmarks can batch. Private-source refreshes may need user authorization before tools open files.',
        'After fetch, the system diffs new evidence against the old support span. If the support is unchanged, the ledger records a refresh and moves the next due date. If a value changed, dependent claims and sections are updated. If a source disappeared, the system replaces it or downgrades confidence. If a newer source contradicts the old answer, the contradiction graph reopens instead of hiding the conflict in revised prose.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works because most reports have a small number of volatile claims carrying a large amount of freshness risk. Refreshing those claims gives a better return than rereading every stable background section. The dependency graph keeps the work bounded. If a CUDA support table changes, update the claims that cite that table. If a price changes, update the cost section. If a definition still matches the standard, leave the conceptual section alone.',
        'It also works because it preserves versions. Old evidence is not erased. The ledger can show that a claim was true under a previous source date, then superseded by a new release, contradicted by an independent benchmark, or downgraded because a source became unavailable. That history is useful for audit, reproducibility, and user trust. It prevents the system from pretending the report was always current.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'The cost is bookkeeping. Every claim needs metadata, and every refresh job needs a result. That overhead is not worth it for throwaway notes, but it is worth it for reports that drive decisions, compliance, market strategy, security posture, medical workflows, legal analysis, or benchmark claims. The scheduler also needs storage for source snapshots or hashes, because silent source changes are common.',
        'There are operational tradeoffs. Watch queries can create noise. Over-refreshing can waste search budget and destabilize reports. Under-refreshing can leave stale claims in high-visibility sections. Automated diffs can miss semantic changes, especially when a source rewrites language without changing numbers. Permissioned sources require access checks. A system should never refresh private evidence into a public answer without verifying scope.',
      ],
    },
    {
      heading: 'Real uses',
      paragraphs: [
        'A market report can assign short TTLs to prices, funding, leadership, product availability, and benchmark tables while giving long TTLs to definitions and historical background. A security report can watch CVEs, advisories, exploit status, patch versions, and vendor guidance. A legal memo can watch regulations, court decisions, agency guidance, and jurisdiction-specific updates. A model-selection report can watch model cards, release notes, pricing pages, latency benchmarks, and deprecation notices.',
        'Agentic research products need this especially. A user may return to a report weeks later and ask for an update. The right response is not to regenerate everything from memory. The system should know which claims are stale, which watch jobs are due, what changed, and which sections need revision. That is how a research workspace becomes durable instead of a pile of one-off transcripts.',
      ],
    },
    {
      heading: 'Failure modes and limits',
      paragraphs: [
        'Do not treat publication date as the only freshness signal. A page can be undated, silently modified, or current in one section and stale in another. Do not trust an access date without storing what was accessed. Do not refresh every source equally. Do not silently overwrite old evidence. Do not let a report stay unchanged simply because the prose still reads well.',
        'The scheduler can also fail by overconfidence. A watch query may miss the authoritative update. A source may move behind an access wall. A benchmark rerun may not be comparable to the old setup. A contradiction may be real rather than a data-entry error. The system should surface these states as review items. Freshness automation is a control loop, not a license to skip judgment.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Claim Graph & Source Ledger, Source Authority Triage Priority Queue, Research Contradiction Resolution Graph, Deep Research Question Decomposition DAG, RAG Index Lifecycle and Alias Swap, Feature Freshness SLO Monitor, HTTP Cache ETag Revalidation, Cache Invalidation & Versioning, Temporal Workflow Case Study, OpenLineage Metadata Lineage Graph Case Study, W3C PROV-DM, Dublin Core Metadata Terms, and NIST AI Risk Management Framework at https://www.nist.gov/itl/ai-risk-management-framework. The next design question is how to choose TTL policy from claim class, source volatility, decision stakes, and refresh cost.',
      ],
    },
  ],
};
