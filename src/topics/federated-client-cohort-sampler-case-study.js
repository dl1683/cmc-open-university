// Federated client cohort sampling: turn a noisy device fleet into a balanced,
// eligible training cohort without overfitting to whichever clients are online.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'federated-client-cohort-sampler-case-study',
  title: 'Federated Client Cohort Sampler Case Study',
  category: 'AI & ML',
  summary: 'A federated-learning operations case study: eligibility filters, availability queues, stratified sampling, quota repair, dropout buffers, fairness audits, and cohort ledgers.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['eligibility funnel', 'cohort balance'], defaultValue: 'eligibility funnel' },
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

function samplerGraph(title) {
  return graphState({
    nodes: [
      { id: 'task', label: 'task', x: 1.0, y: 1.1, note: 'round' },
      { id: 'eligible', label: 'elig', x: 3.0, y: 1.1, note: 'filter' },
      { id: 'queue', label: 'queue', x: 5.0, y: 1.1, note: 'avail' },
      { id: 'sample', label: 'sample', x: 7.0, y: 1.1, note: 'quota' },
      { id: 'train', label: 'train', x: 7.8, y: 3.7, note: 'local' },
      { id: 'audit', label: 'audit', x: 4.6, y: 5.5, note: 'ledger' },
      { id: 'backoff', label: 'backoff', x: 1.7, y: 4.2, note: 'cool' },
    ],
    edges: [
      { id: 'e-task-elig', from: 'task', to: 'eligible', weight: 'rules' },
      { id: 'e-elig-queue', from: 'eligible', to: 'queue', weight: 'ready' },
      { id: 'e-queue-sample', from: 'queue', to: 'sample', weight: 'draw' },
      { id: 'e-sample-train', from: 'sample', to: 'train', weight: 'model' },
      { id: 'e-train-audit', from: 'train', to: 'audit', weight: 'stats' },
      { id: 'e-audit-backoff', from: 'audit', to: 'backoff', weight: 'cap' },
      { id: 'e-backoff-elig', from: 'backoff', to: 'eligible', weight: 'next' },
    ],
  }, { title });
}

function* eligibilityFunnel() {
  yield {
    state: samplerGraph('A federated round starts as a task, not a training job'),
    highlight: { active: ['task', 'eligible', 'e-task-elig'], compare: ['queue', 'sample', 'train'] },
    explanation: 'Read this as the control plane before training starts. The server publishes a task, but the useful object is the live cohort queue: who is eligible, who is available, and who should not be reused yet.',
  };
  yield {
    state: labelMatrix(
      'Eligibility filters',
      [
        { id: 'battery', label: 'battery' },
        { id: 'wifi', label: 'wifi' },
        { id: 'idle', label: 'idle' },
        { id: 'ver', label: 'ver' },
        { id: 'cool', label: 'cool' },
      ],
      [
        { id: 'pass', label: 'pass?' },
        { id: 'why', label: 'why' },
      ],
      [
        ['yes', 'avoid drain'],
        ['yes', 'save data'],
        ['yes', 'low jank'],
        ['yes', 'same model'],
        ['maybe', 'fair reuse'],
      ],
    ),
    highlight: { active: ['battery:pass', 'wifi:pass', 'idle:pass', 'ver:pass'], compare: ['cool:pass'] },
    explanation: 'Filtering is a privacy and product guardrail. Devices should be charging, unmetered, idle, on the right app/model version, and not repeatedly sampled just because they are often online.',
    invariant: 'The queue admits eligible devices, not every reachable device.',
  };
  yield {
    state: samplerGraph('Availability is a queue with timeout and backoff'),
    highlight: { active: ['eligible', 'queue', 'sample', 'e-elig-queue', 'e-queue-sample'], removed: ['backoff'], found: ['audit'] },
    explanation: 'The queue is deliberately elastic. It keeps a rolling pool, applies deadlines, over-selects for expected dropout, and cools down recently used devices so the same reliable clients do not dominate every round.',
  };
  yield {
    state: labelMatrix(
      'Round cohort ledger',
      [
        { id: 'target', label: 'target' },
        { id: 'drawn', label: 'drawn' },
        { id: 'joined', label: 'joined' },
        { id: 'done', label: 'done' },
      ],
      [
        { id: 'count', label: 'count' },
        { id: 'action', label: 'action' },
      ],
      [
        ['10k', 'need sum'],
        ['13k', 'drop buf'],
        ['11k', 'train'],
        ['9.8k', 'accept?'],
      ],
    ),
    highlight: { active: ['target:count', 'drawn:action'], found: ['done:action'], compare: ['joined:count'] },
    explanation: 'The round ledger records target count, overdraw, join rate, completion rate, timeout, and final acceptance. Without that ledger, privacy accounting and model-quality regressions become impossible to debug.',
  };
}

function* cohortBalance() {
  yield {
    state: plotState({
      axes: { x: { label: 'stratum id', min: 0, max: 5 }, y: { label: 'share percent', min: 0, max: 55 } },
      series: [
        { id: 'fleet', label: 'fleet', points: [{ x: 1, y: 45 }, { x: 2, y: 25 }, { x: 3, y: 18 }, { x: 4, y: 12 }] },
        { id: 'online', label: 'online now', points: [{ x: 1, y: 53 }, { x: 2, y: 22 }, { x: 3, y: 15 }, { x: 4, y: 10 }] },
        { id: 'cohort', label: 'sample', points: [{ x: 1, y: 44 }, { x: 2, y: 26 }, { x: 3, y: 18 }, { x: 4, y: 12 }] },
      ],
      markers: [
        { id: 'hot', x: 1, y: 53, label: 'online skew' },
        { id: 'fixed', x: 1, y: 44, label: 'quota fix' },
      ],
    }),
    highlight: { active: ['online', 'hot'], found: ['cohort', 'fixed'], compare: ['fleet'] },
    explanation: 'The plot compares the fleet, the clients online now, and the final sample. Naive sampling would follow the online skew; quotas pull the cohort back toward the population the model is supposed to serve.',
  };
  yield {
    state: labelMatrix(
      'Quotas',
      [
        { id: 'lang', label: 'lang' },
        { id: 'tier', label: 'tier' },
        { id: 'ver', label: 'ver' },
        { id: 'geo', label: 'geo' },
      ],
      [
        { id: 'quota', label: 'quota' },
        { id: 'repair', label: 'repair' },
      ],
      [
        ['by use', 'fill rare'],
        ['by hw', 'cap fast'],
        ['latest', 'block old'],
        ['policy', 'local law'],
      ],
    ),
    highlight: { active: ['lang:quota', 'tier:quota', 'geo:quota'], found: ['lang:repair'], compare: ['ver:repair'] },
    explanation: 'The sampler is a data structure with quotas, caps, and repair rules. It should not silently replace hard-to-reach clients with easy clients if that changes the model objective.',
  };
  yield {
    state: samplerGraph('Sampler audits feed the next round'),
    highlight: { active: ['audit', 'backoff', 'eligible', 'e-audit-backoff', 'e-backoff-elig'], found: ['sample'], compare: ['train'] },
    explanation: 'Cohort statistics feed back into the next round: client cooldown, stratum scarcity, failure rates, update norms, and privacy spend. The sampler becomes a control loop.',
  };
  yield {
    state: labelMatrix(
      'Cohort ledger',
      [
        { id: 'privacy', label: 'privacy' },
        { id: 'fair', label: 'fairness' },
        { id: 'conv', label: 'learn' },
        { id: 'ops', label: 'ops' },
      ],
      [
        { id: 'signal', label: 'signal' },
        { id: 'gate', label: 'gate' },
      ],
      [
        ['repeat use', 'cooldown'],
        ['slice drift', 'quota'],
        ['bad skew', 'rebalance'],
        ['dropout', 'overdraw'],
      ],
    ),
    highlight: { found: ['privacy:gate', 'fair:gate', 'conv:gate', 'ops:gate'] },
    explanation: 'A good sampler turns client selection into an explainable ledger. That ledger is later joined with privacy accounting, secure aggregation metrics, and validation scores.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'eligibility funnel') yield* eligibilityFunnel();
  else if (view === 'cohort balance') yield* cohortBalance();
  else throw new InputError('Pick a federated cohort-sampler view.');
}

export const article = {
  sections: [
    { heading: 'How to read the animation', paragraphs: [
      'The animation shows a federated learning round choosing client devices. Federated learning trains a shared model by sending work to devices, collecting local updates, and aggregating those updates on a server without centralizing raw user data. Active nodes are clients being filtered or selected, found nodes are admitted participants, and compare nodes are fairness or eligibility constraints.',
      'The safe inference rule is distribution control. The cohort is not just a scheduling batch; it defines which data distribution contributes gradients this round. A biased sampler can make the model learn the wrong user population even if aggregation is mathematically correct.',
        {type:'callout', text:'Client selection is part of the training distribution, so the sampler is a model-quality control surface rather than neutral scheduling plumbing.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/1/11/Centralized_federated_learning_protocol.png', alt:'Diagram of a central server coordinating federated learning clients.', caption:'Centralized federated learning protocol by MarcT0K, CC BY-SA 4.0, via Wikimedia Commons.'},
    ] },
    { heading: 'Why this exists', paragraphs: [
      'Mobile fleets can contain millions of devices, but a training round may need only thousands. Devices differ by battery level, network type, geography, app version, data distribution, and availability. Choosing clients poorly can waste battery and produce a model that mainly represents always-online users.',
      'A cohort sampler exists to turn fleet chaos into a controlled training sample. It filters unsafe or unavailable devices, balances useful slices, limits repeated participation, and records which population actually trained the model. The optimizer only sees updates from clients the sampler admitted.',
    ] },
    { heading: 'The obvious approach', paragraphs: [
      'The obvious approach is uniform random sampling among currently available clients. It is easy to implement and gives a clean statistical story when availability is independent of user behavior. It also spreads work across the fleet.',
      'The approach is reasonable as a baseline. If 100,000 clients are available and the server needs 1,000 updates, choose 1 percent at random and aggregate their local model deltas. The problem is that availability is rarely neutral.',
    ] },
    { heading: 'The wall', paragraphs: [
      'The wall is selection bias. Devices on Wi-Fi, charging, and recently active are more likely to be eligible, and those users may differ from the population the model serves. Uniform sampling from eligible clients is not the same as uniform sampling from all users.',
      'The second wall is operational failure. Some selected clients drop out, some finish late, and some return updates after the aggregation deadline. The sampler must overselect or adapt while still protecting privacy and avoiding repeated burden on the same devices.',
    ] },
    { heading: 'The core insight', paragraphs: [
      'Treat client selection as a constrained sampling problem. The sampler first defines eligibility, then chooses a cohort that satisfies training size, slice balance, privacy limits, and device-health rules. Sampling probabilities become part of the experiment design.',
      'The cohort ledger is as important as the sample. It records who was eligible, who was invited, who returned, which slice they represented, and how often similar clients were used recently. Without that ledger, model evaluation cannot separate optimizer behavior from sampler bias.',
    ] },
    { heading: 'How it works', paragraphs: [
      'The server starts with an eligibility funnel. A device may need sufficient battery, unmetered network, supported app version, recent local examples, and no recent participation. Each filter reduces the candidate pool before the sampler chooses a cohort.',
      'The sampler then applies quotas or probabilities. It may target 40 percent Android region A, 30 percent Android region B, and 30 percent iOS if those slices matter for model quality. It may also cap repeat selection so one device is not trained every night.',
    ] },
    { heading: 'Why it works', paragraphs: [
      'Correctness is about matching the intended training distribution. If the target is population-weighted learning, then each slice should contribute in proportion to its population or be reweighted during aggregation. If the target is fairness across slices, the sampler can deliberately balance slices and record that choice.',
      'The key invariant is that every included update has a known selection path. Eligibility, invitation probability, dropout, and aggregation weight should be auditable. That makes it possible to reason about bias instead of treating the cohort as a black box.',
    ] },
    { heading: 'Cost and complexity', paragraphs: [
      'Cost behaves with invited clients, not just successful updates. If the round needs 1,000 returned updates and the expected completion rate is 70 percent, the server may invite about 1,430 clients. The extra 430 invitations spend battery, bandwidth, privacy budget accounting, and coordination work.',
      'Balancing slices adds variance and delay. If a rare slice has only 300 eligible clients and the round needs 100 of them, dropout can make the slice miss its quota. The sampler can wait longer, over-invite, or accept imbalance, and each choice changes training behavior.',
    ] },
    { heading: 'Real-world uses', paragraphs: [
      'Client cohort samplers fit keyboard models, ranking models, speech personalization, on-device recommendation, health sensing, and telemetry-limited product learning. The access pattern is many edge devices with private local examples and intermittent availability. The sampler decides which updates exist.',
      'They are also used in federated evaluation. A model can be sent to a sampled cohort for local validation before rollout. The same sampling questions apply because an evaluation cohort biased toward high-end devices can hide failures on the broader fleet.',
    ] },
    { heading: 'Where it fails', paragraphs: [
      'The sampler fails when eligibility rules exclude the users most affected by the model. A rule requiring charging plus Wi-Fi may under-sample lower-connectivity regions. The resulting model can improve aggregate metrics while degrading the slices it barely trained on.',
      'It also fails when privacy accounting and sampling are designed separately. Repeatedly selecting the same small group may spend their privacy budget faster and increase memorization risk. Participation caps and privacy ledgers need to be in the same control loop.',
    ] },
    { heading: 'Worked example', paragraphs: [
      'Suppose 1,000,000 devices exist, 120,000 are eligible tonight, and a training round needs 5,000 returned updates. Historical completion is 80 percent, so the server invites 6,250 devices. If completion matches history, about 5,000 updates arrive before the deadline.',
      'Now split by region. Region A is 50 percent of the target population, region B is 30 percent, and region C is 20 percent, so the returned target is 2,500, 1,500, and 1,000 updates. If region C completion is only 50 percent, inviting 1,250 region C clients yields about 625 updates, short by 375.',
      'The sampler must choose a behavior. It can over-invite region C to 2,000 clients, wait longer for late returns, or reweight the 625 updates. Each choice changes cost, fairness, and statistical variance, so the ledger must record it.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Primary sources: the Federated Averaging paper by McMahan and coauthors, Google federated learning system papers, and client-selection research such as Power-of-Choice and surveys on federated client selection. Study partial participation and non-IID data before tuning sampler policy.',
      'Study next: stochastic sampling, differential privacy accounting, secure aggregation, FedAvg, cohort balancing, dropout handling, and fairness metrics. The main lesson is that the sampler is part of the learning algorithm because it chooses the data the optimizer gets to see.',
    ] },
  ],
};
