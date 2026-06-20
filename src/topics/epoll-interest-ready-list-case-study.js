// epoll as a data-structure case study: one registered interest set, one
// ready list, and a loop that must drain readiness correctly.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'epoll-interest-ready-list-case-study',
  title: 'epoll Interest & Ready Lists',
  category: 'Systems',
  summary: 'Linux epoll keeps an interest set of watched file descriptors and a ready list of descriptors whose I/O can make progress.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['interest and ready lists', 'edge-triggered drain loop'], defaultValue: 'interest and ready lists' },
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

function epollGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'app', label: 'loop', x: 0.7, y: 4.0, note: notes.app ?? 'user code' },
      { id: 'epfd', label: 'epfd', x: 2.6, y: 4.0, note: notes.epfd ?? 'instance' },
      { id: 'interest', label: 'interest', x: 4.7, y: 1.8, note: notes.interest ?? 'watch set' },
      { id: 'fd17', label: 'fd 17', x: 6.7, y: 1.0, note: notes.fd17 ?? 'socket A' },
      { id: 'fd18', label: 'fd 18', x: 6.7, y: 2.6, note: notes.fd18 ?? 'socket B' },
      { id: 'waitq', label: 'wait q', x: 9.1, y: 1.8, note: notes.waitq ?? 'drivers' },
      { id: 'ready', label: 'ready', x: 4.7, y: 6.2, note: notes.ready ?? 'events' },
      { id: 'wait', label: 'wait()', x: 6.9, y: 6.2, note: notes.wait ?? 'copy out' },
      { id: 'handler', label: 'handle', x: 9.1, y: 6.2, note: notes.handler ?? 'do I/O' },
    ],
    edges: [
      { id: 'e-app-epfd', from: 'app', to: 'epfd', weight: '' },
      { id: 'e-epfd-interest', from: 'epfd', to: 'interest', weight: 'ctl' },
      { id: 'e-interest-fd17', from: 'interest', to: 'fd17', weight: 'POLLIN' },
      { id: 'e-interest-fd18', from: 'interest', to: 'fd18', weight: 'POLLOUT' },
      { id: 'e-fd17-waitq', from: 'fd17', to: 'waitq', weight: 'hook' },
      { id: 'e-fd18-waitq', from: 'fd18', to: 'waitq', weight: 'hook' },
      { id: 'e-waitq-ready', from: 'waitq', to: 'ready', weight: 'ready' },
      { id: 'e-ready-wait', from: 'ready', to: 'wait', weight: '' },
      { id: 'e-wait-handler', from: 'wait', to: 'handler', weight: '' },
      { id: 'e-handler-app', from: 'handler', to: 'app', weight: '' },
    ],
  }, { title });
}

function* interestAndReadyLists() {
  yield {
    state: epollGraph('epoll separates watched descriptors from ready descriptors'),
    highlight: { active: ['epfd', 'interest', 'ready'], compare: ['fd17', 'fd18'] },
    explanation: 'The epoll instance is an in-kernel object with two conceptual collections: the interest list of file descriptors the program cares about, and the ready list of descriptors that currently have events available.',
    invariant: 'Registration and readiness are different data structures.',
  };

  yield {
    state: epollGraph('epoll_ctl mutates the interest set once per watch change', { interest: 'ADD/MOD/DEL', fd17: 'readable?', fd18: 'writable?' }),
    highlight: { active: ['app', 'epfd', 'interest', 'e-app-epfd', 'e-epfd-interest', 'e-interest-fd17', 'e-interest-fd18'], compare: ['ready'] },
    explanation: 'epoll_ctl adds, modifies, or deletes watches. That work is paid when interest changes, not every time the event loop asks whether something is ready.',
  };

  yield {
    state: epollGraph('Device wakeups append ready items instead of scanning every fd', { waitq: 'wake callback', ready: 'fd 17 ready', wait: 'sleeping' }),
    highlight: { active: ['fd17', 'waitq', 'ready', 'e-fd17-waitq', 'e-waitq-ready'], compare: ['fd18'] },
    explanation: 'When a socket, pipe, or other file description changes state, kernel wakeup machinery can make the associated epoll item visible on the ready list. The event loop does not rescan thousands of quiet descriptors.',
    invariant: 'The wait cost is proportional to returned events plus bookkeeping, not to every watched fd.',
  };

  yield {
    state: epollGraph('epoll_wait copies a batch from ready list to user space', { ready: '17, 22, 41', wait: 'maxevents', handler: 'dispatch' }),
    highlight: { active: ['ready', 'wait', 'handler', 'e-ready-wait', 'e-wait-handler'], found: ['app'] },
    explanation: 'epoll_wait sleeps until work exists or a timeout expires, then returns a bounded batch of ready events. The application dispatches handlers, then loops back to wait again.',
  };

  yield {
    state: labelMatrix(
      'Readiness notification versus completion notification',
      [
        { id: 'epoll', label: 'epoll' },
        { id: 'uring', label: 'io_uring' },
        { id: 'worker', label: 'thread pool' },
      ],
      [
        { id: 'kernel', label: 'kernel reports' },
        { id: 'app', label: 'app must do' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['fd can make progress', 'call read/write', 'forget to drain'],
        ['operation completed', 'consume CQE', 'CQ overflow'],
        ['thread returned', 'join result', 'blocked threads'],
      ],
    ),
    highlight: { active: ['epoll:kernel', 'epoll:app'], compare: ['uring:kernel'] },
    explanation: 'epoll is readiness based: it says the next I/O operation should not block. io_uring is completion based: it reports that a submitted operation has finished. That distinction changes the shape of the application state machine.',
  };
}

function* edgeTriggeredDrainLoop() {
  yield {
    state: labelMatrix(
      'Two epoll trigger modes',
      [
        { id: 'level', label: 'level' },
        { id: 'edge', label: 'edge' },
        { id: 'oneshot', label: 'one-shot' },
      ],
      [
        { id: 'fires', label: 'fires when' },
        { id: 'handler', label: 'handler rule' },
      ],
      [
        ['fd remains ready', 'can do partial I/O'],
        ['state changes to ready', 'drain until EAGAIN'],
        ['once until rearm', 'MOD after handling'],
      ],
    ),
    highlight: { active: ['edge:fires', 'edge:handler'], compare: ['level:handler'] },
    explanation: 'Level-triggered epoll is forgiving: if data remains, the event can be reported again. Edge-triggered epoll is efficient but strict: after a readiness edge, the handler must drain the fd until nonblocking I/O says EAGAIN.',
    invariant: 'Edge-triggered readiness is a notification that state changed, not a promise that every byte will get a new event.',
  };

  yield {
    state: epollGraph('Edge-triggered bug: handler reads one chunk and stops', { fd17: '8 KB queued', ready: 'one edge', handler: 'read 1 KB', app: 'loops' }),
    highlight: { active: ['fd17', 'ready', 'wait', 'handler'], removed: ['e-waitq-ready'], compare: ['app'] },
    explanation: 'The common bug is reading once, leaving bytes in the socket buffer, and then waiting for another edge that may never arrive. The descriptor is still readable, but the transition already happened.',
  };

  yield {
    state: epollGraph('Correct edge-triggered loop: nonblocking drain to EAGAIN', { fd17: 'empty', ready: 'consumed', wait: 'returns batch', handler: 'while read()' }),
    highlight: { active: ['handler', 'fd17', 'e-wait-handler', 'e-handler-app'], found: ['ready'] },
    explanation: 'The fix is structural, not cosmetic: make the fd nonblocking and loop read or write operations until the kernel says they would block. Now the application has consumed the readiness edge completely.',
  };

  yield {
    state: labelMatrix(
      'Server loop case study',
      [
        { id: 'accept', label: 'listen socket' },
        { id: 'read', label: 'client read' },
        { id: 'write', label: 'client write' },
        { id: 'close', label: 'peer close' },
      ],
      [
        { id: 'event', label: 'event' },
        { id: 'state', label: 'state update' },
        { id: 'next', label: 'next watch' },
      ],
      [
        ['EPOLLIN', 'accept until EAGAIN', 'watch clients'],
        ['EPOLLIN', 'append request bytes', 'maybe POLLOUT'],
        ['EPOLLOUT', 'flush send buffer', 'disable if empty'],
        ['HUP/ERR', 'remove fd state', 'DEL/close'],
      ],
    ),
    highlight: { active: ['read:state', 'write:next'], found: ['close:state'] },
    explanation: 'A scalable server stores per-fd state outside epoll. epoll returns readiness; the application owns request buffers, response queues, and exactly which events should remain in the interest set.',
  };

  yield {
    state: labelMatrix(
      'Correctness checklist',
      [
        { id: 'nonblock', label: 'nonblocking fd' },
        { id: 'drain', label: 'drain loop' },
        { id: 'state', label: 'per-fd state' },
        { id: 'backpressure', label: 'backpressure' },
      ],
      [
        { id: 'why', label: 'why' },
        { id: 'failure', label: 'failure if missing' },
      ],
      [
        ['EAGAIN boundary', 'thread blocks'],
        ['consume edge', 'stalled bytes'],
        ['join events to buffers', 'lost protocol state'],
        ['bound output queues', 'memory blowup'],
      ],
    ),
    highlight: { active: ['nonblock:why', 'drain:why', 'backpressure:why'], compare: ['drain:failure'] },
    explanation: 'epoll does not make an event-driven server correct by itself. It supplies the ready list; correctness comes from nonblocking I/O, state machines, and bounded queues.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'interest and ready lists') yield* interestAndReadyLists();
  else if (view === 'edge-triggered drain loop') yield* edgeTriggeredDrainLoop();
  else throw new InputError('Pick an epoll view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'epoll is Linux readiness notification for many file descriptors. User space creates an epoll instance, registers descriptors and event masks with epoll_ctl, then calls epoll_wait to receive descriptors that are ready for I/O.',
        'The core data-structure insight is the split between the interest list and the ready list. The interest list is the watched set. The ready list is the current batch of watched descriptors with available events. That split is why a server can track many quiet sockets without scanning every one on every loop turn.',
        {type:'callout', text:'epoll scales because the kernel separates the durable watch set from the short ready queue, so user space handles only descriptors whose state changed.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious server loop keeps a list of sockets and checks each one for work. That is fine for a small number of clients, but it wastes time when thousands of descriptors are mostly idle. The program repeatedly asks quiet sockets whether anything changed.',
        'select and poll improve portability and structure, but they still expose a scan-shaped problem. epoll changes the shape by maintaining a kernel-side interest set and returning descriptors that became ready. The application still owns protocol state; epoll only makes readiness discovery cheaper.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core idea is to separate what the application cares about from what is currently actionable. The interest list says "watch these descriptors for these events." The ready list says "these watched descriptors can probably make progress now."',
        'That distinction is why epoll belongs in a data-structures curriculum. It is not just a Linux API. It is a maintained set plus a work queue, connected to kernel wakeups and user-space state machines.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Registration work happens when the program adds, modifies, or removes a watch. Later, readiness changes from sockets, pipes, timers, or other file descriptions can make entries appear on the ready list. epoll_wait returns information from that ready list, bounded by the user-provided events array.',
        'This is why epoll scales differently from repeatedly scanning a large fd set. Quiet descriptors stay in the interest set, but the event loop wakes around descriptors that have become ready.',
      ],
    },
    {
      heading: 'Case study: edge-triggered sockets',
      paragraphs: [
        'In edge-triggered mode, a readable socket may generate an event when it transitions to ready. If the handler reads only one small chunk and leaves bytes in the socket buffer, there may be no second edge. The correct pattern is nonblocking I/O and a drain loop until EAGAIN.',
        'A production server keeps request and response state per fd. epoll reports readiness; the application updates buffers, toggles POLLOUT interest when there is pending output, removes closed descriptors, and applies backpressure when output queues grow.',
        'one-shot mode adds another common pattern. A worker handles an fd once, then rearms interest with epoll_ctl after it has restored the per-fd state. This prevents two threads from processing the same descriptor at the same time, but it also creates a new failure mode: forget to rearm and the connection goes quiet forever.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'Read the first view as two lists with different jobs. epoll_ctl changes the interest list when your application changes what it cares about. Kernel wakeups populate the ready list when a watched descriptor can make progress. epoll_wait only hands you the current ready batch; it does not own your protocol state.',
        'In the edge-triggered view, the obvious but wrong handler reads once and waits again. The correct handler drains a nonblocking descriptor until EAGAIN, then updates per-fd state and interest masks. That is the difference between a fast event loop and a rare production stall.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'epoll works because most descriptors are idle most of the time. Maintaining an interest set lets the kernel connect readiness changes to waiters without asking user space to rescan every descriptor. The application wakes with a batch of likely-progress descriptors and spends work where state changed.',
        'Correctness still comes from the application state machine. Readiness is not the same as completion. A readable socket can still return a partial message. A writable socket can still accept only part of a response. The server must keep buffers, parse state, and backpressure outside epoll.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The payoff is avoiding a full scan of thousands of inactive descriptors on every loop turn. The costs move into registration bookkeeping, kernel wakeup paths, batching, per-fd state, and handler discipline. Bad handlers can still block the loop, leak fd state, or let output queues grow without bounds.',
        'Edge-triggered mode adds a stricter contract. It can reduce repeated notifications, but it requires nonblocking descriptors and drain loops. Level-triggered mode is more forgiving because a descriptor that remains ready can be reported again.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'epoll is readiness notification, not completion notification. It says an operation should be able to make progress; the application still performs the read or write. io_uring completion queues invert that relationship by reporting finished submitted operations.',
        'Another misconception is that edge-triggered mode is automatically faster. It reduces repeated notifications only when handlers drain correctly. Without nonblocking drain loops, edge-triggered mode is a reliable way to create rare stalls.',
      ],
    },
    {
      heading: 'Operational signals',
      paragraphs: [
        'Track epoll_wait batch size, loop latency, handler duration, fd count, interest modifications, EAGAIN rate, output queue length, accepted connections, closed descriptors, and memory per connection. These tell whether the event loop is discovering readiness efficiently or hiding backpressure.',
        'A stalled connection should be debuggable from per-fd state: current interest mask, input buffer size, output buffer size, last readiness event, last read/write result, and whether the handler drained to EAGAIN. Without that state, edge-triggered bugs are painful to reproduce.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A chat server accepts ten thousand mostly idle TCP connections. A scan-based loop wastes time asking every socket whether anything changed. An epoll-based loop registers each client once, then wakes when a client socket becomes readable, a response socket becomes writable, or the listen socket can accept more clients.',
        'When a client sends a partial message, the handler appends bytes to that client state and returns. When a full message is parsed, the server appends responses to other clients output queues and enables write interest only where there is data to flush. When a peer closes, the server removes the descriptor, deletes per-client state, and frees queued buffers.',
        'This example shows why epoll is not the application protocol. The ready list only says which descriptors deserve attention now. The server logic lives in the per-connection state machine built around it.',
        'A slow client makes the lesson sharper. If the server keeps writing faster than the socket can drain, output buffers grow. The event loop must disable writes when there is no data, enable writes when there is pending data, and cap queued bytes so one slow receiver cannot consume memory for everyone else.',
      ],
    },
    {
      heading: 'What to remember',
      paragraphs: [
        'epoll gives you readiness batches, not a server. The server is the per-fd state machine wrapped around those batches. The interest list and ready list are useful only when handlers are nonblocking, bounded, and honest about backpressure.',
        'For course design, teach epoll after queues, hash maps, and file descriptors. It shows how ordinary data structures become the backbone of high-concurrency systems.',
        'The final test is whether a student can explain why data can sit unread forever in a broken edge-triggered server. If they can answer that with the words nonblocking, drain to EAGAIN, ready edge, and per-fd state, they understand the algorithm rather than the API name.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: epoll overview at https://man7.org/linux/man-pages/man7/epoll.7.html, epoll_ctl at https://man7.org/linux/man-pages/man2/epoll_ctl.2.html, and epoll_wait at https://man7.org/linux/man-pages/man2/epoll_wait.2.html. Study Event Loop, Queue, Hash Table, File Descriptor Table & Open File Description, Futex Wait Queue, Backpressure & Flow Control, and io_uring Submission & Completion Rings next.',
      ],
    },
  ],
};
