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
  yield {
    state: packetGraph('Segments can arrive out of order'),
    highlight: { active: ['seg0', 'seg2', 'seg3', 'e-0-rx', 'e-2-rx', 'e-3-rx'], removed: ['seg1'], compare: ['ack'] },
    explanation: 'TCP presents a byte stream, but IP packets can be lost or reordered. Here bytes 0-999 arrive, 1000-1999 are missing, and later bytes arrive out of order. The receiver can buffer the later intervals but cannot deliver them to the application yet.',
    invariant: 'The application receives contiguous stream bytes, not arbitrary out-of-order segments.',
  };

  yield {
    state: labelMatrix(
      'Receiver interval buffer',
      [
        { id: 'r0', label: '0-999' },
        { id: 'r1', label: '1000-1999' },
        { id: 'r2', label: '2000-2999' },
        { id: 'r3', label: '3000-3999' },
      ],
      [
        { id: 'state', label: 'state' },
        { id: 'deliver', label: 'deliver?' },
        { id: 'ack', label: 'ACK effect' },
      ],
      [
        ['present', 'yes', 'ACK 1000'],
        ['missing', 'no', 'hold line'],
        ['present', 'no', 'SACK block'],
        ['present', 'no', 'SACK block'],
      ],
    ),
    highlight: { active: ['r1:state', 'r2:ack', 'r3:ack'], found: ['r0:deliver'] },
    explanation: 'The cumulative ACK names the first missing byte, so it stays at 1000. Selective acknowledgments describe later received blocks, letting the sender learn that bytes 2000-3999 do not need retransmission.',
  };

  yield {
    state: packetGraph('SACK says what arrived beyond the gap'),
    highlight: { active: ['rx', 'ack', 'sack', 'e-rx-ack', 'e-rx-sack'], found: ['rxt'] },
    explanation: 'RFC 2018 SACK blocks report non-contiguous received data beyond the cumulative ACK. That turns the receiver buffer into useful sender feedback: the sender can focus on the hole instead of guessing from duplicate ACKs alone.',
  };

  yield {
    state: filledGraph('Retransmitting the hole makes the stream contiguous'),
    highlight: { active: ['sender', 'hole', 'rx', 'e-sender-hole', 'e-hole-rx'], found: ['stream', 'app', 'e-stream-app'] },
    explanation: 'When bytes 1000-1999 arrive, the receiver merges intervals into one contiguous range, advances the cumulative ACK to 4000, and releases all newly contiguous data to the application.',
  };

  yield {
    state: labelMatrix(
      'Data structures hiding inside TCP',
      [
        { id: 'ring', label: 'receive ring' },
        { id: 'intervals', label: 'interval set' },
        { id: 'gaps', label: 'gap list' },
        { id: 'sack', label: 'SACK blocks' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'job', label: 'job' },
      ],
      [
        ['bytes', 'bounded buffering'],
        ['received ranges', 'merge neighbors'],
        ['missing ranges', 'choose retransmit'],
        ['edges of ranges', 'tell sender'],
      ],
    ),
    highlight: { active: ['intervals:job', 'gaps:job'], found: ['sack:stores'] },
    explanation: 'The concept is simple only after the right structures are named. The receiver has a byte buffer plus interval state; the sender has a scoreboard of what is cumulatively ACKed, selectively ACKed, missing, or already retransmitted.',
  };
}

function* senderScoreboard() {
  yield {
    state: packetGraph('The sender receives duplicate ACK plus SACK blocks'),
    highlight: { active: ['ack', 'sack', 'e-rx-ack', 'e-rx-sack'], found: ['rxt'], removed: ['seg1'] },
    explanation: 'A duplicate cumulative ACK says the stream is still missing byte 1000. The SACK block says later bytes arrived. Together they tell the sender that the likely repair target is 1000-1999, not the whole flight.',
  };

  yield {
    state: labelMatrix(
      'Sender scoreboard after SACK feedback',
      [
        { id: 'r0', label: '0-999' },
        { id: 'r1', label: '1000-1999' },
        { id: 'r2', label: '2000-2999' },
        { id: 'r3', label: '3000-3999' },
        { id: 'r4', label: '4000-4999' },
      ],
      [
        { id: 'mark', label: 'mark' },
        { id: 'action', label: 'sender action' },
      ],
      [
        ['cum ACKed', 'forget'],
        ['missing', 'retransmit'],
        ['SACKed', 'do not resend'],
        ['SACKed', 'do not resend'],
        ['in flight', 'count pipe'],
      ],
    ),
    highlight: { active: ['r1:mark', 'r1:action'], found: ['r2:action', 'r3:action'], compare: ['r4:mark'] },
    explanation: 'The scoreboard classifies ranges. That classification is what prevents waste: SACKed bytes are known to be at the receiver, while the missing range becomes the retransmission candidate.',
  };

  yield {
    state: labelMatrix(
      'RFC 6675 style recovery variables',
      [
        { id: 'highAck', label: 'HighACK' },
        { id: 'highData', label: 'HighData' },
        { id: 'highRxt', label: 'HighRxt' },
        { id: 'pipe', label: 'Pipe' },
      ],
      [
        { id: 'meaning', label: 'meaning' },
        { id: 'why', label: 'why it matters' },
      ],
      [
        ['highest cum ACK', 'left edge of repair'],
        ['highest sent seq', 'right edge of flight'],
        ['highest retransmit', 'avoid repeats'],
        ['estimated in flight', 'respect cwnd'],
      ],
    ),
    highlight: { active: ['highAck:meaning', 'pipe:why'], found: ['highRxt:why'] },
    explanation: 'Loss recovery is still congestion control. The sender repairs holes while estimating how much data remains in flight, so SACK does not become permission to blast unlimited retransmissions.',
  };

  yield {
    state: filledGraph('Scoreboard repair retransmits the hole'),
    highlight: { active: ['sender', 'hole', 'e-sender-hole'], found: ['stream', 'app'], compare: ['rx'] },
    explanation: 'Once the sender chooses 1000-1999 for retransmission, the receiver can coalesce the buffered intervals. A small amount of interval bookkeeping saves a full round trip of blind recovery on multiple losses.',
  };

  yield {
    state: labelMatrix(
      'Why cumulative ACK alone is weaker',
      [
        { id: 'single', label: 'one loss' },
        { id: 'multi', label: 'multiple losses' },
        { id: 'reorder', label: 'reordering' },
        { id: 'tail', label: 'tail loss' },
      ],
      [
        { id: 'cum_only', label: 'cum ACK only' },
        { id: 'with_sack', label: 'with SACK' },
      ],
      [
        ['duplicate ACK hints', 'hole is explicit'],
        ['one per RTT risk', 'several holes visible'],
        ['ambiguous signal', 'ranges clarify state'],
        ['may need timeout', 'still hard, but more info'],
      ],
    ),
    highlight: { active: ['multi:cum_only', 'multi:with_sack'], found: ['reorder:with_sack'] },
    explanation: 'SACK is not magic and does not remove timeouts, congestion windows, or retransmission policy. It improves the sender information model: the receiver can name non-contiguous bytes it already has.',
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
        'The animation has two views. "Receiver reassembly" shows segments arriving out of order, the receiver buffer, SACK feedback, and hole repair. "Sender scoreboard" shows the sender classifying byte ranges after receiving SACK blocks, then retransmitting the missing interval.',
        {
          type: 'bullets',
          items: [
            'Active (highlighted) nodes are the current decision point: which segment just arrived, which range is being classified, or which feedback is being sent.',
            'Removed nodes represent lost segments -- data the network dropped before it reached the receiver.',
            'Found nodes are confirmed outcomes: bytes delivered to the application, or ranges the sender now knows are safe.',
            'Compare nodes show state that is relevant but not the focus of this step, such as an in-flight segment while the receiver processes earlier arrivals.',
          ],
        },
        'In the matrix views, each row is a byte range and each column is a property (state, deliverability, ACK effect, or sender action). Watch the "missing" row: it is the hole that drives the entire recovery process.',
        {
          type: 'note',
          text: 'The animation uses 1000-byte segments for readability. Real TCP segments are typically 1460 bytes (Ethernet MSS) and sequence numbers are 32-bit byte offsets, not packet counts.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {
          type: 'quote',
          text: 'TCP must recover from data that is damaged, lost, duplicated, or delivered out of order by the internet communication system.',
          attribution: 'RFC 793, "Transmission Control Protocol" (1981), Section 1.5',
        },
        'TCP promises applications an ordered, reliable byte stream. The application writes bytes on one end and reads identical bytes in the same order on the other. IP provides none of those guarantees. Packets can be lost, duplicated, delayed, or reordered. A receiver may get bytes 0-999, miss 1000-1999, and then receive 2000-3999. The application cannot read 2000-3999 until the gap is filled.',
        'Two problems hide inside that contract. The receiver must buffer out-of-order data and release only the contiguous prefix. The sender must learn which bytes arrived so it retransmits only what is missing. Cumulative ACKs handle the first problem partially: "I have everything before byte N." SACK blocks handle the second: "I also have these later ranges." Together, reassembly and SACK turn a lossy packet network into a reliable stream.',
        {
          type: 'note',
          text: 'The core objects here are not packets -- they are byte intervals. Ranges, holes, cumulative edges, and selective blocks are the data structures. Once you see them, TCP loss recovery becomes an interval-merge problem with a congestion-control constraint.',
        },
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The simplest receiver design delivers bytes in arrival order and discards anything that arrives out of sequence. If bytes 2000-2999 show up before 1000-1999, throw them away and let the sender retransmit them later. This preserves ordered delivery with zero buffering.',
        {
          type: 'diagram',
          text: 'Approach: discard out-of-order segments\n\n  Sender transmits:  [0-999] [1000-1999] [2000-2999] [3000-3999]\n  Network delivers:  [0-999]     (lost)  [2000-2999] [3000-3999]\n  Receiver keeps:    [0-999]     --         discard     discard\n  Sender must resend:           [1000-1999] [2000-2999] [3000-3999]\n\n  Result: 3 segments retransmitted instead of 1',
          label: 'Discarding out-of-order data forces the sender to retransmit bytes that already arrived',
        },
        'The matching sender design uses only cumulative ACKs. If the receiver says "ACK 1000" three times in a row, the sender infers that 1000 is probably lost and retransmits it. But the sender does not know what happened beyond the hole. Did bytes 2000-3999 arrive? Are there two separate losses? The cumulative ACK cannot express that.',
        {
          type: 'table',
          headers: ['Approach', 'Receiver behavior', 'Sender knowledge', 'Failure mode'],
          rows: [
            ['Discard OOO data', 'Drop anything past the hole', 'Cumulative ACK only', 'Retransmits data the receiver already had'],
            ['Buffer OOO, no SACK', 'Keep later ranges, ACK only the prefix', 'Knows first hole, not later state', 'Multiple losses need one RTT each to discover'],
            ['Buffer OOO + SACK', 'Keep later ranges, report them in ACK', 'Knows exact holes and received blocks', 'Repair all holes in one RTT (usually)'],
          ],
        },
        'The discard approach works on low-loss, low-latency LANs where retransmission is cheap. It fails on paths with large bandwidth-delay products, wireless loss, or multiple losses per window -- the sender retransmits data the network already delivered successfully.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is information asymmetry between sender and receiver. The receiver knows exactly which bytes it has. The sender, armed only with cumulative ACKs, knows only the left edge of the first hole.',
        {
          type: 'diagram',
          text: 'Receiver state (known to receiver):\n  [====0-999====]  [????1000-1999????]  [====2000-2999====]  [====3000-3999====]\n   contiguous         MISSING             buffered OOO          buffered OOO\n\nSender state (known to sender via cum ACK alone):\n  [====0-999====]  [????????????????????????????????????????????????????????????????]\n   ACKed               unknown -- could be 1 loss, 2 losses, or reordering',
          label: 'The sender sees one edge; the receiver sees the full interval map',
        },
        'With only cumulative ACKs and three duplicate ACKs, the sender detects one loss per round trip. If two segments in the same window are lost, the sender repairs the first, waits for the new ACK, discovers the second, and repairs that -- two full RTTs for two losses. On a 100ms path with a 10MB window, that stalls 200ms of throughput.',
        {
          type: 'note',
          text: 'RFC 5681 fast retransmit triggers on the third duplicate ACK. That heuristic works for single losses but becomes ambiguous with multiple losses or reordering. The fundamental problem is not the threshold -- it is the information model.',
        },
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The mechanism has two halves: receiver-side interval management and sender-side scoreboard classification.',
        {
          type: 'code',
          language: 'javascript',
          text: '// Receiver: insert a segment into the out-of-order interval set\nfunction insertSegment(intervals, start, end, data) {\n  // 1. Store payload bytes in the receive buffer\n  buffer.write(data, start);\n  // 2. Add [start, end) to the interval set\n  intervals.add(start, end);\n  // 3. Merge any adjacent or overlapping intervals\n  intervals.coalesce();\n  // 4. If the lowest interval starts at rcv_nxt, deliver to app\n  while (intervals.lowest().start === rcv_nxt) {\n    const block = intervals.removeLowest();\n    deliver(buffer, block.start, block.end);\n    rcv_nxt = block.end;  // advance cumulative ACK\n  }\n  // 5. Remaining intervals become SACK blocks in the next ACK\n}',
        },
        'The sender transmits four 1000-byte segments. Segment 1 (bytes 1000-1999) is lost. The receiver delivers 0-999, buffers 2000-3999, sends ACK 1000, and attaches SACK blocks reporting [2000, 4000). The sender now knows the exact hole.',
        {
          type: 'diagram',
          text: 'Sender scoreboard after receiving ACK 1000, SACK [2000-4000):\n\n  Byte range     Mark          Action\n  0-999          cum ACKed     done, forget\n  1000-1999      MISSING       retransmit next\n  2000-2999      SACKed        do not resend\n  3000-3999      SACKed        do not resend\n  4000-4999      in flight     count toward Pipe',
          label: 'The scoreboard classifies every byte range so the sender retransmits only the hole',
        },
        'The sender retransmits 1000-1999 while respecting the congestion window. It updates the Pipe variable -- the estimated bytes in flight -- to avoid flooding the path during recovery. When the retransmitted segment arrives, the receiver merges [0-999], [1000-1999], and [2000-3999] into [0-3999], advances cumulative ACK to 4000, and delivers the contiguous stream to the application.',
        {
          type: 'code',
          language: 'javascript',
          text: '// Sender: RFC 6675 style scoreboard update on SACK arrival\nfunction updateScoreboard(highACK, sackBlocks) {\n  // Mark everything below highACK as done\n  scoreboard.markAcked(0, highACK);\n  // Mark SACK ranges as received (do not retransmit)\n  for (const [left, right] of sackBlocks) {\n    scoreboard.markSacked(left, right);\n  }\n  // Everything between highACK and first SACK block is a hole\n  // IsLost() checks: 3+ SACKed segments above, or enough bytes\n  for (const range of scoreboard.unmarked()) {\n    if (isLost(range)) scoreboard.markLost(range);\n  }\n  // Pipe = in-flight estimate = sent - (acked + sacked + lost)\n  pipe = computePipe(scoreboard);\n}',
        },
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Reassembly is correct because the receiver separates its public interface from its internal state. The application sees only contiguous bytes -- the stream contract is never violated. Internally, the receiver holds non-contiguous intervals so useful data is preserved. The cumulative ACK edge advances monotonically: once the receiver acknowledges byte N, every byte before N is delivered and will not be requested again.',
        {
          type: 'note',
          text: 'The invariant: at every moment, rcv_nxt equals the left edge of the first gap. All bytes before rcv_nxt have been delivered to the application in order. All buffered bytes after rcv_nxt are waiting for that gap to close.',
        },
        'SACK works because it increases the sender\'s information without granting unlimited sending rights. The key constraint is that SACK is feedback, not permission. The sender learns which ranges arrived but still obeys the congestion window. RFC 6675 formalizes this: the sender estimates Pipe (bytes presumed in flight), and only sends new data or retransmissions when Pipe is below cwnd.',
        {
          type: 'diagram',
          text: 'Correctness chain:\n\n  1. Receiver buffers OOO data    -> no useful bytes discarded\n  2. SACK reports buffered ranges  -> sender knows exact holes\n  3. Sender retransmits holes only -> minimal repair traffic\n  4. Pipe estimate respects cwnd   -> repair does not cause congestion\n  5. Interval merge on arrival     -> contiguous prefix grows\n  6. rcv_nxt advances              -> application gets ordered stream',
          label: 'Each step depends on the one above -- remove any link and the mechanism breaks',
        },
        'The interval representation is compact. The receiver does not store per-byte metadata. It stores ranges and merges neighbors. The sender classifies ranges, not individual packets. This is why interval sets, gap lists, and scoreboards appear in every serious transport implementation: they summarize stream state at the right granularity.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'table',
          headers: ['Operation', 'Time', 'Space', 'What drives the cost'],
          rows: [
            ['Receiver: insert segment', 'O(log k)', 'O(k intervals)', 'Binary search over the interval set to find merge point; k = number of gaps'],
            ['Receiver: merge intervals', 'O(1) amortized', 'Shrinks k', 'Each merge reduces the interval count by 1; at most k merges total'],
            ['Receiver: deliver prefix', 'O(bytes)', 'Frees buffer', 'Copy contiguous bytes to application socket buffer'],
            ['Sender: update scoreboard', 'O(s)', 'O(k intervals)', 's = number of SACK blocks per ACK (max 4 with timestamps)'],
            ['Sender: compute Pipe', 'O(k)', 'O(1)', 'Walk scoreboard ranges to count in-flight bytes'],
            ['Sender: choose retransmit', 'O(k)', 'O(1)', 'Find first lost range above HighRxt'],
          ],
        },
        'In practice, k (the number of distinct intervals or gaps) is small. RFC 2018 allows up to 4 SACK blocks per TCP option when timestamps are present, and 3 when the D-SACK block is included. Most loss events create 1-3 holes. The scoreboard rarely exceeds a dozen entries even on high-loss paths.',
        {
          type: 'note',
          text: 'Memory cost is dominated by the byte buffer, not the interval metadata. A receiver with a 4MB window allocates 4MB for payload storage. The interval set tracking which ranges are present might use a few hundred bytes. The scoreboard on the sender side is similarly lightweight -- a handful of range entries.',
        },
        'Doubling the window size doubles the buffer memory but does not meaningfully change the scoreboard cost. Doubling the loss rate increases k (more holes), which increases scoreboard update time linearly, but k stays far below the number of packets in flight. The real cost is round-trip time: each recovery episode takes at least one RTT regardless of scoreboard efficiency.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        {
          type: 'table',
          headers: ['Scenario', 'Without SACK', 'With SACK', 'Why the difference matters'],
          rows: [
            ['Single loss in large window', '3 dup ACKs, fast retransmit, 1 RTT', 'Same, but hole is explicit', 'SACK confirms later data arrived; sender skips unnecessary retransmits'],
            ['Multiple losses in one window', '1 loss discovered per RTT (NewReno)', 'All holes visible in one ACK', 'Saves N-1 RTTs for N losses; critical on high-latency paths'],
            ['Reordering (not loss)', 'Dup ACKs may trigger false retransmit', 'SACK blocks show data is present', 'Sender can distinguish reordering from loss with D-SACK (RFC 2883)'],
            ['Wireless with random loss', 'Go-back-N behavior wastes bandwidth', 'Selective repair of lost segments', '10x throughput improvement measured on lossy satellite links'],
          ],
        },
        'Every modern TCP stack enables SACK by default. Linux, Windows, macOS, FreeBSD, and iOS all negotiate SACK in the SYN/SYN-ACK handshake. Disabling SACK is a performance regression on any path with nontrivial loss or reordering.',
        {
          type: 'bullets',
          items: [
            'Long-haul WAN links: 100ms+ RTT means each wasted round trip costs real throughput. SACK avoids the one-loss-per-RTT ceiling of NewReno.',
            'Data center networks: even at sub-millisecond RTT, incast patterns cause multiple losses per window. SACK lets the sender repair all holes in one pass.',
            'Wireless and satellite: random bit errors cause loss unrelated to congestion. SACK isolates the lost segments without penalizing the entire window.',
            'IDS and packet capture: network security tools (Snort, Suricata, Zeek) perform TCP reassembly to reconstruct application-layer streams from captured packets. The same interval-merge logic applies.',
            'Download managers and rsync: track which byte ranges of a file have been received, resume from gaps. Same data structure, different transport.',
          ],
        },
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Tail loss: if the last segment in a flight is lost, there are no later packets to trigger duplicate ACKs or generate SACK blocks. The sender falls back to the retransmission timeout (RTO), which is typically 200ms-1s. SACK cannot help when there is no feedback.',
            'ACK loss: if the ACK carrying SACK blocks is itself lost, the sender never learns about the received ranges. It may retransmit data the receiver already has.',
            'SACK option space: TCP options share 40 bytes. With timestamps (10 bytes) and SACK permitted (2 bytes in SYN), only 28 bytes remain for SACK blocks. Each block is 8 bytes (left edge + right edge), so at most 3-4 blocks per ACK. Complex loss patterns with many small holes cannot be fully reported.',
            'Buffer memory: out-of-order data consumes receive buffer. A receiver under memory pressure may discard buffered data, which is allowed by the spec. The sender must handle the case where a previously SACKed range is later reported missing (reneging). Most implementations avoid reneging, but the sender cannot assume it.',
            'Middlebox interference: some firewalls, NATs, and load balancers strip SACK options or fail to forward them. The connection silently falls back to cumulative-ACK-only recovery, losing the information advantage.',
            'Scoreboard complexity: implementing RFC 6675 correctly is nontrivial. Bugs in scoreboard maintenance -- marking data lost too early, failing to update HighRxt, miscounting Pipe -- cause spurious retransmissions or stalls. Linux has fixed dozens of such bugs over two decades.',
          ],
        },
        {
          type: 'note',
          text: 'SACK is information, not immunity. It improves the sender\'s model of the network but does not replace congestion control, retransmission timers, or recovery state machines. Every real TCP stack combines SACK with fast retransmit, proportional rate reduction (PRR), and RTO as the last resort.',
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
            ['RFC 793 (1981)', 'Original TCP specification: sequence numbers, ACKs, retransmission, reassembly'],
            ['RFC 2018 (1996)', 'SACK option format: block encoding, negotiation, receiver/sender behavior'],
            ['RFC 2883 (2000)', 'D-SACK: using SACK blocks to report duplicate segments, distinguishing reordering from loss'],
            ['RFC 5681 (2009)', 'TCP congestion control: slow start, congestion avoidance, fast retransmit, fast recovery'],
            ['RFC 6675 (2012)', 'Conservative SACK-based loss recovery: HighACK, HighData, HighRxt, Pipe, IsLost()'],
            ['Linux net/ipv4/tcp_input.c', 'Production scoreboard implementation: tcp_sacktag_write_queue(), tcp_mark_head_lost()'],
          ],
        },
        {
          type: 'bullets',
          items: [
            'Prerequisite: study Sliding Window and Interval Tree to understand the range-based data structures underlying both receiver reassembly and sender scoreboards.',
            'Companion: study TCP: Handshake & Congestion Control to see how SACK recovery interacts with cwnd reduction, PRR, and the RTO fallback.',
            'Extension: study QUIC Transport Streams & Loss Recovery to see how QUIC redesigns the same ideas with per-stream offsets, explicit packet numbers (no ambiguity), and ACK frames that can carry many more ranges than TCP SACK options.',
            'Case study: study NIC RX Ring & NAPI Poll to see where reassembly starts -- the kernel pulls packets from the NIC ring buffer and feeds them into the TCP input path where out-of-order handling begins.',
            'Related patterns: Ring Buffer, Backpressure & Flow Control, Message Queue, TCP Listen Backlog & Accept Queue.',
          ],
        },
      ],
    },
  ],
};

