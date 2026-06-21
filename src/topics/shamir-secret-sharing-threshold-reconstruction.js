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
        'Follow the visualization step by step. Each frame shows one operation with the current state highlighted. Use the slider or play button to control playback.',
        {type: 'image', src: './assets/gifs/shamir-secret-sharing-threshold-reconstruction.gif', alt: 'Animated walkthrough of the shamir secret sharing threshold reconstruction visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Some secrets must survive loss without becoming easy to steal. A root encryption key, recovery key, signing key, or emergency credential cannot live only in one safe, one laptop, or one person\'s memory. That is available only until the holder disappears.',
        {
          type: 'callout',
          text: 'Shamir sharing makes recovery a threshold algebra problem: enough points determine the secret, fewer points leave every secret possible.',
        },
        'Copying the secret fixes availability by destroying the security model. One stolen copy is the secret. Shamir secret sharing gives a cleaner contract: split one secret into n shares so any k shares reconstruct it, while k - 1 or fewer shares leave the secret completely undetermined.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The reasonable first attempt is redundancy: put the key in several places and require people or procedures to protect each copy. This is simple, and it is why backup copies are common outside cryptography.',
        'The wall is that redundancy changes the threat model. If five people each hold a full copy, the attacker needs one mistake. Splitting the bytes into chunks has the opposite problem: missing one chunk can block recovery, and partial chunks may leak structure. The system needs quorum recovery without partial disclosure.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A polynomial of degree k - 1 is fixed by k distinct points. With fewer than k points, many polynomials still fit. Shamir puts the secret at f(0), chooses the other coefficients uniformly at random, and gives participants nonzero points on the curve.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/66/3_polynomials_of_degree_2_through_2_points.svg/250px-3_polynomials_of_degree_2_through_2_points.svg.png',
          alt: 'Several degree two polynomials passing through the same two points',
          caption: 'Fewer than the threshold points leave many compatible polynomials, which is the privacy intuition. Source: Wikipedia Shamir secret sharing image https://en.wikipedia.org/wiki/Shamir%27s_secret_sharing.',
        },
        'The x coordinate can be public. The y coordinate is the share. Recovery is not a vote and not a password ceremony; it is interpolation over a finite field. The threshold is enforced by algebra, not by trust in a coordinator.',
      ],
    },
    {
      heading: 'What the views teach',
      paragraphs: [
        'In the share-generation view, watch the secret flow into the polynomial as the intercept, not as a copied value. The random coefficient node matters because those coefficients are the mask that makes every fewer-than-threshold view compatible with every possible secret.',
        'In the reconstruction view, focus on the selected shares and the lambda nodes. The shares do not reveal the whole curve one by one. Their Lagrange weights cancel every nonconstant term at x = 0, leaving only the original intercept.',
        'The picture is deliberately small, but the algebraic meaning is the same in a real field. Shares are points on a hidden polynomial. The threshold is the number of points needed to pin down that polynomial. The plot is not suggesting that attackers are confused by a curved line; it is showing how much mathematical freedom remains below the threshold.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Choose a finite field large enough for the secret representation and for n distinct x values. For a k-of-n scheme, sample k - 1 random coefficients and build f(x) = secret + a1*x + a2*x^2 + ... + a(k-1)*x^(k-1). Then hand out shares (1, f(1)), (2, f(2)), and so on.',
        'Reconstruction takes any k shares and evaluates f(0) with Lagrange interpolation. It does not need to recover every coefficient first. Each selected share is multiplied by a basis weight that equals 1 at that share\'s x position, 0 at the other selected x positions, and a useful value at x = 0.',
        'The field requirement is not cosmetic. Division during interpolation means every nonzero denominator must have an inverse. Integers with normal division or floating point arithmetic do not give the same guarantees. Real implementations use a prime field or a binary extension field, encode the secret into field elements, and track the field choice in share metadata.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness comes from uniqueness. Over a field, k distinct points determine exactly one polynomial of degree at most k - 1. If the dealer generated shares from that polynomial, interpolating any k valid shares gives the same polynomial, so f(0) is the original secret.',
        'Privacy comes from the remaining freedom. Given only k - 1 shares, every possible intercept can be completed by exactly one degree-(k - 1) polynomial that matches those shares. Because the hidden coefficients were chosen uniformly, the observed shares do not make one candidate secret more likely than another.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'The visualization uses the toy field mod 17 and the polynomial f(x) = 9 + 4x + 2x^2. The secret is f(0) = 9. Evaluating at x = 1 through 5 gives shares (1,15), (2,8), (3,5), (4,6), and (5,11). This tiny field is readable on screen, not secure.',
        'Pick shares (1,15), (3,5), and (5,11). Their Lagrange weights at x = 0 are 4, 3, and 11 mod 17. Reconstruction computes 15*4 + 5*3 + 11*11 = 196, and 196 mod 17 = 9. The arithmetic returns the intercept, not a majority vote among shares.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'Straightforward share generation costs O(nk): evaluate a degree-(k - 1) polynomial for n share positions. Straightforward reconstruction costs O(k^2) field operations with direct Lagrange interpolation. Each share stores one field element plus its x coordinate and metadata.',
        'The operational cost is often larger than the math. Shares need strong randomness, authenticated storage, versioned metadata, trustee replacement rules, tested recovery steps, and erasure after use. A threshold scheme that nobody has rehearsed is not a recovery plan.',
        'Changing the threshold later is not free. To move from 3-of-5 to 4-of-7, a system normally runs a new sharing ceremony for the same secret or for a rotated replacement secret. Old shares must be revoked or destroyed according to policy, because stale shares can preserve old access paths.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Shamir sharing fits offline recovery keys, disaster recovery, custody ceremonies, high-value signing keys, and administrative actions where no single holder should be able to act alone. It is useful when availability and insider resistance must be tuned with one threshold parameter.',
        'It also fits systems that need small shares. In the basic scheme, each share is the size of one field element for each secret field element. For large data, share an encryption key and store the encrypted data normally instead of splitting the whole dataset into Shamir shares.',
      ],
    },
    {
      heading: 'Where it is not the right tool',
      paragraphs: [
        'It is a poor fit for secrets that must be used constantly. Every reconstruction creates a moment where the full secret exists again. If the system needs frequent live authorization, threshold signatures, hardware-backed keys, or multisignature workflows may reduce the need to reassemble the secret.',
        'It is also not enough when shareholders may submit fake shares or when the dealer may be malicious. Those settings need authenticated shares, commitments, verifiable secret sharing, or a different protocol. Shamir sharing alone assumes valid shares from a valid sharing ceremony.',
        'It is also not a backup catalog. Shamir protects the secret value, but it does not tell future operators which system the key belongs to, which version is current, who is authorized to combine shares, or what to rotate after recovery. Those facts belong in separate, authenticated procedure documents.',
      ],
    },
    {
      heading: 'Operational guidance',
      paragraphs: [
        'Give every share a clear identifier: scheme version, threshold, total share count, field or library version, x coordinate, creation date, and the protected secret label. Store that metadata without exposing the y value. During recovery, reject duplicate x coordinates and shares from different ceremonies before interpolation begins.',
        'Plan the human ceremony as carefully as the code. Use independent storage locations, tamper-evident packaging when appropriate, authenticated communication between trustees, and a rehearsal with a test secret. After a real reconstruction, rotate dependent credentials if the recovery environment may have exposed the secret.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'Do not use floating-point interpolation. Do not use a toy modulus. Do not reuse the same random polynomial coefficients for different secrets. Do not lose the x coordinate or the field/version metadata. Do not treat a printed share as self-authenticating.',
        'The dangerous window is reconstruction. Verify participants, isolate the machine, control logging and screenshots, rotate dependent keys when appropriate, and wipe temporary material. The scheme prevents fewer-than-threshold disclosure; it does not make the reconstructed key harmless.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Adi Shamir, "How to Share a Secret" at https://web.mit.edu/6.857/OldStuff/Fall03/ref/Shamir-HowToShareASecret.pdf and the ACM DOI page at https://dl.acm.org/doi/10.1145/359168.359176.',
        'Study finite fields and modular inverses first if the arithmetic feels opaque. Then study Reed-Solomon erasure coding for the coding-theory cousin, KZG polynomial commitments for commitment-based polynomial checks, threshold signatures for avoiding reconstruction, and verifiable secret sharing for malicious-share settings.',
      ],
    },
  ],
};
