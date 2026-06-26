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
      heading: 'How to read the animation',
      paragraphs: [
        'In the signal-fanout view, the controller is the only node with authority to abort. The signal node is the shared observation point that fetch, streams, listeners, and custom work can watch.',
        'In the timeout-race view, read each row as one source of cancellation. The first source to abort fixes the composed signal state, so later sources cannot change the reason for that operation.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/5/5b/HTTP_logo.svg', alt:'HTTP protocol logo', caption:'Fetch requests, streams, and event listeners all accept AbortSignal â€” cancellation is woven into the web platform. Source: Wikimedia Commons, CC BY-SA 4.0'},
        'Modern web code starts work before the future is settled. A search request can become obsolete after the next keystroke, and a route loader can become useless after the user navigates away.',
        'Cancellation needs to cross API boundaries. Fetch, stream reads, event listeners, timers, and custom jobs all need the same answer: this unit of work should stop, and the reason is expected rather than a crash.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is a boolean flag such as cancelled = true. That works inside one loop when the same code owns the check, the work, and the cleanup.',
        'Another common approach is Promise.race with a timeout. It can reject the wrapper promise, but the underlying fetch, stream, listener, or worker may keep running unless the API receives a real cancellation signal.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'A boolean flag is too local. It cannot be passed to fetch as a platform contract, cannot remove an event listener automatically, and cannot preserve a standard abort reason.',
        'The wall is ownership. The code that decides work is obsolete is often not the same code that owns the network request, stream reader, event listener, or UI state update.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        {type:'callout', text:'AbortController separates authority from observation. The controller can abort; the signal can only report. Passing a signal to downstream code lets it respond to cancellation without giving it the power to cancel sibling work.'},
        'AbortController splits authority from observation. The controller can fire cancellation; the signal can only expose the one-shot aborted state and reason.',
        'That makes cancellation a small shared data structure. It carries a boolean state, a reason, and notification hooks that independent APIs can interpret in their own cleanup code.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/3/3d/Process_states.svg', alt:'State transition diagram', caption:'AbortSignal is a one-shot state machine: not-aborted transitions to aborted exactly once, and never returns. Source: Wikimedia Commons, CC BY-SA 3.0'},
        {type:'callout', text:'AbortSignal.any() composes multiple cancellation sources â€” a user cancel button, a route change, and a timeout can all share the same downstream fetch. The first source to abort wins.'},
        'Create a controller at the boundary of a user intent, route, component, or request attempt. Pass controller.signal downward to every operation that should stop with that scope.',
        'Calling abort(reason) flips the signal once and notifies listeners. AbortSignal.timeout(ms) creates a timer-backed signal, and AbortSignal.any([...signals]) creates one signal whose first aborted input wins.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The invariant is shared observation of one irreversible transition. Every consumer that receives the signal can see the same aborted state and reason, even if it checks after the event already fired.',
        'That is why reusing an aborted signal is wrong for new work. A signal represents a lifetime, and an ended lifetime should make later operations reject or stop immediately.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The runtime cost is usually one controller, one signal, listener registration, and rejection handling. If 20 requests each register 3 abort listeners, the cost is small but the cleanup discipline matters.',
        'The main cost is API design. A function that accepts a signal must check early, attach cleanup with once semantics where possible, reject with the abort reason, and remove listeners when work completes normally.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'AbortController fits fetch requests, stream pipelines, search-as-you-type, route loaders, Web Locks waits, drag sessions, and event listeners tied to a component lifetime. These workflows all have a visible owner and a clear point where work becomes stale.',
        'It also fits retry and timeout wrappers when cancellation must reach the underlying operation. The wrapper should not merely stop waiting; it should ask the old work to clean itself up.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        {type:'callout', text:'AbortController is cooperative, not preemptive. CPU-heavy JavaScript will not stop unless the code explicitly checks signal.aborted or calls throwIfAborted(). The platform does not kill computation â€” it requests cancellation.'},
        'AbortController does not preempt CPU work. A long synchronous loop has to check signal.aborted or yield to code that can observe the signal.',
        'It also does not roll back server-side effects. Aborting a fetch may stop the browser from waiting, but the server may already have received and processed the request.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A search box sends a request after each keystroke. At 0 ms it starts query "ca"; at 80 ms the user types "cat", so the code aborts the old controller and starts a fresh one.',
        'If the old fetch would have returned at 220 ms and the new fetch returns at 260 ms, cancellation prevents the older result from winning the UI race. The catch block treats AbortError as expected, while a network error still surfaces.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: MDN AbortController, MDN AbortSignal, MDN AbortSignal.timeout, and the DOM Standard AbortController interface. Study these before building cancellation into a public API.',
        'Then study Promise microtasks, Web Streams backpressure queues, Web Locks, Fetch request flow, browser message channels, optimistic UI mutation logs, and idempotency keys. Cancellation is strongest when paired with cleanup, stale-result guards, and retry-safe effects.',
      ],
    },
  ],
};