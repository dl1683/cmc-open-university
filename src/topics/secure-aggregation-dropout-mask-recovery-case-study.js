// Secure aggregation dropout recovery: pairwise masks should cancel for
// survivors while dropped-client masks are recovered without exposing updates.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'secure-aggregation-dropout-mask-recovery-case-study',
  title: 'Secure Aggregation Dropout Mask Recovery Case Study',
  category: 'AI & ML',
  summary: 'A secure aggregation case study: pairwise mask graph, masked model updates, dropout detection, Shamir-style recovery shares, survivor privacy, abort thresholds, and audit ledgers.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['mask graph', 'dropout recovery'], defaultValue: 'mask graph' },
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

function maskGraph(title) {
  return graphState({
    nodes: [
      { id: 'server', label: 'srv', x: 4.6, y: 0.9, note: 'sum' },
      { id: 'a', label: 'A', x: 1.2, y: 3.0, note: 'uA' },
      { id: 'b', label: 'B', x: 3.3, y: 5.3, note: 'uB' },
      { id: 'c', label: 'C', x: 6.0, y: 5.3, note: 'uC' },
      { id: 'd', label: 'D', x: 8.1, y: 3.0, note: 'uD' },
      { id: 'shares', label: 'shares', x: 4.6, y: 3.0, note: 't-of-n' },
    ],
    edges: [
      { id: 'e-a-b', from: 'a', to: 'b', weight: '+rAB' },
      { id: 'e-b-a', from: 'b', to: 'a', weight: '-rAB' },
      { id: 'e-b-c', from: 'b', to: 'c', weight: '+rBC' },
      { id: 'e-c-b', from: 'c', to: 'b', weight: '-rBC' },
      { id: 'e-c-d', from: 'c', to: 'd', weight: '+rCD' },
      { id: 'e-d-c', from: 'd', to: 'c', weight: '-rCD' },
      { id: 'e-d-a', from: 'd', to: 'a', weight: '+rDA' },
      { id: 'e-a-d', from: 'a', to: 'd', weight: '-rDA' },
      { id: 'e-a-srv', from: 'a', to: 'server', weight: 'masked' },
      { id: 'e-b-srv', from: 'b', to: 'server', weight: 'masked' },
      { id: 'e-c-srv', from: 'c', to: 'server', weight: 'masked' },
      { id: 'e-d-srv', from: 'd', to: 'server', weight: 'masked' },
      { id: 'e-shares-srv', from: 'shares', to: 'server', weight: 'repair' },
    ],
  }, { title });
}

function* maskGraphView() {
  yield {
    state: maskGraph('Clients agree on pairwise masks before uploading updates'),
    highlight: { active: ['a', 'b', 'c', 'd', 'e-a-b', 'e-b-c', 'e-c-d', 'e-d-a'], compare: ['server'] },
    explanation: 'Secure aggregation hides individual updates by making clients add masks that cancel in the aggregate. The server should receive masked vectors, not raw per-client model deltas.',
  };
  yield {
    state: labelMatrix(
      'Masked update table',
      [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
        { id: 'c', label: 'C' },
        { id: 'd', label: 'D' },
      ],
      [
        { id: 'update', label: 'upd' },
        { id: 'mask', label: 'mask' },
        { id: 'sent', label: 'sent' },
      ],
      [
        ['uA', '+ab-da', 'mA'],
        ['uB', '-ab+bc', 'mB'],
        ['uC', '-bc+cd', 'mC'],
        ['uD', '-cd+da', 'mD'],
      ],
    ),
    highlight: { active: ['a:sent', 'b:sent', 'c:sent', 'd:sent'], found: ['a:mask', 'b:mask', 'c:mask', 'd:mask'] },
    explanation: 'Each client sends update plus mask terms. Pairwise terms appear with opposite signs across clients, so summing all surviving clients cancels the masks and reveals only the aggregate update.',
    invariant: 'The server can add masked vectors but cannot inspect one client update.',
  };
  yield {
    state: maskGraph('The server receives masked vectors only'),
    highlight: { active: ['e-a-srv', 'e-b-srv', 'e-c-srv', 'e-d-srv', 'server'], compare: ['shares'], found: ['a', 'b', 'c', 'd'] },
    explanation: 'The aggregation server sees a set of encrypted or masked payloads and the final sum. It should not have the material needed to unmask a single active client update.',
  };
  yield {
    state: labelMatrix(
      'What cancels',
      [
        { id: 'pair', label: 'pair masks' },
        { id: 'self', label: 'self masks' },
        { id: 'sum', label: 'agg sum' },
        { id: 'audit', label: 'audit' },
      ],
      [
        { id: 'result', label: 'result' },
        { id: 'guard', label: 'guard' },
      ],
      [
        ['zero out', 'all present'],
        ['removed', 'after commit'],
        ['updates', 'threshold'],
        ['counts', 'no raw upd'],
      ],
    ),
    highlight: { found: ['pair:result', 'sum:result'], compare: ['audit:guard'] },
    explanation: 'The protocol must prove which masks cancel, which material is revealed, and which thresholds were met. This is why secure aggregation is a protocol state machine, not just a sum operation.',
  };
}

function* dropoutRecovery() {
  yield {
    state: maskGraph('Client D drops after mask setup'),
    highlight: { removed: ['d', 'e-c-d', 'e-d-c', 'e-d-a', 'e-a-d', 'e-d-srv'], active: ['a', 'b', 'c'], found: ['server'] },
    explanation: 'Dropout is the failure mode that makes practical secure aggregation hard. If D helped create masks but never uploads its masked update, some mask terms no longer cancel naturally.',
  };
  yield {
    state: labelMatrix(
      'Dropout recovery',
      [
        { id: 'detect', label: 'detect' },
        { id: 'collect', label: 'shares' },
        { id: 'recover', label: 'repair' },
        { id: 'protect', label: 'protect' },
      ],
      [
        { id: 'action', label: 'action' },
        { id: 'limit', label: 'limit' },
      ],
      [
        ['D absent', 'timeout'],
        ['t shares', 'only D'],
        ['mask sum', 'no uD'],
        ['survivors', 'still hidden'],
      ],
    ),
    highlight: { active: ['detect:action', 'collect:action', 'recover:action'], found: ['protect:limit'] },
    explanation: 'Survivors release recovery shares that let the server remove the dead client mask contribution. The design goal is precise: repair the aggregate without exposing any live client update.',
  };
  yield {
    state: maskGraph('Threshold shares repair the aggregate'),
    highlight: { active: ['shares', 'e-shares-srv', 'server'], found: ['a', 'b', 'c'], removed: ['d'] },
    explanation: 'Shamir-style threshold sharing lets the protocol recover only when enough clients cooperate. Too few survivors means the round must fail rather than silently weakening privacy.',
  };
  yield {
    state: labelMatrix(
      'Abort and accept ledger',
      [
        { id: 'surv', label: 'surv' },
        { id: 'share', label: 'share' },
        { id: 'min', label: 'min k' },
        { id: 'release', label: 'release' },
      ],
      [
        { id: 'value', label: 'value' },
        { id: 'gate', label: 'gate' },
      ],
      [
        ['9.8k', 'ok'],
        ['9.7k', 'ok'],
        ['8k', 'met'],
        ['sum', 'publish'],
      ],
    ),
    highlight: { found: ['surv:gate', 'share:gate', 'min:gate', 'release:gate'] },
    explanation: 'Production aggregation needs an accept ledger: survivor count, share count, dropout rate, threshold, privacy policy version, and whether the round was published or discarded.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'mask graph') yield* maskGraphView();
  else if (view === 'dropout recovery') yield* dropoutRecovery();
  else throw new InputError('Pick a secure-aggregation view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Secure aggregation lets a server compute an aggregate of client-held vectors without seeing each individual vector. In federated learning, those vectors are usually model updates. The protocol has to be communication efficient because updates are high-dimensional and clients are mobile.',
        'The practical difficulty is dropout. Clients can help set up masks, then disappear before uploading their masked update. A robust protocol needs recovery shares that repair the aggregate without revealing survivor updates.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Clients establish pairwise masks. Client A may add a mask that client B subtracts, and so on. If everyone uploads, the server sums all masked updates and the pairwise masks cancel. The server obtains the aggregate update but not any individual update.',
        'When a client drops, some mask terms no longer have their cancelling partner. Recovery shares allow the server to reconstruct enough mask material for dropped clients only. Survivor masks remain protected. This is where Shamir Secret Sharing connects directly to federated learning.',
      ],
    },
    {
      heading: 'Case study',
      paragraphs: [
        'A phone keyboard round starts with 13,000 sampled clients. During setup they exchange mask commitments and share recovery material. Only 9,800 finish local training. The secure aggregator checks that survivor and share thresholds are both met, repairs masks for dropouts, and releases only the aggregate model update.',
        'The final artifact is not just a vector sum. It is a protocol ledger: participant count, dropout count, threshold, share count, accepted aggregate, abort reason if any, and policy version. That ledger is critical evidence for privacy review.',
      ],
    },
    {
      heading: 'Why it matters',
      paragraphs: [
        'Federated learning without secure aggregation can still leak through individual updates. Secure aggregation reduces what the server can inspect. It also changes operations: the system must track protocol phases, retries, aborts, and threshold failures.',
        'Secure aggregation is not poisoning defense. A hostile client can still contribute a bad update to the aggregate unless robust aggregation, clipping, anomaly checks, or attestation are added.',
      ],
    },
    {
      heading: 'Pitfalls',
      paragraphs: [
        'Do not reveal survivor recovery material just to salvage a round. Do not publish aggregates below the required threshold. Do not treat dropout as an exceptional edge case; mobile dropout is normal.',
        'Do not claim that secure aggregation alone provides differential privacy. It hides individual updates from the aggregator, while DP bounds individual influence on the released result.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Practical Secure Aggregation at https://eprint.iacr.org/2017/281 and https://research.google/pubs/practical-secure-aggregation-for-privacy-preserving-machine-learning/. Study Shamir Secret Sharing, Federated Learning and Secure Aggregation, Federated Client Cohort Sampler, Differential Privacy SGD, Byzantine Fault Tolerance, and Robust Aggregation topics next.',
      ],
    },
  ],
};
