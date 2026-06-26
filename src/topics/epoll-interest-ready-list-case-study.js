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
      heading: 'How to read the animation',
      paragraphs: [
        'The animation separates the interest list from the ready list. The interest list is the durable set of file descriptors the process asked the kernel to watch; a file descriptor is a small integer handle for a socket, pipe, or file. The ready list is the short queue of watched descriptors that currently have input, output capacity, hangup, or error events.',
        'Active nodes show a descriptor whose readiness just changed or is being returned by epoll_wait. Found nodes are descriptors currently ready for user-space work. The safe inference rule is: quiet descriptors stay in the interest list but do not reappear in the ready batch until their readiness condition is true.',
        {type:'callout', text:'epoll scales because the kernel separates the durable watch set from the short ready queue, so user space handles only descriptors whose state changed.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A network server may hold 50,000 mostly idle TCP connections. TCP is the transport protocol that gives each client a reliable byte stream, but most streams are silent most of the time. A server still needs to wake up quickly when any one socket receives bytes.',
        'epoll exists to avoid asking the kernel the same empty question for every socket on every loop turn. The process registers interest once, then waits for the kernel to return only the descriptors that became ready. This turns idle connections from repeated scan work into stored watch state.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is select or poll. The process builds a list of descriptors, enters the kernel, and asks which ones are ready. This is easy to understand because each loop iteration carries the complete watch set.',
        'That approach is fine for a few hundred descriptors. If a chat server has 200 sockets and 30 are active, scanning 200 entries is not the main cost. The design starts to hurt when the watched set grows while the active set stays small.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is repeated O(n) scanning. With 50,000 open sockets and 100 active sockets, poll still walks the 50,000-entry array to discover the 100 useful entries. When the connection count doubles to 100,000 and activity stays at 100, the useful work is unchanged but the scan doubles.',
        'There is also copying cost. User space has to pass descriptor arrays into the kernel and receive readiness results back. The system spends work describing the same quiet sockets again instead of remembering that the process already asked to watch them.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'epoll makes watching stateful. epoll_ctl adds, modifies, or deletes a descriptor in the kernel-owned interest list. epoll_wait then returns entries from the ready list, which is populated as descriptor state changes.',
        'The invariant is that registration and delivery are separate. Registration says what could matter later. Delivery says what matters now. That split is the whole data-structure move.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A process creates an epoll instance, which is itself represented by a file descriptor. It calls epoll_ctl with EPOLL_CTL_ADD to register another descriptor and an event mask such as EPOLLIN for readable input. The kernel records that interest and hooks readiness notifications from the watched object.',
        'When a socket becomes readable, the kernel links it into the ready list for that epoll instance. epoll_wait copies up to maxevents ready entries into the user buffer and may block if the ready list is empty. User space then reads, writes, closes, or modifies interest based on the returned events.',
        'Level-triggered mode repeats readiness while the condition remains true. Edge-triggered mode reports a transition, so the application must drain the descriptor until read or write returns EAGAIN. EPOLLONESHOT adds another contract: after one event, the descriptor must be rearmed before it can report again.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness comes from the readiness predicate. If a descriptor is readable, returning it is safe because a nonblocking read can make progress or discover that another thread already consumed the data. If it is not readable, omitting it is safe because the caller could not make read progress without blocking.',
        'Edge-triggered mode keeps the same predicate but changes the notification rule. The kernel may not remind the process about old unread bytes, so user space must drain until EAGAIN. The loop is correct only if every reported edge is consumed to the point where the descriptor is no longer ready.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The setup cost is O(1) expected work per epoll_ctl operation plus kernel memory for each watch. The wait cost behaves like O(k), where k is the number of ready events returned, plus copying those k event records to user space. The important change is that idle descriptors stop dominating each loop turn.',
        'Use real numbers. With 100,000 connections and 200 ready sockets, poll inspects 100,000 entries per loop. epoll_wait returns about 200 events, so the loop body scales with active sockets rather than open sockets, while the kernel keeps memory for all 100,000 watches.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'epoll fits event-driven servers on Linux: HTTP proxies, WebSocket gateways, databases, message brokers, and runtimes such as Node.js through libuv. The access pattern is many long-lived descriptors, sparse readiness, and nonblocking I/O.',
        'It is also useful for timers, eventfd, signalfd, and pipes when an application wants one event loop for mixed kernel objects. The benefit is not magic throughput; it is avoiding work on handles that cannot make progress.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'epoll does not make blocking code asynchronous. If a handler spends 200 ms parsing a large request on the event-loop thread, every other ready descriptor waits. The model needs short handlers or a worker pool for CPU-heavy work.',
        'Edge-triggered loops fail when they forget to drain. Reading one 4 KB chunk from a socket that has 64 KB buffered may leave data unread with no new edge to wake the process. That bug looks like a hung connection even though the bytes are already in the kernel.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a server has 20,000 idle WebSocket connections and 120 clients send messages in the next 10 ms. With poll, the server passes and scans the 20,000 descriptors to find those 120. With epoll, the kernel queues the 120 ready descriptors and epoll_wait returns a batch bounded by maxevents.',
        'If maxevents is 64, the first epoll_wait returns 64 events and the second returns the remaining 56, assuming no new sockets become ready. The server reads each socket in nonblocking mode. In edge-triggered mode, it keeps reading one socket until EAGAIN before moving on or it risks losing the notification.',
        'The cost difference is behavioral. Doubling idle connections to 40,000 roughly doubles poll scanning. epoll adds memory for 20,000 more watches, but the wait loop still handles about 120 ready events when only 120 clients send data.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: the Linux epoll(7), epoll_ctl(2), and epoll_wait(2) manual pages, plus Linux fs/eventpoll.c for implementation details. Read the man page sections on level-triggered, edge-triggered, EPOLLONESHOT, and nonblocking file descriptors.',
        'Study next: nonblocking sockets, reactor event loops, backpressure, kqueue, io_uring, and thread pools. The main idea to carry forward is the separation between a large interest set and a small ready set.',
      ],
    },
  ],
};
