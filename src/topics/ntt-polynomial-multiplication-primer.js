// Number theoretic transform: FFT-shaped polynomial multiplication over a
// finite modular ring, using roots of unity and butterfly schedules.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'ntt-polynomial-multiplication-primer',
  title: 'NTT Polynomial Multiplication Primer',
  category: 'Security',
  summary: 'A post-quantum crypto primer: modular polynomial rings, roots of unity, butterfly schedules, coefficient transforms, pointwise products, inverse NTT, and constant-time implementation ledgers.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['butterfly schedule', 'ring multiply'], defaultValue: 'butterfly schedule' },
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

function nttGraph(title) {
  return graphState({
    nodes: [
      { id: 'coeff', label: 'coeff', x: 0.8, y: 3.5, note: 'a[i]' },
      { id: 'twid', label: 'twid', x: 2.5, y: 2.0, note: 'zeta' },
      { id: 'butter', label: 'butter', x: 4.3, y: 3.5, note: 'add/sub' },
      { id: 'freq', label: 'NTT', x: 6.1, y: 3.5, note: 'evals' },
      { id: 'point', label: 'point', x: 7.8, y: 2.0, note: 'mul' },
      { id: 'inv', label: 'iNTT', x: 8.6, y: 5.0, note: 'coeff' },
    ],
    edges: [
      { id: 'e-coeff-butter', from: 'coeff', to: 'butter' },
      { id: 'e-twid-butter', from: 'twid', to: 'butter' },
      { id: 'e-butter-freq', from: 'butter', to: 'freq' },
      { id: 'e-freq-point', from: 'freq', to: 'point' },
      { id: 'e-point-inv', from: 'point', to: 'inv' },
    ],
  }, { title });
}

function* butterflySchedule() {
  yield {
    state: nttGraph('NTT reuses the FFT dataflow shape'),
    highlight: { active: ['coeff', 'twid', 'butter', 'e-coeff-butter', 'e-twid-butter'], found: ['freq'] },
    explanation: 'The number theoretic transform is the modular-arithmetic cousin of the FFT. It evaluates polynomial coefficients at powers of a root of unity inside a finite ring.',
    invariant: 'All arithmetic is modulo q; the root schedule must match the ring and transform length.',
  };

  yield {
    state: labelMatrix(
      'Butterfly stages',
      [
        { id: 's0', label: 's0' },
        { id: 's1', label: 's1' },
        { id: 's2', label: 's2' },
        { id: 's3', label: 's3' },
      ],
      [
        { id: 'span', label: 'span' },
        { id: 'twid', label: 'twid' },
        { id: 'work', label: 'work' },
      ],
      [
        ['2', 'z1', 'pairs'],
        ['4', 'z2', 'quads'],
        ['8', 'z4', 'blocks'],
        ['16', 'z8', 'blocks'],
      ],
    ),
    highlight: { active: ['s0:work', 's1:work'], found: ['s2:twid', 's3:twid'] },
    explanation: 'A butterfly schedule is a compact data structure: stage, span, twiddle index, source positions, and modular reduction rule. Implementations often run it in-place.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'degree n', min: 0, max: 1024 }, y: { label: 'relative ops', min: 0, max: 100 } },
      series: [
        { id: 'school', label: 'n2', points: [{ x: 64, y: 4 }, { x: 128, y: 12 }, { x: 256, y: 30 }, { x: 512, y: 65 }, { x: 1024, y: 100 }] },
        { id: 'ntt', label: 'nlogn', points: [{ x: 64, y: 8 }, { x: 128, y: 13 }, { x: 256, y: 20 }, { x: 512, y: 30 }, { x: 1024, y: 42 }] },
      ],
      markers: [
        { id: 'kyber', label: '256', x: 256, y: 20 },
        { id: 'big', label: 'large', x: 1024, y: 42 },
      ],
    }, { title: 'NTT changes the multiplication curve' }),
    highlight: { active: ['ntt'], compare: ['school'], found: ['kyber'] },
    explanation: 'For small toy inputs, schoolbook multiplication is easier. For lattice schemes with repeated polynomial products, NTT-shaped multiplication is the throughput engine.',
  };

  yield {
    state: labelMatrix(
      'Implementation ledger',
      [
        { id: 'mod', label: 'mod q' },
        { id: 'root', label: 'root' },
        { id: 'order', label: 'order' },
        { id: 'time', label: 'time' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['3329', 'overflow'],
        ['zetas', 'wrong root'],
        ['bitrev', 'mismatch'],
        ['ct path', 'leak'],
      ],
    ),
    highlight: { active: ['mod:stores', 'root:stores'], found: ['time:risk'] },
    explanation: 'The cryptographic implementation ledger matters as much as the asymptotic idea: reductions, table layout, memory access, and branch behavior can become security facts.',
  };
}

function* ringMultiply() {
  yield {
    state: labelMatrix(
      'Polynomial product path',
      [
        { id: 'a', label: 'a' },
        { id: 'b', label: 'b' },
        { id: 'fa', label: 'A' },
        { id: 'fb', label: 'B' },
      ],
      [
        { id: 'state', label: 'state' },
        { id: 'next', label: 'next' },
      ],
      [
        ['coeffs', 'NTT'],
        ['coeffs', 'NTT'],
        ['evals', 'mul'],
        ['evals', 'mul'],
      ],
    ),
    highlight: { active: ['a:next', 'b:next'], found: ['fa:state', 'fb:state'] },
    explanation: 'Polynomial multiplication can move into the transform domain: transform both polynomials, multiply matching coordinates, then invert back to coefficients.',
  };

  yield {
    state: nttGraph('Pointwise product is the middle state'),
    highlight: { active: ['freq', 'point', 'inv', 'e-freq-point', 'e-point-inv'], compare: ['coeff'] },
    explanation: 'The transform is valuable because convolution in coefficient space becomes coordinate-wise multiplication in the NTT domain.',
  };

  yield {
    state: labelMatrix(
      'Ring constraints',
      [
        { id: 'ring', label: 'ring' },
        { id: 'deg', label: 'deg' },
        { id: 'mod', label: 'mod' },
        { id: 'noise', label: 'noise' },
      ],
      [
        { id: 'fact', label: 'fact' },
        { id: 'why', label: 'why' },
      ],
      [
        ['Zq[X]/f', 'wrap'],
        ['256', 'fixed'],
        ['q', 'reduce'],
        ['small', 'security'],
      ],
    ),
    highlight: { active: ['ring:fact', 'mod:fact'], found: ['noise:why'] },
    explanation: 'Lattice KEMs and signatures are not doing arbitrary polynomial math. They operate in carefully chosen rings with fixed dimensions, moduli, compression, and noise distributions.',
  };

  yield {
    state: labelMatrix(
      'Study map',
      [
        { id: 'ntt', label: 'NTT' },
        { id: 'kem', label: 'ML-KEM' },
        { id: 'sig', label: 'ML-DSA' },
        { id: 'hash', label: 'SLH' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'next', label: 'next' },
      ],
      [
        ['poly mul', 'lattice'],
        ['key', 'TLS'],
        ['sign', 'auth'],
        ['hash tree', 'backup'],
      ],
    ),
    highlight: { active: ['ntt:role', 'kem:next', 'sig:next'], compare: ['hash:role'] },
    explanation: 'NTT is the performance bridge into module-lattice systems. Hash-based signatures use a different family: Merkle-style trees and many one-time signatures.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'butterfly schedule') yield* butterflySchedule();
  else if (view === 'ring multiply') yield* ringMultiply();
  else throw new InputError('Pick an NTT view.');
}

export const article = {
  sections: [
    { heading: 'What it is', paragraphs: ['A number theoretic transform is an FFT-shaped transform over a finite modular ring. It turns polynomial convolution into coordinate-wise multiplication using roots of unity modulo q.', 'In post-quantum lattice schemes, polynomial multiplication is a hot path. The NTT is the data-structure and algorithmic layout that makes those products practical.'] },
    { heading: 'How it works', paragraphs: ['The transform repeatedly applies butterfly operations. Each butterfly combines two coefficients with a twiddle factor and modular reductions. The schedule can be represented as stages, spans, twiddle indexes, and array positions.', 'After two polynomials are transformed, multiplication is coordinate-wise. The inverse transform returns the product to coefficient form under the scheme-specific ring relation.'] },
    { heading: 'Cost and complexity', paragraphs: ['Schoolbook multiplication is quadratic in degree. Transform-based multiplication is roughly n log n plus modular arithmetic overhead. Constant factors, memory layout, reduction strategy, and side-channel discipline decide real speed.'] },
    { heading: 'Complete case study', paragraphs: ['A Kyber-like implementation stores 256 coefficients modulo q, runs an in-place transform using a fixed zeta table, multiplies transformed coordinates, and runs the inverse transform. The audit ledger records q, root table version, reduction bounds, coefficient layout, and constant-time review.', 'A bug in bit-reversal order or twiddle indexing can produce outputs that look random but fail interoperability. A branch or table lookup keyed by secret data can turn a correct algorithm into a leaking implementation.'] },
    { heading: 'Pitfalls', paragraphs: ['Do not treat NTT as ordinary floating FFT. There are no rounding errors, but every operation is modular and parameter-specific. Do not copy a transform schedule between schemes without checking modulus, root order, ring polynomial, and coefficient ordering.'] },
    { heading: 'Sources and study next', paragraphs: ['Primary sources: FIPS 203 ML-KEM at https://csrc.nist.gov/pubs/fips/203/final and the CRYSTALS-Kyber specification at https://pq-crystals.org/kyber/data/kyber-specification-round3-20210804.pdf. Study Binary Exponentiation, Convolution, ML-KEM Kyber Module-Lattice KEM Case Study, and ML-DSA Dilithium Rejection Sampling Case Study next.'] },
  ],
};
