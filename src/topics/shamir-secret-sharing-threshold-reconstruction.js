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
  const k = COEFFS.length;
  const n = SHARES.length;
  const secret = COEFFS[0];
  const degree = k - 1;
  const shareList = SHARES.map(s => `(${s.x},${s.y})`).join(', ');

  yield {
    state: shareGraph('Pick a random polynomial whose intercept is the secret'),
    highlight: { active: ['secret', 'coeffs', 'poly', 'e-secret-poly', 'e-coeffs-poly'], compare: ['vault'] },
    explanation: `For a ${k}-of-${n} sharing scheme, choose a degree-${degree} polynomial over a finite field. The secret is the constant term. Here f(x) = ${COEFFS[0]} + ${COEFFS[1]}x + ${COEFFS[2]}x^2 mod ${PRIME}, so f(0) = ${secret} is the secret.`,
    invariant: `Threshold k = ${k} uses a random polynomial of degree k - 1 = ${degree}.`,
  };

  yield {
    state: sharePlot('Evaluate the polynomial at public nonzero x positions'),
    highlight: { active: ['curve', 's1', 's2', 's3', 's4', 's5'], found: ['secret0'] },
    explanation: `Every share is one point on the hidden polynomial: ${shareList}. The x value can be public; the y value is the share. The secret point at x = 0 is not handed out.`,
  };

  yield {
    state: shareGraph('Distribute shares so no one holder has the key'),
    highlight: { active: ['s1', 's2', 's3', 's4', 's5', 'e-poly-s1', 'e-poly-s2', 'e-poly-s3', 'e-poly-s4', 'e-poly-s5'], compare: ['secret'], found: ['vault'] },
    explanation: `Each of the ${n} trustees receives one point. A single copied secret would create one catastrophic holder. Shamir shares turn recovery into a threshold data structure: any ${k} holders can recover, fewer than ${k} cannot.`,
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
        [`${k} shares`, `${k - 1} learn none`],
        ['loss ok', 'need quorum'],
        [`steal ${k - 1}`, 'no secret'],
      ],
    ),
    highlight: { found: ['shamir:recover', 'shamir:leak'], compare: ['copy:leak', 'backup:recover'] },
    explanation: `The point is not obscurity; it is information-theoretic thresholding. With fewer than ${k} shares, every possible secret is still compatible with some degree-${degree} polynomial.`,
  };
}

function* thresholdReconstruct() {
  const k = COEFFS.length;
  const degree = k - 1;
  const secret = COEFFS[0];
  const chosen = [SHARES[0], SHARES[2], SHARES[4]];
  const unused = [SHARES[1], SHARES[3]];
  const weights = [4, 3, 11];
  const rawSum = chosen.reduce((s, sh, i) => s + sh.y * weights[i], 0);
  const recovered = rawSum % PRIME;

  yield {
    state: sharePlot('Any three points determine the degree-2 polynomial'),
    highlight: { active: ['s1', 's3', 's5'], found: ['secret0'], compare: ['s2', 's4'] },
    explanation: `Pick any threshold-sized subset. Shares (${chosen[0].x},${chosen[0].y}), (${chosen[1].x},${chosen[1].y}), and (${chosen[2].x},${chosen[2].y}) are enough to reconstruct the unique degree-${degree} polynomial over mod ${PRIME} and read f(0). Shares ${unused[0].x} and ${unused[1].x} are not needed.`,
    invariant: `${k} points determine one polynomial of degree at most ${degree}.`,
  };

  yield {
    state: reconstructGraph('Lagrange interpolation evaluates f(0) directly'),
    highlight: { active: ['s1', 'lag1', 's3', 'lag3', 's5', 'lag5', 'e-s1-lag1', 'e-s3-lag3', 'e-s5-lag5'], compare: ['sum'] },
    explanation: `Lagrange interpolation does not need to rebuild every coefficient first. It computes weights for x = 0. For this subset the weights are ${weights.join(', ')} modulo ${PRIME}.`,
  };

  yield {
    state: reconstructGraph('Weighted shares collapse back to the intercept'),
    highlight: { active: ['lag1', 'lag3', 'lag5', 'sum', 'secret', 'e-lag1-sum', 'e-lag3-sum', 'e-lag5-sum', 'e-sum-secret'], found: ['secret'] },
    explanation: `The reconstruction is ${chosen[0].y}*${weights[0]} + ${chosen[1].y}*${weights[1]} + ${chosen[2].y}*${weights[2]} = ${rawSum}, and ${rawSum} mod ${PRIME} = ${recovered}. The recovered value is the intercept f(0), which was the original secret.`,
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
        [`fresh ${degree} coeffs`, 'pattern leak'],
        ['verify sender', 'fake share'],
        ['secure room', 'hot secret'],
        ['wipe memory', 'residue'],
      ],
    ),
    highlight: { active: ['field:need', 'random:need', 'auth:need'], compare: ['combine:failure', 'erase:failure'] },
    explanation: `The math is simple; the implementation boundary is not. Real systems need a field much larger than ${PRIME}, strong randomness for all ${degree} nonconstant coefficients, authenticated shares, safe reconstruction ceremonies, and careful erasure after use.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as algebra over a finite field. A finite field is a number system where addition, multiplication, subtraction, and division by nonzero values all stay inside a fixed set of values.',
        {type: 'image', src: './assets/gifs/shamir-secret-sharing-threshold-reconstruction.gif', alt: 'Animated walkthrough of the shamir secret sharing threshold reconstruction visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'The active point is the share currently used in interpolation. The found value is the reconstructed intercept f(0), which is the secret.',
        'The safe inference rule is threshold uniqueness. Any k distinct points determine one degree-(k - 1) polynomial, while fewer than k points leave many possible intercepts.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Some secrets must survive loss without becoming easy to steal. A root encryption key, signing key, or disaster-recovery credential cannot safely live with one person or one machine.',
        {
          type: 'callout',
          text: 'Shamir sharing makes recovery a threshold algebra problem: enough points determine the secret, fewer points leave every secret possible.',
        },
        'Copying the full secret to several places improves availability but destroys the security model. Shamir secret sharing creates n shares so any k can recover the secret and fewer than k reveal no information about it.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is backup copies. Put the key in five safes, give it to five executives, or split responsibility across several administrators.',
        'That helps with loss because one missing holder does not kill recovery. It fails against theft because one stolen copy is the whole secret.',
        'Another obvious approach is byte splitting, where each person gets a chunk. That protects against one holder knowing everything, but losing one chunk can make recovery impossible and partial chunks may leak structure.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The system needs both availability and privacy. Any k holders should recover the secret, but k - 1 holders should not learn whether the secret is 9, 10, or any other valid value.',
        'This is stronger than hiding the secret by obscurity. The fewer-than-threshold shares must leave every possible secret equally plausible.',
        'Ordinary redundancy cannot give that contract. It either gives too much to each holder or makes recovery brittle when a holder disappears.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A polynomial of degree k - 1 is fixed by k distinct points. Shamir puts the secret at the intercept f(0), chooses the other coefficients randomly, and gives each holder a nonzero point on the polynomial.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/66/3_polynomials_of_degree_2_through_2_points.svg/250px-3_polynomials_of_degree_2_through_2_points.svg.png',
          alt: 'Several degree two polynomials passing through the same two points',
          caption: 'Fewer than the threshold points leave many compatible polynomials, which is the privacy intuition. Source: Wikipedia Shamir secret sharing image https://en.wikipedia.org/wiki/Shamir%27s_secret_sharing.',
        },
        'The x coordinate can be public, and the y coordinate is the share value. Recovery is interpolation, not voting.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Choose a finite field large enough to encode the secret and all share values. For a k-of-n scheme, sample k - 1 random coefficients and define f(x) = secret + a1*x + a2*x^2 + ... + a(k-1)*x^(k-1).',
        'Give holders the shares (1, f(1)), (2, f(2)), up to (n, f(n)). The x values must be distinct and nonzero, because f(0) is reserved for the secret.',
        'To recover, take any k shares and compute f(0) using Lagrange interpolation. The interpolation weights cancel the x, x^2, and higher terms at zero, leaving only the intercept.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness comes from polynomial uniqueness over a field. If k valid shares came from one degree-(k - 1) polynomial, interpolation reconstructs that polynomial and therefore recovers its value at x = 0.',
        'Privacy comes from the random remaining freedom. With only k - 1 shares, every possible intercept can be completed by one compatible degree-(k - 1) polynomial.',
        'Because the dealer chose the hidden coefficients uniformly, the observed k - 1 shares do not make one candidate secret more likely than another. The threshold is enforced by algebra, assuming the field arithmetic and randomness are correct.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Straightforward sharing costs O(nk) field operations because the dealer evaluates a degree-(k - 1) polynomial at n x values. If n doubles while k stays fixed, share generation roughly doubles.',
        'Straightforward reconstruction costs O(k^2) field operations with direct Lagrange interpolation. Each share stores one x coordinate, one y value, and metadata identifying the scheme, field, threshold, and ceremony.',
        'The operational cost is larger than the formula. Strong randomness, authenticated storage, share labels, recovery rehearsals, and post-recovery rotation are part of the real system.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Shamir sharing fits disaster recovery for root keys, offline custody, backup encryption keys, and emergency access ceremonies. The workload is rare recovery with strong resistance to one compromised holder.',
        'It is also useful when a system needs a clear quorum rule. A 3-of-5 policy can tolerate two lost shares and still require at least three holders to reconstruct.',
        'For large data, systems usually encrypt the data once and Shamir-share the small encryption key. Splitting terabytes directly into Shamir shares is the wrong granularity.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when the secret must be used constantly. Reconstruction creates a moment where the full secret exists, so frequent use may need threshold signatures or hardware-backed workflows instead.',
        'It fails when shareholders can submit fake shares unless the system authenticates them. Verifiable secret sharing, commitments, or signed share metadata are needed in malicious settings.',
        'It also fails when ceremony metadata is lost. A share without threshold, field, version, x coordinate, and secret label may be mathematically valid but operationally useless.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Use the toy field mod 17 and a 3-of-5 scheme. Let f(x) = 9 + 4x + 2x^2 mod 17, so the secret is f(0) = 9.',
        'The shares are f(1)=15, f(2)=8, f(3)=5, f(4)=6, and f(5)=11. Choose shares (1,15), (3,5), and (5,11) for recovery.',
        'The Lagrange weights at x = 0 are 4, 3, and 11 mod 17. Reconstruction computes 15*4 + 5*3 + 11*11 = 196, and 196 mod 17 = 9, which recovers the secret.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Adi Shamir, "How to Share a Secret" at https://web.mit.edu/6.857/OldStuff/Fall03/ref/Shamir-HowToShareASecret.pdf, with the ACM DOI page at https://dl.acm.org/doi/10.1145/359168.359176.',
        'Study modular arithmetic, finite fields, and Lagrange interpolation first. Then study Reed-Solomon erasure coding, verifiable secret sharing, threshold signatures, polynomial commitments, and operational key ceremonies.',
      ],
    },
  ],
};
