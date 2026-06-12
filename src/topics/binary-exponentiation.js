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
        `Binary exponentiation (also called binary squaring or exponentiation by squaring) is an algorithm for computing enormous powers of the form a^n mod m in roughly log(n) operations instead of n. The trick: read the exponent as a binary number, and for each bit, either square your result or square-then-multiply-by-the-base. You never actually compute a^n directly — modular arithmetic keeps intermediate values tiny, bounded by (m-1)², no matter how astronomically large a^n truly is.`,
        `This single technique makes modern cryptography practical. RSA encryption uses exponents that are 2048 bits long. The naive "multiply a into the result n times" approach would need roughly 2^2048 multiplications — more operations than there are atoms in the observable universe. Binary exponentiation needs only ~4000. That difference is why your HTTPS handshake completes in milliseconds instead of never.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `Start by converting the exponent to binary. For example, 45 in binary is 101101. Now process each bit from left to right. At every step, square the result. If the current bit is 1, also multiply by the base (and take modulo to stay small). The key insight: if you have computed a^k, then a^(2k) is just (a^k)^2, which you get by squaring. This is the square-and-multiply pattern.`,
        `As you walk through each bit, you maintain an invariant: after processing the first k bits, your result equals the base raised to the power formed by those k bits, all taken modulo m. Because you reduce modulo m after every single operation, intermediate values never exceed m^2, which keeps everything numerically stable and fast. By the time you finish reading all bits, you have a^n mod m.`,
        `The algorithm generalizes beautifully to matrices. If you want the 100th Fibonacci number, you can represent the Fibonacci recurrence as matrix multiplication: multiply a fixed 2×2 matrix by itself n times. Use binary exponentiation on matrices — same algorithm, matrices instead of numbers — and you compute it in O(log n) matrix multiplies instead of O(n). That gives you Fibonacci(n) in O(log n) time, exponentially faster than memoization.`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `Time complexity: O(log n) multiplications and modular reductions, where n is the exponent. In the worst case (when the exponent is all 1-bits in binary), you do roughly log(n) squarings plus log(n) multiplications, for ~2·log(n) operations total. Compare this to the naive approach: a^n requires n-1 multiplications, which is exponential in the bit-length of n. For RSA with 2048-bit exponents, naive costs ~2^2048 operations; binary exponentiation costs ~4000. The logarithmic complexity makes cryptography feasible.`,
        `Space complexity: O(log n) if you store the binary representation of the exponent, or O(1) if you generate bits on the fly. Matrix exponentiation adds O(k²) space for a k×k matrix, but the time remains O(log n) multiplies of k×k matrices, which is still exponentially better than naive iteration.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `RSA encryption and decryption both rely entirely on modular exponentiation. When you connect to a website over HTTPS, the TLS handshake includes an RSA step where both client and server compute a^n mod m with n being 2048 bits. Without binary exponentiation, this step would be computationally infeasible. The same applies to Diffie–Hellman key exchange, which also uses modular exponentiation to agree on a shared secret.`,
        `Fast Fourier transforms and many cryptographic primitives (elliptic-curve operations, hash-based signatures) all reduce to exponentiation at their core. In practice, cryptographic libraries use even further optimizations — Montgomery multiplication for faster modular reduction, Chinese Remainder Theorem to parallelize RSA — but they all sit on top of binary exponentiation. This is the foundation stone.`,
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        `Mistake: thinking you need to compute the entire exponent before starting. You don't — binary exponentiation processes one bit at a time and works left-to-right. Mistake: forgetting to take modulo after every operation. If you postpone the modulo until the end, intermediate results will overflow. In practice, keep every intermediate number below m² by taking modulo after every multiply and every square. Mistake: assuming the algorithm only works for numbers. The exact same code works for matrices, group elements, or any structure with an associative multiplication operator.`,
        `Misconception: that the speed comes from the modulo operation itself. It doesn't — the speed comes from needing far fewer operations because you read the exponent in binary. The modulo is just arithmetic hygiene to keep numbers bounded. Misconception: that this is only for cryptography. Binary exponentiation is a general-purpose technique for any "compute a^n" problem, whether the numbers are modular, floating-point, matrices, or even polynomial rings.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `To deepen your understanding: explore Recursion to see how expressing exponentiation as a recursive algorithm helps intuition. Learn Memoization (Dynamic Programming) to speed up naive Fibonacci computation. Study Big-O Growth Rates to internalize why log(n) versus n is such a dramatic difference at scale. Matrix exponentiation combines all of these: you recursively express it, memoize intermediate powers (though the algorithm naturally avoids redundant work), and apply Big-O analysis to see the logarithmic speedup emerge. For cryptographic context, Hash Table shows how modular arithmetic and hash functions are cousins; Binary Search uses similar bit-by-bit logic to divide and conquer.`,
      ],
    },
  ],
};

