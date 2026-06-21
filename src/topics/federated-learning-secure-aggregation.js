// Federated learning with secure aggregation: devices train locally, the server
// averages updates, and cryptographic masks hide individual contributions.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'federated-learning-secure-aggregation',
  title: 'Federated Learning & Secure Aggregation',
  category: 'AI & ML',
  summary: 'Train from decentralized data: local client updates, federated averaging, secure aggregation, and differential privacy tradeoffs.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['federated averaging', 'secure aggregation'], defaultValue: 'federated averaging' },
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

function federationGraph(title) {
  return graphState({
    nodes: [
      { id: 'server', label: 'server', x: 4.6, y: 1.0, note: 'global model' },
      { id: 'phoneA', label: 'device A', x: 1.2, y: 4.6, note: 'local data' },
      { id: 'phoneB', label: 'device B', x: 3.4, y: 5.8, note: 'local data' },
      { id: 'phoneC', label: 'device C', x: 5.9, y: 5.8, note: 'local data' },
      { id: 'phoneD', label: 'device D', x: 8.0, y: 4.6, note: 'local data' },
    ],
    edges: [
      { id: 'e-server-a', from: 'server', to: 'phoneA', weight: 'model' },
      { id: 'e-server-b', from: 'server', to: 'phoneB', weight: 'model' },
      { id: 'e-server-c', from: 'server', to: 'phoneC', weight: 'model' },
      { id: 'e-server-d', from: 'server', to: 'phoneD', weight: 'model' },
    ],
  }, { title });
}

function* federatedAveraging() {
  yield {
    state: federationGraph('The server sends the current model to devices'),
    highlight: { active: ['server', 'e-server-a', 'e-server-b', 'e-server-c', 'e-server-d'], compare: ['phoneA', 'phoneB', 'phoneC', 'phoneD'] },
    explanation: 'Read the arrows as a round boundary: the server sends model weights out, devices compute locally, and raw examples stay behind the device boundary. The highlighted server is coordination, not a data warehouse.',
  };

  yield {
    state: labelMatrix(
      'Clients train locally on non-IID data',
      [
        { id: 'a', label: 'device A' },
        { id: 'b', label: 'device B' },
        { id: 'c', label: 'device C' },
        { id: 'd', label: 'device D' },
      ],
      [
        { id: 'data', label: 'local data shape' },
        { id: 'update', label: 'model update' },
      ],
      [
        ['mostly English typing', 'delta A'],
        ['mostly Spanish typing', 'delta B'],
        ['new slang', 'delta C'],
        ['few examples', 'delta D'],
      ],
    ),
    highlight: { active: ['a:update', 'b:update', 'c:update', 'd:update'], compare: ['a:data', 'd:data'] },
    explanation: 'Each client runs a few local Gradient Descent steps and sends a model update. The data is naturally unbalanced and non-IID: different users have different languages, habits, devices, and sample counts.',
    invariant: 'The server aggregates updates, not raw examples.',
  };

  yield {
    state: federationGraph('The server averages updates into a new global model'),
    highlight: { active: ['phoneA', 'phoneB', 'phoneC', 'phoneD'], found: ['server'], compare: ['e-server-a', 'e-server-b', 'e-server-c', 'e-server-d'] },
    explanation: 'Federated averaging combines client updates, often weighted by example count. The highlighted clients are not equally informative: skewed data, missing devices, and uneven sample counts decide whether the average is useful.',
  };

  yield {
    state: labelMatrix(
      'What federated learning does and does not provide',
      [
        { id: 'raw', label: 'raw data stays local' },
        { id: 'updates', label: 'updates leave device' },
        { id: 'secure', label: 'secure aggregation' },
        { id: 'dp', label: 'differential privacy' },
      ],
      [
        { id: 'benefit', label: 'benefit' },
        { id: 'remaining risk', label: 'remaining risk' },
      ],
      [
        ['less central collection', 'device data still influences model'],
        ['smaller than data', 'can leak information'],
        ['server sees only sum', 'aggregate can still reveal patterns'],
        ['limits individual influence', 'accuracy and training cost tradeoff'],
      ],
    ),
    highlight: { found: ['raw:benefit', 'secure:benefit', 'dp:benefit'], compare: ['updates:remaining risk'] },
    explanation: 'Federated learning is a data-minimization architecture, not a full privacy proof. Secure aggregation and differential privacy add stronger guarantees at additional cost.',
  };
}

function* secureAggregation() {
  yield {
    state: labelMatrix(
      'Pairwise masks cancel in the aggregate',
      [
        { id: 'a', label: 'device A' },
        { id: 'b', label: 'device B' },
        { id: 'c', label: 'device C' },
        { id: 'sum', label: 'server sum' },
      ],
      [
        { id: 'update', label: 'true update' },
        { id: 'mask', label: 'added masks' },
        { id: 'sent', label: 'sent value' },
      ],
      [
        ['+4', '+rAB - rCA', 'masked A'],
        ['+7', '-rAB + rBC', 'masked B'],
        ['+2', '-rBC + rCA', 'masked C'],
        ['+13', 'all masks cancel', 'only aggregate visible'],
      ],
    ),
    highlight: { active: ['a:sent', 'b:sent', 'c:sent'], found: ['sum:update', 'sum:mask'] },
    explanation: 'Read the mask table algebraically. Each random mask appears once positive and once negative, so the server can recover the highlighted aggregate while the individual sent values remain masked.',
  };

  yield {
    state: federationGraph('Dropout makes the protocol harder'),
    highlight: { active: ['phoneA', 'phoneB', 'phoneC'], removed: ['phoneD'], found: ['server'] },
    explanation: 'Real clients disconnect. Practical secure aggregation protocols must handle dropout, otherwise a missing client can leave masks that do not cancel. Failure robustness is a core part of the paper.',
    invariant: 'Privacy and dropout recovery must be designed together.',
  };

  yield {
    state: labelMatrix(
      'Differential privacy clips and noises the update',
      [
        { id: 'clip', label: 'clip update norm' },
        { id: 'noise', label: 'add noise' },
        { id: 'account', label: 'privacy accounting' },
        { id: 'utility', label: 'utility check' },
      ],
      [
        { id: 'purpose', label: 'purpose' },
        { id: 'tradeoff', label: 'tradeoff' },
      ],
      [
        ['bound one user influence', 'can blunt useful signal'],
        ['hide participation', 'lowers accuracy if too large'],
        ['track epsilon', 'budget is consumed over rounds'],
        ['validate quality', 'privacy is not free'],
      ],
    ),
    highlight: { active: ['clip:purpose', 'noise:purpose', 'account:purpose'], compare: ['utility:tradeoff'] },
    explanation: 'Differential privacy adds a different guarantee: the aggregate output should not depend too much on any one participant. The price is noise, clipping, privacy accounting, and possible quality loss.',
  };

  yield {
    state: labelMatrix(
      'Production concerns',
      [
        { id: 'selection', label: 'client selection' },
        { id: 'comm', label: 'communication' },
        { id: 'non_iid', label: 'non-IID data' },
        { id: 'abuse', label: 'poisoning' },
      ],
      [
        { id: 'problem', label: 'problem' },
        { id: 'response', label: 'response' },
      ],
      [
        ['available devices vary', 'sample carefully'],
        ['updates are expensive', 'compress and round less often'],
        ['users differ', 'robust aggregation and evaluation'],
        ['hostile clients send bad updates', 'anomaly checks and clipping'],
      ],
    ),
    highlight: { found: ['selection:response', 'comm:response', 'non_iid:response', 'abuse:response'] },
    explanation: 'A federated system is a distributed system with privacy constraints. Availability, bandwidth, skew, adversaries, and monitoring all affect whether the model actually improves.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'federated averaging') yield* federatedAveraging();
  else if (view === 'secure aggregation') yield* secureAggregation();
  else throw new InputError('Pick a federated-learning view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Federated learning trains a shared model from decentralized data. Instead of collecting raw user data in a central warehouse, the server sends a model to clients, clients train locally, and the server aggregates updates. The canonical algorithm is federated averaging: local training followed by weighted averaging of client model updates.',
        {
          type: 'callout',
          text: 'Federated learning moves computation to private data, then secure aggregation narrows what the server can observe to the cohort sum.',
        },
        'Secure aggregation strengthens the privacy story by hiding individual client updates from the server. The server sees only the aggregate sum. Differential privacy can add another layer by clipping and noising updates so any one participant has bounded influence. These ideas match the local corpus note on privacy-preserving ML: practical systems combine architecture, cryptography, and statistical noise, each with a cost.',
      ],
    },
    {
      heading: 'The obvious attempt',
      paragraphs: [
        'The obvious way to train from user behavior is to collect all examples in one warehouse and run ordinary centralized training. That is simpler for optimization, debugging, and evaluation. It also concentrates sensitive data, increases breach impact, creates policy and consent problems, and can be impossible when data is legally or operationally stuck on devices, hospitals, browsers, or edge deployments.',
        'Another tempting answer is to send anonymized records. That usually fails as a privacy story. High-dimensional behavior, text, location, medical measurements, and usage traces can reidentify people when joined with other data. Federated learning tries a different boundary: move the model to the data, not the data to the model. Secure aggregation then limits what the coordinator can inspect about any one participant update.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core insight is that many learning algorithms need gradients or weight updates, not raw examples. A client can download the current model, take several local gradient steps, and send back a delta. The server can average deltas across many clients and produce a new global model. When the cohort is large enough and the update rule is stable enough, the aggregate can move the model in a useful direction without centralizing examples.',
        'Secure aggregation changes the trust shape. Each client masks its update with random values arranged so masks cancel in the sum. The server can recover the aggregate but not one row. Differential privacy changes the statistical shape by clipping update norms and adding noise so participation of one client has limited influence. These layers solve different problems and should not be collapsed into one vague privacy claim.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A training round selects available clients, sends the current model, runs local optimization, receives updates, aggregates them, and publishes a new global model. Because client data is non-IID, updates can point in different directions. Because clients are phones or edge devices, availability and bandwidth dominate. Because updates can leak information, secure aggregation and differential privacy may be required.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/Centralized_federated_learning_protocol.png/250px-Centralized_federated_learning_protocol.png',
          alt: 'Central server coordinating model updates from several smartphones in federated learning',
          caption: 'A central federated-learning round sends a model to clients and receives updates instead of raw examples. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Centralized_federated_learning_protocol.png',
        },
        'Secure aggregation often uses masks that cancel only when summed. Each client sends a masked update; the server can add masked updates to recover the aggregate but cannot inspect one client contribution. Practical protocols also handle client dropout, which is essential because mobile devices disappear during rounds. Shamir Secret Sharing is the next useful primitive: it explains how recovery material can be split so masks can be repaired only with a threshold of cooperating clients.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The federated-averaging view is proving that the server is a coordinator, not a data warehouse. The server sends a model out, clients train on local examples, and the only thing that comes back is an update. The client matrix is the warning label: those updates are not clean samples from one balanced dataset. Language, behavior, device quality, sample count, and availability all skew the average.',
        'The secure-aggregation view is proving an algebraic boundary. Every random mask appears once positive and once negative across the cohort, so the masks disappear only after aggregation. The dropout frame is the production twist. If a device disappears mid-round, cancellation can break unless the protocol has recovery shares and abort thresholds. Privacy and fault tolerance are part of the same design.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Federated averaging works when local training is a useful approximation to centralized gradient descent. The server is not seeing examples, but it is still combining many noisy estimates of how the model should change. Weighting by local example count can reduce variance, while cohort sampling spreads participation across the population.',
        'Secure aggregation works because the server only needs a sum. It does not need to inspect each update to compute the mean. The cryptographic protocol exploits that narrow requirement. Differential privacy works only after update influence is bounded; clipping controls the maximum contribution and noise hides small participation effects. The price is lower signal, more rounds, or lower accuracy if the privacy budget is tight.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Federated learning trades central data collection for orchestration complexity. Communication rounds are expensive. Client data is skewed. Devices have limited battery, compute, and connectivity. Secure aggregation adds cryptographic setup and dropout recovery. Differential privacy adds clipping, noise, privacy accounting, and usually some model-quality cost. Poisoning and sybil attacks remain a threat if hostile clients can participate.',
        'The evaluation must track model quality across user slices, communication cost, privacy budget, dropout rate, fairness, and robustness. A global average can improve while minority user groups regress. A privacy budget can be consumed over repeated rounds. A secure aggregate can still be poisoned if the aggregation rule trusts every update equally. The hard question is not "can we train without uploading data?" but "can we prove the shipped model improved without hiding privacy or slice failures?"',
        'The systems cost also appears in rollout. Client selection must avoid draining batteries or biasing toward always-online users. Updates need compression, scheduling, and retry limits. The server needs cohort ledgers, secure-aggregation round state, privacy-accountant state, and rollback records for model releases. Without those records, a team cannot explain which users influenced a model, which privacy budget was spent, or why one training round was accepted.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Federated learning is used or studied for keyboard prediction, speech personalization, mobile recommendations, health data, wearable sensors, browser telemetry, edge AI, and settings where raw data is too sensitive or too large to centralize. The same concepts connect to Parameter Server Case Study, Gradient Descent, Backpressure, and Distributed Tracing because the training loop becomes an unreliable distributed workflow.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Federated learning does not automatically mean private. Model updates can leak information. The server can still learn aggregate behavior. Differential privacy must be designed and accounted for. Secure aggregation hides individual updates from the aggregator, but it does not make malicious updates harmless. Another misconception is that federated learning is only a machine-learning algorithm. It is also a fleet-management, networking, security, privacy, and evaluation problem.',
        'Practical guidance: log cohort statistics, dropout, secure-aggregation thresholds, DP spend, validation slices, and rollback decisions for every candidate model. If those records are missing, the system may be doing distributed training, but it is not producing a reviewable privacy-preserving ML artifact.',
        'A final misconception is that keeping data local removes consent and governance work. Users still need to know what training happens, when devices participate, what leaves the device, how privacy budget is spent, and how to opt out. Federated learning narrows data movement; it does not erase the obligation to explain the system.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Federated Averaging at https://arxiv.org/abs/1602.05629, Practical Secure Aggregation at https://eprint.iacr.org/2017/281 and https://research.google/pubs/practical-secure-aggregation-for-privacy-preserving-machine-learning/, and Deep Learning with Differential Privacy at https://arxiv.org/abs/1607.00133. Study Shamir Secret Sharing, Gradient Descent, Parameter Server Case Study, Batch Size Scaling, Backpressure, Differential Privacy SGD, Membership Inference Shadow Model Case Study, Model Inversion Confidence Attack, and Privacy-aware evaluation topics next.',
      ],
    },
  ],
};
