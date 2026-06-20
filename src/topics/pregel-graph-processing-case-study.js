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
      heading: 'The graph-processing problem',
      paragraphs: [
        'Pregel is Google\'s system for large-scale graph processing. The problem it solves is not merely that graphs can be large. The deeper problem is that many graph algorithms are iterative, stateful, and neighbor-driven. PageRank, shortest paths, connected components, label propagation, belief propagation, and many recommendation features repeatedly update vertex state based on messages from adjacent vertices.',
        'That shape is awkward in a record-oriented batch system. MapReduce can process large data, but a graph algorithm forced through repeated map and reduce stages has to keep materializing state, reshuffling edges, and rebuilding the next round. The algorithm is conceptually local to vertices, but the execution system treats it as a sequence of global record transformations. Pregel gives the algorithm a model that matches the graph: vertices hold state, send messages, and advance in coordinated rounds.',
        {type:'callout', text:'Pregel makes the vertex local and the superstep global, so graph algorithms keep simple rules while the runtime owns distributed coordination.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/f/fb/PageRanks-Example.svg', alt:'Directed graph with PageRank percentages shown by node size.', caption:'PageRank graph illustration by 345Kai and Stannered, via Wikimedia Commons, public domain.'},
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core insight is to make vertex state the unit of programming and supersteps the unit of coordination. The programmer writes the local rule: receive messages, update this vertex, send new messages, maybe halt. The runtime turns that rule into a distributed computation by partitioning vertices, moving messages, checkpointing state, and advancing the whole graph one synchronized round at a time.',
        'That split is why Pregel is teachable. The algorithmic invariant is local: a vertex only changes from its previous state and incoming messages. The system invariant is global: every message sent in one superstep is processed in the next, and termination happens only when no active vertex and no in-flight message remains. The model gives students both the graph idea and the distributed-systems contract.',
      ],
    },
    {
      heading: 'The programming model',
      paragraphs: [
        'Pregel programs are written as vertex functions. In each superstep, a vertex receives messages sent to it in the previous superstep, updates its own value, sends messages to other vertices, and may vote to halt. A halted vertex becomes inactive until it receives another message. The whole computation ends when every vertex is inactive and there are no messages in flight.',
        'This is the bulk synchronous parallel model applied to graphs. Work proceeds in rounds. Inside a round, many vertices run in parallel. Between rounds, messages are delivered and global coordination happens. The barrier is not an incidental implementation detail; it is the thing that makes the model easier to reason about. A message sent in superstep N is processed in superstep N plus 1, not halfway through an uncontrolled race.',
        'The graph is partitioned across workers. A master coordinates the computation, while workers store assigned vertices and edges, run vertex functions, buffer outgoing messages, and deliver incoming messages for the next round. Checkpoints allow recovery. Combiners can reduce message volume when an operation is associative and commutative. Aggregators compute global values such as convergence metrics, counts, maximum distances, or total residual error.',
      ],
    },
    {
      heading: 'Why PageRank fits the model',
      paragraphs: [
        'PageRank is the clean classroom example. Each page is a vertex. Each link is an edge. During a superstep, a vertex distributes its current rank mass across outgoing edges. In the next superstep, each neighbor receives contributions, combines them with damping, updates its rank, and sends out the next round of mass. The global computation emerges from many small vertex-local computations.',
        'The algorithm needs repeated communication with neighbors and a convergence test. Pregel gives both. Messages move rank contributions. Aggregators can track total change in rank across the graph. When the global change falls below a threshold, the system can stop. The developer writes the vertex behavior; the runtime handles partitioning, message delivery, barriers, and fault tolerance.',
        'This is the educational power of Pregel. It does not make PageRank mathematically different. It makes the distributed execution match the algorithm\'s natural shape. Instead of expressing every iteration as a separate dataflow job, the programmer expresses how one vertex behaves in one round.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Pregel works because many graph algorithms are local but repeated. A vertex often needs only its own state, its edges, and messages from neighbors. That locality lets workers run many vertices in parallel. The repeated superstep structure gives the system a simple way to coordinate progress without making every message an immediate distributed transaction.',
        'The barrier also makes recovery and reasoning easier. At superstep boundaries, the system can checkpoint vertex state and messages. If a worker fails, the computation can restart from a known consistent point. That is simpler than recovering an arbitrary asynchronous graph computation where messages may be partly applied and state may be in the middle of mutation.',
        'Combiners and aggregators are the other key pieces. A combiner reduces multiple messages headed to the same vertex when the operation allows it. For example, PageRank contributions can be summed. Aggregators let the system compute global facts without forcing the user to build separate jobs. These tools turn the vertex model from a toy abstraction into something practical for large graphs.',
      ],
    },
    {
      heading: 'Where it matters',
      paragraphs: [
        'Pregel-style systems influenced Apache Giraph, GraphX, PowerGraph, GraphLab, and many graph analytics platforms. The model is a good fit for PageRank, shortest paths, connected components, label propagation, community detection, semi-supervised learning on graphs, and large-scale graph-derived recommendation features.',
        'The model matters whenever the graph is too large for one machine and the algorithm repeatedly pushes information along edges. Social graphs, web graphs, knowledge graphs, routing graphs, fraud rings, citation networks, and item-user interaction graphs all contain this pattern. A vertex-centric model lets engineers think in terms of local update rules while the system handles distributed execution.',
        'Pregel is not a replacement for every graph system. A graph database is built for low-latency interactive traversals and updates. A graph neural network framework may need tensor kernels and mini-batch sampling. A streaming graph system may need continuous updates. Pregel is best understood as a batch analytics model for iterative graph computation.',
      ],
    },
    {
      heading: 'Costs and failure modes',
      paragraphs: [
        'The clean programming model has real costs. Barriers make reasoning easier, but the slowest worker can delay the whole superstep. Poor partitioning can make cross-worker message traffic dominate. High-degree vertices can become hot spots. Some graphs have skewed degree distributions, so equal vertex counts do not mean equal work. Checkpointing improves recovery but adds IO and storage cost.',
        'Message volume is often the limiting factor. A simple vertex function can generate enormous traffic if every active vertex sends to every neighbor every round. Combiners help only when the operation permits safe reduction. Aggregators help with global values but do not eliminate neighbor traffic. Good graph processing requires thinking about edge cuts, partitioning, degree skew, and convergence behavior.',
        'The barrier model can also be too rigid. Some algorithms converge faster with asynchronous updates, or they spend too much time waiting for global rounds. Other workloads are too small to justify the distributed overhead. Pregel makes large iterative graph jobs tractable, but it is not automatically faster than a single-machine graph library on a graph that fits in memory.',
      ],
    },
    {
      heading: 'A worked connected-components example',
      paragraphs: [
        'Connected components show the model without PageRank math. Give every vertex an initial component label equal to its own ID. In each superstep, a vertex sends its current smallest known label to its neighbors. When a vertex receives a smaller label, it updates its own label and sends that label onward in the next round. When no vertex changes, every vertex in the same connected component has converged to the same minimum label.',
        'The algorithm is easy to state locally, but the system work is substantial. Messages must cross partitions. High-degree vertices may send many labels. Aggregators can count how many vertices changed in a round to decide when to stop. Checkpoints protect the long computation from worker failure. This is exactly the kind of job Pregel was built to express.',
      ],
    },
    {
      heading: 'Practical guidance',
      paragraphs: [
        'Use a Pregel-style model when the algorithm is naturally vertex-local, iterative, and message-driven. Look for repeated neighbor communication, simple per-vertex state, and a clear convergence or halt condition. Watch partition quality, cross-worker edge cuts, message volume, combiner opportunities, high-degree vertices, and convergence metrics.',
        'Avoid it for small graphs, ad hoc graph queries, graph workloads dominated by low-latency reads, heavy per-vertex computation that barely communicates, or algorithms where barrier latency dominates useful work. If the graph fits comfortably in memory on one machine, a local graph library may be simpler and faster.',
      ],
    },
    {
      heading: 'What to remember',
      paragraphs: [
        'Pregel is a programming model for iterative graph state. Vertices compute locally. Messages carry information along edges. Supersteps provide a clear rhythm: receive, compute, send, synchronize. That rhythm makes large graph algorithms easier to distribute and recover.',
        'The deep lesson is that the right execution model should match the algorithm\'s communication pattern. Record transformations fit MapReduce. Iterative neighbor communication fits Pregel. Low-latency traversals fit a graph database. Choosing the wrong model turns a simple algorithm into operational friction.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Google Research Pregel page at https://research.google/pubs/pregel-a-system-for-large-scale-graph-processing/, ACM DOI at https://dl.acm.org/doi/10.1145/1807167.1807184, and an accessible paper copy at https://15799.courses.cs.cmu.edu/fall2013/static/papers/p135-malewicz.pdf. Study Graph BFS, PageRank, Message Queues, MapReduce Case Study, Borg Cluster Scheduler Case Study, Dapper Tracing Case Study, and Graph Neural Networks next.',
      ],
    },
  ],
};
