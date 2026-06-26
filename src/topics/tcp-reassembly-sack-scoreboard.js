// TCP reassembly and SACK scoreboards: interval state around a byte stream.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'tcp-reassembly-sack-scoreboard',
  title: 'TCP Reassembly & SACK Scoreboard',
  category: 'Systems',
  summary: 'TCP receives a byte stream out of order, buffers intervals, advertises SACK blocks, and lets the sender retransmit holes instead of everything.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['receiver reassembly', 'sender scoreboard'], defaultValue: 'receiver reassembly' },
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

function packetGraph(title) {
  return graphState({
    nodes: [
      { id: 'sender', label: 'sender', x: 0.7, y: 4.0, note: 'bytes' },
      { id: 'seg0', label: '0-1k', x: 2.6, y: 1.4, note: 'ok' },
      { id: 'seg1', label: '1k-2k', x: 2.6, y: 3.1, note: 'lost' },
      { id: 'seg2', label: '2k-3k', x: 2.6, y: 4.9, note: 'ok' },
      { id: 'seg3', label: '3k-4k', x: 2.6, y: 6.6, note: 'ok' },
      { id: 'rx', label: 'receiver', x: 5.2, y: 4.0, note: 'buffer' },
      { id: 'ack', label: 'ACK 1k', x: 7.4, y: 2.7, note: 'cum' },
      { id: 'sack', label: 'SACK', x: 7.4, y: 5.3, note: '2k-4k' },
      { id: 'rxt', label: 'rxt', x: 9.1, y: 4.0, note: 'hole' },
    ],
    edges: [
      { id: 'e-s-0', from: 'sender', to: 'seg0', weight: '' },
      { id: 'e-s-1', from: 'sender', to: 'seg1', weight: '' },
      { id: 'e-s-2', from: 'sender', to: 'seg2', weight: '' },
      { id: 'e-s-3', from: 'sender', to: 'seg3', weight: '' },
      { id: 'e-0-rx', from: 'seg0', to: 'rx', weight: 'ok' },
      { id: 'e-2-rx', from: 'seg2', to: 'rx', weight: 'OOO' },
      { id: 'e-3-rx', from: 'seg3', to: 'rx', weight: 'merge' },
      { id: 'e-rx-ack', from: 'rx', to: 'ack', weight: 'dup' },
      { id: 'e-rx-sack', from: 'rx', to: 'sack', weight: 'blocks' },
      { id: 'e-sack-rxt', from: 'sack', to: 'rxt', weight: 'hole' },
    ],
  }, { title });
}

function filledGraph(title) {
  return graphState({
    nodes: [
      { id: 'sender', label: 'sender', x: 0.8, y: 4.0, note: 'rxt' },
      { id: 'hole', label: '1000-1999', x: 2.8, y: 4.0, note: 'fills gap' },
      { id: 'rx', label: 'receiver', x: 4.9, y: 4.0, note: 'merge' },
      { id: 'stream', label: '0-3999', x: 6.9, y: 4.0, note: 'contiguous' },
      { id: 'app', label: 'app', x: 8.8, y: 4.0, note: 'deliver' },
    ],
    edges: [
      { id: 'e-sender-hole', from: 'sender', to: 'hole', weight: 're-send' },
      { id: 'e-hole-rx', from: 'hole', to: 'rx', weight: 'arrive' },
      { id: 'e-rx-stream', from: 'rx', to: 'stream', weight: 'coalesce' },
      { id: 'e-stream-app', from: 'stream', to: 'app', weight: 'advance ACK' },
    ],
  }, { title });
}

function* receiverReassembly() {
  const hl1 = { active: ['seg0', 'seg2', 'seg3', 'e-0-rx', 'e-2-rx', 'e-3-rx'], removed: ['seg1'], compare: ['ack'] };
  const arrivedSegs = hl1.active.filter(id => id.startsWith('seg')).length;
  const lostSegs = hl1.removed.length;
  yield {
    state: packetGraph('Segments can arrive out of order'),
    highlight: hl1,
    explanation: `TCP presents a byte stream, but IP packets can be lost or reordered. Here ${arrivedSegs} segments arrived while ${lostSegs} segment (${hl1.removed.join(', ')}) was lost. The receiver can buffer the ${arrivedSegs} later intervals but cannot deliver them to the application yet, because ${hl1.compare.length} cumulative ACK (${hl1.compare.join(', ')}) still awaits the missing data.`,
    invariant: 'The application receives contiguous stream bytes, not arbitrary out-of-order segments.',
  };

  const rows2 = [
    { id: 'r0', label: '0-999' },
    { id: 'r1', label: '1000-1999' },
    { id: 'r2', label: '2000-2999' },
    { id: 'r3', label: '3000-3999' },
  ];
  const cols2 = [
    { id: 'state', label: 'state' },
    { id: 'deliver', label: 'deliver?' },
    { id: 'ack', label: 'ACK effect' },
  ];
  const hl2 = { active: ['r1:state', 'r2:ack', 'r3:ack'], found: ['r0:deliver'] };
  const sackCells = hl2.active.filter(c => c.endsWith(':ack')).length;
  yield {
    state: labelMatrix(
      'Receiver interval buffer',
      rows2,
      cols2,
      [
        ['present', 'yes', 'ACK 1000'],
        ['missing', 'no', 'hold line'],
        ['present', 'no', 'SACK block'],
        ['present', 'no', 'SACK block'],
      ],
    ),
    highlight: hl2,
    explanation: `The ${rows2.length} byte ranges span ${cols2.length} columns. The cumulative ACK names the first missing byte (${rows2[1].label}), so it stays at 1000. ${sackCells} SACK-effect cells are active, letting the sender learn that bytes ${rows2[2].label} and ${rows2[3].label} do not need retransmission. ${hl2.found.length} cell (${hl2.found.join(', ')}) confirms deliverable data.`,
  };

  const hl3 = { active: ['rx', 'ack', 'sack', 'e-rx-ack', 'e-rx-sack'], found: ['rxt'] };
  const activeNodes3 = hl3.active.filter(id => !id.startsWith('e-')).length;
  const activeEdges3 = hl3.active.filter(id => id.startsWith('e-')).length;
  yield {
    state: packetGraph('SACK says what arrived beyond the gap'),
    highlight: hl3,
    explanation: `RFC 2018 SACK blocks report non-contiguous received data beyond the cumulative ACK. ${activeNodes3} nodes and ${activeEdges3} edges are active in this step, showing the feedback path. That turns the receiver buffer into useful sender feedback: the sender can focus on the ${hl3.found.length} retransmission target (${hl3.found.join(', ')}) instead of guessing from duplicate ACKs alone.`,
  };

  const hl4 = { active: ['sender', 'hole', 'rx', 'e-sender-hole', 'e-hole-rx'], found: ['stream', 'app', 'e-stream-app'] };
  const repairNodes = hl4.active.filter(id => !id.startsWith('e-')).length;
  const deliverNodes = hl4.found.filter(id => !id.startsWith('e-')).length;
  yield {
    state: filledGraph('Retransmitting the hole makes the stream contiguous'),
    highlight: hl4,
    explanation: `When bytes 1000-1999 arrive, the receiver merges intervals into one contiguous range. ${repairNodes} nodes participate in the repair path while ${deliverNodes} nodes (${hl4.found.filter(id => !id.startsWith('e-')).join(', ')}) represent the delivery outcome. The cumulative ACK advances to 4000, and all newly contiguous data is released to the application.`,
  };

  const rows5 = [
    { id: 'ring', label: 'receive ring' },
    { id: 'intervals', label: 'interval set' },
    { id: 'gaps', label: 'gap list' },
    { id: 'sack', label: 'SACK blocks' },
  ];
  const cols5 = [
    { id: 'stores', label: 'stores' },
    { id: 'job', label: 'job' },
  ];
  const hl5 = { active: ['intervals:job', 'gaps:job'], found: ['sack:stores'] };
  yield {
    state: labelMatrix(
      'Data structures hiding inside TCP',
      rows5,
      cols5,
      [
        ['bytes', 'bounded buffering'],
        ['received ranges', 'merge neighbors'],
        ['missing ranges', 'choose retransmit'],
        ['edges of ranges', 'tell sender'],
      ],
    ),
    highlight: hl5,
    explanation: `${rows5.length} data structures across ${cols5.length} properties reveal what hides inside TCP. ${hl5.active.length} job cells (${hl5.active.join(', ')}) are active, showing that the ${rows5[1].label} and ${rows5[2].label} do the core interval work. The receiver has a byte buffer plus interval state; the sender has a scoreboard of what is cumulatively ACKed, selectively ACKed, missing, or already retransmitted.`,
  };
}

function* senderScoreboard() {
  const hl1 = { active: ['ack', 'sack', 'e-rx-ack', 'e-rx-sack'], found: ['rxt'], removed: ['seg1'] };
  const feedbackNodes = hl1.active.filter(id => !id.startsWith('e-')).length;
  const feedbackEdges = hl1.active.filter(id => id.startsWith('e-')).length;
  yield {
    state: packetGraph('The sender receives duplicate ACK plus SACK blocks'),
    highlight: hl1,
    explanation: `A duplicate cumulative ACK says the stream is still missing byte 1000. ${feedbackNodes} feedback nodes and ${feedbackEdges} edges carry the signal. The SACK block says later bytes arrived. Together they tell the sender that the ${hl1.found.length} repair target (${hl1.found.join(', ')}) covers bytes 1000-1999, not the whole flight. ${hl1.removed.length} segment (${hl1.removed.join(', ')}) is confirmed lost.`,
  };

  const rows2 = [
    { id: 'r0', label: '0-999' },
    { id: 'r1', label: '1000-1999' },
    { id: 'r2', label: '2000-2999' },
    { id: 'r3', label: '3000-3999' },
    { id: 'r4', label: '4000-4999' },
  ];
  const cols2 = [
    { id: 'mark', label: 'mark' },
    { id: 'action', label: 'sender action' },
  ];
  const hl2 = { active: ['r1:mark', 'r1:action'], found: ['r2:action', 'r3:action'], compare: ['r4:mark'] };
  yield {
    state: labelMatrix(
      'Sender scoreboard after SACK feedback',
      rows2,
      cols2,
      [
        ['cum ACKed', 'forget'],
        ['missing', 'retransmit'],
        ['SACKed', 'do not resend'],
        ['SACKed', 'do not resend'],
        ['in flight', 'count pipe'],
      ],
    ),
    highlight: hl2,
    explanation: `The scoreboard classifies ${rows2.length} byte ranges across ${cols2.length} columns. ${hl2.active.length} cells for ${rows2[1].label} are active as the retransmission candidate. ${hl2.found.length} found cells (${hl2.found.join(', ')}) confirm SACKed ranges that prevent waste, while ${hl2.compare.length} cell (${hl2.compare.join(', ')}) tracks the in-flight segment.`,
  };

  const rows3 = [
    { id: 'highAck', label: 'HighACK' },
    { id: 'highData', label: 'HighData' },
    { id: 'highRxt', label: 'HighRxt' },
    { id: 'pipe', label: 'Pipe' },
  ];
  const cols3 = [
    { id: 'meaning', label: 'meaning' },
    { id: 'why', label: 'why it matters' },
  ];
  const hl3 = { active: ['highAck:meaning', 'pipe:why'], found: ['highRxt:why'] };
  yield {
    state: labelMatrix(
      'RFC 6675 style recovery variables',
      rows3,
      cols3,
      [
        ['highest cum ACK', 'left edge of repair'],
        ['highest sent seq', 'right edge of flight'],
        ['highest retransmit', 'avoid repeats'],
        ['estimated in flight', 'respect cwnd'],
      ],
    ),
    highlight: hl3,
    explanation: `RFC 6675 defines ${rows3.length} recovery variables across ${cols3.length} columns. ${hl3.active.length} active cells track ${rows3[0].label} and ${rows3[3].label}, while ${hl3.found.length} found cell (${hl3.found.join(', ')}) highlights ${rows3[2].label}. Loss recovery is still congestion control: the sender repairs holes while estimating how much data remains in flight, so SACK does not become permission to blast unlimited retransmissions.`,
  };

  const hl4 = { active: ['sender', 'hole', 'e-sender-hole'], found: ['stream', 'app'], compare: ['rx'] };
  const activeNodes4 = hl4.active.filter(id => !id.startsWith('e-')).length;
  const activeEdges4 = hl4.active.filter(id => id.startsWith('e-')).length;
  yield {
    state: filledGraph('Scoreboard repair retransmits the hole'),
    highlight: hl4,
    explanation: `Once the sender chooses 1000-1999 for retransmission, ${activeNodes4} nodes and ${activeEdges4} edge drive the repair. The ${hl4.found.length} outcome nodes (${hl4.found.join(', ')}) show the receiver coalescing buffered intervals. ${hl4.compare.length} node (${hl4.compare.join(', ')}) mediates the merge. A small amount of interval bookkeeping saves a full round trip of blind recovery on multiple losses.`,
  };

  const rows5 = [
    { id: 'single', label: 'one loss' },
    { id: 'multi', label: 'multiple losses' },
    { id: 'reorder', label: 'reordering' },
    { id: 'tail', label: 'tail loss' },
  ];
  const cols5 = [
    { id: 'cum_only', label: 'cum ACK only' },
    { id: 'with_sack', label: 'with SACK' },
  ];
  const hl5 = { active: ['multi:cum_only', 'multi:with_sack'], found: ['reorder:with_sack'] };
  yield {
    state: labelMatrix(
      'Why cumulative ACK alone is weaker',
      rows5,
      cols5,
      [
        ['duplicate ACK hints', 'hole is explicit'],
        ['one per RTT risk', 'several holes visible'],
        ['ambiguous signal', 'ranges clarify state'],
        ['may need timeout', 'still hard, but more info'],
      ],
    ),
    highlight: hl5,
    explanation: `${rows5.length} loss scenarios are compared across ${cols5.length} approaches. ${hl5.active.length} cells highlight the ${rows5[1].label} row, where SACK shines brightest. ${hl5.found.length} found cell (${hl5.found.join(', ')}) shows that ${rows5[2].label} is also better handled. SACK is not magic and does not remove timeouts, congestion windows, or retransmission policy -- it improves the sender information model so the receiver can name non-contiguous bytes it already has.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'receiver reassembly') yield* receiverReassembly();
  else if (view === 'sender scoreboard') yield* senderScoreboard();
  else throw new InputError('Pick a TCP reassembly view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as two linked ledgers over the same TCP byte stream. TCP, the Transmission Control Protocol, gives an application ordered bytes even though the network may deliver packets late, duplicate them, or drop them. The receiver view shows which byte ranges are buffered and which prefix can be delivered.',
        'The sender scoreboard view shows the other side of the same fact. A cumulative ACK says every byte before an edge arrived, while a SACK block, or selective acknowledgement block, says a later byte range also arrived. The safe inference is this: if bytes before 1000 are ACKed and bytes 2000 through 3999 are SACKed, then 1000 through 1999 is the hole to retransmit.',
        {type: 'callout', text: 'SACK turns receiver memory into sender knowledge: the receiver keeps intervals, then sends enough range evidence for the sender to repair holes without resending the whole suffix.'},
        {
          type: 'note',
          text: 'The animation uses 1000-byte segments for readability. Real TCP segments are typically 1460 bytes (Ethernet MSS) and sequence numbers are 32-bit byte offsets, not packet counts.',
        },
      
        {type: 'image', src: './assets/gifs/tcp-reassembly-sack-scoreboard.gif', alt: 'Animated walkthrough of the tcp reassembly sack scoreboard visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {
          type: 'quote',
          text: 'TCP must recover from data that is damaged, lost, duplicated, or delivered out of order by the internet communication system.',
          attribution: 'RFC 793, "Transmission Control Protocol" (1981), Section 1.5',
        },
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/f/f6/Tcp_state_diagram_fixed_new.svg', alt: 'Simplified TCP connection state diagram', caption: 'TCP is a state machine around a reliable byte stream; reassembly and SACK live inside the data-transfer phase. Source: Wikimedia Commons: https://commons.wikimedia.org/wiki/File:Tcp_state_diagram_fixed_new.svg.'},
        'The internet carries packets, but applications usually want streams. A stream means byte 1000 is not useful to the application until bytes 0 through 999 have also arrived. TCP exists to hide packet loss, reordering, and duplication behind that ordered-stream contract.',
        'Reassembly is the receiver-side job of storing out-of-order bytes until the first missing byte arrives. SACK is the feedback channel that lets the receiver report later ranges that already arrived. Together they prevent a single missing packet from forcing the sender to resend a whole suffix of data.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The simplest receiver keeps only the next expected segment and discards anything beyond a gap. If byte range 1000 through 1999 is missing, the receiver drops 2000 through 3999 even if those bytes arrived correctly. That design uses little memory and preserves ordered delivery.',
        'The sender can then rely on cumulative ACKs. An ACK of 1000 means every byte before 1000 arrived and byte 1000 is still the first unknown byte. After several duplicate ACKs, the sender retransmits the missing segment and waits for the ACK edge to move.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Discarding out-of-order data wastes the network work that already succeeded. On a path with a 10 MB congestion window and 100 ms round-trip time, losing one 1460-byte packet can force many already-delivered packets through the path again. The cost is not just bytes; it is another round trip before useful application progress resumes.',
        'Cumulative ACKs also hide later state from the sender. If the receiver says ACK 1000, the sender cannot tell whether 2000 through 3999 arrived, are still in flight, or were also lost. Multiple losses then get discovered one recovery step at a time.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to represent stream state as byte intervals. The receiver stores intervals it has, merges adjacent intervals, and delivers only the contiguous prefix. The sender stores a scoreboard that classifies ranges as acknowledged, SACKed, lost, retransmitted, or still in flight.',
        'A SACK block transfers receiver interval knowledge to the sender without changing congestion control. It says "this later range arrived" but does not say "send unlimited data." The sender uses that range evidence to choose holes, while the congestion window still limits how much repair traffic can be sent.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'When a segment arrives, the receiver writes its bytes into the receive buffer and inserts the half-open interval [start, end) into an interval set. If the new interval touches or overlaps a stored interval, the receiver merges them. If the lowest interval begins at rcv_nxt, the receiver delivers that contiguous prefix and advances rcv_nxt.',
        'The next ACK carries two facts. The cumulative ACK edge is rcv_nxt, the first byte not yet deliverable. The SACK blocks list later buffered ranges, usually a few recent intervals because TCP option space is limited.',
        'The sender updates the scoreboard from both facts. It marks bytes below the cumulative ACK as done, marks SACK ranges as received, and marks gaps between known received ranges as candidates for retransmission. A range becomes a retransmission target only when the loss rule says enough later data has arrived to make loss more likely than reordering.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The receiver correctness argument is an invariant. At all times, every byte before rcv_nxt has been delivered to the application in order, and no byte at or after rcv_nxt has been delivered. Buffering later intervals cannot violate the stream contract because those bytes stay internal until the gap closes.',
        'The sender correctness argument is also interval-based. A SACKed range proves that retransmitting that range is unnecessary unless the receiver later reneges under memory pressure. A hole before a SACKed range is the cheapest repair target because filling it can unlock the largest contiguous prefix at the receiver.',
        'The mechanism remains safe because SACK does not bypass congestion control. The scoreboard improves which bytes are sent, not how many bytes are allowed in flight. That separation lets TCP repair losses without converting recovery into a burst that harms the path.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Receiver memory is dominated by payload bytes, not interval metadata. A 4 MB receive window needs space for up to 4 MB of buffered data, while the interval set may hold only a handful of gaps. Inserting or merging an interval is usually O(log k), where k is the number of stored intervals.',
        'Sender work grows with scoreboard ranges, not with total stream length. If a window has 7000 packets but only 3 holes, the useful bookkeeping is about those holes and the SACKed ranges around them. Doubling the window doubles buffer exposure, but it does not double scoreboard work unless it also increases the number of distinct holes.',
        'The expensive behavior is round-trip delay. Repairing one hole still needs feedback and retransmission across the path. SACK saves time by discovering several holes from one feedback pattern rather than requiring one round trip per loss.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Every major TCP stack uses receiver reassembly because application protocols depend on ordered byte streams. HTTP, SSH, database connections, and file transfers all rely on this contract. The interval buffer is the mechanism that lets those protocols ignore packet order.',
        'SACK matters most on long-fat paths, wireless links, satellite links, and data-center incast events where several packets can be lost from one flight. It lets the sender repair exact gaps instead of falling back toward go-back-N behavior. Packet capture tools and intrusion detection systems use the same reassembly idea to reconstruct application streams from observed packets.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'SACK cannot help when no later packet arrives to create feedback. Tail loss, where the last packet in a flight is lost, may still wait for a retransmission timeout or a separate loss-probe mechanism. ACK loss can also hide SACK evidence from the sender.',
        'The option format is cramped. TCP options have limited space, and each SACK block consumes bytes for left and right edges. A receiver with many tiny holes cannot report every interval in one ACK, so the sender still works with a compressed view.',
        'Implementation bugs are costly because the scoreboard is stateful. Marking a range lost too early causes spurious retransmission, while failing to mark a real hole stalls progress. Production stacks test these paths heavily because rare reordering and memory-pressure cases expose bad assumptions.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose the sender transmits four 1000-byte ranges: [0,1000), [1000,2000), [2000,3000), and [3000,4000). The network drops [1000,2000) but delivers the other three. The receiver delivers [0,1000), buffers [2000,4000), and sends ACK 1000 with SACK [2000,4000).',
        'The sender scoreboard now has three facts: [0,1000) is done, [2000,4000) arrived, and [1000,2000) is the only gap between them. Retransmitting [1000,2000) costs 1000 bytes instead of resending 3000 bytes. When that retransmission arrives, the receiver merges all intervals into [0,4000), advances the cumulative ACK to 4000, and delivers the whole stream prefix.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources are RFC 793 for TCP sequence numbers and reassembly, RFC 2018 for SACK, RFC 2883 for duplicate SACK, RFC 5681 for congestion control, and RFC 6675 for conservative SACK-based loss recovery. Linux tcp_input.c is a useful production reference for scoreboard maintenance and SACK tagging.',
        'Study sliding windows next to understand in-flight limits, then interval trees or ordered maps for range storage. After that, compare QUIC loss recovery, where packet numbers and ACK ranges remove some TCP ambiguity while keeping the same interval-repair idea.',
      ],
    },
  ],
};
