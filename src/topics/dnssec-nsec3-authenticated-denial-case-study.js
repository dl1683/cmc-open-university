// DNSSEC NSEC3 authenticated denial: hashed owner-name intervals, signed
// non-existence proofs, wildcard denial, and opt-out risk.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'dnssec-nsec3-authenticated-denial-case-study',
  title: 'DNSSEC NSEC3 Authenticated Denial',
  category: 'Security',
  summary: 'How NSEC3 proves NXDOMAIN or NODATA by signing hashed owner-name intervals instead of returning a bare cacheable miss.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['denial proof', 'hash tradeoff'], defaultValue: 'denial proof' },
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

function denialGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'q', label: 'qname', x: 0.8, y: 4.0, note: notes.q ?? 'missing' },
      { id: 'hash', label: 'hash', x: 2.1, y: 4.0, note: notes.hash ?? 'salt+iter' },
      { id: 'prev', label: 'prev', x: 3.6, y: 2.4, note: notes.prev ?? 'NSEC3' },
      { id: 'next', label: 'next', x: 5.2, y: 2.4, note: notes.next ?? 'covers' },
      { id: 'wild', label: 'wild', x: 3.6, y: 5.8, note: notes.wild ?? '*.zone' },
      { id: 'sig', label: 'sig', x: 6.7, y: 4.0, note: notes.sig ?? 'RRSIG' },
      { id: 'key', label: 'key', x: 8.0, y: 5.8, note: notes.key ?? 'DNSKEY' },
      { id: 'nx', label: 'NX', x: 8.4, y: 2.5, note: notes.nx ?? 'denial' },
      { id: 'cache', label: 'cache', x: 9.3, y: 4.0, note: notes.cache ?? 'SOA TTL' },
    ],
    edges: [
      { id: 'e-q-hash', from: 'q', to: 'hash' },
      { id: 'e-hash-prev', from: 'hash', to: 'prev' },
      { id: 'e-prev-next', from: 'prev', to: 'next' },
      { id: 'e-hash-wild', from: 'hash', to: 'wild' },
      { id: 'e-prev-sig', from: 'prev', to: 'sig' },
      { id: 'e-wild-sig', from: 'wild', to: 'sig' },
      { id: 'e-key-sig', from: 'key', to: 'sig' },
      { id: 'e-sig-nx', from: 'sig', to: 'nx' },
      { id: 'e-nx-cache', from: 'nx', to: 'cache' },
    ],
  }, { title });
}

function* denialProof() {
  yield {
    state: denialGraph('A missing owner name is hashed before interval lookup'),
    highlight: { active: ['q', 'hash', 'e-q-hash'], compare: ['prev', 'next'] },
    explanation: 'For a signed zone using NSEC3, the queried owner name is canonicalized and hashed with the zone parameters. The resolver is no longer looking for the literal missing name; it is looking for where that hash would fall.',
    invariant: 'Authenticated denial is a proof that absence is covered, not just an empty answer.',
  };

  yield {
    state: denialGraph('A signed NSEC3 interval covers the missing hash'),
    highlight: { active: ['hash', 'prev', 'next', 'e-hash-prev', 'e-prev-next'], compare: ['wild'] },
    explanation: 'The authoritative server returns an NSEC3 record whose hashed owner name and next-hashed-owner field bracket the missing query hash. That interval proves no exact owner name with that hash exists in the zone.',
  };

  yield {
    state: denialGraph('Wildcard absence is denied with its own NSEC3 proof', { wild: '*.no', sig: '2 sigs' }),
    highlight: { active: ['hash', 'wild', 'sig', 'e-hash-wild', 'e-wild-sig'], found: ['prev', 'next'] },
    explanation: 'NXDOMAIN and NODATA proofs also have to rule out wildcard synthesis when applicable. A signed denial usually proves both the exact queried name is absent and a matching wildcard cannot legitimately answer.',
  };

  yield {
    state: denialGraph('DNSKEY validation turns the denial into a cacheable negative answer', { nx: 'valid NX', cache: 'neg TTL' }),
    highlight: { found: ['key', 'sig', 'nx', 'cache', 'e-key-sig', 'e-sig-nx', 'e-nx-cache'], active: ['prev', 'wild'] },
    explanation: 'The resolver validates the NSEC3 RRSIGs through the DNSSEC chain of trust, then can cache the negative result under normal negative-cache rules. Without the signatures, this would be only an unsigned miss.',
  };
}

function* hashTradeoff() {
  yield {
    state: labelMatrix(
      'NSEC vs NSEC3',
      [
        { id: 'name', label: 'names' },
        { id: 'walk', label: 'walk' },
        { id: 'cost', label: 'cost' },
        { id: 'proof', label: 'proof' },
      ],
      [
        { id: 'nsec', label: 'NSEC' },
        { id: 'nsec3', label: 'NSEC3' },
      ],
      [
        ['plain', 'hashed'],
        ['easy', 'harder'],
        ['lower', 'higher'],
        ['range', 'h-range'],
      ],
    ),
    highlight: { active: ['name:nsec3', 'walk:nsec3', 'proof:nsec3'], compare: ['cost:nsec3'] },
    explanation: 'Classic NSEC exposes the next owner name and can make zone walking easy. NSEC3 stores hashed owner-name intervals, raising the work factor for casual enumeration while preserving signed denial proofs.',
    invariant: 'NSEC3 is about authenticated absence with less direct disclosure, not secrecy against all guessing.',
  };

  yield {
    state: labelMatrix(
      'NSEC3 parameters',
      [
        { id: 'alg', label: 'alg' },
        { id: 'salt', label: 'salt' },
        { id: 'iter', label: 'iter' },
        { id: 'opt', label: 'opt' },
      ],
      [
        { id: 'job', label: 'job' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['hash', 'old alg'],
        ['mix input', 'reuse'],
        ['work', 'CPU load'],
        ['skip', 'gap'],
      ],
    ),
    highlight: { active: ['salt:job', 'iter:job', 'opt:job'], compare: ['iter:risk', 'opt:risk'] },
    explanation: 'NSEC3 adds parameters: hash algorithm, salt, iteration count, and flags such as opt-out. More iterations raise attacker and resolver work together, so the value is operationally constrained.',
  };

  yield {
    state: denialGraph('Opt-out lets large delegation-heavy zones avoid every unsigned child', { prev: 'opt', next: 'cover', nx: 'proof?' }),
    highlight: { active: ['prev', 'next', 'nx', 'e-prev-next', 'e-sig-nx'], compare: ['wild'], removed: ['cache'] },
    explanation: 'Opt-out allows a signed parent with many unsigned delegations to omit some insecure child names from the NSEC3 chain. That reduces zone size, but the resolver must account for a different denial shape.',
  };

  yield {
    state: labelMatrix(
      'Denial cache entries',
      [
        { id: 'nx', label: 'NX' },
        { id: 'nodata', label: 'NODATA' },
        { id: 'wild', label: 'wild' },
        { id: 'bogus', label: 'bogus' },
      ],
      [
        { id: 'proof', label: 'proof' },
        { id: 'reuse', label: 'reuse' },
      ],
      [
        ['span', 'neg TTL'],
        ['absent', 'neg TTL'],
        ['no match', 'scoped'],
        ['bad sig', 'no'],
      ],
    ),
    highlight: { found: ['nx:reuse', 'nodata:reuse'], compare: ['wild:reuse'], removed: ['bogus:reuse'] },
    explanation: 'A good resolver keeps the proof scope narrow. A signed absence proof can suppress repeated misses, but only for the name, type, class, and interval that the NSEC3 records actually justify.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'denial proof') yield* denialProof();
  else if (view === 'hash tradeoff') yield* hashTradeoff();
  else throw new InputError('Pick an NSEC3 view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as a proof that a DNS name or record type is absent. NSEC3 is a DNSSEC mechanism that proves nonexistence using hashes of owner names, an RR type is a record type such as A or AAAA, and a wildcard is a DNS name like star.example.com that can synthesize answers for missing names. Active state is the query hash, visited state is signed NSEC3 material, and found state is the validated denial.',
        'The safe inference is interval coverage. If a signed NSEC3 record says one hash is followed by another hash, and the query hash falls between them, then no represented owner hash exists in that gap. NXDOMAIN also needs proof that a relevant wildcard cannot answer.',
        {type: 'callout', text: 'Authenticated denial is not an empty answer; it is a signed proof that the hash of the missing name falls inside a committed gap and that no wildcard can legitimately answer.'},
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/e/ea/Illustration_of_NSEC_and_NSEC3_chains_in_DNSSEC.svg', alt: 'Diagram of NSEC and NSEC3 chains showing a missing DNS name mapped into a hashed interval proof.', caption: 'NSEC and NSEC3 chain illustration by MatthÃ¤us Wander, own work, CC0 1.0, via Wikimedia Commons.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'DNSSEC can prove that a positive answer was signed by the zone owner. Absence needs proof too. A forged NXDOMAIN can hide a real host, and a forged NODATA response can suppress a specific record type.',
        'NSEC proves absence by signing gaps between literal owner names. NSEC3 keeps the gap idea but orders hashes of owner names instead. That reduces direct disclosure of neighboring names while still giving resolvers signed evidence of absence.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious signed denial is a signed statement that says no such name. That is too vague for DNS. A resolver must distinguish a missing owner name, an existing owner with a missing type, a wildcard that could answer, and a delegation boundary.',
        'Classic NSEC makes the structure simple. It signs each owner name with the next owner name and a bitmap of types present at the current owner. The drawback is that repeated negative queries can reveal the zone names in order.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is disclosure plus precision. Literal NSEC is easy to validate, but it exposes adjacent names. NSEC3 hides literal adjacency behind hashes, but it must still prove the exact DNS fact needed by the query.',
        'Hashed names are not secret names. Common labels such as www, mail, api, and login can be guessed and hashed offline. NSEC3 reduces casual zone walking; it does not turn published DNS into a confidentiality system.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'NSEC3 builds a signed ring over hashed owner names. Each NSEC3 record commits to the current owner hash, the next owner hash, and a type bitmap for the original owner. The resolver hashes the queried name with the zone parameters and checks where that hash falls.',
        'The signature, not the hash alone, creates authority. Hashing changes what the interval reveals. The RRSIG over the NSEC3 record makes the interval part of the signed zone data.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The zone signer canonicalizes owner names, applies the NSEC3 hash parameters, sorts the hashes, and links each hash to the next hash. The final record wraps around to the first hash, so the signed records cover the whole hash ring. Each record also carries a bitmap of RR types present at its owner.',
        'For NXDOMAIN, the response must prove that the queried name is not represented, identify the closest existing ancestor, and deny the wildcard that could have synthesized an answer. For NODATA, the response proves that the owner exists but the requested type bit is absent. Each proof record must validate through the DNSSEC chain of trust.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is an authenticated order argument. If signed adjacent hashes H1 and H2 cover the query hash, then the signed zone order leaves no represented owner hash in that interval. A server cannot insert the missing name without breaking the signed chain.',
        'The type bitmap handles existing names. If the owner hash is present and the signed bitmap lacks AAAA, the resolver can return NODATA for AAAA without claiming the owner name is absent. Wildcard denial closes the remaining hole by proving that no wildcard can legitimately synthesize the requested answer.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'NSEC3 adds hashing, response bytes, signatures, and more resolver logic to negative answers. A single NXDOMAIN proof can need multiple NSEC3 records and RRSIGs. Extra hash iterations increase CPU work for resolvers and authoritative servers.',
        'Current guidance is conservative. RFC 9276 recommends NSEC instead of NSEC3 unless NSEC3 is needed, and recommends zero extra iterations and empty salt when NSEC3 is used. Negative caching still matters because validated denial can be reused only within the TTL and proof scope.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'NSEC3 is useful for signed zones that need authenticated denial but do not want plain NSEC to reveal literal neighboring names. Large public zones and registry-like environments are the natural case because name disclosure has operational value to attackers or scrapers. The use is justified only when that disclosure concern exceeds the extra complexity.',
        'The broader lesson is authenticated absence. Many systems prove non-membership by showing where the missing item would have to appear in an authenticated order. NSEC3 teaches that pattern in DNS terminology.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'NSEC3 fails as a secrecy tool for predictable names. Anyone can hash likely labels with public zone parameters and compare them with collected proofs. If the name itself must be secret, DNS publication is the wrong primitive.',
        'It also fails when parameters or opt-out are misunderstood. Unsupported algorithms, inconsistent salts or iteration counts, invalid signatures, intervals that do not cover the needed hash, and wrong type bitmaps must produce bogus validation. Opt-out spans require special care because they do not assert every ordinary name fact inside the span.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose typo.example.com hashes to 7400 under the zone parameters. The response includes a signed NSEC3 record whose owner hash is 7000 and next hash is 7600. Since 7400 lies inside that covered interval, the exact queried owner hash is not represented in the signed zone order.',
        'For NXDOMAIN, the resolver also checks the closest-encloser proof and a wildcard denial. If star.example.com would hash to 6100 and a signed interval covers 6100 as absent, the wildcard cannot synthesize an answer. The resolver can then return authenticated denial instead of trusting an unsigned empty response.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources include RFC 5155 at https://www.rfc-editor.org/rfc/rfc5155, RFC 9276 at https://www.rfc-editor.org/rfc/rfc9276, and RFC 4035 at https://www.rfc-editor.org/rfc/rfc4035. Study DNSSEC chain validation before this topic, DNS negative caching for reuse of denial, sparse Merkle non-membership for the same proof shape, and hash tables for collision and distribution behavior.',
      ],
    },
  ],
};
