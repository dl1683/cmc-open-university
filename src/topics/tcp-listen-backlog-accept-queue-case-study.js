// TCP listen queues: incomplete SYN requests, established accept backlog,
// and the application accept loop as a small but consequential queueing system.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'tcp-listen-backlog-accept-queue-case-study',
  title: 'TCP Listen Backlog & Accept Queue Case Study',
  category: 'Systems',
  summary: 'A server-side TCP admission case study: SYN requests wait in an incomplete queue, completed handshakes move to the accept queue, and accept() drains connected sockets.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['SYN queue to accept queue', 'overflow and tuning'], defaultValue: 'SYN queue to accept queue' },
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

function listenGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'client', label: 'client', x: 0.45, y: 4.0, note: notes.client ?? 'connect' },
      { id: 'listen', label: 'listen', x: 2.25, y: 4.0, note: notes.listen ?? 'fd' },
      { id: 'synq', label: 'SYN q', x: 4.05, y: 2.25, note: notes.synq ?? 'half-open' },
      { id: 'acceptq', label: 'accept q', x: 5.95, y: 5.75, note: notes.acceptq ?? 'established' },
      { id: 'accept', label: 'accept', x: 7.85, y: 4.0, note: notes.accept ?? 'pop' },
      { id: 'worker', label: 'worker', x: 9.55, y: 4.0, note: notes.worker ?? 'fd' },
    ],
    edges: [
      { id: 'e-client-listen', from: 'client', to: 'listen', weight: '' },
      { id: 'e-listen-synq', from: 'listen', to: 'synq', weight: '' },
      { id: 'e-synq-acceptq', from: 'synq', to: 'acceptq', weight: '' },
      { id: 'e-acceptq-accept', from: 'acceptq', to: 'accept', weight: '' },
      { id: 'e-accept-worker', from: 'accept', to: 'worker', weight: '' },
    ],
  }, { title });
}

function* synQueueToAcceptQueue() {
  yield {
    state: listenGraph('listen() creates a passive socket with queues'),
    highlight: { active: ['listen'], compare: ['synq', 'acceptq'] },
    explanation: 'A listening TCP socket is not a connected socket. It is a passive endpoint with admission queues. Incoming handshakes first create incomplete request state, then completed connections wait for the application to accept them.',
    invariant: 'accept() returns a new connected socket; the listening socket stays open.',
  };

  yield {
    state: listenGraph('SYN creates incomplete request state', { client: 'SYN', synq: 'request' }),
    highlight: { active: ['client', 'listen', 'synq', 'e-client-listen', 'e-listen-synq'], compare: ['acceptq'] },
    explanation: 'When a SYN arrives, the kernel records small request state in the incomplete side of the handshake and sends SYN-ACK. This is not yet a full socket ready for application code.',
  };

  yield {
    state: labelMatrix(
      'Handshake admission state',
      [
        { id: 'syn', label: 'SYN received' },
        { id: 'synack', label: 'SYN-ACK sent' },
        { id: 'ack', label: 'ACK received' },
        { id: 'accept', label: 'accept() called' },
      ],
      [
        { id: 'queue', label: 'queue' },
        { id: 'object', label: 'kernel object' },
      ],
      [
        ['SYN q', 'request socket'],
        ['SYN q', 'timer + retransmit'],
        ['accept q', 'full socket'],
        ['user process', 'connected fd'],
      ],
    ),
    highlight: { active: ['ack:queue', 'accept:object'], found: ['syn:object'] },
    explanation: 'The final ACK promotes the connection from incomplete request state into an established socket waiting in the accept queue. Only then can accept() return it to user space.',
  };

  yield {
    state: listenGraph('accept() drains the established queue', { synq: 'done', acceptq: 'ready fds', accept: 'pop head', worker: 'serve' }),
    highlight: { active: ['acceptq', 'accept', 'worker', 'e-acceptq-accept', 'e-accept-worker'], found: ['listen'] },
    explanation: 'accept() removes one established connection from the accept queue and returns a new file descriptor. Event loops usually wake on the listening fd, then call accept until the queue is drained.',
  };

  yield {
    state: labelMatrix(
      'The two queue mental model',
      [
        { id: 'synq', label: 'SYN queue' },
        { id: 'acceptq', label: 'accept queue' },
        { id: 'listenfd', label: 'listen fd' },
        { id: 'connfd', label: 'conn fd' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'pressure', label: 'pressure means' },
      ],
      [
        ['incomplete handshakes', 'handshake flood or loss'],
        ['established sockets', 'app not accepting fast enough'],
        ['passive endpoint', 'readiness means acceptable'],
        ['one connection', 'worker owns traffic'],
      ],
    ),
    highlight: { active: ['synq:stores', 'acceptq:stores'], found: ['listenfd:pressure'] },
    explanation: 'Backlog bugs often come from naming the wrong queue. A SYN flood pressures incomplete request state. A slow accept loop pressures the established queue.',
  };
}

function* overflowAndTuning() {
  yield {
    state: listenGraph('A slow accept loop fills the established backlog', { acceptq: 'full', accept: 'slow', worker: 'busy' }),
    highlight: { active: ['acceptq', 'accept'], removed: ['worker'], compare: ['synq'] },
    explanation: 'If the application does not call accept fast enough, completed handshakes wait in the accept queue. Once that queue is full, new completed connections cannot be admitted normally.',
    invariant: 'For Linux TCP sockets, listen backlog limits established sockets waiting for accept.',
  };

  yield {
    state: labelMatrix(
      'Linux queue knobs',
      [
        { id: 'backlog', label: 'listen backlog' },
        { id: 'somax', label: 'somaxconn' },
        { id: 'synmax', label: 'tcp_max_syn_backlog' },
        { id: 'cookies', label: 'SYN cookies' },
        { id: 'abort', label: 'abort overflow' },
      ],
      [
        { id: 'controls', label: 'controls' },
        { id: 'risk', label: 'wrong lesson' },
      ],
      [
        ['accept q cap', 'not total live conns'],
        ['caps backlog', 'app value may be clipped'],
        ['incomplete q', 'not accept q'],
        ['stateless fallback', 'not normal capacity'],
        ['reset on overflow', 'can hurt clients'],
      ],
    ),
    highlight: { active: ['backlog:controls', 'somax:controls', 'synmax:controls'], compare: ['abort:risk'] },
    explanation: 'There is no single magic backlog number. The application backlog, somaxconn cap, incomplete-handshake limit, and overflow behavior all answer different questions.',
  };

  yield {
    state: listenGraph('A SYN flood pressures the incomplete side', { client: 'many SYNs', synq: 'full', acceptq: 'maybe empty', accept: 'normal' }),
    highlight: { active: ['client', 'synq', 'e-client-listen', 'e-listen-synq'], compare: ['acceptq'] },
    explanation: 'If many clients send SYNs and never complete the handshake, the incomplete queue is the bottleneck. The application may be accepting quickly and still see connection attempts fail or retry.',
  };

  yield {
    state: labelMatrix(
      'What to observe first',
      [
        { id: 'recvq', label: 'ss Recv-Q' },
        { id: 'listenov', label: 'ListenOverflows' },
        { id: 'syndrop', label: 'SYN drops' },
        { id: 'cpu', label: 'accept CPU' },
        { id: 'lat', label: 'connect latency' },
      ],
      [
        { id: 'points_at', label: 'points at' },
        { id: 'question', label: 'next question' },
      ],
      [
        ['accept backlog', 'is app draining?'],
        ['established q full', 'raise cap or fix accept loop?'],
        ['incomplete q pressure', 'attack, loss, or burst?'],
        ['user-space bottleneck', 'more acceptors?'],
        ['client pain', 'queueing or retransmits?'],
      ],
    ),
    highlight: { active: ['recvq:points_at', 'listenov:points_at'], found: ['lat:question'] },
    explanation: 'Treat backlog tuning as diagnosis, not folklore. First decide whether the incomplete queue, established queue, CPU, or downstream workers are the limiting resource.',
  };

  yield {
    state: listenGraph('The durable fix is an admission pipeline', { synq: 'sized', acceptq: 'drained', accept: 'loop', worker: 'pool' }),
    highlight: { active: ['synq', 'acceptq', 'accept', 'worker'], found: ['listen'] },
    explanation: 'A healthy server sizes queues for bursts, drains accept quickly, hands work to bounded worker capacity, and applies backpressure or load shedding before invisible queues hide overload.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'SYN queue to accept queue') yield* synQueueToAcceptQueue();
  else if (view === 'overflow and tuning') yield* overflowAndTuning();
  else throw new InputError('Pick a TCP listen queue view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A TCP server has more than one queue before application code sees a connection. A new SYN creates incomplete handshake state. After the final ACK arrives, the kernel creates or promotes a full connected socket and places it on the accept queue. The application calls accept() to remove one connected socket and get a new file descriptor.',
        'This distinction matters because Linux listen backlog now refers to completely established sockets waiting to be accepted, while incomplete connection requests are governed separately. A slow accept loop and a SYN flood are different failures even if users report the same symptom: connections are slow or refused.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The listening socket is passive. It owns the local address and port and has readiness semantics: when established sockets wait in the accept queue, event loops can wake and call accept(). The returned descriptor is a different connected socket with its own send and receive state. The listening descriptor remains open to admit more connections.',
        'Incomplete requests sit in the SYN side of the handshake. Completed handshakes sit in the accept queue. If the accept queue fills because user space is not draining it, raising tcp_max_syn_backlog does not fix the root cause. If incomplete requests flood the server, raising only the application backlog does not fix that root cause either.',
      ],
    },
    {
      heading: 'Complete case study: a burst at deploy time',
      paragraphs: [
        'A service restarts and 20,000 clients reconnect. The kernel receives SYNs, stores request state, and sends SYN-ACK. As final ACKs arrive, established sockets enter the accept queue. If the application runs one slow accept loop and immediately performs expensive setup on each connection, the accept queue fills. Clients see delayed connects or retries even though the machine has spare CPU elsewhere.',
        'The fix is not only a larger backlog. The server should drain accept quickly, hand connected sockets to bounded worker capacity, tune somaxconn and the application backlog for expected bursts, and monitor ListenOverflows or equivalent counters so the queueing layer is visible.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The data structures are queues, but the semantics are protocol state. The incomplete side has retransmission timers and anti-abuse behavior. The accept side holds full sockets that consume more memory. Too-small queues drop legitimate bursts. Too-large queues can hide overload and make clients wait longer before failure. Backlog tuning is useful only when paired with application throughput and load shedding.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Linux listen(2) manual page at https://man7.org/linux/man-pages/man2/listen.2.html and Linux tcp(7) manual page at https://man7.org/linux/man-pages/man7/tcp.7.html. Study TCP: Handshake & Congestion Control, Queue, Ring Buffer, Backpressure & Flow Control, epoll Interest & Ready List, File Descriptor Table & Open File Description, and Load Shedding & Graceful Degradation next.',
      ],
    },
  ],
};
