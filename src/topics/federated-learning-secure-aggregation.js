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
  const numDevices = 4;
  yield {
    state: federationGraph('The server sends the current model to devices'),
    highlight: { active: ['server', 'e-server-a', 'e-server-b', 'e-server-c', 'e-server-d'], compare: ['phoneA', 'phoneB', 'phoneC', 'phoneD'] },
    explanation: `Read the ${numDevices} arrows as a round boundary: the server sends model weights out to ${numDevices} devices, devices compute locally, and raw examples stay behind the device boundary. The highlighted server is coordination, not a data warehouse.`,
  };

  const devices = [
    { id: 'a', label: 'device A' },
    { id: 'b', label: 'device B' },
    { id: 'c', label: 'device C' },
    { id: 'd', label: 'device D' },
  ];
  yield {
    state: labelMatrix(
      'Clients train locally on non-IID data',
      devices,
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
    explanation: `Each of ${devices.length} clients runs a few local Gradient Descent steps and sends a model update (${devices.map(d => 'delta ' + d.label.slice(-1)).join(', ')}). The data is naturally unbalanced and non-IID: different users have different languages, habits, devices, and sample counts.`,
    invariant: `The server aggregates ${devices.length} updates, not raw examples.`,
  };

  yield {
    state: federationGraph('The server averages updates into a new global model'),
    highlight: { active: ['phoneA', 'phoneB', 'phoneC', 'phoneD'], found: ['server'], compare: ['e-server-a', 'e-server-b', 'e-server-c', 'e-server-d'] },
    explanation: `Federated averaging combines ${devices.length} client updates, often weighted by example count. The highlighted clients are not equally informative: skewed data, missing devices, and uneven sample counts decide whether the average is useful.`,
  };

  const layers = [
    { id: 'raw', label: 'raw data stays local' },
    { id: 'updates', label: 'updates leave device' },
    { id: 'secure', label: 'secure aggregation' },
    { id: 'dp', label: 'differential privacy' },
  ];
  yield {
    state: labelMatrix(
      'What federated learning does and does not provide',
      layers,
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
    explanation: `Federated learning is a data-minimization architecture, not a full privacy proof. All ${layers.length} layers — ${layers.map(l => l.label).join(', ')} — carry remaining risks alongside their benefits.`,
  };
}

function* secureAggregation() {
  const saDevices = [
    { id: 'a', label: 'device A' },
    { id: 'b', label: 'device B' },
    { id: 'c', label: 'device C' },
  ];
  const trueUpdates = [4, 7, 2];
  const aggregateSum = trueUpdates.reduce((a, b) => a + b, 0);
  yield {
    state: labelMatrix(
      'Pairwise masks cancel in the aggregate',
      [...saDevices, { id: 'sum', label: 'server sum' }],
      [
        { id: 'update', label: 'true update' },
        { id: 'mask', label: 'added masks' },
        { id: 'sent', label: 'sent value' },
      ],
      [
        ['+4', '+rAB - rCA', 'masked A'],
        ['+7', '-rAB + rBC', 'masked B'],
        ['+2', '-rBC + rCA', 'masked C'],
        [`+${aggregateSum}`, 'all masks cancel', 'only aggregate visible'],
      ],
    ),
    highlight: { active: ['a:sent', 'b:sent', 'c:sent'], found: ['sum:update', 'sum:mask'] },
    explanation: `Read the mask table algebraically. ${saDevices.length} devices contribute updates (${trueUpdates.join(', ')}), and each random mask appears once positive and once negative, so the server recovers only the aggregate ${aggregateSum} while ${saDevices.length} individual sent values remain masked.`,
  };

  yield {
    state: federationGraph('Dropout makes the protocol harder'),
    highlight: { active: ['phoneA', 'phoneB', 'phoneC'], removed: ['phoneD'], found: ['server'] },
    explanation: `Real clients disconnect. With ${saDevices.length} devices in the protocol, practical secure aggregation must handle dropout — otherwise a missing client can leave masks that do not cancel across the remaining ${saDevices.length - 1}. Failure robustness is a core part of the paper.`,
    invariant: `Privacy and dropout recovery must be designed together — losing 1 of ${saDevices.length} devices must not break mask cancellation.`,
  };

  const dpSteps = [
    { id: 'clip', label: 'clip update norm' },
    { id: 'noise', label: 'add noise' },
    { id: 'account', label: 'privacy accounting' },
    { id: 'utility', label: 'utility check' },
  ];
  yield {
    state: labelMatrix(
      'Differential privacy clips and noises the update',
      dpSteps,
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
    explanation: `Differential privacy adds a different guarantee through ${dpSteps.length} steps: ${dpSteps.map(s => s.label).join(', ')}. The aggregate output should not depend too much on any one of the ${saDevices.length} participants — the price is noise, clipping, privacy accounting, and possible quality loss.`,
  };

  const concerns = [
    { id: 'selection', label: 'client selection' },
    { id: 'comm', label: 'communication' },
    { id: 'non_iid', label: 'non-IID data' },
    { id: 'abuse', label: 'poisoning' },
  ];
  yield {
    state: labelMatrix(
      'Production concerns',
      concerns,
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
    explanation: `A federated system is a distributed system with privacy constraints. All ${concerns.length} production concerns — ${concerns.map(c => c.label).join(', ')} — affect whether the model actually improves.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'The visualization has two views. The federated-averaging view shows a server distributing a model to clients, each client training locally, and the server averaging the returned updates into a new global model. The secure-aggregation view shows each client masking its update with random noise, the server summing the masked updates, and the masks canceling to reveal the true aggregate.',
        'Watch the mask colors: every mask that appears as a positive value on one client appears as a negative on exactly one other. That is the mechanism that makes cancellation work. The dropout frame shows what happens when a device vanishes mid-round and the protocol must recover.',
        {type: 'image', src: './assets/gifs/federated-learning-secure-aggregation.gif', alt: 'Animated walkthrough of the federated learning secure aggregation visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Machine learning models improve by seeing examples. The standard recipe is to collect all examples in one place and train there. But sometimes the examples are private text messages on phones, medical scans in hospitals, or financial records across banks. Moving that data to a central server creates legal liability, breach risk, and user distrust.',
        {
          type: 'callout',
          text: 'Federated learning moves computation to private data, then secure aggregation narrows what the server can observe to the cohort sum.',
        },
        'Federated learning inverts the flow: instead of pulling data to the model, it pushes the model to the data. Each device trains locally and sends back only a model update (a set of number changes, not the original examples). Secure aggregation then ensures the server cannot even inspect individual updates -- it can only see the combined result from all participants.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The straightforward way to train from user data is to upload everything to a warehouse and run standard training. This is simpler to debug, faster to converge, and easier to evaluate. It also concentrates sensitive data in one breach target, creates consent headaches, and may be illegal when data is bound by jurisdiction (health records in the EU, financial data under sector-specific rules).',
        'A common workaround is to anonymize the data before uploading. This fails more often than it works. High-dimensional data -- browsing behavior, location traces, medical measurements -- can be re-identified by joining with other datasets. Removing names is not enough when the data itself is a fingerprint.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Even if you accept federated learning\'s premise (send model updates, not raw data), the server still receives each client\'s individual update. A model update is a high-dimensional vector that encodes what the client learned. Research shows these updates can leak training examples: gradient inversion attacks reconstruct images from gradients, and membership inference can detect whether a specific record was in a client\'s dataset.',
        'So the server coordinator becomes a privacy bottleneck. It does not hold the raw data, but it holds something almost as dangerous: a compressed representation of what each user\'s data looks like. The wall is that federated learning alone does not deliver the privacy promise its marketing implies.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The server does not need to see individual updates. It only needs their sum. If client A sends update [+3, -1, +2] and client B sends [+1, +4, -2], the server only needs [+4, +3, 0] to update the global model. The individual vectors are irrelevant to the averaging step.',
        'Secure aggregation exploits this by having each pair of clients agree on a random mask. Client A adds the mask to its update; client B subtracts the same mask from its update. When the server sums both, the mask cancels and the true aggregate remains. With n clients, each client shares a different mask with every other client. The server receives n masked updates that are individually meaningless, but their sum is the exact aggregate it needs.',
        'This is not encryption in the traditional sense (no ciphertext is decrypted). It is algebraic cancellation: the noise is structured so it self-destructs under addition.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A federated round proceeds in phases. First, the server selects a cohort of available clients and sends each the current global model weights. Each client trains on its local data for several gradient-descent steps, producing an update vector (the difference between its trained weights and the received weights).',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/Centralized_federated_learning_protocol.png/250px-Centralized_federated_learning_protocol.png',
          alt: 'Central server coordinating model updates from several smartphones in federated learning',
          caption: 'A central federated-learning round sends a model to clients and receives updates instead of raw examples. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Centralized_federated_learning_protocol.png',
        },
        'Before sending updates, clients run the secure-aggregation protocol. Each pair of clients uses a shared secret (established via Diffie-Hellman key agreement) to generate a pseudorandom mask vector. Client i adds mask_ij to its update for every other client j; client j subtracts the same mask_ij. The masked updates go to the server, which sums them. Every mask appears once positive and once negative, so the sum equals the true aggregate.',
        'Dropout is the production complication. If client j disappears after client i has already added mask_ij, the cancellation breaks. The protocol handles this with Shamir Secret Sharing: each client splits its secret key into shares distributed to other clients. If a client drops out, a threshold of surviving clients can reconstruct the dropout\'s secret, regenerate the mask, and subtract it from the sum. The round aborts only if too many clients drop simultaneously.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Federated averaging converges because averaging many noisy gradient estimates approximates what centralized training would compute. Each client\'s update is a biased sample (its local data is not representative of the whole population), but across hundreds or thousands of clients per round, the biases average out. Weighting each update by the client\'s sample count further reduces variance.',
        'Secure aggregation works because addition is commutative and the masks are symmetric. For any mask m added by client i and subtracted by client j, the sum contains +m and -m, which cancel to zero regardless of what m is. The server learns the true sum and nothing else, provided it cannot collude with clients to reveal individual masks.',
        'The privacy guarantee is information-theoretic against an honest-but-curious server: it literally never receives an unmasked individual update. Adding differential privacy (clipping each update to a maximum norm, then adding calibrated noise to the aggregate) provides a stronger statistical guarantee that bounds what can be inferred about any single participant, even from the aggregate.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Communication dominates. A model with 10 million parameters requires each client to download and upload 40 MB per round (at 4 bytes per float). With 1,000 clients per round and 500 rounds, that is 40 TB of total transfer. Compression (quantization, sparsification, top-k selection) can cut this by 10-100x but introduces approximation error.',
        'Secure aggregation adds a setup phase where every pair of clients exchanges Diffie-Hellman keys. For n clients, that is O(n^2) key exchanges per round. Google\'s production protocol batches and optimizes this, but the quadratic cost means cohort sizes beyond a few thousand require protocol modifications. Dropout recovery adds another communication round and reconstruction work proportional to the number of dropouts.',
        'Differential privacy costs model quality. Clipping updates to norm S discards large-magnitude signals. Adding Gaussian noise with standard deviation proportional to S/epsilon degrades the signal-to-noise ratio. Tighter privacy (smaller epsilon) means more noise, which means more rounds to reach the same accuracy, which means more privacy budget spent. This is a genuine tradeoff, not a free lunch.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Google deployed federated learning for next-word prediction on Gboard (the Android keyboard) starting in 2017. Each phone trains on its local typing history, and the server aggregates updates to improve suggestions without reading anyone\'s messages. Apple uses a variant for Siri voice model personalization and QuickType suggestions.',
        'Hospitals in the MELLODDY consortium used federated learning to train drug-discovery models across ten pharmaceutical companies without sharing proprietary compound data. Each company kept its molecules local; only model updates crossed organizational boundaries.',
        'The pattern generalizes to any setting where data cannot move: cross-border financial fraud detection (data sovereignty laws), browser telemetry (Mozilla studied federated telemetry for Firefox), and on-device health monitoring from wearable sensors.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Federated learning does not automatically mean private. Without secure aggregation, the server sees every individual update and can run gradient inversion attacks. Without differential privacy, the aggregate itself can leak information about participants (membership inference still works against aggregates from small cohorts).',
        'Non-IID data causes convergence problems. If one hospital sees only cardiac patients and another sees only orthopedic cases, their gradient updates point in different directions. Naive averaging produces a model that is mediocre for both. Techniques like FedProx (adding a proximal term to keep local models close to the global one) help, but the fundamental tension between local specialization and global generalization remains.',
        'Poisoning is hard to defend against. A malicious client can send an update designed to shift the global model toward misclassifying a specific input (a backdoor attack). Because secure aggregation hides individual updates, the server cannot inspect them for anomalies. Robust aggregation rules (coordinate-wise median, trimmed mean) sacrifice some accuracy to limit outlier influence, but determined adversaries can still craft updates that look normal in aggregate statistics.',
        'Keeping data local does not remove the need for consent and governance. Users must know when their device participates, what computation runs, what leaves the device, how the privacy budget is spent, and how to opt out.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a server trains a model with 3 parameters, and 3 clients participate in one round. The current global model is [10.0, 20.0, 30.0]. Each client downloads this model and trains locally.',
        'Client A (50 examples) produces updated weights [10.5, 19.8, 30.3], so its update is [+0.5, -0.2, +0.3]. Client B (30 examples) produces [10.2, 20.4, 29.7], update [+0.2, +0.4, -0.3]. Client C (20 examples) produces [10.1, 20.1, 30.6], update [+0.1, +0.1, +0.6].',
        'Without secure aggregation, the server receives all three updates in the clear and computes the weighted average. Total examples: 50+30+20 = 100. Weighted sum: 50*[+0.5,-0.2,+0.3] + 30*[+0.2,+0.4,-0.3] + 20*[+0.1,+0.1,+0.6] = [25-6+9, -10+12-6, 15-9+12] / 100... but let\'s use the simpler unweighted mean for clarity: ([+0.5,−0.2,+0.3] + [+0.2,+0.4,−0.3] + [+0.1,+0.1,+0.6]) / 3 = [+0.267, +0.1, +0.2]. New global model: [10.267, 20.1, 30.2].',
        'Now add secure aggregation. Clients agree on pairwise masks: mask_AB = [+7, -3, +5] (A adds it, B subtracts it), mask_AC = [+2, +8, -4] (A adds, C subtracts), mask_BC = [-1, +6, +9] (B adds, C subtracts). Client A sends its update plus mask_AB plus mask_AC: [+0.5+7+2, -0.2-3+8, +0.3+5-4] = [+9.5, +4.8, +1.3]. Client B sends its update minus mask_AB plus mask_BC: [+0.2-7-1, +0.4+3+6, -0.3-5+9] = [-7.8, +9.4, +3.7]. Client C sends its update minus mask_AC minus mask_BC: [+0.1-2+1, +0.1-8-6, +0.6+4-9] = [-0.9, -13.9, -4.4].',
        'The server sums: [9.5-7.8-0.9, 4.8+9.4-13.9, 1.3+3.7-4.4] = [+0.8, +0.3, +0.6]. Dividing by 3: [+0.267, +0.1, +0.2]. This is identical to the unmasked average. Every mask appeared once as addition and once as subtraction, so they vanished. The server computed the correct aggregate without ever seeing any individual update.',
        'If client C drops out after sending its masked update, the server has [9.5, 4.8, 1.3] + [-7.8, 9.4, 3.7] + [-0.9, -13.9, -4.4] but cannot remove C\'s contribution cleanly without knowing mask_AC and mask_BC. Using Shamir shares, clients A and B reconstruct C\'s secret, regenerate the masks C used, subtract them from C\'s masked update to effectively remove C, and the server re-averages over the remaining two clients.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'McMahan et al., "Communication-Efficient Learning of Deep Networks from Decentralized Data" (2017, https://arxiv.org/abs/1602.05629) introduced federated averaging. Bonawitz et al., "Practical Secure Aggregation for Privacy-Preserving Machine Learning" (2017, https://eprint.iacr.org/2017/281) designed the mask-cancellation protocol with dropout recovery. Abadi et al., "Deep Learning with Differential Privacy" (2016, https://arxiv.org/abs/1607.00133) established how to clip and noise gradients for formal privacy guarantees.',
        'Study Shamir Secret Sharing next to understand how dropout recovery distributes key material. Gradient Descent explains the optimization step each client runs locally. Differential Privacy SGD covers the clipping-and-noise mechanism in detail. Parameter Server Case Study shows the distributed-systems infrastructure that federated systems build on. Membership Inference Shadow Model Case Study and Model Inversion Confidence Attack illustrate the attacks that motivate secure aggregation in the first place.',
      ],
    },
  ],
};
