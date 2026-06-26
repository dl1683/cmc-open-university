// Nonblocking progress guarantees: blocking, obstruction-free, lock-free, and
// wait-free describe who can be forced to wait, not whether code is fast.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'nonblocking-progress-guarantees-primer',
  title: 'Nonblocking Progress Guarantees Primer',
  category: 'Data Structures',
  summary: 'A concurrency primer: distinguish blocking, obstruction-free, lock-free, and wait-free progress under pauses, contention, and retries.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['progress ladder', 'contention case'], defaultValue: 'progress ladder' },
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
  return matrixState({
    title,
    rows,
    columns,
    values: labelsByRow.map((row) => row.map(code)),
    format: (value) => labels[value],
  });
}

function progressGraph(title, t2Note = 'running') {
  return graphState({
    nodes: [
      { id: 't1', label: 'T1', x: 0.8, y: 2.2, note: 'paused' },
      { id: 't2', label: 'T2', x: 0.8, y: 5.0, note: t2Note },
      { id: 'lock', label: 'lock', x: 3.0, y: 2.2, note: 'owner?' },
      { id: 'cas', label: 'CAS', x: 3.0, y: 5.0, note: 'retry' },
      { id: 'object', label: 'object', x: 5.2, y: 3.6, note: 'shared' },
      { id: 'done', label: 'done', x: 7.6, y: 3.6, note: 'return' },
    ],
    edges: [
      { id: 'e-t1-lock', from: 't1', to: 'lock' },
      { id: 'e-t2-cas', from: 't2', to: 'cas' },
      { id: 'e-lock-object', from: 'lock', to: 'object' },
      { id: 'e-cas-object', from: 'cas', to: 'object' },
      { id: 'e-object-done', from: 'object', to: 'done' },
    ],
  }, { title });
}

function* progressLadder() {
  const levels = 4;
  const dimensions = 2;
  const activePromises = ['lockfree:promise', 'waitfree:promise'];
  const risksHighlighted = ['blocking:risk', 'obfree:risk'];
  yield {
    state: labelMatrix(
      'Progress ladder',
      [
        { id: 'blocking', label: 'block' },
        { id: 'obfree', label: 'ob-free' },
        { id: 'lockfree', label: 'LF' },
        { id: 'waitfree', label: 'WF' },
      ],
      [
        { id: 'promise', label: 'promise' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['own', 'stall'],
        ['solo', 'live'],
        ['some', 'starv'],
        ['all', 'cost'],
      ],
    ),
    highlight: { active: activePromises, compare: risksHighlighted },
    explanation: `Progress terms describe what happens under pauses and contention across ${levels} guarantee levels and ${dimensions} dimensions (promise vs risk). They are liveness guarantees, not performance guarantees. ${activePromises.length} levels (LF and WF) are highlighted because their promises are strongest.`,
    invariant: `Safety says the answer is correct. Progress says some answer eventually happens — ${levels} rungs from blocking to wait-free.`,
  };

  const activeBlocking = ['t1', 'lock', 'e-t1-lock'];
  const removedBlocking = ['t2', 'done'];
  yield {
    state: progressGraph('A paused lock owner can block every waiter'),
    highlight: { active: activeBlocking, removed: removedBlocking },
    explanation: `Blocking code can be perfectly safe and still fail progress when a thread pauses while holding the lock. Here ${activeBlocking.length} elements (T1, lock, edge) are active while ${removedBlocking.length} elements (T2, done) are removed — T2 cannot complete.`,
  };

  const activeLF = ['t2', 'cas', 'object', 'done', 'e-t2-cas', 'e-cas-object', 'e-object-done'];
  const stalledThreads = ['t1'];
  yield {
    state: progressGraph('Lock-free code lets some thread finish'),
    highlight: { active: activeLF, compare: stalledThreads },
    explanation: `Lock-free means system-wide progress. ${activeLF.length} elements form T2's active path through CAS to done, while ${stalledThreads.length} thread (T1) is stalled. A specific unlucky thread may starve under contention.`,
  };

  const t2Note = 'bounded';
  const foundNodes = ['t2', 'done'];
  const comparedNodes = ['cas'];
  yield {
    state: progressGraph('Wait-free code bounds each operation', t2Note),
    highlight: { found: foundNodes, compare: comparedNodes },
    explanation: `Wait-free is stronger: every operation completes in a finite number of its own steps (T2 is marked "${t2Note}"), regardless of other thread speeds. ${foundNodes.length} nodes reached done state while ${comparedNodes.length} node (CAS) shows the retry mechanism is no longer unbounded.`,
  };

  const misconceptions = 4;
  const activeExamples = ['fastLock:truth', 'slowLF:truth'];
  const keyLesson = 'rt:lesson';
  yield {
    state: labelMatrix(
      'Do not read the words as speed claims',
      [
        { id: 'fastLock', label: 'fast lock' },
        { id: 'slowLF', label: 'slow LF' },
        { id: 'wf', label: 'WF algo' },
        { id: 'rt', label: 'real-time' },
      ],
      [
        { id: 'truth', label: 'truth' },
        { id: 'lesson', label: 'lesson' },
      ],
      [
        ['can be fastest', 'low contention'],
        ['can spin', 'retry cost'],
        ['can be heavy', 'bounded steps'],
        ['needs bounds', 'use WF'],
      ],
    ),
    highlight: { active: activeExamples, found: [keyLesson] },
    explanation: `A mutex can be faster than a lock-free structure when contention is low. ${misconceptions} rows debunk speed myths — ${activeExamples.length} truths are highlighted, and the key takeaway is ${keyLesson.split(':')[0]} (real-time): the progress guarantee matters when pauses, failures, priority inversion, or hard latency bounds dominate.`,
  };
}

function* contentionCase() {
  const seriesCount = 3;
  const maxContenders = 32;
  const maxLatency = 100;
  const lockAt32 = 95;
  const lfAt32 = 78;
  const wfAt32 = 42;
  yield {
    state: plotState({
      axes: { x: { label: 'contenders', min: 1, max: maxContenders }, y: { label: 'tail latency', min: 0, max: maxLatency } },
      series: [
        { id: 'lock', label: 'lock', points: [{ x: 1, y: 5 }, { x: 4, y: 15 }, { x: 8, y: 35 }, { x: 16, y: 70 }, { x: 32, y: lockAt32 }] },
        { id: 'lf', label: 'LF', points: [{ x: 1, y: 8 }, { x: 4, y: 18 }, { x: 8, y: 26 }, { x: 16, y: 44 }, { x: 32, y: lfAt32 }] },
        { id: 'wf', label: 'WF', points: [{ x: 1, y: 12 }, { x: 4, y: 18 }, { x: 8, y: 24 }, { x: 16, y: 31 }, { x: 32, y: wfAt32 }] },
      ],
    }),
    highlight: { active: ['lock', 'lf', 'wf'] },
    explanation: `This stylized curve compares ${seriesCount} strategies across 1 to ${maxContenders} contenders. At ${maxContenders} threads, lock tail latency reaches ${lockAt32}, LF reaches ${lfAt32}, and WF stays at ${wfAt32} — showing why wait-free targets bounded per-operation latency at extra implementation cost.`,
  };

  const casSteps = 4;
  const globalProgressStep = 'cas:progress';
  const retryStep = 'retry:progress';
  yield {
    state: labelMatrix(
      'CAS counter case',
      [
        { id: 'read', label: 'read x' },
        { id: 'calc', label: 'calc x+1' },
        { id: 'cas', label: 'CAS' },
        { id: 'retry', label: 'retry' },
      ],
      [
        { id: 'state', label: 'state' },
        { id: 'progress', label: 'progress' },
      ],
      [
        ['snapshot', 'private'],
        ['new value', 'private'],
        ['one winner', 'global'],
        ['losers loop', 'not per-thread'],
      ],
    ),
    highlight: { found: [globalProgressStep], compare: [retryStep] },
    explanation: `A CAS increment loop has ${casSteps} steps: read, calc, CAS, retry. It is lock-free because ${globalProgressStep.split(':')[0]} makes global progress each round. But ${retryStep.split(':')[0]} shows losers loop indefinitely, so the loop is not wait-free by itself.`,
  };

  const threadSlots = 2;
  const helperNodes = ['helper', 'apply'];
  const ackNodes = ['ack1', 'ack2'];
  const totalGraphNodes = 6;
  const totalGraphEdges = 5;
  yield {
    state: graphState({
      nodes: [
        { id: 'slot1', label: 'slot 1', x: 0.8, y: 2.4, note: 'T1 op' },
        { id: 'slot2', label: 'slot 2', x: 0.8, y: 4.8, note: 'T2 op' },
        { id: 'helper', label: 'helper', x: 3.0, y: 3.6, note: 'scan' },
        { id: 'apply', label: 'apply', x: 5.2, y: 3.6, note: 'finish' },
        { id: 'ack1', label: 'ack T1', x: 7.3, y: 2.4, note: 'done' },
        { id: 'ack2', label: 'ack T2', x: 7.3, y: 4.8, note: 'done' },
      ],
      edges: [
        { id: 'e-s1-helper', from: 'slot1', to: 'helper' },
        { id: 'e-s2-helper', from: 'slot2', to: 'helper' },
        { id: 'e-helper-apply', from: 'helper', to: 'apply' },
        { id: 'e-apply-ack1', from: 'apply', to: 'ack1' },
        { id: 'e-apply-ack2', from: 'apply', to: 'ack2' },
      ],
    }, { title: 'Wait-free designs often use helping' }),
    highlight: { active: helperNodes, found: ackNodes },
    explanation: `This ${totalGraphNodes}-node, ${totalGraphEdges}-edge graph shows how ${threadSlots} thread slots feed into ${helperNodes.length} helper stages (${helperNodes.join(' and ')}), producing ${ackNodes.length} acknowledgments. Threads help finish pending operations, so a slow owner does not prevent its operation from completing.`,
  };

  const workloadCount = 4;
  const activeWorkloads = ['rt:fit', 'metrics:fit'];
  const simpleCase = 'batch:fit';
  yield {
    state: labelMatrix(
      'Choosing the guarantee',
      [
        { id: 'kernel', label: 'kernel read' },
        { id: 'metrics', label: 'metrics' },
        { id: 'rt', label: 'RT audio' },
        { id: 'batch', label: 'batch job' },
      ],
      [
        { id: 'need', label: 'need' },
        { id: 'fit', label: 'fit' },
      ],
      [
        ['no stall', 'RCU/read path'],
        ['throughput', 'LF queue'],
        ['bounded time', 'wait-free ring'],
        ['simplicity', 'lock often ok'],
      ],
    ),
    highlight: { active: activeWorkloads, compare: [simpleCase] },
    explanation: `The right guarantee is workload-specific across ${workloadCount} scenarios. ${activeWorkloads.length} workloads (${activeWorkloads.map(w => w.split(':')[0]).join(', ')}) benefit from nonblocking fits, while ${simpleCase.split(':')[0]} may prefer a simple lock if it is easier to prove and fast enough.`,
  };

  const safetyConcerns = 4;
  const provenTopics = ['linear:topic', 'aba:topic', 'reclaim:topic'];
  const pendingTopic = 'order:topic';
  yield {
    state: labelMatrix(
      'Safety still required',
      [
        { id: 'linear', label: 'linearize' },
        { id: 'aba', label: 'ABA' },
        { id: 'reclaim', label: 'reclaim' },
        { id: 'order', label: 'ordering' },
      ],
      [
        { id: 'question', label: 'question' },
        { id: 'topic', label: 'topic' },
      ],
      [
        ['what order?', 'linearize'],
        ['same addr?', 'tagged ptr'],
        ['free when?', 'hazard/epoch'],
        ['seen when?', 'memory model'],
      ],
    ),
    highlight: { found: provenTopics, compare: [pendingTopic] },
    explanation: `Progress is only half the proof. A nonblocking object needs ${safetyConcerns} safety properties: ${provenTopics.length} are well-established (${provenTopics.map(t => t.split(':')[0]).join(', ')}), while ${pendingTopic.split(':')[0]} (memory model) is often the subtlest to get right.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'progress ladder') yield* progressLadder();
  else if (view === 'contention case') yield* contentionCase();
  else throw new InputError('Pick a progress-guarantee view.');
}

export const article = {
  sections: [
    { heading: 'How to read the animation', paragraphs: ['The progress ladder compares blocking, obstruction-free, lock-free, and wait-free algorithms. These words describe liveness, meaning whether operations can keep completing under pauses or contention. A paused thread is the stress case; active paths show work still moving, removed paths show blocked completion, and found nodes show operations that reached done.', {type: 'image', src: './assets/gifs/nonblocking-progress-guarantees-primer.gif', alt: 'Animated walkthrough of the nonblocking progress guarantees primer visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'}]},
    { heading: 'Why this exists', paragraphs: ['Concurrent code can return legal results and still stop moving. A mutex-protected queue can preserve FIFO order perfectly, but if the lock owner is paused, every waiter may be stuck. Progress guarantees name who can still finish, while safety only says whether the result is correct.', {type: 'callout', text: 'Safety asks whether the result is legal; progress asks whether some thread can still reach a result under pauses and contention.'}, {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/3/3d/Process_states.svg', alt: 'Process state diagram with running waiting and blocked states', caption: 'Process-state transitions make the stress case visible: runnable hardware does not help if the needed owner is blocked or paused. Source: Wikimedia Commons, CC BY-SA 3.0.'}]},
    { heading: 'The obvious approach', paragraphs: ['The obvious approach is a lock. Put shared state behind a mutex, let one thread enter the critical section, and make other threads wait. This is often the best engineering choice because locks are simple, fast under low contention, and easier to prove than many nonblocking structures.']},
    { heading: 'The wall', paragraphs: ['The wall is owner dependence. If a thread pauses while holding a lock, every thread that needs that lock can be unable to finish, even if the CPU has idle cores. Replacing the lock with compare-and-swap loops does not automatically give every thread progress because a caller can keep losing the race and retrying.']},
    { heading: 'The core insight', paragraphs: ['The core insight is to ask which operation is guaranteed to complete. Obstruction-free means a thread completes if it eventually runs alone, lock-free means the system as a whole keeps completing operations, and wait-free means every operation completes in a bounded number of its own steps. These are not speed labels.', {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/4f/KL_Intel_i7_die.jpg', alt: 'Processor die where atomic instructions execute in hardware', caption: 'CAS and other atomic primitives are hardware contracts, but the progress guarantee comes from the whole algorithm around them. Source: Wikimedia Commons, KL and Intel, public domain.'}]},
    { heading: 'How it works', paragraphs: ['A lock-free counter can read x, compute x + 1, and use compare-and-swap, or CAS, to install the new value only if x has not changed. If the CAS succeeds, one operation completed; if it fails, the caller rereads and retries. Wait-free designs often add helping, where threads publish operation descriptors and active threads finish pending work for one another.']},
    { heading: 'Why it works', paragraphs: ['The proof is about all possible schedules. Lock-free means no infinite execution can prevent every operation from completing; some operation must keep making progress. Wait-free strengthens the quantifier: if a thread keeps taking steps, its own operation must finish within a finite bound regardless of other thread speeds.']},
    { heading: 'Cost and complexity', paragraphs: ['Stronger progress usually costs more machinery. Lock-free code pays retry loops, cache-line bouncing, memory-order constraints, and reclamation complexity. Wait-free code may need per-thread slots, descriptors, helping scans, or bounded rings, but it can keep p99 latency bounded when unbounded retries are unacceptable.']},
    { heading: 'Real-world uses', paragraphs: ['Lock-free queues fit telemetry, runtimes, and low-latency services where one paused producer should not halt all consumers. RCU-style read paths fit kernels where readers must avoid blocking. Wait-free bounded rings fit real-time audio callbacks and signal-sensitive paths where allocation, blocking, and unbounded retries are unacceptable.', {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/b/b7/Circular_buffer.svg', alt: 'Circular buffer ring divided into slots', caption: 'A bounded ring buffer is a common shape for real-time paths because capacity and per-operation work can be fixed in advance. Source: Wikimedia Commons, Cburnett, CC BY-SA 3.0 or GFDL.'}]},
    { heading: 'Where it fails', paragraphs: ['Nonblocking algorithms fail when the proof ignores memory reclamation. Removing a node is not enough because another thread may still hold a pointer to it. They also fail when the public claim is broader than the actual operations, such as push being lock-free while resize, close, destroy, or allocation can block.']},
    { heading: 'Worked example', paragraphs: ['Three threads increment a shared CAS counter from 7. T1 reads 7 and pauses; T2 reads 7, CASes 7 to 8, and completes; T3 reads 8, CASes 8 to 9, and completes. The counter is lock-free because T2 and T3 complete while T1 is paused, but it is not wait-free because T1 can resume and keep losing without a bound.']},
    { heading: 'Sources and study next', paragraphs: ['Primary sources include Herlihy on wait-free synchronization, Herlihy and Wing on linearizability, Michael and Scott queues, Treiber stacks, hazard pointers, epoch reclamation, RCU literature, and memory-model specifications for the target language. Study linearizability, ABA tagged pointers, lock-free queues, hazard pointers, epochs, sequence locks, MCS locks, futexes, and SharedArrayBuffer Atomics next.']},
  ],
};
