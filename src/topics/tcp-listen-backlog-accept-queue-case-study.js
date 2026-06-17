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
      heading: 'Why this exists',
      paragraphs: [
        'A TCP server must admit new connections before application code can read or write them. That admission path has to handle incomplete handshakes, completed sockets waiting for user space, bursts of reconnecting clients, and abuse such as SYN floods.',
        'The important point is that a listening socket is not a connected socket. A SYN creates incomplete handshake state. After the final ACK arrives, a full connected socket waits in the accept queue. accept() removes one connected socket and returns a new file descriptor.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The simple mental model is one backlog in front of the server. Clients connect, the kernel stores them somewhere, and the application calls accept() whenever it is ready.',
        'That model is useful for explaining the API, but it hides the protocol state. A half-open handshake and a fully established socket do not have the same memory cost, timeout behavior, or fix when overloaded.',
      ],
    },
    {
      heading: 'Where that fails',
      paragraphs: [
        'A slow accept loop and a SYN flood can both look like connection pain from the client side, but they pressure different queues. If user space is not draining established sockets, tcp_max_syn_backlog is the wrong knob. If incomplete requests are flooding the server, a larger application backlog is not the real fix.',
        'The wall is diagnostic ambiguity. Without the two-queue model, backlog tuning becomes folklore and the operator may enlarge the queue that is not full.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'A listening TCP socket is a small admission pipeline with two different queues. The incomplete side tracks handshakes that have not finished. The accept queue holds established sockets waiting for the application. Linux listen backlog limits established sockets waiting for accept, while incomplete requests are governed separately.',
        'That split makes the right question visible: are clients stuck before the handshake completes, or are completed connections waiting because user space is slow to accept them?',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        "In the SYN-queue view, separate incomplete handshakes from accepted connections. A SYN creates request state and waits for the handshake to finish. It is not yet a socket that user space can read from.",
        "In the accept-queue view, watch the final ACK move a connection into established state. From that point, the application must call accept() to drain the queue and receive a connected descriptor. A full accept queue is usually an application-drain problem, not merely a network-handshake problem.",
        "In the overflow view, read each rejected or delayed connection as evidence about which queue is saturated. Tuning only helps when it matches the pressure point: incomplete handshake pressure, established-socket backlog, or downstream worker saturation.",
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A web server listens with a backlog of 128. During a deploy, thousands of clients reconnect. If the application event loop keeps accepting quickly and hands sockets to workers, the accept queue stays healthy even under a burst. If the application performs TLS setup, logging, or database work before returning to accept, established sockets pile up and new clients may time out even though the network is fine.',
        'Now compare that with a SYN flood. Incomplete handshakes accumulate before the final ACK. The accept loop may be perfectly fast, but user space never sees many of these attempts because they have not become established sockets. SYN cookies, SYN backlog sizing, retransmission behavior, and upstream filtering matter more than increasing worker count.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The listening socket owns the local address and port. When a SYN arrives, the kernel records request state and sends SYN-ACK. When the final ACK arrives, the connection becomes established and moves to the accept queue as a full socket. When the application calls accept(), the kernel pops one established socket and returns a connected descriptor.',
        'The returned descriptor has its own send and receive state. The listening descriptor remains open and continues admitting more connections. Event loops usually wake on the listening descriptor, then call accept until the established queue is drained.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The invariant is that accept() only returns completed connections. Incomplete handshakes stay outside user-space connection handling, where the kernel can apply retransmission timers, SYN backlog limits, and protections such as SYN cookies.',
        'Separating the queues also gives the operator a useful proof of cause. Pressure in the incomplete queue points to handshake flood, packet loss, or early admission pressure. Pressure in the accept queue points to an application or worker pipeline that is not draining established sockets quickly enough.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'The incomplete side stores lighter request state but needs timers and anti-abuse behavior. The accept side stores full sockets, so it costs more memory per entry. Too-small queues reject legitimate bursts. Too-large queues can hide overload and make clients wait longer before failure.',
        'Backlog tuning is useful only with application throughput. A server that accepts slowly because it performs expensive setup in the accept loop should drain first and hand work to bounded workers. A server under abusive SYN pressure needs handshake-layer defenses, not just a bigger accept backlog.',
      ],
    },
    {
      heading: 'Operational diagnosis',
      paragraphs: [
        'Start with the symptom location. Connection timeouts before establishment point toward handshake, routing, firewall, SYN backlog, or packet-loss problems. Successful connections that stall before the application handles them point toward accept queue, worker pool, TLS, or request-processing pressure. Established connections failing later are beyond the listen backlog and belong to application backpressure.',
        'Good servers keep accept loops boring. They accept as many ready sockets as practical, set nonblocking mode, hand work to bounded queues, and apply load shedding before memory exhaustion. Backlog is a burst absorber, not a throughput engine.',
      ],
    },
    {
      heading: 'Tuning without folklore',
      paragraphs: [
        'A larger backlog can help absorb short bursts when the application can catch up. It does not create CPU, worker capacity, TLS capacity, or downstream database capacity. If the server is continuously slower than the arrival rate, a larger queue mostly increases waiting time and memory pressure before failure.',
        'Useful tuning starts with measurements: handshake failures, SYN retransmits, accept rate, established queue pressure, worker queue depth, TLS handshake time, request latency, and load balancer retry behavior. The right fix might be a faster accept loop, more workers, admission control, SYN-flood mitigation, upstream connection reuse, or lower keep-alive churn. The backlog number is only one control in that chain.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'This model wins when debugging reconnect storms, deployment restarts, load balancer fan-in, and high-traffic services where connection setup is a visible part of latency. It lets operators distinguish kernel admission pressure from downstream worker saturation.',
        'It is also useful for teaching event-driven servers. The listening descriptor is a queue-draining source, not a worker. accept() should create connected descriptors quickly, then the rest of the server pipeline should apply its own backpressure and limits.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The listen backlog is not a total live-connection limit, a worker-pool size, or a cure for slow application setup. It also does not protect the service after accept() succeeds. Once a connected descriptor is handed to user space, worker queues, TLS handshakes, request parsing, and application backpressure become the next bottlenecks.',
        'It also fails as a portable one-number explanation because operating systems differ. Linux backlog semantics, SYN cookies, queue limits, and sysctls have specific behavior. Other kernels and frameworks may expose different knobs. Treat the two-queue model as the diagnostic foundation, then verify the exact platform semantics before changing production limits.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: Linux listen(2) manual page at https://man7.org/linux/man-pages/man2/listen.2.html and Linux tcp(7) manual page at https://man7.org/linux/man-pages/man7/tcp.7.html. Study TCP: Handshake & Congestion Control, Queue, Ring Buffer, Backpressure & Flow Control, epoll Interest & Ready List, File Descriptor Table & Open File Description, and Load Shedding & Graceful Degradation next.',
      ],
    },
  ],
};
