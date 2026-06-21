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
        "Read the animation as the execution trace for Binary Exponentiation. Square-and-multiply along the exponent bits — huge powers in O(log n) steps instead of n..",
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
        {type: "callout", text: "Binary exponentiation treats each exponent bit as one square and each 1-bit as one multiply, turning exponent value into exponent length."},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        `Binary exponentiation exists because repeated multiplication is the wrong unit of work for large powers. Computing a^10 by multiplying by a ten times is harmless. Computing a^n that way when n has hundreds or thousands of bits is impossible. The exponent may describe an astronomically large count, but the exponent itself has only O(log n) bits.`,
        `The algorithm uses those bits directly. Squaring doubles an exponent. Multiplying by the base adds one. Those two moves are enough to spell any exponent in binary, so the power can be built in a number of steps proportional to the number of bits rather than the numeric value of the exponent.`,
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        `The obvious approach keeps a running product and multiplies by the base n times. That is easy to write and easy to trust for tiny n. It also matches the definition of exponentiation, so it is often the first implementation students produce.`,
        `It fails in two ways. The loop is linear in n, so a 600-digit exponent would require more multiplications than any computer can finish. The intermediate value also explodes in size. If a modulus is involved, waiting until the end to reduce is unsafe in fixed-width arithmetic and wasteful even with big integers.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `The core insight is that exponentiation by squaring turns multiplication count into bit count. If you know a^k, then squaring gives a^(2k). If the next binary digit says the exponent should be odd, multiply once by a to get a^(2k + 1).`,
        `In the left-to-right version shown here, start with result = 1. For each exponent bit, square result. If the bit is 1, multiply by the base. When working modulo m, reduce after every square and multiply. The final residue is unchanged because modular reduction respects multiplication.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `The invariant is the reason the short loop is trustworthy. After processing the first k bits of the exponent, result equals base raised to the number represented by those k bits, modulo m if a modulus is being used. The algorithm is not guessing; it is maintaining this statement one bit at a time.`,
        `When the next bit arrives, squaring changes a^x into a^(2x), which is exactly what appending a binary digit does to the number represented so far. If the appended bit is 1, multiplying by the base changes a^(2x) into a^(2x + 1). If the bit is 0, the square alone is enough.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `The bit array is the exponent written in the form the algorithm actually uses. Each highlighted bit corresponds to one square. A highlighted 1-bit also corresponds to one multiply by the base. The displayed "exponent so far" value is the invariant becoming visible after each step.`,
        `The modulus in the visual is not decoration. It proves that huge powers can be computed with small stored numbers. After each square and multiply, only the residue modulo m is kept. The true power may be enormous, but the algorithm only needs the residue class that determines the final answer.`,
      ],
    },
    {
      heading: 'Right-to-left form',
      paragraphs: [
        `There is another common version that consumes exponent bits from right to left. It keeps two variables: result and power. If the current low bit is 1, multiply result by power. Then square power and shift the exponent right by one bit. This version is often convenient when the exponent is already an integer.`,
        `The two versions have the same mathematical foundation. The left-to-right form builds the exponent prefix. The right-to-left form decomposes n as a sum of powers of two. Both work because multiplication is associative, and both reduce the number of multiplications from linear in n to logarithmic in n.`,
      ],
    },
    {
      heading: 'Worked shape',
      paragraphs: [
        `Take 45 as the exponent. In binary, 45 is 101101. The left-to-right algorithm starts at 0 as the exponent represented so far. Reading 1 makes it 1. Reading 0 makes it 2. Reading 1 makes it 5. Reading 1 makes it 11. Reading 0 makes it 22. Reading 1 makes it 45.`,
        `The running result follows the same exponent values without ever performing forty-five plain multiplications. Each new bit doubles the exponent already represented, and each 1-bit adds one more base factor. In a modular computation, the displayed value may look unrelated to the true power, but the invariant says it is the correct residue for that exponent prefix.`,
        `This is the same mental model as parsing a binary number. Appending a bit to x gives 2x or 2x + 1. Binary exponentiation applies that parser to exponents and keeps the matching power updated at the same time.`,
        `Once that connection is clear, the algorithm feels less like a trick and more like ordinary binary notation turned into code.`,
      ],
    },
    {
      heading: 'Why it works (2)',
      paragraphs: [
        `Binary exponentiation is not limited to ordinary integers. It works anywhere there is an associative operation with an identity element. That includes modular multiplication, matrices under multiplication, permutations under composition, function composition in some settings, and monoids in algebraic programming.`,
        `This is why the same idea reappears under different names. Matrix exponentiation computes Fibonacci numbers and Markov transitions quickly. Permutation powers answer repeated shuffling questions. Elliptic-curve scalar multiplication uses the related double-and-add pattern, where doubling a point plays the role of squaring a power.`,
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        `If n has b bits, the left-to-right method performs b squarings and at most b extra multiplications. That is O(log n) arithmetic operations. Space is O(1) if the exponent bits are streamed, or O(log n) if the bit string is materialized as an array.`,
        `The arithmetic operation itself may be expensive. Big integers, modular reduction, and matrix multiplication all have their own costs. Binary exponentiation does not make multiplication free; it reduces how many times multiplication is called. That distinction matters when comparing plain number powers, modular powers, and matrix powers.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `Modular exponentiation powers RSA decryption and signatures, classic Diffie-Hellman key exchange, primality testing routines, and many number-theory protocols. The whole point is that exponents can be very large while the loop stays tied to their bit length.`,
        {type: `image`, src: `https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/DiffieHellman.png/500px-DiffieHellman.png`, alt: `Diffie-Hellman key exchange with modular exponentiation steps`, caption: `Diffie-Hellman shows modular exponentiation as the workhorse behind shared secret agreement. Source: Wikimedia Commons.`},
        `Outside cryptography, it is a standard tool for fast recurrence computation, graph walk counts through adjacency-matrix powers, Markov Chains & Steady States, PageRank-style transition powers, and repeated transformation composition. The same pattern also teaches why binary representation is an algorithmic tool, not just a storage format.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `The speedup does not come from the modulus. It comes from reading the exponent in binary. The modulus keeps values bounded and prevents overflow, but a non-modular power can still use exponentiation by squaring. Mixing those ideas up leads to poor explanations and sometimes poor implementations.`,
        `Security code has an extra failure mode: secret exponent bits must not control observable timing, memory access, or branching. A straightforward square-if-bit-then-multiply loop is educational, not automatically safe for private keys. Production libraries use constant-time methods, blinding, windowing, Montgomery arithmetic, and careful side-channel review.`,
        `There is also an algebraic requirement. The repeated operation must be associative, and the algorithm needs a correct identity value for exponent zero. If either assumption is false or badly encoded, the code may be fast while computing the wrong object.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Study Recursion for the divide-and-conquer shape, Big-O Growth Rates for the logarithmic payoff, and Modular Arithmetic for the residue rule that keeps intermediate values small. Binary Search builds the same habit of spending one bit of information to remove a large amount of work.`,
        `Then compare Fibonacci methods: naive Recursion is exponential, Memoization (Dynamic Programming) is linear, and matrix exponentiation is logarithmic. For matrix-heavy applications, continue to Markov Chains & Steady States, PageRank, Eigenvalues & Eigenvectors, and SVD & Low-Rank Approximation.`,
      ],
    },
      {
      heading: 'The wall',
      paragraphs: [
        "Every topic in this pattern has a hard boundary where a tempting shortcut fails; define that boundary first.",
        "State the exact invariant that must hold, show one operation sequence that can break it, and explain what changes after a failure and why.",
        "If you can reproduce this wall in one example, the rest of the page is motivated.",
      ],
    },

    {
      heading: 'Worked example',
      paragraphs: [
        "Trace one representative example end-to-end so readers can watch state evolve across every step.",
        "Keep the walkthrough concise and precise: at each step, write current state, action taken, and resulting output.",
        "The goal is prediction, not a one-off demonstration.",
      ],
    },
    {
      heading: 'Learning map',
      paragraphs: [
        'Before this topic, check your prerequisites and map what is assumed, what is computed, and where this mechanism first appears in real systems.',
        'After this topic, follow each unlock topic and test whether you can explain why this mechanism unlocks it.',
        'Use the frame order to prove one invariant per frame and one cost consequence per major operation.',
      ],
    },

    {
      heading: 'Frame-by-frame checkpoints',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Pause on each state change and name exactly what data moved, which references changed, and why the move is legal.',
            'State the invariant that must remain true before the next frame starts.',
            'Track what changed in size, order, ownership, or topology for the operation you are watching.',
            'Translate the active frame into a one-line explanation as if teaching a teammate.',
          ],
        },
      ],
    },

    {
      heading: 'Micro checks',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Can you state one operation-level invariant in one sentence?',
            'Can you derive the time cost from the frame sequence without referencing external formulas?',
            'Can you name one hidden edge case where the naive implementation fails?',
            'Can you transfer this mechanism to one system from a different domain?',
          ],
        },
      ],
    },

    {
      heading: 'Try this now',
      paragraphs: [
        'Build one counterexample input by hand and predict every animation frame before running it; compare your prediction to the trace.',
        'Use this topic as a checkpoint: if you can explain why Binary Exponentiation moves from input to output in the animation and where it fails, you are ready for the next topic.',
      ],
    },

      {
        heading: 'Sources and study next',
        paragraphs: [
          'Read one primary source, one implementation source, and one production case where this idea appears.',
          'If they disagree on a detail, prefer the source with the clearest constraint and define the simplification for this animation.',
          'Then choose three study topics: one prerequisite, one extension, and one case study for your next session.',
        ],
      },
],
};

