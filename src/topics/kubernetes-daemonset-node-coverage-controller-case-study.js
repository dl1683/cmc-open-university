// Kubernetes DaemonSet: eligible nodes should each have one daemon Pod, with
// selectors, affinity, tolerations, rollout, and node churn tracked explicitly.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'kubernetes-daemonset-node-coverage-controller-case-study',
  title: 'Kubernetes DaemonSet Node Coverage Controller Case Study',
  category: 'Systems',
  summary: 'How DaemonSets select eligible nodes, create one Pod per node, use node affinity, tolerate important taints, roll out updates, and clean up on node removal.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['coverage map', 'rolling daemon'], defaultValue: 'coverage map' },
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

function dsGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'ds', label: 'DS', x: 0.7, y: 3.8, note: notes.ds ?? 'spec' },
      { id: 'ctrl', label: 'ctrl', x: 2.4, y: 3.8, note: notes.ctrl ?? 'coverage' },
      { id: 'n1', label: 'node1', x: 4.3, y: 2.0, note: notes.n1 ?? 'ok' },
      { id: 'n2', label: 'node2', x: 4.3, y: 3.8, note: notes.n2 ?? 'ok' },
      { id: 'n3', label: 'node3', x: 4.3, y: 5.6, note: notes.n3 ?? 'taint' },
      { id: 'p1', label: 'pod1', x: 6.4, y: 2.0, note: notes.p1 ?? 'run' },
      { id: 'p2', label: 'pod2', x: 6.4, y: 3.8, note: notes.p2 ?? 'run' },
      { id: 'p3', label: 'pod3', x: 6.4, y: 5.6, note: notes.p3 ?? 'miss?' },
      { id: 'obs', label: 'obs', x: 8.4, y: 3.8, note: notes.obs ?? 'status' },
    ],
    edges: [
      { id: 'e-ds-ctrl', from: 'ds', to: 'ctrl' },
      { id: 'e-ctrl-n1', from: 'ctrl', to: 'n1' },
      { id: 'e-ctrl-n2', from: 'ctrl', to: 'n2' },
      { id: 'e-ctrl-n3', from: 'ctrl', to: 'n3' },
      { id: 'e-n1-p1', from: 'n1', to: 'p1' },
      { id: 'e-n2-p2', from: 'n2', to: 'p2' },
      { id: 'e-n3-p3', from: 'n3', to: 'p3' },
      { id: 'e-p1-obs', from: 'p1', to: 'obs' },
      { id: 'e-p2-obs', from: 'p2', to: 'obs' },
      { id: 'e-p3-obs', from: 'p3', to: 'obs' },
    ],
  }, { title });
}

function* coverageMap() {
  yield {
    state: dsGraph('A DaemonSet wants one Pod on each eligible node'),
    highlight: { active: ['ds', 'ctrl', 'n1', 'n2', 'e-ds-ctrl'], compare: ['p1', 'p2'] },
    explanation: 'A DaemonSet is a node-coverage controller. It is for node-local agents such as log collectors, network plugins, storage daemons, or monitoring exporters.',
    invariant: 'DaemonSet desired count follows eligible nodes, not a fixed replica number.',
  };

  yield {
    state: labelMatrix(
      'Coverage ledger',
      [
        { id: 'n1', label: 'n1' },
        { id: 'n2', label: 'n2' },
        { id: 'n3', label: 'n3' },
        { id: 'n4', label: 'n4' },
      ],
      [
        { id: 'elig', label: 'ok?' },
        { id: 'pod', label: 'pod' },
      ],
      [
        ['yes', 'run'],
        ['yes', 'run'],
        ['no', 'skip'],
        ['new', 'make'],
      ],
    ),
    highlight: { active: ['n1:pod', 'n2:pod', 'n4:pod'], compare: ['n3:pod'] },
    explanation: 'The controller keeps a per-node coverage table: eligible, already has Pod, needs Pod, should delete Pod, or should update Pod.',
  };

  yield {
    state: dsGraph('Node selector, affinity, and tolerations define eligibility', { n3: 'taint ok?', p3: 'if tol' }),
    highlight: { active: ['n3', 'p3', 'e-n3-p3'], found: ['ctrl'] },
    explanation: 'A DaemonSet can target only some nodes using nodeSelector or affinity. Its Pods may also need tolerations so infrastructure agents can run on tainted or control-plane nodes.',
  };

  yield {
    state: labelMatrix(
      'Use cases',
      [
        { id: 'log', label: 'log' },
        { id: 'net', label: 'net' },
        { id: 'mon', label: 'mon' },
        { id: 'stor', label: 'stor' },
      ],
      [
        { id: 'need', label: 'need' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['node', 'gap'],
        ['CNI', 'boot'],
        ['metric', 'blind'],
        ['disk', 'data'],
      ],
    ),
    highlight: { active: ['log:need', 'net:need', 'mon:need'], found: ['net:risk'] },
    explanation: 'Coverage gaps are failures, not cosmetic differences. A node without logging, networking, monitoring, or storage agents may look schedulable while the platform is already degraded.',
  };
}

function* rollingDaemon() {
  yield {
    state: dsGraph('RollingUpdate replaces daemon Pods node by node', { p1: 'old', p2: 'new', p3: 'old', obs: 'mixed' }),
    highlight: { active: ['p2', 'obs', 'e-p2-obs'], compare: ['p1', 'p3'] },
    explanation: 'DaemonSet rollout is a coverage-preserving update. The controller replaces old daemon Pods while trying to keep enough node-local functionality alive.',
  };

  yield {
    state: labelMatrix(
      'Update knobs',
      [
        { id: 'max', label: 'maxUn' },
        { id: 'surge', label: 'surge' },
        { id: 'ready', label: 'ready' },
        { id: 'hist', label: 'hist' },
      ],
      [
        { id: 'job', label: 'job' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['limit', 'gap'],
        ['extra', 'cost'],
        ['gate', 'stuck'],
        ['undo', 'old'],
      ],
    ),
    highlight: { active: ['max:job', 'ready:job'], compare: ['surge:risk'] },
    explanation: 'Rollout policy trades freshness against coverage. maxUnavailable limits how many nodes can lack a ready daemon, while surge can spend extra resources to reduce gaps.',
  };

  yield {
    state: dsGraph('Node removal garbage-collects daemon Pods', { n3: 'removed', p3: 'delete', obs: 'covered' }),
    highlight: { active: ['n3', 'p3', 'obs', 'e-p3-obs'], found: ['ctrl'] },
    explanation: 'The desired set follows the current node set. Node removal deletes obsolete daemon Pods; node join creates a Pod only if the new node satisfies eligibility.',
  };

  yield {
    state: labelMatrix(
      'Complete case: log agent',
      [
        { id: 'join', label: 'join' },
        { id: 'taint', label: 'taint' },
        { id: 'roll', label: 'roll' },
        { id: 'gap', label: 'gap' },
      ],
      [
        { id: 'event', label: 'event' },
        { id: 'check', label: 'check' },
      ],
      [
        ['node+', 'pod+'],
        ['ctrl', 'tol'],
        ['v2', 'ready'],
        ['miss', 'alert'],
      ],
    ),
    highlight: { active: ['join:check', 'roll:check', 'gap:check'], found: ['taint:check'] },
    explanation: 'A log-agent DaemonSet should alert on uncovered eligible nodes. The happy path is node joins, daemon Pod appears, readiness passes, logs flow, and rollout preserves coverage.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'coverage map') yield* coverageMap();
  else if (view === 'rolling daemon') yield* rollingDaemon();
  else throw new InputError('Pick a Kubernetes DaemonSet view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation has two views. "Coverage map" shows how the DaemonSet controller reconciles desired versus actual Pods across a node set, with eligibility checks, taint evaluation, and per-node Pod creation. "Rolling daemon" shows how a template update propagates node by node while preserving coverage.',
        {type:'callout', text:'DaemonSet correctness is coverage, not replica count: every eligible node should converge to exactly one current daemon Pod.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/b/be/Kubernetes.png', alt:'Diagram of a Kubernetes control plane connected to two worker nodes with Pods.', caption:'High level Kubernetes architecture diagram by Khtan66, Wikimedia Commons, CC BY-SA 4.0.'},
        {
          type: 'bullets',
          items: [
            'Active (highlighted) nodes are the current reconciliation target: a node being evaluated for eligibility, a Pod being created, or a rollout step in progress.',
            'Compare marks show state that is uncertain or excluded: a tainted node whose toleration has not been confirmed, or an old-generation Pod awaiting replacement.',
            'Found marks are durable outcomes: a node confirmed eligible, a Pod running and ready, or a rollout step completed.',
          ],
        },
        {
          type: 'note',
          text: 'Safe inference rule: if a node matches the DaemonSet selector, passes affinity checks, and either has no taints or the Pod template tolerates all taints, the node is eligible and should have exactly one current daemon Pod. Any other count -- zero or more than one -- triggers a reconciliation action.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {
          type: 'quote',
          text: 'A DaemonSet ensures that all (or some) Nodes run a copy of a Pod. As nodes are added to the cluster, Pods are added to them. As nodes are removed from the cluster, those Pods are garbage collected.',
          attribution: 'Kubernetes official documentation, "DaemonSet" concept page',
        },
        'Some software is correct only when it runs on the machine it serves. A log collector needs the local /var/log filesystem. A CNI plugin needs the host network namespace to program routes and iptables rules. A node exporter needs access to /proc and /sys to report CPU, memory, disk, and network metrics from that specific kernel. A CSI node plugin needs local mount privileges to attach storage volumes. A GPU device plugin must enumerate PCI devices on its own host.',
        'These agents share a constraint: the unit of work is the node, not the cluster. Horizontal scaling by replica count is meaningless. What matters is coverage -- every eligible node must have exactly one running, ready instance of each required agent.',
        {
          type: 'table',
          headers: ['Node-local agent', 'Host resource it needs', 'What breaks without it'],
          rows: [
            ['CNI plugin (Calico, Cilium)', 'Host network namespace, iptables/eBPF', 'New Pods on the node get no network -- stuck in ContainerCreating'],
            ['kube-proxy / Cilium kube-proxy replacement', 'iptables / IPVS / eBPF maps', 'Service ClusterIPs do not resolve on the node'],
            ['Fluentd / Fluent Bit / Vector log shipper', '/var/log/containers, /var/lib/docker', 'Logs from that node silently vanish'],
            ['node-exporter (Prometheus)', '/proc, /sys, host PID namespace', 'Monitoring dashboards show gaps; alerts misfire'],
            ['CSI node plugin', 'Host mount namespace, /dev', 'PersistentVolume attach/mount fails for Pods on the node'],
            ['NVIDIA device plugin', 'Host /dev/nvidia*, NVML library', 'GPU not advertised; GPU workloads unschedulable'],
          ],
        },
        'A DaemonSet is the Kubernetes controller for this shape of work. It does not ask for N replicas placed somewhere in the cluster. It derives the desired set from the current node roster, filtered by selectors and affinity, and maintains one Pod per eligible node as nodes join, leave, drain, change labels, or gain taints.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first instinct is a Deployment with replicas equal to the node count and a pod anti-affinity rule to spread Pods across nodes. If the cluster has 50 nodes, set replicas: 50 and add a requiredDuringSchedulingIgnoredDuringExecution anti-affinity on the hostname topology key.',
        {
          type: 'code',
          language: 'yaml',
          text: '# Attempt 1: Deployment with anti-affinity\napiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: log-agent\nspec:\n  replicas: 50   # must be manually updated when nodes change\n  template:\n    spec:\n      affinity:\n        podAntiAffinity:\n          requiredDuringSchedulingIgnoredDuringExecution:\n          - labelSelector:\n              matchLabels:\n                app: log-agent\n            topologyKey: kubernetes.io/hostname',
        },
        'This works until someone adds or removes a node. The replica count is a static integer. The operator must notice the node change and patch the Deployment. Cluster autoscaling can add 20 nodes in a minute; nobody is patching a Deployment that fast.',
        'A second approach: install the agent as a systemd service baked into the node image. This avoids Kubernetes entirely but creates image drift -- different node pools may run different agent versions, and there is no standard API to roll out updates, check readiness, or correlate agent health with cluster state.',
        'A third approach: static Pods via manifests in /etc/kubernetes/manifests. The kubelet watches that directory and runs whatever it finds. This is how kube-apiserver, etcd, and kube-controller-manager run on kubeadm control-plane nodes. But static Pods lack update strategies, rollback, label-based targeting, and standard status reporting through the Kubernetes API.',
        {
          type: 'table',
          headers: ['Approach', 'Scales with nodes?', 'Update strategy?', 'Eligibility filtering?', 'Standard API status?'],
          rows: [
            ['Deployment + anti-affinity', 'No -- manual replica patching', 'Yes (RollingUpdate)', 'Partial -- anti-affinity only', 'Yes'],
            ['systemd in node image', 'Yes -- baked per image', 'No -- requires image rebuild', 'No', 'No'],
            ['Static Pod', 'Yes -- per kubelet', 'No -- manual file update', 'No', 'Partial (mirror Pod)'],
            ['DaemonSet', 'Yes -- derived from node set', 'Yes (RollingUpdate)', 'Yes (selector + affinity + tolerations)', 'Yes'],
          ],
        },
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is node churn combined with eligibility filtering. Nodes are not a fixed set. In a production cluster, nodes join when the autoscaler provisions capacity, leave when scale-down removes idle instances, drain during maintenance windows, become NotReady during kernel panics or network partitions, change labels when operators reclassify hardware, and gain taints when the node-problem-detector flags disk pressure or memory pressure.',
        {
          type: 'diagram',
          text: 'Timeline of a 100-node cluster over one hour:\n\n  t=0m   100 nodes, 100 daemon Pods, all Ready\n  t=5m   Autoscaler adds 12 nodes -> 112 nodes, only 100 Pods\n         12 new nodes have no log agent -- LOGS LOST\n  t=12m  Operator labels 8 nodes as gpu=true\n         DaemonSet selector excludes GPU nodes -> 8 Pods orphaned\n  t=20m  Maintenance drains 15 nodes -> 97 nodes\n         15 Pods evicted, need cleanup\n  t=35m  Scale-down removes 5 idle nodes -> 92 nodes\n  t=45m  Node kernel panic -> 1 node NotReady\n         node.kubernetes.io/not-ready taint applied\n         Does the daemon stay? Depends on tolerations.\n  t=60m  92 eligible nodes. Manual tracking: impossible.',
          label: 'Why a static replica count cannot track a live node set',
        },
        'The second wall is eligibility. Not every node should run every daemon. A GPU device plugin should only run on nodes with GPUs. A storage daemon targets nodes with the label storage-class=local-ssd. A control-plane monitoring agent needs to tolerate the node-role.kubernetes.io/control-plane:NoSchedule taint that normally blocks workloads from control-plane nodes.',
        {
          type: 'note',
          text: 'The combination of churn and eligibility is what makes the problem hard. A manual process must track which nodes exist, which labels each node has, which taints are set, and whether the current daemon version matches the DaemonSet spec -- continuously, across every node, through every cluster event. This is a reconciliation loop, not a one-time deployment.',
        },
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The invariant is: for every node N in the cluster, if N matches the DaemonSet scheduling constraints (node selector, node affinity, and tolerations), then exactly one Pod owned by this DaemonSet should exist on N, and that Pod should match the current template generation. The desired replica count is not an integer in the spec -- it is derived by scanning the node list every reconciliation cycle.',
        {
          type: 'diagram',
          text: 'Reconciliation logic (simplified):\n\nfor each node in cluster:\n  eligible = matchesSelector(node, ds.spec.selector)\n            AND satisfiesAffinity(node, ds.spec.template.spec.affinity)\n            AND allTaintsTolerated(node.taints, ds.spec.template.spec.tolerations)\n\n  existingPod = findDaemonPod(node, ds)\n\n  if eligible AND existingPod == nil:\n    CREATE Pod on node          # coverage gap\n  if eligible AND existingPod != nil AND existingPod.generation < ds.generation:\n    MARK for rolling update     # stale Pod\n  if NOT eligible AND existingPod != nil:\n    DELETE Pod from node        # orphaned Pod\n  if eligible AND existingPod != nil AND existingPod.generation == ds.generation:\n    OK -- no action needed      # covered',
          label: 'The DaemonSet controller reconciliation loop',
        },
        'This is a set-difference controller. The desired set is the eligible nodes. The actual set is the nodes that have a current-generation daemon Pod. The controller creates Pods for (desired - actual) and deletes Pods for (actual - desired). The Deployment controller does something similar but its desired set is an integer; the DaemonSet controller derives its desired set from live cluster topology.',
        {
          type: 'code',
          language: 'go',
          text: '// From kubernetes/pkg/controller/daemon/daemon_controller.go (simplified)\n// The real controller uses this pattern in its manage() method:\n\nnodesNeedingPods, podsToDelete := ds.getNodesToDaemonSetPods(ds, nodeList)\nfor _, node := range nodesNeedingPods {\n    // Create a Pod with NodeAffinity pinning it to this specific node\n    pod := ds.newPod(node)\n    pod.Spec.Affinity.NodeAffinity = pinToNode(node.Name)\n    createPod(pod)\n}\nfor _, pod := range podsToDelete {\n    deletePod(pod)\n}',
        },
        {
          type: 'note',
          text: 'Since Kubernetes 1.12, DaemonSet Pods are scheduled by the default scheduler, not by the DaemonSet controller directly. The controller creates a Pod with a NodeAffinity term that pins it to the target node. The scheduler then places it. This unified scheduling path means DaemonSet Pods respect resource requests, priority, preemption, and all other scheduling plugins.',
        },
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The DaemonSet controller runs as a control loop inside kube-controller-manager. It watches three resources: DaemonSet objects, Pod objects owned by DaemonSets, and Node objects. Any change to any of these triggers a reconciliation cycle for the affected DaemonSet.',
        {
          type: 'table',
          headers: ['Watch event', 'What triggers', 'Controller action'],
          rows: [
            ['Node added', 'New node appears in cluster', 'Evaluate eligibility; create daemon Pod if eligible'],
            ['Node deleted', 'Node removed from cluster', 'Owner reference cascade deletes the daemon Pod'],
            ['Node labels changed', 'Operator or automation modifies labels', 'Re-evaluate eligibility; create or delete Pod accordingly'],
            ['Node taint added/removed', 'Condition change or manual taint', 'Re-check tolerations; may create or delete Pod'],
            ['DaemonSet spec updated', 'Template, selector, or toleration change', 'Recompute eligible set; trigger rolling update for stale Pods'],
            ['Daemon Pod deleted', 'Eviction, node drain, manual delete', 'Recreate Pod if node is still eligible'],
            ['Daemon Pod failed', 'CrashLoopBackOff, OOM, image pull error', 'Kubelet restarts container; controller ensures Pod exists'],
          ],
        },
        'Node affinity pinning is the mechanism that ties each Pod to its intended node. When the controller decides node worker-17 needs a daemon Pod, it creates a Pod whose spec includes a required NodeAffinity term matching metadata.name=worker-17. The scheduler sees this constraint and places the Pod on worker-17 specifically.',
        'Tolerations determine whether tainted nodes are eligible. Kubernetes automatically adds several tolerations to DaemonSet Pods that it does not add to normal Pods:',
        {
          type: 'table',
          headers: ['Auto-added toleration', 'Effect', 'Why'],
          rows: [
            ['node.kubernetes.io/not-ready', 'NoExecute', 'Network agents and log shippers should survive brief NotReady windows'],
            ['node.kubernetes.io/unreachable', 'NoExecute', 'Same rationale -- the daemon may still serve locally'],
            ['node.kubernetes.io/disk-pressure', 'NoSchedule', 'Infrastructure agents should run even under disk pressure'],
            ['node.kubernetes.io/memory-pressure', 'NoSchedule', 'Node exporters and CNI plugins are critical under memory pressure'],
            ['node.kubernetes.io/unschedulable', 'NoSchedule', 'Daemons should run on cordoned nodes awaiting drain'],
            ['node.kubernetes.io/network-unavailable', 'NoSchedule', 'CNI plugins must run to fix the network -- chicken-and-egg problem'],
          ],
        },
        {
          type: 'note',
          text: 'The network-unavailable toleration is a subtle but critical design choice. Without a CNI plugin, the node reports NetworkUnavailable=True and gets tainted. But the CNI plugin itself is delivered as a DaemonSet Pod. If DaemonSet Pods did not tolerate this taint, the CNI could never start, and the node would be permanently broken. This is the classic chicken-and-egg problem that the auto-toleration solves.',
        },
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness rests on three properties of the reconciliation loop.',
        {
          type: 'bullets',
          items: [
            'Convergence: the controller repeatedly computes desired state from current node/label/taint state and drives actual state toward it. Transient failures (image pull errors, scheduling conflicts) are retried on the next sync cycle. The gap between desired and actual monotonically shrinks under stable conditions.',
            'Idempotency: creating a Pod that already exists is a no-op (the controller checks before creating). Deleting a Pod that is already gone is a no-op. The controller can safely re-run after crashes, restarts, or leader election failovers.',
            'Derived desired state: the desired count is not a stale configuration value. It is recomputed from the live node list on every cycle. A node that joins at 3 AM while the operator is asleep still gets a daemon Pod within seconds, because the controller watches Node objects and triggers reconciliation.',
          ],
        },
        'The controller also uses owner references. Every daemon Pod has an ownerReference pointing to its DaemonSet. If the DaemonSet is deleted, Kubernetes garbage collection cascades and deletes all owned Pods. If a node is deleted, the Pods bound to it are also cleaned up. This prevents orphaned daemon Pods from consuming resources after their purpose is gone.',
        {
          type: 'quote',
          text: 'A controller is a reconciliation loop that drives current state toward desired state. The key insight is that desired state is defined declaratively, and the controller handles all the imperative work of creating, updating, and deleting resources.',
          attribution: 'Kubernetes design principles, "Controllers" documentation',
        },
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'table',
          headers: ['Cost dimension', 'How it scales', 'Concrete example'],
          rows: [
            ['Memory per node', 'O(1) per daemon per node', '200 MiB request x 500 nodes = 100 GiB cluster-wide reservation'],
            ['CPU per node', 'O(1) per daemon per node', '100m request x 500 nodes = 50 full cores reserved'],
            ['API server watches', 'O(DaemonSets x Nodes)', '10 DaemonSets watching 500 nodes = 5,000 watch events per node change'],
            ['Reconciliation cost', 'O(nodes) per sync cycle', 'Each cycle scans all nodes and all owned Pods'],
            ['Rollout time', 'O(nodes / maxUnavailable)', '500 nodes with maxUnavailable=10% = ~50 batches, ~25 minutes at 30s/batch'],
            ['Image pull bandwidth', 'O(nodes) on rollout', 'New 500 MB image across 500 nodes = 250 GB total pull traffic'],
            ['Host privileges', 'Multiplied by node count', 'A privileged container with hostPID runs on every eligible node'],
          ],
        },
        'The critical insight about DaemonSet cost is that it scales with infrastructure, not with application demand. A Deployment serving 10 requests per second and a Deployment serving 10,000 requests per second might both run on the same 100-node cluster. But the DaemonSet log shipper runs 100 Pods regardless of traffic. Adding nodes for capacity also adds daemon Pods whether or not those daemons have proportionally more work.',
        'Blast radius is the operational cost. A Deployment bug affects the replicas of that Deployment. A DaemonSet bug affects every eligible node in the cluster. A bad image, a misconfigured readiness probe, an excessive resource request, or an overly broad selector can degrade every node simultaneously. DaemonSet changes deserve stricter review than typical application changes.',
        {
          type: 'note',
          text: 'Watch pressure is an often-overlooked cost. Each DaemonSet controller maintains watches on Nodes, Pods, and DaemonSets. In large clusters (1,000+ nodes) with many DaemonSets (10-20), the API server handles substantial watch traffic on every node lifecycle event. This is one reason the Kubernetes community recommends keeping the number of distinct DaemonSets small.',
        },
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Trace a Fluent Bit log-shipping DaemonSet through a sequence of cluster events.',
        {
          type: 'code',
          language: 'yaml',
          text: 'apiVersion: apps/v1\nkind: DaemonSet\nmetadata:\n  name: fluent-bit\n  namespace: logging\nspec:\n  selector:\n    matchLabels:\n      app: fluent-bit\n  updateStrategy:\n    type: RollingUpdate\n    rollingUpdate:\n      maxUnavailable: 1\n  template:\n    metadata:\n      labels:\n        app: fluent-bit\n    spec:\n      tolerations:\n      - key: node-role.kubernetes.io/control-plane\n        effect: NoSchedule\n      containers:\n      - name: fluent-bit\n        image: fluent/fluent-bit:3.1\n        resources:\n          requests: { cpu: 100m, memory: 128Mi }\n          limits:   { memory: 256Mi }\n        volumeMounts:\n        - name: varlog\n          mountPath: /var/log\n          readOnly: true\n      volumes:\n      - name: varlog\n        hostPath:\n          path: /var/log',
        },
        {
          type: 'table',
          headers: ['Event', 'Cluster state', 'Controller action', 'Result'],
          rows: [
            ['DaemonSet created', '3 control-plane + 10 worker nodes', 'All 13 eligible (control-plane toleration present). Create 13 Pods.', '13/13 covered, desiredNumberScheduled=13'],
            ['Autoscaler adds 5 workers', '18 nodes total', 'Detect 5 nodes with no daemon Pod. Create 5 Pods.', '18/18 covered'],
            ['Operator taints 2 GPU nodes with gpu=true:NoSchedule', '18 nodes, 2 newly tainted', 'Fluent Bit has no toleration for gpu=true. Delete 2 Pods.', '16/16 eligible covered'],
            ['Operator adds gpu toleration to DaemonSet', '18 nodes, all now eligible', 'Detect 2 GPU nodes with no Pod. Create 2 Pods.', '18/18 covered'],
            ['Image update: fluent-bit:3.1 -> 3.2', '18 nodes, 18 stale Pods', 'RollingUpdate with maxUnavailable=1. Delete old Pod on node-1, wait for new Pod ready, proceed to node-2...', '18 updates, 1 at a time'],
            ['Maintenance: drain 3 workers', '15 nodes', 'Eviction removes 3 Pods. Nodes deleted. Owner ref cleanup.', '15/15 covered'],
            ['Node kernel panic: worker-7 NotReady', '15 nodes, 1 NotReady', 'Auto-toleration for not-ready keeps Pod running. Fluent Bit may still ship buffered logs.', '15/15 Pods exist, 14 Ready'],
          ],
        },
        {
          type: 'code',
          language: 'bash',
          text: '# Verify coverage at any point:\n$ kubectl get ds fluent-bit -n logging\nNAME        DESIRED   CURRENT   READY   UP-TO-DATE   AVAILABLE   NODE SELECTOR   AGE\nfluent-bit  15        15        14      15            14          <none>          47d\n\n# Find uncovered eligible nodes:\n$ kubectl get nodes -o name | while read node; do\n    kubectl get pods -n logging -l app=fluent-bit \\\n      --field-selector spec.nodeName=$(basename $node) -o name | \\\n      grep -q . || echo "UNCOVERED: $node"\n  done\n\n# Inspect a specific daemon Pod:\n$ kubectl describe pod fluent-bit-xk9q2 -n logging | grep -A5 "Node-Selectors\\|Tolerations\\|Conditions"',
        },
        'The audit question during an incident is never "how many replicas exist?" It is "which eligible nodes lack a ready, current-generation daemon Pod, and why?" The kubectl commands above answer exactly that.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        {
          type: 'table',
          headers: ['Use case', 'Why DaemonSet', 'Example project'],
          rows: [
            ['Container networking (CNI)', 'Must program host network on every node before any Pod can start', 'Calico, Cilium, Flannel, Weave Net'],
            ['Service proxy', 'Handles ClusterIP/NodePort traffic on the local node', 'kube-proxy, Cilium kube-proxy replacement'],
            ['Log collection', 'Needs host /var/log and container runtime socket', 'Fluent Bit, Fluentd, Vector, Filebeat'],
            ['Metrics collection', 'Needs /proc, /sys, host PID namespace for per-node metrics', 'Prometheus node-exporter, Datadog Agent'],
            ['Storage node plugin (CSI)', 'Needs host mount namespace to attach and mount volumes', 'EBS CSI, GCE PD CSI, Longhorn, Rook-Ceph'],
            ['GPU device plugin', 'Must enumerate local GPU hardware via NVML/ROCm', 'NVIDIA device plugin, AMD device plugin'],
            ['Security agent', 'Needs host PID and NET for syscall audit, eBPF programs', 'Falco, Tetragon, Aqua, Sysdig'],
            ['DNS cache', 'Reduces per-node DNS latency by caching on localhost', 'NodeLocal DNSCache (node-local-dns)'],
          ],
        },
        'The common pattern across all these use cases: the agent needs host-level access that is inherently per-node, the agent must exist before or alongside application workloads, and the number of instances should track the number of qualifying machines rather than application traffic.',
        {
          type: 'note',
          text: 'NodeLocal DNSCache is an interesting case. It runs as a DaemonSet that binds a local IP (169.254.20.10) on every node. Pods use this local address for DNS instead of the cluster DNS service IP. The DaemonSet ensures every node has a cache, avoiding cross-node DNS traffic. If the cache Pod is missing on a node, DNS resolution falls back to the cluster service -- degraded but not broken.',
        },
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Traffic-scaled workloads: a web server that needs 3 replicas under light load and 30 under heavy load should be a Deployment with HPA, not a DaemonSet. DaemonSets scale with nodes, not with demand.',
            'Batch and job workloads: a task that runs to completion does not need permanent per-node presence. Use a Job or CronJob instead.',
            'Cross-node aggregation: a service that aggregates data from multiple nodes (e.g., a cluster-wide metrics server) needs one or a few replicas, not one per node.',
            'Scale-down friction: every new node from the autoscaler brings another daemon Pod. If the cluster is scaling up for a batch job, the daemon overhead per node is wasted once the batch completes and nodes scale down.',
            'Selector mistakes: an overly broad selector (or no selector) runs the daemon on every node, including nodes where it is useless or harmful. A GPU monitoring agent on a CPU-only node wastes memory and generates misleading empty metrics.',
          ],
        },
        {
          type: 'table',
          headers: ['Failure mode', 'Symptom', 'Root cause', 'Fix'],
          rows: [
            ['Coverage gap', 'Logs missing from new nodes', 'Autoscaled nodes have a new taint the DaemonSet does not tolerate', 'Add the missing toleration to the DaemonSet spec'],
            ['Orphaned Pods', 'Daemon Pods on nodes where they should not run', 'Node labels changed but controller has not reconciled yet, or selector is wrong', 'Fix selector; wait for next sync; or manually delete'],
            ['Rollout stuck', 'updatedNumberScheduled stuck below desiredNumberScheduled', 'New Pod fails readiness probe on one node, blocking maxUnavailable=1 rollout', 'Fix the probe, fix the image, or increase maxUnavailable'],
            ['Resource exhaustion', 'Nodes at memory/CPU limit after adding DaemonSet', 'DaemonSet resource requests exceed remaining capacity on small nodes', 'Right-size requests; use resource limits; reserve capacity in node sizing'],
            ['Privilege escalation surface', 'Security scan flags hostPID, hostNetwork, privileged', 'DaemonSet legitimately needs host access, but scope is too broad', 'Use SecurityContext to limit to specific capabilities; drop ALL and add only what is needed'],
            ['Image pull storm', 'Registry throttled during rollout across 500 nodes', 'All nodes pull the same new image simultaneously', 'Use maxUnavailable to stagger; pre-pull images; use a local registry mirror'],
          ],
        },
        'The deepest failure is confusing Pod existence with functional coverage. A daemon Pod can exist on every node and still fail to collect logs, program routes, report metrics, or advertise devices. Production monitoring must check the downstream signal the daemon produces, not just the Pod count.',
      ],
    },
    {
      heading: 'Rolling updates',
      paragraphs: [
        'DaemonSet rollout is fundamentally different from Deployment rollout. In a Deployment, an unavailable Pod means reduced throughput -- load balancing distributes traffic to the remaining replicas. In a DaemonSet, an unavailable Pod means an uncovered node. There is no load balancer. The node simply lacks its agent.',
        {
          type: 'code',
          language: 'yaml',
          text: '# Rollout configuration for a safety-critical daemon:\nupdateStrategy:\n  type: RollingUpdate\n  rollingUpdate:\n    maxUnavailable: 1        # only 1 node uncovered at a time\n    maxSurge: 0              # no extra Pods (default)\n# With maxSurge (Kubernetes 1.22+, beta):\n    # maxSurge: 1            # create new Pod before deleting old\n    # maxUnavailable: 0      # zero coverage gap per node',
        },
        {
          type: 'table',
          headers: ['Rollout parameter', 'What it controls', 'Tradeoff'],
          rows: [
            ['maxUnavailable', 'Max nodes without a ready daemon during update', 'Higher = faster rollout but more simultaneous coverage gaps'],
            ['maxSurge', 'Max extra daemon Pods created during update', 'Higher = shorter gap per node but temporary double resource usage'],
            ['minReadySeconds', 'Time a new Pod must be Ready before next node updates', 'Higher = slower rollout but catches delayed failures'],
            ['revisionHistoryLimit', 'Number of old ControllerRevisions kept', 'Higher = easier rollback but more stored objects'],
          ],
        },
        'The safest rollout combination is maxSurge=1 with maxUnavailable=0. This creates the new daemon Pod on a node first, waits for it to become Ready, then deletes the old Pod. The node is never without a running daemon. The cost is temporary double resource usage on each node during its update window.',
        {
          type: 'note',
          text: 'Readiness probe quality is the hidden variable in rollout safety. If the readiness probe checks only "process is alive" instead of "agent is actually collecting logs / programming routes / serving metrics," the rollout controller will mark a broken Pod as Ready, proceed to the next node, and leave the previously updated node silently degraded. Every DaemonSet readiness probe should check the actual function the daemon performs.',
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'table',
          headers: ['Source', 'What it covers'],
          rows: [
            ['https://kubernetes.io/docs/concepts/workloads/controllers/daemonset/', 'Official DaemonSet concept: scheduling, update strategies, communication patterns'],
            ['https://kubernetes.io/docs/concepts/scheduling-eviction/taint-and-toleration/', 'Taints and tolerations: how DaemonSets reach otherwise-blocked nodes'],
            ['https://kubernetes.io/docs/concepts/architecture/nodes/', 'Node lifecycle: conditions, taints, labels, capacity, and heartbeats'],
            ['kubernetes/pkg/controller/daemon/daemon_controller.go', 'Source code for the DaemonSet controller reconciliation loop'],
            ['https://kubernetes.io/docs/tasks/manage-daemon/update-daemon-set/', 'DaemonSet rolling update walkthrough with kubectl commands'],
          ],
        },
        {
          type: 'bullets',
          items: [
            'Prerequisite: Kubernetes Taints and Tolerations Node Pool -- the mechanism DaemonSets use to decide which nodes are eligible when taints are present.',
            'Prerequisite: Kubernetes Affinity and Topology Spread Placement -- node affinity rules that further constrain where daemon Pods land.',
            'Extension: Kubernetes Deployment Rolling Update -- compare count-based rollout (Deployment) with coverage-based rollout (DaemonSet) to see why the same parameters have different operational meanings.',
            'Related: Kubernetes Node Pressure Eviction Signal -- what happens to daemon Pods when a node is under resource pressure, and how auto-tolerations interact with eviction.',
            'Production case: Kubernetes Service and EndpointSlice Traffic -- how kube-proxy (itself a DaemonSet) programs iptables or IPVS rules that make Services work on each node.',
          ],
        },
      ],
    },
  ],
};
