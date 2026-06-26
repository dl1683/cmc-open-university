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
  const pipelineNodes = ['coeff', 'twid', 'butter', 'freq', 'point', 'inv'];
  const pipelineEdges = ['e-coeff-butter', 'e-twid-butter', 'e-butter-freq', 'e-freq-point', 'e-point-inv'];

  yield {
    state: nttGraph('NTT reuses the FFT dataflow shape'),
    highlight: { active: ['coeff', 'twid', 'butter', 'e-coeff-butter', 'e-twid-butter'], found: ['freq'] },
    explanation: `The number theoretic transform is the modular-arithmetic cousin of the FFT. Its ${pipelineNodes.length}-node pipeline evaluates polynomial coefficients at powers of a root of unity inside a finite ring.`,
    invariant: `All arithmetic is modulo q; the root schedule must match the ring across all ${pipelineEdges.length} edges of the transform path.`,
  };

  const stageRows = [
    { id: 's0', label: 's0' },
    { id: 's1', label: 's1' },
    { id: 's2', label: 's2' },
    { id: 's3', label: 's3' },
  ];
  const stageData = [
    ['2', 'z1', 'pairs'],
    ['4', 'z2', 'quads'],
    ['8', 'z4', 'blocks'],
    ['16', 'z8', 'blocks'],
  ];

  yield {
    state: labelMatrix(
      'Butterfly stages',
      stageRows,
      [
        { id: 'span', label: 'span' },
        { id: 'twid', label: 'twid' },
        { id: 'work', label: 'work' },
      ],
      stageData,
    ),
    highlight: { active: ['s0:work', 's1:work'], found: ['s2:twid', 's3:twid'] },
    explanation: `A butterfly schedule across ${stageRows.length} stages is a compact data structure: stage, span, twiddle index, source positions, and modular reduction rule. Implementations often run it in-place with spans doubling from ${stageData[0][0]} to ${stageData[stageRows.length - 1][0]}.`,
  };

  const kyberMarker = { id: 'kyber', label: '256', x: 256, y: 20 };
  const bigMarker = { id: 'big', label: 'large', x: 1024, y: 42 };

  yield {
    state: plotState({
      axes: { x: { label: 'degree n', min: 0, max: 1024 }, y: { label: 'relative ops', min: 0, max: 100 } },
      series: [
        { id: 'school', label: 'n2', points: [{ x: 64, y: 4 }, { x: 128, y: 12 }, { x: 256, y: 30 }, { x: 512, y: 65 }, { x: 1024, y: 100 }] },
        { id: 'ntt', label: 'nlogn', points: [{ x: 64, y: 8 }, { x: 128, y: 13 }, { x: 256, y: 20 }, { x: 512, y: 30 }, { x: 1024, y: 42 }] },
      ],
      markers: [kyberMarker, bigMarker],
    }, { title: 'NTT changes the multiplication curve' }),
    highlight: { active: ['ntt'], compare: ['school'], found: ['kyber'] },
    explanation: `For small toy inputs, schoolbook multiplication is easier. At degree ${kyberMarker.x} (Kyber's operating point), NTT-shaped multiplication becomes the throughput engine for lattice schemes with repeated polynomial products.`,
  };

  const ledgerRows = [
    { id: 'mod', label: 'mod q' },
    { id: 'root', label: 'root' },
    { id: 'order', label: 'order' },
    { id: 'time', label: 'time' },
  ];
  const ledgerData = [
    ['3329', 'overflow'],
    ['zetas', 'wrong root'],
    ['bitrev', 'mismatch'],
    ['ct path', 'leak'],
  ];

  yield {
    state: labelMatrix(
      'Implementation ledger',
      ledgerRows,
      [
        { id: 'stores', label: 'stores' },
        { id: 'risk', label: 'risk' },
      ],
      ledgerData,
    ),
    highlight: { active: ['mod:stores', 'root:stores'], found: ['time:risk'] },
    explanation: `The cryptographic implementation ledger tracks ${ledgerRows.length} concerns (${ledgerRows.map(r => r.label).join(', ')}): reductions, table layout, memory access, and branch behavior can become security facts.`,
  };
}

function* ringMultiply() {
  const pathRows = [
    { id: 'a', label: 'a' },
    { id: 'b', label: 'b' },
    { id: 'fa', label: 'A' },
    { id: 'fb', label: 'B' },
  ];
  const pathData = [
    ['coeffs', 'NTT'],
    ['coeffs', 'NTT'],
    ['evals', 'mul'],
    ['evals', 'mul'],
  ];
  const inputPolys = pathRows.filter(r => r.id === 'a' || r.id === 'b');

  yield {
    state: labelMatrix(
      'Polynomial product path',
      pathRows,
      [
        { id: 'state', label: 'state' },
        { id: 'next', label: 'next' },
      ],
      pathData,
    ),
    highlight: { active: ['a:next', 'b:next'], found: ['fa:state', 'fb:state'] },
    explanation: `Polynomial multiplication tracks ${pathRows.length} rows: ${inputPolys.length} input polynomials and their transforms. Transform both, multiply matching coordinates in the ${pathData[2][0]} domain, then invert back to ${pathData[0][0]}.`,
  };

  const midNodes = ['freq', 'point', 'inv'];
  const midEdges = ['e-freq-point', 'e-point-inv'];

  yield {
    state: nttGraph('Pointwise product is the middle state'),
    highlight: { active: [...midNodes, ...midEdges], compare: ['coeff'] },
    explanation: `The transform is valuable because convolution in coefficient space becomes coordinate-wise multiplication across the ${midNodes.length} middle nodes (${midNodes.join(', ')}) of the NTT domain.`,
  };

  const ringData = [
    ['Zq[X]/f', 'wrap'],
    ['256', 'fixed'],
    ['q', 'reduce'],
    ['small', 'security'],
  ];

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
      ringData,
    ),
    highlight: { active: ['ring:fact', 'mod:fact'], found: ['noise:why'] },
    explanation: `Lattice KEMs and signatures are not doing arbitrary polynomial math. They operate in ${ringData[0][0]} with degree ${ringData[1][0]}, carefully choosing fixed dimensions, moduli, compression, and noise distributions.`,
  };

  const studyRows = [
    { id: 'ntt', label: 'NTT' },
    { id: 'kem', label: 'ML-KEM' },
    { id: 'sig', label: 'ML-DSA' },
    { id: 'hash', label: 'SLH' },
  ];
  const studyData = [
    ['poly mul', 'lattice'],
    ['key', 'TLS'],
    ['sign', 'auth'],
    ['hash tree', 'backup'],
  ];

  yield {
    state: labelMatrix(
      'Study map',
      studyRows,
      [
        { id: 'role', label: 'role' },
        { id: 'next', label: 'next' },
      ],
      studyData,
    ),
    highlight: { active: ['ntt:role', 'kem:next', 'sig:next'], compare: ['hash:role'] },
    explanation: `NTT is the performance bridge into ${studyRows.length} post-quantum topics (${studyRows.map(r => r.label).join(', ')}). Hash-based signatures use a different family: Merkle-style trees and many one-time signatures.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the first view as an FFT-shaped pipeline executed with modular integers. Coefficients enter, butterfly stages mix pairs with public twiddle factors, the NTT domain holds evaluations, coordinate-wise multiplication happens there, and the inverse NTT returns coefficients. The safe inference is that every value is reduced modulo q; no floating-point rounding is allowed.',
        'The ring-multiply view shows why the transform exists. Two polynomial products become transform both inputs, multiply matching coordinates, then invert. If the root, modulus, ordering, or inverse scale is wrong, the visual path still runs but the algebra is wrong.',
        {type: 'image', src: './assets/gifs/ntt-polynomial-multiplication-primer.gif', alt: 'Animated walkthrough of the ntt polynomial multiplication primer visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {type: 'callout', text: 'The NTT wins by changing representation: convolution is wide mixing in coefficient space and pointwise multiplication in modular evaluation space.'},
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/a/a4/Clock_group.svg', alt: 'Clock faces showing arithmetic wrapping around a fixed modulus', caption: 'The clock-face view of modular arithmetic shows why values wrap instead of rounding; NTT arithmetic uses the same exact wraparound discipline in a larger ring. Source: Wikimedia Commons, public domain.'},
        'Modern lattice cryptography repeatedly multiplies polynomials with coefficients modulo an integer q. A polynomial is a list of coefficients such as 3 + 2x + 5x^2. A modular ring means coefficients wrap around modulo q and high-degree terms wrap according to a fixed polynomial rule.',
        'The number theoretic transform, or NTT, exists because direct polynomial multiplication is too expensive on the hot path. It is the FFT idea rebuilt over exact modular arithmetic so cryptographic implementations do not depend on floating-point rounding.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is schoolbook multiplication. Multiply every coefficient a[i] by every coefficient b[j], add the product to output coefficient i + j, then reduce modulo q and apply the ring wrap rule. This is easy to audit and excellent for tiny cases.',
        'For degree n, schoolbook multiplication does about n^2 coefficient products. At n = 256, that is 65,536 pair products for one multiplication before reductions and wrap handling. A protocol that performs many such products quickly turns that simple method into the bottleneck.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is repeated convolution cost. Convolution means every output coefficient mixes many input pairs. The algorithm is correct, but the amount of mixing grows quadratically as degree grows.',
        'A normal complex FFT is not a clean replacement in cryptography. Rounding differences can break test vectors, signatures, or decapsulation. The transform must be exact across platforms, and its memory access must not leak secret-dependent information.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/7/78/DIT-FFT-butterfly.svg', alt: 'Decimation in time FFT butterfly signal flow graph', caption: 'The butterfly dataflow is the reusable schedule: combine pairs, apply public twiddle factors, and repeat by stages. The NTT keeps that schedule but changes the arithmetic to modular integers. Source: Wikimedia Commons, public domain.'},
        'The core insight is that multiplication is hard in coefficient form but easy in evaluation form. If C(x) = A(x)B(x), then C(r) = A(r)B(r) at every evaluation point r. The transform moves coefficients to evaluations at powers of a modular root of unity.',
        'A root of unity is a number omega where omega^n = 1 modulo q. The powers of omega provide the evaluation points. The inverse transform uses inverse powers and multiplies by n inverse modulo q to recover coefficients.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Choose a modulus q, length n, ring rule, and root schedule that match the scheme. The forward NTT uses butterfly operations to evaluate the polynomial at powers of the root. A butterfly reads two values u and v, computes a twiddle-scaled value t, and writes u + t and u - t modulo q.',
        'To multiply two polynomials, run the forward NTT on both coefficient arrays. Multiply corresponding transformed coordinates modulo q. Run the inverse NTT and apply the inverse scale. In cryptographic schemes, the exact table order and coefficient layout are part of the contract.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/4f/KL_Intel_i7_die.jpg', alt: 'Processor die with dense arithmetic and memory structures', caption: 'The NTT is asymptotically better, but target hardware still decides which reduction strategy, table layout, and vector path are fastest. Source: Wikimedia Commons, KL and Intel, public domain.'},
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness follows from the evaluation identity. Two polynomials are equal if they agree at enough distinct points under the chosen ring conditions. The NTT evaluates both inputs at those points, multiplies the values, and the inverse transform reconstructs the coefficient representation of the product.',
        'The butterfly schedule works because powers of the root have symmetry. Even and odd positions can be combined into smaller subproblems, then recombined by stages. Each stage touches n values once, and there are log n stages for power-of-two lengths.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Schoolbook multiplication is O(n^2). The NTT path is O(n log n) for each transform plus O(n) for pointwise multiplication, so polynomial multiplication becomes O(n log n). When n doubles, schoolbook work roughly quadruples, while transform work a little more than doubles.',
        'The hidden cost is modular arithmetic engineering. Montgomery or Barrett reduction, table locality, register pressure, vectorization, and constant-time memory access decide real speed. In cryptography, branch behavior and memory access patterns are part of the security cost, not just performance details.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'NTT multiplication is a core performance primitive in lattice key encapsulation and signatures, including ML-KEM and related CRYSTALS-Kyber-family designs. These schemes use fixed moduli, fixed degrees, and many repeated polynomial products, which is exactly where precomputed root tables and tuned butterflies pay off.',
        'It also matters in embedded and hardware implementations. A microcontroller may be limited by RAM and multiplication latency, while a server may be limited by vector width and cache layout. The same algebra appears, but the best reduction strategy and schedule can differ by platform.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The NTT fails if any parameter is mismatched: wrong modulus, wrong root, wrong transform length, wrong inverse scaling, wrong coefficient order, or wrong ring relation. These bugs can pass weak random tests and still fail published vectors. The implementation must be tied to the exact scheme contract.',
        'It can also be the wrong algorithm for very small sizes, where schoolbook or Karatsuba may be faster. A mathematically correct NTT can still be insecure if it branches on secret data or uses secret-dependent table access. Fast modular arithmetic is not enough for cryptographic code.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Use a toy cyclic ring modulo q = 17 with n = 4 and omega = 4. Since 4^2 = 16 = -1 mod 17 and 4^4 = 1 mod 17, omega has order 4. Let a = [1, 2, 3, 0] and b = [3, 1, 2, 0].',
        'Evaluating at 1, 4, 16, and 13 gives A = [6, 6, 2, 7] and B = [6, 5, 4, 14]. Pointwise products modulo 17 are C = [2, 13, 8, 13]. The inverse transform uses n inverse = 13 modulo 17 and returns [9, 7, 13, 7], which matches direct cyclic convolution.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: NIST FIPS 203 for ML-KEM, the CRYSTALS-Kyber specification, and implementation notes from constant-time cryptography libraries that document NTT tables and reduction bounds.',
        'Study Modular Arithmetic, Binary Exponentiation, Roots of Unity, FFT, Convolution, Montgomery Reduction, Barrett Reduction, Constant-Time Programming, ML-KEM, and ML-DSA next. The useful checkpoint is whether you can compare NTT multiplication against schoolbook multiplication for the same tiny ring.',
      ],
    },
  ],
};
