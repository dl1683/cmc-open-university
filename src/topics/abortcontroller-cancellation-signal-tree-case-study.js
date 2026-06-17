// AbortController and AbortSignal: one-shot cancellation, fanout graphs,
// timeout/any composition, fetch/body cancellation, and listener cleanup.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'abortcontroller-cancellation-signal-tree-case-study',
  title: 'AbortController Cancellation Graph',
  category: 'Systems',
  summary: 'How AbortController and AbortSignal model one-shot cancellation, fan out to fetch/listeners/streams, compose timeouts, and carry abort reasons.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['signal fanout', 'timeout race'], defaultValue: 'signal fanout' },
  ],
  run,
};

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

function signalGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'ctrl', label: 'ctrl', x: 0.8, y: 4.0, note: notes.ctrl ?? 'abort()' },
      { id: 'signal', label: 'signal', x: 2.5, y: 4.0, note: notes.signal ?? 'EventTarget' },
      { id: 'fetch', label: 'fetch', x: 4.5, y: 2.2, note: notes.fetch ?? 'request' },
      { id: 'stream', label: 'stream', x: 4.5, y: 4.0, note: notes.stream ?? 'body' },
      { id: 'listener', label: 'listener', x: 4.5, y: 5.8, note: notes.listener ?? 'cleanup' },
      { id: 'reason', label: 'reason', x: 6.7, y: 4.0, note: notes.reason ?? 'AbortError' },
      { id: 'catch', label: 'catch', x: 8.5, y: 4.0, note: notes.catch ?? 'handle' },
    ],
    edges: [
      { id: 'e-ctrl-signal', from: 'ctrl', to: 'signal', weight: '' },
      { id: 'e-signal-fetch', from: 'signal', to: 'fetch', weight: '' },
      { id: 'e-signal-stream', from: 'signal', to: 'stream', weight: '' },
      { id: 'e-signal-listener', from: 'signal', to: 'listener', weight: '' },
      { id: 'e-signal-reason', from: 'signal', to: 'reason', weight: '' },
      { id: 'e-reason-catch', from: 'reason', to: 'catch', weight: '' },
    ],
  }, { title });
}

function* signalFanout() {
  yield {
    state: signalGraph('One AbortSignal can fan out to many operations'),
    highlight: { active: ['ctrl', 'signal', 'fetch', 'stream', 'listener', 'e-ctrl-signal', 'e-signal-fetch', 'e-signal-stream', 'e-signal-listener'] },
    explanation: 'AbortController creates a signal. APIs that accept that signal listen for one cancellation event and stop their own work when it fires.',
    invariant: 'A signal is one-shot: after abort, it stays aborted.',
  };

  yield {
    state: labelMatrix(
      'Signal state',
      [
        { id: 'fresh', label: 'fresh' },
        { id: 'aborted', label: 'aborted' },
        { id: 'reuse', label: 'reuse' },
        { id: 'reason', label: 'reason' },
      ],
      [
        { id: 'flag', label: 'flag' },
        { id: 'effect', label: 'effect' },
      ],
      [
        ['false', 'can start'],
        ['true', 'stop now'],
        ['true', 'reject now'],
        ['value', 'explain'],
      ],
    ),
    highlight: { active: ['aborted:flag', 'reuse:effect'], found: ['reason:effect'] },
    explanation: 'An aborted signal remains aborted. Passing it to a new fetch rejects immediately, so create a fresh controller per operation or per cancellation scope.',
  };

  yield {
    state: signalGraph('Abort can cancel fetch and later body reads', { fetch: 'reject', stream: 'AbortError', reason: 'abort reason' }),
    highlight: { active: ['ctrl', 'signal', 'fetch', 'stream', 'reason', 'catch', 'e-signal-fetch', 'e-signal-stream', 'e-signal-reason', 'e-reason-catch'] },
    explanation: 'MDN notes that aborting after fetch fulfills but before the response body is read can still make the body read reject with AbortError.',
  };

  yield {
    state: labelMatrix(
      'Fanout uses',
      [
        { id: 'fetch', label: 'fetch' },
        { id: 'event', label: 'event listen' },
        { id: 'stream', label: 'stream' },
        { id: 'work', label: 'worker job' },
      ],
      [
        { id: 'abortDoes', label: 'abort does' },
        { id: 'why', label: 'why' },
      ],
      [
        ['reject', 'stop I/O'],
        ['remove', 'cleanup'],
        ['cancel', 'stop flow'],
        ['message', 'coop stop'],
      ],
    ),
    highlight: { found: ['fetch:abortDoes', 'event:abortDoes', 'stream:abortDoes'], compare: ['work:abortDoes'] },
    explanation: 'Abort is cooperative. Platform APIs define what cancellation means. Your own worker job must check the signal or receive a message and stop cleanly.',
  };

  yield {
    state: signalGraph('Cancellation scopes should be explicit', { ctrl: 'page scope', listener: 'UI cleanup', catch: 'ignore if abort' }),
    highlight: { active: ['ctrl', 'signal', 'listener', 'catch'], found: ['reason'] },
    explanation: 'Good code distinguishes user cancellation from network failure. Catch AbortError or TimeoutError deliberately, and clean up listeners in the same scope that started the work.',
  };
}

function* timeoutRace() {
  yield {
    state: signalGraph('AbortSignal.timeout creates a timer-backed signal', { ctrl: 'timeout', signal: 'auto abort', reason: 'TimeoutError' }),
    highlight: { active: ['ctrl', 'signal', 'reason', 'e-ctrl-signal', 'e-signal-reason'], found: ['catch'] },
    explanation: 'AbortSignal.timeout(ms) returns a signal that aborts automatically after active time. Its reason is a TimeoutError DOMException on timeout.',
    invariant: 'Timeout is cancellation policy encoded as a signal.',
  };

  yield {
    state: labelMatrix(
      'Composed signals',
      [
        { id: 'user', label: 'user stop' },
        { id: 'timeout', label: 'timeout' },
        { id: 'route', label: 'route leave' },
        { id: 'any', label: 'any()' },
      ],
      [
        { id: 'source', label: 'source' },
        { id: 'result', label: 'result' },
      ],
      [
        ['button', 'AbortError'],
        ['timer', 'TimeoutErr'],
        ['router', 'AbortError'],
        ['first wins', 'one signal'],
      ],
    ),
    highlight: { found: ['any:result'], compare: ['timeout:result'] },
    explanation: 'AbortSignal.any combines multiple cancellation sources. The first signal to abort wins the composed signal.',
  };

  yield {
    state: signalGraph('Timeout plus user cancel is a race of reasons', { ctrl: 'any()', signal: 'first wins', reason: 'reason', catch: 'branch' }),
    highlight: { active: ['ctrl', 'signal', 'reason', 'catch', 'e-ctrl-signal', 'e-signal-reason', 'e-reason-catch'] },
    explanation: 'Branching on the abort reason lets UI say "timed out" for a timeout and stay quiet for a user-initiated navigation cancel.',
  };

  yield {
    state: labelMatrix(
      'Cancellation mistakes',
      [
        { id: 'reuse', label: 'reuse sig' },
        { id: 'swallow', label: 'swallow all' },
        { id: 'late', label: 'late check' },
        { id: 'leak', label: 'leak listen' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['instant fail', 'new ctrl'],
        ['hide errors', 'branch name'],
        ['wasted work', 'check early'],
        ['retained', 'signal opt'],
      ],
    ),
    highlight: { removed: ['reuse:symptom', 'swallow:symptom'], found: ['reuse:fix', 'leak:fix'] },
    explanation: 'The most common bugs are reusing an aborted signal, treating every failure as cancellation, checking too late, or leaving listeners around after a cancelled operation.',
  };

  yield {
    state: labelMatrix(
      'Where it links',
      [
        { id: 'streams', label: 'streams' },
        { id: 'locks', label: 'locks' },
        { id: 'fetch', label: 'fetch' },
        { id: 'ui', label: 'UI' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'dataStruct', label: 'structure' },
      ],
      [
        ['cancel pipe', 'queue'],
        ['drop wait', 'lock queue'],
        ['abort I/O', 'promise'],
        ['scope work', 'tree'],
      ],
    ),
    highlight: { found: ['streams:role', 'locks:role', 'ui:dataStruct'] },
    explanation: 'AbortController is a small primitive that composes with bigger structures: stream queues, lock queues, fetch promises, route trees, and component lifecycles.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'signal fanout') yield* signalFanout();
  else if (view === 'timeout race') yield* timeoutRace();
  else throw new InputError('Pick an AbortController view.');
}

export const article = {
  sections: [
    {
      heading: 'The real problem',
      paragraphs: [
        'Modern web code starts work speculatively. A search request begins before the user finishes typing. A route loader starts before the user decides to navigate again. A stream reader, lock waiter, and event listener can all belong to the same screen, then become useless the moment that screen disappears.',
        'The hard part is not setting a local flag. The hard part is telling several independently implemented APIs that the same unit of work is over, then making error handling distinguish expected cancellation from a network outage, parser bug, or application failure.',
      ],
    },
    {
      heading: 'Why a boolean is too small',
      paragraphs: [
        'A local variable such as cancelled = true works only while one loop owns all the code. It cannot be passed to fetch as a standard contract, cannot automatically unregister an event listener, and cannot tell a stream pipeline why downstream demand stopped.',
        'Timeout wrappers have the same problem when every caller builds its own version. They race promises, but the underlying operation may keep running. That leaves late rejections, retained listeners, stale UI updates, and wasted network or CPU work.',
      ],
    },
    {
      heading: 'The core model',
      paragraphs: [
        'AbortController gives one owner the right to end a cancellation scope. The controller exposes an AbortSignal, and every operation that joins the scope receives that same signal. Calling abort(reason) flips the signal once, stores a reason, and notifies observers.',
        'The signal is monotonic. It starts not aborted, becomes aborted once, and never returns to fresh. That one-shot rule is what makes late checks safe: a function can inspect signal.aborted or call signal.throwIfAborted() without worrying that the cancellation event already passed.',
      ],
    },
    {
      heading: 'How the fanout works',
      paragraphs: [
        'The controller does not know how to cancel every possible operation. It only announces cancellation. Fetch can reject an unsettled request, response body reads can fail with the abort reason, addEventListener can remove a listener when a signal is used as an option, and custom code can stop at its own checkpoints.',
        'That division is deliberate. AbortSignal is a small shared data structure: a flag, a reason, and a set of abort algorithms or event listeners. Each consumer defines its own cleanup semantics while sharing the same cancellation edge.',
      ],
    },
    {
      heading: 'Worked example: search',
      paragraphs: [
        'A search box should not let an old query win the race against a newer query. On each keystroke, create a fresh controller for the new request and abort the previous controller. The old fetch rejects, the old stream reader stops, and the old listeners disappear with the cancelled scope.',
        'The UI still needs to handle the rejection. A user-initiated abort should usually be quiet; a timeout might show a retry message; a real network error should surface differently. Treating all rejected promises as cancellation hides production bugs.',
      ],
    },
    {
      heading: 'Timeouts and composed signals',
      paragraphs: [
        'AbortSignal.timeout(ms) creates a timer-backed signal whose reason is a TimeoutError when the timeout fires. The timeout is based on active time in browser environments, so suspended documents and back-forward cache pauses matter.',
        'AbortSignal.any([...signals]) creates one signal from several cancellation sources. A route change, a user cancel button, and a timeout can share the same downstream fetch. The first source to abort wins, and the composed signal carries the winning reason where the platform exposes it.',
      ],
    },
    {
      heading: 'Why the design is safe',
      paragraphs: [
        'The important invariant is shared observation of one irreversible transition. Every consumer sees the same aborted state and reason. There is no second abort that changes the outcome, and no reset that makes a cancelled operation valid again.',
        'This is why reusing a signal is a bug for most operations. If a signal is already aborted, new work should fail or stop immediately. Reuse is not a performance optimization; it leaks the lifetime of an old operation into a new one.',
        'The design also separates authority from observation. The controller can abort; the signal can only report and notify. Passing a signal to lower-level code lets that code respond to cancellation without giving it the power to cancel sibling work unexpectedly.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'The runtime cost is usually small: one controller, one signal, a few listeners, and promise rejection paths. The engineering cost is ownership. Code has to decide which scope owns which work and where cleanup belongs.',
        'Abort also changes API contracts. A function that accepts a signal must check early, register cleanup, reject with the signal reason when appropriate, and remove any listener it added. Adding cancellation halfway through an API can expose forgotten teardown paths.',
      ],
    },
    {
      heading: 'Design checklist',
      paragraphs: [
        'Create controllers at cancellation boundaries: one user intent, one route load, one request attempt, one background job, or one component lifetime. Pass the signal downward; do not pass the controller unless the child is supposed to own cancellation. That keeps the authority to abort in the same place that created the work.',
        'Check the signal before starting expensive work and at every meaningful async boundary. For custom functions, accept `{ signal }`, call `signal.throwIfAborted()` when available, register abort cleanup with `{ once: true }`, and remove any listener when the operation settles normally. A cancellation API is only as good as its cleanup path.',
      ],
    },
    {
      heading: 'Testing cancellation',
      paragraphs: [
        'Test the three timing cases: signal already aborted before the function starts, signal aborts while the function is waiting, and signal never aborts. The first should fail immediately, the second should clean up pending work, and the third should complete without retaining abort listeners.',
        'Also test reason handling. A timeout should produce timeout behavior, a user navigation cancel should be quiet, and a real network failure should still be visible. The point of AbortController is not merely to stop work; it is to make expected cancellation distinguishable from failure.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'AbortController is cooperative, not preemptive. CPU-heavy JavaScript will continue unless it calls throwIfAborted(), checks signal.aborted, yields to the event loop, or receives a separate worker message. The platform does not kill arbitrary computation for you.',
        'The common bugs are predictable: reusing an aborted signal, swallowing all errors as cancellation, checking only after expensive work is complete, forgetting listener cleanup, and losing the abort reason when wrapping errors.',
      ],
    },
    {
      heading: 'Where to use it',
      paragraphs: [
        'Use AbortController at I/O and lifecycle boundaries: route loaders, search-as-you-type, request retries, stream pipelines, Web Locks waits, drag sessions, event listeners tied to a component, and background tasks tied to a visible screen.',
        'Do not use it as a general thread-kill primitive, a retry policy, or a substitute for idempotent state updates. Cancellation prevents old work from continuing; it does not prove that old work never partially happened.',
        'For server communication, pair cancellation with idempotency and stale-result guards. Aborting a browser fetch may stop the client from waiting, but the server may already have received the request. The UI still needs to ignore late results and the backend still needs safe retry semantics.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'The signal fanout view shows one controller ending a whole cancellation scope. Follow the active edges from ctrl to signal and then to fetch, stream, listener, and reason. Those edges are not data flow; they are ownership of a stop request.',
        'The timeout race view shows cancellation policy becoming a signal. The matrix rows list the sources and mistakes to watch: user stop, timeout, route leave, reuse, late checks, swallowed errors, and retained listeners.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: MDN AbortSignal at https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal, MDN AbortSignal.timeout at https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static, MDN AbortController at https://developer.mozilla.org/en-US/docs/Web/API/AbortController, and DOM Standard AbortController at https://dom.spec.whatwg.org/#interface-abortcontroller. Study Promise Microtask Queue, Web Streams Backpressure Queues, Web Locks API Lock Manager, Fetch/CDN Request Flow, Browser Message Channels & Broadcast Coordination, Optimistic UI Mutation Log, Form Validation Dependency Graph, and Backpressure & Flow Control next.',
      ],
    },
  ],
};
