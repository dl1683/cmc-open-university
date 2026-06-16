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
      heading: 'What it is',
      paragraphs: [
        'An incident causal candidate graph represents an outage as a graph of symptoms, services, dependencies, traces, logs, deployments, feature flags, queues, databases, and recovery evidence. It does not magically know the root cause. It ranks plausible candidates and keeps the evidence visible.',
        'This is the difference between correlation and investigation. Alert correlation says which symptoms likely belong together. A causal candidate graph says which entities might explain the symptom cluster and what evidence supports or weakens each hypothesis.',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'Nodes are entities such as user-visible SLIs, services, endpoints, deployments, feature flags, storage systems, queues, dashboards, log templates, and trace clusters. Edges have typed meaning: depends_on, changed_before, same_trace, same_log_template, same_region, same_owner, blast_radius, mitigated_by, and recovered_after.',
        'Each edge should carry time, source, confidence, and evidence links. A same-trace edge from a sampled request is stronger than a weak temporal coincidence. A deployment edge is actionable but can create bias, so the graph should show counterevidence too.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'When an incident opens, the system seeds the graph with the lead SLO symptom and affected services. It expands along topology, recent changes, trace paths, log templates, saturated resources, and ownership metadata. A ranker scores candidates using features such as proximity to the symptom, temporal order, trace concentration, blast radius, deploy recency, flag exposure, and recovery after mitigation.',
        'Google SRE guidance emphasizes alerting on symptoms, making alerts actionable, and using incident management process to coordinate response: https://sre.google/resources/practices-and-processes/incident-management-guide/. The candidate graph should support that process rather than replace it.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Checkout starts burning error budget in one region. The graph links the symptom to checkout, checkout to database waits through traces, checkout to version 42 through deploy metadata, and checkout to a newly enabled feature flag. The ranker puts the deploy first because it aligns with the SLI start time, affects the same region, and appears on slow trace paths. Database waits remain a strong supporting candidate.',
        'The responder rolls back version 42. If p99 and 5xx recover, the graph records recovery_after rollback as evidence. If nothing changes, the deploy score should fall and the database or flag candidates should rise. The graph is a living incident object, not a static dashboard.',
      ],
    },
    {
      heading: 'Tradeoffs',
      paragraphs: [
        'Causal graphs can speed triage, but they can also amplify false certainty. Deployment data is especially dangerous because recent changes are easy to blame. The graph should display why a candidate is ranked, what evidence is missing, and which mitigation would test the hypothesis with low blast radius.',
        'The score should be calibrated against closed incident history. Track top-k candidate hit rate, false leader rate, time to first useful candidate, evidence link coverage, manual override rate, and time saved during incidents.',
      ],
    },
    {
      heading: 'Pitfalls',
      paragraphs: [
        'Do not call the top candidate the root cause before confirmation. A candidate graph is an investigation aid. Postmortem cause analysis still needs evidence, responder notes, mitigation results, and sometimes code or data analysis outside the telemetry stream.',
        'A second pitfall is missing topology. If the service dependency graph is stale, the ranker can miss hidden shared dependencies and incorrectly split one incident into several unrelated pages.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study AIOps Incident Response, Alert Correlation Fingerprint Index, Distributed Tracing, Metric Exemplars Trace Correlation, Causal Graphs, Feature Flag Control Plane, SLO Error Budget Burn Rate Alert, and Runbook Automation Approval Ledger next.',
      ],
    },
  ],
};
