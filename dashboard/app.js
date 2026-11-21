// app.js — Token Launch Radar dashboard. No network, no framework.
// Renders window.TOKEN_RADAR (written by main.ts as ../data.js): a sortable,
// filterable board of 198 pre-token protocols and a detail view per protocol.

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

  /** $48.4M, $1.24B, $88.1K, $950 — one decimal, whole dollars never rounded up in display. */
  function money(v) {
    if (v >= 1e9) return '$' + (v / 1e9).toFixed(2) + 'B';
    if (v >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M';
    if (v >= 1e3) return '$' + (v / 1e3).toFixed(1) + 'K';
    return '$' + Math.round(v);
  }
  function moneyFull(v) { return '$' + Math.round(v).toLocaleString('en-US'); }
  /** Small amounts (gas, fees) where rounding to whole dollars would read $0. */
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
      '<strong>How good is the model?</strong> The size curve was fitted from ' +
      f.n_comps + ' token-trading protocols: ln(market cap) = ' +
      f.intercept.toFixed(2) + ' + ' + f.slope.toFixed(2) +
      ' &times; ln(TVL) (R&sup2; ' + f.r2.toFixed(2) +
      '). Held out, it misses by &times;' + e.loo_fitted.toFixed(1) +
      ' (leave-one-out) and &times;' + e.wf_fitted.toFixed(1) +
      ' (walk-forward), against &times;' + e.loo_flat.toFixed(1) +
      ' and &times;' + e.wf_flat.toFixed(1) +
      ' for a flat multiple. Token odds score ' + e.brier_odds.toFixed(3) +
      ' (Brier) against ' + e.brier_base.toFixed(3) +
      ' for the base rate &mdash; they discriminate weakly, so read them as a rough guide, not a prediction.';
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
      '<span><i class="dot left"></i>' + a.left_out + ' excluded by the watchlist rule (bridges, staking, CEX products, versioned or wrapped names)</span>' +
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
  var sortKeys = {
    rank: function (r) { return r.rank; },
    name: function (r) { return r.name.toLowerCase(); },
    category: function (r) { return r.category; },
    chains: function (r) { return r.chains[0] || ''; },
    tvl_usd: function (r) { return r.tvl_usd; },
    change_7d: function (r) { return r.change_7d === null ? -Infinity : r.change_7d; },
    implied_value_usd: function (r) { return r.implied_value_usd; },
    token_odds: function (r) { return r.token_odds; },
    net_per_hour_usd: function (r) { return r.net_per_hour_usd; },
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
      var nameTd = el('td');
      nameTd.appendChild(el('span', 'nm', r.name));
      if (r.watchlist) nameTd.appendChild(el('span', 'badge', 'WATCHLIST'));
      nameTd.appendChild(el('div', 'sl', r.slug));
      tr.appendChild(nameTd);
      tr.appendChild(el('td', 'num val', money(r.implied_value_usd)));
      var oddsTd = el('td', 'num');
      oddsTd.innerHTML = Math.round(r.token_odds * 100) + '%<div class="sl">' + r.odds_peers + ' peers</div>';
      tr.appendChild(oddsTd);
      var vTd = el('td');
      vTd.innerHTML = '<span class="verdict verdict-' + r.verdict.toLowerCase() + '">' + r.verdict + '</span>';
      tr.appendChild(vTd);
      tr.appendChild(el('td', 'num', money(r.net_per_hour_usd)));
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
    document.getElementById('d-rank').textContent = 'Rank #' + r.rank + (r.watchlist ? ' · Watchlist' : '');
    document.getElementById('d-name').textContent = r.name;
    document.getElementById('d-sub').textContent = r.category + ' · ' + r.chains.join(', ') +
      ' · Listed ' + (r.listed_at || 'date not recorded') + ' · ' + r.token_status;
    var grid = document.getElementById('d-grid');
    grid.textContent = '';
    [
      [money(r.implied_value_usd), 'implied launch value'],
      [money(r.if_launches_usd), 'value if it launches'],
      [Math.round(r.token_odds * 100) + '%', 'token odds (' + r.odds_peers_with_token + ' of ' + r.odds_peers + ' peers)'],
      [money(r.range_lo_usd) + ' – ' + money(r.range_hi_usd), 'value range (P25–P75)'],
      [money(r.tvl_usd), 'total value locked'],
      [pct(r.change_7d), 'TVL change, 7 days'],
      [r.age_years.toFixed(2) + ' yrs', 'running with no token'],
      ['× ' + r.multiple.toFixed(2), 'category factor (' + (r.multiple_source === 'category' ? 'from its category' : 'no adjustment') + ')'],
    ].forEach(function (s) {
      var box = el('div', 'stat');
      box.appendChild(el('b', null, s[0]));
      box.appendChild(el('span', null, s[1]));
      grid.appendChild(box);
    });
    var br = document.getElementById('d-break');
    br.textContent = '';
    var curveValue = r.if_launches_usd / (r.multiple * r.growth_factor * r.age_factor);
    var parts = [
      ['Size curve at this TVL (fitted: ln(mcap) = ' + D.fit.intercept.toFixed(2) + ' + ' + D.fit.slope.toFixed(2) + ' × ln(TVL), ' + D.fit.n_comps + ' comps)', moneyFull(curveValue)],
      ['× Category factor (' + r.category + ', shrunk median ratio' + (r.multiple_source === 'category' ? '' : ' — too few peers, no adjustment') + ')', '× ' + r.multiple.toFixed(3)],
      ['× Growth factor (7d ' + pct(r.change_7d) + ')', '× ' + r.growth_factor.toFixed(3)],
      ['× Age factor (' + r.age_years.toFixed(2) + ' yrs, 1 + 0.15·ln(1+yrs))', '× ' + r.age_factor.toFixed(3)],
    ];
    parts.forEach(function (p) {
      var tr = el('tr');
      tr.appendChild(el('td', null, p[0]));
      tr.appendChild(el('td', null, p[1]));
      br.appendChild(tr);
    });
    var ifRow = el('tr', 'total');
    ifRow.appendChild(el('td', null, '= Value if it launches'));
    ifRow.appendChild(el('td', null, moneyFull(r.if_launches_usd)));
    br.appendChild(ifRow);
    var oddsRow = el('tr');
    oddsRow.appendChild(el('td', null, '× Token odds (' + r.odds_peers_with_token + ' of ' + r.odds_peers + ' peers record a token)'));
    oddsRow.appendChild(el('td', null, '× ' + r.token_odds.toFixed(3)));
    br.appendChild(oddsRow);
    var total = el('tr', 'total');
    total.appendChild(el('td', null, '= Implied launch value'));
    total.appendChild(el('td', null, moneyFull(r.implied_value_usd)));
    br.appendChild(total);
    var rangeRow = el('tr');
    rangeRow.appendChild(el('td', null, 'Value range P25–P75 (spread of peer multiples in this category)'));
    rangeRow.appendChild(el('td', null, moneyFull(r.range_lo_usd) + ' – ' + moneyFull(r.range_hi_usd)));
    br.appendChild(rangeRow);

    var econ = document.getElementById('d-econ');
    econ.textContent = '';
    var verdictNote = r.verdict === 'FARM'
      ? 'The modelled drop clears the bar: net over $750 and over $500 an hour on a $10,000 deposit.'
      : r.verdict === 'SKIP'
        ? 'The modelled drop is under $100 on a $10,000 deposit — a $10,000 stake is a drop in this TVL, so farming here pays for the steps, not the drop.'
        : 'Worth a look, but the modelled drop does not clear the FARM bar (net over $750 and over $500 an hour).';
    var head = el('div', 'econ-head');
    head.innerHTML = '<span class="verdict verdict-' + r.verdict.toLowerCase() + '">' + r.verdict + '</span><span>' + verdictNote + '</span>';
    econ.appendChild(head);
    var egrid = el('div', 'econ-grid');
    [
      [moneyFull(r.econ.deposit_usd), 'deposit'],
      [moneyFull(r.econ.drop_pool_usd), 'drop pool (2% of implied)'],
      [moneyFull(r.econ.farmer_drop_usd), 'your modelled drop'],
      [moneySmall(r.econ.fees_usd), 'fees (' + r.econ.txs + ' gas txs at ' + moneySmall(r.econ.gas_per_tx_usd) + ')'],
      [r.econ.hours.toFixed(1) + ' hours', 'time'],
      [moneyFull(r.net_usd), 'net (drop × odds − fees)'],
      [money(r.net_per_hour_usd) + '/hr', 'net per hour'],
    ].forEach(function (s) {
      var box = el('div', 'stat');
      box.appendChild(el('b', null, s[0]));
      box.appendChild(el('span', null, s[1]));
      egrid.appendChild(box);
    });
    econ.appendChild(egrid);
    var as = D.assumptions;
    econ.appendChild(el('p', 'note', 'Assumptions: drop pool 2% of implied value; the farming pool is 5% of TVL and your share is the deposit over it; gas ' + moneySmall(as.gas_usd.Ethereum) + ' per transaction on Ethereum, ' + moneySmall(as.gas_usd.Solana) + ' on Solana, ' + moneySmall(as.gas_usd.Bitcoin) + ' on Bitcoin, ' + moneySmall(as.gas_default_usd) + ' elsewhere; each step is counted once, at its stated minutes. FARM means net over $750 and over $500 an hour; SKIP means net under $100.'));

    var farm = document.getElementById('d-farm');
    farm.textContent = '';
    r.farm_steps.forEach(function (s) { farm.appendChild(el('li', null, s)); });

    var peersEl = document.getElementById('d-peers');
    peersEl.textContent = '';
    var peersHead = el('tr');
    ['Protocol', 'TVL', 'Market cap', 'Cap / TVL', 'Curve multiple'].forEach(function (h) {
      peersHead.appendChild(el('th', null, h));
    });
    peersEl.appendChild(peersHead);
    r.peers.forEach(function (p) {
      var tr = el('tr');
      tr.appendChild(el('td', null, p.name + (p.same_category ? '' : ' (other category)')));
      tr.appendChild(el('td', 'num', money(p.tvl_usd)));
      tr.appendChild(el('td', 'num', money(p.mcap_usd)));
      tr.appendChild(el('td', 'num', p.cap_tvl.toFixed(2) + '×'));
      tr.appendChild(el('td', 'num', p.curve_multiple.toFixed(3) + '×'));
      peersEl.appendChild(tr);
    });
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
    document.getElementById('q').value = '';
    catSel.value = ''; chainSel.value = '';
    document.getElementById('minTvl').value = '0';
    document.getElementById('wl').checked = false;
    render();
  });

  render();
})();
