// Kubernetes node-pressure eviction: the kubelet watches local resource signals,
// reclaims node resources, then evicts Pods when starvation risk crosses policy.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'kubernetes-node-pressure-eviction-signal-case-study',
  title: 'Kubernetes Node Pressure Eviction Signal Case Study',
  category: 'Systems',
  summary: 'How kubelet monitors memory, disk, imagefs, containerfs, inodes, soft and hard thresholds, local reclaim, QoS, priority, and replacement after eviction.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['signal ladder', 'eviction choice'], defaultValue: 'signal ladder' },
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

function evictionGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'kubelet', label: 'kubelet', x: 0.7, y: 3.8, note: notes.kubelet ?? 'monitor' },
      { id: 'mem', label: 'mem', x: 2.4, y: 2.0, note: notes.mem ?? 'avail' },
      { id: 'disk', label: 'disk', x: 2.4, y: 3.8, note: notes.disk ?? 'space' },
      { id: 'inode', label: 'inode', x: 2.4, y: 5.6, note: notes.inode ?? 'files' },
      { id: 'reclaim', label: 'reclaim', x: 4.5, y: 3.0, note: notes.reclaim ?? 'images' },
      { id: 'rank', label: 'rank', x: 4.5, y: 4.9, note: notes.rank ?? 'victims' },
      { id: 'podA', label: 'pod A', x: 6.6, y: 2.2, note: notes.podA ?? 'Burst' },
      { id: 'podB', label: 'pod B', x: 6.6, y: 4.0, note: notes.podB ?? 'Best' },
      { id: 'ctrl', label: 'ctrl', x: 8.5, y: 3.1, note: notes.ctrl ?? 'replace' },
      { id: 'sched', label: 'sched', x: 8.5, y: 5.1, note: notes.sched ?? 'resched' },
    ],
    edges: [
      { id: 'e-k-mem', from: 'kubelet', to: 'mem' },
      { id: 'e-k-disk', from: 'kubelet', to: 'disk' },
      { id: 'e-k-inode', from: 'kubelet', to: 'inode' },
      { id: 'e-mem-reclaim', from: 'mem', to: 'reclaim' },
      { id: 'e-disk-reclaim', from: 'disk', to: 'reclaim' },
      { id: 'e-reclaim-rank', from: 'reclaim', to: 'rank' },
      { id: 'e-rank-podA', from: 'rank', to: 'podA' },
      { id: 'e-rank-podB', from: 'rank', to: 'podB' },
      { id: 'e-podB-ctrl', from: 'podB', to: 'ctrl' },
      { id: 'e-ctrl-sched', from: 'ctrl', to: 'sched' },
    ],
  }, { title });
}

function* signalLadder() {
  yield {
    state: evictionGraph('The kubelet watches local pressure signals'),
    highlight: { active: ['kubelet', 'mem', 'disk', 'inode', 'e-k-mem', 'e-k-disk', 'e-k-inode'], compare: ['rank'] },
    explanation: 'Node-pressure eviction is local. The kubelet monitors node resources such as memory, disk space, and inodes and acts before the node starves.',
    invariant: 'Eviction is a kubelet survival mechanism, not a voluntary disruption budget flow.',
  };

  yield {
    state: labelMatrix(
      'Signals',
      [
        { id: 'mem', label: 'mem' },
        { id: 'nodefs', label: 'nodefs' },
        { id: 'imagefs', label: 'imgfs' },
        { id: 'inode', label: 'inode' },
      ],
      [
        { id: 'watch', label: 'watch' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['avail', 'OOM'],
        ['bytes', 'write'],
        ['bytes', 'pull'],
        ['free', 'create'],
      ],
    ),
    highlight: { active: ['mem:watch', 'nodefs:watch', 'inode:watch'], found: ['imagefs:risk'] },
    explanation: 'The signals are resource-specific. A node can be fine on memory while failing image pulls because imagefs is full, or fail file creation because inodes are exhausted.',
  };

  yield {
    state: evictionGraph('Kubelet tries node-level reclaim before evicting Pods', { reclaim: 'GC images', rank: 'if still bad' }),
    highlight: { active: ['reclaim', 'rank', 'e-reclaim-rank'], found: ['disk'] },
    explanation: 'Before evicting end-user Pods, kubelet tries reclaim such as deleting unused images when disk pressure is the issue. If pressure remains, it ranks Pods for eviction.',
  };

  yield {
    state: labelMatrix(
      'Threshold policy',
      [
        { id: 'soft', label: 'soft' },
        { id: 'hard', label: 'hard' },
        { id: 'grace', label: 'grace' },
        { id: 'poll', label: 'poll' },
      ],
      [
        { id: 'job', label: 'job' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['warn', 'delay'],
        ['stop', '0s'],
        ['bound', 'late'],
        ['sample', 'miss'],
      ],
    ),
    highlight: { active: ['soft:job', 'hard:job', 'grace:job'], compare: ['poll:risk'] },
    explanation: 'Soft thresholds allow a grace period. Hard thresholds act immediately. The exact policy changes how much time a Pod has after the node crosses danger levels.',
  };
}

function* evictionChoice() {
  yield {
    state: evictionGraph('When reclaim fails, kubelet ranks victim Pods', { rank: 'choose', podA: 'keep?', podB: 'evict' }),
    highlight: { active: ['rank', 'podB', 'e-rank-podB'], compare: ['podA'] },
    explanation: 'The kubelet is choosing the cheapest Pod loss that relieves the breached local resource. Requests, QoS, priority, and actual usage decide which eviction best preserves node survival.',
  };

  yield {
    state: labelMatrix(
      'Victim ledger',
      [
        { id: 'qos', label: 'QoS' },
        { id: 'req', label: 'req' },
        { id: 'use', label: 'use' },
        { id: 'prio', label: 'prio' },
      ],
      [
        { id: 'helps', label: 'helps' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['protect', 'Best'],
        ['right', 'zero'],
        ['low', 'spike'],
        ['high', 'abuse'],
      ],
    ),
    highlight: { active: ['qos:helps', 'req:helps', 'prio:helps'], compare: ['use:risk'] },
    explanation: 'Good requests are eviction hygiene. A workload with no requests is easier to classify as expendable under pressure, and bursty usage can make it the cheapest way to save the node.',
  };

  yield {
    state: evictionGraph('Evicted Pods become Failed and controllers replace them', { podB: 'Failed', ctrl: 'new pod', sched: 'elsewhere' }),
    highlight: { active: ['podB', 'ctrl', 'sched', 'e-podB-ctrl', 'e-ctrl-sched'], found: ['rank'] },
    explanation: 'During node-pressure eviction, selected Pods are failed and terminated. If a Deployment or StatefulSet owns them, the control plane creates replacements that re-enter scheduling.',
  };

  yield {
    state: labelMatrix(
      'Complete case: imagefs full',
      [
        { id: 'sig', label: 'sig' },
        { id: 'gc', label: 'GC' },
        { id: 'evict', label: 'evict' },
        { id: 'fix', label: 'fix' },
      ],
      [
        { id: 'event', label: 'event' },
        { id: 'lesson', label: 'lesson' },
      ],
      [
        ['imgfs', 'watch'],
        ['images', 'first'],
        ['batch', 'last'],
        ['quota', 'root'],
      ],
    ),
    highlight: { active: ['sig:event', 'gc:lesson', 'evict:event'], found: ['fix:lesson'] },
    explanation: 'If imagefs fills, kubelet first removes unused images. If pressure stays above threshold, it evicts lower-value Pods. The durable fix is right-sized disk, image cleanup, requests, and workload admission controls.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'signal ladder') yield* signalLadder();
  else if (view === 'eviction choice') yield* evictionChoice();
  else throw new InputError('Pick a Kubernetes node-pressure eviction view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The signal-ladder view shows the kubelet as a local feedback controller. Nodes highlighted as active are currently being sampled or acted on. The left-to-right flow shows the order of responsibility: observe resource signals, compare with policy, try reclaim, then rank victims only if the signal still threatens the node. Edges between nodes represent causal dependencies, not data flow.',
        'The eviction-choice view shows victim selection as a constrained optimization. The compare highlight marks the Pod that survives; the active highlight marks the Pod being evicted. The separation between the eviction side (kubelet, rank, Pods) and the replacement side (ctrl, sched) is deliberate. Kubelet evicts locally; workload controllers and the scheduler handle replacement globally. Confusing those two loops is the most common debugging mistake in eviction incidents.',
        {
          type: 'note',
          text: 'Inference rule: if reclaim is highlighted as active and rank is highlighted as compare, the kubelet is still attempting node-level cleanup. Eviction has not started. If rank becomes active, reclaim failed and the kubelet is now choosing victims.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Kubernetes scheduling is an admission decision, not a runtime guarantee. The scheduler places Pods using requests, node capacity, taints, and affinity. After placement, the kubelet lives with actual memory consumption, actual writable container layers, actual log volume, actual image storage, and actual inode creation on one physical or virtual machine.',
        'Local resources fail locally. A cluster may have spare capacity across 200 nodes while one node cannot allocate memory, pull an image, write a log, or keep its own kubelet process alive. If the kubelet waits until the Linux OOM killer fires or a disk-full error breaks a write syscall, the failure is late, unranked, and harder for the control plane to explain or recover from.',
        {
          type: 'quote',
          attribution: 'Kubernetes design principle',
          text: 'The kubelet must protect the node before protecting any single non-critical Pod. Some Pod loss is less damaging than losing the node and every Pod on it.',
        },
        'Node-pressure eviction is the kubelet acting as a local safety controller: it monitors resource signals, compares them with operator-configured thresholds, attempts cheap reclaim, and evicts Pods only when reclaim cannot restore headroom. The Kubernetes documentation classifies these as involuntary disruptions -- PodDisruptionBudgets govern voluntary maintenance drains, not unavoidable local starvation.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'A reasonable first design is to trust the scheduler and the operating system. The scheduler already avoids placing more requested CPU and memory than a node advertises. Linux has an OOM killer, filesystem accounting, page reclaim, and process-level cgroups. For small clusters with conservative bin-packing, this appears to work.',
        {
          type: 'table',
          headers: ['Attempt', 'What it gives', 'Why it is not enough'],
          rows: [
            ['Trust the scheduler', 'Requests fit at admission time', 'Actual usage diverges from requests after placement; burst, logs, and images are not scheduled resources'],
            ['Trust the OS OOM killer', 'Prevents total memory exhaustion', 'Kills a process, not a Kubernetes workload intent; no ranking by priority, QoS, or request honesty'],
            ['Overprovision hardware', 'Larger safety margin', 'Does not define which workload loses first; expensive; does not explain incidents after the fact'],
            ['Manual cleanup', 'Works during an incident', 'Pressure can arrive faster than an operator can SSH in; not automatic; not reproducible'],
          ],
        },
        'Each of these approaches solves part of the problem. None of them provides a policy loop that turns raw resource measurements into ranked Kubernetes-aware decisions before the operating system makes a blunt one.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is the gap between what the scheduler knows at admission and what actually happens on a node at runtime. Three specific failures expose it.',
        {
          type: 'bullets',
          items: [
            'Request-to-usage divergence: a Pod requests 256 Mi of memory and bursts to 1.5 Gi. The scheduler saw 256 Mi; the node feels 1.5 Gi. Multiply by 40 Pods and the node is in OOM territory without ever being over-scheduled.',
            'Non-scheduled local resources: container writable layers, image storage, log files, and inodes are not part of the scheduling equation. A deployment wave that pulls 30 large images can fill imagefs without any Pod exceeding its CPU or memory request.',
            'Daemon starvation: kubelet, containerd, the CNI plugin, kube-proxy, and logging agents all need memory, disk, and PIDs. If application Pods consume the headroom these daemons need, the node loses the ability to manage itself. A node that cannot run its kubelet cannot report its own condition to the control plane.',
          ],
        },
        'The operating system cannot solve this because its failure primitives are too low-level. The OOM killer chooses a process by oom_score_adj; it does not know about Pod priority, QoS class, or which Deployment owns the container. A disk-full error hits whichever write() arrives next, not the container producing the most pressure. The kubelet needs a policy layer between raw OS signals and Kubernetes workload semantics.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Node-pressure eviction is a signal ladder. The kubelet observes a set of resource signals, compares each against soft and hard thresholds, attempts resource-specific reclaim, and evicts Pods only when reclaim fails to restore safety. The key design move is that eviction follows the breached resource: memory pressure triggers memory-relieving evictions, disk pressure triggers filesystem reclaim, inode pressure targets inode recovery.',
        {
          type: 'diagram',
          alt: 'Kubelet eviction signal ladder from observation to Pod termination',
          label: 'Signal ladder: observe, compare, reclaim, rank, evict',
          body: [
            'OBSERVE          COMPARE         RECLAIM          RANK           EVICT',
            '  |                 |               |               |              |',
            '  v                 v               v               v              v',
            'memory.available  < hard?  ------> (no reclaim)     sort by       terminate',
            'nodefs.available  < soft   ------> GC dead pods     usage vs      mark Failed',
            'imagefs.available   for     ------> GC unused imgs   request,     report event',
            'nodefs.inodesFree   grace   ------> delete logs      priority,   controller',
            'pid.available       period?         (if applicable)  QoS class    replaces',
          ].join('\n'),
          text: [
            'OBSERVE          COMPARE         RECLAIM          RANK           EVICT',
            '  |                 |               |               |              |',
            '  v                 v               v               v              v',
            'memory.available  < hard?  ------> (no reclaim)     sort by       terminate',
            'nodefs.available  < soft   ------> GC dead pods     usage vs      mark Failed',
            'imagefs.available   for     ------> GC unused imgs   request,     report event',
            'nodefs.inodesFree   grace   ------> delete logs      priority,   controller',
            'pid.available       period?         (if applicable)  QoS class    replaces',
          ].join('\n'),
        },
        'The invariant: at every step, the kubelet either recovers the breached resource directly (reclaim) or removes the Pod whose removal best relieves that specific resource while preserving higher-value work. A generic "kill something" rule would be simpler to implement but weaker, because it might terminate a Pod that does not relieve the actual bottleneck.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The kubelet samples eviction signals at its housekeeping interval (default 10 seconds). Each signal maps to a specific local resource.',
        {
          type: 'table',
          headers: ['Signal', 'What it measures', 'Filesystem', 'Risk if exhausted'],
          rows: [
            ['memory.available', 'Node allocatable memory minus working set', 'N/A', 'OOM kills by kernel, kubelet itself may die'],
            ['nodefs.available', 'Bytes free on the primary filesystem', 'nodefs (/, /var)', 'Log writes fail, emptyDir volumes stop, Pod sandbox creation fails'],
            ['nodefs.inodesFree', 'Free inodes on primary filesystem', 'nodefs', 'Cannot create new files even with free bytes'],
            ['imagefs.available', 'Bytes free on the image layer filesystem', 'imagefs (if split)', 'Image pulls fail, new Pods cannot start'],
            ['imagefs.inodesFree', 'Free inodes on image filesystem', 'imagefs', 'Cannot store new image layers'],
            ['pid.available', 'Free process IDs in the node PID space', 'N/A', 'Fork fails for all containers and daemons'],
          ],
        },
        'Memory availability is computed from the cgroup hierarchy, not from naive /proc/meminfo free pages. The kubelet accounts for the total memory minus kube-reserved, system-reserved, and the eviction threshold itself when advertising allocatable capacity. This means the threshold and the scheduling math are coordinated -- but actual usage can still exceed what was scheduled.',
        {
          type: 'code',
          language: 'yaml',
          body: [
            '# Example kubelet eviction configuration in KubeletConfiguration',
            'apiVersion: kubelet.config.k8s.io/v1beta1',
            'kind: KubeletConfiguration',
            'evictionHard:',
            '  memory.available: "100Mi"',
            '  nodefs.available: "10%"',
            '  imagefs.available: "15%"',
            '  nodefs.inodesFree: "5%"',
            'evictionSoft:',
            '  memory.available: "300Mi"',
            '  nodefs.available: "15%"',
            'evictionSoftGracePeriod:',
            '  memory.available: "1m30s"',
            '  nodefs.available: "1m30s"',
            'evictionMinimumReclaim:',
            '  memory.available: "0Mi"',
            '  nodefs.available: "500Mi"',
            '  imagefs.available: "2Gi"',
          ].join('\n'),
        },
        'Each signal is compared against configured thresholds. A hard threshold triggers immediate action: once memory.available drops below 100 Mi, the kubelet starts eviction on its next housekeeping pass. A soft threshold requires the signal to remain below the line for a grace period (evictionSoftGracePeriod) before action. This distinction prevents short-lived spikes from killing Pods while still catching sustained starvation.',
        'Before evicting user Pods, the kubelet tries node-level reclaim. For disk pressure, this means garbage collecting terminated Pod sandboxes and containers, then deleting unused images (oldest first by last-used time). For memory pressure, there is no equivalent cheap reclaim -- the kubelet proceeds directly to Pod eviction because freeing memory requires stopping the process that holds it.',
        'If reclaim does not restore headroom, the kubelet ranks Pods for eviction. The ranking for memory pressure works in two tiers. First, Pods whose total memory usage exceeds their total memory requests are ranked ahead of Pods within their requests. Within each tier, Pods are sorted by priority (lower priority evicted first), then by memory usage relative to requests (the Pod consuming the most above its request goes first). For disk and inode pressure, the ranking uses local disk consumption. For PID pressure, there are no requests, so priority alone governs.',
        {
          type: 'note',
          text: 'QoS class (Guaranteed, Burstable, BestEffort) is often used as a mental shorthand for eviction order, and it correlates well: BestEffort Pods have no requests and are always "above request." But the kubelet documentation is explicit that QoS class is not the direct sorting key -- usage vs. request and priority are.',
        },
        'An evicted Pod is terminated with a configurable grace period, its status is set to Failed with reason "Evicted," and an event is recorded on the Pod object. If a controller (Deployment, StatefulSet, Job, DaemonSet) owns the Pod, it creates a replacement that re-enters normal scheduling. The replacement is not guaranteed to land on the same node, and it must still pull images, start containers, and pass readiness probes before serving traffic.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is a survival invariant, not an optimality proof. At every step, the kubelet either recovers the resource directly or removes the Pod whose removal best relieves the specific breached resource while causing the least damage to high-value work. If neither path succeeds, the node remains at risk and will fall back to operating-system failure -- but that fallback is strictly worse because it is unranked.',
        'Resource-specific ranking makes eviction defensible. Consider memory pressure: the kubelet evicts the Pod that is consuming the most memory above its request. This preserves the contract that a Pod staying within its requests should be safer than one that burst beyond them. If the kubelet instead evicted the Pod using the most absolute memory, a well-behaved 2 Gi Pod with a 2 Gi request would die before a 500 Mi Pod with a 0 Mi request that is equally responsible for the pressure.',
        {
          type: 'diagram',
          alt: 'Why usage-above-request ranking is more fair than absolute usage ranking',
          label: 'Eviction ranking: usage above request vs. absolute usage',
          body: [
            'Pod A: request=2Gi, usage=2.1Gi, above_request=100Mi  <- well-behaved',
            'Pod B: request=0,   usage=800Mi, above_request=800Mi  <- burst',
            '',
            'Absolute ranking evicts A first (2.1Gi > 800Mi)  -- UNFAIR',
            'Above-request ranking evicts B first (800Mi > 100Mi) -- FAIR',
            '',
            'The above-request ranking punishes burst, not size.',
          ].join('\n'),
          text: [
            'Pod A: request=2Gi, usage=2.1Gi, above_request=100Mi  <- well-behaved',
            'Pod B: request=0,   usage=800Mi, above_request=800Mi  <- burst',
            '',
            'Absolute ranking evicts A first (2.1Gi > 800Mi)  -- UNFAIR',
            'Above-request ranking evicts B first (800Mi > 100Mi) -- FAIR',
            '',
            'The above-request ranking punishes burst, not size.',
          ].join('\n'),
        },
        'The reclaim-before-evict rule prevents needless destruction. If deleting three unused images restores 4 Gi of imagefs headroom, no live Pod needs to die. Eviction is the last local mechanism before arbitrary OS failure, not the first cleanup tool.',
        'The control-plane handoff completes the loop. Marking the Pod Failed with reason "Evicted" gives higher-level controllers a precise event to react to. A silent OOM kill leaves ambiguity: was the container killed by the kernel, by the kubelet, by a liveness probe timeout, or by the runtime? The eviction event carries the signal name, the threshold, and the Pod identity, making post-incident analysis tractable.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A 4-node cluster runs a mix of web frontends (Deployment, priority 100, requests: 512 Mi memory, 1 Gi ephemeral-storage) and ML batch jobs (Job, priority 10, requests: 0 memory, 0 ephemeral-storage). Node 3 has a separate imagefs backed by a 100 Gi SSD. A rolling deployment pushes a new frontend image (1.2 Gi compressed) across all replicas. During the rollout, three old image versions remain cached because running Pods still reference them.',
        {
          type: 'code',
          language: 'text',
          body: [
            'Timeline of node 3:',
            '',
            't=0    imagefs.available = 22 Gi (22%)   -- above hard threshold (15%)',
            't=30s  New image pull lands: 1.2 Gi extracted to 3.1 Gi on disk',
            '       imagefs.available = 18.9 Gi (18.9%)',
            't=60s  Batch job writes 6 Gi of checkpoint data to emptyDir (nodefs)',
            '       Second image pull: another 3.1 Gi',
            '       imagefs.available = 15.8 Gi (15.8%)',
            't=90s  Third pull + container writable layers',
            '       imagefs.available = 11.2 Gi (11.2%)  -- BELOW hard threshold (15%)',
            '',
            'Kubelet housekeeping fires at t=100s:',
            '  1. Signal: imagefs.available < 15% hard threshold',
            '  2. Reclaim: GC unused images. Two old versions are unreferenced.',
            '     Freed: 5.8 Gi. imagefs.available = 17.0 Gi (17%) -- above threshold.',
            '  3. Result: pressure resolved by reclaim. No Pod evicted.',
          ].join('\n'),
        },
        'In this case, image garbage collection was sufficient. Now consider the same scenario with tighter disk: a 60 Gi imagefs.',
        {
          type: 'code',
          language: 'text',
          body: [
            'Timeline of node 3 (60 Gi imagefs):',
            '',
            't=0    imagefs.available = 12 Gi (20%)',
            't=90s  After pulls + writable layers:',
            '       imagefs.available = 4.1 Gi (6.8%)  -- BELOW hard threshold (15%)',
            '',
            'Kubelet housekeeping fires at t=100s:',
            '  1. Signal: imagefs.available < 15%',
            '  2. Reclaim: GC unused images. Freed 2.3 Gi (only one unreferenced version).',
            '     imagefs.available = 6.4 Gi (10.7%) -- STILL below threshold.',
            '  3. Rank Pods by disk usage for eviction:',
            '     - batch-job-7x (priority 10, no request, 6 Gi writable layer) -- first victim',
            '     - frontend-abc (priority 100, 1 Gi request, 1.1 Gi writable layer) -- protected',
            '  4. Evict batch-job-7x. Free 6 Gi writable layer.',
            '     imagefs.available = 12.4 Gi (20.7%) -- above threshold.',
            '  5. Pod batch-job-7x status: Failed, reason: Evicted.',
            '     Owning Job creates batch-job-8x, which enters scheduling.',
          ].join('\n'),
        },
        'The batch job was the right victim: low priority, no ephemeral-storage request (so it was entirely consuming unreserved headroom), and its writable layer was the largest contributor to imagefs pressure. The frontend Pod survived because it had higher priority, honest requests, and lower disk usage. The durable fix is right-sizing the disk, setting ephemeral-storage requests on the batch job, or running batch work on nodes with larger local storage.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'Steady-state cost is negligible: each kubelet samples local cgroup stats and filesystem usage every 10 seconds and updates NodeCondition fields (MemoryPressure, DiskPressure, PIDPressure). The API server receives these as part of the normal node heartbeat.',
        {
          type: 'table',
          headers: ['Scenario', 'Latency', 'Blast radius', 'Recovery cost'],
          rows: [
            ['Hard threshold, reclaim succeeds', '~10s (one housekeeping pass)', 'Zero Pods lost', 'Freed images/containers only'],
            ['Hard threshold, eviction needed', '~10-30s', 'One or more low-value Pods', 'Controller creates replacements; image pull + readiness delay'],
            ['Soft threshold, grace period expires', '~grace period + 10s', 'One or more low-value Pods', 'Same as hard, but with warning time for alerts'],
            ['Memory spike outruns kubelet polling', '< 10s', 'Kernel OOM kills a container, not a Pod-level eviction', 'Container restarts per restartPolicy; no eviction event recorded'],
          ],
        },
        'Soft thresholds trade responsiveness for stability. A 90-second grace period avoids killing Pods for a 60-second memory spike caused by a JVM garbage collection pause. But if memory pressure rises to critical in 20 seconds, the soft threshold is still waiting while the hard threshold would have already acted. Most production configurations use both: a soft threshold as an early warning and a hard threshold as a safety net.',
        'The evictionMinimumReclaim setting controls how far past the threshold the kubelet tries to push. Without it, the kubelet reclaims just enough to cross the line, and the next memory allocation can push it back under immediately -- creating an oscillation loop where a Pod is evicted every housekeeping cycle. A minimum reclaim of 500 Mi for memory means the kubelet will try to free at least 500 Mi above the threshold, creating a buffer against immediate re-triggering.',
        {
          type: 'note',
          text: 'The ranking quality depends on honest resource modeling. If every Pod omits memory requests, the kubelet cannot distinguish well-behaved Pods from burst Pods -- all usage is "above request." If every Pod is priority 1000, priority cannot separate critical services from expendable batch work. Eviction policy is only as good as the metadata operators provide.',
        },
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Node-pressure eviction is the right mechanism when local scarcity is real and immediate. It is not a cluster autoscaling tool, not a voluntary disruption workflow, and not a resource quota enforcer. It is a single-node survival controller.',
        {
          type: 'bullets',
          items: [
            'Mixed workload clusters: services (high priority, honest requests) coexist with batch jobs (low priority, bursty). Eviction policy lets operators express which work should survive node pressure without draining the entire node.',
            'CI/CD runners: build containers pull large images and write substantial build artifacts. Image GC and ephemeral-storage eviction prevent build nodes from filling their disks and becoming unschedulable.',
            'ML training clusters: GPU nodes run long-lived training jobs alongside monitoring DaemonSets. Memory pressure from a training job that exceeds its request should evict the training Pod, not the node monitoring agent.',
            'Multi-tenant platforms: different teams share nodes. Priority classes and resource requests let the platform define a pecking order without requiring dedicated node pools for every tenant.',
            'Incident forensics: eviction events record the signal, threshold, and victim. This turns "my Pod disappeared" into "imagefs.available dropped below 15%, reclaim freed 2 Gi but the threshold needed 4 Gi, so batch-job-7x was evicted because it had the highest disk usage above its 0-byte request."',
          ],
        },
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Eviction is not capacity planning. If imagefs is chronically near threshold because nodes have 60 Gi disks and the image set is 50 Gi, the kubelet will keep evicting. The incidents look automated, but the system is spending application availability to cover an infrastructure sizing gap.',
        {
          type: 'table',
          headers: ['Failure mode', 'Mechanism', 'Mitigation'],
          rows: [
            ['PDB bypass', 'Node-pressure eviction is involuntary; PodDisruptionBudgets cannot veto it', 'Use priority classes so critical Pods are evicted last; fix root cause (sizing, requests)'],
            ['OOM kill race', 'Memory spike outruns 10s kubelet poll; kernel OOM killer fires first', 'Set memory limits to cap burst; use cgroup v2 memory.high for early throttling'],
            ['Eviction oscillation', 'Kubelet reclaims just enough, pressure returns immediately', 'Set evictionMinimumReclaim to create a buffer above the threshold'],
            ['Priority inversion', 'Every Pod is high priority, so priority cannot distinguish victims', 'Use a meaningful priority class hierarchy; reserve system-node-critical for infrastructure'],
            ['Ghost requests', 'Pods omit requests; all usage is "above request"; ranking is blind', 'Enforce LimitRange defaults at the namespace level; require requests in admission'],
            ['Daemon starvation', 'kube-reserved and system-reserved are too small; daemons create pressure that app Pods pay for', 'Measure actual daemon memory and disk usage; set reserved values accordingly'],
          ],
        },
        'The hardest failure is misleading safety. A Guaranteed QoS Pod (requests equal limits for all resources) is strongly protected against eviction caused by other Pods bursting past their requests. But Guaranteed does not mean immune. If the node has a hardware fault, if PID space is exhausted (no PID requests exist), or if system-reserved is too small and daemons create the pressure, even a Guaranteed Pod can be evicted. The invariant is node survival, not Pod immortality.',
        {
          type: 'quote',
          attribution: 'Production lesson',
          text: 'The most common eviction surprise is not the eviction itself -- it is the team that assumed PodDisruptionBudgets would prevent it. PDBs protect against voluntary disruptions (drain, maintenance). Node pressure is involuntary. The kubelet does not ask permission.',
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Primary source: Kubernetes official documentation on node-pressure eviction (https://kubernetes.io/docs/concepts/scheduling-eviction/node-pressure-eviction/). Covers signals, thresholds, reclaim, ranking, and node conditions.',
            'Implementation source: kubelet eviction manager in kubernetes/kubernetes (pkg/kubelet/eviction/). The eviction_manager.go file contains the signal observation, threshold comparison, and Pod ranking logic.',
            'Disruptions model: Kubernetes documentation on Pod disruptions (https://kubernetes.io/docs/concepts/workloads/pods/disruptions/). Defines the voluntary vs. involuntary distinction that determines whether PDBs apply.',
            'Resource model: Kubernetes documentation on managing resources for containers (https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/). Explains requests, limits, QoS classes, and how they feed into eviction ranking.',
          ],
        },
        {
          type: 'table',
          headers: ['Role', 'Topic', 'Why'],
          rows: [
            ['Prerequisite', 'Linux cgroups and memory management', 'The kubelet reads memory.available from cgroup stats; understanding cgroup accounting clarifies why "free memory" is not the same as "available memory"'],
            ['Prerequisite', 'Kubernetes scheduling and resource requests', 'Eviction ranking depends on the gap between requests and usage; understanding the scheduling contract explains why that gap exists'],
            ['Extension', 'Kubernetes Priority and Preemption', 'Scheduler-side scarcity resolution: the scheduler evicts lower-priority Pods to make room for higher-priority pending Pods, complementing kubelet-side eviction'],
            ['Extension', 'PodDisruptionBudget', 'Voluntary disruption control; understanding why PDBs do not apply to node pressure clarifies the boundary between the two mechanisms'],
            ['Contrast', 'Load shedding and backpressure', 'The same pattern -- controlled loss before uncontrolled failure -- applied at the service or queue level instead of the node level'],
          ],
        },
      ],
    },
  ],
};
