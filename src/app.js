// Page bootstrap: decides between homepage and topic page, wires search,
// navigation, and the theme toggle. All content comes from the registry.

import { topics, categories, searchTopics, linkifyByTitle } from './registry.js';
import {
  learningTracks,
  domainGuides,
  trackTopicIds,
  uniqueTrackTopicIds,
  getTopicTrackPlacements,
  searchTracks,
} from './tracks.js';
import { createTopicRuntime } from './core/visualizer.js';

// Render text with explicit URLs as external links, and the first mention of
// any other topic's title as an inline link to that topic's page. Used for
// explanations and study notes.
const URL_PATTERN = /https?:\/\/[^\s<>"']+/g;
const topicById = new Map(topics.map((entry) => [entry.id, entry]));

function appendTopicLinkedText(el, text, excludeId) {
  for (const seg of linkifyByTitle(text, excludeId)) {
    if (seg.id) {
      const a = document.createElement('a');
      a.className = 'inline-topic-link';
      a.href = `./topic.html?topic=${seg.id}`;
      a.textContent = seg.text;
      el.appendChild(a);
    } else {
      el.appendChild(document.createTextNode(seg.text));
    }
  }
}

function renderLinkedText(el, text, excludeId) {
  el.textContent = '';
  const source = String(text ?? '');
  let cursor = 0;
  for (const match of source.matchAll(URL_PATTERN)) {
    if (match.index > cursor) appendTopicLinkedText(el, source.slice(cursor, match.index), excludeId);

    let href = match[0];
    let trailing = '';
    while (/[.,;:!?)]$/.test(href)) {
      trailing = `${href.at(-1)}${trailing}`;
      href = href.slice(0, -1);
    }

    const a = document.createElement('a');
    a.className = 'external-source-link';
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = href.replace(/^https?:\/\//, '');
    el.appendChild(a);
    if (trailing) el.appendChild(document.createTextNode(trailing));

    cursor = match.index + match[0].length;
  }
  if (cursor < source.length) appendTopicLinkedText(el, source.slice(cursor), excludeId);
}

// ----------------------------------------------------------------- theme

function initTheme() {
  const stored = localStorage.getItem('theme');
  if (stored) document.documentElement.dataset.theme = stored;
  const button = document.querySelector('[data-theme-toggle]');
  if (!button) return;
  button.addEventListener('click', () => {
    const current = document.documentElement.dataset.theme
      || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('theme', next);
  });
}

// ------------------------------------------------------------------ home

function entryHref(entry) {
  return entry.type === 'article' ? entry.url : `./topic.html?topic=${entry.id}`;
}

function topicHref(topicId, trackId = null) {
  const entry = topicById.get(topicId);
  if (!entry) return './index.html';
  const href = entryHref(entry);
  return trackId && entry.type !== 'article' ? `${href}&track=${trackId}` : href;
}

function appendTopicLinkList(container, ids, options = {}) {
  const { trackId = null, limit = ids.length } = options;
  const visible = ids
    .map((id) => topicById.get(id))
    .filter(Boolean)
    .slice(0, limit);

  for (const entry of visible) {
    const link = document.createElement('a');
    link.href = topicHref(entry.id, trackId);
    link.textContent = entry.title;
    container.appendChild(link);
  }

  const hidden = ids.length - visible.length;
  if (hidden > 0) {
    const more = document.createElement('span');
    more.className = 'more-count';
    more.textContent = `+${hidden} more`;
    container.appendChild(more);
  }
}

function initHome() {
  const listEl = document.querySelector('[data-topic-list]');
  const searchEl = document.querySelector('[data-search]');

  function renderSection(heading, entries, parent = listEl) {
    const section = document.createElement('section');
    section.className = 'category';
    const h = document.createElement('h2');
    h.textContent = heading;
    section.appendChild(h);
    const grid = document.createElement('div');
    grid.className = 'card-grid';
    for (const entry of entries) {
      const card = document.createElement('a');
      card.className = 'card';
      card.href = entryHref(entry);
      const title = document.createElement('h3');
      title.textContent = entry.title;
      const summary = document.createElement('p');
      summary.textContent = entry.summary;
      card.append(title, summary);
      grid.appendChild(card);
    }
    section.appendChild(grid);
    parent.appendChild(section);
  }

  function renderTrackCard(track, compact = false) {
    const card = document.createElement('article');
    card.className = compact ? 'track-card track-card-compact' : 'track-card';

    const eyebrow = document.createElement('p');
    eyebrow.className = 'track-meta';
    eyebrow.textContent = `${track.level} · ${track.pace}`;

    const title = document.createElement('h3');
    title.textContent = track.title;

    const summary = document.createElement('p');
    summary.className = 'track-summary';
    summary.textContent = track.summary;

    const outcome = document.createElement('p');
    outcome.className = 'track-outcome';
    outcome.textContent = track.outcome;

    const modules = document.createElement('ol');
    modules.className = 'track-modules';
    const moduleLimit = compact ? 2 : track.modules.length;
    for (const module of track.modules.slice(0, moduleLimit)) {
      const item = document.createElement('li');
      const moduleTitle = document.createElement('strong');
      moduleTitle.textContent = module.title;
      item.appendChild(moduleTitle);
      if (!compact) item.appendChild(document.createTextNode(`: ${module.goal}`));
      modules.appendChild(item);
    }
    if (compact && track.modules.length > moduleLimit) {
      const more = document.createElement('li');
      more.textContent = `${track.modules.length - moduleLimit} more modules`;
      modules.appendChild(more);
    }

    const actions = document.createElement('p');
    actions.className = 'track-actions';
    const start = document.createElement('a');
    start.className = 'btn btn-primary';
    start.href = topicHref(trackTopicIds(track)[0], track.id);
    start.textContent = 'Start path';
    const count = document.createElement('span');
    count.className = 'track-count';
    count.textContent = `${uniqueTrackTopicIds(track).length} unique topics`;
    actions.append(start, count);

    card.append(eyebrow, title, summary);
    if (!compact) card.appendChild(outcome);
    card.append(modules, actions);
    return card;
  }

  function renderCurriculumOverview() {
    const section = document.createElement('section');
    section.className = 'curriculum-section';

    const h = document.createElement('h2');
    h.textContent = 'Start With a Learning Path';
    const p = document.createElement('p');
    p.className = 'section-intro';
    p.textContent = 'The full library is large on purpose. Paths turn it into courses: who each route is for, what order to study, what the modules unlock, and what to do next.';

    const grid = document.createElement('div');
    grid.className = 'track-grid';
    for (const track of learningTracks) grid.appendChild(renderTrackCard(track));

    section.append(h, p, grid);
    listEl.appendChild(section);
  }

  function renderDomainMap() {
    const section = document.createElement('section');
    section.className = 'domain-section';

    const h = document.createElement('h2');
    h.textContent = 'Domain Map';
    const p = document.createElement('p');
    p.className = 'section-intro';
    p.textContent = 'Domains are shelves; paths are courses. Use this map when you know the broad area but need a safe first topic.';

    const grid = document.createElement('div');
    grid.className = 'domain-grid';
    for (const category of categories) {
      const guide = domainGuides[category];
      const entries = topics.filter((entry) => entry.category === category);
      if (!guide || entries.length === 0) continue;

      const card = document.createElement('article');
      card.className = 'domain-card';
      const title = document.createElement('h3');
      title.textContent = category;
      const count = document.createElement('p');
      count.className = 'domain-count';
      count.textContent = `${entries.length} topics`;
      const summary = document.createElement('p');
      summary.textContent = guide.summary;
      const use = document.createElement('p');
      use.className = 'domain-use';
      use.textContent = guide.useWhen;
      const starters = document.createElement('div');
      starters.className = 'mini-link-list';
      appendTopicLinkList(starters, guide.starterTopicIds);
      card.append(title, count, summary, use, starters);
      grid.appendChild(card);
    }

    section.append(h, p, grid);
    listEl.appendChild(section);
  }

  function renderAllTopicBrowse() {
    const details = document.createElement('details');
    details.className = 'all-topics';
    const summary = document.createElement('summary');
    summary.textContent = `Browse all ${topics.length} topics by category`;
    details.appendChild(summary);
    for (const category of categories) {
      const entries = topics.filter((t) => t.category === category);
      if (entries.length > 0) renderSection(category, entries, details);
    }
    listEl.appendChild(details);
  }

  function render(rawQuery = '') {
    const query = rawQuery.trim();
    listEl.replaceChildren();

    if (query) {
      // ranked, typo-tolerant results in relevance order
      const trackResults = searchTracks(query);
      const results = searchTopics(query);
      if (trackResults.length > 0) {
        const section = document.createElement('section');
        section.className = 'curriculum-section';
        const h = document.createElement('h2');
        h.textContent = `Learning paths (${trackResults.length})`;
        const grid = document.createElement('div');
        grid.className = 'track-grid track-grid-compact';
        for (const track of trackResults) grid.appendChild(renderTrackCard(track, true));
        section.append(h, grid);
        listEl.appendChild(section);
      }
      if (results.length === 0 && trackResults.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'empty-results';
        empty.textContent = `Nothing matches "${query}" yet — more topics are on the way.`;
        listEl.appendChild(empty);
        return;
      }
      if (results.length > 0) renderSection(`Topics (${results.length})`, results);
      return;
    }

    renderCurriculumOverview();
    renderDomainMap();
    renderAllTopicBrowse();
  }

  searchEl.addEventListener('input', () => render(searchEl.value));
  render();
}

// ----------------------------------------------------------------- topic

function renderTopicNav(nav, currentId) {
  for (const category of categories) {
    const entries = topics.filter((t) => t.category === category);
    if (entries.length === 0) continue;
    const heading = document.createElement('h2');
    heading.textContent = category;
    nav.appendChild(heading);
    const list = document.createElement('ul');
    for (const entry of entries) {
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = entryHref(entry);
      link.textContent = entry.title;
      if (entry.id === currentId) link.setAttribute('aria-current', 'page');
      item.appendChild(link);
      list.appendChild(item);
    }
    nav.appendChild(list);
  }
}

async function initTopic() {
  const root = document.querySelector('[data-page="topic"]');
  const params = new URLSearchParams(location.search);
  const id = params.get('topic');
  const activeTrackId = params.get('track');
  const entry = topics.find((t) => t.id === id && t.type === 'visualization');
  const titleEl = root.querySelector('[data-topic-title]');

  renderTopicNav(root.querySelector('[data-topic-nav]'), id);

  if (!entry) {
    titleEl.textContent = 'Topic not found';
    root.querySelector('[data-topic-summary]').textContent =
      'That topic does not exist (yet). Pick one from the list.';
    root.querySelector('.learn-grid').hidden = true;
    return;
  }

  document.title = `${entry.title} — Visualized`;
  titleEl.textContent = entry.title;
  root.querySelector('[data-topic-summary]').textContent = entry.summary;
  renderTopicLinks(root.querySelector('[data-topic-links]'), entry);
  renderTopicContext(root.querySelector('[data-topic-context]'), entry, activeTrackId);

  const mod = await entry.module();
  const initialInput = {};
  for (const control of mod.topic.controls ?? []) {
    if (params.has(control.id)) initialInput[control.id] = params.get(control.id);
  }
  createTopicRuntime({
    root,
    topic: mod.topic,
    initialInput,
    renderExplanation: (el, text) => renderLinkedText(el, text, entry.id),
  });
  renderArticle(root.querySelector('[data-topic-article]'), mod.article, entry.id);
}

// Study notes: the written course that lives under every animation.
// Modules export `article = { sections: [{heading, paragraphs: [...]}] }`.
function renderArticle(container, article, topicId) {
  if (!article || !Array.isArray(article.sections)) return;

  const slugify = (text) => String(text ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    || 'section';

  const title = container.querySelector('.study-title');
  const nav = document.createElement('nav');
  nav.className = 'study-jump-list';
  nav.setAttribute('aria-label', 'Study note sections');

  const sections = document.createElement('div');
  sections.className = 'study-sections';

  for (const section of article.sections) {
    const slug = `${topicId}-${slugify(section.heading)}`;
    const articleSection = document.createElement('article');
    articleSection.className = 'study-section';
    articleSection.id = slug;

    const jump = document.createElement('a');
    jump.href = `#${slug}`;
    jump.textContent = section.heading;
    nav.appendChild(jump);

    const heading = document.createElement('h3');
    heading.textContent = section.heading;
    articleSection.appendChild(heading);
    for (const text of section.paragraphs) {
      const p = document.createElement('p');
      renderLinkedText(p, text, topicId);
      articleSection.appendChild(p);
    }
    sections.appendChild(articleSection);
  }

  if (title) title.after(nav, sections);
  else container.append(nav, sections);
  container.hidden = false;
}

// "Built from": the simpler ideas this topic is composed of.
// "Next up": computed in reverse — everything that builds on this topic.
function renderTopicLinks(container, entry) {
  const buildsOn = (entry.buildsOn ?? [])
    .map((id) => topics.find((t) => t.id === id))
    .filter(Boolean);
  const leadsTo = topics.filter((t) => (t.buildsOn ?? []).includes(entry.id));

  const addRow = (label, entries) => {
    if (entries.length === 0) return;
    const row = document.createElement('p');
    row.className = 'chip-row';
    const caption = document.createElement('span');
    caption.className = 'chip-caption';
    caption.textContent = label;
    row.appendChild(caption);
    const visible = entries.slice(0, 12);
    for (const target of visible) {
      const chip = document.createElement('a');
      chip.className = 'chip';
      chip.href = entryHref(target);
      chip.textContent = target.title;
      row.appendChild(chip);
    }
    if (entries.length > visible.length) {
      const more = document.createElement('span');
      more.className = 'chip chip-more';
      more.textContent = `+${entries.length - visible.length} more`;
      row.appendChild(more);
    }
    container.appendChild(row);
  };

  addRow('Built from:', buildsOn);
  addRow('Next up:', leadsTo);
}

function renderTopicContext(container, entry, activeTrackId) {
  if (!container) return;
  container.replaceChildren();

  const placements = getTopicTrackPlacements(entry.id);
  const activePlacement =
    placements.find((placement) => placement.track.id === activeTrackId) ?? placements[0] ?? null;
  const buildsOn = (entry.buildsOn ?? []).filter((id) => topicById.has(id));
  const leadsTo = topics
    .filter((topic) => (topic.buildsOn ?? []).includes(entry.id))
    .map((topic) => topic.id);

  if (!activePlacement && placements.length === 0 && buildsOn.length === 0 && leadsTo.length === 0) {
    container.hidden = true;
    return;
  }

  const heading = document.createElement('h2');
  heading.textContent = 'Where This Fits';
  container.appendChild(heading);

  if (activePlacement) {
    const { track, module, moduleIndex, absoluteIndex, total, previousId, nextId } = activePlacement;
    const primary = document.createElement('article');
    primary.className = 'context-primary';

    const meta = document.createElement('p');
    meta.className = 'track-meta';
    meta.textContent = `${track.title} · module ${moduleIndex + 1} of ${track.modules.length} · topic ${absoluteIndex + 1} of ${total}`;

    const title = document.createElement('h3');
    title.textContent = module.title;

    const goal = document.createElement('p');
    goal.textContent = module.goal;

    const use = document.createElement('p');
    use.className = 'context-use';
    use.textContent = track.useWhen;

    const stepNav = document.createElement('div');
    stepNav.className = 'step-nav';
    if (previousId) {
      const previous = document.createElement('a');
      previous.href = topicHref(previousId, track.id);
      previous.textContent = `Previous: ${topicById.get(previousId)?.title ?? previousId}`;
      stepNav.appendChild(previous);
    }
    if (nextId) {
      const next = document.createElement('a');
      next.href = topicHref(nextId, track.id);
      next.textContent = `Next: ${topicById.get(nextId)?.title ?? nextId}`;
      stepNav.appendChild(next);
    }

    primary.append(meta, title, goal, use, stepNav);
    container.appendChild(primary);
  }

  if (placements.length > 0) {
    const pathRow = document.createElement('p');
    pathRow.className = 'chip-row context-paths';
    const caption = document.createElement('span');
    caption.className = 'chip-caption';
    caption.textContent = 'Also in:';
    pathRow.appendChild(caption);
    for (const placement of placements) {
      const link = document.createElement('a');
      link.className = 'chip';
      link.href = topicHref(entry.id, placement.track.id);
      link.textContent = placement.track.shortTitle;
      if (placement.track.id === activePlacement?.track.id) link.setAttribute('aria-current', 'true');
      pathRow.appendChild(link);
    }
    container.appendChild(pathRow);
  }

  const grid = document.createElement('div');
  grid.className = 'context-grid';

  const addContextCard = (title, body, ids, emptyText) => {
    const card = document.createElement('article');
    card.className = 'context-card';
    const h = document.createElement('h3');
    h.textContent = title;
    const p = document.createElement('p');
    p.textContent = body;
    const links = document.createElement('div');
    links.className = 'mini-link-list';
    if (ids.length > 0) appendTopicLinkList(links, ids, { limit: 8 });
    else links.textContent = emptyText;
    card.append(h, p, links);
    grid.appendChild(card);
  };

  addContextCard(
    'Learn Before',
    'Prerequisites declared by this topic. These are the ingredients that make the animation easier to read.',
    buildsOn,
    'No explicit prerequisites yet.',
  );
  addContextCard(
    'This Unlocks',
    'Topics that directly build on this one. Use these when the idea feels solid and you want the next application.',
    leadsTo,
    'No direct dependents yet.',
  );

  container.appendChild(grid);
  container.hidden = false;
}

// -------------------------------------------------------------- bootstrap

initTheme();
const page = document.body.dataset.page || document.querySelector('[data-page]')?.dataset.page;
if (page === 'home') initHome();
if (page === 'topic') initTopic();
