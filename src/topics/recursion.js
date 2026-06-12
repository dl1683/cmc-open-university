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
      ? `fib(n) = fib(n−1) + fib(n−2), with fib(1) = fib(2) = 1. A recursive function is allowed to call itself — as long as the calls keep getting SMALLER and eventually hit a base case. Let's trace fib(${n}).`
      : `fact(n) = n × fact(n−1), with fact(1) = 1. A recursive function calls itself on a smaller problem until a base case stops the descent. Let's trace fact(${n}).`,
  };

  const trace = fn === 'fibonacci' ? traceFib : traceFact;
  const finalResult = yield* trace(n, null);

  yield {
    state: snapshot(),
    highlight: { returning: [rootId()] },
    explanation: fn === 'fibonacci'
      ? `Done: fib(${n}) = ${finalResult}, after ${calls} calls. See how the tree repeats itself — fib(${Math.max(1, n - 2)}) was computed multiple times from scratch! That waste grows exponentially, and fixing it (remember each answer the first time) is called MEMOIZATION — the idea behind dynamic programming.`
      : `Done: fact(${n}) = ${finalResult}, after ${calls} calls. Factorial recursion is a straight chain — each call has exactly one child — which is why a simple loop can replace it. Recursion earns its keep when calls branch (see fibonacci, or tree traversals).`,
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
        explanation: `fib(${k}) is a BASE CASE — it returns 1 immediately, no further calls. Base cases are what stop the recursion from descending forever.`,
      };
      yield* close(id, 1, `fib(${k}) returns 1 to its caller.`);
      return 1;
    }

    yield {
      state: snapshot(),
      highlight: { active: [id] },
      explanation: `fib(${k}) is not a base case. It cannot answer yet — it must first ask two smaller questions: fib(${k - 1}) and fib(${k - 2}). This frame now WAITS.`,
      invariant: 'A frame can only return after every call below it has returned.',
    };
    frames.get(id).status = 'waiting';

    const a = yield* traceFib(k - 1, id);
    frames.get(id).status = 'active';
    yield {
      state: snapshot(),
      highlight: { active: [id] },
      explanation: `fib(${k - 1}) came back with ${a}. fib(${k}) still needs its second answer: fib(${k - 2}).`,
    };
    frames.get(id).status = 'waiting';

    const b = yield* traceFib(k - 2, id);
    frames.get(id).status = 'active';
    yield* close(id, a + b, `Both answers are in: fib(${k}) = ${a} + ${b} = ${a + b}. Now THIS frame can finally return.`);
    return a + b;
  }

  function* traceFact(k, parentId) {
    const id = openFrame(k, parentId);
    if (k <= 1) {
      yield {
        state: snapshot(),
        highlight: { active: [id] },
        explanation: `fact(1) is the BASE CASE — it returns 1 immediately. The descent stops here.`,
      };
      yield* close(id, 1, 'fact(1) returns 1, and the chain of waiting frames starts collapsing upward.');
      return 1;
    }

    yield {
      state: snapshot(),
      highlight: { active: [id] },
      explanation: `fact(${k}) wants to compute ${k} × fact(${k - 1}) — but it cannot multiply until fact(${k - 1}) answers. The frame WAITS while the smaller call runs.`,
      invariant: 'A frame can only return after every call below it has returned.',
    };
    frames.get(id).status = 'waiting';

    const sub = yield* traceFact(k - 1, id);
    frames.get(id).status = 'active';
    yield* close(id, k * sub, `fact(${k - 1}) returned ${sub}, so fact(${k}) = ${k} × ${sub} = ${k * sub}. The multiplication that was "on hold" finally happens — on the way back UP.`);
    return k * sub;
  }
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        `Recursion is when a function calls itself to solve a smaller version of the same problem. Instead of writing a loop, you break the problem into a smaller piece, solve that piece the same way, and keep going until you hit a simple case you can answer directly — the base case. Each function call opens a frame in memory, waits for all the calls it made to finish, then returns its answer to whoever called it.`,
        `The two examples here show the two personalities of recursion. Fibonacci branches at every step — fib(5) calls both fib(4) and fib(3), and each of those calls two more — creating an exponential tree of work. Factorial is a straight chain — fact(5) calls fact(4), which calls fact(3), and so on, each call nesting one deeper, then all collapsing back up. Neither would convince anyone to avoid loops, but both show why recursion matters: tree traversals, graph exploration, divide-and-conquer algorithms, and backtracking search all branch naturally this way.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `When a function calls itself, the JavaScript engine does exactly what it does for any call: it opens a new frame (a pocket of memory holding the function's local variables and arguments), pushes it onto the call stack, and runs the function from the top. If that function calls itself again, another frame opens and goes on top. The key rule: a frame cannot return its answer until every call it made has already returned.`,
        `Watch the animation closely. When you call fib(5), it opens a frame and immediately tries to compute fib(4). But it cannot finish fib(5) without both fib(4) AND fib(3), so the fib(5) frame goes into a WAITING state. Only when fib(4) returns does the fib(5) frame wake up and say "okay, now I need fib(3)." And only when both have returned can fib(5) add them together and return its own answer. The base cases — fib(1) and fib(2) both returning 1 — are the floor; without them, the descent never ends and you get a stack overflow.`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `The cost of recursion depends entirely on the shape of the tree. Factorial is O(n) time and O(n) space — n calls, each touching the stack once, each doing one multiplication. Fibonacci is brutal: O(2^n) time because the tree doubles at every level, and it wastes enormous energy computing the same sub-problems over and over — fib(3) is calculated independently dozens of times just to compute fib(5). The stack depth is O(n) in both cases, which matters: if n is 10,000 and your stack is only 1,000 frames deep, you overflow and crash.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `Recursion is the natural way to traverse trees (every DOM node in the browser has children, which have children) and graphs (file systems, org charts, social networks). It is essential for divide-and-conquer algorithms like mergesort and quicksort — you split the array in half, recursively sort each half, then merge them back. Backtracking search in puzzles and constraint satisfaction (chess engines, Sudoku solvers, maze search) relies on recursion to try a path, and if it fails, back out and try another. The most reliable way to implement many recursive-by-nature problems — parsing, tree building, graph traversal — is to write the recursive solution, not twist it into a loop.`,
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        `The most common pitfall is forgetting or misdefining the base case. Without it, or with a base case that never triggers, the function calls itself forever, and your stack overflows. The second pitfall is writing expensive recursive calls that recompute the same results. Fibonacci is famous for this; memoization (recording each answer the first time and reusing it) transforms Fibonacci from exponential to linear.`,
        `A misconception: recursion is always slower than loops. False — recursion and loops are equivalent in power; what changes is clarity and overhead. A simple loop will beat a recursive factorial because the loop has no frame-opening overhead. But a recursive tree traversal is often cleaner and just as fast as loop-based equivalents. The real cost comes from bad design — exponential re-computation — not from recursion itself.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Read Memoization (Dynamic Programming) to see how to rescue expensive recursive problems like Fibonacci. Then study Big-O Growth Rates to understand why exponential time is catastrophic, and polynomial or linear time is livable. Divide-and-conquer shows you recursive algorithms that actually earn their keep. When you traverse actual structures, learn Linked List, Tree, and Graph — all taught recursively at their core.`,
      ],
    },
  ],
};

