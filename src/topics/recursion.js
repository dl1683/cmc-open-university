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
