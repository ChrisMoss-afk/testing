// §§ COMMENT: Polytechnic Pulse V2 logic. Vanilla JS only; no build step, no dependency lock-in.

(() => {
  'use strict';

  const CONTENT_PATH = 'content/';
  const state = {
    site: {},
    alerts: [],
    news: [],
    events: [],
    deadlines: [],
    resources: [],
    videos: [],
    jobs: [],
    sponsors: [],
    partners: [],
    adPackages: [],
    feed: []
  };

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    bindNavigation();
    setActiveNavigation();
    await loadAllContent();
    hydrateBrand();
    buildUnifiedFeed();
    renderPage();
    bindFeedControls();
    bindForms();
  }

  // §§ COMMENT: Content parser. Editors update text files; JS converts each --- block into a structured object.
  async function loadTextFile(file) {
    const response = await fetch(`${CONTENT_PATH}${file}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Could not load ${file}`);
    return response.text();
  }

  async function loadBlocks(file) {
    try {
      const text = await loadTextFile(file);
      return parseBlocks(text);
    } catch (error) {
      showLoadError(file, error);
      return [];
    }
  }

  async function loadSettings(file) {
    try {
      const text = await loadTextFile(file);
      return parseKeyValue(text);
    } catch (error) {
      showLoadError(file, error);
      return {};
    }
  }

  async function loadAllContent() {
    const [site, alerts, news, events, deadlines, resources, videos, jobs, sponsors, partners, adPackages] = await Promise.all([
      loadSettings('site.txt'),
      loadBlocks('alerts.txt'),
      loadBlocks('news.txt'),
      loadBlocks('events.txt'),
      loadBlocks('deadlines.txt'),
      loadBlocks('resources.txt'),
      loadBlocks('videos.txt'),
      loadBlocks('jobs.txt'),
      loadBlocks('sponsors.txt'),
      loadBlocks('partners.txt'),
      loadBlocks('ad-packages.txt')
    ]);

    Object.assign(state, { site, alerts, news, events, deadlines, resources, videos, jobs, sponsors, partners, adPackages });
  }

  function parseBlocks(text) {
    return text
      .split(/\n---\s*\n|^---\s*\n|\n---\s*$/gm)
      .map(chunk => chunk.trim())
      .filter(Boolean)
      .map(parseKeyValue);
  }

  function parseKeyValue(text) {
    const output = {};
    let currentKey = null;

    text.split(/\r?\n/).forEach(line => {
      if (!line.trim() || line.trim().startsWith('#')) return;
      const keyMatch = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);

      if (keyMatch) {
        currentKey = keyMatch[1].trim();
        output[currentKey] = keyMatch[2].trim();
        return;
      }

      if (currentKey) output[currentKey] += `\n${line.trim()}`;
    });

    return output;
  }

  function showLoadError(file, error) {
    console.warn(error);
    const target = $('[data-alert-band]') || $('#main');
    if (!target || $('[data-load-error]')) return;

    const message = document.createElement('div');
    message.className = 'container load-error';
    message.dataset.loadError = 'true';
    message.innerHTML = `<strong>Content files could not be loaded.</strong> Run the local server script, then open the localhost link. Direct file opening can block content loading in some browsers.`;
    target.prepend(message);
  }

  function hydrateBrand() {
    document.title = document.title.replace('Polytechnic Pulse', state.site.title || 'Polytechnic Pulse');
    $$('[data-site-title]').forEach(node => node.textContent = state.site.title || 'Polytechnic Pulse');
    $$('[data-site-tagline]').forEach(node => node.textContent = state.site.tagline || 'RDP campus information hub');
    $$('[data-site-mission]').forEach(node => node.textContent = state.site.mission || node.textContent);
  }

  function buildUnifiedFeed() {
    const normalize = (items, type) => items.map(item => ({ ...item, type: item.type || type }));
    state.feed = [
      ...normalize(state.alerts, 'alert'),
      ...normalize(state.news, 'news'),
      ...normalize(state.events, 'event'),
      ...normalize(state.deadlines, 'deadline'),
      ...normalize(state.resources, 'resource'),
      ...normalize(state.videos, 'video'),
      ...normalize(state.jobs, 'job')
    ].sort((a, b) => safeDate(b.date) - safeDate(a.date));
  }

  function renderPage() {
    const page = document.body.dataset.page;
    renderAlerts();
    renderPartners();

    if (page === 'home') renderHome();
    if (page === 'updates') renderUpdates();
    if (page === 'events') renderEventsPage();
    if (page === 'media') renderMediaPage();
    if (page === 'jobs') renderJobsPage();
    if (page === 'advertise') renderAdvertisePage();
  }

  function renderHome() {
    renderTodayPanel();
    renderFeatureStory();
    renderFeatureVideo();
    renderThisWeek();
    renderResourcesPreview();
    renderJobsPreview();
    renderSponsorSpotlight();
  }

  function renderTodayPanel() {
    const target = $('[data-today-panel]');
    if (!target) return;

    const topAlert = state.alerts.find(item => item.priority === 'high') || state.alerts[0];
    const nextEvents = [...state.events].sort((a, b) => safeDate(a.date) - safeDate(b.date)).slice(0, 2);
    const nextDeadline = [...state.deadlines].sort((a, b) => safeDate(a.date) - safeDate(b.date))[0];
    const items = [topAlert, ...nextEvents, nextDeadline].filter(Boolean).slice(0, 4);

    target.innerHTML = items.map(item => `
      <article class="today-item">
        <div class="today-date"><small>${month(item.date)}</small>${day(item.date)}</div>
        <div>
          <span class="badge">${escapeHtml(item.type || item.category || 'Update')}</span>
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.summary || item.location || '')}</p>
        </div>
      </article>
    `).join('') || `<p class="no-results">No campus items are loaded yet.</p>`;
  }

  function renderAlerts() {
    const target = $('[data-alert-band]');
    if (!target) return;
    const alerts = state.alerts.slice(0, 5);
    target.innerHTML = `<div class="alert-inner">${alerts.map(item => `
      <a class="alert-pill priority-${escapeHtml(item.priority || 'normal')}" href="${escapeAttr(item.link || 'updates.html')}">${escapeHtml(item.title)}</a>
    `).join('')}</div>`;
  }

  function renderFeatureStory() {
    const target = $('[data-feature-story]');
    if (!target) return;
    const item = state.news.find(news => news.feature === 'true') || state.news[0];
    if (!item) return;
    target.innerHTML = `
      <div class="placeholder-media" role="img" aria-label="Grey placeholder image for ${escapeAttr(item.title)}"></div>
      <div class="feature-body">
        <div>
          <p class="eyebrow">Featured Update</p>
          <h2>${escapeHtml(item.title)}</h2>
          <p>${escapeHtml(item.summary)}</p>
        </div>
        <a class="text-link" href="${escapeAttr(item.link || 'updates.html')}">Read update</a>
      </div>`;
  }

  function renderFeatureVideo() {
    const target = $('[data-feature-video]');
    if (!target) return;
    const item = state.videos.find(video => video.feature === 'true') || state.videos[0];
    if (!item) return;
    target.innerHTML = `
      <div class="placeholder-media placeholder-video" role="img" aria-label="Grey placeholder video frame"></div>
      <div class="feature-body">
        <div>
          <p class="eyebrow">Watch Campus</p>
          <h2>${escapeHtml(item.title)}</h2>
          <p>${escapeHtml(item.summary)}</p>
        </div>
        <a class="text-link" href="media.html">Open media hub</a>
      </div>`;
  }

  function renderThisWeek() {
    const target = $('[data-this-week]');
    if (!target) return;
    const items = [...state.events, ...state.deadlines]
      .sort((a, b) => safeDate(a.date) - safeDate(b.date))
      .slice(0, 4);
    target.innerHTML = items.map(renderFeedCard).join('') || `<p class="no-results">No weekly items loaded.</p>`;
  }

  function renderResourcesPreview() {
    const target = $('[data-resources-preview]');
    if (!target) return;
    target.innerHTML = state.resources.slice(0, 6).map(item => `
      <a class="quick-link" href="${escapeAttr(item.link || '#')}">
        ${escapeHtml(item.title)}
      </a>
    `).join('');
  }



  function renderJobsPreview() {
    const target = $('[data-jobs-preview]');
    if (!target) return;
    const jobs = [...state.jobs]
      .sort((a, b) => safeDate(b.date) - safeDate(a.date))
      .slice(0, 3);

    target.innerHTML = jobs.map(renderJobCard).join('') || `<p class="no-results">No job opportunities loaded.</p>`;
  }

  function renderSponsorSpotlight() {
    const target = $('[data-sponsor-spotlight]');
    if (!target) return;
    const item = state.sponsors.find(sponsor => sponsor.feature === 'true') || state.sponsors[0];
    if (!item) return;
    target.innerHTML = `
      <span class="badge badge-paid">Sponsored Local Partner</span>
      <h2>${escapeHtml(item.title)}</h2>
      <p>${escapeHtml(item.summary)}</p>
      <a class="button button-primary" href="${escapeAttr(item.link || 'advertise.html')}">View offer</a>`;
  }

  function renderPartners() {
    const target = $('[data-partner-logos]');
    if (!target) return;
    target.innerHTML = state.partners.map(partner => `
      <a class="partner-logo" href="${escapeAttr(partner.link || '#')}">
        <img src="${escapeAttr(partner.logo || 'assets/placeholders/logo-slot.svg')}" alt="${escapeAttr(partner.title)} logo slot">
        <strong>${escapeHtml(partner.title)}</strong>
        <span>${escapeHtml(partner.relationship || 'Campus partner')}</span>
      </a>`).join('');
  }

  function renderUpdates() {
    const target = $('[data-feed-list]');
    const count = $('[data-feed-count]');
    if (count) count.textContent = state.feed.length;
    if (target) target.innerHTML = state.feed.map(renderFeedCard).join('') || `<p class="no-results">No feed items loaded.</p>`;
  }

  function renderEventsPage() {
    const target = $('[data-events-timeline]');
    if (!target) return;
    const events = [...state.events].sort((a, b) => safeDate(a.date) - safeDate(b.date));
    target.innerHTML = events.map(event => `
      <article class="timeline-item">
        <div class="timeline-date"><small>${month(event.date)}</small>${day(event.date)}</div>
        <div>
          <div class="card-meta"><span class="badge">${escapeHtml(event.category || 'Event')}</span><span class="badge badge-muted">${escapeHtml(event.audience || 'All')}</span></div>
          <h3>${escapeHtml(event.title)}</h3>
          <p>${escapeHtml(event.summary)}</p>
        </div>
        <a class="text-link" href="${escapeAttr(event.link || '#')}">Details</a>
      </article>`).join('') || `<p class="no-results">No events loaded.</p>`;
  }

  function renderMediaPage() {
    const feature = $('[data-media-feature]');
    const grid = $('[data-media-grid]');
    const featured = state.videos.find(video => video.feature === 'true') || state.videos[0];

    if (feature && featured) {
      feature.innerHTML = renderVideoEmbed(featured, true);
    }

    if (grid) {
      grid.innerHTML = state.videos.map(video => `
        <article class="media-card ${video.orientation === 'vertical' ? 'vertical' : ''}">
          <div class="media-thumb">${renderVideoEmbed(video, false)}</div>
          <div class="card-meta"><span class="badge">${escapeHtml(video.platform || 'Video')}</span><span class="badge badge-muted">${escapeHtml(video.category || 'Campus')}</span></div>
          <h3>${escapeHtml(video.title)}</h3>
          <p>${escapeHtml(video.summary || '')}</p>
          <a class="text-link" href="${escapeAttr(video.canonical_url || video.embed_url || '#')}">Open source</a>
        </article>`).join('') || `<p class="no-results">No videos loaded.</p>`;
    }
  }

  function renderVideoEmbed(video, large) {
    const platform = (video.platform || '').toLowerCase();
    const embed = video.embed_url || '';
    const title = escapeAttr(video.title || 'Campus video');
    const isPlaceholder = /VIDEO_ID|POST_ID|REEL_ID|TIKTOK_ID/i.test(embed);

    if (platform === 'youtube' && embed && !isPlaceholder) {
      return `<div class="video-frame"><iframe src="${escapeAttr(embed)}" title="${title}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen loading="lazy"></iframe></div>`;
    }

    if (platform === 'local' && embed && !isPlaceholder) {
      return `<div class="video-frame"><video controls src="${escapeAttr(embed)}"></video></div>`;
    }

    return `<div class="video-frame"><div class="video-fallback"><div><span class="badge">${escapeHtml(video.platform || 'Video')}</span><h3>${escapeHtml(video.title || 'Video placeholder')}</h3><p>${large ? escapeHtml(video.summary || 'Replace the URL in videos.txt when final content is ready.') : 'Replace source URL in videos.txt.'}</p></div></div></div>`;
  }



  function renderJobsPage() {
    const target = $('[data-job-list]');
    const count = $('[data-job-count]');
    if (count) count.textContent = state.jobs.length;
    if (!target) return;

    const jobs = [...state.jobs].sort((a, b) => safeDate(b.date) - safeDate(a.date));
    target.innerHTML = jobs.map(renderJobCard).join('') || `<p class="no-results">No job opportunities loaded.</p>`;
    bindJobControls();
  }

  function renderJobCard(job) {
    return `
      <article class="job-card" data-job-card data-title="${escapeAttr(job.title || '')}" data-employer="${escapeAttr(job.employer || '')}" data-summary="${escapeAttr(job.summary || '')}" data-type="${escapeAttr((job.job_type || '').toLowerCase())}" data-field="${escapeAttr((job.field || '').toLowerCase())}">
        <div class="job-topline">
          <div>
            <div class="card-meta">
              <span class="badge">${escapeHtml(job.job_type || 'Opportunity')}</span>
              <span class="badge badge-muted">${escapeHtml(job.field || 'General')}</span>
              ${job.date ? `<span class="badge badge-muted">Posted ${formatDate(job.date)}</span>` : ''}
            </div>
            <h3>${escapeHtml(job.title || 'Untitled role')}</h3>
            <p class="job-employer">${escapeHtml(job.employer || 'Local employer')}</p>
          </div>
          <strong class="salary">${escapeHtml(job.compensation || 'TBD')}</strong>
        </div>
        <p>${escapeHtml(job.summary || '')}</p>
        <dl class="job-facts">
          <div><dt>Location</dt><dd>${escapeHtml(job.location || 'TBD')}</dd></div>
          <div><dt>Schedule</dt><dd>${escapeHtml(job.schedule || 'TBD')}</dd></div>
          <div><dt>Fit</dt><dd>${escapeHtml(job.student_fit || 'Students')}</dd></div>
        </dl>
        <a class="text-link" href="${escapeAttr(job.link || '#')}">Apply / request details</a>
      </article>`;
  }

  function renderAdvertisePage() {
    const target = $('[data-ad-packages]');
    if (!target) return;
    target.innerHTML = state.adPackages.map(item => `
      <article class="ad-card">
        <div>
          <div class="card-meta"><span class="badge badge-paid">${escapeHtml(item.type || 'Ad Product')}</span></div>
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.summary)}</p>
        </div>
        <div>
          <strong>${escapeHtml(item.price || 'TBD')}</strong>
          <p>${escapeHtml(item.best_for || '')}</p>
        </div>
      </article>`).join('') || `<p class="no-results">No ad packages loaded.</p>`;
  }

  function renderFeedCard(item) {
    return `
      <article class="feed-card" data-feed-card data-title="${escapeAttr(item.title || '')}" data-summary="${escapeAttr(item.summary || '')}" data-audience="${escapeAttr((item.audience || 'all').toLowerCase())}" data-type="${escapeAttr((item.type || '').toLowerCase())}">
        <div class="card-meta">
          <span class="badge">${escapeHtml(item.type || item.category || 'Update')}</span>
          <span class="badge badge-muted">${escapeHtml(item.audience || 'All')}</span>
          ${item.date ? `<span class="badge badge-muted">${formatDate(item.date)}</span>` : ''}
        </div>
        <h3>${escapeHtml(item.title || 'Untitled')}</h3>
        <p>${escapeHtml(item.summary || '')}</p>
        ${item.link ? `<a class="text-link" href="${escapeAttr(item.link)}">Open</a>` : ''}
      </article>`;
  }

  function bindFeedControls() {
    const controls = $('[data-feed-controls]');
    if (!controls) return;
    const inputs = $$('input, select', controls);
    inputs.forEach(input => input.addEventListener('input', filterFeedCards));
    inputs.forEach(input => input.addEventListener('change', filterFeedCards));
  }

  function filterFeedCards() {
    const q = ($('[data-search-input]')?.value || '').toLowerCase().trim();
    const audience = $('[data-audience-filter]')?.value || 'all';
    const type = $('[data-type-filter]')?.value || 'all';
    const cards = $$('[data-feed-card]');
    let visibleCount = 0;

    cards.forEach(card => {
      const haystack = `${card.dataset.title} ${card.dataset.summary}`.toLowerCase();
      const audienceMatch = audience === 'all' || card.dataset.audience.includes(audience);
      const typeMatch = type === 'all' || card.dataset.type === type;
      const searchMatch = !q || haystack.includes(q);
      const isVisible = audienceMatch && typeMatch && searchMatch;
      card.hidden = !isVisible;
      if (isVisible) visibleCount += 1;
    });
  }

  function bindForms() {
    const eventForm = $('[data-event-form]');
    const adForm = $('[data-ad-form]');
    const jobForm = $('[data-job-form]');
    if (eventForm) eventForm.addEventListener('submit', handleEventForm);
    if (adForm) adForm.addEventListener('submit', handleAdForm);
    if (jobForm) jobForm.addEventListener('submit', handleJobForm);
  }



  function bindJobControls() {
    const controls = $('[data-job-controls]');
    if (!controls) return;
    const inputs = $$('input, select', controls);
    inputs.forEach(input => input.addEventListener('input', filterJobCards));
    inputs.forEach(input => input.addEventListener('change', filterJobCards));
  }

  function filterJobCards() {
    const q = ($('[data-job-search]')?.value || '').toLowerCase().trim();
    const type = $('[data-job-type-filter]')?.value || 'all';
    const field = $('[data-job-field-filter]')?.value || 'all';
    const cards = $$('[data-job-card]');

    cards.forEach(card => {
      const haystack = `${card.dataset.title} ${card.dataset.employer} ${card.dataset.summary}`.toLowerCase();
      const typeMatch = type === 'all' || card.dataset.type === type;
      const fieldMatch = field === 'all' || card.dataset.field === field;
      const searchMatch = !q || haystack.includes(q);
      card.hidden = !(typeMatch && fieldMatch && searchMatch);
    });
  }

  function handleEventForm(event) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    const body = [
      `Event Title: ${data.eventTitle}`,
      `Host: ${data.host}`,
      `Category: ${data.category}`,
      `Date: ${data.date}`,
      `Time: ${data.startTime} - ${data.endTime || 'N/A'}`,
      `Location: ${data.location}`,
      `Audience: ${data.audience}`,
      `Cost: ${data.cost || 'N/A'}`,
      `Registration: ${data.registration || 'N/A'}`,
      `Accessibility: ${data.accessibility || 'N/A'}`,
      `Description: ${data.summary}`,
      `Image / Poster Note: ${data.imageNote || 'N/A'}`,
      `Publish By: ${data.publishBy || 'N/A'}`,
      `Submitter: ${data.name} <${data.email}>`,
      `Approval Confirmed: Yes`
    ].join('\n');

    $('[data-event-output]').textContent = body;
    openMailto(state.site.submission_email || 'campushub@example.com', `Event submission: ${data.eventTitle}`, body);
  }

  function handleAdForm(event) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    const body = [
      `Business / Organization: ${data.business}`,
      `Contact: ${data.name} <${data.email}>`,
      `Interested Package: ${data.package}`,
      `Campaign Goal: ${data.goal || 'N/A'}`
    ].join('\n');

    $('[data-ad-output]').textContent = body;
    openMailto(state.site.advertising_email || 'campushub@example.com', `Sponsor inquiry: ${data.business}`, body);
  }



  function handleJobForm(event) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    const body = [
      `Employer / Organization: ${data.employer}`,
      `Role Title: ${data.role}`,
      `Opportunity Type: ${data.type}`,
      `Field: ${data.field}`,
      `Location: ${data.location}`,
      `Schedule: ${data.schedule || 'N/A'}`,
      `Compensation: ${data.compensation || 'N/A'}`,
      `Apply Link: ${data.applyLink || 'N/A'}`,
      `Description: ${data.summary}`,
      `Contact: ${data.name} <${data.email}>`,
      `Student-Appropriate Standard Confirmed: Yes`
    ].join('\n');

    $('[data-job-output]').textContent = body;
    openMailto(state.site.employment_email || state.site.advertising_email || 'campushub@example.com', `Job board submission: ${data.role}`, body);
  }

  function openMailto(to, subject, body) {
    const href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = href;
  }

  function bindNavigation() {
    const toggle = $('[data-nav-toggle]');
    const menu = $('[data-nav-menu]');
    if (!toggle || !menu) return;
    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!open));
      menu.classList.toggle('is-open', !open);
    });
  }

  function setActiveNavigation() {
    const current = location.pathname.split('/').pop() || 'index.html';
    $$('.nav-links a').forEach(link => {
      if (link.getAttribute('href') === current) link.setAttribute('aria-current', 'page');
    });
  }

  function safeDate(value) {
    const date = value ? new Date(`${value}T12:00:00`) : new Date(0);
    return Number.isNaN(date.getTime()) ? new Date(0) : date;
  }

  function formatDate(value) {
    const date = safeDate(value);
    return date.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function month(value) { return safeDate(value).toLocaleDateString('en-CA', { month: 'short' }); }
  function day(value) { return safeDate(value).toLocaleDateString('en-CA', { day: '2-digit' }); }

  function escapeHtml(value = '') {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function escapeAttr(value = '') { return escapeHtml(value); }
})();
