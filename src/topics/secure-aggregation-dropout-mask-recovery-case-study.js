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
    explanation: 'Read the ring as mask setup, not model training. Clients agree on paired random values before upload so later addition can reveal the sum without exposing any one update.',
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
    explanation: 'Each row is update plus mask terms. Pairwise masks appear with opposite signs across clients, so the full sum cancels them. The server should see only the aggregate, never a clean row.',
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
    explanation: 'This is the production failure mode. D helped create masks but did not upload a masked vector, so the highlighted survivors cannot simply add their payloads and expect every mask to cancel.',
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
    explanation: 'Survivors release recovery shares for the dropped client only. The design goal is narrow: remove dead-client mask residue while keeping every live client update hidden inside the aggregate.',
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
      heading: 'The problem',
      paragraphs: [
        `Secure aggregation lets a server compute the sum of many client-held vectors without seeing any one client vector in the clear. In federated learning, those vectors are usually model updates from phones, browsers, hospitals, vehicles, or other edge participants. The server wants the aggregate update because it improves the global model. The clients and privacy policy do not want the server to inspect Alice's gradient, Bob's typed-word statistics, or one hospital's local contribution.`,
        `The hard version is not the clean classroom sum. Real clients drop out. A phone loses connectivity, a laptop sleeps, a training job times out, or a participant fails an attestation check. A client may participate in setup, help create masks, and then disappear before uploading the masked update. The protocol must still either recover a valid aggregate or abort without quietly exposing survivor updates.`,
      ],
    },
    {
      heading: 'Naive approach',
      paragraphs: [
        `The naive approach is to ask every client to send its update over a secure channel and trust the server not to look at individual rows. That may protect against outsiders, but it does not reduce what the aggregator itself can learn. A single high-dimensional gradient can leak information through rare features, membership signals, or unusual local examples. Even honest infrastructure teams usually want the protocol to enforce privacy rather than depend on logs, policy, and good intentions.`,
        `A second naive idea is to have every client encrypt its update so only the final sum can be decrypted. That is closer, but the operational details are difficult. The system needs to support high-dimensional vectors, thousands or millions of clients, unreliable networks, efficient communication, and threshold behavior. If one client disappears, the server cannot wait forever, and it cannot simply ask the remaining clients to reveal enough material to unmask each survivor individually.`,
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        `The core trick is cancellation. Clients arrange random masks so every mask that one live client adds is subtracted by another live client. The server receives only masked vectors. When it adds all live masked vectors, the paired random terms cancel and the server obtains the aggregate update. Any single row remains hidden because it is mixed with random material the server does not know.`,
        `Dropout recovery adds a second idea: share only the mask material needed for clients that dropped, and do it through a threshold mechanism. Shamir-style secret sharing lets the protocol reconstruct a secret only when enough authorized shares are present. This matters because the server should not be able to recover masks for live clients. Recovery is a narrow repair operation for dead-client residue, not a general escape hatch from the privacy design.`,
      ],
    },
    {
      heading: 'Protocol mechanics',
      paragraphs: [
        `A typical secure aggregation round has phases. First, the server samples clients and distributes round parameters. Next, clients establish pairwise mask seeds, often using key agreement so the server cannot derive the masks. Each client prepares a masked vector: its update plus the masks it should add, minus the masks it should subtract. The upload is useful only as part of the group sum; alone it should look random to the server.`,
        `The protocol also prepares recovery shares during setup. Clients secret-share the material required to repair dropout cases, but the shares are released only under the protocol's rules. The server records which clients reached setup, which clients uploaded, which clients are considered dropped, which threshold applies, and which shares were accepted. That state machine is part of the security property. Secure aggregation is not just a numeric sum with encryption sprinkled on top.`,
      ],
    },
    {
      heading: 'Dropout recovery',
      paragraphs: [
        `Suppose clients A, B, C, and D create pairwise masks. A adds one mask with B and subtracts one with D; B subtracts A's mask and adds one with C; the pattern continues. If all four upload, every pair cancels. If D drops before upload, the terms involving D no longer have matching partners in the uploaded sum. The surviving uploads contain leftover mask residue, so the server cannot simply add A, B, and C and call the result the aggregate.`,
        `Recovery shares solve exactly that residue problem. Surviving clients release shares that allow reconstruction of D's relevant mask material, subject to a threshold. The server removes the contribution of D's masks from the survivor sum without learning A, B, or C individually. If too few survivors remain, too few valid shares arrive, or the dropout rate exceeds the policy, the secure result is no result. The correct behavior is abort, not a best-effort aggregate with weaker privacy.`,
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        `In the mask graph view, the client-to-client edges are mask relationships established before upload, and the client-to-server edges are masked payloads. The table shows the algebra. A row such as A contains the real update uA plus positive and negative mask terms. The server receives mA, mB, mC, and mD, not uA through uD. When every expected client uploads, the positive and negative pairwise terms cancel in the total.`,
        `In the dropout view, D disappears after setup. The removed edges are the mask relationships that no longer have a clean cancellation path through D's upload. The recovery table shows the protocol narrowing its repair: detect D as absent, collect enough shares, reconstruct only the dropped-client mask effect, protect the live clients, and then decide whether to publish. The accept ledger at the end is as important as the sum because it proves which thresholds were met.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `The privacy intuition is that the server never holds enough independent information to isolate one live client's update. Before summation, each row is hidden by masks unknown to the server. During summation, masks cancel only across the aggregate. During dropout recovery, threshold shares reveal material associated with dropped clients, not the live clients' private masks. The server learns the aggregate and the protocol metadata, but not a clean survivor row.`,
        `The robustness intuition is that liveness and privacy are separated. Dropout is expected, so recovery is built into the protocol rather than handled by manual exception. But recovery is gated. Thresholds make collusion and accidental over-release harder. Abort rules preserve the privacy contract when the round is too small, too damaged, or too inconsistent to repair safely. The round either produces an aggregate under the stated policy or produces an auditable failure.`,
      ],
    },
    {
      heading: 'Costs',
      paragraphs: [
        `Secure aggregation adds communication, cryptographic setup, bookkeeping, and latency. Clients exchange or derive pairwise seeds, upload masked vectors, and may later upload recovery shares. The server must track phases and timeouts for many participants. Vectors can have millions of parameters, so protocols must be careful about bandwidth and memory. Practical schemes use seed expansion so clients do not transmit full random masks for every parameter.`,
        `The system also pays operational complexity. Key agreement failures, duplicate uploads, replayed messages, malformed shares, partial retries, and client version skew all need clear handling. The implementation must avoid logging raw updates or sensitive mask material. Monitoring has to distinguish normal dropout from protocol failure. A successful production run is not just low latency; it is low latency with evidence that every privacy gate was enforced.`,
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        `Secure aggregation is strongest when many clients contribute relatively similar vector-shaped updates and the product only needs the aggregate. Federated keyboard learning, mobile model training, browser telemetry aggregation, cross-device analytics, and some cross-silo collaborations fit this pattern. The server can improve a model or compute a statistic while reducing the amount of per-client information it can inspect.`,
        `It also improves organizational boundaries. Privacy teams, auditors, infrastructure operators, and model engineers can reason about a protocol artifact instead of a promise that raw rows were not opened. The ledger can record sampled clients, accepted clients, dropout counts, threshold shares, abort decisions, and policy version. That evidence is valuable when a model update later has to be explained, reproduced, or rejected.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `Secure aggregation does not make the aggregate harmless. If the group is too small, the aggregate may reveal too much about one participant. If the same client participates in many carefully chosen rounds, differencing attacks may reveal information. If the output model memorizes rare data, secure aggregation alone does not prevent that leakage. Differential privacy addresses a different layer by limiting what the released aggregate can reveal.`,
        `It is also not a poisoning defense. A malicious client can send a bad update that affects the aggregate unless the system adds clipping, robust aggregation, anomaly detection, attestation, reputation, or Byzantine-resilient methods. Secure aggregation can make inspection harder because the server cannot simply open a suspicious row. The privacy mechanism and the integrity mechanism must be designed together rather than treated as substitutes.`,
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        `The most dangerous implementation failure is over-recovery: revealing survivor mask material to salvage a round. Another common failure is publishing below the required threshold because the training pipeline wants progress. Stale membership lists, inconsistent dropout detection, wrong predecessor sets in the protocol graph, and mismatched policy versions can all produce aggregates that look numerically valid but are not valid under the privacy contract.`,
        `A mature deployment should keep a protocol ledger with setup count, upload count, survivor count, dropout count, share threshold, share count, repaired mask set, abort reason, software version, and policy identifier. It should test malformed shares, late uploads, duplicate clients, server restarts, and network partitions. Without those tests, the system may be correct only in the easy case where every client behaves and nobody drops.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Study Shamir Secret Sharing for the threshold-reconstruction primitive. Study Federated Learning and Secure Aggregation for the full training loop, Federated Client Cohort Sampler for how clients enter a round, Differential Privacy SGD for output privacy, Robust Aggregation for poisoning resistance, and Byzantine Fault Tolerance for adversarial distributed systems. The important mental model is that these layers answer different questions.`,
        `Primary sources include Practical Secure Aggregation for Privacy-Preserving Machine Learning at https://eprint.iacr.org/2017/281 and the Google Research publication page at https://research.google/pubs/practical-secure-aggregation-for-privacy-preserving-machine-learning/. When reading implementations, look for explicit phase transitions, threshold checks, share validation, audit logging, and tests that prove abort behavior as carefully as success behavior.`,
      ],
    },
  ],
};
