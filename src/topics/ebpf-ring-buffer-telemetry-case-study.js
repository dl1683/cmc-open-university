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
      heading: 'What it is',
      paragraphs: [
        'The eBPF ring buffer is a BPF map type for moving event records from kernel eBPF programs to user space. A program running at a hook can reserve record space in a shared ring, fill it in place, and submit it. A user-space reader maps and polls the buffer, consumes completed records, and turns them into metrics, traces, logs, alerts, or live UI updates.',
        'This is a data-structure lesson hiding inside observability. Ring Buffer explains the circular queue. eBPF Verifier Register State Case Study explains why kernel programs need proof before they run. OpenTelemetry Collector Case Study explains what happens after raw records leave the kernel.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'BPF_MAP_TYPE_RINGBUF is a multi-producer, single-consumer queue. Multiple CPUs may run the BPF program and reserve records, while one user-space consumer drains the shared ring. The reserve API returns a pointer into the ring when enough space is available. The program writes the payload and then calls submit. If it decides not to publish, it must call discard.',
        'The verifier enforces the reserve lifecycle. Kernel documentation describes reserved records as tracked by verifier reference-tracking logic, so a program cannot reserve a record and forget to submit or discard it. That turns a common resource leak into a load-time rejection.',
        'The user-space side is usually libbpf. A ring-buffer manager attaches a callback to the map file descriptor, polls or consumes available records, and invokes the callback with each record. From there the tool decides whether to batch, sample, redact, aggregate, or export.',
      ],
    },
    {
      heading: 'Complete case study: syscall monitor',
      paragraphs: [
        'Suppose a platform team wants to monitor suspicious openat calls. An eBPF program attaches to a syscall tracepoint. It filters obvious noise in the kernel, reserves a compact record containing timestamp, pid, tgid, command, event id, and a bounded path field, and submits the record. If the ring is full, reserve returns null and the program increments a drop counter instead of blocking the syscall path.',
        'A user-space daemon polls the ring buffer, decodes records with a versioned schema, batches them, redacts sensitive paths, and exports counts and examples through the Collector. Metrics show rate and drop counters; logs keep selected examples; traces or exemplars connect incidents back to exact processes. The key design move is explicit loss accounting. Missing records are expected under overload, but silent missing records are a product bug.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The ring buffer removes unnecessary copies for the reserve/submit path and avoids the per-CPU memory overhead of perf event buffers. It also helps preserve cross-CPU event order because producers write into one shared ring. Those benefits do not make it lossless. Ring size, record size, producer rate, poll cadence, batching, and downstream exporter health determine whether the pipeline keeps up.',
        'Full-buffer behavior is a correctness decision. eBPF programs should not wait in the kernel until dashboards catch up. They usually drop, sample, emit smaller records, shard by event class, or push less work into the hot path. The important engineering habit is to expose drop counters and design alerts around them.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not treat the ring buffer as durable storage. It is a bounded transport, not a log. Do not emit large variable payloads by default; the largest records dominate space and drain cost. Do not forget schema evolution; user-space decoders can outlive loaded programs during rollouts. Do not confuse global order with total system truth: event timestamps, CPU scheduling, lost records, batching delay, and clock behavior still matter.',
        'Also do not put privacy decisions only after export. If path names, arguments, or packet bytes can contain secrets, the BPF program and poller need a clear record contract before the data reaches a shared observability backend.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Linux kernel BPF ring buffer documentation at https://www.kernel.org/doc/html/latest/bpf/ringbuf.html, eBPF Docs BPF_MAP_TYPE_RINGBUF reference at https://docs.ebpf.io/linux/map-type/BPF_MAP_TYPE_RINGBUF/, eBPF Docs bpf_ringbuf_reserve helper at https://docs.ebpf.io/linux/helper-function/bpf_ringbuf_reserve/, eBPF Docs bpf_ringbuf_submit helper at https://docs.ebpf.io/linux/helper-function/bpf_ringbuf_submit/, eBPF Docs bpf_ringbuf_discard helper at https://docs.ebpf.io/linux/helper-function/bpf_ringbuf_discard/, and libbpf ring_buffer__new reference at https://docs.ebpf.io/ebpf-library/libbpf/userspace/ring_buffer__new/. Study Ring Buffer, eBPF Verifier Register State Case Study, io_uring Submission & Completion Rings, NIC RX Ring & NAPI Poll Case Study, Cilium eBPF Datapath Case Study, OpenTelemetry Collector Case Study, Distributed Tracing, Metric Label Cardinality Control, and Backpressure & Flow Control next.',
      ],
    },
  ],
};
