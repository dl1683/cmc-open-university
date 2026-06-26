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
        'The visualization runs a radix-2 Cooley-Tukey FFT on a short input array. Each cell holds one complex number. Colored swaps at the start show the bit-reversal permutation, which reorders the input so that butterflies can operate in place. Highlighted cell pairs mark the butterfly currently being computed.',
        {type: 'callout', text: 'The FFT wins by reusing symmetry: each butterfly pays once for information that the direct DFT recomputes many times.'},
        'A butterfly is the core operation: it takes two values separated by a fixed distance (the half-span), multiplies the lower value by a twiddle factor (a complex number on the unit circle), then writes the sum into the upper slot and the difference into the lower slot. The twiddle factor rotates as the algorithm moves through each group, and that rotation is what distinguishes one frequency bin from the next.',
        'After all butterfly stages finish, the array holds the frequency-domain output. X[0] is always the sum of all input values. For real-valued inputs, the magnitude spectrum is symmetric around the midpoint because X[k] and X[N-k] are complex conjugates.',
        {type: 'image', src: './assets/gifs/fft.gif', alt: 'Animated walkthrough of the fft visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A signal recorded over time is a list of samples. The discrete Fourier transform (DFT) takes that list and produces a new list of the same length, where each entry tells you how much of a particular frequency is present in the original signal, along with that frequency\'s phase. Audio equalizers, JPEG compression, radar processing, and polynomial multiplication all need this decomposition.',
        'The direct way to compute a DFT costs O(N^2) work. The Fast Fourier Transform (FFT) computes the exact same result in O(N log N) by exploiting symmetry in the complex roots of unity. Cooley and Tukey published the modern version in 1965, though Gauss had used a similar trick around 1805 for asteroid orbit calculations.',
        'The difference is not marginal. At N = 1024, the direct DFT needs about one million multiplications; the FFT needs about five thousand. At N = 44,100 (one second of CD audio), the FFT is roughly 2,700 times faster. Without this algorithm, real-time audio, MRI imaging, and modern wireless communication would be computationally out of reach.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The DFT formula says: for each output frequency bin k, sum all N input samples, each multiplied by a complex exponential that depends on k and the sample index n. Written out: X[k] = sum over n of x[n] * e^(-2*pi*i*n*k/N). Two nested loops, N outputs times N inputs, N^2 complex multiplications total.',
        'For small N this is perfectly fine. A 4-point DFT needs 16 multiplications. The code is short, each output bin is independent of the others, and debugging is straightforward. At small scale, there is nothing wrong with brute force.',
        'The trouble starts when N stops being small, and in practice it always does.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'N^2 hits a wall fast. A radar or seismology system recording one million samples needs 10^12 complex multiplications per transform. At a billion operations per second, that takes over 15 minutes for a single transform.',
        'CD audio runs at 44,100 samples per second. A one-second spectral analysis by direct DFT requires 44,100^2 = 1.9 billion multiplications, and a spectrogram sliding across a three-minute song repeats that calculation thousands of times. A real-time audio processor must finish each frame within its time budget with room to spare.',
        'Images face the same problem. A 1024x1024 image processed row-by-row then column-by-column requires 2,048 separate 1024-point DFTs. Direct DFT: about 2 billion multiplications. With FFT: about 20 million. The line between "runs in real time" and "takes minutes per frame" falls exactly here.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The DFT matrix is not random. Every entry is a power of a single number: W = e^(-2*pi*i/N), called the principal Nth root of unity. This W lives on the unit circle in the complex plane, and its powers have two properties the FFT exploits. First, periodicity: W^N = 1, so powers wrap around after N steps. Second, half-circle symmetry: W^(k + N/2) = -W^k, meaning the root halfway around the circle is the negation of the root you started with.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/78/DIT-FFT-butterfly.svg/330px-DIT-FFT-butterfly.svg.png', alt: 'Decimation in time FFT butterfly diagram combining even and odd transforms', caption: 'A radix-2 FFT combines even and odd half-size transforms through repeated butterfly operations. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:DIT-FFT-butterfly.svg.'},
        'Because of that symmetry, the N-point DFT splits cleanly into two N/2-point DFTs: one over the even-indexed inputs, one over the odd-indexed inputs. The butterfly combination formula is X[k] = E[k] + W^k * O[k] and X[k + N/2] = E[k] - W^k * O[k]. A single twiddle multiplication W^k * O[k] yields both outputs, because the second formula just flips the sign. Every multiplication does double duty.',
        'Apply the same split recursively. Each N/2-point DFT splits into two N/4-point DFTs, and so on, until the sub-problems reach size 1, where the DFT of a single sample is just the sample itself. There are log2(N) levels of splitting. Each level performs N/2 butterflies. Total cost: N/2 * log2(N) complex multiplications.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The in-place radix-2 FFT has three phases. Phase one is bit-reversal permutation: rearrange the input array so that the value at index i moves to the index whose binary representation is i\'s bits written in reverse order. For N = 8, index 1 (binary 001) swaps with index 4 (binary 100), and index 3 (binary 011) swaps with index 6 (binary 110). After this shuffle, every butterfly stage can read from and write to the correct positions without needing a separate output array.',
        'Phase two is log2(N) butterfly stages. In stage s (starting from 0), each butterfly spans 2^(s+1) positions and pairs entries separated by half that span, 2^s. The butterfly reads the upper and lower value, multiplies the lower by the twiddle factor W^(k * N / span), writes the sum into the upper slot and the difference into the lower slot. Within each group, the twiddle factor rotates through successive roots of unity as k increments.',
        'Phase three: the array now holds the N frequency-domain values X[0] through X[N-1]. To compute the inverse FFT, use conjugate twiddle factors (positive exponent instead of negative) and divide every output by N. The same butterfly structure works in both directions.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Start from the DFT definition X[k] = sum of x[n] * W^(nk) and split the sum by parity of n. The even-indexed terms give sum of x[2m] * W^(2mk), which is the DFT of the even subsequence evaluated at W^2 (itself a root of unity for N/2). The odd-indexed terms give W^k * sum of x[2m+1] * W^(2mk), the DFT of the odd subsequence scaled by the twiddle factor W^k.',
        'The symmetry W^(k + N/2) = -W^k means the twiddle factor for bin k + N/2 is the negation of the one for bin k. So one multiplication of W^k times the odd-half DFT value produces both X[k] (by adding to the even-half value) and X[k + N/2] (by subtracting). Every multiplication pulls double duty; no work is wasted.',
        'Correctness follows by induction on the recursion depth. Base case: a 1-point DFT returns the input unchanged. Inductive step: if the two N/2-point sub-DFTs are correct, the butterfly combination formula produces the correct N-point DFT. The bit-reversal permutation guarantees that each input sample starts in the position the first butterfly stage expects, and each subsequent stage reads the partial results left by the previous one.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Time is O(N log2 N). There are log2(N) butterfly stages, each performing N/2 butterflies. Each butterfly costs one complex multiplication and two complex additions. Doubling N adds one stage, so the work slightly more than doubles rather than quadrupling as it would with the direct DFT.',
        'Space is O(N) for the in-place iterative version. Bit-reversal and all butterfly stages operate on the same array with O(1) auxiliary storage. A recursive implementation uses O(log N) stack frames.',
        'At N = 1024: the FFT performs 10 stages times 512 butterflies = 5,120 complex multiplications. The direct DFT performs 1024^2 = 1,048,576. That is a 205x reduction. At N = 4096 the ratio grows to 341x. The savings ratio is N / log2(N), which grows without bound.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Audio: MP3 and AAC encoding convert time-domain audio frames into frequency coefficients using the modified DCT (a close relative of the FFT), then quantize and entropy-code those coefficients. Equalizers split audio into frequency bands via FFT, adjust magnitudes per band, and inverse-FFT back to time domain. Noise cancellation identifies unwanted frequencies and subtracts them.',
        'Images: JPEG compresses 8x8 pixel blocks using the 2D DCT. High-frequency coefficients (fine detail) are quantized more aggressively, which is why heavy JPEG compression produces visible blockiness. MRI scanners acquire data directly in frequency space (called k-space) and reconstruct the image via 2D inverse FFT.',
        'Polynomial and integer multiplication: to multiply two polynomials of degree n, pad their coefficient arrays to length 2n, FFT both, multiply pointwise in the frequency domain, then inverse-FFT the result. Total cost: O(n log n) instead of O(n^2). This is the basis of the Schonhage-Strassen algorithm for fast big-integer multiplication.',
        'Convolution: the convolution theorem says that convolution in the time domain equals pointwise multiplication in the frequency domain. FIR filtering, cross-correlation, and convolution layers in neural networks all exploit this. Three O(N log N) steps (forward FFT, pointwise multiply, inverse FFT) replace one O(N^2) direct convolution.',
        'Radar and seismology: radar systems FFT returned signals to detect Doppler frequency shifts, separating targets by velocity. Seismologists decompose ground vibration recordings into frequency spectra for earthquake characterization. Certain partial differential equations become simpler in the frequency domain because differentiation turns into multiplication by the frequency variable.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The radix-2 FFT requires N to be a power of 2. Inputs of other lengths must be zero-padded to the next power of 2, which wastes memory and can introduce spectral artifacts. Mixed-radix algorithms (Bluestein\'s, Rader\'s) handle arbitrary N but are harder to implement and somewhat slower.',
        'Floating-point rounding errors accumulate across log2(N) butterfly stages because each twiddle factor involves a cos/sin computation. For most signal processing the error is negligible, but for exact integer arithmetic (cryptography, number theory) it is unacceptable. The number-theoretic transform (NTT) solves this by replacing complex roots of unity with modular roots of unity over a finite field, eliminating rounding entirely.',
        'For very small N (below about 16 to 64 depending on implementation), the direct DFT can be faster because the FFT pays overhead for bit-reversal, twiddle-factor setup, and the stage loop structure. Libraries typically switch to a direct computation below a tuned crossover point.',
        'Spectral leakage is an inherent limitation of the DFT, not the FFT specifically. The DFT assumes the input repeats periodically. If a frequency component does not complete a whole number of cycles within the N-sample window, its energy leaks into neighboring bins. Windowing functions (Hann, Hamming, Blackman) taper the signal edges to reduce leakage at the cost of slightly blurring the frequency resolution.',
        'Latency: the FFT must buffer a complete block of N samples before computing, adding at least N / sample_rate seconds of delay. Overlap-add and overlap-save methods reduce perceived latency but add implementation complexity.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Input: x = [1, 0, 2, 0, 3, 0, 1, 0], N = 8. We need log2(8) = 3 butterfly stages. The principal 8th root of unity is W = e^(-2*pi*i/8). Key values: W^0 = 1, W^1 = (1-i)/sqrt(2) which is approximately 0.707 - 0.707i, W^2 = -i, W^3 = (-1-i)/sqrt(2) which is approximately -0.707 - 0.707i.',
        'Bit-reversal permutation: reverse each 3-bit index. Index 0 (000) stays at 0. Index 1 (001) goes to 4 (100). Index 2 (010) stays at 2 (010). Index 3 (011) goes to 6 (110). Index 4 (100) goes to 1 (001). Index 5 (101) stays at 5. Index 6 (110) goes to 3 (011). Index 7 (111) stays at 7. After the shuffle the array is [1, 3, 2, 1, 0, 0, 0, 0].',
        'Stage 1 (span = 2, half-span = 1, all twiddle factors are W^0 = 1): four butterflies pair adjacent elements. Positions 0-1: top = 1 + 1*3 = 4, bottom = 1 - 1*3 = -2. Positions 2-3: top = 2 + 1*1 = 3, bottom = 2 - 1*1 = 1. Positions 4-5: both zero, stay zero. Positions 6-7: both zero, stay zero. Array becomes [4, -2, 3, 1, 0, 0, 0, 0].',
        'Stage 2 (span = 4, half-span = 2, twiddle factors cycle through W^0 = 1 and W^2 = -i): two groups of two butterflies. Group [0-3]: positions 0-2 with twiddle 1 give top = 4 + 3 = 7, bottom = 4 - 3 = 1. Positions 1-3 with twiddle -i give product = -i * 1 = -i, so top = -2 + (-i) = -2 - i, bottom = -2 - (-i) = -2 + i. Group [4-7]: all values are zero so nothing changes. Array becomes [7, -2-i, 1, -2+i, 0, 0, 0, 0].',
        'Stage 3 (span = 8, half-span = 4, twiddle factors cycle through W^0, W^1, W^2, W^3): positions 0-4 with twiddle 1 give 7 + 0 = 7 and 7 - 0 = 7. Positions 1-5 with twiddle W^1: product is (0.707-0.707i) * 0 = 0, so both slots keep their current value of -2 - i. Positions 2-6 with twiddle -i: product is 0, so both keep value 1. Positions 3-7 with twiddle W^3: product is 0, so both keep value -2 + i.',
        'Final result: X = [7, -2-i, 1, -2+i, 7, -2-i, 1, -2+i]. Sanity check: X[0] = 7 equals the sum of all inputs (1+0+2+0+3+0+1+0 = 7). The FFT used 3 stages times 4 butterflies = 12 complex multiplications. The direct DFT would have needed 8^2 = 64. Even at this tiny size, the FFT saves a factor of 5.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Cooley and Tukey, "An Algorithm for the Machine Calculation of Complex Fourier Series," Mathematics of Computation 19(90), 1965. Gauss used a similar factorization around 1805; this was rediscovered by Heideman, Johnson, and Burrus in 1984. Oppenheim and Schafer, "Discrete-Time Signal Processing" (3rd edition, 2010), chapters 8-9, gives the standard textbook treatment with proofs.',
        'Prerequisites: complex numbers (the twiddle factors are points on the unit circle), roots of unity (the symmetry that makes even-odd splitting work), and recursion (the divide-and-conquer structure). Study next: polynomial multiplication (the FFT as a fast multiplication engine), convolution (the theorem linking time-domain convolution to frequency-domain multiplication), and the number-theoretic transform (exact-arithmetic FFT over finite fields for cryptography and big-integer math).',
      ],
    },
  ],
};
