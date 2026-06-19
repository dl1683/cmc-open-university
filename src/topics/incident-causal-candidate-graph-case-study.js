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
        "Read the animation as the execution trace for Incident Causal Candidate Graph Case Study. Model incidents as evidence graphs: symptoms, dependencies, traces, deploys, flags, blast radius, and ranked root-cause candidates with auditable uncertainty..",
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        `An incident causal candidate graph exists because modern incidents rarely arrive as one clean alert with one obvious cause. A user-visible SLI burns. Dozens of services, dashboards, traces, logs, deploys, feature flags, queues, and databases move at the same time. Responders need a way to assemble evidence quickly without pretending that early evidence is proof.`,
        `The graph is not an oracle. It is a structured investigation object. It keeps symptoms, dependencies, changes, traces, and mitigations connected so responders can see why a candidate is ranked and what evidence would confirm or weaken it. That difference matters during an outage. A tool that says "root cause: deploy v42" too early can make the team chase the easiest story instead of the strongest evidence.`,
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        `The obvious approach is alert correlation. Group alerts that fire around the same time, page the owning team, and open dashboards for the suspected services. That is useful, especially when the alternative is a flood of unrelated pages. It still leaves responders doing most of the causal assembly in their heads. Time coincidence is not causality, and grouped symptoms do not say which action should be tried first.`,
        `The second common approach is recent-change bias. If a deploy or flag change happened near the start of the incident, roll it back. That is often a good mitigation test, but it is not a root-cause proof. Databases can saturate because a downstream queue drained. A deploy can be correlated because it happened during normal release hours. A graph should make recent changes visible without letting them dominate every investigation by default.`,
        `The failure is missing context under time pressure. During an incident, nobody has time to manually join the service catalog, topology graph, tracing backend, deployment history, feature-flag audit log, error-budget dashboard, log templates, queue metrics, and ownership data. Those signals also carry different meanings: trace evidence, topology evidence, temporal evidence, and change evidence should not collapse into one generic correlation score.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `The core insight is to model root cause as a ranked hypothesis with evidence, not as a label emitted by a model. The graph can connect a user-facing SLI to affected endpoints, endpoints to services, services to dependencies, traces to slow spans, log templates to error bursts, deploys to changed code, flags to exposed cohorts, and mitigations to recovery. Each connection carries type, time, source, confidence, and evidence links.`,
        `That structure lets the ranker stay explainable. A candidate rises because it is close to the symptom in topology, appears on affected trace paths, changed before the burn started, matches the blast radius, or improves when mitigated. A candidate falls because recovery did not happen after the mitigation, the trace concentration moved elsewhere, or counterevidence shows unaffected traffic crossed the same component.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `When an incident opens, the system seeds the graph with the lead symptom: for example, checkout p99 latency and 5xx rate crossing an SLO burn threshold in one region. It expands outward through service topology, recent deployments, feature-flag changes, sampled traces, log clusters, resource saturation, queue lag, database waits, and ownership metadata. The graph store can be a graph database, document graph, or in-memory incident object. The required contract is typed edges with provenance.`,
        `The ranker then scores candidate causes and candidate actions. Features can include graph distance from the symptom, temporal order, trace concentration, affected-region overlap, cohort exposure, deployment recency, saturation, error-template match, and recovery after mitigation. The output should be a ledger: candidate, evidence, counterevidence, confidence, suggested reversible test, and owner. That ledger is more useful than a single root-cause badge.`,
      ],
    },
    {
      heading: 'How it works (2)',
      paragraphs: [
        `The candidate-graph view proves that incidents are assembled from heterogeneous evidence. The dependency path from user SLI to checkout to database explains blast radius. The deploy and flag nodes explain plausible recent changes. The trace node ties evidence to real affected requests. None of those edges alone proves causality. Together they define a ranked search space for responders.`,
        `The ranking view proves that scores should move as evidence arrives. A deploy can start as the top candidate because it changed before the burn and appears on slow traces. If rollback fixes p99 latency and error rate, the graph records recovery evidence and the deploy candidate strengthens. If rollback changes nothing, the deploy score should fall and database, queue, or flag candidates should rise. The graph earns trust by changing its mind.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `The approach works because it starts from symptoms rather than internal guesses. Google SRE guidance emphasizes alerting on user-facing symptoms and actionable signals. A symptom-rooted graph keeps the investigation tied to user impact. Topology narrows which systems can plausibly explain the symptom. Traces add request-level paths. Logs and metrics add repeated patterns. Change data adds reversible tests.`,
        `Mitigation evidence gives the graph a weak but useful experimental loop. Rolling back a deploy, disabling a flag, draining traffic, or scaling a dependency is not only an action; it is a test against the hypothesis. If the user-facing SLI recovers and the supporting trace or log pattern disappears, confidence should rise. If not, the candidate should be demoted. The graph is a causal candidate graph because it records tests, not because it magically observes causality.`,
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        `The main cost is integration. The graph needs service ownership, dependency topology, trace links, log templates, deployment metadata, flag audit trails, SLO burn rates, resource metrics, queue metrics, database wait signals, and incident actions. OpenTelemetry semantic conventions help by standardizing names across traces, metrics, logs, and resources, but most organizations still have gaps and local naming drift.`,
        `The ranker must also be calibrated. Useful metrics include top-k candidate hit rate after postmortem review, false-leader rate, time to first useful candidate, evidence-link coverage, manual override rate, missing-topology discoveries, and time saved during response. A graph that is fast but confidently wrong is worse than a dashboard. A graph that shows uncertainty and missing evidence can still be useful.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `This pattern wins in microservice environments where topology is large and ownership is distributed. It helps on-call engineers narrow the search space, incident commanders explain why a mitigation is being tried, and postmortem authors preserve the evidence trail. It is especially useful when a symptom crosses several layers, such as edge errors caused by checkout timeouts caused by database pool starvation caused by a feature-flagged query path.`,
        `It also wins for AIOps systems that need auditability. A black-box root-cause model may be hard to trust during a high-stakes outage. A candidate graph can expose the actual supporting edges and let humans override the ranking. The system can learn from closed incidents without removing the responder's judgment during live response.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `The largest failure is false certainty. A top-ranked candidate is still a candidate until mitigation, code evidence, data evidence, or postmortem analysis confirms it. Another failure is stale topology. If the service graph misses a hidden shared dependency, the ranker can split one incident into several unrelated problems or miss the actual bottleneck.`,
        `Action bias is also dangerous. Rollbacks and flag disables are attractive because they are concrete, but they can cause collateral damage or distract from a saturated shared dependency. Sampling bias can hide rare paths. Log-template grouping can merge different errors. Security and privacy rules may limit how much trace or user data can be stored in the evidence graph. The graph should show these weaknesses instead of burying them under a score.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Study AIOps Incident Response for the broader workflow, Alert Correlation Fingerprint Index for grouping symptoms, Distributed Tracing for request-path evidence, Metric Exemplars Trace Correlation for joining metrics to traces, Causal Graphs for formal causal language, Feature Flag Control Plane for change evidence, SLO Error Budget Burn Rate Alert for symptom-first paging, and Runbook Automation Approval Ledger for safe mitigation actions. Then compare this graph with ordinary dashboard triage and ask what evidence each method preserves or loses.`,
      ],
    },
      {
      heading: 'The wall',
      paragraphs: [
        "Every topic in this pattern has a hard boundary where a tempting shortcut fails; define that boundary first.",
        "State the exact invariant that must hold, show one operation sequence that can break it, and explain what changes after a failure and why.",
        "If you can reproduce this wall in one example, the rest of the page is motivated.",
      ],
    },

    {
      heading: 'Worked example',
      paragraphs: [
        "Trace one representative example end-to-end so readers can watch state evolve across every step.",
        "Keep the walkthrough concise and precise: at each step, write current state, action taken, and resulting output.",
        "The goal is prediction, not a one-off demonstration.",
      ],
    },
    {
      heading: 'Learning map',
      paragraphs: [
        'Before this topic, check your prerequisites and map what is assumed, what is computed, and where this mechanism first appears in real systems.',
        'After this topic, follow each unlock topic and test whether you can explain why this mechanism unlocks it.',
        'Use the frame order to prove one invariant per frame and one cost consequence per major operation.',
      ],
    },

    {
      heading: 'Frame-by-frame checkpoints',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Pause on each state change and name exactly what data moved, which references changed, and why the move is legal.',
            'State the invariant that must remain true before the next frame starts.',
            'Track what changed in size, order, ownership, or topology for the operation you are watching.',
            'Translate the active frame into a one-line explanation as if teaching a teammate.',
          ],
        },
      ],
    },

    {
      heading: 'Micro checks',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Can you state one operation-level invariant in one sentence?',
            'Can you derive the time cost from the frame sequence without referencing external formulas?',
            'Can you name one hidden edge case where the naive implementation fails?',
            'Can you transfer this mechanism to one system from a different domain?',
          ],
        },
      ],
    },

    {
      heading: 'Try this now',
      paragraphs: [
        'Build one counterexample input by hand and predict every animation frame before running it; compare your prediction to the trace.',
        'Use this topic as a checkpoint: if you can explain why Incident Causal Candidate Graph Case Study moves from input to output in the animation and where it fails, you are ready for the next topic.',
      ],
    },

      {
        heading: 'Sources and study next',
        paragraphs: [
          'Read one primary source, one implementation source, and one production case where this idea appears.',
          'If they disagree on a detail, prefer the source with the clearest constraint and define the simplification for this animation.',
          'Then choose three study topics: one prerequisite, one extension, and one case study for your next session.',
        ],
      },
],
};

