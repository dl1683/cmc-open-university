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
    {
      heading: 'What it is',
      paragraphs: [
        'A federated client cohort sampler chooses which devices participate in each training round. It is part scheduler, part privacy guardrail, part fairness control, and part experiment ledger. The sampler has to pick enough eligible clients while avoiding battery drain, data-plan surprises, repeated participation, and population skew.',
        'Federated Averaging showed that decentralized clients can train a shared model through local updates and server aggregation. In real deployments, the sampling process decides which local updates exist in the first place. A biased cohort can make the model converge faster on the wrong population.',
        'This topic sits between machine learning and fleet operations. The optimizer only sees updates from clients the sampler admitted. The privacy accountant only spends budget for clients that participated. The product only benefits if the participating clients resemble the users the model is supposed to serve.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious sampler is first come, first served: train on whichever devices are online right now. That is attractive because it fills rounds quickly. It also overrepresents users with reliable power, strong connectivity, recent app versions, and time zones that match the scheduler.',
        'Another tempting approach is strict population quotas. That protects representation but can starve rounds when rare slices are unavailable, increase dropout, or repeatedly sample the same reachable clients from scarce groups. A real sampler balances eligibility, quota, cooldown, dropout, privacy, and training deadlines.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core insight is that client selection is part of the training distribution. It is not neutral plumbing. The cohort sampler determines which data shapes, device classes, languages, regions, and app versions influence a round. If the cohort drifts, the model update drifts.',
        'The second insight is that sampling needs a ledger. A cohort without records cannot be audited. The system should know target counts, draw counts, join counts, completion counts, stratum misses, repeat-use caps, dropout reasons, and whether the round was accepted or discarded. Those fields make later model regressions explainable.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The server publishes a task with model version, objective, minimum client count, time limit, and policy constraints. Clients become eligible only when local conditions pass: charging, idle, acceptable network, compatible software, and allowed geography or consent state. The eligible pool is then sampled with quotas, caps, cooldowns, and an overdraw buffer for expected dropout.',
        'The data structure is a live queue plus a cohort ledger. The queue manages availability and deadlines. The ledger stores target count, drawn count, joined count, completion count, stratum coverage, dropout, and reasons for exclusion. Later systems can join that ledger to privacy spend and model metrics.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'In the eligibility-funnel view, follow the task from policy to queue to sample to training. The highlighted cells are not paperwork; they are the controls that decide whether the round is legal, fair, and useful. The ledger frame is the audit trail that lets someone later explain why the final 9,800 clients were accepted.',
        'In the cohort-balance view, compare three distributions: the whole fleet, the devices online now, and the sampled cohort. The gap between online and fleet is the bug a naive sampler would ship. The quota and repair frames show how the sampler corrects that gap without pretending every missing slice can be filled cheaply.',
        'The feedback loop at the end is important. Sampling decisions affect training quality, privacy spend, and future eligibility. Cooldowns, scarcity estimates, and dropout buffers should update from observed rounds rather than live forever as constants from the first launch.',
      ],
    },
    {
      heading: 'Why it matters',
      paragraphs: [
        'Federated learning is naturally non-IID. The people online at a given hour are not a random sample of all users. Device capability, language, region, app version, and network quality all affect who can participate. Client selection therefore changes both convergence and fairness.',
        'A model can improve average validation accuracy while hurting rare slices if the sampler repeatedly misses them. Conversely, aggressively forcing rare slices can increase latency, dropout, and privacy exposure. The sampler exists to make those tradeoffs explicit before the optimizer ever runs.',
        'It also matters for privacy. Reusing the same small group of reliable clients can increase exposure and consume privacy budget unevenly. Cooldowns and participation caps are not cosmetic fairness features; they reduce repeated influence by the easiest-to-reach clients.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'A cohort sampler works by making the hidden selection process measurable and adjustable. Eligibility filters protect the user experience. Stratified quotas protect population coverage. Overdraw buffers absorb expected dropout. Cooldowns reduce repeated use. Repair rules decide what to do when a stratum cannot be filled.',
        'The sampler cannot make unavailable users available, but it can prevent the system from pretending availability is random. That distinction is the whole point. Once online skew is visible, the team can choose whether to wait longer, lower a quota, skip a round, or accept a known bias with an audit record.',
      ],
    },
    {
      heading: 'Case study',
      paragraphs: [
        'Consider a keyboard model round that needs 10,000 completed updates. The fleet has millions of devices, but only some are charging, idle, online, on Wi-Fi, and running the right model version. The sampler draws 13,000 clients because historical dropout is around 25 percent. It also caps repeated participation and repairs underrepresented language strata before the round starts.',
        'The result is not just a model update. It is an auditable cohort record: who was eligible in aggregate, how many were sampled per stratum, how many dropped, and whether the final sample still matches the policy. That record becomes evidence for privacy accounting and post-training evaluation.',
        'If a low-end device slice repeatedly drops after selection, the sampler should not silently replace it with high-end devices and call the round balanced. It should record the miss, adjust overdraw or scheduling, and let the model-release gate decide whether the final cohort is acceptable. The point of the sampler is honest selection, not hiding scarcity.',
      ],
    },
    {
      heading: 'What to measure',
      paragraphs: [
        'Useful metrics include eligibility rate, queue wait time, join rate, completion rate, dropout by slice, repeat participation, privacy-budget spend, update-norm distribution, and final cohort distance from the target population. These numbers should be attached to each model candidate.',
        'The sampler should also be evaluated against downstream validation slices. If a cohort looks balanced by device class but regresses one language or region, the quota design is still wrong. Cohort health and model quality have to be read together.',
      ],
    },
    {
      heading: 'Pitfalls',
      paragraphs: [
        'Do not sample only the clients that are easiest to reach. Do not treat dropout as random if low-end devices, regions, or user groups drop more often. Do not reuse the same active clients every round without cooldown, because repeated participation can raise privacy risk and skew the model.',
        'Do not hide sampling rules inside opaque scheduler code. The rules affect privacy, fairness, and convergence, so they deserve the same review as optimizer hyperparameters. A practical sampler should publish cohort ledgers, repeat-use caps, stratum misses, dropout assumptions, and repair decisions with the model candidate.',
        'Do not evaluate the sampler only by whether a round filled. A full round can be bad if it is skewed, stale, privacy-heavy, or drawn from a subset that will not represent deployment. The right dashboard joins cohort metrics to model metrics.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Federated Averaging at https://arxiv.org/abs/1602.05629, TensorFlow Federated overview at https://www.tensorflow.org/federated, and client-selection survey material at https://arxiv.org/pdf/2211.01549. Study Federated Learning and Secure Aggregation, Differential Privacy SGD, Feature Freshness SLO Monitor, Training-Serving Skew Replay Diff, Backpressure, and Distributed Tracing next.',
        'Then inspect one real cohort ledger end to end before trusting the model update.',
      ],
    },
  ],
};
