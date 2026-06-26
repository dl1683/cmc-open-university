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
      heading: 'How to read the animation',
      paragraphs: [
        'Read each client row as an update hidden by masks. Active edges are mask relationships being used now, visited edges have already been accounted for, and the final server value is valid only when the live-client masks cancel and dropped-client residue is repaired. The safe inference is narrow: the server may learn the aggregate, not an individual live vector.',
        {type:'callout', text:`Dropout recovery is safe only when it repairs dead-client mask residue without exposing any live client update.`},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/6/66/3_polynomials_of_degree_2_through_2_points.svg', alt:'Three polynomial curves passing through the same two points.', caption:'Three degree-2 polynomials through two points, by Vlsergey, CC BY 3.0, via Wikimedia Commons.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Secure aggregation lets a server compute a sum of client vectors without seeing any one vector. A vector is a list of numbers, such as 1,000 model-update coordinates from a phone. The hard part is dropout: some clients help create masks and then vanish before upload.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to send every vector through TLS and trust the server not to inspect rows. That protects against outsiders, but the aggregator still receives Alice as a row and Bob as a row. A second approach encrypts rows, but then one missing client can block the final sum.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that masks cancel in pairs only when the expected uploads arrive. If client D helped create pairwise masks and then drops, the live sum from A, B, and C contains leftover terms involving D. Removing those terms must not reveal A, B, or C.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Pairwise masks hide individual rows while canceling in the group sum. Dropout recovery adds threshold secret sharing: enough survivors can reconstruct only the mask material needed for dropped clients. The threshold is the rule that separates repair from privacy failure.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Clients first agree on pairwise mask seeds and prepare recovery shares. Each client uploads update plus masks it adds minus masks it subtracts. The server sums masked uploads, detects dropped clients, collects valid shares, reconstructs dropped-client mask effects, and removes that residue from the aggregate.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness is conservation of mask terms. Every live-live pair appears once positive and once negative, so it cancels in the sum. Every dropped-live pair leaves residue, and the protocol reconstructs only that dropped side; if the threshold is not met, the correct output is abort.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'For n clients, a simple pairwise design has about n times n mask relationships, though practical protocols compress masks with seeds. With 1,000 clients and 1,000 coordinates, sending full masks would be too large, so clients send seeds and one masked vector. The cost is extra setup, share validation, phase tracking, and abort handling.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'This pattern fits federated learning, mobile telemetry aggregation, cross-device analytics, and cross-silo model training where only the aggregate should be visible. It is strongest when many clients contribute similar vector-shaped updates and the product does not need individual inspection.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Secure aggregation does not make the aggregate safe by itself. If only three clients remain, their sum may reveal too much, and repeated rounds can leak differences. It also does not stop poisoning; a malicious client can send a bad update unless clipping, robust aggregation, attestation, or anomaly checks are added.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Let A, B, C, and D hold scalar updates 10, 20, 30, and 40. A and B share mask 7, B and C share 5, C and D share 11, and D and A share 3, with opposite signs at each endpoint. If D drops, the live masked sum is not 60 until the protocol reconstructs and removes D-related residue; with a 2-of-3 survivor threshold, any two of A, B, and C can repair D, but one survivor cannot.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study Practical Secure Aggregation for Privacy-Preserving Machine Learning, Shamir Secret Sharing, federated client sampling, differential privacy SGD, robust aggregation, and Byzantine fault tolerance. Keep the layers separate: secure aggregation hides rows from the server, differential privacy limits released aggregate information, and robust aggregation fights bad inputs.',
      ],
    },
  ],
};
