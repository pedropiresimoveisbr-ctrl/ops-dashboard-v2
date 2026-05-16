// ============================================================
//  app.js — orquestração principal e renderização
// ============================================================

let countdown = CONFIG.refreshInterval / 1000;
let countdownTimer = null;

// ── Helpers ───────────────────────────────────────────────────
function fmtDate(isoStr) {
  if (!isoStr) return '—';
  return new Date(isoStr).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtNum(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return Number(n).toLocaleString('pt-BR');
}

function pillLabel(status) {
  return { online: 'online', offline: 'offline', slow: 'lento', checking: 'verificando...' }[status] || status;
}

function pillClass(status) {
  return { online: 'badge-ok', offline: 'badge-err', slow: 'badge-warn', checking: 'badge-neutral' }[status] || 'badge-neutral';
}

// ── Render: card de serviço genérico ──────────────────────────
function renderServiceCard(item, leadCount, extraLabel) {
  const st = monitorState[item.id] || { status: 'checking', ms: null };
  const leadsHtml = leadCount !== null && leadCount !== undefined
    ? fmtNum(leadCount)
    : '...';
  return `
  <div class="service-card" onclick="window.open('${item.url}','_blank')">
    <div class="sc-header">
      <div class="sc-name"><i class="ti ${item.icon}"></i>${item.name}</div>
      <span class="badge ${pillClass(st.status)}">${pillLabel(st.status)}</span>
    </div>
    <div class="sc-url">${item.url.replace('https://','')}</div>
    <div class="sc-metrics">
      <div class="sc-metric">
        <span class="sc-metric-val">${st.ms ? st.ms + 'ms' : '—'}</span>
        <span class="sc-metric-label">resposta</span>
      </div>
      <div class="sc-metric">
        <span class="sc-metric-val">${leadsHtml}</span>
        <span class="sc-metric-label">${extraLabel || 'leads'}</span>
      </div>
    </div>
  </div>`;
}

// ── Render: sites de captura ──────────────────────────────────
function renderSitesGrid(leadCounts) {
  const grid = document.getElementById('sites-grid');
  if (!grid) return;
  grid.innerHTML = SITES.map(s => renderServiceCard(s, leadCounts[s.id] ?? null)).join('');
}

// ── Render: iscas digitais ────────────────────────────────────
function renderIscasGrid(leadCounts) {
  const grid = document.getElementById('iscas-grid');
  if (!grid) return;
  if (!ISCAS.length) {
    grid.innerHTML = `<div class="empty-section">nenhuma isca configurada ainda</div>`;
    return;
  }
  grid.innerHTML = ISCAS.map(s => renderServiceCard(s, leadCounts[s.id] ?? null, 'leads capturados')).join('');
}

// ── Render: card call center ──────────────────────────────────
function renderCCCard() {
  const st = monitorState[CALLCENTER_APP.id] || { status: 'checking', ms: null };
  const grid = document.getElementById('cc-grid');
  if (!grid) return;
  grid.innerHTML = `
  <div class="service-card" onclick="window.open('${CALLCENTER_APP.url}','_blank')">
    <div class="sc-header">
      <div class="sc-name"><i class="ti ${CALLCENTER_APP.icon}"></i>${CALLCENTER_APP.name}</div>
      <span class="badge ${pillClass(st.status)}">${pillLabel(st.status)}</span>
    </div>
    <div class="sc-url">${CALLCENTER_APP.url.replace('https://','')}</div>
    <div class="sc-metrics">
      <div class="sc-metric">
        <span class="sc-metric-val">${st.ms ? st.ms + 'ms' : '—'}</span>
        <span class="sc-metric-label">resposta</span>
      </div>
      <div class="sc-metric">
        <span class="sc-metric-val" id="sum-calls-card">—</span>
        <span class="sc-metric-label">ligações hoje</span>
      </div>
    </div>
  </div>`;
}

// ── Render: bloco de leads ────────────────────────────────────
function renderLeadsGrid(total, lastCreated) {
  const grid = document.getElementById('leads-grid');
  if (!grid) return;

  const badge = document.getElementById('badge-leads-update');
  if (badge) badge.textContent = lastCreated ? `último: ${fmtDate(lastCreated)}` : '—';

  grid.innerHTML = `
    <div class="data-card big">
      <div class="data-card-icon info"><i class="ti ti-users"></i></div>
      <div class="data-card-val">${fmtNum(total)}</div>
      <div class="data-card-label">total de leads capturados</div>
    </div>
    <div class="data-card">
      <div class="data-card-icon ok"><i class="ti ti-clock"></i></div>
      <div class="data-card-val small">${lastCreated ? fmtDate(lastCreated) : '—'}</div>
      <div class="data-card-label">último lead capturado</div>
    </div>`;
}

// ── Render: bloco call center data ────────────────────────────
function renderCallsGrid(todayData, ccLeads, lastCC) {
  const grid = document.getElementById('calls-grid');
  if (!grid) return;

  const badge = document.getElementById('badge-calls-update');
  if (badge) badge.textContent = lastCC ? `últ. att: ${fmtDate(lastCC)}` : '—';

  const outcomes = Object.entries(todayData.byOutcome || {})
    .sort((a, b) => b[1] - a[1]).slice(0, 4);

  const outcomeHtml = outcomes.length
    ? outcomes.map(([k, v]) => `
        <div class="outcome-row">
          <span class="outcome-label">${k.replace(/_/g,' ')}</span>
          <span class="outcome-val">${v}</span>
        </div>`).join('')
    : '<div class="outcome-row muted">nenhuma ligação hoje</div>';

  grid.innerHTML = `
    <div class="data-card big">
      <div class="data-card-icon purple"><i class="ti ti-phone-call"></i></div>
      <div class="data-card-val">${fmtNum(todayData.total)}</div>
      <div class="data-card-label">ligações hoje</div>
    </div>
    <div class="data-card big">
      <div class="data-card-icon info"><i class="ti ti-address-book"></i></div>
      <div class="data-card-val">${fmtNum(ccLeads)}</div>
      <div class="data-card-label">leads na lista fria</div>
    </div>
    <div class="data-card outcomes">
      <div class="data-card-label" style="margin-bottom:12px">outcomes de hoje</div>
      ${outcomeHtml}
    </div>
    <div class="data-card">
      <div class="data-card-icon ok"><i class="ti ti-clock"></i></div>
      <div class="data-card-val small">${todayData.lastCall ? fmtDate(todayData.lastCall) : '—'}</div>
      <div class="data-card-label">última ligação</div>
    </div>`;

  const sumCalls = document.getElementById('sum-calls');
  if (sumCalls) sumCalls.textContent = fmtNum(todayData.total);
  const sumCallsCard = document.getElementById('sum-calls-card');
  if (sumCallsCard) sumCallsCard.textContent = fmtNum(todayData.total);
}

// ── Atualiza summary ──────────────────────────────────────────
function updateSummary(serviceResults, totalLeads, totalIscas) {
  const allServices = [...SITES, CALLCENTER_APP, ...ISCAS];
  const online = allServices.filter(s => monitorState[s.id]?.status === 'online').length;
  const issues = allServices.filter(s => ['offline','slow'].includes(monitorState[s.id]?.status)).length;
  const total  = allServices.length;

  document.getElementById('sum-online').textContent = `${online}/${total}`;
  document.getElementById('sum-issues').textContent = issues;
  document.getElementById('sum-leads').textContent  = fmtNum(totalLeads);
  document.getElementById('sum-iscas').textContent  = fmtNum(totalIscas);

  document.getElementById('sum-issues').className = `metric-value ${issues > 0 ? 'color-err' : 'color-ok'}`;

  // badge sites
  const badgeSites = document.getElementById('badge-sites');
  if (badgeSites) {
    const siteIssues = SITES.filter(s => ['offline','slow'].includes(monitorState[s.id]?.status)).length;
    badgeSites.textContent = siteIssues === 0 ? 'todos online' : `${siteIssues} com problema`;
    badgeSites.className   = `section-badge ${siteIssues > 0 ? 'badge-err' : 'badge-ok'}`;
  }

  // badge call center
  const badgeCC = document.getElementById('badge-cc');
  const ccSt = monitorState[CALLCENTER_APP.id]?.status;
  if (badgeCC) {
    badgeCC.textContent = pillLabel(ccSt);
    badgeCC.className   = `section-badge ${pillClass(ccSt)}`;
  }

  // badge iscas
  const badgeIscas = document.getElementById('badge-iscas');
  if (badgeIscas) {
    const iscaIssues = ISCAS.filter(s => ['offline','slow'].includes(monitorState[s.id]?.status)).length;
    badgeIscas.textContent = iscaIssues === 0 ? 'todas online' : `${iscaIssues} com problema`;
    badgeIscas.className   = `section-badge ${iscaIssues > 0 ? 'badge-err' : 'badge-ok'}`;
  }

  // subtitle
  const sub = document.getElementById('header-subtitle');
  if (sub) {
    const now = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    sub.textContent = `última verificação: ${now} — ${online} de ${total} serviços online`;
  }
}

// ── Countdown ─────────────────────────────────────────────────
function startCountdown() {
  clearInterval(countdownTimer);
  countdown = CONFIG.refreshInterval / 1000;
  countdownTimer = setInterval(() => {
    countdown--;
    const el = document.getElementById('next-check');
    if (el) el.textContent = `próx. em ${countdown}s`;
    if (countdown <= 0) clearInterval(countdownTimer);
  }, 1000);
}

// ── Ciclo principal ───────────────────────────────────────────
async function runAll() {
  const btn  = document.getElementById('refresh-btn');
  const icon = document.getElementById('refresh-icon');
  if (btn)  btn.disabled = true;
  if (icon) icon.className = 'ti ti-refresh spin';

  // marca tudo como verificando
  [...SITES, CALLCENTER_APP, ...ISCAS].forEach(s => {
    monitorState[s.id] = { status: 'checking', ms: null };
  });
  renderCCCard();
  renderSitesGrid({});
  renderIscasGrid({});

  const [serviceResults, leadsData, callsToday, ccLeads, lastUpdates] = await Promise.allSettled([
    checkAllServices(),
    fetchLeadsByOrigin(),
    fetchCallsToday(),
    fetchCallCenterLeads(),
    fetchLastUpdates(),
  ]);

  const services   = serviceResults.status === 'fulfilled' ? serviceResults.value : [];
  const leads      = leadsData.status      === 'fulfilled' ? leadsData.value      : { counts: {}, lastCreated: null, total: 0 };
  const calls      = callsToday.status     === 'fulfilled' ? callsToday.value     : { total: 0, byOutcome: {}, lastCall: null };
  const ccLeadsVal = ccLeads.status        === 'fulfilled' ? ccLeads.value.total  : 0;
  const updates    = lastUpdates.status    === 'fulfilled' ? lastUpdates.value    : { lastLead: null, lastCC: null };

  // contagem por funil — sites
  const leadCounts = {};
  SITES.forEach(s => { leadCounts[s.id] = leads.counts[s.funil] ?? null; });

  // contagem por funil — iscas
  const iscaCounts = {};
  let totalIscas = 0;
  ISCAS.forEach(s => {
    const n = leads.counts[s.funil] ?? null;
    iscaCounts[s.id] = n;
    if (n) totalIscas += n;
  });

  // total de leads dos sites (exclui iscas)
  const totalSites = Object.values(leadCounts).reduce((acc, v) => acc + (v || 0), 0);

  renderSitesGrid(leadCounts);
  renderIscasGrid(iscaCounts);
  renderCCCard();
  renderLeadsGrid(totalSites, leads.lastCreated || updates.lastLead);
  renderCallsGrid(calls, ccLeadsVal, updates.lastCC);
  updateSummary(services, totalSites, totalIscas);

  const sideTime = document.getElementById('last-check-side');
  if (sideTime) sideTime.textContent = new Date().toLocaleTimeString('pt-BR');

  if (btn)  btn.disabled = false;
  if (icon) icon.className = 'ti ti-refresh';

  startCountdown();
}

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  renderCCCard();
  renderSitesGrid({});
  renderIscasGrid({});
  runAll();
  setInterval(runAll, CONFIG.refreshInterval);
});
