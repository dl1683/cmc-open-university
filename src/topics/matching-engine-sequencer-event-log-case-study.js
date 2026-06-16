// Matching engines are deterministic state machines: a sequencer assigns one
// total order to accepted commands before book mutation and publication.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'matching-engine-sequencer-event-log-case-study',
  title: 'Matching Engine Sequencer Event Log Case Study',
  category: 'Systems',
  summary: 'A trading-systems case study: order gateway ingress, deterministic sequencers, event logs, matching state machines, execution reports, market-data publication, replay, and recovery.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['sequencer log', 'replay recovery'], defaultValue: 'sequencer log' },
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

function engineGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'gateway', label: 'gateway', x: 0.8, y: 3.2, note: 'OUCH/FIX' },
      { id: 'risk', label: 'risk', x: 2.2, y: 1.6, note: notes.risk || 'gate' },
      { id: 'seq', label: 'sequencer', x: 3.7, y: 3.2, note: notes.seq || 'seq' },
      { id: 'log', label: 'event log', x: 3.7, y: 5.4, note: 'append' },
      { id: 'match', label: 'match', x: 5.3, y: 3.2, note: notes.match || 'state' },
      { id: 'book', label: 'book', x: 6.9, y: 1.8, note: 'mutate' },
      { id: 'exec', label: 'exec rpt', x: 6.9, y: 4.8, note: 'client' },
      { id: 'md', label: 'market data', x: 8.6, y: 3.2, note: 'publish' },
    ],
    edges: [
      { id: 'e-gateway-risk', from: 'gateway', to: 'risk', weight: 'check' },
      { id: 'e-risk-seq', from: 'risk', to: 'seq', weight: 'accept' },
      { id: 'e-seq-log', from: 'seq', to: 'log', weight: 'append' },
      { id: 'e-seq-match', from: 'seq', to: 'match', weight: 'ordered' },
      { id: 'e-match-book', from: 'match', to: 'book', weight: 'apply' },
      { id: 'e-match-exec', from: 'match', to: 'exec', weight: 'fill/ack' },
      { id: 'e-book-md', from: 'book', to: 'md', weight: 'depth' },
      { id: 'e-exec-md', from: 'exec', to: 'md', weight: 'trade' },
    ],
  }, { title });
}

function* sequencerLog() {
  yield {
    state: engineGraph('Accepted commands enter one deterministic order'),
    highlight: { active: ['gateway', 'risk', 'seq'], found: ['log', 'match'], compare: ['md'] },
    explanation: 'A matching engine cannot let two gateways race the same book. Accepted commands pass through a sequencer that assigns one total order before the book is mutated.',
    invariant: 'Book state is a pure replay of sequenced accepted commands plus deterministic matching rules.',
  };

  yield {
    state: labelMatrix(
      'Sequenced event log',
      [
        { id: 's101', label: '101' },
        { id: 's102', label: '102' },
        { id: 's103', label: '103' },
        { id: 's104', label: '104' },
      ],
      [
        { id: 'cmd', label: 'cmd' },
        { id: 'order', label: 'order' },
        { id: 'effect', label: 'effect' },
      ],
      [
        ['add', 'o17', 'post bid'],
        ['add', 'o31', 'post ask'],
        ['buy', 'o44', 'fill o31'],
        ['cancel', 'o17', 'remove'],
      ],
    ),
    highlight: { active: ['s101:cmd', 's102:cmd', 's103:cmd'], found: ['s103:effect'], compare: ['s104:effect'] },
    explanation: 'The event log is the audit spine. It explains why a book state exists and lets downstream systems replay, reconcile, and recover.',
  };

  yield {
    state: engineGraph('One command can emit multiple ordered outputs', { match: 'fills', seq: '103' }),
    highlight: { active: ['match', 'book', 'exec', 'md'], compare: ['log'], found: ['e-match-exec', 'e-book-md'] },
    explanation: 'One incoming order can produce an acknowledgment, several fills, a trade print, and book-depth updates. Output streams still need sequence and correlation back to the triggering command.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'stage', min: 0, max: 5 }, y: { label: 'us', min: 0, max: 80 } },
      series: [
        { id: 'lat', label: 'lat', points: [{ x: 0, y: 4 }, { x: 1, y: 12 }, { x: 2, y: 21 }, { x: 3, y: 34 }, { x: 4, y: 46 }] },
        { id: 'budget', label: 'budget', points: [{ x: 0, y: 15 }, { x: 1, y: 25 }, { x: 2, y: 35 }, { x: 3, y: 50 }, { x: 4, y: 70 }] },
      ],
      markers: [
        { id: 'seqp', label: 'seq', x: 2, y: 21 },
        { id: 'pub', label: 'pub', x: 4, y: 46 },
      ],
    }, { title: 'Latency budget follows the event path' }),
    highlight: { active: ['lat'], compare: ['budget'], found: ['seqp', 'pub'] },
    explanation: 'Low latency does not remove the need for ordering. The design goal is predictable, deterministic sequencing with bounded work in each stage.',
  };
}

function* replayRecovery() {
  yield {
    state: engineGraph('Recovery starts from snapshot plus log suffix', { seq: 'resume', match: 'replay' }),
    highlight: { active: ['log', 'match', 'book'], compare: ['gateway'], found: ['md'] },
    explanation: 'A warm standby or restart can load a book snapshot, replay every sequenced command after the snapshot, and reach the same state if the engine is deterministic.',
    invariant: 'Snapshots are only valid when they record the exact last sequence number included.',
  };

  yield {
    state: labelMatrix(
      'Recovery ledger',
      [
        { id: 'snap', label: 'snapshot' },
        { id: 'suffix', label: 'suffix' },
        { id: 'checksum', label: 'hash' },
        { id: 'publish', label: 'publish' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['book @100', 'stale'],
        ['101..now', 'gap'],
        ['state digest', 'drift'],
        ['resume seq', 'duplicate'],
      ],
    ),
    highlight: { active: ['snap:stores', 'suffix:stores'], found: ['checksum:risk', 'publish:risk'] },
    explanation: 'Replay needs more than bytes. It needs sequence boundaries, gap detection, state checksums, and output de-duplication rules.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'events replayed', min: 0, max: 1000000 }, y: { label: 'seconds', min: 0, max: 20 } },
      series: [
        { id: 'withSnap', label: 'snap', points: [{ x: 10000, y: 0.2 }, { x: 100000, y: 1.1 }, { x: 500000, y: 5.2 }, { x: 1000000, y: 10.5 }] },
        { id: 'fromZero', label: 'zero', points: [{ x: 10000, y: 1.0 }, { x: 100000, y: 5.8 }, { x: 500000, y: 15.5 }, { x: 1000000, y: 20 }] },
      ],
      markers: [
        { id: 'cut', label: 'snap', x: 100000, y: 1.1 },
        { id: 'slow', label: 'slow', x: 500000, y: 15.5 },
      ],
    }, { title: 'Snapshots bound replay time' }),
    highlight: { active: ['withSnap'], compare: ['fromZero'], found: ['cut', 'slow'] },
    explanation: 'The log is the source of truth, but replaying from genesis is too slow. Periodic snapshots turn recovery into snapshot load plus suffix replay.',
  };

  yield {
    state: labelMatrix(
      'Determinism checklist',
      [
        { id: 'time', label: 'time' },
        { id: 'random', label: 'random' },
        { id: 'io', label: 'IO' },
        { id: 'rules', label: 'rules' },
      ],
      [
        { id: 'control', label: 'control' },
        { id: 'failure', label: 'failure' },
      ],
      [
        ['sequence clock', 'wall clock'],
        ['seeded/none', 'nondet'],
        ['after commit', 'side effect'],
        ['versioned', 'drift'],
      ],
    ),
    highlight: { active: ['time:control', 'rules:control'], compare: ['io:failure'], found: ['random:control'] },
    explanation: 'Replay only works when matching is deterministic. Wall-clock reads, random tie breaks, unsequenced IO, and unversioned rules break recovery.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'sequencer log') yield* sequencerLog();
  else if (view === 'replay recovery') yield* replayRecovery();
  else throw new InputError('Pick a matching-engine view.');
}

export const article = {
  references: [
    { title: 'Nasdaq OUCH 5.0 Order Entry Specification', url: 'https://www.nasdaqtrader.com/content/technicalsupport/specifications/TradingProducts/OUCH5.0.pdf' },
    { title: 'FIXimate ExecutionReport', url: 'https://fiximate.fixtrading.org/legacy/en/FIX.5.0SP2/body_5756.html' },
    { title: 'Nasdaq TotalView-ITCH 5.0 Specification', url: 'https://www.nasdaqtrader.com/content/technicalsupport/specifications/dataproducts/NQTVITCHSpecification.pdf' },
  ],
  sections: [
    { heading: 'What it is', paragraphs: ['A matching engine is a deterministic state machine that accepts ordered commands, mutates an order book, and emits execution and market-data events. The sequencer is the component that prevents concurrent gateways from creating ambiguous order.', 'The key data structures are command queues, sequence counters, append-only event logs, book snapshots, output correlation ids, and replay checksums.'] },
    { heading: 'How it works', paragraphs: ['Order entry messages enter through gateways and risk checks. Accepted commands receive a sequence number. The matcher applies each command to the book in sequence, emits execution reports to participants, and publishes market-data updates.', 'Recovery uses snapshots and log suffixes. A standby loads a snapshot at sequence N, replays commands N+1 onward, verifies state checksums, and resumes publication from a known boundary.'] },
    { heading: 'Cost and complexity', paragraphs: ['The engine must do bounded work per event. Every allocation, lock, branch, and network handoff can affect tail latency. But determinism and auditability are non-negotiable, so the speed path still needs explicit sequence and replay state.', 'Output streams complicate the design because one input can produce several fills, cancels, acknowledgments, and depth updates. Those outputs must be correlated without changing the command order.'] },
    { heading: 'Complete case study', paragraphs: ['Two clients submit crossing orders at nearly the same time. The gateway validates both, the sequencer assigns 102 then 103, and the matcher applies exactly that order. Event 103 consumes resting liquidity, updates the book, emits fills, and publishes depth changes.', 'A warm standby misses the live mutation. It loads the last snapshot, replays events 101 through 103, verifies the book checksum, and resumes from sequence 104 without duplicating market data.'] },
    { heading: 'Pitfalls', paragraphs: ['Do not let wall-clock time decide a tie inside the matcher. Use sequence numbers. Do not publish events that cannot be replayed back to a book state. Do not take snapshots without recording the exact included sequence.', 'Another trap is separating order-entry acks, execution reports, and market data so far that they cannot be reconciled. They are different views of one ordered mutation stream.'] },
    { heading: 'Sources and study next', paragraphs: ['Primary sources: Nasdaq OUCH 5.0 at https://www.nasdaqtrader.com/content/technicalsupport/specifications/TradingProducts/OUCH5.0.pdf, FIXimate ExecutionReport at https://fiximate.fixtrading.org/legacy/en/FIX.5.0SP2/body_5756.html, and Nasdaq TotalView-ITCH at https://www.nasdaqtrader.com/content/technicalsupport/specifications/dataproducts/NQTVITCHSpecification.pdf. Study Limit Order Book Price-Time Priority Case Study, ITCH Market Data Book Reconstruction Case Study, Write-Ahead Log, Raft Log Replication, and Idempotency next.'] },
  ],
};
