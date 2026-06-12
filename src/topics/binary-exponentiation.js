// Binary exponentiation: compute huge powers in a handful of steps by
// squaring your way up the exponent's binary digits. The arithmetic trick
// that makes RSA possible — and the reason your TLS handshake is instant.

import { arrayState, InputError } from '../core/state.js';

export const topic = {
  id: 'binary-exponentiation',
  title: 'Binary Exponentiation',
  category: 'Concepts',
  summary: 'Square-and-multiply along the exponent\'s bits — a^n in O(log n) steps instead of n.',
  controls: [
    { id: 'problem', label: 'Compute', type: 'select', options: ['7^45 mod 100', '3^10 mod 50'], defaultValue: '7^45 mod 100' },
  ],
  run,
};

const PROBLEMS = {
  '7^45 mod 100': { base: 7, exp: 45, mod: 100 },
  '3^10 mod 50': { base: 3, exp: 10, mod: 50 },
};

export function* run(input) {
  const problem = PROBLEMS[String(input.problem)];
  if (!problem) throw new InputError('Pick a computation.');
  const { base, exp, mod } = problem;

  const bits = exp.toString(2).split('');
  const bitView = () => arrayState(bits);

  yield {
    state: bitView(),
    highlight: {},
    explanation: `Compute ${base}^${exp} mod ${mod}. The naive way multiplies ${base} into a running product ${exp - 1} times. Fine here — but RSA does this with exponents over 600 DIGITS long, where "one multiply per unit of exponent" would outlast the universe. The escape: look at the exponent in BINARY. ${exp} = ${bits.join('')}₂ — just ${bits.length} bits.`,
  };

  yield {
    state: bitView(),
    highlight: { active: bits.map((b, i) => (b === '1' ? `i${i}` : null)).filter(Boolean) },
    explanation: `Why binary helps: squaring DOUBLES an exponent (x^k · x^k = x^2k). So reading the exponent's bits left to right: each bit means "square what you have" — and each 1-bit additionally means "multiply in one ${base}". ${bits.length} bits → at most ${bits.length} squarings + ${bits.filter((b) => b === '1').length} extra multiplies, instead of ${exp - 1}.`,
    invariant: 'After processing the first k bits, the result equals base raised to the number those k bits spell — mod m.',
  };

  let result = 1;
  let squarings = 0;
  let multiplies = 0;
  for (let i = 0; i < bits.length; i += 1) {
    const before = result;
    result = (result * result) % mod;
    squarings += 1;
    let text = `Bit ${i + 1} ('${bits[i]}'): SQUARE — ${before}² = ${before * before}${before * before >= mod ? ` ≡ ${result} (mod ${mod})` : ''}.`;
    if (bits[i] === '1') {
      const beforeMul = result;
      result = (result * base) % mod;
      multiplies += 1;
      text += ` The bit is 1, so also MULTIPLY by ${base}: ${beforeMul} × ${base} = ${beforeMul * base}${beforeMul * base >= mod ? ` ≡ ${result} (mod ${mod})` : ''}.`;
    } else {
      text += ' The bit is 0 — squaring alone suffices.';
    }
    text += ` Exponent so far: ${parseInt(bits.slice(0, i + 1).join(''), 2)} of ${exp}; result so far: ${result}. Note how taking mod ${mod} after every step keeps the numbers tiny — they never grow past ${(mod - 1)}², no matter how astronomical ${base}^${exp} really is.`;
    yield {
      state: bitView(),
      highlight: { active: [`i${i}`], visited: bits.slice(0, i).map((_, k) => `i${k}`) },
      explanation: text,
    };
  }

  yield {
    state: bitView(),
    highlight: { found: bits.map((_, i) => `i${i}`) },
    explanation: `Answer: ${base}^${exp} mod ${mod} = ${result}, in ${squarings} squarings + ${multiplies} multiplies = ${squarings + multiplies} operations instead of ${exp - 1}. The gap is logarithmic: a 2048-bit RSA exponent needs ~4,000 operations instead of ~2^2048 — the entire difference between "your HTTPS handshake takes milliseconds" and "impossible".`,
  };

  yield {
    state: bitView(),
    highlight: {},
    explanation: 'Where this one trick runs: RSA and Diffie–Hellman key exchange (modular exponentiation IS the cryptography — see Hash Table for hashing\'s related modular tricks), fast hash computations, and a beautiful generalization: the same square-and-multiply works on MATRICES, which computes the n-th Fibonacci number in O(log n) — exponentially faster than the Memoization (Dynamic Programming) approach, which was itself exponentially faster than plain Recursion. Three topics, three speedups, one ladder.',
  };
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        `Binary Exponentiation computes a^n quickly by reading n in binary. Instead of multiplying by a exactly n times, it repeatedly squares and sometimes multiplies by the base. The visualization computes 7^45 mod 100 or 3^10 mod 50. For 45, the bits are 101101, so only a handful of square-and-multiply steps are needed. Taking the modulus after every operation keeps values small enough to display.`,
        `The idea is divide-and-conquer for powers. If you know a^k, then squaring gives a^(2k). If the next exponent bit is 1, multiply once more by a. This is the same broad family of thinking as Binary Search: represent the problem in bits, then discard linear repetition. Big-O Growth Rates turns that intuition into the formal drop from O(n) multiplications to O(log n).`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `In the left-to-right version shown here, start with result = 1. For each exponent bit, square result. If the bit is 1, multiply by the base. Reduce modulo m after each square and multiply. The invariant is precise: after processing the first k bits, result equals base raised to the integer represented by those k bits, modulo m. The demo prints the exponent-so-far after every bit so the invariant is visible rather than abstract.`,
        `There is also a right-to-left version that keeps a moving power of the base and consumes low bits first. Both rely on associativity, so the method works beyond ordinary numbers: matrices, permutations, polynomials, and group elements can all be exponentiated this way if multiplication is associative.`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `If n has b bits, binary exponentiation performs b squarings and at most b extra multiplications. That is O(log n) arithmetic operations. For a 2048-bit private exponent in RSA-style modular arithmetic, the worst-case loop is about 4096 modular multiplications, not 2^2048. Space is O(1) if bits are streamed, or O(log n) if the bit string is stored. Real cryptographic libraries also account for big-integer multiplication cost, but the exponent loop is still logarithmic.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `Modular exponentiation powers RSA decryption and signatures, classic Diffie-Hellman key exchange, and many number-theory protocols. Elliptic-curve systems use the related double-and-add pattern for scalar multiplication. Matrix powers appear in Markov Chains & Steady States, PageRank, and fast Fibonacci computation. With the standard 2 by 2 Fibonacci matrix, exponentiation gives Fibonacci(n) in O(log n) matrix multiplies, while Memoization (Dynamic Programming) gives O(n) and naive Recursion is exponential.`,
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        `The speedup does not come from the modulus; it comes from reading the exponent in binary. The modulus prevents overflow and keeps arithmetic bounded. Another mistake is postponing modulo until the end, which creates enormous intermediate numbers and breaks fixed-width languages. For security code, timing matters too: branching on secret exponent bits can leak information, so production libraries use constant-time variants. Hash Table is related only in the broad sense that both use modular arithmetic; hashing is not exponentiation.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Study Recursion for the divide-and-conquer form, then Big-O Growth Rates for the logarithmic payoff. Memoization (Dynamic Programming) is the next comparison point for Fibonacci. Binary Search builds the same "use bits to skip work" instinct. For matrix-heavy applications, read Markov Chains & Steady States, PageRank, Eigenvalues & Eigenvectors, and SVD & Low-Rank Approximation.`,
      ],
    },
  ],
};
