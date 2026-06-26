// Incident causal candidate graph: assemble service topology, SLO symptoms,
// traces, logs, deployments, and feature flags into ranked root-cause evidence.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'incident-causal-candidate-graph-case-study',
  title: 'Incident Causal Candidate Graph Case Study',
  category: 'Systems',
  summary: 'Model incidents as evidence graphs: symptoms, dependencies, traces, deploys, flags, blast radius, and ranked root-cause candidates with auditable uncertainty.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['candidate graph', 'root ranking'], defaultValue: 'candidate graph' },
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
  return matrixState({ title, rows, columns, values: labelsByRow.map((row) => row.map(code)), format: (value) => labels[value] });
}

function causalGraph(title) {
  return graphState({
    nodes: [
      { id: 'user', label: 'user SLI', x: 0.7, y: 3.5, note: 'burn' },
      { id: 'edge', label: 'edge', x: 2.0, y: 3.5, note: 'api' },
      { id: 'checkout', label: 'checkout', x: 3.6, y: 2.2, note: 'svc' },
      { id: 'pay', label: 'payment', x: 3.6, y: 4.8, note: 'svc' },
      { id: 'db', label: 'db', x: 5.2, y: 2.2, note: 'waits' },
      { id: 'queue', label: 'queue', x: 5.2, y: 4.8, note: 'lag' },
      { id: 'deploy', label: 'deploy', x: 6.8, y: 1.4, note: 'v42' },
      { id: 'flag', label: 'flag', x: 6.8, y: 3.5, note: 'on' },
      { id: 'trace', label: 'trace', x: 6.8, y: 5.6, note: 'path' },
      { id: 'rank', label: 'ranker', x: 8.4, y: 3.5, note: 'score' },
      { id: 'cause', label: 'candidate', x: 9.6, y: 3.5, note: 'not truth' },
    ],
    edges: [
      { id: 'e-user-edge', from: 'user', to: 'edge' },
      { id: 'e-edge-checkout', from: 'edge', to: 'checkout' },
      { id: 'e-edge-pay', from: 'edge', to: 'pay' },
      { id: 'e-checkout-db', from: 'checkout', to: 'db' },
      { id: 'e-pay-queue', from: 'pay', to: 'queue' },
      { id: 'e-deploy-checkout', from: 'deploy', to: 'checkout' },
      { id: 'e-flag-checkout', from: 'flag', to: 'checkout' },
      { id: 'e-trace-db', from: 'trace', to: 'db' },
      { id: 'e-checkout-rank', from: 'checkout', to: 'rank' },
      { id: 'e-db-rank', from: 'db', to: 'rank' },
      { id: 'e-deploy-rank', from: 'deploy', to: 'rank' },
      { id: 'e-flag-rank', from: 'flag', to: 'rank' },
      { id: 'e-rank-cause', from: 'rank', to: 'cause' },
    ],
  }, { title });
}

function scorePlot() {
  return plotState({
    axes: {
      x: { label: 'minutes since page', min: 0, max: 42 },
      y: { label: 'candidate score', min: 0, max: 1 },
    },
    series: [
      { id: 'deploy', label: 'deploy v42', points: [{ x: 0, y: 0.30 }, { x: 5, y: 0.48 }, { x: 10, y: 0.72 }, { x: 20, y: 0.84 }, { x: 30, y: 0.78 }] },
      { id: 'db', label: 'db wait', points: [{ x: 0, y: 0.44 }, { x: 5, y: 0.55 }, { x: 10, y: 0.62 }, { x: 20, y: 0.58 }, { x: 30, y: 0.42 }] },
      { id: 'queue', label: 'queue lag', points: [{ x: 0, y: 0.18 }, { x: 5, y: 0.24 }, { x: 10, y: 0.28 }, { x: 20, y: 0.23 }, { x: 30, y: 0.20 }] },
    ],
    markers: [
      { id: 'rollback', x: 20, y: 0.84, label: 'rollback' },
    ],
  });
}

function* candidateGraph() {
  yield {
    state: causalGraph('Incidents are evidence graphs, not single alerts'),
    highlight: { active: ['user', 'edge', 'checkout', 'db', 'trace', 'deploy'], found: ['e-user-edge', 'e-edge-checkout', 'e-checkout-db', 'e-trace-db', 'e-deploy-checkout'] },
    explanation: 'The candidate graph joins symptoms, service dependencies, trace paths, log templates, deployments, feature flags, queues, and databases. The goal is ranked evidence, not an oracle that declares root cause.',
    invariant: 'A root-cause candidate is a hypothesis with evidence, not a fact until response confirms it.',
  };

  yield {
    state: labelMatrix(
      'Evidence edge types',
      [
        { id: 'dep', label: 'depends' },
        { id: 'time', label: 'time' },
        { id: 'trace', label: 'trace' },
        { id: 'blast', label: 'blast' },
        { id: 'change', label: 'change' },
      ],
      [
        { id: 'edge', label: 'edge' },
        { id: 'raises', label: 'raises' },
        { id: 'caution', label: 'caution' },
      ],
      [
        ['A->B', 'shared fail', 'not cause'],
        ['before', 'plausible', 'coincide'],
        ['same span', 'strong', 'sampled'],
        ['many users', 'urgent', 'broad'],
        ['deploy/flag', 'actionable', 'rollback bias'],
      ],
    ),
    highlight: { active: ['trace:raises', 'change:raises'], found: ['dep:edge', 'blast:raises'], compare: ['time:caution'] },
    explanation: 'Different edges mean different things. A dependency edge explains blast radius. A temporal edge suggests sequence. A trace edge links a real request path. A change edge creates a rollback candidate.',
  };

  yield {
    state: causalGraph('Rankers combine topology, time, traces, and changes'),
    highlight: { active: ['rank', 'cause', 'e-checkout-rank', 'e-db-rank', 'e-deploy-rank', 'e-flag-rank', 'e-rank-cause'], found: ['trace', 'user'] },
    explanation: 'A useful ranker keeps feature families visible: affected SLIs, upstream/downstream topology, trace concentration, error templates, deploy window, flag changes, saturation, and recovery evidence.',
  };

  yield {
    state: labelMatrix(
      'Graph store shape',
      [
        { id: 'node', label: 'nodes' },
        { id: 'edge', label: 'edges' },
        { id: 'score', label: 'scores' },
        { id: 'ttl', label: 'ttl' },
      ],
      [
        { id: 'data', label: 'data' },
        { id: 'why', label: 'why' },
      ],
      [
        ['svc, SLI, change', 'entities'],
        ['depends, before', 'causal hints'],
        ['features', 'ranking'],
        ['window', 'freshness'],
      ],
    ),
    highlight: { active: ['node:data', 'edge:data', 'score:data'], found: ['ttl:why'] },
    explanation: 'The store can be a graph database, document graph, or in-memory incident graph. The important contract is that edges carry type, time, source, confidence, and evidence links.',
  };
}

function* rootRanking() {
  yield {
    state: labelMatrix(
      'Candidate ranking ledger',
      [
        { id: 'deploy', label: 'deploy v42' },
        { id: 'db', label: 'db waits' },
        { id: 'flag', label: 'flag X' },
        { id: 'queue', label: 'queue lag' },
      ],
      [
        { id: 'evidence', label: 'evidence' },
        { id: 'score', label: 'score' },
        { id: 'action', label: 'action' },
      ],
      [
        ['change+SLI', '.84', 'rollback'],
        ['trace waits', '.58', 'inspect'],
        ['enabled 10%', '.41', 'hold'],
        ['downstream', '.22', 'watch'],
      ],
    ),
    highlight: { active: ['deploy:evidence', 'deploy:score', 'deploy:action'], found: ['db:evidence'], compare: ['queue:score'] },
    explanation: 'The ranking ledger is operationally more useful than a single root-cause label. It says what evidence supports each candidate and which action would test or mitigate it.',
  };

  yield {
    state: scorePlot(),
    highlight: { active: ['deploy', 'db', 'rollback'], compare: ['queue'] },
    explanation: 'Scores should move as evidence arrives. A candidate can rise when traces cluster around it and fall when mitigation does not improve the SLI.',
  };

  yield {
    state: causalGraph('Mitigation is an experiment against the graph'),
    highlight: { active: ['deploy', 'checkout', 'user', 'rank', 'cause', 'e-deploy-checkout', 'e-checkout-rank', 'e-rank-cause'], found: ['flag'] },
    explanation: 'Rolling back a deploy or disabling a flag is also an experiment. If the SLO recovers and traces stop showing the bottleneck, the graph should record that recovery evidence and close the candidate.',
  };

  yield {
    state: labelMatrix(
      'Ranking pitfalls',
      [
        { id: 'corr', label: 'correlation' },
        { id: 'bias', label: 'change bias' },
        { id: 'miss', label: 'missing edge' },
        { id: 'auto', label: 'auto fix' },
      ],
      [
        { id: 'bad', label: 'bad' },
        { id: 'guard', label: 'guard' },
      ],
      [
        ['looks causal', 'show evidence'],
        ['blame deploy', 'compare traces'],
        ['hidden dep', 'topo audit'],
        ['unsafe action', 'approval gate'],
      ],
    ),
    highlight: { active: ['corr:bad', 'bias:bad'], found: ['miss:guard', 'auto:guard'] },
    explanation: 'The ranker should help responders reason faster, not pressure them into premature certainty. Confidence, counterevidence, missing data, and human overrides all belong in the incident record.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'candidate graph') yield* candidateGraph();
  else if (view === 'root ranking') yield* rootRanking();
  else throw new InputError('Pick an incident causal graph view.');
}

export const article = {
  references: [
    { title: 'Google SRE Incident Management Guide', url: 'https://sre.google/resources/practices-and-processes/incident-management-guide/' },
    { title: 'Google SRE Managing Incidents', url: 'https://sre.google/sre-book/managing-incidents/' },
    { title: 'OpenTelemetry Semantic Conventions', url: 'https://opentelemetry.io/docs/concepts/semantic-conventions/' },
    { title: 'Google SRE Alerting on SLOs', url: 'https://sre.google/workbook/alerting-on-slos/' },
  ],
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as an evidence graph for live incident response. Active nodes are the symptom, dependency, trace, deploy, flag, or mitigation currently being evaluated; visited nodes have evidence attached; found nodes are candidates strong enough to test. A safe inference is that a top-ranked cause is still a hypothesis until a reversible test or later analysis confirms it.',
        {type:'callout', text:'An incident graph is useful when every candidate remains a hypothesis with typed evidence, counterevidence, and a reversible test.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/5/52/Ishikawa_Fishbone_Diagram.svg', alt:'Ishikawa fishbone diagram showing causes leading to an effect', caption:'Ishikawa fishbone cause-and-effect diagram by FabianLange, via Wikimedia Commons, CC BY-SA 3.0.'},
      ],
    },
    { heading: 'Why this exists', paragraphs: [
      'Modern incidents rarely arrive as one clean alert with one obvious cause. A user-facing SLO can burn while services, queues, databases, deploys, feature flags, traces, and resource metrics all change at once. Responders need a way to assemble evidence quickly without pretending early correlation is proof.',
      'An incident causal candidate graph is a structured investigation object. It connects symptoms to topology, traces, changes, owners, mitigations, and counterevidence. The point is not automatic certainty; the point is a ranked search space that humans can test under pressure.',
    ] },
    { heading: 'The obvious approach', paragraphs: [
      'The obvious approach is alert correlation. Group alerts that fire near the same time, page the owning team, and open dashboards for the suspected service. That reduces noise, but it leaves the causal chain in the responder head.',
      'Another common approach is recent-change bias. If a deploy or flag changed near the incident start, roll it back. That is often a useful mitigation test, but it is not proof because the recent change can be unrelated or only one contributor.',
    ] },
    { heading: 'The wall', paragraphs: [
      'The wall is that incident evidence has different meanings. A topology edge says requests can flow through a dependency, a trace edge says affected requests did flow there, a deploy edge says code changed before the burn, and a mitigation edge says an action may have changed the symptom. Collapsing all of that into one correlation score hides the reason a candidate is ranked.',
      'Time pressure makes the wall harder. During an outage, nobody can manually join the service catalog, trace backend, log templates, deployment history, feature flags, SLO dashboard, queue metrics, and ownership metadata. Missing joins create action bias, where teams try the most visible fix instead of the best-supported test.',
    ] },
    { heading: 'The core insight', paragraphs: [
      'The core insight is to model root cause as a hypothesis with typed evidence. A candidate can rise because it is near the symptom in topology, appears on affected traces, changed before the burn, matches the blast radius, or improves after mitigation. It can fall because counterevidence shows unaffected traffic also crossed it, or because rollback did not improve the user-facing symptom.',
      'The graph should keep confidence reversible. Each edge stores source, time window, evidence link, weight, and meaning. The output is a ledger of candidates, not a final root-cause label.',
    ] },
    { heading: 'How it works', paragraphs: [
      'When an incident opens, the system seeds the graph with the leading symptom, such as checkout p99 latency above SLO in us-east. It expands through service topology, sampled traces, logs, deployment events, flag changes, resource metrics, queue lag, database waits, and ownership metadata. The graph can live in a graph database, document store, or incident object as long as edges are typed and sourced.',
      'The ranker scores candidates and actions. Useful features include graph distance from symptom, temporal order, affected-region overlap, trace concentration, cohort exposure, saturation, error-template match, and observed recovery after mitigation. Each score should show evidence and counterevidence so responders know why the candidate moved.',
    ] },
    { heading: 'Why it works', paragraphs: [
      'The correctness argument is bounded search, not guaranteed causality. Starting from a user-facing symptom keeps the investigation tied to impact. Topology limits which systems can plausibly explain the symptom, traces show actual affected request paths, and change data provides reversible tests.',
      'Mitigation evidence creates a weak experiment. If disabling flag F reduces p99 latency and the slow trace pattern disappears, confidence in F rises. If nothing changes, the graph should demote F and preserve the failed test as counterevidence.',
    ] },
    { heading: 'Cost and complexity', paragraphs: [
      'The main cost is integration. The graph needs service ownership, dependency topology, traces, log templates, deployment metadata, feature-flag audit trails, SLO burn rates, resource metrics, queue metrics, database wait signals, and incident actions. OpenTelemetry helps standardize signal names, but most organizations still have gaps.',
      'Ranking must be measured against postmortems and live responder feedback. Useful metrics include top-k candidate hit rate, false-leader rate, time to first useful candidate, evidence-link coverage, manual override rate, and missing-topology discoveries. A fast graph that is confidently wrong is worse than a dashboard.',
    ] },
    { heading: 'Real-world uses', paragraphs: [
      'This pattern wins in microservice environments where topology and ownership are distributed. It helps on-call engineers narrow the search space, incident commanders explain why a mitigation is being tried, and postmortem authors preserve the evidence trail. It is strongest when a symptom crosses layers, such as edge errors caused by checkout timeouts caused by database pool starvation.',
      'It also fits AIOps systems that need auditability. A black-box root-cause model may be hard to trust during an outage. A candidate graph exposes supporting edges and lets humans override the ranking without discarding the evidence.',
    ] },
    { heading: 'Where it fails', paragraphs: [
      'It fails through false certainty. A top-ranked candidate is not a root cause until evidence confirms it. Stale topology can also hide shared dependencies, causing the graph to split one incident into several unrelated symptoms or miss the true bottleneck.',
      'It fails when data collection is biased. Sampling can miss rare paths, log-template grouping can merge different failures, and privacy rules can limit trace detail. The graph should expose missing evidence and low confidence rather than hiding uncertainty under a clean score.',
    ] },
    { heading: 'Worked example', paragraphs: [
      'At 14:05, checkout p99 latency jumps from 280 ms to 2,400 ms and 5xx rate rises from 0.1 percent to 4 percent in us-east. The graph seeds the symptom, expands to checkout-api, payment-service, inventory-service, Redis, and orders-db, then attaches traces showing 72 percent of slow requests waiting on orders-db connection acquisition. It also attaches a deploy to checkout-api at 13:58 and a feature flag enabled for 20 percent of us-east traffic at 14:01.',
      'The first ranking puts the flag path at 0.62 confidence, orders-db pool saturation at 0.58, and the deploy at 0.34. Responders disable the flag for the cohort, and within 5 minutes p99 drops to 430 ms while connection-wait spans fall by 80 percent. The graph records the mitigation as evidence for the flag candidate and preserves the database pool as mechanism, so the postmortem can distinguish trigger from saturated component.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Primary sources are Google SRE incident-management guidance, Google SRE alerting on SLOs, OpenTelemetry semantic conventions, and production tracing documentation. Study AIOps incident response, alert correlation fingerprint indexes, distributed tracing, metric exemplars, causal graphs, feature-flag control planes, SLO burn-rate alerting, and runbook automation approvals. The next skill is keeping hypotheses testable under pressure.',
    ] },
  ],
};