// eBPF ring buffer telemetry case study: reserve/submit records in a shared
// kernel map, poll them from user space, and keep observability loss explicit.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'ebpf-ring-buffer-telemetry-case-study',
  title: 'eBPF Ring Buffer Telemetry Case Study',
  category: 'Systems',
  summary: 'A kernel-to-user telemetry queue: eBPF programs reserve records in a shared ring buffer, submit or discard them, and user space polls batches safely.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['reserve submit path', 'observability pipeline'], defaultValue: 'reserve submit path' },
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

const SLOT_COLUMNS = Array.from({ length: 8 }, (_, index) => ({ id: `s${index}`, label: String(index) }));

function slotMatrix(title, headerRow, payloadRow, ownerRow) {
  return labelMatrix(
    title,
    [
      { id: 'hdr', label: 'hdr' },
      { id: 'payload', label: 'data' },
      { id: 'owner', label: 'owner' },
    ],
    SLOT_COLUMNS,
    [headerRow, payloadRow, ownerRow],
  );
}

function ringbufGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'hook', label: 'hook', x: 0.6, y: 3.8, note: notes.hook ?? 'tracepoint' },
      { id: 'program', label: 'BPF', x: 2.0, y: 3.8, note: notes.program ?? 'logic' },
      { id: 'verifier', label: 'verify', x: 2.0, y: 1.5, note: notes.verifier ?? 'refs' },
      { id: 'reserve', label: 'resv', x: 3.7, y: 3.0, note: notes.reserve ?? 'claim' },
      { id: 'ring', label: 'ring', x: 5.4, y: 3.0, note: notes.ring ?? 'map' },
      { id: 'submit', label: 'sub', x: 7.0, y: 3.0, note: notes.submit ?? 'publish' },
      { id: 'wakeup', label: 'wake', x: 8.3, y: 1.8, note: notes.wakeup ?? 'signal' },
      { id: 'poller', label: 'poll', x: 8.3, y: 4.8, note: notes.poller ?? 'libbpf' },
      { id: 'callback', label: 'cb', x: 9.6, y: 3.4, note: notes.callback ?? 'parse' },
    ],
    edges: [
      { id: 'e-hook-program', from: 'hook', to: 'program', weight: '' },
      { id: 'e-verifier-program', from: 'verifier', to: 'program', weight: '' },
      { id: 'e-program-reserve', from: 'program', to: 'reserve', weight: '' },
      { id: 'e-reserve-ring', from: 'reserve', to: 'ring', weight: '' },
      { id: 'e-ring-submit', from: 'ring', to: 'submit', weight: '' },
      { id: 'e-submit-wakeup', from: 'submit', to: 'wakeup', weight: '' },
      { id: 'e-submit-poller', from: 'submit', to: 'poller', weight: '' },
      { id: 'e-poller-callback', from: 'poller', to: 'callback', weight: '' },
    ],
  }, { title });
}

function telemetryGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'syscall', label: 'sys', x: 0.55, y: 3.8, note: notes.syscall ?? 'openat' },
      { id: 'bpf', label: 'BPF', x: 2.0, y: 3.8, note: notes.bpf ?? 'filter' },
      { id: 'ring', label: 'ring', x: 3.5, y: 3.8, note: notes.ring ?? 'MPSC' },
      { id: 'libbpf', label: 'poll', x: 5.0, y: 3.8, note: notes.libbpf ?? 'libbpf' },
      { id: 'batch', label: 'batch', x: 6.6, y: 2.5, note: notes.batch ?? 'queue' },
      { id: 'collector', label: 'OTel', x: 6.6, y: 5.1, note: notes.collector ?? 'collector' },
      { id: 'metrics', label: 'met', x: 8.5, y: 1.8, note: notes.metrics ?? 'drops' },
      { id: 'traces', label: 'trace', x: 8.5, y: 3.8, note: notes.traces ?? 'events' },
      { id: 'logs', label: 'log', x: 8.5, y: 5.8, note: notes.logs ?? 'audit' },
    ],
    edges: [
      { id: 'e-syscall-bpf', from: 'syscall', to: 'bpf', weight: '' },
      { id: 'e-bpf-ring', from: 'bpf', to: 'ring', weight: '' },
      { id: 'e-ring-libbpf', from: 'ring', to: 'libbpf', weight: '' },
      { id: 'e-libbpf-batch', from: 'libbpf', to: 'batch', weight: '' },
      { id: 'e-batch-collector', from: 'batch', to: 'collector', weight: '' },
      { id: 'e-collector-metrics', from: 'collector', to: 'metrics', weight: '' },
      { id: 'e-collector-traces', from: 'collector', to: 'traces', weight: '' },
      { id: 'e-collector-logs', from: 'collector', to: 'logs', weight: '' },
    ],
  }, { title });
}

function occupancyPlot(title, fill = 0) {
  const incoming = [
    { x: 0, y: 8 },
    { x: 10, y: 22 },
    { x: 20, y: 48 },
    { x: 30, y: 74 },
    { x: 40, y: 92 },
    { x: 50, y: 96 },
    { x: 60, y: 98 },
  ];
  const drained = [
    { x: 0, y: 8 },
    { x: 10, y: 17 },
    { x: 20, y: 30 },
    { x: 30, y: 39 },
    { x: 40, y: 36 },
    { x: 50, y: 25 },
    { x: 60, y: 15 },
  ];
  const markers = [
    { id: 'wake', x: 18, y: 38, label: 'wake' },
    { id: 'hi', x: 39, y: 90, label: 'hi' },
  ];
  if (fill) markers.push({ id: 'drop', x: 50, y: 96, label: 'drop' });
  return plotState({
    axes: { x: { label: 'ms', min: 0, max: 62 }, y: { label: 'used %', min: 0, max: 105 } },
    series: [
      { id: 'incoming', label: 'arrival', points: incoming },
      { id: 'drained', label: 'drain', points: drained },
    ],
    markers,
  }, { title });
}

function* reserveSubmitPath() {
  yield {
    state: ringbufGraph('A BPF program writes telemetry into a ringbuf map'),
    highlight: { active: ['hook', 'program', 'reserve', 'ring', 'e-hook-program', 'e-program-reserve'], compare: ['poller'] },
    explanation: 'BPF_MAP_TYPE_RINGBUF turns kernel events into a shared producer-consumer queue. A BPF program runs at a hook, reserves bytes, writes the record in place, and later user space polls the readable records.',
    invariant: 'The source of truth is still kernel state; the ring buffer is a bounded export path.',
  };

  yield {
    state: slotMatrix(
      'Two CPUs reserve record space in the same ring',
      ['free', 'free', 'hdr A', 'A len', 'A busy', 'hdr B', 'B len', 'free'],
      ['', '', 'pid=42', 'file', 'flags', 'pid=91', 'conn', ''],
      ['free', 'free', 'CPU0', 'CPU0', 'CPU0', 'CPU1', 'CPU1', 'free'],
    ),
    highlight: { active: ['hdr:s2', 'payload:s2', 'payload:s3', 'payload:s4'], compare: ['hdr:s5', 'payload:s6'] },
    explanation: 'The reservation step claims contiguous space and returns a pointer to the record area. The program fills the payload before publishing it, so user space never needs to read a half-built event.',
  };

  yield {
    state: ringbufGraph('The verifier tracks every reserved record', { verifier: 'close ref', reserve: 'ptr ref', submit: 'discard?' }),
    highlight: { active: ['verifier', 'reserve', 'submit', 'e-verifier-program', 'e-program-reserve'], found: ['ring'] },
    explanation: 'The reserve API has a safety contract: a program that reserves a record must later submit or discard it on every path. The verifier tracks that reference so a leaked reservation is rejected before load.',
    invariant: 'Reserve without submit or discard is a verifier error, not a runtime cleanup chore.',
  };

  yield {
    state: ringbufGraph('Submit publishes the record and wakes user space when needed', { ring: 'ready', submit: 'visible', wakeup: 'epoll', poller: 'drain' }),
    highlight: { active: ['ring', 'submit', 'wakeup', 'poller', 'callback', 'e-submit-wakeup', 'e-submit-poller'], found: ['e-poller-callback'] },
    explanation: 'After submit, the record becomes visible to the consumer. libbpf can poll the map file descriptor, consume available records, and invoke a callback for each decoded event.',
  };

  yield {
    state: labelMatrix(
      'Ringbuf helper contract',
      [
        { id: 'reserve', label: 'reserve' },
        { id: 'submit', label: 'submit' },
        { id: 'discard', label: 'discard' },
        { id: 'output', label: 'output' },
        { id: 'query', label: 'query' },
      ],
      [
        { id: 'does', label: 'does' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['claim', 'full'],
        ['pub', 'wake'],
        ['cancel', 'lost'],
        ['copy', 'xcopy'],
        ['stats', 'hint'],
      ],
    ),
    highlight: { active: ['reserve:does', 'submit:does', 'discard:does'], compare: ['output:risk', 'query:risk'] },
    explanation: 'reserve/submit is the zero-copy path. output is simpler when the record size is only known at runtime, but it copies from program memory into the ring. query helps with telemetry, not hard synchronization.',
  };

  yield {
    state: labelMatrix(
      'When the ring is full',
      [
        { id: 'drop', label: 'drop event' },
        { id: 'sample', label: 'sample' },
        { id: 'bigger', label: 'bigger ring' },
        { id: 'shard', label: 'shard maps' },
        { id: 'reduce', label: 'less data' },
      ],
      [
        { id: 'why', label: 'why' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['kernel stays fast', 'lost detail'],
        ['bounded load', 'bias'],
        ['absorbs bursts', 'memory'],
        ['less contention', 'join order'],
        ['lower rate', 'less context'],
      ],
    ),
    highlight: { active: ['drop:why', 'sample:why', 'reduce:why'], found: ['bigger:cost'], compare: ['shard:cost'] },
    explanation: 'The BPF program cannot block until observability catches up. A production design chooses an explicit loss policy, measures drops, and keeps hot-path records small enough to preserve the system being observed.',
  };
}

function* observabilityPipeline() {
  yield {
    state: telemetryGraph('Kernel event telemetry becomes a user-space pipeline'),
    highlight: { active: ['syscall', 'bpf', 'ring', 'libbpf', 'collector'], found: ['metrics', 'traces', 'logs'] },
    explanation: 'A common tracing tool records syscall, network, scheduler, or security events in a ring buffer. A user-space poller decodes the records and forwards them into metrics, traces, or logs.',
    invariant: 'The ring buffer is the queue between kernel proof rules and observability economics.',
  };

  yield {
    state: labelMatrix(
      'perf buffer versus BPF ringbuf',
      [
        { id: 'memory', label: 'memory' },
        { id: 'order', label: 'order' },
        { id: 'api', label: 'API' },
        { id: 'fit', label: 'best fit' },
      ],
      [
        { id: 'perf', label: 'perf buf' },
        { id: 'ring', label: 'ringbuf' },
      ],
      [
        ['per CPU', 'single ring'],
        ['per CPU order', 'global order'],
        ['copy output', 'reserve path'],
        ['legacy tools', 'event stream'],
      ],
    ),
    highlight: { active: ['memory:ring', 'order:ring', 'api:ring'], compare: ['memory:perf', 'order:perf'] },
    explanation: 'The kernel ring-buffer documentation frames ringbuf as a response to perf-buffer pain points: per-CPU memory overhead and cross-CPU event reordering. One shared ring preserves event order across producers.',
  };

  yield {
    state: occupancyPlot('Poll cadence decides whether the ring absorbs or drops bursts', 1),
    highlight: { active: ['incoming', 'hi', 'drop'], compare: ['drained', 'wake'] },
    explanation: 'A ring buffer smooths bursts only if the consumer drains it quickly enough. Once producer rate stays above consumer drain rate, occupancy approaches full and reserve starts returning NULL.',
  };

  yield {
    state: telemetryGraph('Batches make export cheap but add delay', { libbpf: 'consume', batch: '100 recs', collector: 'batch', metrics: 'drops', traces: 'spans', logs: 'audit' }),
    highlight: { active: ['libbpf', 'batch', 'collector', 'e-libbpf-batch', 'e-batch-collector'], found: ['metrics'] },
    explanation: 'The user-space poller usually batches decoded records before export. Batching reduces overhead, but it means you need flush intervals, backpressure, queue limits, and drop counters in the user-space path too.',
  };

  yield {
    state: labelMatrix(
      'Record schema audit',
      [
        { id: 'time', label: 'time' },
        { id: 'pid', label: 'pid/tgid' },
        { id: 'cpu', label: 'cpu' },
        { id: 'event', label: 'event id' },
        { id: 'payload', label: 'payload' },
      ],
      [
        { id: 'why', label: 'why' },
        { id: 'bug', label: 'bug if absent' },
      ],
      [
        ['order', 'bad timelines'],
        ['join proc', 'no owner'],
        ['debug skew', 'blind hotspot'],
        ['versioning', 'bad decode'],
        ['details', 'no context'],
      ],
    ),
    highlight: { active: ['event:why', 'payload:bug'], found: ['time:why', 'pid:why'] },
    explanation: 'The data structure is only useful if the record format is stable. Include enough identity to join with process, container, trace, or log context, and version the payload so decoders can evolve safely.',
  };

  yield {
    state: labelMatrix(
      'Complete case study: syscall monitor',
      [
        { id: 'hook', label: 'hook' },
        { id: 'filter', label: 'filter' },
        { id: 'emit', label: 'emit' },
        { id: 'poll', label: 'poll' },
        { id: 'export', label: 'export' },
        { id: 'alert', label: 'alert' },
      ],
      [
        { id: 'state', label: 'state' },
        { id: 'guard', label: 'guardrail' },
      ],
      [
        ['open', 'tp ok'],
        ['path', 'skip'],
        ['rec', 'drops'],
        ['cb', 'queue'],
        ['batch', 'redact'],
        ['rate', 'sample'],
      ],
    ),
    highlight: { active: ['emit:state', 'poll:state', 'export:guard'], found: ['alert:state'], compare: ['filter:guard'] },
    explanation: 'A production monitor does not dump every byte from the kernel. It filters early, emits compact records, accounts for drops, redacts sensitive fields, and routes the result into the same observability controls used by the rest of the platform.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'reserve submit path') yield* reserveSubmitPath();
  else if (view === 'observability pipeline') yield* observabilityPipeline();
  else throw new InputError('Pick an eBPF ring-buffer view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation has two views. "Reserve submit path" traces the lifecycle of a single record: hook fires, BPF program runs, space is reserved in the ring, payload is written, the record is submitted, and user space polls it. "Observability pipeline" shows the full telemetry path from a kernel syscall through the ring buffer, user-space batching, and export into metrics, traces, and logs.',
        {
          type: 'bullets',
          items: [
            'Active nodes are the current decision point: which helper is being called, which slot is being claimed, or which pipeline stage is processing.',
            'Compare nodes show the consumer side waiting while the producer works, or vice versa.',
            'Found nodes are confirmed outcomes: a record published, a batch exported, or a drop counted.',
          ],
        },
        'In the matrix views, rows are ring slots or helper functions, and columns are properties (header state, payload content, owning CPU, or risk). Watch the owner row: multiple CPUs can hold reservations in the same ring simultaneously, but the consumer only sees records that crossed the submit boundary.',
        {
          type: 'note',
          text: 'The animation uses an 8-slot ring and two CPUs for readability. Production rings are megabytes, dozens of CPUs produce concurrently, and records vary from 40 bytes to several kilobytes. The state machine is the same -- free, reserved, ready, consumed -- but the scale changes which costs dominate.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {
          type: 'quote',
          text: 'BPF_MAP_TYPE_RINGBUF supports a BPF ring buffer which is a multi-producer, single-consumer (MPSC) queue and can be safely used across multiple BPF programs and across multiple CPUs simultaneously.',
          attribution: 'Linux kernel documentation, bpf/ringbuf.rst',
        },
        'The interesting event happens in the kernel -- a syscall, a packet arrival, a scheduler decision, a security hook. The dashboard, alert, trace, or audit log lives in user space. Copying every event through a syscall or printk is too slow for hot paths that fire millions of times per second. The kernel needs a bounded, low-overhead export channel that lets observability ride alongside the system without becoming the thing that breaks it.',
        {
          type: 'diagram',
          text: [
            'The boundary problem:',
            '',
            '  kernel space              |  user space',
            '  ----------------------------|----------------------------',
            '  tracepoint fires            |  dashboard needs the event',
            '  10M events/sec              |  exporter handles 500K/sec',
            '  cannot block                |  can batch, retry, drop',
            '  memory is kernel-managed    |  memory is process-managed',
            '',
            '  The ring buffer sits on the boundary:',
            '  fixed-size, shared, memory-mapped, loss-explicit.',
          ].join('\n'),
          label: 'Kernel events are hot; user-space consumers are slow. The ring absorbs the mismatch.',
        },
        'The eBPF ring buffer makes that boundary explicit. A verified BPF program reserves space, writes a compact record in place, and publishes it. User space polls the readable records later. Memory is capped. Loss is possible and countable. The kernel never blocks waiting for a dashboard.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Three obvious paths exist: printk, per-event syscalls, and per-CPU buffers.',
        {
          type: 'table',
          headers: ['Approach', 'How it works', 'Why it breaks'],
          rows: [
            ['printk / trace_printk', 'Kernel writes a string to a debug log', 'String formatting in the hot path; no structured records; single global buffer contended across all CPUs'],
            ['Per-event syscall', 'Each event triggers a write() or ioctl() to user space', 'Context switch per event; 10M events/sec means 10M syscalls/sec; observability becomes the bottleneck'],
            ['Per-CPU perf buffer', 'Each CPU gets its own ring; user space merges them', 'Memory is allocated per CPU even if most CPUs are idle; cross-CPU event order is lost; merging adds latency and code'],
            ['Unbounded queue', 'Allocate as much memory as needed', 'Kernel memory is finite; a stalled consumer during an incident causes OOM; the observability path kills the system it observes'],
          ],
        },
        'The per-CPU perf buffer (BPF_MAP_TYPE_PERF_EVENT_ARRAY) is the closest ancestor. It works, and production tools used it for years. But it wastes memory on idle CPUs, forces the consumer to merge independently ordered streams, and copies data from program memory into the buffer instead of letting the program write in place.',
        {
          type: 'note',
          text: 'The perf buffer was not a bad design. It was the right design for an era when BPF programs were simpler and per-CPU isolation was the safest concurrency model. The ring buffer is what becomes possible once the verifier is strong enough to enforce multi-producer safety at load time.',
        },
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall for per-CPU buffers is the memory-ordering tradeoff. Allocating a separate ring per CPU avoids contention but creates two problems that fight each other.',
        {
          type: 'diagram',
          text: [
            'Per-CPU buffer problem:',
            '',
            '  CPU 0 ring: [openat t=100] [read t=103] [        ] [        ]',
            '  CPU 1 ring: [connect t=101] [send t=104] [        ] [        ]',
            '  CPU 2 ring: [        ] [        ] [        ] [        ]  <-- idle, memory wasted',
            '  CPU 3 ring: [        ] [        ] [        ] [        ]  <-- idle, memory wasted',
            '',
            '  User space sees: openat(t=100), read(t=103) from CPU 0,',
            '                   connect(t=101), send(t=104) from CPU 1.',
            '  To reconstruct: "did the process open the file before connecting?"',
            '  Answer requires merging, sorting, and trusting cross-CPU timestamps.',
            '',
            '  Shared ring:    [openat t=100] [connect t=101] [read t=103] [send t=104]',
            '  Order is preserved by submission order. No merge needed.',
          ].join('\n'),
          label: 'Per-CPU rings waste idle memory and lose global order',
        },
        'Making each per-CPU ring large enough to absorb bursts wastes memory on the CPUs that stay idle. Making them small causes drops on the CPUs that spike. There is no single size that works because load is not uniform. The shared ring buffer solves both: one pool absorbs bursts from whichever CPU is hot, and submission order preserves a global timeline without user-space merging.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Reserve, fill, publish. Three steps that separate visibility from construction.',
        {
          type: 'code',
          language: 'c',
          text: [
            '// BPF program attached to sys_enter_openat',
            'SEC("tp/syscalls/sys_enter_openat")',
            'int trace_openat(struct trace_event_raw_sys_enter *ctx) {',
            '    struct event *e;',
            '',
            '    // Step 1: Reserve contiguous space in the ring',
            '    e = bpf_ringbuf_reserve(&rb, sizeof(*e), 0);',
            '    if (!e)  // Ring full -- count the drop, do not block',
            '        return 0;',
            '',
            '    // Step 2: Fill the record in place (zero-copy)',
            '    e->pid = bpf_get_current_pid_tgid() >> 32;',
            '    e->ts  = bpf_ktime_get_ns();',
            '    bpf_get_current_comm(&e->comm, sizeof(e->comm));',
            '    bpf_probe_read_user_str(&e->fname, sizeof(e->fname),',
            '                            (void *)ctx->args[1]);',
            '',
            '    // Step 3: Publish -- record becomes visible to consumer',
            '    bpf_ringbuf_submit(e, 0);',
            '    return 0;',
            '}',
          ].join('\n'),
        },
        'Reserve claims contiguous bytes and returns a pointer. The program writes directly into the ring -- no intermediate buffer, no copy. The record is invisible to the consumer during this window. Submit flips the record to "ready" and optionally wakes the poller. If the program decides the event is not worth emitting, it calls discard instead, and the space is reclaimed without the consumer ever seeing it.',
        {
          type: 'diagram',
          text: [
            'Slot state machine:',
            '',
            '  FREE ---reserve---> RESERVED ---submit---> READY ---poll---> CONSUMED ---advance---> FREE',
            '                          |',
            '                       discard',
            '                          |',
            '                          v',
            '                        FREE',
            '',
            'Invariant: user space never reads a slot in RESERVED state.',
            'Invariant: the verifier rejects any program that can exit with a slot still RESERVED.',
          ].join('\n'),
          label: 'Four states per slot; two invariants enforced at load time and runtime',
        },
        'The verifier is part of the data-structure contract. It tracks the reservation as a reference and rejects any program that can reach an exit without calling submit or discard. A leaked reservation is a compile-time error, not a runtime cleanup problem.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The ring buffer is a single contiguous memory region mapped into both kernel and user address spaces. Internally it uses a producer position (written by BPF programs) and a consumer position (advanced by the poller). The region is mapped twice contiguously in virtual memory so that records that wrap around the physical end appear contiguous to the reader.',
        {
          type: 'table',
          headers: ['Helper', 'What it does', 'When to use', 'Risk'],
          rows: [
            ['bpf_ringbuf_reserve', 'Claims contiguous space, returns pointer', 'Fixed-size records (zero-copy path)', 'Returns NULL if ring is full'],
            ['bpf_ringbuf_submit', 'Publishes the reserved record', 'After filling the record', 'Wakeup cost if BPF_RB_FORCE_WAKEUP is set'],
            ['bpf_ringbuf_discard', 'Frees the reserved space without publishing', 'When filter logic rejects the event after reserving', 'Wastes the reservation window'],
            ['bpf_ringbuf_output', 'Copies data from program memory into ring', 'Dynamic-size records where size is computed late', 'Extra memcpy; slower than reserve path'],
            ['bpf_ringbuf_query', 'Returns ring stats (avail bytes, ring size)', 'Adaptive sampling based on ring pressure', 'Hint only; stale by the time you act on it'],
          ],
        },
        'On the consumer side, libbpf provides ring_buffer__new() to create a poller and ring_buffer__poll() or ring_buffer__consume() to drain records. poll() uses epoll internally and can block until records arrive. consume() drains whatever is available without blocking. Each record invokes a callback where user space decodes, filters, batches, or exports.',
        {
          type: 'code',
          language: 'c',
          text: [
            '// User-space consumer (libbpf)',
            'static int handle_event(void *ctx, void *data, size_t len) {',
            '    struct event *e = data;',
            '    printf("pid=%d comm=%s file=%s\\n", e->pid, e->comm, e->fname);',
            '    return 0;  // 0 = continue polling; nonzero = stop',
            '}',
            '',
            'struct ring_buffer *rb = ring_buffer__new(bpf_map__fd(skel->maps.rb),',
            '                                          handle_event, NULL, NULL);',
            'while (!exiting) {',
            '    int err = ring_buffer__poll(rb, 100 /* timeout ms */);',
            '    if (err == -EINTR) break;  // signal received',
            '}',
          ].join('\n'),
        },
        {
          type: 'note',
          text: 'The double-mapping trick is critical for correctness. Without it, a record that starts near the end of the physical buffer and wraps around would require two reads. The virtual double-map makes every record appear contiguous regardless of its physical position. The consumer reads a flat byte stream.',
        },
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A platform team monitors suspicious openat calls. Walk through one event end-to-end.',
        {
          type: 'table',
          headers: ['Step', 'Location', 'State', 'Action'],
          rows: [
            ['1', 'Kernel: tracepoint', 'sys_enter_openat fires for pid 4217 opening /etc/shadow', 'BPF program begins execution'],
            ['2', 'Kernel: BPF program', 'Ring has 3 KB free of 8 KB total', 'bpf_ringbuf_reserve(&rb, 128, 0) returns pointer p'],
            ['3', 'Kernel: BPF program', 'Slot at p is RESERVED, invisible to consumer', 'Program writes pid=4217, ts=9830412, comm="curl", fname="/etc/shadow"'],
            ['4', 'Kernel: BPF program', 'Record complete', 'bpf_ringbuf_submit(p, 0) -- slot transitions to READY'],
            ['5', 'Kernel: ring', 'Producer position advances by 128 + header', 'Epoll notification wakes the poller (if sleeping)'],
            ['6', 'User space: poller', 'ring_buffer__poll returns 1 record', 'Callback handle_event fires with data pointer and length'],
            ['7', 'User space: callback', 'Decoded record: pid=4217, /etc/shadow', 'Batched into export queue; consumer position advances'],
            ['8', 'User space: exporter', 'Batch of 100 records ready', 'Sent to OTel Collector as structured spans; slot memory now FREE'],
          ],
        },
        'If the ring had been full at step 2, reserve would have returned NULL. The program increments a per-CPU drop counter and returns without emitting. The drop counter is exported as a metric so the dashboard knows it is lying about total event count.',
        {
          type: 'code',
          language: 'c',
          text: [
            '// Drop-aware reserve pattern',
            'e = bpf_ringbuf_reserve(&rb, sizeof(*e), 0);',
            'if (!e) {',
            '    __sync_fetch_and_add(&drop_cnt, 1);  // per-CPU counter',
            '    return 0;                              // do NOT block the syscall',
            '}',
          ].join('\n'),
        },
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Three properties make the design sound.',
        {
          type: 'bullets',
          items: [
            'Bounded memory: the ring is a fixed allocation. The kernel never grows it at runtime. Overload becomes a measurable NULL return, not an OOM.',
            'Visibility invariant: a record is invisible while RESERVED and visible only after submit. The consumer never reads a half-built event. The verifier enforces that every reservation closes.',
            'Shared pool: one ring absorbs bursts from whichever CPU is hot. Idle CPUs do not waste memory. Submission order provides a global timeline without user-space merging.',
          ],
        },
        'The shared ring also fixes a subtle correctness problem with per-CPU perf buffers. When a security investigation asks "did process X open /etc/shadow before or after it called connect()?", and those two hooks ran on different CPUs, per-CPU buffers give two independent sequences with no ordering guarantee. The shared ring preserves submission order across producers, so the consumer gets a single stream.',
        {
          type: 'note',
          text: 'Submission order is not the same as event order. If CPU 0 reserves at time t=100 and CPU 1 reserves at t=101 but submits first, the consumer sees CPU 1\'s record before CPU 0\'s. For most telemetry this is acceptable because timestamps are in the record. For strict ordering guarantees, the application must sort by timestamp after consumption.',
        },
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'table',
          headers: ['Dimension', 'Cost', 'What happens when it doubles'],
          rows: [
            ['Ring memory', 'Fixed at map creation (power of 2, typically 64 KB - 64 MB)', 'Doubling the ring absorbs longer bursts but delays detection of a slow consumer'],
            ['Reserve', 'Atomic compare-and-swap on producer position; O(1)', 'More CPUs increase CAS contention; ~5-15 ns per reserve under moderate load'],
            ['Submit', 'Store to header + optional epoll wakeup; O(1)', 'BPF_RB_NO_WAKEUP avoids the wakeup cost; batch wakeups reduce overhead'],
            ['Poll', 'Scan from consumer position to producer position; O(batch)', 'Larger batches amortize syscall overhead but add latency'],
            ['Record size', 'Minimum 8 bytes (header); typical 64-256 bytes', 'Doubling record size halves ring capacity; large records crowd out small ones'],
          ],
        },
        'The dominant cost in practice is not the ring itself but the downstream pipeline. Decoding, enrichment, redaction, batching, and export to a collector typically cost 10-100x more CPU time per record than the kernel-side reserve-submit pair. The ring buffer is the cheapest link in the chain; tune the consumer first.',
        {
          type: 'diagram',
          text: [
            'Latency budget for one telemetry event:',
            '',
            '  reserve + fill + submit:   10-50 ns    (kernel, in-line)',
            '  epoll wakeup:              0-500 ns    (kernel, amortized)',
            '  poll + callback decode:    200-2000 ns (user space)',
            '  batch + enrich + redact:   1-10 us     (user space)',
            '  export to OTel collector:  50-500 us   (network, batched)',
            '  ----------------------------------------',
            '  Total per event:           ~1-500 us',
            '  Kernel share:              < 1%',
          ].join('\n'),
          label: 'The ring is fast; the pipeline after it is where budget goes',
        },
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        {
          type: 'table',
          headers: ['System', 'What it monitors', 'Why ringbuf fits'],
          rows: [
            ['Falco / Tetragon', 'Syscalls, file access, network connections for security policy', 'High-rate hooks need zero-copy records; global order helps reconstruct attack sequences'],
            ['bpftrace', 'Ad-hoc kernel tracing with one-liner scripts', 'ringbuf replaced perf buffers as the default output; simpler consumer code, less memory waste'],
            ['Cilium', 'Network policy decisions, packet drops, connection tracking', 'eBPF datapath programs emit flow records into ringbuf for user-space export to Hubble'],
            ['Pixie / Stirling', 'Application-level protocol tracing (HTTP, gRPC, SQL) without instrumentation', 'Captures request/response pairs at syscall level; ringbuf handles the volume without per-CPU fragmentation'],
            ['Custom fleet metrics', 'Scheduler latency, page faults, block I/O latency distributions', 'Lightweight BPF programs emit histogram bucket updates; consumer aggregates before export'],
          ],
        },
        'The pattern fits best when: the event source is in the kernel, the record is small and structured, loss is tolerable if counted, and the consumer can batch. It wins over tracing frameworks when the overhead budget is nanoseconds, not microseconds.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Silent loss: if the BPF program drops records when the ring is full but no one exports the drop counter, the dashboard silently under-reports. Every ring buffer deployment must export a drop metric.',
            'Schema drift: a poller compiled for record layout v1 will decode garbage after a rolling update ships layout v2. Records need an event-type ID and a version field, and the decoder must handle unknown versions gracefully.',
            'Oversized records: one 4 KB record in a 64 KB ring consumes 6% of capacity. If rare large events compete with frequent small events, the large ones crowd out hundreds of small ones during bursts.',
            'Privacy leaks: paths, arguments, packet payloads, and process names can contain secrets. Redaction must happen before records leave the kernel (via BPF-side filtering) or immediately in the user-space callback, not downstream.',
            'Not durable: the ring is a transport, not storage. If the consumer crashes, unconsumed records are gone. If you need audit-grade durability, the ring is the ingress pipe; user space must persist to disk.',
          ],
        },
        {
          type: 'table',
          headers: ['Failure', 'Symptom', 'Fix'],
          rows: [
            ['Ring full', 'reserve returns NULL; events silently vanish', 'Export drop counter; increase ring size or reduce record size; add adaptive sampling'],
            ['Slow consumer', 'Ring stays near capacity; steady-state drops', 'Profile the callback and export path; reduce per-record work; increase poll frequency'],
            ['Schema mismatch', 'Garbage fields after rolling update', 'Version field in record header; decoder skips unknown versions'],
            ['Timestamp skew', 'Events appear out of order after consumption', 'Use bpf_ktime_get_boot_ns for monotonic time; sort by timestamp in the batch layer'],
            ['Wakeup storm', 'Consumer CPU pegged by epoll notifications', 'Use BPF_RB_NO_WAKEUP on high-frequency events; poll on a timer instead'],
          ],
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'note',
          text: 'Primary sources: Linux kernel BPF ring buffer documentation (kernel.org/doc/html/latest/bpf/ringbuf.html). BPF_MAP_TYPE_RINGBUF map reference (docs.ebpf.io/linux/map-type/BPF_MAP_TYPE_RINGBUF/). Helper references for bpf_ringbuf_reserve, bpf_ringbuf_submit, bpf_ringbuf_discard. libbpf ring_buffer__new API reference (docs.ebpf.io/ebpf-library/libbpf/userspace/ring_buffer__new/). Andrii Nakryiko\'s BPF ring buffer design notes in the kernel commit series.',
        },
        {
          type: 'table',
          headers: ['Role', 'Topic', 'Why'],
          rows: [
            ['Prerequisite', 'Ring Buffer', 'Base circular-queue mechanics: producer/consumer positions, wrap-around, fullness detection'],
            ['Prerequisite', 'Backpressure and Flow Control', 'The overload model that decides what happens when producers outrun consumers'],
            ['Sibling', 'io_uring Submission and Completion Rings', 'Another kernel-user shared ring, but for I/O submission rather than telemetry export'],
            ['Sibling', 'NIC RX Ring and NAPI Poll Case Study', 'Packet receive backpressure uses the same bounded-ring, poll-driven consumer pattern'],
            ['Extension', 'eBPF Verifier Register State Case Study', 'How the verifier tracks the reservation reference and rejects programs that leak it'],
            ['Extension', 'Cilium eBPF Datapath Case Study', 'Production BPF networking where ringbuf carries flow telemetry alongside packet processing'],
            ['Downstream', 'OpenTelemetry Collector Case Study', 'Where the exported records go after they leave the ring buffer'],
            ['Downstream', 'Metric Label Cardinality Control', 'Cost control on the metrics that ring buffer telemetry feeds into'],
          ],
        },
      ],
    },
  ],
};

