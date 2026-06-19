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
        "Read the animation as the execution trace for eBPF Ring Buffer Telemetry Case Study. A kernel-to-user telemetry queue: eBPF programs reserve records in a shared ring buffer, submit or discard them, and user space polls batches safely..",
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      ],
    },
    {
      heading: `Why this exists`,
      paragraphs: [
        `Production observability has a hard boundary: the interesting event often happens in the kernel, but the dashboard, alert, trace, or audit log lives in user space. System calls, network packets, scheduler decisions, file opens, and security hooks are too hot to copy through a slow path for every occurrence. The eBPF ring buffer exists to make that boundary cheap and explicit. A tiny verified program can run at a hook, write a compact record into a shared buffer, and let a user-space process drain the records later.`,
        `The design is not just an API convenience. It is a bounded data structure for exporting kernel facts without letting observability become the thing that breaks the system. The ring buffer says: records may move quickly, memory is capped, loss is possible, and every loss policy must be visible. That is the right contract for telemetry, where blocking the kernel to save a dashboard would be worse than dropping a sample and counting the drop.`,
      ],
    },
    {
      heading: `The obvious approach`,
      paragraphs: [
        `The naive approach is to print from the kernel, copy every event through a syscall, or write each CPU into a private buffer and sort everything later. Each version fails in a different way. Printing is a debugging tool, not a data plane. Per-event syscalls are too expensive for hot paths. Per-CPU buffers reduce contention but make global ordering and memory sizing harder. A monitoring tool that needs to reconstruct a process story across CPUs can end up spending more effort repairing the export path than analyzing the event.`,
        `Another tempting answer is to keep unbounded queues. That is unsafe in exactly the place you most need control. If the collector stalls during an incident, the kernel cannot keep allocating telemetry memory forever. The ring buffer uses a fixed-size region, so overload becomes a measurable condition rather than a hidden memory leak.`,
      ],
    },
    {
      heading: `The core insight`,
      paragraphs: [
        `The core insight is reserve, fill, publish. A BPF program first asks the ring for enough contiguous space. If space exists, the helper returns a pointer into the record area. The program writes the event in place. Only after the payload is complete does it submit the record, making it visible to the consumer. If the program decides the event should not be emitted, it discards the reservation instead.`,
        `That lifecycle gives two useful properties at once. It avoids an extra copy for fixed-size records, because the program writes directly into the ring. It also prevents user space from seeing half-built data, because a record is not published until submit. The data structure is a circular queue, but the engineering value comes from the state transition around each slot: free, reserved, ready, consumed.`,
      ],
    },
    {
      heading: `Reserve-submit mechanics`,
      paragraphs: [
        `BPF_MAP_TYPE_RINGBUF is a multi-producer, single-consumer queue. Multiple CPUs can run the same BPF program and reserve records in the shared ring. One user-space consumer drains records through libbpf. The BPF helpers provide the lifecycle: reserve, submit, discard, output, and query. The reserve path is the zero-copy path when the record size is known. The output helper is simpler for some dynamic records, but it copies from program memory into the ring.`,
        `The verifier is part of the data-structure contract. A program that reserves a record must submit or discard it on every path. The verifier tracks the reservation as a reference, so a leaked reservation is rejected when the program is loaded instead of becoming a runtime cleanup problem. In ordinary application code that might feel strict. In kernel code it is the reason this pattern can be exposed safely.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `The reserve-submit visual proves that correctness is not just a byte layout. It is a lifecycle. A record should be invisible while it is being filled, visible after submit, and impossible to leak because the verifier requires every reservation to close. The occupied slots in the matrix show that different CPUs can own different parts of the ring at the same time, but the consumer sees only records that crossed the publish boundary.`,
        `The pipeline visual proves a second point: telemetry has many places to lose or distort data. Kernel filters can skip events, the ring can fill, the poller can fall behind, user-space queues can drop, redaction can remove fields, and exporters can fail. The ring buffer is the first transport step, not the whole observability system. A trustworthy design counts drops at each boundary and keeps record schemas stable enough to decode during rolling upgrades.`,
      ],
    },
    {
      heading: `Case study: syscall monitor`,
      paragraphs: [
        `Suppose a platform team wants to monitor suspicious openat calls. The BPF program attaches to a syscall tracepoint. It reads a bounded path, filters obvious noise, reserves a compact record, writes timestamp, pid, tgid, command, event id, return code, and path prefix, then submits. If reserve returns null because the ring is full, the program increments a per-CPU drop counter and returns immediately.`,
        `A user-space daemon polls the ring, decodes versioned records, batches them, redacts paths that match policy, and exports the result through an OpenTelemetry Collector. Metrics show event rate, ring drops, decode errors, and export drops. Logs keep selected examples. Traces or exemplars connect incidents to specific processes. The system is useful because the hot path is bounded and every missing-event path has a counter.`,
      ],
    },
    {
      heading: `Why it works`,
      paragraphs: [
        `The ring buffer works because it separates production from consumption without pretending the consumer is always fast enough. Producers do a small amount of bounded work: reserve, write, publish, or drop. The consumer does heavier work later: decode, batch, enrich, redact, and export. That split keeps kernel hooks fast while still giving user space a high-volume stream.`,
        `The shared ring also addresses two pain points from older perf-buffer designs. A single ring can reduce per-CPU memory overhead and preserve cross-CPU event order better than independent per-CPU buffers. It does not create perfect truth, because timestamps, scheduling, lost records, and batching still matter. It does give a cleaner order for the records that were actually published.`,
      ],
    },
    {
      heading: `Cost and behavior`,
      paragraphs: [
        `The main cost is loss under sustained overload. Ring size, record size, producer rate, poll cadence, batch size, and downstream exporter health decide whether the buffer absorbs bursts or fills. Making the ring larger can absorb spikes but consumes memory and may hide a slow consumer. Making records smaller improves throughput but may remove context that analysts need. Sharding rings by event class can reduce contention but complicates ordering and joins.`,
        `The zero-copy reserve path is not always the simplest path. If the record size is hard to know before copying data, output may be easier. If the tool needs durable audit logs, the ring is only the ingress path; user space must persist selected events elsewhere. If privacy policy forbids raw arguments, redaction must happen before records leave trusted boundaries.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `The pattern wins for high-rate, low-latency telemetry where each event can be summarized in a compact schema. System-call monitors, network flow samplers, scheduler profilers, security sensors, container observability agents, and latency probes all fit. The record should be small, quickly computed, and useful without blocking the thing being observed.`,
        `It also wins when global event order matters. A security investigation may need to know whether a process opened a file before it made a network connection, even if those hooks ran on different CPUs. A shared ring cannot solve every clock problem, but it makes the transport less likely to reorder published records across producers.`,
      ],
    },
    {
      heading: `Where it fails`,
      paragraphs: [
        `The first failure mode is silent loss. If the program drops when the ring is full but nobody exports the drop counter, the dashboard lies. The second is schema drift. A poller compiled for one record layout may decode garbage after a rolling update unless records carry event ids and versions. The third is oversized payloads. One rare giant record can waste space and increase drop probability for many normal events.`,
        `Privacy is another failure mode. Paths, arguments, packet bytes, and process names can contain secrets. A good design has a record contract, redaction rules, sampling rules, and access controls before data enters the shared observability backend. Finally, do not treat the ring as durable storage. It is a transport. If the consumer crashes, unconsumed records may be gone.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Primary sources are the Linux kernel BPF ring buffer documentation at https://www.kernel.org/doc/html/latest/bpf/ringbuf.html, the BPF_MAP_TYPE_RINGBUF reference at https://docs.ebpf.io/linux/map-type/BPF_MAP_TYPE_RINGBUF/, helper references for bpf_ringbuf_reserve, bpf_ringbuf_submit, and bpf_ringbuf_discard, and the libbpf ring_buffer__new reference at https://docs.ebpf.io/ebpf-library/libbpf/userspace/ring_buffer__new/.`,
        `Study Ring Buffer for the base circular-queue mechanics, eBPF Verifier Register State Case Study for load-time proof, io_uring Submission and Completion Rings for another kernel-user ring pair, NIC RX Ring and NAPI Poll Case Study for packet receive backpressure, Cilium eBPF Datapath Case Study for production BPF use, OpenTelemetry Collector Case Study for export, Metric Label Cardinality Control for downstream cost, and Backpressure and Flow Control for the overload model.`,
      ],
    },
      {
      heading: 'The wall',
      paragraphs: [
        "Every topic in this pattern has a hard boundary where a tempting shortcut fails; define that boundary first.",
        "State the exact invariant that must hold, show one operation sequence that can break it, and explain what changes after a failure and why.",
        "If you can reproduce this wall in one example, the rest of the page is motivated.",
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
        heading: 'Sources and study next',
        paragraphs: [
          'Read one primary source, one implementation source, and one production case where this idea appears.',
          'If they disagree on a detail, prefer the source with the clearest constraint and define the simplification for this animation.',
          'Then choose three study topics: one prerequisite, one extension, and one case study for your next session.',
        ],
      },

      {
        heading: 'Learning map',
        paragraphs: [
          'Before this topic, unlock all prerequisites and define the required preconditions.',
          'After this topic, trace where this idea appears in one larger path on this site.',
          'Use unlock relationships to keep one path and one checkpoint per review cycle.',
        ],
      },

      {
        heading: 'Micro checks',
        paragraphs: [
          {
            type: 'bullets',
            items: [
              'Can you state one invariant in one sentence?',
              'Can you prove one transition with pre and post state?',
              'Can you name one hidden edge case in one line?',
              'Can you transfer this mechanism to a neighboring domain?',
            ],
          },
        ],
      },

      {
        heading: 'Try this now',
        paragraphs: [
          'Build one input manually and predict every step before running the animation.',
          'If your predicted final state matches the animation for ebpf-ring-buffer-telemetry-case-study, continue to the next topic in the same track.'
  ],
      },
],
};

