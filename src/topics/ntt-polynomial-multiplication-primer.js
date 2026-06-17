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
    {
      heading: 'Why this exists',
      paragraphs: [
        `Modern lattice cryptography does a large amount of polynomial arithmetic. ML-KEM, the NIST-standardized key-encapsulation mechanism derived from CRYSTALS-Kyber, works with vectors of polynomials over a modular ring. Signing schemes in the same family also spend much of their time moving between compact byte strings, coefficient arrays, and modular polynomial products.`,
        `A polynomial product is a convolution. Each output coefficient receives contributions from many pairs of input coefficients. If the implementation multiplies every pair directly, the work grows quadratically. That is easy to understand but expensive when the protocol repeats the operation many times with fixed-size polynomials.`,
        `The number theoretic transform, or NTT, exists to make those products fast without leaving exact modular arithmetic. It is the FFT idea rebuilt over a finite modular ring. Instead of using floating-point complex roots and then worrying about rounding, it uses roots of unity modulo a carefully chosen integer q.`,
      ],
    },
    {
      heading: 'Why schoolbook multiplication is not enough',
      paragraphs: [
        `The schoolbook method is the first correct baseline. To multiply a(x) and b(x), multiply every coefficient a[i] by every coefficient b[j], add the product into position i + j, reduce coefficients modulo q, and apply the ring rule that wraps high-degree terms back into the allowed degree range.`,
        `That direct method is valuable for reference code and tiny sizes because it has few moving parts. It also makes the ring relation visible. In a negacyclic ring such as Z_q[X] / (X^n + 1), a term X^n becomes -1, so high-degree terms wrap around with a sign change. In another ring, the wrap rule may differ.`,
        `The problem is throughput. Schoolbook multiplication is O(n^2). At n = 256, one product is still manageable, but real protocols do not do one product in isolation. They multiply many polynomials, perform reductions after intermediate arithmetic, and must do so inside tight latency, bandwidth, and side-channel constraints. The NTT changes the repeated hot path from pairwise coefficient mixing into transform, coordinate-wise multiply, and inverse transform.`,
      ],
    },
    {
      heading: 'Why a normal FFT is the wrong tool',
      paragraphs: [
        `A floating-point FFT solves a related mathematical problem, but it is not the right primitive for cryptographic polynomial multiplication. Cryptographic implementations need exact agreement across platforms and compilers. A rounding difference is not just a small numerical error; it can break decapsulation, signatures, test vectors, and interoperability.`,
        `The algebra also has to match the scheme. The modulus q, transform length, root order, ring polynomial, coefficient ordering, normalization factor, and reduction bounds are part of the algorithm. A root table copied from a different transform length or a different modulus can produce deterministic nonsense. Fast wrong arithmetic is still wrong.`,
        `Security adds a second constraint. The implementation must avoid leaking secret-dependent information through branches, memory access, timing, or error behavior. A transform pipeline that is mathematically correct but data-dependent can still be unacceptable in a key exchange or signature implementation.`,
      ],
    },
    {
      heading: 'The core mechanism',
      paragraphs: [
        `Multiplication is hard in coefficient form because every output position mixes many input pairs. It is easy in evaluation form because if C(x) = A(x)B(x), then C(r) = A(r)B(r) at each point r. The transform moves a polynomial from coefficients to evaluations at powers of a modular root of unity.`,
        `After both inputs are transformed, the middle step is simple: multiply matching coordinates modulo q. Then the inverse transform returns to coefficient representation. The NTT is useful because the forward and inverse transforms can be computed in O(n log n) time by reusing a butterfly schedule instead of evaluating the polynomial from scratch at every point.`,
        `A butterfly takes two values, combines them with a twiddle factor, and writes two new values. Across stages, the span doubles and different twiddle factors are used. This is the same dataflow shape as the FFT, but every add, subtract, multiply, and reduction happens modulo q.`,
      ],
    },
    {
      heading: 'Roots, rings, and exactness',
      paragraphs: [
        `A root of unity is a value omega such that omega^n = 1 modulo q. For a length-n transform, the useful root must have the right order: its smaller powers should not collapse too early. Otherwise the transform points are not distinct enough to recover the original coefficients.`,
        `The inverse transform depends on the inverse powers of the root and the modular inverse of n. That last detail is easy to miss. If the inverse transform forgets to multiply by n^{-1} modulo q, it returns a scaled result rather than the original coefficient vector.`,
        `In production schemes, the ring relation may require a specialized transform rather than the simplest cyclic example. ML-KEM uses q = 3329 and degree-256 polynomials in a ring with X^256 + 1. The standard describes an NTT representation because working in that representation makes multiplication significantly faster, but the representation is scheme-specific. Do not treat an educational NTT table as a portable Kyber table.`,
      ],
    },
    {
      heading: 'Worked toy example',
      paragraphs: [
        `Use a small cyclic example only to see the mechanics. Let q = 17, n = 4, and omega = 4. Since 4^2 = 16 = -1 mod 17 and 4^4 = 1 mod 17, omega has order 4. Take a = [1, 2, 3, 0] and b = [3, 1, 2, 0], representing coefficients modulo X^4 - 1 for this toy example.`,
        `Evaluate a at 1, 4, 16, and 13 to get A = [6, 6, 2, 7]. Evaluate b at the same points to get B = [6, 5, 4, 14]. Multiply coordinate-wise modulo 17: C = [2, 13, 8, 13]. The inverse transform uses inverse powers of omega and n^{-1} = 13 modulo 17.`,
        `The inverse returns [9, 7, 13, 7]. Direct cyclic convolution gives the same result: coefficient 0 is 1*3 + 2*0 + 3*2 + 0*1 = 9, coefficient 1 is 1*1 + 2*3 = 7, coefficient 2 is 1*2 + 2*1 + 3*3 = 13, and coefficient 3 is 2*2 + 3*1 = 7. The toy example is not ML-KEM, but it shows why transform, pointwise multiply, inverse transform is exact.`,
      ],
    },
    {
      heading: 'Why the butterfly schedule works',
      paragraphs: [
        `A direct evaluation at n points would still be expensive. The butterfly schedule saves work by using symmetry among powers of the root. Even and odd positions can be combined, then subproblems can be combined again at larger spans. Each stage touches all n coefficients once, and there are log n stages for power-of-two sizes.`,
        `The schedule is also an implementation data structure. It fixes stage order, span, twiddle index, memory layout, and reduction points. Forward and inverse schedules may use different twiddle order and normalization. Some implementations store coefficients in bit-reversed order; others arrange tables so the loop order produces the expected final layout.`,
        `Correctness depends on matching all of those choices. The mathematical transform can be written cleanly on paper, but the code is a ledger of conventions. If one side of a protocol uses a different coefficient order or inverse scaling, the byte strings will not interoperate even though both sides appear to be doing an NTT.`,
      ],
    },
    {
      heading: 'Cost and implementation behavior',
      paragraphs: [
        `The headline improvement is O(n log n) rather than O(n^2), but real performance is decided by constants. Modular multiplication, reduction strategy, table locality, cache behavior, register pressure, vectorization, and in-place writes determine whether the transform is actually fast on a target platform.`,
        `Reduction is a major design choice. Implementations may use Montgomery reduction, Barrett reduction, or scheme-specific bounds that postpone full reduction while keeping values safe from overflow. These choices must be proved against the maximum intermediate values, not just tested on random inputs.`,
        `Constant-time discipline is part of the algorithm in cryptographic settings. The transform loops should not branch on secret coefficients. Table access patterns should be public and fixed by the schedule. Error handling should not reveal secret-dependent paths. A fast transform that leaks through timing can weaken the system it was meant to accelerate.`,
      ],
    },
    {
      heading: 'Where it matters',
      paragraphs: [
        `The NTT matters most when the same parameter set is used repeatedly. Lattice KEMs and signatures have fixed dimensions, fixed moduli, fixed compression rules, and many polynomial products. That is exactly the environment where precomputed root tables and tuned butterfly loops pay off.`,
        `It also matters for hardware and embedded implementations. A microcontroller implementation has different bottlenecks from a server implementation: code size, stack use, RAM, multiplication latency, and side-channel leakage may dominate. The algorithmic idea is shared, but the best schedule and reduction strategy may differ.`,
        `For learners, NTT is the bridge between abstract polynomial rings and real post-quantum performance. Once the transform is understood, the speed of ML-KEM-style schemes is less mysterious: the hot path is a disciplined exact transform pipeline, not magical high-degree algebra performed directly every time.`,
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        `The first failure mode is parameter mismatch. Wrong modulus, wrong root, wrong transform length, wrong inverse scaling, or wrong ring relation all break correctness. These bugs can pass superficial tests if the test only checks shape, timing, or a few random cases without known vectors.`,
        `The second failure mode is overflow before reduction. Modular arithmetic does not mean intermediate machine integers are safe. A C implementation that multiplies or adds in the wrong type can overflow before the modular reduction runs, especially when ported across platforms.`,
        `The third failure mode is data-dependent behavior. Secret-dependent branches, secret-dependent memory access, early exits, and variable-time arithmetic can become side channels. This is why cryptographic NTT code is reviewed differently from ordinary numerical code.`,
        `The fourth failure mode is using the wrong algorithm for the size. For very small polynomials, schoolbook or Karatsuba can be faster and simpler. Many high-quality implementations use hybrids because asymptotic complexity is not the whole performance story.`,
      ],
    },
    {
      heading: 'Operational guidance',
      paragraphs: [
        `Keep a transform ledger for any serious implementation. Record q, n, ring polynomial, primitive root or root table source, stage order, bit-reversal convention, forward normalization, inverse normalization, reduction method, coefficient bounds, test-vector source, and constant-time review status.`,
        `Build tests in layers. First test modular arithmetic helpers. Then test forward followed by inverse on many inputs. Then test NTT multiplication against a simple schoolbook reference for the exact same ring. Finally test against published scheme vectors. Random tests are useful, but published vectors catch convention mismatches that random shape tests can miss.`,
        `Treat optimization as a proof obligation. If a change delays reduction, fuses stages, vectorizes butterflies, or rewrites memory layout, update the bound argument and test vectors. The optimized loop is not merely a faster version of the reference loop; it is a new implementation of the same algebraic contract.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Primary sources: NIST FIPS 203 ML-KEM at https://csrc.nist.gov/pubs/fips/203/final and the CRYSTALS-Kyber specification at https://pq-crystals.org/kyber/data/kyber-specification-round3-20210804.pdf. For the base algorithmic ladder, study Modular Arithmetic, Binary Exponentiation, Roots of Unity, Fast Fourier Transform, and Convolution.`,
        `Then connect the transform to systems that use it. Study ML-KEM for key establishment, ML-DSA for signatures, Constant-Time Programming for side-channel discipline, Montgomery Reduction and Barrett Reduction for modular arithmetic, Cache Locality for schedule layout, and Karatsuba Multiplication for the small-size alternative that still appears in hybrid implementations.`,
      ],
    },
  ],
};
