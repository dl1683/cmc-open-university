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
    { heading: 'How to read the animation', paragraphs: [
        'Read each rank as one process participating in the same distributed training job. Active nodes show the current collective call, trace-buffer write, timeout trigger, dump file, or analyzer comparison.',
        'NCCL is NVIDIA Collective Communications Library, and a collective is an operation such as all-reduce where all participating ranks must enter compatible calls in the same order. The safe inference rule is that the first mismatch in per-rank collective history is the best starting point for debugging a desync.',
        {type:'callout', text:'Flight recorder turns a frozen distributed job into comparable per-rank event history, so desync becomes a structured diff instead of a guess.'},
      ],
    },
    { heading: 'Why this exists', paragraphs: [
        'Distributed training failures are expensive because one stuck collective can freeze hundreds or thousands of accelerators. The visible symptom may be only a timeout, while the cause may be a data-dependent branch, uneven dataloader shard, checkpoint path, or process-group mismatch.',
        'PyTorch NCCL flight recorder exists to preserve recent collective history before the job dies. It gives engineers per-rank evidence instead of forcing them to infer the cause from the last Python log line.',
      ],
    },
    { heading: 'The obvious approach', paragraphs: [
        'The obvious debugging approach is to inspect logs and ask which rank printed last. That can help for ordinary exceptions, but collective hangs often stop far away from the branch that caused the schedule to diverge.',
        'Another obvious approach is to enable diagnostics after the hang appears. That is often too late because the useful evidence had to be recorded before the timeout froze the job.',
      ],
    },
    { heading: 'The wall', paragraphs: [
        'The wall is that waiting looks like slowness. If ranks 0 and 1 are waiting inside all-reduce while rank 2 skipped ahead to all-gather, the symptom can resemble a network stall even though the program order is broken.',
        'The second wall is retention. Flight recorder is a bounded circular buffer, so a buffer that is disabled or too small may overwrite the divergence window and preserve only the timeout aftermath.',
      ],
    },
    { heading: 'The core insight', paragraphs: [
        'The core insight is to treat collective calls as comparable events in per-rank logs. Each event records enough metadata to align ranks: process group, sequence id, operation type, tensor shape, dtype, state, timing, and optional stack frames.',
        'A desync becomes a structured diff. If rank 0 is at all-reduce sequence 42 and rank 2 is at all-gather sequence 43, the first question is which source path let rank 2 make a different collective call.',
      ],
    },
    { heading: 'How it works', paragraphs: [
        'The job enables a trace buffer through ProcessGroupNCCL settings before launch. As NCCL-related work occurs, each rank writes recent events into an in-memory circular buffer with bounded capacity.',
        'On timeout or explicit dump, the buffers are written to files, usually one per rank. An analyzer reads the dumps, aligns events by process group and sequence, and searches for the earliest place where histories stop agreeing.',
      ],
    },
    { heading: 'Why it works', paragraphs: [
        'The correctness argument comes from the collective contract. For a given process group, correct distributed code creates the same ordered sequence of compatible collective operations on every participating rank.',
        'Ranks do not need identical timing, but they do need compatible order, shapes, dtypes, and membership. The first incompatible event marks the boundary between protocol agreement and divergence, which narrows the search window for root cause.',
      ],
    },
    { heading: 'Cost and complexity', paragraphs: [
        'The costs are memory, runtime overhead, artifact volume, and launch discipline. A buffer with 100000 events per rank across 256 ranks can preserve much more history than a 1000-event buffer, but it also consumes more memory and creates more dump data.',
        'Optional timing and stack capture improve diagnosis but add overhead. The operational cost is deciding dump paths, naming conventions, retention, and privacy rules before the rare failure happens.',
      ],
    },
    { heading: 'Real-world uses', paragraphs: [
        'Flight recorder is useful for long-running training jobs, multi-node fine-tuning, distributed evaluation, checkpoint or validation branches, uneven input pipelines, and process-group-heavy model parallelism. These are settings where a rare hang can waste a large accelerator allocation.',
        'It also gives incident responders a common artifact. Instead of comparing screenshots from different nodes, they can inspect per-rank event histories and tie a mismatch back to code and runtime metrics.',
      ],
    },
    { heading: 'Where it fails', paragraphs: [
        'It fails when it was not enabled, when the buffer is too small, when the job exits before dump files are written, or when dumps from some ranks are missing. A missing rank file is a data-collection problem, not proof that the rank behaved correctly.',
        'It also does not prove root cause by itself. A mismatch can come from uneven data, exception handling, bad conditional logic, resource pressure, real network failure, or an analyzer assumption, so the trace must be paired with logs, metrics, and source inspection.',
      ],
    },
    { heading: 'Worked example', paragraphs: [
        'Suppose 4 ranks train with one process group. For steps 1 through 41, every rank records all-reduce with the same sequence id, shape 67108864 floats, and dtype float16.',
        'At sequence 42, ranks 0, 1, and 3 record all-reduce shape 67108864, while rank 2 records all-gather shape 16777216. If the timeout is 600 seconds, the waiting ranks may show 600 seconds of delay, but the mismatch itself is the operation type at sequence 42.',
        'The engineer then checks the stack frame or nearby application logs for rank 2. A common cause is an if branch where rank 2 entered validation or checkpoint code while the other ranks stayed in the training all-reduce path.',
      ],
    },
    { heading: 'Sources and study next', paragraphs: [
        'Primary sources: PyTorch Flight Recorder tutorial at https://docs.pytorch.org/tutorials/unstable/flight_recorder_tutorial.html, PyTorch ProcessGroupNCCL environment variables at https://docs.pytorch.org/docs/stable/torch_nccl_environment_variables.html, and NVIDIA NCCL debug environment variables at https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/env.html.',
        'Study GPU all-reduce, PyTorch distributed process groups, NCCL group ordering, distributed tracing, OpenTelemetry collectors, runbook automation, dataloader sharding, and topology-aware collective placement next. The shared idea is turning a hang into aligned event histories.',
      ],
    },
  ],
};
