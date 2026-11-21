// app.js — Token Launch Radar dashboard. No network, no framework.
// Renders window.TOKEN_RADAR: a sortable board of 198 pre-token protocols and a detail view.

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

  /** $48.4M, $1.24B, $88.1K — one decimal. */
  function money(v) {
    if (v >= 1e9) return '$' + (v / 1e9).toFixed(2) + 'B';
    if (v >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M';
    if (v >= 1e3) return '$' + (v / 1e3).toFixed(1) + 'K';
    return '$' + Math.round(v);
  }
  function moneyFull(v) { return '$' + Math.round(v).toLocaleString('en-US'); }
  /** Small amounts, where whole dollars would read $0. */
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

  // ---- stats strip -------------------------------------------------------
  var stats = document.getElementById('stats');
  var wlCount = rows.filter(function (r) { return r.watchlist; }).length;
  var farmCount = rows.filter(function (r) { return r.verdict === 'FARM'; }).length;
  var statData = [
    [String(rows.length), 'protocols ranked'],
    [wlCount + ' / ' + D.watchlist_size, 'watchlist covered'],
    [money(D.total_implied_usd), 'total implied value'],
    [String(farmCount), 'FARM verdicts'],
  ];
  statData.forEach(function (s, i) {
    var box = el('div', 'stat');
    var b = el('b', i === 3 ? 'green' : null, s[0]);
    box.appendChild(b);
    box.appendChild(el('span', null, s[1]));
    stats.appendChild(box);
  });

  // ---- evidence strip + accounting bar -----------------------------------
  var evidenceEl = document.getElementById('evidence');
  if (evidenceEl && D.fit && D.evidence) {
    var f = D.fit;
    var e = D.evidence;
    evidenceEl.innerHTML =
      '<strong>Model:</strong> ln(mcap) = ' +
      f.intercept.toFixed(2) + ' + ' + f.slope.toFixed(2) +
      ' &times; ln(TVL) (R&sup2; ' + f.r2.toFixed(2) + ', slope ' + f.slope.toFixed(2) + ' ± ' + f.slope_se.toFixed(2) + ', ' + f.n_comps + ' comps). Held out: leave-one-out &times;' +
      e.loo_fitted.toFixed(2) + ' vs flat &times;' + e.loo_flat.toFixed(2) + ', walk-forward &times;' +
      e.wf_fitted.toFixed(2) + ' vs flat &times;' + e.wf_flat.toFixed(2) + '.';
  }
  var ev2 = document.getElementById('evidence2');
  if (ev2 && D.ablation && D.assumptions) {
    var widths = rows.map(function (r) { return r.rank_hi - r.rank_lo; }).sort(function (a, b) { return a - b; });
    var medW = widths[Math.floor(widths.length / 2)];
    ev2.innerHTML =
      '<strong>How sure is a rank?</strong> The curve was refitted ' + D.assumptions.bootstrap_draws +
      ' times on resampled comps and the board re-ranked: the median row\u2019s rank spans ' +
      medW + ' places (P5–P95), rank 1 sits at ' + rows[0].rank_lo + '–' + rows[0].rank_hi +
      '. See the validation table in any detail view.';
  }
  var ev3 = document.getElementById('evidence3');
  if (ev3 && D.calibration) {
    var c = D.calibration;
    ev3.innerHTML = '<strong>Is the range honest?</strong> P25–P75 holds the real cap for ' +
      Math.round(c.loo_p2575 * 100) + '% held out, ' + Math.round(c.wf_p2575 * 100) +
      '% walk-forward (50% stated); P10–P90 ' + Math.round(c.loo_p1090 * 100) + '% / ' +
      Math.round(c.wf_p1090 * 100) + '% (80% stated). Old ranges: ' +
      Math.round(c.old_loo_p2575 * 100) + '% / ' + Math.round(c.old_wf_p2575 * 100) + '%.';
  }
  var acctEl = document.getElementById('accounting');
  if (acctEl && D.accounting) {
    var a = D.accounting;
    var pctOf = function (n) { return Math.round((n / a.total) * 100); };
    acctEl.innerHTML =
      '<div class="acct-bar">' +
      '<span class="acct-seg acct-ranked" style="width:' + pctOf(a.ranked) + '%"></span>' +
      '<span class="acct-seg acct-token" style="width:' + pctOf(a.token_recorded) + '%"></span>' +
      '<span class="acct-seg acct-left" style="width:' + pctOf(a.left_out) + '%"></span>' +
      '</div>' +
      '<div class="acct-legend">' +
      '<span><i class="dot ranked"></i>' + a.ranked + ' ranked here</span>' +
      '<span><i class="dot token"></i>' + a.token_recorded + ' already record a token</span>' +
      '<span><i class="dot left"></i>' + a.left_out + ' excluded by the watchlist rule</span>' +
      '<span class="acct-total">' + a.total + ' protocols in the snapshot</span>' +
      '</div>';
  }

  // ---- filter options ----------------------------------------------------
  var catSel = document.getElementById('cat');
  var chainSel = document.getElementById('chain');
  var cats = [], chains = [];
  rows.forEach(function (r) {
    if (cats.indexOf(r.category) < 0) cats.push(r.category);
    r.chains.forEach(function (c) { if (chains.indexOf(c) < 0) chains.push(c); });
  });
  cats.sort().forEach(function (c) { catSel.appendChild(el('option', null, c)); });
  chains.sort().forEach(function (c) { chainSel.appendChild(el('option', null, c)); });

  // ---- state -------------------------------------------------------------
  var state = { q: '', cat: '', chain: '', minTvl: 0, wl: false, sort: 'rank', dir: 1 };
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
  var sortKeys = {
    rank: function (r) { return r.rank; },
    rank_lo: function (r) { return r.rank_lo; },
    name: function (r) { return r.name.toLowerCase(); },
    category: function (r) { return r.category; },
    chains: function (r) { return r.chains[0] || ''; },
    tvl_usd: function (r) { return r.tvl_usd; },
    change_7d: function (r) { return r.change_7d === null ? -Infinity : r.change_7d; },
    implied_value_usd: function (r) { return r.implied_value_usd; },
    token_odds: function (r) { return r.token_odds; },
    net_per_hour_usd: function (r) { return scenNet(r) / r.econ.hours; },
  };

  function filtered() {
    var q = state.q.trim().toLowerCase();
    var list = rows.filter(function (r) {
      if (state.wl && !r.watchlist) return false;
      if (state.cat && r.category !== state.cat) return false;
      if (state.chain && r.chains.indexOf(state.chain) < 0) return false;
      if (r.tvl_usd < state.minTvl) return false;
      if (q && r.name.toLowerCase().indexOf(q) < 0 && r.slug.indexOf(q) < 0) return false;
      return true;
    });
    var key = sortKeys[state.sort];
    list.sort(function (a, b) {
      var x = key(a), y = key(b);
      return (x < y ? -1 : x > y ? 1 : 0) * state.dir;
    });
    return list;
  }

  // ---- table -------------------------------------------------------------
  var tbody = document.getElementById('rows');
  var countEl = document.getElementById('count');
  var activeSlug = null;

  function render() {
    var list = filtered();
    tbody.textContent = '';
    list.forEach(function (r) {
      var tr = el('tr');
      if (r.slug === activeSlug) tr.className = 'active';
      tr.appendChild(el('td', 'num', String(r.rank)));
      tr.appendChild(el('td', 'num rng', r.rank_lo + '–' + r.rank_hi));
      var nameTd = el('td');
      nameTd.appendChild(el('span', 'nm', r.name));
      if (r.watchlist) nameTd.appendChild(el('span', 'badge', 'WATCHLIST'));
      nameTd.appendChild(el('div', 'sl', r.slug));
      tr.appendChild(nameTd);
      tr.appendChild(el('td', 'num val', money(r.implied_value_usd)));
      var oddsTd = el('td', 'num');
      oddsTd.innerHTML = Math.round(r.token_odds * 100) + '%<div class="sl">' + r.odds_peers + ' peers</div>';
      tr.appendChild(oddsTd);
      var sNet = scenNet(r);
      var sVerd = scenVerdict(r, sNet);
      var vTd = el('td');
      vTd.innerHTML = '<span class="verdict verdict-' + sVerd.toLowerCase() + '">' + sVerd + '</span>';
      tr.appendChild(vTd);
      tr.appendChild(el('td', 'num', money(sNet / r.econ.hours)));
      tr.appendChild(el('td', 'num', money(r.tvl_usd)));
      var ch = el('td', 'num ' + (r.change_7d === null ? 'flat' : r.change_7d > 0 ? 'up' : r.change_7d < 0 ? 'down' : 'flat'), pct(r.change_7d));
      tr.appendChild(ch);
      tr.appendChild(el('td', 'pill', r.category));
      tr.appendChild(el('td', 'pill', chainsShort(r.chains)));
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

  // ---- detail ------------------------------------------------------------
  var detail = document.getElementById('detail');
  function showDetail(slug) {
    var r = null;
    for (var i = 0; i < rows.length; i++) if (rows[i].slug === slug) { r = rows[i]; break; }
    if (!r) return;
    activeSlug = slug;
    document.getElementById('d-rank').textContent = 'Rank #' + r.rank + ' · ' + r.rank_lo + '–' + r.rank_hi + ' across ' + D.assumptions.bootstrap_draws + ' bootstrap refits' + (r.watchlist ? ' · Watchlist' : '');
    document.getElementById('d-name').textContent = r.name;
    document.getElementById('d-sub').textContent = r.category + ' · ' + r.chains.join(', ') +
      ' · Listed ' + (r.listed_at || 'date not recorded') + ' · ' + r.token_status;
    var grid = document.getElementById('d-grid');
    grid.innerHTML = [
      [money(r.implied_value_usd), 'implied launch value'],
      [money(r.if_launches_usd), 'value if it launches'],
      [Math.round(r.token_odds * 100) + '%', 'token odds (' + r.odds_peers_with_token + ' of ' + r.odds_peers + ' peers)'],
      [money(r.range_lo_usd) + ' – ' + money(r.range_hi_usd), 'value range (P25–P75)'],
      [r.rank_lo + '–' + r.rank_hi, 'rank range (P5–P95)'],
      [money(r.tvl_usd), 'TVL'],
      [pct(r.change_7d), 'TVL change, 7 days'],
      [r.age_years.toFixed(2) + ' yrs', 'no-token age'],
      ['× ' + r.multiple.toFixed(2), 'category factor (' + (r.multiple_source === 'category' ? 'category' : 'none') + ')'],
    ].map(function (s) { return '<div class="stat"><b>' + s[0] + '</b><span>' + s[1] + '</span></div>'; }).join('');
    var br = document.getElementById('d-break');
    var curveValue = r.if_launches_usd / (r.multiple * r.growth_factor);
    var oddsSe = Math.sqrt(r.token_odds * (1 - r.token_odds) / (r.odds_peers + 20));
    br.innerHTML =
      '<tr><td>Size curve at this TVL (fitted, ' + D.fit.n_comps + ' comps)</td><td>' + moneyFull(curveValue) + '</td></tr>' +
      '<tr><td>× Category factor (' + r.category + ', shrunk median ratio' + (r.multiple_source === 'category' ? '' : ' — too few peers, no adjustment') + ')</td><td>× ' + r.multiple.toFixed(3) + '</td></tr>' +
      '<tr><td>× Growth factor (7d ' + pct(r.change_7d) + ')</td><td>× ' + r.growth_factor.toFixed(3) + '</td></tr>' +
      '<tr><td>× Age factor — tested, not kept</td><td>× 1.000</td></tr>' +
      '<tr class="total"><td>= Value if it launches</td><td>' + moneyFull(r.if_launches_usd) + '</td></tr>' +
      '<tr><td>× Token odds (' + r.odds_peers_with_token + ' of ' + r.odds_peers + ' peers record a token)</td><td>× ' + r.token_odds.toFixed(3) + ' ± ' + oddsSe.toFixed(3) + '</td></tr>' +
      '<tr class="total"><td>= Implied launch value</td><td>' + moneyFull(r.implied_value_usd) + '</td></tr>' +
      '<tr><td>Value range P25–P75 (P10–P90)</td><td>' + moneyFull(r.range_lo_usd) + ' – ' + moneyFull(r.range_hi_usd) + ' (' + moneyFull(r.range_p10_usd) + ' – ' + moneyFull(r.range_p90_usd) + ')</td></tr>';

    // ---- term-by-term validation -------------------------------------------
    var ab = document.getElementById('d-ablation');
    ab.innerHTML = '<tr><th>Term</th><th class="num">LOO</th><th class="num">Walk-forward</th><th>Verdict</th></tr>' +
      D.ablation.map(function (a) {
        return '<tr><td>' + a.label + '</td><td class="num">×' + a.loo_miss.toFixed(2) + '</td><td class="num">×' + a.wf_miss.toFixed(2) + '</td><td class="' + (a.verdict === 'dropped' ? 'bad' : '') + '">' + a.verdict + ' — ' + a.note + '</td></tr>';
      }).join('') +
      '<tr><td>Flat multiple</td><td class="num">×' + D.evidence.loo_flat.toFixed(2) + '</td><td class="num">×' + D.evidence.wf_flat.toFixed(2) + '</td><td>baseline</td></tr>' +
      '<tr><th colspan="4">Token odds (Brier, lower is better)</th></tr>' +
      D.odds_ablation.map(function (a) {
        return '<tr><td>' + a.label + '</td><td class="num">' + a.loo_brier.toFixed(3) + '</td><td class="num">' + a.wf_brier.toFixed(3) + '</td><td class="' + (a.verdict === 'dropped' ? 'bad' : '') + '">' + a.verdict + '</td></tr>';
      }).join('');
    var tr2 = D.term_ranges;
    document.getElementById('d-ablation-note').textContent =
      'Each row adds a term and re-runs both tests over the ' + D.fit.n_comps +
      ' traded comps. A term stays only if it lowers the miss — or the Brier score — on both. Ranges: category ×' +
      tr2.category[0].toFixed(2) + '–×' + tr2.category[1].toFixed(2) + ', growth ×' + tr2.growth[0].toFixed(2) +
      '–×' + tr2.growth[1].toFixed(2) + ', odds ' + Math.round(tr2.odds[0] * 100) + '%–' + Math.round(tr2.odds[1] * 100) + '% (age was tested in the value model, kept only in the odds).';

    var econ = document.getElementById('d-econ');
    econ.textContent = '';
    var tb = r.econ.tbill_usd;
    var tbText = 'vs ' + moneySmall(tb) + ' in a T-bill for the same ' + D.assumptions.tbill_hold_days + '-day hold';
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
      [moneyFull(r.econ.deposit_usd), 'deposit'],
      [moneyFull(r.econ.drop_pool_usd), 'drop pool'],
      [moneyFull(r.econ.farmer_drop_usd), 'modelled drop'],
      [moneySmall(r.econ.fees_usd), 'fees (' + r.econ.txs + ' gas txs at ' + moneySmall(r.econ.gas_per_tx_usd) + ')'],
      [r.econ.hours.toFixed(1) + ' hours', 'time'],
      [moneyFull(r.net_usd), 'net'],
      [money(r.net_per_hour_usd) + '/hr', 'net per hour'],
      [moneySmall(r.econ.tbill_usd), 'T-bill, ' + D.assumptions.tbill_hold_days + '-day hold'],
    ].map(function (s) { return '<div class="stat"><b>' + s[0] + '</b><span>' + s[1] + '</span></div>'; }).join('');
    econ.appendChild(egrid);
    var as = D.assumptions;
    econ.appendChild(el('p', 'note', 'Assumptions: drop pool 2% of implied value; the farming pool is 5% of TVL and your share is the deposit over it; gas ' + moneySmall(as.gas_usd.Ethereum) + ' per transaction on Ethereum, ' + moneySmall(as.gas_usd.Solana) + ' on Solana, ' + moneySmall(as.gas_usd.Bitcoin) + ' on Bitcoin, ' + moneySmall(as.gas_default_usd) + ' elsewhere, plus $2 per bridge step; each step counted once, at its stated minutes. FARM: net over $750 and over $500 an hour; SKIP: net under $100. T-bill ' + (as.tbill_rate * 100).toFixed(2) + '% a year (US 3-month Treasury bill, Federal Reserve H.15, ' + as.tbill_as_of + ') over the ' + as.tbill_hold_days + '-day minimum hold.'));

    // ---- deposit × drop-share matrix ---------------------------------------
    var mx = document.getElementById('d-matrix');
    mx.innerHTML = '<tr><th>Deposit</th><th class="num">1%</th><th class="num">2%</th><th class="num">5%</th></tr>' +
      [1000, 10000, 50000].map(function (dep) {
        return '<tr><td>' + moneyFull(dep) + '</td>' + [0.01, 0.02, 0.05].map(function (sh) {
          var net = netAt(r, dep, sh, 1);
          var v = scenVerdict(r, net);
          return '<td class="num"><span class="verdict verdict-' + v.toLowerCase() + '">' + v + '</span> ' + money(net) + '</td>';
        }).join('') + '</tr>';
      }).join('');

    var farm = document.getElementById('d-farm');
    farm.textContent = '';
    r.farm_steps.forEach(function (s) { farm.appendChild(el('li', null, s)); });

    var peersEl = document.getElementById('d-peers');
    peersEl.innerHTML = '<tr><th>Protocol</th><th>TVL</th><th>Market cap</th><th>Cap / TVL</th><th>Multiple</th></tr>' +
      r.peers.map(function (p) {
        return '<tr><td>' + p.name + (p.same_category ? '' : ' (other category)') + '</td><td class="num">' + money(p.tvl_usd) + '</td><td class="num">' + money(p.mcap_usd) + '</td><td class="num">' + p.cap_tvl.toFixed(2) + '×</td><td class="num">' + p.curve_multiple.toFixed(3) + '×</td></tr>';
      }).join('');
    document.getElementById('d-peers-title').textContent = 'Nearest priced peers in ' + r.category;

    detail.hidden = false;
    render();
    detail.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  document.getElementById('d-close').addEventListener('click', function () {
    detail.hidden = true;
    activeSlug = null;
    render();
  });

  // ---- controls ----------------------------------------------------------
  document.getElementById('q').addEventListener('input', function (e) { state.q = e.target.value; render(); });
  catSel.addEventListener('change', function (e) { state.cat = e.target.value; render(); });
  chainSel.addEventListener('change', function (e) { state.chain = e.target.value; render(); });
  document.getElementById('minTvl').addEventListener('change', function (e) { state.minTvl = Number(e.target.value); render(); });
  document.getElementById('wl').addEventListener('change', function (e) { state.wl = e.target.checked; render(); });
  document.getElementById('reset').addEventListener('click', function () {
    state = { q: '', cat: '', chain: '', minTvl: 0, wl: false, sort: 'rank', dir: 1 };
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
  document.getElementById('dep').addEventListener('input', function (e) { scen.dep = Number(e.target.value); syncSliders(); render(); });
  document.getElementById('share').addEventListener('input', function (e) { scen.share = Number(e.target.value) / 100; syncSliders(); render(); });
  document.getElementById('gas').addEventListener('input', function (e) { scen.gas = Number(e.target.value); syncSliders(); render(); });
  syncSliders();

  render();
})();
