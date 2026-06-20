// SharedArrayBuffer and Atomics: shared browser memory, typed-array views,
// ring-buffer coordination, wait/notify, and isolation requirements.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'sharedarraybuffer-atomics-wait-notify-case-study',
  title: 'SharedArrayBuffer & Atomics',
  category: 'Systems',
  summary: 'A browser shared-memory primer: SharedArrayBuffer, typed-array views, cross-origin isolation, Atomics operations, wait/notify, and ring-buffer backpressure.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['shared memory', 'wait notify'], defaultValue: 'shared memory' },
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

function sharedGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'main', label: 'main', x: 0.8, y: 2.7, note: notes.main ?? 'UI' },
      { id: 'worker', label: 'worker', x: 0.8, y: 5.3, note: notes.worker ?? 'compute' },
      { id: 'sab', label: 'SAB', x: 3.0, y: 4.0, note: notes.sab ?? 'same bytes' },
      { id: 'i32', label: 'Int32', x: 4.9, y: 2.7, note: notes.i32 ?? 'control' },
      { id: 'u8', label: 'Uint8', x: 4.9, y: 5.3, note: notes.u8 ?? 'payload' },
      { id: 'atomics', label: 'Atomics', x: 7.0, y: 4.0, note: notes.atomics ?? 'sync' },
      { id: 'rules', label: 'headers', x: 8.9, y: 4.0, note: notes.rules ?? 'isolation' },
    ],
    edges: [
      { id: 'e-main-sab', from: 'main', to: 'sab', weight: '' },
      { id: 'e-worker-sab', from: 'worker', to: 'sab', weight: '' },
      { id: 'e-sab-i32', from: 'sab', to: 'i32', weight: '' },
      { id: 'e-sab-u8', from: 'sab', to: 'u8', weight: '' },
      { id: 'e-i32-atomics', from: 'i32', to: 'atomics', weight: '' },
      { id: 'e-atomics-rules', from: 'atomics', to: 'rules', weight: '' },
    ],
  }, { title });
}

function ringGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'prod', label: 'prod', x: 0.7, y: 4.0, note: notes.prod ?? 'writes' },
      { id: 'head', label: 'head', x: 2.5, y: 2.3, note: notes.head ?? 'read idx' },
      { id: 'tail', label: 'tail', x: 2.5, y: 5.7, note: notes.tail ?? 'write idx' },
      { id: 'ring', label: 'ring', x: 4.7, y: 4.0, note: notes.ring ?? 'slots' },
      { id: 'wait', label: 'wait', x: 6.7, y: 5.7, note: notes.wait ?? 'empty?' },
      { id: 'notify', label: 'notify', x: 6.7, y: 2.3, note: notes.notify ?? 'wake' },
      { id: 'cons', label: 'cons', x: 8.8, y: 4.0, note: notes.cons ?? 'reads' },
    ],
    edges: [
      { id: 'e-prod-tail', from: 'prod', to: 'tail', weight: '' },
      { id: 'e-tail-ring', from: 'tail', to: 'ring', weight: '' },
      { id: 'e-ring-head', from: 'ring', to: 'head', weight: '' },
      { id: 'e-head-cons', from: 'head', to: 'cons', weight: '' },
      { id: 'e-ring-notify', from: 'ring', to: 'notify', weight: '' },
      { id: 'e-notify-cons', from: 'notify', to: 'cons', weight: '' },
      { id: 'e-cons-wait', from: 'cons', to: 'wait', weight: '' },
      { id: 'e-wait-head', from: 'wait', to: 'head', weight: '' },
    ],
  }, { title });
}

function* sharedMemoryView() {
  yield {
    state: sharedGraph('SharedArrayBuffer gives two agents the same bytes'),
    highlight: { active: ['main', 'worker', 'sab', 'e-main-sab', 'e-worker-sab'], found: ['i32', 'u8'] },
    explanation: 'ArrayBuffer transfer moves ownership. SharedArrayBuffer keeps a shared data block visible to multiple agents, such as the page and a worker. Each side creates typed-array views over the same bytes.',
    invariant: 'Shared bytes need Atomics discipline.',
  };

  yield {
    state: labelMatrix(
      'Security gate',
      [
        { id: 'secure', label: 'HTTPS' },
        { id: 'coop', label: 'COOP' },
        { id: 'coep', label: 'COEP' },
        { id: 'check', label: 'check' },
      ],
      [
        { id: 'job', label: 'job' },
        { id: 'failure', label: 'failure' },
      ],
      [
        ['safe ctx', 'API hidden'],
        ['isolate top', 'not iso'],
        ['isolate deps', 'blocked deps'],
        ['xOriginIso', 'fallback'],
      ],
    ),
    highlight: { found: ['coop:job', 'coep:job', 'check:job'], removed: ['secure:failure'] },
    explanation: 'Browsers gate SharedArrayBuffer sharing behind secure context and cross-origin isolation because shared memory and high-resolution timing affect side-channel risk. Robust code checks crossOriginIsolated and falls back when needed.',
  };

  yield {
    state: sharedGraph('Typed-array views split control words from payload bytes', { i32: 'head/tail', u8: 'records', atomics: 'ordered ops' }),
    highlight: { active: ['sab', 'i32', 'u8', 'atomics', 'e-sab-i32', 'e-sab-u8', 'e-i32-atomics'], compare: ['main', 'worker'] },
    explanation: 'The same SharedArrayBuffer can have an Int32Array view for synchronization fields and a Uint8Array view for raw payload. Atomics operate on typed-array elements so both sides agree on control state.',
  };

  yield {
    state: labelMatrix(
      'Atomics toolbox',
      [
        { id: 'load', label: 'load' },
        { id: 'store', label: 'store' },
        { id: 'add', label: 'add' },
        { id: 'cas', label: 'CAS' },
        { id: 'wait', label: 'wait' },
      ],
      [
        { id: 'does', label: 'does' },
        { id: 'use', label: 'use' },
      ],
      [
        ['read order', 'flags'],
        ['write order', 'publish'],
        ['atomic inc', 'counters'],
        ['if equals', 'locks'],
        ['sleep', 'blocking'],
      ],
    ),
    highlight: { found: ['load:does', 'store:does', 'cas:use'], active: ['wait:does'] },
    explanation: 'Ordinary reads and writes can race. Atomics provide ordered operations on shared typed arrays. compareExchange is the usual lock primitive; wait and notify turn a spin loop into a sleep-and-wake protocol.',
  };

  yield {
    state: labelMatrix(
      'When to use shared memory',
      [
        { id: 'stream', label: 'stream' },
        { id: 'wasm', label: 'Wasm' },
        { id: 'small', label: 'small msg' },
        { id: 'ui', label: 'UI state' },
      ],
      [
        { id: 'choice', label: 'choice' },
        { id: 'reason', label: 'reason' },
      ],
      [
        ['SAB ring', 'many chunks'],
        ['SAB memory', 'threads'],
        ['postMsg', 'simple'],
        ['main only', 'DOM rules'],
      ],
    ),
    highlight: { found: ['stream:choice', 'wasm:choice'], compare: ['small:choice', 'ui:choice'] },
    explanation: 'Shared memory is for high-throughput streams, WebAssembly threads, audio/video/ML pipelines, and worker pools where copy or message overhead dominates. Ordinary UI state should stay in message-passing land.',
  };
}

function* waitNotifyView() {
  yield {
    state: ringGraph('A shared ring buffer needs head and tail control words'),
    highlight: { active: ['prod', 'tail', 'ring', 'head', 'cons', 'e-prod-tail', 'e-tail-ring', 'e-ring-head', 'e-head-cons'] },
    explanation: 'A producer-consumer ring buffer uses payload slots plus control words. The producer advances tail after writing. The consumer advances head after reading. Both words live in a shared Int32Array.',
    invariant: 'The data slots are not enough; the protocol lives in the metadata.',
  };

  yield {
    state: ringGraph('The consumer sleeps when the ring is empty', { head: 'h == t', wait: 'sleep', cons: 'blocked' }),
    highlight: { active: ['cons', 'wait', 'head', 'e-cons-wait', 'e-wait-head'], compare: ['prod'] },
    explanation: 'Atomics.wait(view, index, expected) checks that the shared location still has the expected value. If it does, the worker sleeps instead of burning CPU in a spin loop.',
  };

  yield {
    state: ringGraph('The producer publishes data and wakes a waiter', { tail: 'store t+1', notify: 'wake 1', cons: 'ready' }),
    highlight: { active: ['prod', 'tail', 'ring', 'notify', 'cons', 'e-prod-tail', 'e-tail-ring', 'e-ring-notify', 'e-notify-cons'], found: ['cons'] },
    explanation: 'The producer writes payload bytes, stores the new tail with Atomics.store, then calls Atomics.notify on the control word. A waiting worker wakes and rechecks the shared state.',
  };

  yield {
    state: labelMatrix(
      'wait/notify contract',
      [
        { id: 'view', label: 'view type' },
        { id: 'expected', label: 'expected' },
        { id: 'returns', label: 'returns' },
        { id: 'main', label: 'main thrd' },
      ],
      [
        { id: 'rule', label: 'rule' },
        { id: 'reason', label: 'reason' },
      ],
      [
        ['Int32/Big64', 'shared only'],
        ['must match', 'avoid lost'],
        ['ok/not/tmo', 'branch'],
        ['no block', 'use async'],
      ],
    ),
    highlight: { active: ['view:rule', 'expected:rule', 'returns:rule'], removed: ['main:rule'] },
    explanation: 'Atomics.wait only works on Int32Array or BigInt64Array views backed by SharedArrayBuffer. It returns not-equal, ok, or timed-out. Browser main threads cannot use blocking wait; use worker-side waits or waitAsync-style designs.',
  };

  yield {
    state: labelMatrix(
      'Ring failure modes',
      [
        { id: 'lost', label: 'lost wake' },
        { id: 'spin', label: 'spin loop' },
        { id: 'full', label: 'full ring' },
        { id: 'stale', label: 'stale read' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['stuck', 'wait value'],
        ['hot CPU', 'sleep'],
        ['overwrite', 'backpress'],
        ['bad bytes', 'Atomics'],
      ],
    ),
    highlight: { removed: ['lost:symptom', 'full:symptom'], found: ['lost:fix', 'stale:fix'] },
    explanation: 'The hard parts are the same as systems programming: lost wakeups, memory ordering, full-buffer backpressure, and shutdown. Keep the protocol tiny, documented, and wrapped behind an API.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'shared memory') yield* sharedMemoryView();
  else if (view === 'wait notify') yield* waitNotifyView();
  else throw new InputError('Pick a SharedArrayBuffer view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        "Read the animation as the execution trace for SharedArrayBuffer & Atomics. A browser shared-memory primer: SharedArrayBuffer, typed-array views, cross-origin isolation, Atomics operations, wait/notify, and ring-buffer backpressure..",
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
        {type:"callout", text:"Shared memory is useful only when the bytes have a small explicit protocol for ownership, ordering, sleep, wake, and backpressure."},
        {type:"image", src:"https://upload.wikimedia.org/wikipedia/commons/b/b7/Circular_buffer.svg", alt:"Conceptual circular buffer ring divided into slots.", caption:"Circular buffer conceptual ring, by Cburnett, CC BY-SA 3.0 or GFDL, via Wikimedia Commons."},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Most browser concurrency is message passing. A page posts a value to a worker, the platform serializes it, and the worker receives its own copy or ownership of a transferred resource. That is the right default because it keeps mutation local. Some workloads, though, move the same bytes through many stages: audio processing, video analysis, WebAssembly threads, model inference, stream parsing, and worker pools.',
        'SharedArrayBuffer exists for those cases. It creates a shared data block that multiple agents can view at the same time through typed arrays. That removes repeated copy or transfer steps, but it also imports the old systems problem: once two agents can touch the same memory, ordinary reads and writes are not enough. Atomics supplies ordered operations and wait/notify coordination so shared bytes can have a protocol instead of a race.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The reasonable first attempt is postMessage with structured clone. It handles normal objects, preserves many built-in data types, and avoids shared mutation. If the payload is a large one-way ArrayBuffer, the next step is transfer: move ownership to the worker and detach the sender side so the bytes are not copied.',
        'Those tools hit a wall when both sides need ongoing access to the same stream of bytes. A parser may need to consume data while the producer keeps filling the next slot. A WebAssembly program may expect several workers to share one linear memory. A real-time pipeline may not be able to allocate and transfer a new buffer for every small chunk.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is not only performance. It is ownership. Transfer is excellent when ownership should move. It is wrong when the sender and receiver must coordinate over the same buffer after the first message. Repeated cloning is simple, but it turns a streaming protocol into allocation, serialization, and garbage collection pressure.',
        'Shared memory removes that wall by removing isolation between the agents that share the bytes. That is why it needs a second wall around correctness. The data slots are not self-describing. A consumer needs to know which slots have been published. A producer needs to know which slots have been consumed. Both sides need shutdown, full-buffer, and empty-buffer states that cannot be guessed from payload bytes alone.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A common design splits the buffer into control words and payload bytes. The control words use an Int32Array view because Atomics.wait and Atomics.notify operate on Int32Array or BigInt64Array views backed by SharedArrayBuffer. The payload may use a Uint8Array, Float32Array, WebAssembly memory view, or a domain-specific record layout.',
        'The core invariant is publish before notify, then recheck after wake. A producer writes payload bytes, uses Atomics.store or another atomic operation to publish the new state, and then calls Atomics.notify. A consumer wakes, reloads the control state, verifies that data is available, reads only published bytes, and advances its own control word.',
      ],
    },
    {
      heading: 'How wait and notify work',
      paragraphs: [
        'Atomics.wait(view, index, expected) first checks the shared memory location. If the value is not the expected value, it returns immediately with "not-equal". If the value still matches, the agent can sleep until a timeout or until another agent notifies waiters on that location. That check-before-sleep step is what prevents a basic lost-wakeup race.',
        'Atomics.notify(view, index, count) wakes agents sleeping on a location, but it does not carry a message. The shared memory value is still the source of truth. A correct consumer always loops: load state, decide whether it can proceed, wait only if the expected value still says no work is available, wake, and load state again.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The ring-buffer proof is a protocol proof. The producer owns tail movement. The consumer owns head movement. The producer writes a slot before publishing the tail that exposes it. The consumer reads a slot before publishing the head that frees it. Full and empty checks compare those control words before touching payload.',
        'The waiting proof is also about the control word, not the notification. If the consumer sees empty state and sleeps only while that state is still current, then a producer that changes the state before notify gives the consumer a new value to observe. If a notification arrives for the wrong reason, the consumer reloads and either proceeds or waits again. Spurious or broad wakeups become harmless rechecks.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The shared-memory view separates three ideas that are easy to blend together: agents, bytes, and typed-array views. The main thread and worker point at the same SharedArrayBuffer. The Int32Array view is control state. The Uint8Array view is payload. Atomics belongs to the control state, not to every byte of application data.',
        'The wait/notify view shows why a ring is more than a circular array. The payload slots hold records, but head and tail define ownership. The consumer sleeps on a control value, the producer publishes by changing a control value, and wakeup only tells the consumer to inspect memory again.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'SharedArrayBuffer can remove copy cost and reduce allocation pressure, but it adds fixed engineering cost. You need a binary layout, capacity rules, overflow behavior, shutdown signaling, timeout policy, and tests for races. The smaller the payload or lower the message rate, the more likely structured clone or transfer is the better trade.',
        'There is also a browser security cost. SharedArrayBuffer sharing is gated by secure context and cross-origin isolation because shared memory and high-resolution timing can affect side-channel risk. Robust code checks crossOriginIsolated, configures COOP and COEP when needed, and has a fallback path when the page cannot be isolated.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Shared memory wins when the same bytes are read and written repeatedly across agents and the copy boundary is a measured bottleneck. WebAssembly threads are the direct case. So are worker pools processing fixed-size records, media pipelines passing frame chunks, and ML or visualization code moving dense numeric arrays between compute and rendering stages.',
        'A real-time audio feature shows the access pattern. The producer writes encoded frames into a shared ring and publishes tail. The worker waits when the ring is empty, wakes when tail changes, decodes or analyzes frames, and advances head. If the ring fills, backpressure is explicit instead of silently overwriting unread data.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Shared memory fails when the protocol is larger than the performance problem. It is easy to build a fragile shared queue for data that could have been cloned once or transferred cleanly. It is also easy to forget edge states: full ring, canceled producer, sleeping consumer during shutdown, timed-out wait, worker crash, or schema version mismatch.',
        'It is the wrong tool for ordinary UI state. The DOM is main-thread-owned, most application state is easier to reason about through messages, and blocking Atomics.wait cannot be used on the browser main thread. UI code should usually use worker-side waits, messages, or nonblocking waitAsync-style designs rather than blocking the interface.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: MDN SharedArrayBuffer at https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer, MDN Atomics.wait at https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Atomics/wait, and MDN Atomics.notify at https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Atomics/notify.',
        'Study Structured Clone & Transferables first so the default clone and ownership-transfer choices are clear. Then study Ring Buffer, Lock-Free Queue, Sequence Lock, Futex Wait Queue Case Study, WebAssembly Linear Memory Case Study, Web Workers: A Second Thread, Backpressure, Work-Stealing Deque Scheduler, and Cross-Origin Isolation: COOP, COEP & CORP.',
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
        'Use this topic as a checkpoint: if you can explain why SharedArrayBuffer & Atomics moves from input to output in the animation and where it fails, you are ready for the next topic.',
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

