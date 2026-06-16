// Mesos case study: a thin resource-sharing substrate that lets multiple
// cluster frameworks coexist through resource offers and two-level scheduling.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'mesos-resource-manager-case-study',
  title: 'Mesos Resource Manager Case Study',
  category: 'Papers',
  summary: 'Mesos as the cluster-sharing lesson: resource offers, framework schedulers, fine-grained sharing, and data locality.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['resource offers', 'framework coexistence'], defaultValue: 'resource offers' },
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

function mesosGraph(title) {
  return graphState({
    nodes: [
      { id: 'master', label: 'Mesos master', x: 4.8, y: 3.8, note: 'offers' },
      { id: 'agent1', label: 'agent A', x: 1.2, y: 6.4, note: 'CPU/RAM/data' },
      { id: 'agent2', label: 'agent B', x: 4.8, y: 6.8, note: 'CPU/RAM/data' },
      { id: 'agent3', label: 'agent C', x: 8.4, y: 6.4, note: 'CPU/RAM/data' },
      { id: 'spark', label: 'Spark', x: 1.3, y: 1.3, note: 'framework' },
      { id: 'hadoop', label: 'Hadoop', x: 4.8, y: 1.0, note: 'framework' },
      { id: 'service', label: 'service', x: 8.3, y: 1.3, note: 'framework' },
    ],
    edges: [
      { id: 'e-master-agent1', from: 'master', to: 'agent1', weight: 'resources' },
      { id: 'e-master-agent2', from: 'master', to: 'agent2', weight: 'resources' },
      { id: 'e-master-agent3', from: 'master', to: 'agent3', weight: 'resources' },
      { id: 'e-master-spark', from: 'master', to: 'spark', weight: 'offer' },
      { id: 'e-master-hadoop', from: 'master', to: 'hadoop', weight: 'offer' },
      { id: 'e-master-service', from: 'master', to: 'service', weight: 'offer' },
    ],
  }, { title });
}

function* resourceOffers() {
  yield {
    state: mesosGraph('Mesos is a thin layer between machines and frameworks'),
    highlight: { active: ['master', 'agent1', 'agent2', 'e-master-agent1', 'e-master-agent2'], compare: ['spark', 'hadoop'] },
    explanation: 'Mesos was built so different cluster frameworks could share one datacenter instead of each owning a fixed partition of machines.',
  };

  yield {
    state: labelMatrix(
      'Two-level scheduling',
      [
        { id: 'mesos', label: 'Mesos master' },
        { id: 'framework', label: 'framework scheduler' },
        { id: 'executor', label: 'executor' },
        { id: 'agent', label: 'agent' },
      ],
      [
        { id: 'decision', label: 'decision' },
        { id: 'knows', label: 'knows' },
      ],
      [
        ['which resources to offer', 'cluster-wide availability'],
        ['which tasks to launch', 'job-specific needs'],
        ['run task', 'framework runtime'],
        ['provide CPU/RAM', 'local machine state'],
      ],
    ),
    highlight: { found: ['mesos:decision', 'framework:decision'], active: ['agent:knows'] },
    explanation: 'Mesos does not centrally understand every framework. It offers resources; framework schedulers decide whether those resources fit their tasks.',
    invariant: 'Cluster sharing improves when the common layer is thin enough that specialized schedulers can still be smart.',
  };

  yield {
    state: mesosGraph('A framework can decline an offer that lacks locality'),
    highlight: { active: ['master', 'spark', 'agent1', 'e-master-spark'], compare: ['agent3'] },
    explanation: 'Resource offers let a framework consider data locality, task shape, and queue state. A Spark job can prefer the agent that holds its input blocks instead of accepting any free CPU.',
  };

  yield {
    state: labelMatrix(
      'Why offers beat static cluster splits',
      [
        { id: 'idle', label: 'idle framework' },
        { id: 'burst', label: 'bursting framework' },
        { id: 'locality', label: 'data locality' },
        { id: 'isolation', label: 'isolation' },
      ],
      [
        { id: 'static_split', label: 'static split' },
        { id: 'mesos', label: 'Mesos' },
      ],
      [
        ['wastes machines', 'offer to others'],
        ['waits for its slice', 'borrow free capacity'],
        ['hard across silos', 'framework can choose'],
        ['simple', 'needs enforcement'],
      ],
    ),
    highlight: { found: ['idle:mesos', 'burst:mesos', 'locality:mesos'], compare: ['isolation:mesos'] },
    explanation: 'The case study is about multiplexing. Fine-grained sharing can raise utilization, but only if isolation, fairness, and framework behavior stay under control.',
  };
}

function* frameworkCoexistence() {
  yield {
    state: mesosGraph('One cluster, many framework schedulers'),
    highlight: { active: ['spark', 'hadoop', 'service'], found: ['master'] },
    explanation: 'Mesos supports diverse frameworks because it does not force them all into one job model. Batch, interactive, and long-running services can coexist through a common resource interface.',
  };

  yield {
    state: labelMatrix(
      'Frameworks want different scheduling policies',
      [
        { id: 'spark', label: 'Spark' },
        { id: 'hadoop', label: 'Hadoop' },
        { id: 'mpi', label: 'MPI' },
        { id: 'service', label: 'service' },
      ],
      [
        { id: 'needs', label: 'needs' },
        { id: 'risk', label: 'risk if centralized' },
      ],
      [
        ['data locality + memory', 'generic policy misses reuse'],
        ['batch throughput', 'slow innovation'],
        ['gang scheduling', 'partial allocation bad'],
        ['long-lived health', 'batch assumptions wrong'],
      ],
    ),
    highlight: { active: ['spark:needs', 'mpi:needs'], compare: ['service:risk'] },
    explanation: 'A monolithic scheduler must understand every workload type. Mesos delegates much of that knowledge to the framework that owns the workload.',
  };

  yield {
    state: labelMatrix(
      'Failure and fairness surfaces',
      [
        { id: 'master_fail', label: 'master failure' },
        { id: 'agent_fail', label: 'agent failure' },
        { id: 'greedy', label: 'greedy framework' },
        { id: 'declines', label: 'offer declines' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'discipline', label: 'discipline' },
      ],
      [
        ['control-plane outage', 'replicated master'],
        ['lost tasks', 'framework recovery'],
        ['starves peers', 'fair sharing policy'],
        ['resource fragmentation', 'allocation policy'],
      ],
    ),
    highlight: { found: ['greedy:discipline', 'master_fail:discipline'], active: ['agent_fail:discipline'] },
    explanation: 'Two-level scheduling moves intelligence outward, but the shared substrate still needs fairness, failure handling, and admission control.',
  };

  yield {
    state: labelMatrix(
      'Lineage of cluster management ideas',
      [
        { id: 'borg', label: 'Borg' },
        { id: 'mesos', label: 'Mesos' },
        { id: 'omega', label: 'Omega' },
        { id: 'ray', label: 'Ray' },
      ],
      [
        { id: 'core', label: 'core idea' },
        { id: 'tradeoff', label: 'tradeoff' },
      ],
      [
        ['integrated cluster OS', 'central sophistication'],
        ['resource offers', 'framework complexity'],
        ['shared-state schedulers', 'conflict retries'],
        ['dynamic task/actor runtime', 'AI workload focus'],
      ],
    ),
    highlight: { found: ['mesos:core'], compare: ['borg:tradeoff', 'omega:tradeoff'] },
    explanation: 'Mesos is a different answer to the same Borg problem: how should many teams and frameworks share a cluster without freezing innovation inside one scheduler?',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'resource offers') yield* resourceOffers();
  else if (view === 'framework coexistence') yield* frameworkCoexistence();
  else throw new InputError('Pick a Mesos view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Mesos is a cluster resource manager that lets many compute frameworks share the same datacenter resources through fine-grained resource offers.',
        'The case study matters because it separates resource allocation from framework-specific scheduling. The common layer stays thin; specialized systems keep their own scheduling logic.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Mesos masters track available resources on agents and make offers to frameworks. A framework scheduler decides whether to accept an offer and which tasks to launch. Executors on agents run the tasks.',
        'This two-level scheduling model lets Spark, Hadoop, MPI-like jobs, and services coexist while preserving data locality and framework-specific policies.',
        'The offer mechanism is deliberately asymmetric. Mesos says what is available; the framework says whether it can use it. That keeps the resource manager small enough to support many frameworks while still letting each framework reason about task placement, locality, and internal job structure.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Mesos must handle fairness, isolation, failure, framework behavior, resource fragmentation, and offer latency. Delegating decisions makes frameworks powerful but also pushes more responsibility into their schedulers.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Mesos influenced cluster management, container orchestration, Spark deployments, multi-framework sharing, and the broader scheduler design space alongside Borg, Omega, Kubernetes, and Ray.',
        'It is especially instructive for organizations that have several compute engines competing for the same machines. Static partitions waste capacity when one engine is idle; a shared resource layer can lend capacity to whichever framework has useful work ready.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Two-level scheduling is not automatically simpler. It simplifies the common substrate but requires frameworks to make good decisions. It also does not remove the need for isolation, quota, and operational policy.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Mesos paper PDF at https://people.eecs.berkeley.edu/~alig/papers/mesos.pdf, USENIX page at https://www.usenix.org/conference/nsdi11/mesos-platform-fine-grained-resource-sharing-data-center, and Berkeley AMPLab PDF at https://amplab.cs.berkeley.edu/wp-content/uploads/2011/06/Mesos-A-Platform-for-Fine-Grained-Resource-Sharing-in-the-Data-Center.pdf. Study Borg Cluster Scheduler Case Study, Spark RDD Case Study, Ray Distributed Execution Case Study, Bulkheads & Resource Isolation, and Backpressure & Flow Control next.',
      ],
    },
  ],
};
