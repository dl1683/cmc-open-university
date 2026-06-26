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
      heading: 'How to read the animation',
      paragraphs: [
        'The resource-offers view shows Mesos between machines and compute frameworks. A framework is a system such as Spark or Hadoop that knows how to run its own jobs. Active arrows are offers moving from the Mesos master to a framework; found tasks are tasks the framework accepted and launched.',
        {type:'callout', text:'Mesos keeps the common cluster layer thin by offering resources while framework schedulers keep workload-specific placement logic.'},
        'The coexistence view shows several frameworks sharing one cluster. The safe inference is about responsibility: Mesos decides which framework gets a chance at resources, and the framework decides whether those resources fit its current work.'
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A data-center cluster often runs many workload types on the same machines. Batch analytics, interactive Spark jobs, long-running services, and MPI-style jobs have different placement rules. Static machine partitions waste capacity when one team is idle and another has queued work.',
        'Mesos exists to share cluster resources without forcing every workload into one scheduler. It provides a common resource layer and lets specialized frameworks keep their own scheduling logic. The design goal is high utilization without a giant central scheduler that must understand every job type.'
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is static partitioning. Give Hadoop one set of machines, Spark another, and services another. This is simple, but idle machines in one partition cannot help a busy framework in another partition.',
        'Another obvious approach is one universal scheduler. It would know every task dependency, locality rule, restart policy, and future framework feature. That makes the central layer too complex and slows adoption of new compute systems.'
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is split knowledge. The cluster layer knows global availability: CPU, memory, ports, disk, and which agents are alive. The framework layer knows job meaning: which stage can run, whether locality matters, and whether partial resources are useful.',
        'If all decisions move into the cluster layer, framework meaning is flattened. If all decisions move into frameworks, fairness and isolation become weak. Mesos turns that conflict into a protocol.'
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Use two-level scheduling. The Mesos master allocates resource offers to frameworks. A resource offer names available resources on particular agents. The framework accepts the offer with tasks or declines it and waits.',
        'This keeps the common layer thin but useful. Mesos owns accounting, allocation policy, failure reports, and isolation hooks. Frameworks own workload-specific placement. The interface is the offer, not a universal job plan.'
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Agents run on worker machines and report available CPU, memory, disk, and ports to the Mesos master. Frameworks register schedulers with the master. The allocation module chooses which framework should receive an offer.',
        'A framework scheduler inspects the offer and replies with tasks to launch or declines the offer. Executors on the selected agents run the tasks. When tasks finish or fail, resources return to the pool and status updates flow back to the framework.',
        'Dominant resource fairness is one allocation idea associated with Mesos. It compares each framework by its largest share of any resource, such as CPU or memory. That helps prevent a memory-heavy framework from looking small just because it uses fewer CPUs.'
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness here means preserving the responsibility boundary. Mesos must never allocate the same resource to two frameworks at the same time. A framework must launch only tasks that fit the offered resources. If both rules hold, cluster accounting stays coherent.',
        'Utilization improves because idle resources can move to frameworks with work. Locality can still matter because an offer names the agent, not anonymous CPU. A framework can accept resources near its data and decline resources that would make the job slower.'
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Offers add control-plane latency. If a framework declines many offers, the cluster spends cycles proposing resources that do not launch tasks. If offer round trips take 50 ms and a framework declines 1,000 offers during a burst, that is 50 seconds of aggregate control work even before useful scheduling happens.',
        'The model can fragment resources. A cluster may have enough total CPU and memory but spread across agents in shapes no framework can use. More frameworks increase sharing opportunity, but they also increase policy, quota, authentication, and debugging work.',
        'Scaling the cluster does not remove framework responsibility. A framework that accepts poor offers can hurt its own runtime. A framework that hoards or declines too aggressively can reduce overall utilization unless the allocator and quotas push back.'
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Mesos fits mixed clusters where several execution engines must coexist. It was used to run Hadoop, Spark, services, and research frameworks on shared data-center resources. The common access pattern is many frameworks competing for machines while each framework needs its own placement logic.',
        'The design also teaches a platform pattern. Put common accounting in the substrate and leave domain-specific decisions near the domain. Similar boundaries appear in Kubernetes operators, storage systems, query engines, and LLM serving control planes.'
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Mesos is awkward when one scheduler needs a full global view of every task dependency. Gang scheduling, tight topology placement, and fast conflict resolution can be hard to express through an offer loop. Local framework choices can interact badly even when each framework is rational.',
        'Operational failures include stale framework state, low offer acceptance, weak isolation, resource fragmentation, and quota mistakes. Debugging can cross two layers because a bad placement may involve both Mesos allocation and framework scheduler code.'
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a cluster has three agents. Agent A has 8 CPUs and 32 GB memory and stores Spark input blocks. Agent B has 8 CPUs and 32 GB memory but no local data. Agent C has 2 CPUs and 64 GB memory.',
        'Spark needs 4 CPUs and 16 GB near its input data, so it accepts an offer on A and declines B. A service framework needs memory more than locality, so it can later accept C. Static partitioning might have left C idle while Spark waited, but Mesos can keep offering unused capacity.',
        'Now add fairness. If Spark already uses 60 percent of cluster CPU and the service framework uses 10 percent of memory, the allocator may offer the next free resources to the service framework. The offer does not force a task; it gives the framework a chance to use a fair share.'
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Mesos: A Platform for Fine-Grained Resource Sharing in the Data Center, https://people.eecs.berkeley.edu/~alig/papers/mesos.pdf. Study dominant resource fairness, Borg, Omega, Kubernetes scheduling, Spark RDD locality, resource isolation, and backpressure next.'
      ],
    },
  ],
};
