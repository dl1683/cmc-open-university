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
      heading: 'What it is',
      paragraphs: [
        'AbortController is the browser cancellation primitive. A controller owns one AbortSignal. APIs receive the signal, listen for abort, and stop their own work when the signal fires.',
        'The data structure is a one-shot fanout graph: one signal can notify fetch, streams, event listeners, and application tasks. After it aborts, the signal stays aborted and carries a reason.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Create a controller, pass controller.signal to an API, and call controller.abort(reason) when the operation should stop. For fetch, aborting rejects with AbortError. If response body reading is still pending, that body read can reject too.',
        'AbortSignal.timeout creates a timer-backed signal. AbortSignal.any combines multiple signals so the first cancellation source wins. These are useful for race policies such as user cancel, navigation change, and timeout.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Consider a search box. Each keystroke starts a fetch, a stream decoder, and a highlight worker job. The old controller aborts when a new query starts. The fetch rejects, the stream stops, the worker receives a cancel message, and event listeners registered with the signal are removed. Only the latest query is allowed to update the UI.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not reuse an aborted signal for a new operation. Do not swallow all errors as cancellation. Do not assume custom work stops automatically; custom code must observe the signal or receive a cancellation message. Do not forget that timeout support may need compatibility checks on older browsers.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: MDN AbortSignal at https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal, MDN AbortSignal.timeout at https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static, MDN AbortController at https://developer.mozilla.org/en-US/docs/Web/API/AbortController, and DOM Standard AbortController at https://dom.spec.whatwg.org/#interface-abortcontroller. Study Promise Microtask Queue, Web Streams Backpressure Queues, Web Locks API Lock Manager, Fetch/CDN Request Flow, Browser Message Channels & Broadcast Coordination, Optimistic UI Mutation Log, Form Validation Dependency Graph, and Backpressure & Flow Control next.',
      ],
    },
  ],
};
