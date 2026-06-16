// Pregel case study: bulk-synchronous, vertex-centric graph processing with
// messages, supersteps, votes to halt, aggregators, and checkpoint recovery.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'pregel-graph-processing-case-study',
  title: 'Pregel Graph Processing Case Study',
  category: 'Papers',
  summary: 'Google Pregel as the graph-systems lesson: vertices compute locally, exchange messages, and advance by supersteps.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['supersteps and messages', 'PageRank on graph'], defaultValue: 'supersteps and messages' },
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

function graph(title) {
  return graphState({
    nodes: [
      { id: 'a', label: 'A', x: 1.4, y: 3.4, note: 'rank 1.0' },
      { id: 'b', label: 'B', x: 3.5, y: 1.8, note: 'rank 1.0' },
      { id: 'c', label: 'C', x: 5.4, y: 3.4, note: 'rank 1.0' },
      { id: 'd', label: 'D', x: 3.5, y: 5.6, note: 'rank 1.0' },
      { id: 'worker1', label: 'worker 1', x: 7.5, y: 2.4, note: 'A,B' },
      { id: 'worker2', label: 'worker 2', x: 7.5, y: 4.8, note: 'C,D' },
    ],
    edges: [
      { id: 'e-a-b', from: 'a', to: 'b', weight: 'msg' },
      { id: 'e-a-d', from: 'a', to: 'd', weight: 'msg' },
      { id: 'e-b-c', from: 'b', to: 'c', weight: 'msg' },
      { id: 'e-c-a', from: 'c', to: 'a', weight: 'msg' },
      { id: 'e-d-c', from: 'd', to: 'c', weight: 'msg' },
      { id: 'e-a-w1', from: 'a', to: 'worker1', weight: 'partition' },
      { id: 'e-b-w1', from: 'b', to: 'worker1', weight: 'partition' },
      { id: 'e-c-w2', from: 'c', to: 'worker2', weight: 'partition' },
      { id: 'e-d-w2', from: 'd', to: 'worker2', weight: 'partition' },
    ],
  }, { title });
}

function* superstepsAndMessages() {
  yield {
    state: graph('Pregel thinks in vertices, not records'),
    highlight: { active: ['a', 'b', 'c', 'd'], compare: ['worker1', 'worker2'] },
    explanation: 'Pregel is a vertex-centric system for large graph processing. Instead of writing map and reduce phases by hand, the programmer writes a vertex function. Each vertex reads messages, updates its own state, and sends messages to neighbors.',
  };

  yield {
    state: labelMatrix(
      'Bulk-synchronous supersteps',
      [
        { id: 's0', label: 'superstep 0' },
        { id: 'barrier0', label: 'barrier' },
        { id: 's1', label: 'superstep 1' },
        { id: 'barrier1', label: 'barrier' },
        { id: 's2', label: 'superstep 2' },
      ],
      [
        { id: 'read', label: 'read' },
        { id: 'compute', label: 'compute' },
        { id: 'send', label: 'send' },
      ],
      [
        ['initial value', 'vertex function', 'messages to neighbors'],
        ['all workers sync', 'deliver mailboxes', 'checkpoint optional'],
        ['previous messages', 'update value', 'new messages'],
        ['all workers sync', 'aggregate stats', 'checkpoint optional'],
        ['previous messages', 'vote to halt?', 'continue if active'],
      ],
    ),
    highlight: { active: ['s0:compute', 's0:send', 's1:read', 's1:compute'], found: ['barrier0:read', 'barrier1:compute'] },
    explanation: 'Pregel uses bulk-synchronous parallelism. Messages sent in one superstep are received in the next. The barrier makes reasoning cleaner and gives the system a place to aggregate, checkpoint, and recover.',
    invariant: 'A vertex only sees messages from the previous superstep.',
  };

  yield {
    state: graph('Messages move along graph edges'),
    highlight: { active: ['a', 'e-a-b', 'e-a-d', 'b', 'd'], compare: ['worker1', 'worker2'] },
    explanation: 'In one superstep, A can send messages to B and D. The system routes those messages to whichever workers own the destination vertices. The graph abstraction stays local even though the execution is distributed.',
  };

  yield {
    state: labelMatrix(
      'Pregel systems features',
      [
        { id: 'partition', label: 'partitioning' },
        { id: 'combiner', label: 'combiners' },
        { id: 'aggregator', label: 'aggregators' },
        { id: 'checkpoint', label: 'checkpointing' },
      ],
      [
        { id: 'job', label: 'job' },
        { id: 'why', label: 'why it matters' },
      ],
      [
        ['place vertices on workers', 'cuts network traffic'],
        ['merge same-destination messages', 'shrinks mailboxes'],
        ['global stats per step', 'convergence checks'],
        ['persist state', 'recover failed workers'],
      ],
    ),
    highlight: { found: ['combiner:why', 'aggregator:why', 'checkpoint:why'], active: ['partition:job'] },
    explanation: 'The case study is not just PageRank. It shows how a graph API needs systems machinery: partitioning, message routing, combiners, aggregators, fault tolerance, and convergence control.',
  };
}

function* pageRankOnGraph() {
  yield {
    state: graph('PageRank starts with equal values'),
    highlight: { active: ['a', 'b', 'c', 'd'], found: ['e-a-b', 'e-b-c', 'e-c-a', 'e-d-c'] },
    explanation: 'PageRank is a natural Pregel program. Each vertex stores a rank. On each superstep it sends rank divided by outgoing degree to neighbors, then updates from messages it receives.',
  };

  yield {
    state: labelMatrix(
      'One PageRank superstep',
      [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
        { id: 'c', label: 'C' },
        { id: 'd', label: 'D' },
      ],
      [
        { id: 'old', label: 'old rank' },
        { id: 'out', label: 'out degree' },
        { id: 'sends', label: 'sends' },
        { id: 'receives', label: 'next receives' },
      ],
      [
        ['1.00', '2', '0.50 to B,D', 'from C'],
        ['1.00', '1', '1.00 to C', 'from A'],
        ['1.00', '1', '1.00 to A', 'from B,D'],
        ['1.00', '1', '1.00 to C', 'from A'],
      ],
    ),
    highlight: { active: ['a:sends', 'b:sends', 'd:sends'], found: ['c:receives'] },
    explanation: 'Every vertex can execute the same small function. The distributed system handles message delivery, barriers, and workers. That is why vertex-centric APIs are useful for graph algorithms with repeated neighborhood communication.',
  };

  yield {
    state: labelMatrix(
      'Convergence is checked through aggregators',
      [
        { id: 'iter1', label: 'iteration 1' },
        { id: 'iter2', label: 'iteration 2' },
        { id: 'iter3', label: 'iteration 3' },
        { id: 'halt', label: 'halt' },
      ],
      [
        { id: 'delta', label: 'global rank delta' },
        { id: 'decision', label: 'decision' },
      ],
      [
        ['0.82', 'continue'],
        ['0.21', 'continue'],
        ['0.03', 'continue'],
        ['0.004', 'vote to halt'],
      ],
    ),
    highlight: { active: ['iter1:delta', 'iter2:delta', 'iter3:delta'], found: ['halt:decision'] },
    explanation: 'Aggregators let vertices contribute global statistics such as total rank change. Once the global change drops below a threshold, vertices vote to halt and the job terminates.',
  };

  yield {
    state: labelMatrix(
      'Pregel compared with adjacent systems',
      [
        { id: 'mapreduce', label: 'MapReduce' },
        { id: 'pregel', label: 'Pregel' },
        { id: 'stream', label: 'stream processor' },
        { id: 'graphdb', label: 'graph database' },
      ],
      [
        { id: 'unit', label: 'unit of work' },
        { id: 'best', label: 'best at' },
        { id: 'tradeoff', label: 'tradeoff' },
      ],
      [
        ['record batch', 'large ETL', 'iterative graphs awkward'],
        ['vertex superstep', 'iterative graph algorithms', 'barrier latency'],
        ['event', 'continuous updates', 'global iterations hard'],
        ['query traversal', 'online graph queries', 'batch algorithms costly'],
      ],
    ),
    highlight: { found: ['pregel:unit', 'pregel:best'], compare: ['mapreduce:tradeoff', 'stream:tradeoff'] },
    explanation: 'Pregel complements MapReduce. MapReduce is strong for batch transformations; Pregel is strong for repeated graph communication where each vertex keeps state across iterations.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'supersteps and messages') yield* superstepsAndMessages();
  else if (view === 'PageRank on graph') yield* pageRankOnGraph();
  else throw new InputError('Pick a Pregel view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Pregel is Google\'s system for large-scale graph processing. Programs are written as vertex functions. In each superstep, a vertex receives messages from the previous superstep, updates local state, sends messages to other vertices, and may vote to halt.',
        'The case study matters because graph algorithms are often iterative and communication-heavy. Pregel gives those algorithms a native execution model instead of forcing them through record-oriented batch jobs.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The graph is partitioned across workers. A master coordinates supersteps. Workers run vertex functions, buffer outgoing messages, deliver messages for the next superstep, and checkpoint state for recovery. Combiners can reduce message volume, while aggregators compute global values such as convergence metrics.',
        'PageRank illustrates the pattern. Each vertex sends rank mass to neighbors, receives rank contributions in the next superstep, updates its value, and repeats until the global rank change is small enough.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Pregel trades a clean programming model for barrier costs and network pressure. Poor partitioning can make message traffic dominate. High-degree vertices can become hot. Slow workers delay the barrier. Checkpointing improves recovery but adds IO. The model fits iterative graph algorithms best when the graph is large and the per-vertex computation is simple.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Pregel-style systems influenced Giraph, GraphX, PowerGraph, GraphLab, and many graph analytics stacks. Good fits include PageRank, connected components, shortest paths, label propagation, community detection, and large-scale recommendation graph features.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Pregel is not a graph database for low-latency interactive traversals. It is a batch graph-processing system. Another misconception is that MapReduce and Pregel compete for every job. They solve different shapes: record transformations versus iterative graph state.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Google Research Pregel page at https://research.google/pubs/pregel-a-system-for-large-scale-graph-processing/, ACM DOI at https://dl.acm.org/doi/10.1145/1807167.1807184, and an accessible paper copy at https://15799.courses.cs.cmu.edu/fall2013/static/papers/p135-malewicz.pdf. Study Graph BFS, PageRank, Message Queues, MapReduce Case Study, Borg Cluster Scheduler Case Study, and Dapper Tracing Case Study next.',
      ],
    },
  ],
};
