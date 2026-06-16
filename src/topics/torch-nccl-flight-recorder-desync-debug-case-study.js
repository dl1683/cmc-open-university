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
    explanation: 'Flight recorder captures diagnostic information as collectives run. The important data structure is an in-memory circular buffer per rank, so recent collective events survive long enough to diagnose a stuck job.',
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
    explanation: 'A classic failure is collective desynchronization. R0 and R1 enter one all-reduce while R2 has already moved to all-gather. The cluster waits because the rendezvous contract is broken.',
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
    { heading: 'What it is', paragraphs: ['PyTorch NCCL flight recorder is a diagnostic tool for stuck distributed training jobs. It records recent collective events into per-rank circular buffers and can dump them on timeout for analysis.', 'This topic belongs after GPU All-Reduce and NCCL Selector because it teaches the operational data structures that make collective hangs diagnosable: event buffers, fingerprints, per-rank files, timeout triggers, and analyzer heuristics.'] },
    { heading: 'Data structures', paragraphs: ['The core records are rank ID, process group, sequence number, collective type, tensor shape, start/end timing, optional C++ stack trace, timeout state, dump path, and analyzer result.', 'PyTorch documents TORCH_NCCL_TRACE_BUFFER_SIZE as enabling an internal circular buffer, TORCH_NCCL_DUMP_ON_TIMEOUT as writing diagnostics on timeout, TORCH_FR_DUMP_TEMP_FILE as the dump prefix, and optional stack/timing settings.'] },
    { heading: 'How it works', paragraphs: ['Each rank logs collective events while training runs. If the job times out or an operator requests a dump, the in-memory buffers are written out, commonly one file per rank.', 'The analyzer compares event histories to find mismatched collectives, missing ranks, long waits, resource starvation, network issues, or software bugs. It narrows the investigation from a frozen cluster to a concrete event sequence.'] },
    { heading: 'Complete case study', paragraphs: ['A training job hangs after an hour. With flight recorder enabled, timeout dumps show rank 2 entered an all-gather while ranks 0 and 1 waited in an all-reduce. The stack trace points to a branch that only ran on batches with empty examples.', 'The team fixes the branch so all ranks call collectives in the same order, adds a shape assertion before the collective, and keeps trace buffers enabled in long jobs where the small overhead is worth the diagnostic value.'] },
    { heading: 'Pitfalls', paragraphs: ['Do not enable diagnostics after the hang and expect history to appear. The circular buffer must be collecting before the failure. Also avoid dumping every trace forever without retention; per-rank files can become noisy on large jobs.', 'Another trap is assuming every stuck job is a network problem. PyTorch lists data starvation, resource constraints, network issues, software bugs, and synchronization failures as possible causes. The trace is evidence, not a replacement for root-cause analysis.'] },
    { heading: 'Sources and study next', paragraphs: ['Primary sources: PyTorch Flight Recorder tutorial at https://docs.pytorch.org/tutorials/unstable/flight_recorder_tutorial.html, PyTorch ProcessGroupNCCL environment variables at https://docs.pytorch.org/docs/stable/torch_nccl_environment_variables.html, and NCCL debug variables at https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/env.html. Study GPU All-Reduce, NCCL Selector, Distributed Tracing, OpenTelemetry Collector, and Runbook Automation next.'] },
  ],
};
