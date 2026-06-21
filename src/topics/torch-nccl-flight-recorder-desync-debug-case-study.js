// PyTorch's NCCL flight recorder turns stuck collectives into trace data:
// circular per-rank buffers, timeout dumps, stack capture, and analyzer triage.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'torch-nccl-flight-recorder-desync-debug-case-study',
  title: 'Torch NCCL Flight Recorder Desync Debug Case Study',
  category: 'Systems',
  summary: 'Debug stuck distributed training jobs with per-rank NCCL trace buffers, timeout dumps, collective fingerprints, desync clues, timing, and analyzer heuristics.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['trace buffer', 'desync triage'], defaultValue: 'trace buffer' },
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

function recorderGraph(title) {
  return graphState({
    nodes: [
      { id: 'r0', label: 'R0', x: 0.8, y: 1.5, note: 'rank' },
      { id: 'r1', label: 'R1', x: 0.8, y: 3.3, note: 'rank' },
      { id: 'r2', label: 'R2', x: 0.8, y: 5.1, note: 'rank' },
      { id: 'buf0', label: 'buf0', x: 2.8, y: 1.5, note: 'ring' },
      { id: 'buf1', label: 'buf1', x: 2.8, y: 3.3, note: 'ring' },
      { id: 'buf2', label: 'buf2', x: 2.8, y: 5.1, note: 'ring' },
      { id: 'timeout', label: 'timeout', x: 4.9, y: 3.3, note: 'watch' },
      { id: 'files', label: 'files', x: 6.7, y: 3.3, note: 'dump' },
      { id: 'analyze', label: 'analyze', x: 8.5, y: 3.3, note: 'root' },
    ],
    edges: [
      { id: 'e-r0-b0', from: 'r0', to: 'buf0', weight: 'events' },
      { id: 'e-r1-b1', from: 'r1', to: 'buf1', weight: 'events' },
      { id: 'e-r2-b2', from: 'r2', to: 'buf2', weight: 'events' },
      { id: 'e-b0-time', from: 'buf0', to: 'timeout' },
      { id: 'e-b1-time', from: 'buf1', to: 'timeout' },
      { id: 'e-b2-time', from: 'buf2', to: 'timeout' },
      { id: 'e-time-files', from: 'timeout', to: 'files', weight: 'dump' },
      { id: 'e-files-analyze', from: 'files', to: 'analyze', weight: 'heur' },
    ],
  }, { title });
}

function desyncGraph(title) {
  return graphState({
    nodes: [
      { id: 'seq42', label: 'op42', x: 1.0, y: 2.3, note: 'AR' },
      { id: 'seq43', label: 'op43', x: 1.0, y: 4.5, note: 'AG' },
      { id: 'r0', label: 'R0', x: 3.0, y: 1.7, note: 'AR' },
      { id: 'r1', label: 'R1', x: 3.0, y: 3.4, note: 'AR' },
      { id: 'r2', label: 'R2', x: 3.0, y: 5.1, note: 'AG' },
      { id: 'finger', label: 'finger', x: 5.2, y: 3.4, note: 'match' },
      { id: 'culprit', label: 'culprit', x: 7.2, y: 5.1, note: 'R2' },
      { id: 'fix', label: 'fix', x: 8.7, y: 3.4, note: 'code' },
    ],
    edges: [
      { id: 'e-42-r0', from: 'seq42', to: 'r0' },
      { id: 'e-42-r1', from: 'seq42', to: 'r1' },
      { id: 'e-43-r2', from: 'seq43', to: 'r2' },
      { id: 'e-r0-finger', from: 'r0', to: 'finger' },
      { id: 'e-r1-finger', from: 'r1', to: 'finger' },
      { id: 'e-r2-finger', from: 'r2', to: 'finger' },
      { id: 'e-finger-culprit', from: 'finger', to: 'culprit' },
      { id: 'e-culprit-fix', from: 'culprit', to: 'fix' },
    ],
  }, { title });
}

function* traceBuffer() {
  yield {
    state: recorderGraph('Each rank writes collective events into a circular buffer'),
    highlight: { active: ['r0', 'r1', 'r2', 'buf0', 'buf1', 'buf2', 'e-r0-b0', 'e-r1-b1', 'e-r2-b2'] },
    explanation: 'Each rank writes to its own recent-history buffer. Flight recorder captures collective events while the job is still running, so the last useful sequence survives long enough to diagnose a stuck job.',
    invariant: 'The buffer has to be enabled before the hang; after a deadlock, missing history is usually gone forever.',
  };

  yield {
    state: labelMatrix(
      'Recorder settings',
      [
        { id: 'buf', label: '' },
        { id: 'dump', label: 'dump' },
        { id: 'path', label: 'path' },
        { id: 'stack', label: 'stack' },
        { id: 'time', label: 'time' },
      ],
      [
        { id: 'env', label: 'env' },
        { id: 'role', label: 'role' },
      ],
      [
        ['TBUF', 'collect'],
        ['DUMP', 'write'],
        ['FILE', 'where'],
        ['STACK', 'code'],
        ['TIME', 'dur'],
      ],
    ),
    highlight: { active: ['buf:role', 'dump:role', 'path:role'], compare: ['stack:role', 'time:role'] },
    explanation: 'PyTorch documents settings for trace buffer size, timeout dumps, output path, optional C++ stack capture, and optional timing. Those settings turn a silent hang into per-rank evidence files.',
  };

  yield {
    state: recorderGraph('Timeout dumps one trace file per rank'),
    highlight: { active: ['timeout', 'files', 'e-time-files'], found: ['buf0', 'buf1', 'buf2'], compare: ['analyze'] },
    explanation: 'On timeout, the circular buffers can be dumped to disk. One file per rank is useful because collective bugs are often asymmetric: one rank skipped a call, called the wrong op, or used a different tensor shape.',
  };

  yield {
    state: recorderGraph('Analyzer heuristics convert traces into suspects'),
    highlight: { active: ['files', 'analyze', 'e-files-analyze'], found: ['r0', 'r1', 'r2'], compare: ['timeout'] },
    explanation: 'The analyzer can use known heuristics over collected events. The goal is not to prove the whole program correct; it is to narrow a stuck job to the likely rank, op, code path, or resource failure.',
  };
}

function* desyncTriage() {
  yield {
    state: desyncGraph('Desync means ranks are no longer entering the same collective'),
    highlight: { active: ['r0', 'r1', 'r2', 'seq42', 'seq43'], compare: ['finger'] },
    explanation: 'The sequence nodes are the shared collective order every rank is supposed to follow. R0 and R1 are still at one all-reduce while R2 has moved to all-gather, so the rendezvous contract is broken.',
  };

  yield {
    state: labelMatrix(
      'Collective fingerprint',
      [
        { id: 'op', label: 'op' },
        { id: 'seq', label: 'seq' },
        { id: 'shape', label: 'shape' },
        { id: 'rank', label: 'rank' },
      ],
      [
        { id: 'good', label: 'match' },
        { id: 'bad', label: 'bad' },
      ],
      [
        ['AR', 'AG'],
        ['42', '43'],
        ['64MB', '32MB'],
        ['0,1', '2'],
      ],
    ),
    highlight: { active: ['op:bad', 'seq:bad', 'shape:bad', 'rank:bad'] },
    explanation: 'The fingerprint compares operation type, sequence number, tensor shape, datatype, and rank participation. A mismatch usually points to control-flow divergence or uneven data pipeline behavior.',
  };

  yield {
    state: desyncGraph('The suspect rank gets tied back to source code'),
    highlight: { active: ['finger', 'culprit', 'fix', 'e-finger-culprit', 'e-culprit-fix'], found: ['r2'] },
    explanation: 'C++ stack capture and Python-side logs help connect the bad collective event back to source code. The fix is usually in the training loop, conditional branch, dataloader, or checkpoint path.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'minute', min: 0, max: 30 }, y: { label: 'rank wait ms', min: 0, max: 1000 } },
      series: [
        { id: 'r0', label: 'R0', points: [{ x: 0, y: 20 }, { x: 10, y: 25 }, { x: 20, y: 900 }, { x: 30, y: 900 }] },
        { id: 'r1', label: 'R1', points: [{ x: 0, y: 18 }, { x: 10, y: 24 }, { x: 20, y: 880 }, { x: 30, y: 890 }] },
        { id: 'r2', label: 'R2', points: [{ x: 0, y: 22 }, { x: 10, y: 28 }, { x: 20, y: 55 }, { x: 30, y: 60 }] },
      ],
      markers: [
        { id: 'hang', x: 20, y: 900, label: 'hang' },
      ],
    }),
    highlight: { active: ['r0', 'r1', 'hang'], compare: ['r2'] },
    explanation: 'A wait-time plot makes the asymmetry visible. Some ranks wait at the old collective while the offending rank is elsewhere or has failed. The trace buffer supplies the missing event history.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'trace buffer') yield* traceBuffer();
  else if (view === 'desync triage') yield* desyncTriage();
  else throw new InputError('Pick a Torch NCCL flight-recorder view.');
}

export const article = {
  references: [
    { title: 'PyTorch Flight Recorder tutorial', url: 'https://docs.pytorch.org/tutorials/unstable/flight_recorder_tutorial.html' },
    { title: 'PyTorch ProcessGroupNCCL environment variables', url: 'https://docs.pytorch.org/docs/stable/torch_nccl_environment_variables.html' },
    { title: 'NVIDIA NCCL debug environment variables', url: 'https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/env.html' },
  ],
  sections: [
    {
      heading: 'Why This Exists',
      paragraphs: [
        'PyTorch NCCL flight recorder exists because distributed training failures are expensive and often silent. A single stuck collective can freeze hundreds or thousands of accelerators. The terminal may show only a timeout, the last Python log may be unrelated, and the visible symptom may look like a network failure even when the root cause is a data-dependent branch in the training loop.',
        'The hard part is that collective communication is a shared contract. Every rank must enter the same operation in the same order with compatible buffers. When that contract breaks, the final state is usually just "some ranks are waiting." Flight recorder preserves the recent collective history so the incident can be debugged from rank evidence instead of guesswork.',
        {type:'callout', text:'Flight recorder turns a frozen distributed job into comparable per-rank event history, so desync becomes a structured diff instead of a guess.'},
      ],
    },
    {
      heading: 'The Obvious Debugging Path And The Wall',
      paragraphs: [
        'The obvious response is to inspect logs and ask which rank printed last. That can help for ordinary exceptions, but collective hangs often stop progress far from the real cause. A rank may have skipped a collective because a dataloader produced an empty shard, a checkpoint path ran on only one process, or an error handling branch returned early. The last log line is usually a witness, not the crime scene.',
        'Another tempting response is to enable diagnostics after the hang appears. That is too late for the most useful evidence. Flight recorder is a circular buffer: it must be collecting while the job is still alive. If the buffer is disabled, or if it is too small and overwrites the divergence window, the sequence that explains the hang is gone.',
      ],
    },
    {
      heading: 'Core Insight',
      paragraphs: [
        'The core insight is to treat collective calls as events in per-rank logs. Each rank writes recent NCCL-related activity into an in-memory circular buffer. A timeout or explicit dump freezes those buffers into files, usually one per rank. The analyzer can then compare operation order, process group, sequence id, operation type, tensor shape, dtype, timing, and optional stack frames across ranks.',
        'That comparison turns "the job froze" into a structured diff. If ranks 0 and 1 are waiting at all-reduce sequence 42 while rank 2 already entered all-gather sequence 43, the network is not the first suspect. The rendezvous order diverged. The useful question becomes: what source path let rank 2 make a different collective call?',
        'This is the same idea as a black box recorder in a vehicle, but applied to a distributed protocol. The recorder does not need to store every tensor value. It needs enough metadata to reconstruct the collective schedule and compare rank histories. That keeps the artifact small enough to collect and rich enough to locate the first broken rendezvous.',
      ],
    },
    {
      heading: 'How The System Works',
      paragraphs: [
        'PyTorch documents flight recorder settings for enabling a trace buffer, dumping debug information on timeout, choosing a dump location or prefix, capturing optional C++ stack traces, and recording optional timing. The buffer stores a bounded number of events, so it gives recent history rather than an unbounded log. The bounded design is important: it keeps overhead controlled enough to use on long jobs where a rare hang may be the only failure worth catching.',
        'A useful event record usually includes the rank, process group, collective sequence, operation name, input and output sizes, dtypes, state, timeout information, and timestamps. Stack capture ties the low-level collective back to code. Timing fields reveal whether ranks are slow, waiting, or missing. Analyzer heuristics then search for the first place where rank histories stop agreeing.',
        'The analyzer step is easiest to use when dumps are collected into one directory and named consistently. Large jobs should decide that convention before launch. Otherwise the incident starts with artifact hunting: which node wrote files, which rank IDs are missing, whether the timeout handler exited before writes finished, and whether the run directory survived cleanup.',
      ],
    },
    {
      heading: 'What The Visual Proves',
      paragraphs: [
        'The trace-buffer view proves why the data structure has to be per rank. A collective bug is often asymmetric. One rank may skip a call while others wait, or one process group may be healthy while another is stuck. Separate buffers preserve those differences. The timeout node is not the root cause; it is the trigger that makes the recent history durable.',
        'The desync view proves the shape of the main failure. R0 and R1 are still at one all-reduce while R2 has moved to all-gather. The fingerprint table shows the fields that should line up across participants: operation type, sequence number, shape, dtype, and rank membership. The wait-time plot then explains why a desync can look like a slow network from the outside: waiting ranks accumulate delay while the offending rank is elsewhere or has already failed.',
      ],
    },
    {
      heading: 'Why The Method Works',
      paragraphs: [
        'Flight recorder works because collectives are ordered rendezvous points. The correct program creates comparable histories across ranks. They do not have to finish at the exact same nanosecond, but they should agree on the sequence of collective operations for a given process group. The first mismatch is therefore a strong lead. It marks the boundary between "all ranks were still following the protocol" and "at least one rank took a different path."',
        'The method is triage, not a proof of root cause. A mismatch can be caused by a skipped branch, data starvation, an exception path, resource pressure, timeout policy, or a real network issue. The trace narrows the search to a rank, operation, process group, and time window. The engineer still has to connect that evidence to code and system state.',
      ],
    },
    {
      heading: 'Costs And Tradeoffs',
      paragraphs: [
        'The main costs are overhead, retention, and operational discipline. Larger buffers keep more history but use more memory. Timing can add CUDA event overhead. Stack capture can be valuable but heavier than plain event capture. Dumping every rank can create many artifacts, especially on large jobs, so the team needs a place to store them and a habit of reading them.',
        'The tool can also mislead if treated as the only source of truth. A short buffer may preserve only the timeout aftermath, not the divergence. A missing dump may be a configuration problem rather than proof that nothing happened. Analyzer output is a lead, not a verdict. It should be paired with application logs, dataloader health, resource metrics, NCCL debug information, and source assertions around conditional collectives.',
      ],
    },
    {
      heading: 'Where It Wins And Where It Fails',
      paragraphs: [
        'Flight recorder wins in long-running distributed training jobs where hangs are rare, expensive, and hard to reproduce. It is especially useful for desyncs, uneven inputs, data-dependent branches, checkpoint or validation paths that run on only some ranks, and slow collectives where per-rank timing separates waiting from doing work. It also gives incident responders a common artifact instead of a stream of partial screenshots.',
        'It fails when it was not enabled, when the buffer is too small, when the job dies before a dump is written, or when the failure is outside the captured collective layer. It also cannot repair bad distributed program structure. The long-term fix is to make collective order explicit, assert shape and dtype before calls, handle uneven data intentionally, and keep process-group membership stable.',
      ],
    },
    {
      heading: 'Sources And Study Next',
      paragraphs: [
        'Primary sources: PyTorch Flight Recorder tutorial at https://docs.pytorch.org/tutorials/unstable/flight_recorder_tutorial.html, PyTorch ProcessGroupNCCL environment variables at https://docs.pytorch.org/docs/stable/torch_nccl_environment_variables.html, and NVIDIA NCCL debug environment variables at https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/env.html. Study GPU All-Reduce for the collective contract, Torch distributed process groups for membership, Distributed Tracing for cross-process event alignment, OpenTelemetry Collector for incident pipelines, Runbook Automation for response flow, and GPU Collective Topology Placement Planner for performance root cause analysis.',
      ],
    },
  ],
};
