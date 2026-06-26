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
      heading: 'How to read the animation',
      paragraphs: [
        'Read each row as one claim, not as one document. A claim is a sentence-sized assertion that a reader may rely on, such as a price, release date, benchmark result, law, or definition. The active row is due for checking because its time-to-live policy has expired or its source changed.',
        'The arrows are dependency edges. If claim C-17 supports a paragraph and that paragraph supports the conclusion, refreshing C-17 can reopen both. The safe inference rule is simple: only claims whose support changed, expired, or contradicted a newer source should force article edits.',
        {type:'callout', text:'Freshness becomes maintainable when each claim has its own support ledger, TTL, dependency edges, and refresh job instead of inheriting a report-level date.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Research goes stale unevenly. A definition from a standard may be stable for years, while a cloud price, product limit, security advisory, model capability, or legal rule can change before the report is read again. A report-level date hides that difference.',
        'A freshness scheduler makes stale risk part of the data model. Each claim stores the source span that supports it, the date of that source, the date it was checked, the volatility class, and the report sections that depend on it. The system can then repair the claims that need repair instead of regenerating a whole report from scratch.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to attach a last-reviewed date to the document. That works for small notes because a human can reread the whole thing and decide whether anything matters. It fails when one article contains stable background, volatile numbers, and source-specific claims with different lifetimes.',
        'The next approach is to rerun the entire research workflow every week. That is safer than doing nothing, but it wastes search budget and creates noise in sections that did not need to move. It also makes every refresh a rewrite event, which can erase the history of why a claim changed.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that freshness is not a property of a URL. One page can contain a stable method description, a stale benchmark table, and a current release note. A single access date cannot tell which sentence is still safe.',
        'The second wall is cost. Suppose a report has 400 claims and a full refresh takes 6 hours of tool time, review, and source checking. If only 30 claims are volatile, a full rerun spends most of its time proving stable text is still stable while high-risk claims wait behind low-risk work.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Treat the report as a dependency graph. Conclusions depend on section claims, section claims depend on evidence spans, and evidence spans depend on sources, retrieval queries, dates, permissions, and versions. Refreshing one source should identify the exact claims that inherited risk from it.',
        'The scheduling question becomes concrete: which claim is likely enough to have changed, important enough to matter, and cheap enough to check now. That score combines volatility, elapsed time, source authority, downstream importance, user stakes, fetch cost, and whether the source needs permission. Freshness becomes a queueing problem with audit history.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Each claim record stores text, section id, source pointer, exact evidence span, source date, access date, source version, claim class, time-to-live, last check, next due time, watch query, and dependency edges. A source pointer can be a URL, PDF page, repository commit, command output, dataset version, or private file handle. The exact span matters because one document rarely supports every sentence around it.',
        'The scheduler writes refresh jobs into a priority queue. A job stores the claim id, stale-risk score, fetch plan, estimated cost, permission requirement, owner, and possible outcomes. Outcomes include unchanged, updated, source gone, access restricted, contradicted, superseded, or manually escalated.',
        'After fetch, the system compares new evidence with the old support span. If the value and meaning are unchanged, it records a refresh and advances the next due date. If the source changed or contradicted the old claim, it updates dependent sections or opens a review item instead of silently rewriting history.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is reachability in the dependency graph. If every claim names its evidence span and every section names the claims it uses, then a changed evidence span can only affect nodes reachable from that span. Stable claims with no path from the changed source do not need to be reopened.',
        'The queue is correct for deadline selection under its policy because the highest-risk due job is examined first. A lazy recheck handles updates: when a claim receives new evidence, the scheduler recomputes its due time and ignores stale heap entries. The invariant is that no accepted article section depends on an expired or contradicted claim without carrying that status.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The main cost is metadata. If 400 claims each store a 2 KB record for source pointers, spans, policy, status, and version history, the ledger is under 1 MB, but the human and tool discipline is real. Each new claim must be classified before the scheduler can protect it.',
        'Runtime is dominated by refresh work, not by the heap. A priority queue gives O(log n) inserts and updates, so 400 or 40,000 claims are cheap to schedule. The expensive behavior is source fetching, benchmark reruns, permission checks, and review of contradictions.',
        'Over-refreshing is a product bug. It burns search budget, creates churn, and can destabilize polished text. Under-refreshing is a trust bug because stale high-stakes claims remain in the report while the prose still sounds confident.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Market research can give short time-to-live policies to prices, funding, leadership, product availability, and benchmark tables while giving long policies to background definitions. Security reports can watch advisories, exploit status, patch versions, and vendor guidance. Legal and financial work need stricter review because stale claims can change a decision, not just a footnote.',
        'Agentic research products need this because users return to old work. The system should know which claims are stale, which checks are blocked, what changed, and which sections need revision. That turns a one-off answer into a maintained research object.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when publication date is treated as truth. A page can be undated, silently modified, or current in one paragraph and stale in another. An access date without a stored span or source hash only proves that something was opened.',
        'It also fails when watch queries miss the authoritative update. A vendor page may lag a release note, a benchmark rerun may not be comparable, and a source can move behind an access wall. The scheduler should surface uncertainty as a review state rather than converting weak evidence into confident prose.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a 400-claim model-selection report has 260 stable claims, 90 product claims, 30 pricing claims, and 20 benchmark claims. Stable definitions get a 365-day policy, product claims get 30 days, pricing gets 7 days, and benchmark claims get 14 days or a rerun trigger. On day 15, only the benchmark and pricing claims are due unless a watched source changed.',
        'A full refresh costs 6 hours. The scheduler instead checks 50 due claims: 30 pricing pages at 2 minutes each and 20 benchmark claims at 6 minutes each, for about 3 hours before review. If 6 claims changed, only the dependent cost and benchmark sections reopen.',
        'Now one pricing source is unreachable. The job outcome is not unchanged; it is access restricted, and the dependent claim is marked blocked. That blocked status is part of the answer because the old price may still be displayed only with an explicit stale-evidence warning.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study W3C PROV-DM for provenance graphs, Dublin Core for source lifecycle fields, OpenLineage for job and dataset metadata, HTTP cache revalidation for validator-based freshness, and NIST AI Risk Management Framework for risk-based controls. Then study Claim Graph and Source Ledger, Source Authority Triage Priority Queue, Research Contradiction Resolution Graph, Feature Freshness SLO Monitor, Cache Invalidation and Versioning, and Temporal Workflow Case Study.',
        'The next exercise is to design a time-to-live policy for five claim classes. Give each class a volatility estimate, a source authority rule, a refresh cost, and a user-harm level. If two classes receive the same policy, explain why their stale behavior is actually the same.',
      ],
    },
  ],
};