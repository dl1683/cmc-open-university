// Storage Access API: embedded cross-site documents, partitioned vs
// unpartitioned storage, user activation, permission grants, and fallbacks.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'storage-access-api-third-party-cookie-case-study',
  title: 'Storage Access API Third-Party Cookie Gate',
  category: 'Security',
  summary: 'How embedded cross-site documents check and request access to third-party cookies and unpartitioned state under modern browser privacy controls.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['embed request', 'fallback design'], defaultValue: 'embed request' },
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

function storageGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'top', label: 'top site', x: 0.5, y: 4.2, note: notes.top ?? 'publisher' },
      { id: 'frame', label: 'iframe', x: 2.8, y: 4.2, note: notes.frame ?? 'idp/embed' },
      { id: 'part', label: 'partition', x: 4.7, y: 2.8, note: notes.part ?? 'top+embed' },
      { id: 'unpart', label: 'unpart', x: 4.7, y: 5.6, note: notes.unpart ?? 'embed site' },
      { id: 'check', label: 'check', x: 6.4, y: 4.2, note: notes.check ?? 'hasAccess' },
      { id: 'prompt', label: 'grant', x: 8.0, y: 2.8, note: notes.prompt ?? 'user/UA' },
      { id: 'cookie', label: 'cookie', x: 8.0, y: 5.6, note: notes.cookie ?? 'session' },
      { id: 'result', label: 'result', x: 9.5, y: 4.2, note: notes.result ?? 'allow/deny' },
    ],
    edges: [
      { id: 'e-top-frame', from: 'top', to: 'frame', weight: '' },
      { id: 'e-frame-part', from: 'frame', to: 'part', weight: '' },
      { id: 'e-frame-unpart', from: 'frame', to: 'unpart', weight: '' },
      { id: 'e-frame-check', from: 'frame', to: 'check', weight: '' },
      { id: 'e-check-prompt', from: 'check', to: 'prompt', weight: '' },
      { id: 'e-prompt-cookie', from: 'prompt', to: 'cookie', weight: '' },
      { id: 'e-cookie-result', from: 'cookie', to: 'result', weight: '' },
      { id: 'e-check-result', from: 'check', to: 'result', weight: '' },
    ],
  }, { title });
}

function* embedRequest() {
  yield {
    state: storageGraph('A cross-site iframe may start with partitioned storage only'),
    highlight: { active: ['top', 'frame', 'part', 'e-top-frame', 'e-frame-part'], compare: ['unpart'] },
    explanation: 'Modern browsers often block or partition third-party cookies. An embedded document should not assume it can read the same unpartitioned cookie jar it has when visited as a top-level site.',
    invariant: 'The top site is part of the storage context for embedded third-party state.',
  };

  yield {
    state: storageGraph('The embed checks whether it already has storage access', { check: 'hasStorageAccess', result: 'false' }),
    highlight: { active: ['frame', 'check', 'result', 'e-frame-check', 'e-check-result'], compare: ['cookie'] },
    explanation: 'The Storage Access API gives the embed a capability check. If access is unavailable, the frame can request access instead of failing silently or assuming cookies work.',
  };

  yield {
    state: labelMatrix(
      'Request gates',
      [
        { id: 'embed', label: 'embedded' },
        { id: 'gesture', label: 'gesture' },
        { id: 'policy', label: 'policy' },
        { id: 'browser', label: 'browser' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'failure' },
      ],
      [
        ['third party', 'top-level only'],
        ['user intent', 'no activation'],
        ['iframe allow', 'blocked'],
        ['privacy gate', 'denied'],
      ],
    ),
    highlight: { active: ['gesture:role', 'policy:role', 'browser:role'], compare: ['embed:failure'] },
    explanation: 'Requests are intentionally gated. Browsers may require user activation, iframe delegation, prior first-party interaction, or other privacy conditions before granting unpartitioned access.',
  };

  yield {
    state: storageGraph('A granted request opens the embed site cookie jar', { prompt: 'granted', cookie: 'unpart ok', result: 'logged in' }),
    highlight: { active: ['prompt', 'cookie', 'result', 'e-prompt-cookie', 'e-cookie-result'], found: ['unpart'] },
    explanation: 'When granted, the embedded document can access its unpartitioned cookies and state according to browser rules. The grant should be treated as scoped and revocable, not a permanent entitlement.',
  };

  yield {
    state: storageGraph('A denied request must degrade without breaking the page', { prompt: 'denied', cookie: 'none', result: 'fallback' }),
    highlight: { removed: ['cookie'], active: ['check', 'prompt', 'result', 'e-check-prompt'], compare: ['part'] },
    explanation: 'The embed needs a fallback: open a top-level login, use a signed one-time token, show a logged-out widget, or use partitioned state. Silent broken iframes are a product bug.',
  };
}

function* fallbackDesign() {
  yield {
    state: labelMatrix(
      'Embed patterns',
      [
        { id: 'sso', label: 'SSO' },
        { id: 'pay', label: 'payment' },
        { id: 'comments', label: 'comments' },
        { id: 'ads', label: 'ads' },
      ],
      [
        { id: 'need', label: 'need' },
        { id: 'fallback' },
      ],
      [
        ['login state', 'top login'],
        ['session', 'redirect'],
        ['account', 'guest mode'],
        ['tracking?', 'no access'],
      ],
    ),
    highlight: { found: ['sso:fallback', 'pay:fallback'], removed: ['ads:need'] },
    explanation: 'Different embeds have different legitimacy. SSO and payments may need first-party state. Ads and broad tracking usually should not get unpartitioned storage access.',
    invariant: 'Storage access is a narrow compatibility valve, not a tracking entitlement.',
  };

  yield {
    state: storageGraph('A top-level bounce can establish first-party state', { top: 'embed site', frame: 'top login', unpart: 'first party', cookie: 'session set', result: 'return' }),
    highlight: { active: ['top', 'unpart', 'cookie', 'result'], compare: ['frame'] },
    explanation: 'Some flows use a top-level visit to the embedded service for login or consent, then return to the original site. That makes state explicit instead of relying on invisible third-party cookies.',
  };

  yield {
    state: storageGraph('Partitioned state keeps per-top-site isolation', { part: 'per publisher', cookie: 'partitioned', result: 'limited' }),
    highlight: { active: ['frame', 'part', 'cookie', 'result', 'e-frame-part'], compare: ['unpart'] },
    explanation: 'Partitioned cookies or storage can let an embed keep state per top-level site without linking identity across all publishers. That is often better for privacy than requesting unpartitioned state.',
  };

  yield {
    state: labelMatrix(
      'Design checklist',
      [
        { id: 'check', label: 'check first' },
        { id: 'gesture', label: 'gesture UX' },
        { id: 'token', label: 'token alt' },
        { id: 'audit', label: 'audit' },
      ],
      [
        { id: 'purpose', label: 'purpose' },
        { id: 'risk' },
      ],
      [
        ['precheck', 'false assume'],
        ['user intent', 'dark pattern'],
        ['one-time flow', 'replay'],
        ['grant history', 'privacy'],
      ],
    ),
    highlight: { active: ['check:purpose', 'gesture:purpose', 'token:purpose'], compare: ['audit:risk'] },
    explanation: 'A well-designed embed checks access, explains the request, supports a top-level or token fallback, and logs the grant path for privacy review.',
  };

  yield {
    state: storageGraph('The complete case study is an embedded identity widget', { top: 'news site', frame: 'idp frame', check: 'request', prompt: 'user click', result: 'sign in' }),
    highlight: { active: ['top', 'frame', 'check', 'prompt', 'cookie', 'result'], found: ['e-top-frame', 'e-check-prompt'] },
    explanation: 'An identity provider embedded on a news site checks storage access. If denied, it asks after a user click or opens a top-level login. If granted, it reads its session cookie and renders the signed-in widget.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'embed request') yield* embedRequest();
  else if (view === 'fallback design') yield* fallbackDesign();
  else throw new InputError('Pick a Storage Access view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'The Storage Access API lets embedded cross-site documents check and request access to third-party cookies and unpartitioned state when browser privacy settings would otherwise block that access. It is a permission-style gate for compatibility-sensitive embeds.',
        'MDN explains that the API can be used by embedded cross-site documents to verify and request access to third-party cookies and unpartitioned state: https://developer.mozilla.org/en-US/docs/Web/API/Storage_Access_API/Using. The Privacy CG Storage Access draft is at https://privacycg.github.io/storage-access/.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'An identity widget is embedded in an iframe on a publisher site. It calls hasStorageAccess. If it already has access, it reads its identity-provider session and renders signed-in state. If not, it waits for a user gesture and calls requestStorageAccess, or opens a top-level login flow. If denied, it renders signed-out UI with a clear sign-in path.',
        'This sits between SameSite Cookies & CSRF, Browser Cache Partitioning Network Key, and Permissions Policy Feature Gate: cookies decide attachment, partitioning decides which browser state is separated by top-level site, Storage Access decides whether an embed can reach unpartitioned state, and Permissions Policy decides which powerful browser features an iframe can use.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study SameSite Cookies & CSRF for cookie attachment rules, Browser Cache Partitioning Network Key for network-state isolation, Permissions Policy Feature Gate for iframe delegation, OAuth PKCE Token Lifecycle Case Study for top-level login redirects, WebAuthn Passkeys for passwordless authentication, and Content Security Policy for reducing script-level token theft.',
      ],
    },
  ],
};
