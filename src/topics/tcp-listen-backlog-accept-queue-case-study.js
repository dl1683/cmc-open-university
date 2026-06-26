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
    explanation: 'accept() removes one established connection from the accept queue and returns a new file descriptor. The listening descriptor remains the admission point, so event loops wake on it and drain ready connections.',
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
    explanation: 'There is no single magic backlog number. The application backlog, somaxconn cap, incomplete-handshake limit, and overflow behavior each protect a different queue or failure mode.',
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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the listening socket as an admission pipeline, not as a connected client. A SYN queue holds incomplete handshakes, an accept queue holds established sockets waiting for user space, and accept() pops one connected socket while the listening descriptor stays open.',
        'The safe inference rule is diagnostic. Pressure before the final ACK points at handshake admission, while pressure after establishment points at the application accept loop or downstream workers.',
        {type:'callout', text:'A listening socket is an admission pipeline where handshake pressure and application-drain pressure live in different queues.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/3/32/Tcp_normal_2.png', alt:'TCP connection diagram showing SYN, SYN-ACK, and ACK messages between client and server.', caption:'Usual TCP connection scenario. Image: N-21, Wikimedia Commons, CC BY-SA 3.0/GFDL.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A TCP server must admit connections before application code can read requests. That admission path handles incomplete handshakes, established sockets waiting for accept(), reconnect bursts, packet loss, and abuse such as SYN floods.',
        'The queues exist because protocol state changes over time. A half-open request, an established socket, and a worker-owned connection have different memory costs, timers, and fixes when overloaded.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious mental model is one backlog in front of the server. Clients connect, the kernel stores waiting work somewhere, and the application calls accept() when it is ready.',
        'That model is good enough to learn the API. It fails when operators use one knob to explain every connection timeout or reset.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'A SYN flood and a slow accept loop can both hurt clients, but they stress different queues. If incomplete handshakes are filling up, making the application accept faster does not solve the first bottleneck.',
        'If established sockets are waiting because user space is slow, changing the SYN backlog is the wrong fix. The wall is not only capacity; it is naming the saturated queue correctly.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A listening TCP socket has at least two important admission states. The incomplete side tracks handshakes after SYN and before the final ACK, while the accept queue tracks established sockets waiting for accept().',
        'For Linux TCP sockets, the listen backlog controls established sockets waiting for accept, subject to system caps. Incomplete handshake pressure is governed by separate behavior such as SYN backlog limits and SYN cookies.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The server creates a listening socket by binding an address and calling listen(). When a SYN arrives, the kernel records request state, sends SYN-ACK, and waits for the final ACK.',
        'After the final ACK, the kernel creates an established socket and places it on the accept queue. When the application calls accept(), the kernel removes one established socket and returns a new connected file descriptor.',
        'The listening descriptor remains the admission point. Event loops usually wake on that descriptor and drain accept() until no more established sockets are ready.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The invariant is that accept() returns only completed connections. User space does not receive half-open handshakes, so the kernel can handle retransmission timers, incomplete request state, and SYN-flood defenses before application code is involved.',
        'The split gives a causal diagnostic. Incomplete queue pressure means handshake-layer trouble; accept queue pressure means completed connections are arriving faster than the application pipeline drains them.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The incomplete side stores request state and timers, while the accept queue stores full sockets. A full socket costs more memory than a half-open request, and a larger backlog can hide overload by making clients wait longer before failure.',
        'If arrival rate is 2,000 completed connections per second and the application accepts 1,500 per second, the accept queue grows by 500 per second until it fills. A bigger queue buys time for bursts, but it does not create CPU, workers, TLS capacity, or database capacity.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'This model is useful for web servers, proxies, load balancers, databases, RPC servers, and any event-driven service that accepts many TCP connections. It helps distinguish kernel admission pressure from user-space worker pressure.',
        'It is also useful during deploys and reconnect storms. Many healthy clients can reconnect at once, so queues should absorb short bursts while the accept loop drains quickly and downstream work is bounded.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The listen backlog is not a total live-connection limit, worker-pool size, request queue, or cure for slow TLS and application setup. After accept() returns a connected descriptor, later bottlenecks belong to another part of the server.',
        'It also fails as a portable one-number rule. Operating systems differ in backlog semantics, SYN-cookie behavior, queue caps, and exposed counters, so production tuning must verify the exact platform.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose listen(fd, 128) is used and 300 clients complete handshakes during a restart burst. If the event loop accepts 200 sockets quickly and hands them to workers, the accept queue may never fill even though the burst exceeds 128 over the whole second.',
        'Now suppose the accept loop accepts only 20 sockets per second because it performs expensive setup before returning. The queue reaches 128 and new completed handshakes cannot be admitted normally; if instead 300 clients send SYN and never ACK, the incomplete side is stressed while accept() may see little work.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources are the Linux listen(2) manual at https://man7.org/linux/man-pages/man2/listen.2.html and tcp(7) at https://man7.org/linux/man-pages/man7/tcp.7.html. Study TCP handshakes, queues, ring buffers, epoll readiness, file descriptors, backpressure, load shedding, and SYN-flood defenses next.',
      ],
    },
  ],
};
