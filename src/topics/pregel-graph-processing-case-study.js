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
    explanation: 'Pregel makes the vertex the unit of programming. Instead of forcing an iterative graph algorithm into map and reduce phases, each vertex reads messages, updates its own state, and sends messages to neighbors.',
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
    explanation: 'Read supersteps as rounds with mailboxes. Messages sent in superstep 0 are visible in superstep 1. The barrier is expensive, but it gives the system a clean place to aggregate, checkpoint, and recover.',
    invariant: 'A vertex only sees messages from the previous superstep.',
  };

  yield {
    state: graph('Messages move along graph edges'),
    highlight: { active: ['a', 'e-a-b', 'e-a-d', 'b', 'd'], compare: ['worker1', 'worker2'] },
    explanation: 'The edge arrows are logical graph messages, not necessarily local machine sends. The runtime routes each message to the worker that owns the destination vertex.',
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
    explanation: 'Every vertex runs the same small rule, while the system handles delivery, barriers, and worker placement. That is the attraction: repeated neighborhood communication becomes the natural control flow.',
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
      heading: 'How to read the animation',
      paragraphs: [
        'Read each graph node as a vertex with local state and each arrow as a possible message route. Active vertices are computing in the current superstep, found cells show global progress, and compare cells show adjacent systems or delayed work. A superstep is one bulk-synchronous round: receive messages from the previous round, compute locally, send messages for the next round, then wait at a barrier.',
        'The PageRank view uses the same rule with rank values. A message sent in superstep 0 is not read until superstep 1. That one-round delay is the safe inference that makes the animation deterministic instead of a race.',
        {type:'callout', text:'Pregel makes the vertex local and the superstep global, so graph algorithms keep simple rules while the runtime owns distributed coordination.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/f/fb/PageRanks-Example.svg', alt:'Directed graph with PageRank percentages shown by node size.', caption:'PageRank graph illustration by 345Kai and Stannered, via Wikimedia Commons, public domain.'},
      ],
    },
    { heading: 'Why this exists', paragraphs: [
      'Large graph algorithms are often iterative and neighbor-driven. PageRank, connected components, shortest paths, and label propagation update vertex state from nearby messages many times. A record-batch system can process the data, but it forces every iteration through heavy reshuffle and materialization.',
      'Pregel gives the programmer the shape of the algorithm. Vertices store state, exchange messages, and advance in coordinated rounds. The runtime handles partitioning, routing, barriers, aggregation, and recovery.',
    ] },
    { heading: 'The obvious approach', paragraphs: [
      'The obvious distributed approach is MapReduce. Store vertices and edges as records, run a job for one iteration, write the intermediate graph state, and run another job for the next iteration. This is reasonable because MapReduce already handles large data and failures.',
      'The obvious single-machine approach is an in-memory graph library. That is better when the graph fits in RAM and one machine is fast enough. It fails when the graph and message traffic exceed one host.',
    ] },
    { heading: 'The wall', paragraphs: [
      'The wall is repeated global work. A graph algorithm may need 30 iterations, and each MapReduce iteration can reload state, shuffle edges, and write results. The algorithm is local at the vertex, but the execution plan keeps rebuilding a global dataflow job.',
      'The other wall is failure and coordination. Without a clean round boundary, a worker crash can leave some messages applied and others in flight. Pregel pays for barriers so it can reason about progress and recovery at known points.',
    ] },
    { heading: 'The core insight', paragraphs: [
      'Make the vertex the programming unit and the superstep the coordination unit. The user writes a local function: read messages, update this vertex, send messages, and possibly vote to halt. The system turns that function into a distributed graph computation.',
      'The invariant is message timing. A vertex only reads messages sent in the previous superstep. Termination is safe only when every vertex is inactive and no messages remain in transit.',
    ] },
    { heading: 'How it works', paragraphs: [
      'A master partitions vertices across workers. Each worker stores its vertices and outgoing edges, runs the vertex function for active vertices, buffers outgoing messages, and delivers received messages at the next superstep. A barrier separates one round from the next.',
      'Combiners can merge messages headed to the same vertex when the operation is safe, such as summing PageRank contributions. Aggregators collect global values such as total rank change or number of updated vertices. Checkpoints persist state so failed workers can restart from a consistent superstep.',
    ] },
    { heading: 'Why it works', paragraphs: [
      'Correctness follows by induction over supersteps. At the start of superstep k, each vertex has the state produced by superstep k - 1 and the complete mailbox sent during that previous round. Running the same vertex rule over those inputs produces the defined state for superstep k.',
      'Fault tolerance works because checkpointed superstep boundaries are consistent cuts. If a worker fails after a checkpoint, the system can restore vertex state and messages from that boundary and replay later rounds. It does not need to reconstruct an arbitrary mid-message race.',
    ] },
    { heading: 'Cost and complexity', paragraphs: [
      'The main cost is messages plus barriers. If 100 million active vertices each send to 10 neighbors, one superstep creates about 1 billion logical messages before combining. The slowest worker can hold the whole job at the barrier.',
      'Partition quality controls behavior. A partitioning that cuts many high-traffic edges turns local graph updates into network traffic. High-degree vertices can create hot spots, and checkpointing adds storage I/O that grows with vertex state size.',
    ] },
    { heading: 'Real-world uses', paragraphs: [
      'Pregel influenced Apache Giraph, GraphX, GraphLab, PowerGraph, and many large-scale graph analytics systems. The model fits PageRank, connected components, single-source shortest paths on suitable graphs, label propagation, community detection, and recommendation features derived from graph neighborhoods.',
      'It is useful when the graph is too large for one machine and the algorithm repeatedly pushes information along edges. Web graphs, social graphs, knowledge graphs, fraud rings, citation graphs, and item-user interaction graphs all contain that pattern.',
    ] },
    { heading: 'Where it fails', paragraphs: [
      'Pregel is a poor fit for small graphs, low-latency online traversals, and workloads dominated by interactive updates. A graph database or local graph library will often be simpler. The barrier model can also be slower than asynchronous algorithms that converge with fewer waits.',
      'Some algorithms produce too much message traffic or have severe skew. A celebrity vertex with 50 million neighbors can dominate one round. Combiners help only when the message operation is associative and commutative.',
    ] },
    { heading: 'Worked example', paragraphs: [
      'For connected components, give vertices A, B, C, and D initial labels 1, 2, 3, and 4. Edges are A-B, B-C, and C-D. In superstep 0 each vertex sends its label to neighbors. In superstep 1, B receives 1 and 3, updates to 1, C receives 2 and 4, updates to 2, and D receives 3, updates to 3.',
      'After two more rounds, label 1 has propagated to every vertex. An aggregator counts changed vertices each round: 3, then 2, then 1, then 0. When the count reaches 0 and no messages remain, every vertex in the component holds the minimum label.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Primary sources: Google Research Pregel page at https://research.google/pubs/pregel-a-system-for-large-scale-graph-processing/, ACM DOI at https://dl.acm.org/doi/10.1145/1807167.1807184, and the CMU-hosted paper copy at https://15799.courses.cs.cmu.edu/fall2013/static/papers/p135-malewicz.pdf.',
      'Study graph BFS, PageRank, bulk synchronous parallelism, MapReduce, message queues, checkpoint recovery, and graph databases to see which execution model matches each graph workload.',
    ] },
  ],
};
