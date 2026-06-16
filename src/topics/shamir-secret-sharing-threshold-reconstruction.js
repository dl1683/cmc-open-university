// Shamir secret sharing: split one secret into polynomial shares so any
// threshold subset can reconstruct, while smaller subsets learn nothing.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'shamir-secret-sharing-threshold-reconstruction',
  title: 'Shamir Secret Sharing',
  category: 'Security',
  summary: 'A threshold-crypto primer: encode the secret as the constant term of a finite-field polynomial, distribute point shares, and reconstruct with Lagrange interpolation.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['share generation', 'threshold reconstruct'], defaultValue: 'share generation' },
  ],
  run,
};

const PRIME = 17;
const COEFFS = [9, 4, 2]; // f(x) = 9 + 4x + 2x^2 mod 17
const SHARES = [1, 2, 3, 4, 5].map((x) => ({ x, y: evalPoly(x), id: `s${x}` }));

function evalPoly(x) {
  return COEFFS.reduce((sum, coeff, power) => (sum + coeff * (x ** power)) % PRIME, 0);
}

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

function shareGraph(title) {
  return graphState({
    nodes: [
      { id: 'secret', label: 'secret', x: 0.8, y: 3.9, note: '9' },
      { id: 'coeffs', label: 'random', x: 2.4, y: 2.2, note: '4,2' },
      { id: 'poly', label: 'poly f(x)', x: 4.0, y: 3.9, note: 'mod 17' },
      { id: 's1', label: 'share 1', x: 6.0, y: 1.4, note: '(1,15)' },
      { id: 's2', label: 'share 2', x: 6.0, y: 2.7, note: '(2,8)' },
      { id: 's3', label: 'share 3', x: 6.0, y: 4.0, note: '(3,5)' },
      { id: 's4', label: 'share 4', x: 6.0, y: 5.3, note: '(4,6)' },
      { id: 's5', label: 'share 5', x: 6.0, y: 6.6, note: '(5,11)' },
      { id: 'vault', label: 'vault', x: 8.4, y: 3.9, note: '3 of 5' },
    ],
    edges: [
      { id: 'e-secret-poly', from: 'secret', to: 'poly' },
      { id: 'e-coeffs-poly', from: 'coeffs', to: 'poly' },
      { id: 'e-poly-s1', from: 'poly', to: 's1' },
      { id: 'e-poly-s2', from: 'poly', to: 's2' },
      { id: 'e-poly-s3', from: 'poly', to: 's3' },
      { id: 'e-poly-s4', from: 'poly', to: 's4' },
      { id: 'e-poly-s5', from: 'poly', to: 's5' },
      { id: 'e-s1-vault', from: 's1', to: 'vault' },
      { id: 'e-s3-vault', from: 's3', to: 'vault' },
      { id: 'e-s5-vault', from: 's5', to: 'vault' },
    ],
  }, { title });
}

function sharePlot(title) {
  return plotState({
    axes: { x: { label: 'share index x', min: 0, max: 6 }, y: { label: 'field value mod 17', min: 0, max: 17 } },
    series: [
      {
        id: 'curve',
        label: 'f(x) mod 17',
        points: Array.from({ length: 7 }, (_, x) => ({ x, y: evalPoly(x) })),
      },
    ],
    markers: [
      { id: 'secret0', x: 0, y: evalPoly(0), label: 'secret' },
      ...SHARES.map((share) => ({ id: share.id, x: share.x, y: share.y, label: `(${share.x},${share.y})` })),
    ],
  }, { title });
}

function reconstructGraph(title) {
  return graphState({
    nodes: [
      { id: 's1', label: 'share 1', x: 0.9, y: 2.2, note: '15' },
      { id: 's3', label: 'share 3', x: 0.9, y: 3.9, note: '5' },
      { id: 's5', label: 'share 5', x: 0.9, y: 5.6, note: '11' },
      { id: 'lag1', label: 'lambda1', x: 3.0, y: 2.2, note: '4' },
      { id: 'lag3', label: 'lambda3', x: 3.0, y: 3.9, note: '3' },
      { id: 'lag5', label: 'lambda5', x: 3.0, y: 5.6, note: '11' },
      { id: 'sum', label: 'sum mod p', x: 5.6, y: 3.9, note: '196' },
      { id: 'secret', label: 'secret', x: 8.0, y: 3.9, note: '9' },
    ],
    edges: [
      { id: 'e-s1-lag1', from: 's1', to: 'lag1' },
      { id: 'e-s3-lag3', from: 's3', to: 'lag3' },
      { id: 'e-s5-lag5', from: 's5', to: 'lag5' },
      { id: 'e-lag1-sum', from: 'lag1', to: 'sum' },
      { id: 'e-lag3-sum', from: 'lag3', to: 'sum' },
      { id: 'e-lag5-sum', from: 'lag5', to: 'sum' },
      { id: 'e-sum-secret', from: 'sum', to: 'secret' },
    ],
  }, { title });
}

function* shareGeneration() {
  yield {
    state: shareGraph('Pick a random polynomial whose intercept is the secret'),
    highlight: { active: ['secret', 'coeffs', 'poly', 'e-secret-poly', 'e-coeffs-poly'], compare: ['vault'] },
    explanation: 'For a 3-of-5 sharing scheme, choose a degree-2 polynomial over a finite field. The secret is the constant term. Here f(x) = 9 + 4x + 2x^2 mod 17, so f(0) = 9 is the secret.',
    invariant: 'Threshold k uses a random polynomial of degree k - 1.',
  };

  yield {
    state: sharePlot('Evaluate the polynomial at public nonzero x positions'),
    highlight: { active: ['curve', 's1', 's2', 's3', 's4', 's5'], found: ['secret0'] },
    explanation: 'Every share is one point on the hidden polynomial: (1,15), (2,8), (3,5), (4,6), and (5,11). The x value can be public; the y value is the share. The secret point at x = 0 is not handed out.',
  };

  yield {
    state: shareGraph('Distribute shares so no one holder has the key'),
    highlight: { active: ['s1', 's2', 's3', 's4', 's5', 'e-poly-s1', 'e-poly-s2', 'e-poly-s3', 'e-poly-s4', 'e-poly-s5'], compare: ['secret'], found: ['vault'] },
    explanation: 'Each trustee receives one point. A single copied secret would create one catastrophic holder. Shamir shares turn recovery into a threshold data structure: enough holders can recover, fewer holders cannot.',
  };

  yield {
    state: labelMatrix(
      'Storage model',
      [
        { id: 'copy', label: 'copies' },
        { id: 'shamir', label: 'Shamir' },
        { id: 'backup', label: 'backup' },
        { id: 'attack', label: 'attacker' },
      ],
      [
        { id: 'recover', label: 'recover' },
        { id: 'leak', label: 'leak' },
      ],
      [
        ['any copy', 'one breach'],
        ['3 shares', '2 learn none'],
        ['loss ok', 'need quorum'],
        ['steal 2', 'no secret'],
      ],
    ),
    highlight: { found: ['shamir:recover', 'shamir:leak'], compare: ['copy:leak', 'backup:recover'] },
    explanation: 'The point is not obscurity; it is information-theoretic thresholding. With fewer than k shares, every possible secret is still compatible with some degree-(k-1) polynomial.',
  };
}

function* thresholdReconstruct() {
  yield {
    state: sharePlot('Any three points determine the degree-2 polynomial'),
    highlight: { active: ['s1', 's3', 's5'], found: ['secret0'], compare: ['s2', 's4'] },
    explanation: 'Pick any threshold-sized subset. Shares (1,15), (3,5), and (5,11) are enough to reconstruct the unique degree-2 polynomial over mod 17 and read f(0). Shares 2 and 4 are not needed.',
    invariant: 'k points determine one polynomial of degree at most k - 1.',
  };

  yield {
    state: reconstructGraph('Lagrange interpolation evaluates f(0) directly'),
    highlight: { active: ['s1', 'lag1', 's3', 'lag3', 's5', 'lag5', 'e-s1-lag1', 'e-s3-lag3', 'e-s5-lag5'], compare: ['sum'] },
    explanation: 'Lagrange interpolation does not need to rebuild every coefficient first. It computes weights for x = 0. For this subset the weights are 4, 3, and 11 modulo 17.',
  };

  yield {
    state: reconstructGraph('Weighted shares collapse back to the intercept'),
    highlight: { active: ['lag1', 'lag3', 'lag5', 'sum', 'secret', 'e-lag1-sum', 'e-lag3-sum', 'e-lag5-sum', 'e-sum-secret'], found: ['secret'] },
    explanation: 'The reconstruction is 15*4 + 5*3 + 11*11 = 196, and 196 mod 17 = 9. The recovered value is the intercept f(0), which was the original secret.',
  };

  yield {
    state: labelMatrix(
      'Operational checks',
      [
        { id: 'field', label: 'field' },
        { id: 'random', label: 'randomness' },
        { id: 'auth', label: 'auth shares' },
        { id: 'combine', label: 'combine' },
        { id: 'erase', label: 'erase' },
      ],
      [
        { id: 'need', label: 'need' },
        { id: 'failure', label: 'failure' },
      ],
      [
        ['big prime', 'wrap bugs'],
        ['fresh coeffs', 'pattern leak'],
        ['verify sender', 'fake share'],
        ['secure room', 'hot secret'],
        ['wipe memory', 'residue'],
      ],
    ),
    highlight: { active: ['field:need', 'random:need', 'auth:need'], compare: ['combine:failure', 'erase:failure'] },
    explanation: 'The math is simple; the implementation boundary is not. Real systems need a large field, strong randomness, authenticated shares, safe reconstruction ceremonies, and careful erasure after use.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'share generation') yield* shareGeneration();
  else if (view === 'threshold reconstruct') yield* thresholdReconstruct();
  else throw new InputError('Pick a Shamir secret-sharing view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Shamir secret sharing is a threshold scheme. A dealer splits a secret into n shares so any k shares can reconstruct the secret, while k - 1 or fewer shares reveal no information about it. The secret is not copied. It is encoded as the intercept of a random polynomial over a finite field.',
        'Adi Shamir introduced the scheme in "How to Share a Secret." The paper defines a (k, n) threshold scheme where k or more pieces make the data computable, but k - 1 or fewer pieces leave it undetermined: https://web.mit.edu/6.857/OldStuff/Fall03/ref/Shamir-HowToShareASecret.pdf.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'To make a k-of-n scheme, choose a random polynomial of degree k - 1. Put the secret in the constant term. Evaluate the polynomial at n nonzero x positions and hand each participant one point. Reconstruction uses Lagrange interpolation to evaluate the polynomial at x = 0.',
        'The visualization uses a tiny field for readability: f(x) = 9 + 4x + 2x^2 mod 17. Real systems use large finite fields and cryptographic randomness. The small example is for structure, not security.',
      ],
    },
    {
      heading: 'Complete case study: offline recovery key',
      paragraphs: [
        'A company wants disaster recovery for a root encryption key without giving any one executive the key. It creates a 3-of-5 Shamir sharing: one share goes to legal, one to security, one to finance, one to an external custodian, and one to the CEO. Losing two shares still permits recovery; stealing two shares does not reveal the key.',
        'During a recovery ceremony, three trustees authenticate each other, combine their shares on an isolated machine, unwrap the root key, rotate dependent keys, and then erase reconstruction material. The threshold policy improves availability and limits single-person compromise, but it concentrates risk during reconstruction.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not confuse Shamir sharing with encryption. It protects the secret by splitting it into threshold shares, but once reconstructed the secret exists normally and must be handled like any other high-value key. Do not reuse polynomial coefficients across secrets. Do not accept unauthenticated shares in hostile settings; verifiable secret sharing or commitments may be needed.',
        'Do not use toy fields, floating-point interpolation, or ad hoc string arithmetic. This is finite-field algebra. Production implementations need constant-time field operations, authenticated envelopes, versioned metadata, and tested recovery procedures.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Adi Shamir, "How to Share a Secret" at https://web.mit.edu/6.857/OldStuff/Fall03/ref/Shamir-HowToShareASecret.pdf and ACM DOI page at https://dl.acm.org/doi/10.1145/359168.359176.',
        'Study Binary Exponentiation, Reed-Solomon Erasure Coding, TUF Update Metadata Case Study, Federated Learning & Secure Aggregation, KZG Polynomial Commitment Opening Case Study, Verkle Trees & Stateless Clients, and Transparency Log Witnessing Case Study next.',
      ],
    },
  ],
};
