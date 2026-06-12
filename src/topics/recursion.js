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
      heading: `What it is`,
      paragraphs: [
        `Recursion is a way to solve a problem by letting a function call itself on a smaller version of the same problem. Every recursive solution needs two pieces: a base case that stops, and a recursive case that moves closer to that base case. Without the base case, the calls never bottom out. Without progress toward it, the function loops through the call stack until the program crashes.`,
        `The demo's two examples show different shapes. Factorial is a chain: fact(5) waits for fact(4), which waits for fact(3), down to fact(1), then results multiply on the way back. Fibonacci is a branching tree: fib(5) calls fib(4) and fib(3), and those calls branch again. The code is short, but the shape of the calls determines whether the algorithm is elegant or wildly expensive.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `A JavaScript function call creates a frame containing arguments, local variables, and a return location. The engine pushes that frame onto the call stack. When the function calls itself, another frame goes on top. A frame cannot finish until the calls above it finish. This is exactly the Last-In, First-Out behavior taught by Stack: the newest unfinished call returns first.`,
        `Think of each call as an unfinished question. fact(4) asks "what is 4 times fact(3)?" and pauses. fact(3) asks the smaller version, and so on. When fact(1) returns 1, the answers unwind upward. For branching problems, many frames can be waiting for multiple child answers. Tree Traversals use this naturally: visit a node, recursively visit the left subtree, then recursively visit the right subtree.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `The cost depends on the call tree. Factorial does n calls, so it is O(n) time and O(n) stack space. Naive Fibonacci is exponential - often described as O(2^n), more tightly O(phi^n) - because it recomputes the same values again and again. Memoization (Dynamic Programming) stores each Fibonacci result once, turning the time into O(n). Big-O Growth Rates is essential here because recursive code can hide enormous repeated work behind a clean one-line formula.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Divide-and-conquer algorithms use recursion because the problem literally splits into smaller problems. Merge Sort sorts the left half, sorts the right half, then merges. Quick Sort partitions around a pivot, then sorts the left and right partitions. Binary Search can be written recursively too, although the iterative version uses less stack space.`,
        `Tree-shaped data is the strongest use case. File systems, DOM trees, syntax trees, and JSON documents all contain smaller structures of the same kind. Graph algorithms need more care because graphs can have cycles; Graph BFS uses a FIFO queue explicitly, while recursive depth-first search must track a visited set or it may loop forever. Backtracking solvers for Sudoku, mazes, and constraint problems also fit the pattern: choose, recurse, undo, try the next choice.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `The first pitfall is a missing or unreachable base case. The second is stack depth. JavaScript engines have finite call stacks, and you should not rely on tail-call optimization being available across browsers and Node runtimes. A loop may be safer for a million-step linear process even when the recursive version is prettier.`,
        `The third pitfall is confusing clarity with efficiency. A recursive definition can be mathematically beautiful and computationally terrible, as naive Fibonacci shows. On the other hand, recursion is not automatically slow; for balanced trees, parsing, and divide-and-conquer algorithms, it can express the real structure of the problem with little overhead. The design question is not "recursive or iterative?" but "what call tree am I creating?"`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study Stack to understand the call stack directly. Then read Memoization (Dynamic Programming) to see repeated subproblems collapse from exponential to linear work. Big-O Growth Rates helps you judge the call tree. Merge Sort, Quick Sort, Tree Traversals, and Graph BFS show where recursion competes with or complements explicit data structures.`,
      ],
    },
  ],
};
