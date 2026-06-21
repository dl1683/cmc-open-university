// Recursion, visualized as the call tree it really is: every call opens a
// frame, waits on its children, and returns a value to its parent.

import { callTreeState, parseIntegerInRange } from '../core/state.js';

export const topic = {
  id: 'recursion',
  title: 'Recursion',
  category: 'Concepts',
  summary: 'Watch a function call itself — frames open, hit base cases, and return upward.',
  controls: [
    { id: 'fn', label: 'Function', type: 'select', options: ['fibonacci', 'factorial'], defaultValue: 'fibonacci' },
    { id: 'n', label: 'n', type: 'number', defaultValue: '5' },
  ],
  run,
};

export function* run(input) {
  const fn = input.fn === 'factorial' ? 'factorial' : 'fibonacci';
  const n = parseIntegerInRange(input.n, { min: 1, max: fn === 'fibonacci' ? 7 : 8, label: 'n' });

  const frames = new Map(); // id -> {id, parentId, name, args, status, result}
  let counter = 0;
  let calls = 0;
  const snapshot = () => callTreeState([...frames.values()], { calls });
  const name = fn === 'fibonacci' ? 'fib' : 'fact';

  yield {
    state: callTreeState([]),
    highlight: {},
    explanation: fn === 'fibonacci'
      ? `fib(n) = fib(n - 1) + fib(n - 2), with fib(1) = fib(2) = 1. The rule is safe only because each call asks smaller questions that eventually hit a base case.`
      : `fact(n) = n * fact(n - 1), with fact(1) = 1. The rule is safe only because each call moves one step closer to the base case.`,
  };

  const trace = fn === 'fibonacci' ? traceFib : traceFact;
  const finalResult = yield* trace(n, null);

  yield {
    state: snapshot(),
    highlight: { returning: [rootId()] },
    explanation: fn === 'fibonacci'
      ? `Done: fib(${n}) = ${finalResult}, after ${calls} calls. The repeated subtrees show the tax: naive recursion recomputes answers it already learned. Memoization fixes that by remembering each fib(k) once.`
      : `Done: fact(${n}) = ${finalResult}, after ${calls} calls. This call tree is only a chain, so a loop can do the same work with less stack. Recursion earns its keep when the problem shape is naturally recursive.`,
  };

  function rootId() {
    for (const frame of frames.values()) if (frame.parentId === null) return frame.id;
    return frames.keys().next().value;
  }

  function openFrame(arg, parentId) {
    const id = `f${counter++}`;
    calls += 1;
    frames.set(id, { id, parentId, name, args: arg, status: 'active', result: null });
    return id;
  }

  function* close(id, result, why) {
    const frame = frames.get(id);
    frame.status = 'returned';
    frame.result = result;
    yield {
      state: snapshot(),
      highlight: { returning: [id] },
      explanation: why,
    };
  }

  function* traceFib(k, parentId) {
    const id = openFrame(k, parentId);
    if (k <= 2) {
      yield {
        state: snapshot(),
        highlight: { active: [id] },
        explanation: `fib(${k}) is a base case, so it returns 1 without opening more frames. Base cases are the floor that keeps recursion from falling forever.`,
      };
      yield* close(id, 1, `fib(${k}) returns 1 to its caller, giving the waiting parent one finished child result to combine.`);
      return 1;
    }

    yield {
      state: snapshot(),
      highlight: { active: [id] },
      explanation: `fib(${k}) is not a base case. It cannot answer until two smaller calls answer: fib(${k - 1}) and fib(${k - 2}). This frame waits on its children.`,
      invariant: 'A frame can only return after every call below it has returned.',
    };
    frames.get(id).status = 'waiting';

    const a = yield* traceFib(k - 1, id);
    frames.get(id).status = 'active';
    yield {
      state: snapshot(),
      highlight: { active: [id] },
      explanation: `fib(${k - 1}) returned ${a}. The parent frame keeps that value, but it still cannot return until fib(${k - 2}) answers.`,
    };
    frames.get(id).status = 'waiting';

    const b = yield* traceFib(k - 2, id);
    frames.get(id).status = 'active';
    yield* close(id, a + b, `Both child answers are in, so fib(${k}) = ${a} + ${b} = ${a + b}. The waiting frame has enough information to return upward to its own caller.`);
    return a + b;
  }

  function* traceFact(k, parentId) {
    const id = openFrame(k, parentId);
    if (k <= 1) {
      yield {
        state: snapshot(),
        highlight: { active: [id] },
        explanation: `fact(1) is the base case, so it returns 1 immediately. The descent stops here and the waiting frames can unwind.`,
      };
      yield* close(id, 1, 'fact(1) returns 1, and the chain of waiting frames starts collapsing upward.');
      return 1;
    }

    yield {
      state: snapshot(),
      highlight: { active: [id] },
      explanation: `fact(${k}) wants ${k} * fact(${k - 1}), but it cannot multiply until the smaller call returns. The frame waits with ${k} saved on the stack.`,
      invariant: 'A frame can only return after every call below it has returned.',
    };
    frames.get(id).status = 'waiting';

    const sub = yield* traceFact(k - 1, id);
    frames.get(id).status = 'active';
    yield* close(id, k * sub, `fact(${k - 1}) returned ${sub}, so fact(${k}) = ${k} * ${sub} = ${k * sub}. Work that was paused on the way down finishes on the way back up.`);
    return k * sub;
  }
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        `The animation builds a call tree. Each box is a stack frame: one invocation of the function with its own argument. An "active" frame is currently executing. A "waiting" frame has called a smaller version of itself and cannot finish until that child returns. A "returned" frame has its final value and has handed it back to its parent.`,
        `Watch the descent first. Each new call pushes a frame, and the tree grows downward until a base case stops the growth. Then watch the unwind: base cases return values upward, and each waiting parent uses those child results to compute its own answer and return in turn. The call stack at any moment is the path from the root down to the currently active frame -- every frame on that path is paused, holding local state, waiting for something below it to finish.`,
        `For factorial, the tree is a straight chain: each frame calls exactly one child. For Fibonacci, the tree branches: each non-base frame calls two children, and the same subproblem can appear in multiple branches. That repeated work is visible in the animation as duplicate subtrees.`,
        {type: `callout`, text: `Recursion is stack-managed delegation: each frame owns one smaller promise and waits until the base case starts the return path.`},
      
        {type: 'image', src: './assets/gifs/recursion.gif', alt: 'Animated walkthrough of the recursion visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        `Some problems contain smaller copies of themselves. A folder holds folders. A tree node owns child trees. A mathematical expression nests sub-expressions. When the structure of the data is self-referential, a function that handles one layer by delegating the rest to itself is the most direct translation of the problem into code.`,
        {type: `image`, src: `https://upload.wikimedia.org/wikipedia/commons/2/24/Tree_graph.svg`, alt: `Labeled tree graph with six vertices and five edges`, caption: `A tree makes recursion natural because each child subtree has the same shape as the parent problem. Source: https://commons.wikimedia.org/wiki/File:Tree_graph.svg.`},
        `Recursion as a programming tool dates to John McCarthy's 1960 paper "Recursive Functions of Symbolic Expressions and Their Computation by Machine," which introduced LISP. Before LISP, languages used GOTO and loops; McCarthy showed that recursive function calls could express tree-walking, list processing, and symbolic computation cleanly. The idea was borrowed from mathematical logic, where recursive definitions had been studied since the 1930s by Godel, Church, and Kleene.`,
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        `Iteration. For problems with a flat, sequential shape, a loop with explicit state is simple and efficient. Summing an array, counting occurrences, computing a factorial -- all can be done with a variable, a counter, and a for-loop. The programmer manages exactly which values are in scope and when they change.`,
        `Iteration works because the programmer is the bookkeeper. You declare the accumulator, update it each pass, and stop when the counter says to stop. No hidden frames, no stack growth, no function call overhead. For straight-line repeated work, this is the right tool.`,
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        `Tree traversal with iteration requires an explicit stack and careful bookkeeping. To visit every node in a binary tree iteratively, you push children onto a stack, pop the next node, process it, push its children, and loop. The code manages the frontier that the call stack would have managed for free. For an in-order traversal, the iterative version needs a state machine tracking whether a node has been descended-into or is ready to be visited.`,
        `The recursive version is three lines: visit left, process node, visit right. The code mirrors the definition of the tree. Recursive descent parsers read a grammar rule by calling a function for each sub-rule. Divide-and-conquer algorithms split, recurse, and merge. In each case, the recursive code maps directly onto the problem structure, while the iterative version requires the programmer to simulate what the call stack does automatically.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `Every recursive function has two parts. The base case handles the smallest input directly and returns without making another call. The recursive case takes a larger input, does a small amount of work, then calls the same function on a smaller input. Each call creates a new stack frame with its own copy of the arguments and local variables. The call stack stores the return address so the machine knows where to resume when the callee finishes.`,
        `Factorial: factorial(n) = n * factorial(n - 1), with factorial(0) = 1. The recursive case multiplies n by the result of the smaller call. The base case returns 1 when n reaches 0. Each call shrinks n by exactly one, so after n recursive calls the base case fires and the returns begin unwinding.`,
        `Each frame is an unfinished multiplication. factorial(5) cannot multiply until factorial(4) returns, which cannot multiply until factorial(3) returns, and so on. At the deepest point, six frames sit on the stack: factorial(5) through factorial(0). When factorial(0) returns 1, the chain collapses: factorial(1) computes 1 * 1 = 1, factorial(2) computes 2 * 1 = 2, factorial(3) computes 3 * 2 = 6, factorial(4) computes 4 * 6 = 24, factorial(5) computes 5 * 24 = 120.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `Correctness follows from structural induction, which is the recursive version of proof by induction. The argument has two parts. First, verify the base case directly: factorial(0) returns 1, which is correct because 0! = 1 by definition. Second, assume the function returns the correct answer for all inputs smaller than n (this is the inductive hypothesis), and show that the recursive case produces the correct answer for n.`,
        `For factorial: assume factorial(n - 1) correctly returns (n - 1)!. Then factorial(n) computes n * factorial(n - 1) = n * (n - 1)! = n!. The base case is correct. The recursive case preserves correctness assuming smaller inputs are correct. By strong induction, every input is correct.`,
        `The same argument applies to any well-founded recursion. For tree traversal: if the left and right subtrees are traversed correctly (inductive hypothesis), and the current node is visited in the right position relative to those traversals, the whole traversal is correct. The key requirement is that each recursive call operates on a strictly smaller input, guaranteeing that the chain of calls eventually reaches a base case and terminates.`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `Linear recursion like factorial makes n calls, each doing O(1) work. Total time: O(n). Stack space: O(n), because n frames sit on the call stack simultaneously. Doubling n doubles both the work and the stack depth.`,
        `Balanced divide-and-conquer recursion like merge sort splits the input in half at each level. The recursion tree has O(log n) levels, each doing O(n) total work across all calls at that level. Total time: O(n log n). Stack depth: O(log n), because only one branch is active at a time. The Master theorem formalizes this: for T(n) = a * T(n/b) + O(n^d), the time depends on whether the branching factor a outgrows, matches, or is outgrown by the per-level work n^d.`,
        `Tail call optimization (TCO) can eliminate stack growth for certain recursive patterns. When the recursive call is the very last operation in the function -- no pending work after it returns -- the current frame can be reused instead of stacking a new one. This converts O(n) stack space to O(1). The ES6 specification includes TCO, but only Safari implements it. V8 and SpiderMonkey do not, so tail recursion in JavaScript still blows the stack on deep inputs in most environments.`,
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        `Tree and graph traversal. File systems, DOM trees, syntax trees, and JSON documents are self-similar structures. A recursive traversal visits a node, then recurses on its children. The code directly mirrors the data. Depth-first search on a graph is naturally recursive (with a visited set to handle cycles).`,
        `Divide and conquer. Merge sort splits, recursively sorts halves, and merges. Quicksort partitions around a pivot, then recursively sorts the two sides. Binary search can be written recursively, though the iterative version uses less stack. In each case, the problem literally becomes smaller copies of itself.`,
        `Backtracking. N-queens places a queen on each row, recurses to place the rest, and undoes the choice if it leads to a conflict. Sudoku solvers, constraint-satisfaction problems, and some regex engines use the same choose-recurse-undo pattern. The call stack remembers every decision point, making backtracking free.`,
        `Parsing. Recursive descent parsers define one function per grammar rule. Each function recognizes its piece of syntax by calling functions for sub-rules. The call tree mirrors the parse tree.`,
        `Mathematical definitions. Fibonacci, Ackermann's function, the Euclidean algorithm, and combinatorial formulas like C(n, k) = C(n-1, k-1) + C(n-1, k) are defined recursively. The code is a direct transcription of the definition.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `Stack overflow on deep recursion. JavaScript engines typically allow a few thousand frames. Python's default limit is 1,000. A linear recursion processing a million-element list will crash, even though the equivalent loop runs fine. The fix is iteration or an explicit stack data structure.`,
        `Function call overhead. Each call pushes a frame, saves registers, and jumps. For tight inner loops on simple operations, this overhead is measurable. A recursive Fibonacci is slower than an iterative one even ignoring the exponential blowup, because of per-call costs.`,
        `Duplicate computation without memoization. Naive recursive Fibonacci computes fib(3) multiple times when computing fib(5). The call tree grows exponentially -- O(phi^n), where phi is about 1.618 -- because the same subproblems are solved over and over. Memoization stores each result once, collapsing the tree to O(n) calls. Without it, the "elegant" recursive definition is a performance trap.`,
        `Harder to debug. A deep call stack makes it difficult to inspect intermediate state. Unlike a loop where you can print the accumulator each iteration, recursive state is spread across many frames. Stack traces for deep recursion are long and repetitive.`,
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        `Trace factorial(5) through all six frames. The descent pushes frames. The unwind computes return values.`,
        `Push: factorial(5) calls factorial(4). factorial(4) calls factorial(3). factorial(3) calls factorial(2). factorial(2) calls factorial(1). factorial(1) calls factorial(0). At this point, six frames are on the stack: factorial(5) at the bottom, factorial(0) at the top. Each frame except the top is paused at a multiplication it cannot yet perform.`,
        `Base case: factorial(0) returns 1. No recursive call needed.`,
        `Unwind: factorial(1) receives 1, computes 1 * 1 = 1, returns 1. factorial(2) receives 1, computes 2 * 1 = 2, returns 2. factorial(3) receives 2, computes 3 * 2 = 6, returns 6. factorial(4) receives 6, computes 4 * 6 = 24, returns 24. factorial(5) receives 24, computes 5 * 24 = 120, returns 120.`,
        `The answer is 120. Six frames were created and destroyed. Maximum stack depth was six. Each frame held one number (its argument) and one pending multiplication. The total work was five multiplications -- the same as a for-loop from 1 to 5. The recursion added no extra computation, only stack overhead.`,
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        `John McCarthy, "Recursive Functions of Symbolic Expressions and Their Computation by Machine, Part I" (1960) -- introduced recursive function calls in LISP, making recursion a practical programming tool. Harold Abelson and Gerald Jay Sussman, "Structure and Interpretation of Computer Programs" (1996) -- the deepest treatment of recursive thinking in a programming context.`,
        `Prerequisite: Stack -- the call stack is a stack, and understanding LIFO order makes the push-and-unwind pattern concrete.`,
        `Caching repeated work: Memoization and Dynamic Programming -- what happens when the recursive call tree revisits the same subproblems.`,
        `Recursive algorithms in practice: Merge Sort (divide-and-conquer sorting), Quick Sort (partition-based divide-and-conquer), Tree Traversals (recursion's natural home), Graph DFS (recursive exploration with cycle detection), Backtracking and N-Queens (choose-recurse-undo).`,
        `When recursion is too deep: convert to an explicit Stack or Queue. When the problem has optimal substructure and overlapping subproblems, move to Dynamic Programming.`,
      ],
    },
  ],
};
