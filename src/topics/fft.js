// Fast Fourier Transform: compute the discrete Fourier transform in
// O(n log n) by exploiting symmetry in roots of unity.

import { arrayState, plotState, matrixState, parseNumberList } from '../core/state.js';

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

export const topic = {
  id: 'fft',
  title: 'Fast Fourier Transform (FFT)',
  category: 'Algorithms',
  summary: 'Compute the DFT in O(n log n) instead of O(n²): split into even and odd indices, recurse, combine with butterfly operations using roots of unity.',
  controls: [
    { id: 'values', label: 'Values', type: 'number-list', defaultValue: '1, 2, 3, 4' },
  ],
  run,
};

// ── helpers ──────────────────────────────────────────────────────────

function fmt(re, im) {
  const r = Math.round(re * 1000) / 1000;
  const i = Math.round(im * 1000) / 1000;
  if (i === 0) return `${r}`;
  if (r === 0) return i === 1 ? 'i' : i === -1 ? '-i' : `${i}i`;
  return i > 0 ? `${r}+${i}i` : `${r}${i}i`;
}

function complexMul(aRe, aIm, bRe, bIm) {
  return [aRe * bRe - aIm * bIm, aRe * bIm + aIm * bRe];
}

function bitReverse(x, bits) {
  let result = 0;
  for (let i = 0; i < bits; i++) {
    result = (result << 1) | (x & 1);
    x >>= 1;
  }
  return result;
}

function nextPow2(n) {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

// ── generator ────────────────────────────────────────────────────────

export function* run(input) {
  const raw = parseNumberList(input.values, { max: 16 });
  const N = nextPow2(raw.length);
  const bits = Math.log2(N);

  // Zero-pad to power of 2
  const x = raw.slice();
  while (x.length < N) x.push(0);

  // Show input
  yield {
    state: arrayState(x),
    highlight: { active: x.map((_, i) => `i${i}`) },
    explanation: `Input: [${x.join(', ')}]. Length ${N} is a power of 2${raw.length < N ? ` (zero-padded from ${raw.length})` : ''}. The FFT will decompose this into ${N} frequency bins using ${bits} butterfly stages.`,
  };

  // Bit-reversal permutation
  const re = new Array(N);
  const im = new Array(N).fill(0);
  const brMap = [];
  for (let i = 0; i < N; i++) {
    const j = bitReverse(i, bits);
    re[i] = x[j];
    brMap.push(`${i}←${j}`);
  }

  yield {
    state: arrayState(re),
    highlight: { swap: re.map((_, i) => `i${i}`) },
    explanation: `Bit-reversal permutation: reorder indices by reversing their ${bits}-bit binary representations. Mapping: ${brMap.join(', ')}. This lets every butterfly stage work in-place without overwriting values it still needs.`,
    invariant: 'After bit-reversal, each index holds the input element whose original index has the reversed bit pattern.',
  };

  // Butterfly stages
  for (let stage = 0; stage < bits; stage++) {
    const halfSpan = 1 << stage;
    const span = halfSpan << 1;
    const twiddleStep = N / span;

    yield {
      state: arrayState(re.map((v, i) => Math.round(v * 100) / 100)),
      highlight: { range: re.map((_, i) => `i${i}`) },
      explanation: `Stage ${stage + 1} of ${bits}: butterfly span is ${span}, half-span is ${halfSpan}. Each butterfly pairs elements ${halfSpan} apart and combines them using a twiddle factor — a root of unity e^(-2πik/${span}).`,
    };

    for (let start = 0; start < N; start += span) {
      for (let k = 0; k < halfSpan; k++) {
        const topIdx = start + k;
        const botIdx = start + k + halfSpan;
        const angle = -2 * Math.PI * k * twiddleStep / N;
        const wRe = Math.cos(angle);
        const wIm = Math.sin(angle);

        const [tRe, tIm] = complexMul(wRe, wIm, re[botIdx], im[botIdx]);

        const oldTopRe = re[topIdx];
        const oldTopIm = im[topIdx];

        re[topIdx] = oldTopRe + tRe;
        im[topIdx] = oldTopIm + tIm;
        re[botIdx] = oldTopRe - tRe;
        im[botIdx] = oldTopIm - tIm;

        // Show individual butterfly for small N, grouped for large N
        if (N <= 8) {
          yield {
            state: arrayState(re.map((v, i) => Math.round(v * 100) / 100)),
            highlight: { active: [`i${topIdx}`, `i${botIdx}`] },
            explanation: `Butterfly: positions ${topIdx} and ${botIdx}. Twiddle factor W = ${fmt(wRe, wIm)}. Multiply W × x[${botIdx}] = ${fmt(tRe, tIm)}. Top becomes ${fmt(re[topIdx], im[topIdx])}, bottom becomes ${fmt(re[botIdx], im[botIdx])}. Each butterfly reuses the twiddle computation for both outputs — that reuse is why FFT beats direct DFT.`,
            invariant: `After this butterfly, positions ${topIdx} and ${botIdx} hold partial DFTs for their sub-problem at span ${span}.`,
          };
        }
      }
    }
  }

  // Final result
  const resultLabels = [];
  const resultRowDefs = [];
  const resultRows = [];
  for (let i = 0; i < N; i++) {
    resultLabels.push(`X[${i}] = ${fmt(re[i], im[i])}`);
    resultRowDefs.push({ id: `f${i}`, label: `X[${i}]` });
    resultRows.push([fmt(re[i], im[i]), `${Math.round(Math.sqrt(re[i] * re[i] + im[i] * im[i]) * 1000) / 1000}`]);
  }

  yield {
    state: labelMatrix(
      'FFT output: frequency bins',
      resultRowDefs,
      [{ id: 'val', label: 'value' }, { id: 'mag', label: '|X[k]|' }],
      resultRows,
    ),
    highlight: { found: resultRowDefs.map((r) => `${r.id}:val`) },
    explanation: `Done. The ${N}-point FFT produced ${N} frequency bins in ${N * bits} butterfly operations instead of ${N * N} multiplications for the direct DFT. ${resultLabels.join('; ')}.`,
  };

  // Cost comparison plot
  const sizes = [4, 8, 16, 32, 64, 128, 256, 512, 1024];
  yield {
    state: plotState({
      axes: { x: { label: 'n', min: 0, max: 1100 }, y: { label: 'multiplications', min: 0, max: 1100000 } },
      series: [
        { id: 'dft', label: 'DFT O(n²)', points: sizes.map((n) => ({ x: n, y: n * n })) },
        { id: 'fft', label: 'FFT O(n log n)', points: sizes.map((n) => ({ x: n, y: n * Math.log2(n) })) },
      ],
      markers: [
        { id: 'm1024', label: 'n=1024', x: 1024, y: 1024 * 10 },
      ],
    }),
    explanation: `At n = 1024: direct DFT needs 1,048,576 complex multiplications. FFT needs 10,240 — a 102× speedup. The gap widens with every doubling of n. At 44,100 samples (one second of CD audio), the ratio exceeds 2,700×.`,
  };
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation walks a radix-2 Cooley-Tukey FFT from input to frequency-domain output. Each array cell holds one complex number. Swap-colored cells mark the bit-reversal permutation that reorders input before the first butterfly stage. Active (highlighted) cells mark the pair being combined by a butterfly operation.',
        {type: 'callout', text: 'The FFT wins by reusing symmetry: each butterfly pays once for information that the direct DFT recomputes many times.'},
        'Each butterfly takes two values separated by half-span positions, multiplies the bottom value by a twiddle factor (a complex root of unity rotating around the unit circle), then writes top + product into the upper position and top - product into the lower position. The formula is X[k] = E[k] + W^k * O[k] and X[k + N/2] = E[k] - W^k * O[k]. Watch the twiddle factor rotate as k increases within each stage: that rotation is what separates different frequency bins.',
        'The final matrix lists each frequency bin X[k] with its complex value and magnitude. X[0] is always the sum of all input values (the DC component). For real-valued inputs, X[k] and X[N-k] are complex conjugates, so the magnitude spectrum is symmetric around the midpoint.',
      
        {type: 'image', src: './assets/gifs/fft.gif', alt: 'Animated walkthrough of the fft visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'The discrete Fourier transform (DFT) decomposes a signal into frequency components. Given N time-domain samples, it produces N complex numbers encoding the amplitude and phase of each frequency present. Audio equalizers, image compression, spectral analysis, radar processing, and polynomial multiplication all depend on computing DFTs.',
        'The direct DFT multiplies an N*N matrix of complex exponentials by the input vector. That costs O(N^2) complex multiplications. Gauss used a shortcut around 1805 for interpolating asteroid orbits, but the technique was lost until Cooley and Tukey rediscovered it in their 1965 paper "An Algorithm for the Machine Calculation of Complex Fourier Series." Their FFT computes the exact same DFT result in O(N log N) operations by exploiting symmetry in the roots of unity.',
        'The speedup is not incremental. At N = 1024 the direct DFT needs about 1 million multiplications; the FFT needs about 5,000. At N = 44,100 (one second of CD audio), the FFT is roughly 2,700 times faster. Without this algorithm, real-time audio processing, MRI reconstruction, and modern telecommunications would be computationally impractical. The FFT is one of the most consequential algorithms of the 20th century.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The DFT formula is X[k] = sum over n of x[n] * e^(-2*pi*i*n*k/N). For each of the N output frequency bins, you sum N input values each multiplied by the appropriate complex exponential. Two nested loops, N^2 complex multiplications, N^2 complex additions.',
        'For small N this is fine. A 4-point DFT needs 16 multiplications. The code is two loops with a sin/cos call inside. Each output bin is independent of the others, so debugging is easy and parallelization is trivial. There is nothing wrong with this approach at small scale.',
        'The problem is not correctness. The problem is that N grows fast in every real application.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'N^2 becomes a wall quickly. For N = 1,000,000 samples (a common signal length in radar or seismology), the direct DFT requires 10^12 complex multiplications. Even at a billion operations per second, that takes 1,000 seconds per transform.',
        'CD audio is sampled at 44,100 Hz. A one-second spectral analysis needs 44,100^2 = 1.9 billion multiplications. A real-time audio processor must finish this within one second while leaving time for everything else. A spectrogram sliding a window across a three-minute song repeats the DFT thousands of times.',
        'Images hit the same wall. A 1024x1024 image processed by row then by column needs 2,048 DFTs of length 1024. Direct DFT: about 2 billion multiplications. With FFT: about 20 million. JPEG compression at camera resolution would be impractical without a fast transform. The boundary is sharp: "runs in real time" versus "takes minutes per frame."',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The DFT matrix is not arbitrary. Every entry is a power of a single complex root of unity W = e^(-2*pi*i/N). These powers have two symmetries that the FFT exploits. Periodicity: W^N = 1, so powers wrap around. Symmetry: W^(k + N/2) = -W^k, so the root of unity halfway around the circle is the negation. Half the matrix entries are negations of the other half.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/78/DIT-FFT-butterfly.svg/330px-DIT-FFT-butterfly.svg.png', alt: 'Decimation in time FFT butterfly diagram combining even and odd transforms', caption: 'A radix-2 FFT combines even and odd half-size transforms through repeated butterfly operations. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:DIT-FFT-butterfly.svg.'},
        'Split the input into even-indexed samples and odd-indexed samples. The N-point DFT splits into two N/2-point DFTs plus a combination step. The combination is the butterfly: X[k] = E[k] + W^k * O[k] and X[k + N/2] = E[k] - W^k * O[k], where E[k] is the even-indexed half-DFT and O[k] is the odd-indexed half-DFT. One twiddle multiplication (W^k * O[k]) produces both outputs because of the sign symmetry.',
        'Recurse until the sub-problems reach size 1, where the DFT of a single value is just that value. There are log2(N) levels of recursion. Each level performs N/2 butterflies (one multiplication each). Total: N/2 * log2(N) complex multiplications.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The in-place radix-2 FFT has three phases. First, bit-reversal permutation: reorder the input array so that index i receives the value originally at the index whose binary representation is i with its bits reversed. For N = 8, index 3 (binary 011) swaps with index 6 (binary 110), index 1 (001) swaps with index 4 (100). This arrangement ensures every butterfly stage reads from and writes to the correct positions without an auxiliary array.',
        'Second, log2(N) butterfly stages. In stage s (counting from 0), each butterfly has a span of 2^(s+1) and a half-span of 2^s. The butterfly pairs positions (start + k) and (start + k + half-span), computes the twiddle product W^(k * N/span) times the bottom value, then writes sum to the top position and difference to the bottom. Within each span-sized group, the twiddle factor W^k rotates through the roots of unity as k increments, separating frequency bins.',
        'Third, the array now holds the N frequency-domain values X[0] through X[N-1]. For the inverse FFT, use conjugate twiddle factors (positive exponents instead of negative) and divide every output by N. The same butterfly structure works in both directions.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Write the DFT sum X[k] = sum of x[n] * W^(nk) and separate even and odd indices: X[k] = sum of x[2m] * W^(2mk) + W^k * sum of x[2m+1] * W^(2mk). The first sum is the DFT of the even-indexed subsequence evaluated at W^2 (which is a root of unity for N/2). The second sum is the DFT of the odd-indexed subsequence, multiplied by the twiddle factor W^k.',
        'The symmetry W^(k + N/2) = -W^k means the twiddle factor for frequency bin k + N/2 is the negation of the twiddle factor for bin k. One multiplication of W^k times the odd-half DFT value gives both X[k] (by adding to the even-half value) and X[k + N/2] (by subtracting). Every multiplication is used twice. No work is wasted.',
        'Correctness follows by induction. Base case: a 1-point DFT returns the input unchanged. Inductive step: if the N/2-point DFTs of even and odd subsequences are correct, the butterfly combination produces the correct N-point DFT. The bit-reversal permutation ensures each input value starts where the first butterfly stage expects it, and each subsequent stage reads the partial results left by the previous one.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Time: O(N log2 N) complex multiplications and additions. Each of the log2(N) stages performs N/2 butterflies. Each butterfly costs one complex multiplication plus two complex additions. Doubling N adds one more stage, so the work slightly more than doubles.',
        'Space: O(N) for the in-place version. Bit-reversal and all butterfly stages operate on the same array. The iterative implementation uses O(1) extra space beyond the data. A recursive version uses O(log N) stack frames.',
        'Concrete comparison at N = 1024: the FFT performs 10 stages * 512 butterflies = 5,120 complex multiplications. The direct DFT performs 1024^2 = 1,048,576 multiplications. That is a 205x reduction. At N = 4096 the ratio is 341x. The gap widens as N grows because the ratio is N / log2(N), which increases without bound.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Audio processing: MP3 and AAC encoding use the modified DCT (a close relative of the FFT) to convert time-domain audio frames into frequency coefficients that are then quantized and entropy-coded. Equalizers split audio into frequency bands via FFT, adjust magnitudes, and inverse-FFT back. Noise cancellation identifies unwanted frequency components and subtracts them. Pitch detection finds the dominant frequency in a vocal signal.',
        'Image processing: JPEG compresses 8x8 pixel blocks using the 2D DCT. High-frequency coefficients (fine detail) are quantized more aggressively, which is why JPEG artifacts appear as blockiness. MRI scanners acquire data directly in frequency space (k-space) and reconstruct the image via 2D inverse FFT.',
        'Polynomial multiplication: pad two degree-n coefficient arrays to length 2n, FFT both, multiply pointwise in the frequency domain, inverse-FFT the result. Total cost: O(n log n) instead of O(n^2). This underlies the Schonhage-Strassen algorithm for fast arbitrary-precision integer multiplication.',
        'Convolution: the convolution theorem says that convolution in the time domain equals pointwise multiplication in the frequency domain. FIR filtering, cross-correlation, pattern matching, and convolution layers in neural networks all exploit this. Transform, multiply, invert: three O(N log N) steps replace one O(N^2) convolution.',
        'Signal analysis: radar and sonar systems FFT returned signals to identify frequency shifts (Doppler), separating targets by velocity. Seismology uses FFTs to decompose ground vibration recordings into frequency spectra for earthquake analysis. Solving certain PDEs is faster in the frequency domain because differentiation becomes multiplication by frequency.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Power-of-2 sizes: the radix-2 FFT requires N to be a power of 2. Inputs of other lengths must be zero-padded to the next power of 2, wasting memory and potentially introducing spectral artifacts. Mixed-radix algorithms (Bluestein, Rader) handle arbitrary N but are more complex to implement.',
        'Floating-point precision: each butterfly multiplies by a complex exponential computed from cos and sin. Rounding errors accumulate across log2(N) stages. For signal processing this is negligible, but for exact integer arithmetic (cryptography, number theory), the number-theoretic transform (NTT) replaces complex roots of unity with modular roots of unity over a finite field, eliminating rounding entirely.',
        'Short signals: for very small N (say N = 4 or 8), the direct DFT may actually be faster because the FFT has overhead from bit-reversal, twiddle-factor computation, and the stage loop structure. The crossover point depends on the implementation, but it typically falls around N = 16 to 64.',
        'Spectral leakage: the DFT assumes the input signal repeats periodically. If the signal does not complete an integer number of cycles within the N-sample window, energy leaks from the true frequency into neighboring bins. Windowing functions (Hann, Hamming, Blackman) taper the signal edges to reduce leakage, trading frequency resolution for cleaner peaks.',
        'Latency: the FFT processes a complete block of N samples at once. Real-time systems must buffer a full block before computing, adding N/sample_rate seconds of delay. Overlap-add and overlap-save techniques mitigate this but increase implementation complexity.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Take x = [1, 0, 2, 0, 3, 0, 1, 0], N = 8. We need 3 butterfly levels (log2(8) = 3). The principal root of unity is W = e^(-2*pi*i/8), with key values: W^0 = 1, W^1 = (1-i)/sqrt(2) ~ 0.707 - 0.707i, W^2 = -i, W^3 = (-1-i)/sqrt(2) ~ -0.707 - 0.707i.',
        'Bit-reversal permutation (reverse the 3-bit index): 0(000)->0, 1(001)->4(100), 2(010)->2(010), 3(011)->6(110), 4(100)->1(001), 5(101)->5(101), 6(110)->3(011), 7(111)->7(111). Reordered: [1, 3, 2, 1, 0, 0, 0, 0].',
        'Level 1 (span 2, half-span 1, twiddle W^0 = 1 for all butterflies): Four independent butterflies, each pairing adjacent elements. Butterfly 0-1: top = 1 + 1*3 = 4, bottom = 1 - 1*3 = -2. Butterfly 2-3: top = 2 + 1*1 = 3, bottom = 2 - 1*1 = 1. Butterfly 4-5: top = 0 + 1*0 = 0, bottom = 0 - 1*0 = 0. Butterfly 6-7: top = 0 + 1*0 = 0, bottom = 0 - 1*0 = 0. Array: [4, -2, 3, 1, 0, 0, 0, 0].',
        'Level 2 (span 4, half-span 2, twiddle rotates as W^0 = 1 and W^2 = -i): Two groups of two butterflies each. Group [0-3]: Butterfly 0-2 with W^0 = 1: top = 4 + 1*3 = 7, bottom = 4 - 1*3 = 1. Butterfly 1-3 with W^2 = -i: multiply -i * 1 = -i, so top = -2 + (-i) = -2 - i, bottom = -2 - (-i) = -2 + i. Group [4-7]: Butterfly 4-6 with W^0 = 1: top = 0 + 1*0 = 0, bottom = 0 - 1*0 = 0. Butterfly 5-7 with W^2 = -i: multiply -i * 0 = 0, so top = 0, bottom = 0. Array: [7, -2-i, 1, -2+i, 0, 0, 0, 0].',
        'Level 3 (span 8, half-span 4, twiddle rotates through W^0, W^1, W^2, W^3): Butterfly 0-4 with W^0 = 1: top = 7 + 1*0 = 7, bottom = 7 - 1*0 = 7. Butterfly 1-5 with W^1 ~ 0.707 - 0.707i: multiply (0.707-0.707i) * 0 = 0, so top = -2 - i, bottom = -2 - i. Butterfly 2-6 with W^2 = -i: multiply -i * 0 = 0, so top = 1, bottom = 1. Butterfly 3-7 with W^3 ~ -0.707 - 0.707i: multiply (-0.707-0.707i) * 0 = 0, so top = -2 + i, bottom = -2 + i.',
        'Result: X = [7, -2-i, 1, -2+i, 7, -2-i, 1, -2+i]. Verify: X[0] = 7 is the sum of all inputs (1+0+2+0+3+0+1+0 = 7). The 8-point FFT used 3 levels * 4 butterflies = 12 complex multiplications. The direct DFT would have needed 8^2 = 64. Even at this small size, the FFT saves a factor of 5.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Cooley and Tukey, "An Algorithm for the Machine Calculation of Complex Fourier Series," Mathematics of Computation 19(90), 1965 -- the paper that launched the modern FFT. Gauss used a similar factorization around 1805 for interpolating asteroid orbits, as rediscovered by Heideman, Johnson, and Burrus in 1984. Oppenheim and Schafer, "Discrete-Time Signal Processing" (3rd edition, 2010), chapters 8-9, provides the standard textbook treatment.',
        'Prerequisites: Complex Numbers (twiddle factors live on the unit circle), Roots of Unity (the symmetry that makes even-odd splitting work), Recursion (the divide-and-conquer structure). Extensions: Polynomial Multiplication (FFT as the fast multiplication path), Convolution (the theorem connecting time-domain convolution to frequency-domain multiplication), Number Theoretic Transform (exact-arithmetic FFT over finite fields for cryptography and big-integer multiplication). Contrasting alternative: direct DFT for small N where the overhead of bit-reversal and stage management exceeds the cost of the N^2 inner loop.',
      ],
    },
  ],
};
