(function () {
  'use strict';
  var D = window.TOKEN_RADAR;
  var rows = D.rows;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }
  function gid(id) { return document.getElementById(id); }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  function money(v) {
    if (v >= 1e9) return '$' + (v / 1e9).toFixed(2) + 'B';
    if (v >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M';
    if (v >= 1e3) return '$' + (v / 1e3).toFixed(1) + 'K';
    return '$' + Math.round(v);
  }
  function moneyFull(v) { return '$' + Math.round(v).toLocaleString('en-US'); }
  function moneySmall(v) {
    if (v >= 1) return money(v);
    return '$' + v.toFixed(2);
  }
  function pct(v) {
    if (v === null || v === undefined) return '—';
    return (v > 0 ? '+' : '') + v.toFixed(1) + '%';
  }
  function chainsShort(chains) {
    return chains.length > 2 ? chains[0] + ' +' + (chains.length - 1) : chains.join(', ');
  }

  var stats = document.getElementById('stats');
  var wlCount = rows.filter(function (r) { return r.watchlist; }).length;
  var farmCount = rows.filter(function (r) { return r.verdict === 'FARM'; }).length;
  var keptValue = D.ablation.filter(function (a) { return a.verdict === 'kept'; }).length;
  var keptOdds = D.odds_ablation.filter(function (a) { return a.verdict === 'kept'; }).length;
  var statData = [
    ['×' + D.evidence.wf_fitted.toFixed(2), 'walk-forward miss'],
    [Math.round(D.calibration.wf_p2575 * 100) + '% · ' + Math.round(D.calibration.wf_p1090 * 100) + '%', 'range honesty (WF)'],
    [D.evidence.brier_odds.toFixed(3), 'odds Brier, 10-fold'],
    [keptValue + '/4 · ' + keptOdds + '/4', 'terms survived'],
    [String(farmCount), 'worth farming'],
    [wlCount + ' / ' + D.watchlist_size, 'watchlist'],
    [money(D.total_implied_usd), 'total implied'],
  ];
  statData.forEach(function (s, i) {
    var box = el('div', 'stat');
    var b = el('b', i === 4 ? 'green' : null, s[0]);
    box.appendChild(b);
    box.appendChild(el('span', null, s[1]));
    stats.appendChild(box);
  });

  var evidenceEl = document.getElementById('evidence');
  if (evidenceEl && D.fit && D.evidence) {
    var f = D.fit;
    var e = D.evidence;
    evidenceEl.innerHTML =
      '<strong>Model:</strong> ln(mcap) = ' +
      f.intercept.toFixed(2) + ' + ' + f.slope.toFixed(2) +
      ' &times; ln(TVL) (R&sup2; ' + f.r2.toFixed(2) + ', slope ± ' + f.slope_se.toFixed(2) + ', ' + f.n_comps + ' comps). Held out LOO &times;' +
      e.loo_fitted.toFixed(2) + ' vs flat &times;' + e.loo_flat.toFixed(2) + ', WF &times;' +
      e.wf_fitted.toFixed(2) + ' vs flat &times;' + e.wf_flat.toFixed(2) + '.';
  }
  var ev2 = document.getElementById('evidence2');
  if (ev2 && D.ablation && D.assumptions) {
    var widths = rows.map(function (r) { return r.rank_hi - r.rank_lo; }).sort(function (a, b) { return a - b; });
    var medW = widths[Math.floor(widths.length / 2)];
    ev2.innerHTML =
      '<strong>How sure is a rank?</strong> ' + D.assumptions.bootstrap_draws +
      ' refits: median rank spans ' + medW + ' places (P5–P95).';
  }
  var ev3 = document.getElementById('evidence3');
  if (ev3 && D.calibration) {
    var c = D.calibration;
    ev3.innerHTML = '<strong>Is the range honest?</strong> P25–P75 holds the real cap for ' +
      Math.round(c.loo_p2575 * 100) + '% held out, ' + Math.round(c.wf_p2575 * 100) +
      '% walk-forward (50% stated); P10–P90 ' + Math.round(c.loo_p1090 * 100) + '% / ' +
      Math.round(c.wf_p1090 * 100) + '% (80% stated). Old: ' +
      Math.round(c.old_loo_p2575 * 100) + '% / ' + Math.round(c.old_wf_p2575 * 100) + '%.';
  }
  var acctEl = document.getElementById('accounting');
  if (acctEl && D.accounting) {
    var a = D.accounting;
    var pctOf = function (n) { return Math.round((n / a.total) * 100); };
    acctEl.innerHTML =
      '<div class="acct-legend">' +
      '<span><i class="dot ranked"></i>' + a.ranked + ' ranked</span>' +
      '<span><i class="dot token"></i>' + a.token_recorded + ' record a token</span>' +
      '<span><i class="dot left"></i>' + a.left_out + ' left out</span>' +
      '<span class="acct-total">' + a.total + ' in the snapshot</span>' +
      '</div>';
  }

  var intEl = document.getElementById('integrity');
  if (intEl && D.accounting) {
    var a = D.accounting;
    var ck = function (b) { return b ? '✓ ' : '✗ '; };
    var rk = rows.every(function (r, i) { return r.rank === i + 1; });
    var so = rows.every(function (r, i) { return i === 0 || r.implied_value_usd <= rows[i - 1].implied_value_usd; });
    intEl.innerHTML = '<strong>Integrity:</strong> ' + ck(1) + rows.length + ' rows · ' + ck(rk) + 'ranks in order · ' + ck(so) + 'values sorted · ' + ck(wlCount === D.watchlist_size) + wlCount + '/' + D.watchlist_size + ' watchlist · ' + ck(a.ranked + a.token_recorded + a.left_out === a.total) + a.ranked + ' + ' + a.token_recorded + ' + ' + a.left_out + ' = ' + a.total + ' · ' + ck(1) + 'offline';
  }

  var catSel = document.getElementById('cat');
  var chainSel = document.getElementById('chain');
  var cats = [], chains = [];
  rows.forEach(function (r) {
    if (cats.indexOf(r.category) < 0) cats.push(r.category);
    r.chains.forEach(function (c) { if (chains.indexOf(c) < 0) chains.push(c); });
  });
  cats.sort().forEach(function (c) { catSel.appendChild(el('option', null, c)); });
  chains.sort().forEach(function (c) { chainSel.appendChild(el('option', null, c)); });

  var DEF = { q: '', cat: '', chain: '', minTvl: 0, wl: false, tab: 'all', tier: 'all', sort: 'rank', dir: 1 };
  var state = Object.assign({}, DEF);
  var A = D.assumptions;
  var scen = { dep: A.deposit_usd, share: A.drop_pool_pct, gas: 1 };
  function netAt(r, dep, share, gas) {
    var drop = share * r.implied_value_usd;
    var fshare = Math.min(1, dep / Math.max(1, A.farming_pool_pct * r.tvl_usd));
    return drop * fshare * r.token_odds - r.econ.fees_usd * gas;
  }
  function scenNet(r) { return netAt(r, scen.dep, scen.share, scen.gas); }
  function scenVerdict(r, net) {
    var perHour = net / r.econ.hours;
    return net > A.verdict_farm_net_usd && perHour > A.verdict_farm_per_hour_usd ? 'FARM'
      : net < A.verdict_skip_net_usd ? 'SKIP' : 'MARGINAL';
  }
  function syncSliders() {
    document.getElementById('depOut').textContent = moneyFull(scen.dep);
    document.getElementById('shareOut').textContent = (scen.share * 100).toFixed(1) + '%';
    document.getElementById('gasOut').textContent = scen.gas + '×';
  }
  function sortKey(r) {
    var k = state.sort;
    if (k === 'name') return r.name.toLowerCase();
    if (k === 'chains') return r.chains[0] || '';
    if (k === 'change_7d') return r.change_7d === null ? -Infinity : r.change_7d;
    if (k === 'net_per_hour_usd') return scenNet(r) / r.econ.hours;
    return r[k];
  }

  function filtered() {
    var q = state.q.trim().toLowerCase();
    var list = rows.filter(function (r) {
      if (state.wl && !r.watchlist) return false;
      if (state.tab !== 'all' && scenVerdict(r, scenNet(r)) !== state.tab) return false;
      if (state.tier === 'watchlist' && !r.watchlist) return false;
      if (state.tier === 'early' && r.tvl_usd >= 5e7) return false;
      if (state.tier === 'offlist' && (r.watchlist || r.tvl_usd < 5e7)) return false;
      if (state.cat && r.category !== state.cat) return false;
      if (state.chain && r.chains.indexOf(state.chain) < 0) return false;
      if (r.tvl_usd < state.minTvl) return false;
      if (q && r.name.toLowerCase().indexOf(q) < 0 && r.slug.indexOf(q) < 0) return false;
      return true;
    });
    list.sort(function (a, b) {
      var x = sortKey(a), y = sortKey(b);
      return (x < y ? -1 : x > y ? 1 : 0) * state.dir;
    });
    return list;
  }

  var tabsEl = document.getElementById('tabs');
  var vBtns = {}, tBtns = {};
  function tab(kind, key, label) {
    var b = el('button', 'tab', label);
    b.addEventListener('click', function () { if (kind) state.tab = key; else state.tier = key; syncTabs(); render(); });
    tabsEl.appendChild(b);
    return b;
  }
  vBtns.all = tab(1, 'all', 'All');
  vBtns.FARM = tab(1, 'FARM', 'FARM');
  vBtns.MARGINAL = tab(1, 'MARGINAL', 'MARGINAL');
  vBtns.SKIP = tab(1, 'SKIP', 'SKIP');
  tBtns.all = tab(0, 'all', 'All tiers');
  tBtns.watchlist = tab(0, 'watchlist', 'Watchlist');
  tBtns.early = tab(0, 'early', 'Early');
  tBtns.offlist = tab(0, 'offlist', 'Off-list');
  var vk = ['all', 'FARM', 'MARGINAL', 'SKIP'], tk = ['all', 'watchlist', 'early', 'offlist'];
  function syncTabs() {
    var i, c = { all: 0, FARM: 0, MARGINAL: 0, SKIP: 0 };
    for (i = 0; i < 4; i++) { vBtns[vk[i]].classList.toggle('on', state.tab === vk[i]); tBtns[tk[i]].classList.toggle('on', state.tier === tk[i]); }
    rows.forEach(function (r) { c[scenVerdict(r, scenNet(r))]++; c.all++; });
    for (i = 0; i < 4; i++) vBtns[vk[i]].textContent = (vk[i] === 'all' ? 'All ' : vk[i] + ' ') + c[vk[i]];
  }
  function download(name, type, text) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: type }));
    a.download = name;
    a.click();
  }
  function csvOf(list) {
    var h = 'rank,name,slug,implied_value_usd,token_odds,verdict,net_usd,net_per_hour_usd,tvl_usd,category,chains';
    return h + '\n' + list.map(function (r) {
      var n = scenNet(r);
      return [r.rank, '"' + r.name.replace(/"/g, '""') + '"', r.slug, r.implied_value_usd, r.token_odds.toFixed(3), scenVerdict(r, n), Math.round(n), Math.round(n / r.econ.hours), r.tvl_usd, '"' + r.category + '"', '"' + r.chains.join(' ') + '"'].join(',');
    }).join('\n') + '\n';
  }
  var ex = el('button', 'tab', 'Export CSV');
  ex.addEventListener('click', function () { download('token-radar.csv', 'text/csv', csvOf(filtered())); });
  tabsEl.appendChild(ex);
  ex = el('button', 'tab', 'Export JSON');
  ex.addEventListener('click', function () { download('token-radar.json', 'application/json', JSON.stringify(filtered(), null, 2)); });
  tabsEl.appendChild(ex);

  var tbody = document.getElementById('rows');
  var countEl = document.getElementById('count');
  var activeSlug = null;

  function render() {
    var list = filtered();
    syncTabs();
    tbody.textContent = '';
    list.forEach(function (r) {
      var tr = el('tr');
      if (r.slug === activeSlug) tr.className = 'active';
      var sNet = scenNet(r);
      var sVerd = scenVerdict(r, sNet);
      var chCls = r.change_7d === null ? 'flat' : r.change_7d > 0 ? 'up' : r.change_7d < 0 ? 'down' : 'flat';
      var fam = r.odds_family_adj >= 0 ? '+' + r.odds_family_adj.toFixed(2) : r.odds_family_adj.toFixed(2);
      tr.innerHTML = '<td class="num">' + r.rank + '</td><td class="num rng">' + r.rank_lo + '–' + r.rank_hi + '</td><td><span class="nm">' + esc(r.name) + '</span>' + (r.watchlist ? '<span class="badge">WATCHLIST</span>' : '') + '<div class="sl">' + r.slug + '</div></td><td class="num val">' + money(r.implied_value_usd) + '</td><td class="num">' + Math.round(r.token_odds * 100) + '%<div class="sl">family ' + fam + '</div></td><td><span class="verdict verdict-' + sVerd.toLowerCase() + '">' + sVerd + '</span><div class="sl">' + money(sNet) + ' net</div></td><td class="num">' + money(sNet / r.econ.hours) + '</td><td class="num">' + money(r.tvl_usd) + '</td><td class="num ' + chCls + '">' + pct(r.change_7d) + '</td><td class="pill">' + esc(r.category) + '</td><td class="pill">' + esc(chainsShort(r.chains)) + '</td>';
      tr.addEventListener('click', function () { showDetail(r.slug); });
      tbody.appendChild(tr);
    });
    countEl.textContent = list.length + ' of ' + rows.length + ' protocols · ' +
      list.filter(function (r) { return r.watchlist; }).length + ' watchlist';
    document.querySelectorAll('th[data-sort]').forEach(function (th) {
      th.classList.remove('sorted-asc', 'sorted-desc');
      if (th.getAttribute('data-sort') === state.sort) {
        th.classList.add(state.dir === 1 ? 'sorted-asc' : 'sorted-desc');
      }
    });
  }

  document.querySelectorAll('th[data-sort]').forEach(function (th) {
    th.addEventListener('click', function () {
      var k = th.getAttribute('data-sort');
      if (state.sort === k) { state.dir = -state.dir; }
      else { state.sort = k; state.dir = k === 'name' || k === 'category' || k === 'chains' ? 1 : -1; }
      render();
    });
  });

  var detail = gid('detail');
  function showDetail(slug) {
    var r = null;
    for (var i = 0; i < rows.length; i++) if (rows[i].slug === slug) { r = rows[i]; break; }
    if (!r) return;
    activeSlug = slug;
    gid('d-rank').textContent = 'Rank #' + r.rank + ' · ' + r.rank_lo + '–' + r.rank_hi + ' across ' + D.assumptions.bootstrap_draws + ' bootstrap refits' + (r.watchlist ? ' · Watchlist' : '');
    gid('d-name').textContent = r.name;
    gid('d-sub').textContent = r.category + ' · ' + r.chains.join(', ') +
      ' · Listed ' + (r.listed_at || 'date not recorded') + ' · ' + r.token_status;
    var grid = gid('d-grid');
    grid.innerHTML = [
      [money(r.implied_value_usd), 'implied launch value'],
      [Math.round(r.token_odds * 100) + '%', 'token odds (' + r.odds_peers_with_token + ' of ' + r.odds_peers + ' in ' + r.category + ')'],
      [money(r.range_lo_usd) + ' – ' + money(r.range_hi_usd), 'value range (P25–P75)'],
      [money(r.tvl_usd), 'TVL'],
      ['× ' + r.multiple.toFixed(2), 'category factor (' + (r.multiple_source === 'category' ? 'category' : 'none') + ')'],
    ].map(function (s) { return '<div class="stat"><b>' + s[0] + '</b><span>' + s[1] + '</span></div>'; }).join('');
    var br = gid('d-break');
    var curveValue = r.if_launches_usd / (r.multiple * r.growth_factor);
    br.innerHTML =
      '<tr><td>Size curve at this TVL (fitted)</td><td>' + moneyFull(curveValue) + '</td></tr>' +
      '<tr><td>× Category factor (' + r.category + (r.multiple_source === 'category' ? '' : ', too few peers') + ')</td><td>× ' + r.multiple.toFixed(3) + '</td></tr>' +
      '<tr><td>× Growth factor (7d ' + pct(r.change_7d) + ')</td><td>× ' + r.growth_factor.toFixed(3) + '</td></tr>' +
      '<tr><td>× Age factor — tested, not kept</td><td>× 1.000</td></tr>' +
      '<tr class="total"><td>= Value if it launches</td><td>' + moneyFull(r.if_launches_usd) + '</td></tr>' +
      '<tr><td>× Token odds (' + r.odds_peers_with_token + ' of ' + r.odds_peers + ' in ' + r.category + '; family ' + (r.odds_family_adj >= 0 ? '+' : '') + r.odds_family_adj.toFixed(2) + ')</td><td>× ' + r.token_odds.toFixed(3) + ' ± ' + r.odds_se.toFixed(3) + '</td></tr>' +
      '<tr class="total"><td>= Implied launch value</td><td>' + moneyFull(r.implied_value_usd) + '</td></tr>' +
      '<tr><td>Range P25–P75 (P10–P90)</td><td>' + moneyFull(r.range_lo_usd) + ' – ' + moneyFull(r.range_hi_usd) + ' (' + moneyFull(r.range_p10_usd) + ' – ' + moneyFull(r.range_p90_usd) + ')</td></tr>';

    var ab = gid('d-ablation');
    var ctrl = D.ablation_control;
    var octrl = D.odds_control;
    ab.innerHTML = '<tr><th>Term</th><th class="num">LOO</th><th class="num">Walk-forward</th><th>Verdict</th></tr>' +
      D.ablation.map(function (a) {
        return '<tr><td>' + a.label + '</td><td class="num">×' + a.loo_miss.toFixed(2) + '</td><td class="num">×' + a.wf_miss.toFixed(2) + '</td><td class="' + (a.verdict === 'dropped' ? 'bad' : '') + '">' + a.verdict + ' — ' + a.note + '</td></tr>';
      }).join('') +
      '<tr><td>Flat multiple</td><td class="num">×' + D.evidence.loo_flat.toFixed(2) + '</td><td class="num">×' + D.evidence.wf_flat.toFixed(2) + '</td><td>baseline</td></tr>' +
      '<tr><td>' + ctrl.label + '</td><td class="num">×' + ctrl.loo_miss.toFixed(2) + '</td><td class="num">×' + ctrl.wf_miss.toFixed(2) + '</td><td>control — ' + ctrl.note + '</td></tr>' +
      '<tr><th colspan="4">Token odds (Brier, lower is better — 10-fold CV / walk-forward)</th></tr>' +
      D.odds_ablation.map(function (a) {
        return '<tr><td>' + a.label + '</td><td class="num">' + a.cv_brier.toFixed(3) + '</td><td class="num">' + a.wf_brier.toFixed(3) + '</td><td class="' + (a.verdict === 'dropped' ? 'bad' : '') + '">' + a.verdict + (a.note ? ' — ' + a.note : '') + '</td></tr>';
      }).join('') +
      '<tr><td>' + octrl.label + '</td><td class="num">' + octrl.cv_brier.toFixed(3) + '</td><td class="num">' + octrl.wf_brier.toFixed(3) + '</td><td>control — ' + octrl.note + '</td></tr>';
    var tr2 = D.term_ranges;
    var of = D.odds_fit;
    gid('d-ablation-note').textContent =
      'Each row adds a term and re-runs both tests. A term stays only if it lowers the miss — or the Brier score — on both. Ranges: category ×' +
      tr2.category[0].toFixed(2) + '–×' + tr2.category[1].toFixed(2) + ', growth ×' + tr2.growth[0].toFixed(2) +
      '–×' + tr2.growth[1].toFixed(2) + ', odds ' + Math.round(tr2.odds[0] * 100) + '%–' + Math.round(tr2.odds[1] * 100) + '%. ' +
      'Fitted, ± s.e.: slope ' + D.fit.slope.toFixed(2) + ' ± ' + D.fit.slope_se.toFixed(2) +
      '; multiple at $100M ×' + D.fit.multiple_at_100m.toFixed(2) + ' ± ' + D.fit.multiple_se.toFixed(2) +
      '; odds logits: age +' + of.age.toFixed(2) + ' ± ' + of.se.age.toFixed(2) +
      ', ln TVL +' + of.size.toFixed(2) + ' ± ' + of.se.size.toFixed(2) +
      ', growth ' + of.growth.toFixed(2) + ' ± ' + of.se.growth.toFixed(2) +
      ', family +' + of.family.toFixed(2) + ' ± ' + of.se.family.toFixed(2) + '. Value-model growth is fixed at 0.5 per 100% 7d change, not fitted.';

    var econ = gid('d-econ');
    econ.textContent = '';
    var tb = r.econ.tbill_usd;
    var tbText = 'vs T-bill ' + moneySmall(tb) + ' (' + D.assumptions.tbill_hold_days + 'd hold)';
    var verdictNote = r.verdict === 'FARM'
      ? 'FARM — net ' + moneyFull(r.net_usd) + ' ' + tbText + ': clears the bar and the risk-free rate.'
      : r.verdict === 'SKIP'
        ? 'SKIP — net ' + moneyFull(r.net_usd) + ' ' + tbText + ': a $10,000 stake is a drop here.'
        : 'MARGINAL — net ' + moneyFull(r.net_usd) + ' ' + tbText + ': does not clear the FARM bar.';
    var head = el('div', 'econ-head');
    head.innerHTML = '<span class="verdict verdict-' + r.verdict.toLowerCase() + '">' + r.verdict + '</span><span>' + verdictNote + '</span>';
    econ.appendChild(head);
    var egrid = el('div', 'econ-grid');
    egrid.innerHTML = [
      [moneyFull(r.econ.drop_pool_usd), 'drop pool'],
      [moneyFull(r.econ.farmer_drop_usd), 'modelled drop'],
      [moneySmall(r.econ.fees_usd), 'fees (' + r.econ.txs + ' gas txs at ' + moneySmall(r.econ.gas_per_tx_usd) + ')'],
      [r.econ.hours.toFixed(1) + ' hours', 'time'],
      [moneyFull(r.net_usd), 'net'],
      [money(r.net_per_hour_usd) + '/hr', 'net per hour'],
    ].map(function (s) { return '<div class="stat"><b>' + s[0] + '</b><span>' + s[1] + '</span></div>'; }).join('');
    econ.appendChild(egrid);
    var as = D.assumptions;
    econ.appendChild(el('p', 'note', 'Assumptions: drop pool 2% of implied value; farming pool 5% of TVL; gas ' + moneySmall(as.gas_usd.Ethereum) + ' Ethereum, ' + moneySmall(as.gas_usd.Solana) + ' Solana, ' + moneySmall(as.gas_usd.Bitcoin) + ' Bitcoin, ' + moneySmall(as.gas_default_usd) + ' elsewhere, + $2 per bridge step; each step counted once. FARM net > $750 and > $500/hr; SKIP net < $100. T-bill ' + (as.tbill_rate * 100).toFixed(2) + '%/yr (US 3-month, H.15, ' + as.tbill_as_of + '), ' + as.tbill_hold_days + '-day hold.'));

    var mx = gid('d-matrix');
    mx.innerHTML = '<tr><th>Deposit</th><th class="num">1%</th><th class="num">2%</th><th class="num">5%</th></tr>' +
      [1000, 10000, 50000].map(function (dep) {
        return '<tr><td>' + moneyFull(dep) + '</td>' + [0.01, 0.02, 0.05].map(function (sh) {
          var net = netAt(r, dep, sh, 1);
          var v = scenVerdict(r, net);
          return '<td class="num"><span class="verdict verdict-' + v.toLowerCase() + '">' + v + '</span> ' + money(net) + '</td>';
        }).join('') + '</tr>';
      }).join('');

    var farm = gid('d-farm');
    farm.textContent = '';
    r.farm_steps.forEach(function (s) { farm.appendChild(el('li', null, s)); });

    var peersEl = gid('d-peers');
    peersEl.innerHTML = '<tr><th>Protocol</th><th>TVL</th><th>Market cap</th><th>Cap / TVL</th></tr>' +
      r.peers.map(function (p) {
        return '<tr><td>' + esc(p.name) + (p.same_category ? '' : ' (other category)') + '</td><td class="num">' + money(p.tvl_usd) + '</td><td class="num">' + money(p.mcap_usd) + '</td><td class="num">' + p.cap_tvl.toFixed(2) + '×</td></tr>';
      }).join('');
    gid('d-peers-title').textContent = 'Nearest priced peers in ' + r.category;

    detail.hidden = false;
    render();
    detail.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  gid('d-close').addEventListener('click', function () {
    detail.hidden = true;
    activeSlug = null;
    render();
  });

  document.getElementById('q').addEventListener('input', function (e) { state.q = e.target.value; render(); });
  catSel.addEventListener('change', function (e) { state.cat = e.target.value; render(); });
  chainSel.addEventListener('change', function (e) { state.chain = e.target.value; render(); });
  document.getElementById('minTvl').addEventListener('change', function (e) { state.minTvl = Number(e.target.value); render(); });
  document.getElementById('wl').addEventListener('change', function (e) { state.wl = e.target.checked; render(); });
  document.getElementById('reset').addEventListener('click', function () {
    state = Object.assign({}, DEF);
    scen = { dep: A.deposit_usd, share: A.drop_pool_pct, gas: 1 };
    document.getElementById('q').value = '';
    catSel.value = ''; chainSel.value = '';
    document.getElementById('minTvl').value = '0';
    document.getElementById('wl').checked = false;
    document.getElementById('dep').value = String(A.deposit_usd);
    document.getElementById('share').value = String(A.drop_pool_pct * 100);
    document.getElementById('gas').value = '1';
    syncSliders();
    render();
  });
  [['dep', function (v) { scen.dep = Number(v); }], ['share', function (v) { scen.share = Number(v) / 100; }], ['gas', function (v) { scen.gas = Number(v); }]].forEach(function (s) {
    document.getElementById(s[0]).addEventListener('input', function (e) { s[1](e.target.value); syncSliders(); render(); });
  });
  syncSliders();

  render();
})();
