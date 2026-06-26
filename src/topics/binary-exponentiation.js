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
    explanation: `Compute ${base}^${exp} mod ${mod}. The naive way multiplies ${base} into a running product ${exp - 1} times. Fine here — but RSA does this with exponents over 600 DIGITS long, where "one multiply per unit of exponent" would outlast the universe. The escape: look at the exponent in BINARY. ${exp} = ${bits.join('')}â‚‚ — just ${bits.length} bits.`,
  };

  yield {
    state: bitView(),
    highlight: { active: bits.map((b, i) => (b === '1' ? `i${i}` : null)).filter(Boolean) },
    explanation: `Why binary helps: squaring DOUBLES an exponent (x^k Â· x^k = x^2k). So reading the exponent's bits left to right: each bit means "square what you have" — and each 1-bit additionally means "multiply in one ${base}". ${bits.length} bits â†’ at most ${bits.length} squarings + ${bits.filter((b) => b === '1').length} extra multiplies, instead of ${exp - 1}.`,
    invariant: 'After processing the first k bits, the result equals base raised to the number those k bits spell — mod m.',
  };

  let result = 1;
  let squarings = 0;
  let multiplies = 0;
  for (let i = 0; i < bits.length; i += 1) {
    const before = result;
    result = (result * result) % mod;
    squarings += 1;
    let text = `Bit ${i + 1} ('${bits[i]}'): SQUARE — ${before}² = ${before * before}${before * before >= mod ? ` â‰¡ ${result} (mod ${mod})` : ''}.`;
    if (bits[i] === '1') {
      const beforeMul = result;
      result = (result * base) % mod;
      multiplies += 1;
      text += ` The bit is 1, so also MULTIPLY by ${base}: ${beforeMul} Ã— ${base} = ${beforeMul * base}${beforeMul * base >= mod ? ` â‰¡ ${result} (mod ${mod})` : ''}.`;
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
      heading: 'How to read the animation',
      paragraphs: [
        'The animation displays the exponent\'s binary digits as an array. At each step, one bit is consumed left to right. The "active" marker sits on the bit currently being processed. "Visited" markers trail behind on bits already consumed. When every bit is processed, all cells turn to "found" and the final answer appears.',
        'Two operations happen per bit. First, the running result is squared (this happens for every bit). Second, if the bit is 1, the result is multiplied by the base. The explanation text below each frame shows the arithmetic: the square, the optional multiply, and the modular reduction that keeps values small.',
        'Watch the "exponent so far" counter. It tracks which power the running result currently represents. After bit k, it equals the number spelled by the first k binary digits. That counter is the algorithm\'s invariant made visible: result always equals base raised to "exponent so far," reduced modulo m.',
        {type: "callout", text: "Binary exponentiation treats each exponent bit as one square and each 1-bit as one multiply, turning exponent value into exponent length."},
        {type: 'image', src: './assets/gifs/binary-exponentiation.gif', alt: 'Animated walkthrough of the binary exponentiation visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Exponentiation shows up everywhere computation touches security, algebra, or counting. RSA encryption requires computing a^d mod n where d is a 2048-bit number. Diffie-Hellman key exchange raises a generator to a secret exponent modulo a prime. Matrix exponentiation computes the n-th term of a linear recurrence (like Fibonacci) without iterating through every preceding term. In each case, the exponent can be astronomically large.',
        'Multiplying a by itself n times costs n-1 multiplications. When n fits in a 64-bit register, that is already up to 2^64 - 1 operations, far beyond what any machine can finish. When n has hundreds of digits, the situation is hopeless. Binary exponentiation reduces the cost to roughly 2 * log2(n) multiplications. For a 2048-bit RSA exponent, that is around 4,000 operations instead of a number with 600+ digits.',
        'The reduction is possible because squaring doubles an exponent in a single operation. Instead of climbing from a^1 to a^n one step at a time, the algorithm leaps through powers of two. The exponent\'s binary representation tells it exactly which leaps to make and where to insert an extra factor of a.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The naive algorithm initializes result = 1 and loops n times, multiplying by a each iteration. In pseudocode: for i = 1 to n, result = result * a. If working modulo m, reduce after each multiply: result = (result * a) % m. This is correct, easy to verify, and matches the mathematical definition of a^n.',
        'The cost is exactly n-1 multiplications. For a^10, that is 9 multiplications, which is fine. For a^1000, it is 999, still manageable. But for a^(2^2048), the loop count is a number with over 600 decimal digits. No computer that will ever exist can execute that many iterations. The algorithm is linear in the exponent value, and the exponent value can be exponentially larger than its bit length.',
        'There is a second problem even for moderate n: without modular reduction at each step, the intermediate product a * a * ... * a grows without bound. If a = 7 and n = 100, the result has 85 digits. For n = 10000, it has 8451 digits. Each multiplication gets slower as the numbers grow, making the true cost super-linear. Reducing modulo m after every multiply caps the intermediate value at m-1 and keeps each multiplication cheap.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is the gap between exponent value and exponent length. The number 45 has value 45 but length 6 in binary (101101). The number 2^2048 has a value with 617 decimal digits but length 2049 in binary. Any algorithm whose loop count depends on the exponent\'s value hits a wall at large exponents. Any algorithm whose loop count depends on the exponent\'s bit length does not.',
        'This wall appears concretely in cryptography. RSA-2048 uses a 2048-bit modulus and exponents of similar size. A linear-time exponentiation would need roughly 2^2048 multiplications. At 10^18 multiplications per second, that takes about 10^598 seconds. The universe is about 4 * 10^17 seconds old. Binary exponentiation needs about 4096 multiplications for the same task and finishes in microseconds.',
        'The wall also appears in competitive programming. Problems that require computing a^n mod m where n can be 10^18 are standard. A linear loop times out. Binary exponentiation is the expected solution, and recognizing the wall is the first step toward recognizing the algorithm.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Squaring a number doubles its exponent: (a^k)^2 = a^(2k). This single fact converts the problem from "multiply a into the product n times" to "read the exponent\'s binary digits and square for each one." Every positive integer n has a unique binary representation, and that representation has floor(log2(n)) + 1 bits. So any exponent can be reached in that many squarings plus at most that many extra multiplications by a.',
        'Concretely, consider the exponent n in binary as the string b_1 b_2 ... b_L where b_1 = 1 (the leading bit). Start with result = 1. For each bit position i from 1 to L: square result (this appends a 0 to the binary exponent built so far), then if b_i = 1 multiply result by a (this flips the trailing 0 to a 1). After all L bits, the binary exponent built up equals n, so result = a^n.',
        'The key reframing: instead of asking "how do I multiply a into a product n times," ask "how do I build the number n one binary digit at a time and keep the corresponding power updated?" Building a binary number digit by digit is O(log n) steps. Keeping the power updated is one square (and sometimes one multiply) per step. The total cost is O(log n) multiplications.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The left-to-right algorithm (shown in the animation) processes the exponent\'s most significant bit first. Initialize result = 1. For each bit b in the binary representation of n, from left to right: (1) square result, (2) if b = 1, multiply result by a. If computing modulo m, take the remainder after each operation. After all bits are consumed, result holds a^n mod m.',
        'There is an equivalent right-to-left version. Initialize result = 1 and power = a. For each bit of n from least significant to most: if the bit is 1, multiply result by power. Then square power regardless of the bit value. Finally shift n right by one (or advance to the next bit). The left-to-right form builds up the exponent as a prefix. The right-to-left form decomposes the exponent as a sum of distinct powers of two: n = 2^(i1) + 2^(i2) + ..., so a^n = a^(2^i1) * a^(2^i2) * ... where each a^(2^k) is obtained by repeated squaring of the previous one.',
        'Both versions perform the same number of squarings (equal to the bit length of n minus one, or exactly the bit length if the left-to-right version squares on the leading bit too). Both perform the same number of extra multiplications (equal to the number of 1-bits in n, minus one for the right-to-left version since the leading bit is handled by initialization). The difference is implementation convenience, not asymptotic cost.',
        'When a modulus m is used, every intermediate value stays below m^2 (the largest value before reduction is the product of two numbers each less than m). This bounds the size of every multiplication operand, making each individual multiply cheap and preventing intermediate blowup regardless of how large n is.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument rests on one invariant. For the left-to-right version: after processing the first k bits of n\'s binary representation, result equals a^(prefix_k) mod m, where prefix_k is the integer represented by those k bits. Before any bits are processed, result = 1 = a^0, and the prefix of zero bits represents 0. The invariant holds at the start.',
        'Suppose the invariant holds after k bits, so result = a^(prefix_k). When the (k+1)-th bit b arrives, squaring gives result^2 = a^(2 * prefix_k). If b = 0, the new prefix is 2 * prefix_k (appending 0 to a binary number doubles it), so the invariant holds. If b = 1, multiplying by a gives a^(2 * prefix_k + 1), and the new prefix is 2 * prefix_k + 1 (appending 1 doubles and adds one). The invariant holds again.',
        'After all L bits, prefix_L = n, so result = a^n mod m. The modular reductions inserted at each step do not break the argument because (x * y) mod m = ((x mod m) * (y mod m)) mod m. Reducing intermediate results modulo m preserves the final residue class. This is the homomorphism property of modular arithmetic applied to multiplication.',
        'The algorithm also generalizes beyond integers. It works for any associative binary operation with an identity element (a monoid). Replace "multiply" with the operation and "1" with the identity. Matrix multiplication, polynomial multiplication modulo another polynomial, permutation composition, and point addition on elliptic curves all qualify. The correctness proof is identical because it only uses associativity.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Let b = floor(log2(n)) + 1 be the number of bits in n. The algorithm performs exactly b squarings and at most b multiplications by the base, for a total of at most 2b arithmetic operations. Since b = O(log n), the arithmetic operation count is O(log n). The naive algorithm performs n-1 operations, which is O(n). The speedup is exponential in the bit length of the exponent.',
        'Each arithmetic operation has its own cost. For modular arithmetic with a w-bit modulus, one multiplication and reduction takes O(w^2) time with schoolbook multiplication, or O(w * log(w) * log(log(w))) with FFT-based methods. The total cost for modular exponentiation is O(b * w^2) or better. For RSA-2048, b is about 2048 and w is 2048, giving roughly 2048 * 2048^2 = 2^33 bit operations. That is comfortably within reach.',
        'Space usage is O(1) beyond the input: only the running result and the current base power need to be stored (plus the exponent bits, which can be streamed one at a time from the integer representation). If the bit string is pre-extracted into an array (as in the animation), that adds O(log n) space.',
        'There are refinements that reduce the constant factor. Windowed exponentiation precomputes a^1, a^2, ..., a^(2^k - 1) and processes k bits at a time, trading O(2^k) precomputation space for fewer multiplications. For k = 4, a 2048-bit exponent needs about 2048/4 + 15 = 527 multiplications instead of roughly 3072. Production libraries like OpenSSL use sliding window or fixed-window methods with k = 5 or 6.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'RSA encryption and decryption are modular exponentiations. To decrypt a ciphertext c with private key d modulo n, compute c^d mod n. The security of RSA depends on the difficulty of factoring n, but the feasibility of RSA depends on binary exponentiation making c^d mod n computable in milliseconds despite d having thousands of bits.',
        {type: `image`, src: `https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/DiffieHellman.png/500px-DiffieHellman.png`, alt: `Diffie-Hellman key exchange with modular exponentiation steps`, caption: `Diffie-Hellman shows modular exponentiation as the workhorse behind shared secret agreement. Source: Wikimedia Commons.`},
        'Diffie-Hellman key exchange uses the same primitive. Alice picks secret a, Bob picks secret b. Both compute g^a mod p and g^b mod p (public values), then each raises the other\'s public value to their own secret: (g^b)^a = (g^a)^b = g^(ab) mod p. This shared secret is computed without either party revealing their private exponent. Every modular exponentiation in this protocol uses binary exponentiation internally.',
        'Matrix exponentiation is the generalization to non-scalar operands. The Fibonacci recurrence F(n) = F(n-1) + F(n-2) can be written as a 2x2 matrix equation: [F(n+1), F(n)] = M^n * [F(1), F(0)] where M = [[1,1],[1,0]]. Computing M^n by binary exponentiation (squaring = matrix multiply, which is O(1) for a fixed-size matrix) gives F(n) in O(log n) matrix multiplications. This technique extends to any constant-coefficient linear recurrence and to counting paths of length n in a graph via adjacency matrix powers.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Side-channel attacks are the primary failure in cryptographic contexts. The straightforward if-bit-is-1-then-multiply branch leaks the secret exponent through timing differences, power consumption patterns, or cache access traces. An attacker measuring how long each loop iteration takes can reconstruct which bits are 0 and which are 1. Production implementations must run in constant time regardless of bit values, using techniques like Montgomery multiplication, constant-time conditional moves, and exponent blinding.',
        'The algorithm requires an associative operation. If the operation is not associative, reordering the multiplications changes the result, and the square-and-multiply decomposition produces the wrong answer. This rules out naive application to operations like floating-point arithmetic (which is only approximately associative) or non-associative algebras like octonions. For floating-point powers, the standard library\'s pow() function uses different techniques.',
        'Binary exponentiation also does not help when the exponent is not an integer or when the operation lacks a useful identity element. Computing a^3.7 is not a matter of squaring and multiplying; it requires logarithms or series expansions. And if the "identity" is expensive to verify or ambiguous, the initialization step can introduce subtle bugs.',
        'Finally, for very small exponents, binary exponentiation can be slower than a hand-optimized addition chain. Computing a^15 by binary exponentiation takes 3 squarings and 3 multiplies (6 operations). An addition chain can do it in 5: a^2 = a*a, a^3 = a^2*a, a^6 = a^3*a^3, a^12 = a^6*a^6, a^15 = a^12*a^3. Finding the shortest addition chain is NP-hard in general, but for small fixed exponents, lookup tables or compiler intrinsics can beat the generic algorithm.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Compute 7^45 mod 100. First, convert 45 to binary: 45 = 32 + 8 + 4 + 1 = 101101 in base 2. The bit string has 6 bits, so the algorithm performs 6 iterations. Initialize result = 1.',
        'Bit 1 (value 1): Square result: 1^2 = 1. Bit is 1, so multiply by 7: 1 * 7 = 7. Result = 7. Exponent built so far: 1 (binary: 1). Check: 7^1 mod 100 = 7. Correct.',
        'Bit 2 (value 0): Square result: 7^2 = 49. Bit is 0, no multiply. Result = 49. Exponent so far: 2 (binary: 10). Check: 7^2 = 49 mod 100 = 49. Correct.',
        'Bit 3 (value 1): Square result: 49^2 = 2401, mod 100 = 1. Bit is 1, multiply by 7: 1 * 7 = 7. Result = 7. Exponent so far: 5 (binary: 101). Check: 7^5 = 16807, mod 100 = 7. Correct.',
        'Bit 4 (value 1): Square result: 7^2 = 49. Bit is 1, multiply by 7: 49 * 7 = 343, mod 100 = 43. Result = 43. Exponent so far: 11 (binary: 1011). Check: 7^11 mod 100. Since 7^5 mod 100 = 7, 7^10 mod 100 = 49, 7^11 mod 100 = 49*7 = 343 mod 100 = 43. Correct.',
        'Bit 5 (value 0): Square result: 43^2 = 1849, mod 100 = 49. Bit is 0, no multiply. Result = 49. Exponent so far: 22 (binary: 10110). Check: 7^22 = (7^11)^2 mod 100 = 43^2 mod 100 = 1849 mod 100 = 49. Correct.',
        'Bit 6 (value 1): Square result: 49^2 = 2401, mod 100 = 1. Bit is 1, multiply by 7: 1 * 7 = 7. Result = 7. Exponent so far: 45 (binary: 101101). Final answer: 7^45 mod 100 = 7. Total operations: 6 squarings + 4 multiplies = 10. The naive approach would have used 44 multiplications. At this scale the savings are modest (10 vs 44), but for a 2048-bit exponent the ratio is roughly 4000 vs 10^616.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'The algorithm appears in Knuth\'s The Art of Computer Programming, Volume 2, Section 4.6.3 ("Evaluation of Powers"), where it is traced back to a method known in India by 200 BCE. The right-to-left version is sometimes called the "Russian peasant" method because of its similarity to Russian peasant multiplication. Schneier\'s Applied Cryptography covers the cryptographic application in detail, including side-channel countermeasures.',
        'For the modular arithmetic foundation, study how (a * b) mod m = ((a mod m) * (b mod m)) mod m, which is why intermediate reductions preserve the final answer. For the generalization to matrices, see the Fibonacci matrix method and adjacency matrix powers for graph path counting. Montgomery multiplication (1985) is the standard reference for efficient modular reduction inside exponentiation loops.',
        'Study Recursion for the divide-and-conquer structure (binary exponentiation is a tail-recursive halving of the exponent). Study Big-O Growth Rates to internalize the gap between O(n) and O(log n). Study Binary Search for another algorithm that spends one bit of information to discard half the remaining work. Then compare three ways to compute Fibonacci(n): naive recursion in O(2^n), dynamic programming in O(n), and matrix exponentiation in O(log n) using the same square-and-multiply engine described here.',
      ],
    },
  ],
};
