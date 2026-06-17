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
      heading: 'The problem',
      paragraphs: [
        'Mesos is a resource manager for a shared compute cluster. Its central question is not how to run one job well. The question is how to let many different compute frameworks use the same machines without forcing every framework into one scheduler model. A data center might run Hadoop batch jobs, Spark interactive analytics, MPI jobs, long lived services, and experimental systems. Each workload has different placement needs, data locality concerns, task lifetimes, and failure recovery rules.',
        'The painful baseline is static partitioning. Team A owns one group of machines, team B owns another, and each framework schedules only inside its slice. That is easy to reason about, but it wastes capacity whenever one slice is idle while another has queued work. It also makes data locality worse because the machines holding useful data may sit outside the framework partition that currently needs them. Mesos attacks that waste by making the cluster a shared resource pool while still letting framework-specific schedulers keep their specialized logic.',
      ],
    },
    {
      heading: 'Naive approach',
      paragraphs: [
        'One naive approach is to build one giant scheduler that understands every workload. The scheduler would know how Spark stages work, how Hadoop map tasks prefer data blocks, how MPI jobs need gang scheduling, how service tasks should be restarted, and how every future framework will express its needs. In small environments this can look attractive because one control plane can enforce one policy. At cluster scale, it becomes a bottleneck for innovation. Every new framework has to teach the central scheduler a new set of concepts.',
        'Another naive approach is to expose raw machines and let frameworks compete directly. That avoids central policy work, but it pushes fairness, isolation, recovery, and utilization into the wrong layer. A greedy framework can consume machines while peers wait. A failed worker can leave stale state. Operators lose the ability to apply quota and priority consistently. Mesos sits between those extremes. It is not a full framework scheduler, and it is not a free-for-all machine pool.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that cluster scheduling has two kinds of knowledge. The cluster layer knows global availability: which agents have free CPU, memory, disk, ports, and local resources. The framework layer knows job semantics: which task can run next, whether locality matters, whether partial allocation is useful, whether a task is speculative, and how failures should be repaired. If all decisions are centralized, framework knowledge gets flattened. If all decisions are delegated, global fairness and isolation get weak.',
        'The Mesos paper turns that wall into an interface design problem. The shared layer should own the facts that are common across frameworks: resource accounting, offers, isolation hooks, failure reports, and allocation policy. The framework should own the facts that only it understands. The difficult part is keeping the shared layer thin without making it powerless.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core insight is two-level scheduling through resource offers. Mesos does not ask each framework to submit a complete declarative plan for the whole cluster. Instead, the Mesos master allocates available resources to a framework as an offer. The framework scheduler can accept the offer and launch tasks, or decline it and wait for a better match. The common layer says, in effect, "these resources are available to you now." The framework answers, "these are the tasks I can use them for."',
        'This is deliberately asymmetric. Mesos chooses which framework gets a chance to use a resource, but the framework chooses the tasks. That lets the allocation module enforce fairness and quota while preserving framework-specific placement logic. Spark can care about cached RDD partitions and stage dependencies. Hadoop can care about block locality. A service framework can care about restart policy and health checks. Mesos does not have to become all of them.',
      ],
    },
    {
      heading: 'Mechanics',
      paragraphs: [
        'A Mesos cluster has masters, agents, frameworks, schedulers, and executors. Agents run on worker machines and report resource availability to the master. A framework registers a scheduler with the master. The master uses an allocation policy, often discussed with dominant resource fairness, to decide which framework should receive offers. An offer names resources on particular agents. The framework scheduler replies with tasks to launch, and executors on those agents run the tasks.',
        'The master also tracks task status, failed agents, framework disconnects, and resource recovery. If a task finishes, its resources return to the pool. If an agent fails, the framework is told that its tasks were lost so it can rebuild application-level state. Mesos can integrate with isolation mechanisms such as containers and cgroups, but the educational point is the resource protocol: report capacity, allocate an offer, let the framework bind tasks, then recover resources as tasks end.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a cluster has three agents. Agent A has free CPU and holds input blocks for a Spark job. Agent B has free CPU but no useful local data. Agent C has enough memory for a service task but would be a poor fit for the Spark stage. The Mesos master might offer resources from A and B to the Spark framework. Spark accepts A because locality will save network reads and declines B because the current stage would run slowly there. Later, B can be offered to a Hadoop framework or to another Spark job that does not need those blocks.',
        'Now add an idle framework and a bursting framework. In a static split, the idle framework keeps its machines while the bursting framework queues. Under Mesos, the idle slice can be offered to the framework with queued work, subject to fairness and policy. The win is not magic scheduling optimality. The win is that unused capacity becomes visible to work that can use it, while each framework still applies its own judgment before launching tasks.',
      ],
    },
    {
      heading: 'What the animation teaches',
      paragraphs: [
        'The first view shows Mesos as a thin layer between agents and frameworks. The important visual move is the offer path from the master to a framework. The master is not directly placing every Spark or Hadoop task. It is exposing a bundle of available resources. The framework scheduler then decides whether the offer fits the tasks it has ready.',
        'The framework coexistence view shows why the design matters. Spark, Hadoop, MPI-like jobs, and services do not want the same scheduler policy. The table of failure and fairness surfaces is the operational counterweight: delegation helps framework intelligence, but the shared substrate must still control quota, isolation, failed agents, and greedy behavior. The animation is best understood as a division of responsibility, not as a claim that offers always find the globally best placement.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Mesos works when the offer abstraction is rich enough for frameworks to make useful choices and narrow enough for the master to stay general. The framework does not need a complete copy of the cluster scheduler. It needs enough information to answer whether a specific resource bundle is useful now. That keeps the common layer stable while frameworks evolve independently.',
        'The design also improves utilization by reducing hard boundaries. Idle capacity can move toward frameworks with queued tasks. Fine-grained sharing lets short jobs and long jobs coexist better than a fixed machine split. Data locality can improve because offers are tied to particular agents, so a framework can prefer resources near its data rather than accepting anonymous CPU from anywhere.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'The tradeoff is that Mesos can be less globally optimal than a scheduler that sees every task and every job constraint at once. Offers may be declined, which adds latency. Resources can become fragmented across agents in shapes that no framework wants. Some workloads need all-or-nothing placement, and a stream of partial offers can be a poor fit unless the framework or allocation policy handles that case carefully.',
        'The model also pushes real work into framework schedulers. A framework that accepts bad offers can hurt its own performance. A framework that declines too much can delay itself and waste allocation cycles. Operators still need isolation, quotas, authentication, accounting, and policy. Mesos simplifies the common substrate, but it does not remove the need for disciplined cluster operations.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Mesos is strongest in a mixed cluster where different execution engines need to coexist. It fits environments with batch analytics, interactive jobs, services, and research frameworks that change faster than the central resource manager. The more varied the frameworks, the more valuable it is to avoid encoding every scheduling rule in one monolith.',
        'It also teaches a durable systems pattern: put common resource accounting in the platform, but leave domain-specific decisions near the domain. The same pattern appears in storage systems, query engines, browser schedulers, Kubernetes operators, and LLM serving control planes. A thin common layer can be more adaptable than a thick layer that tries to predict every future workload.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Mesos is a poor fit when one scheduler really does need a global view of every task dependency and placement constraint. Some workloads need gang scheduling, topology-aware placement, or rapid conflict resolution that an offer loop may express awkwardly. A two-level interface can also struggle when framework choices interact badly, because each scheduler optimizes locally while the allocator tries to preserve cluster-level fairness.',
        'Common failure modes include low offer acceptance, resource fragmentation, stale framework state after failures, weak isolation, misconfigured quotas, and incentives that reward frameworks for hoarding offers. A cluster can also become harder to debug because a bad placement may involve both the master allocation policy and framework scheduling code. The operational question is always where a decision was made and which layer had enough information to make it well.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: Mesos paper PDF at https://people.eecs.berkeley.edu/~alig/papers/mesos.pdf, USENIX page at https://www.usenix.org/conference/nsdi11/mesos-platform-fine-grained-resource-sharing-data-center, and Berkeley AMPLab PDF at https://amplab.cs.berkeley.edu/wp-content/uploads/2011/06/Mesos-A-Platform-for-Fine-Grained-Resource-Sharing-in-the-Data-Center.pdf.',
        'Study Borg Cluster Scheduler Case Study for the integrated cluster OS approach, Omega Scheduler Case Study for shared-state scheduling, Spark RDD Case Study for why data locality matters, Ray Distributed Execution Case Study for dynamic task and actor workloads, Bulkheads and Resource Isolation for containment, Backpressure and Flow Control for admission pressure, and Kubernetes-oriented control-plane topics for the later industry direction.',
      ],
    },
  ],
};
