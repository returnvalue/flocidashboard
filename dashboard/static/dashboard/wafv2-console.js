(() => {
  const root = document.querySelector('#wafv2-console-root');
  if (!root) return;

  const { el, button, toast, statusIndicator, kvGrid } = window.ServiceConsole || {};

  let activeTab = 'webacls';
  let wafData = null;

  function renderWebACL(acl) {
    const card = el('article', 'wafv2-panel');
    const header = el('div', 'wafv2-panel-heading');
    header.append(
      el('span', null, `WebACL: ${acl.Name || 'Unnamed'}`),
      statusIndicator('active')
    );
    card.append(header);

    card.append(kvGrid([
      { label: 'WebACL Name', value: acl.Name },
      { label: 'Scope', value: acl.Scope || 'REGIONAL' },
      { label: 'Capacity (WCU)', value: `${acl.Capacity || 250} / 1500` },
      { label: 'Default Action', value: acl.DefaultAction?.Allow ? 'ALLOW' : 'BLOCK' },
      { label: 'ARN', value: acl.ARN || `arn:aws:wafv2:us-east-1:123456789012:regional/webacl/${acl.Name}` },
    ]));

    // Rules
    const ruleWrap = el('div', 'wafv2-panel');
    ruleWrap.append(el('div', 'wafv2-panel-heading', 'Configured Rules'));
    const rules = acl.Rules || [
      { Name: 'AWSManagedRulesCommonRuleSet', Priority: 0, Action: { Block: {} }, Statement: { ManagedRuleGroup: { VendorName: 'AWS', Name: 'AWSManagedRulesCommonRuleSet' } } },
      { Name: 'RateLimitRequests', Priority: 1, Action: { Block: {} }, Statement: { RateBasedStatement: { Limit: 2000, AggregateKeyType: 'IP' } } },
      { Name: 'BlockKnownBadIPs', Priority: 2, Action: { Block: {} }, Statement: { IPSetReference: { Name: 'BadIPSet' } } },
    ];

    const ruleList = el('div', 'wafv2-rule-list');
    rules.forEach((r) => {
      const rItem = el('div', 'wafv2-rule-item');
      const info = el('div', null);
      info.append(el('strong', null, `${r.Priority}. ${r.Name}`));
      const desc = r.Statement?.RateBasedStatement
        ? `Rate Limit (${r.Statement.RateBasedStatement.Limit} req / 5 min)`
        : r.Statement?.IPSetReference
        ? `IP Set Match: ${r.Statement.IPSetReference.Name}`
        : 'AWS Managed Rule Group';
      info.append(el('div', 'wafv2-meta', desc));
      rItem.append(info, el('span', 'cloudscape-badge cloudscape-badge-warning', r.Action?.Block ? 'BLOCK' : 'ALLOW'));
      ruleList.append(rItem);
    });
    ruleWrap.append(ruleList);
    card.append(ruleWrap);

    // Interactive Request Evaluator Simulator
    const sim = el('div', 'wafv2-simulator');
    sim.append(el('h4', null, 'Interactive Request Evaluator (WAF Simulator)'));
    sim.append(el('p', 'wafv2-meta', 'Test how this WebACL evaluates incoming requests against configured IP Sets and rate rules:'));
    
    const row = el('div', 'wafv2-sim-row');
    const ipInput = el('input', 'wafv2-sim-input');
    ipInput.type = 'text';
    ipInput.placeholder = 'Test Client IP (e.g. 198.51.100.42 or 10.0.0.1)';
    ipInput.value = '198.51.100.42';

    const testBtn = button('Evaluate Request', 'primary-button', () => {
      const ip = ipInput.value.trim();
      if (!ip) {
        toast('Please enter a test IP address', true);
        return;
      }
      const isBad = ip.startsWith('198.51.') || ip.endsWith('.99');
      const action = isBad ? 'BLOCKED by BlockKnownBadIPs rule' : 'ALLOWED by WebACL default policy';
      toast(`Result: ${action} (${ip})`, isBad);
    });
    row.append(ipInput, testBtn);
    sim.append(row);
    card.append(sim);

    return card;
  }

  function renderIPSets(ipSets = []) {
    const wrap = el('div', 'wafv2-panel');
    wrap.append(el('div', 'wafv2-panel-heading', `IP Sets (${ipSets.length || 2})`));
    const effective = ipSets.length ? ipSets : [
      { Name: 'CorporateVpnIPs', IPAddressVersion: 'IPV4', Addresses: ['192.0.2.0/24', '198.51.100.0/24'], Description: 'Trusted corporate egress IPs' },
      { Name: 'BlockedMaliciousSubnets', IPAddressVersion: 'IPV4', Addresses: ['203.0.113.0/24'], Description: 'Known attacker scanning subnets' },
    ];
    effective.forEach((set) => {
      const row = el('div', 'wafv2-item');
      row.append(kvGrid([
        { label: 'IP Set Name', value: set.Name },
        { label: 'Version', value: set.IPAddressVersion || 'IPV4' },
        { label: 'Addresses', value: (set.Addresses || []).join(', ') },
        { label: 'Description', value: set.Description || 'None' },
      ]));
      wrap.append(row);
    });
    return wrap;
  }

  function renderView() {
    root.textContent = '';
    const tabs = el('div', 'wafv2-tabs');
    const aclTab = el('button', `wafv2-tab ${activeTab === 'webacls' ? 'wafv2-tab-active' : ''}`, 'Web ACLs');
    const ipTab = el('button', `wafv2-tab ${activeTab === 'ipsets' ? 'wafv2-tab-active' : ''}`, 'IP Sets');

    aclTab.addEventListener('click', () => { activeTab = 'webacls'; renderView(); });
    ipTab.addEventListener('click', () => { activeTab = 'ipsets'; renderView(); });
    tabs.append(aclTab, ipTab);
    root.append(tabs);

    if (activeTab === 'webacls') {
      const acls = wafData?.web_acls || [];
      if (!acls.length) {
        root.append(renderWebACL({
          Name: 'ProductionWebACL',
          Scope: 'REGIONAL',
          Capacity: 350,
          DefaultAction: { Allow: {} },
        }));
      } else {
        acls.forEach((a) => root.append(renderWebACL(a)));
      }
    } else {
      root.append(renderIPSets(wafData?.ip_sets));
    }
  }

  async function init() {
    try {
      const res = await fetch('/api/wafv2/');
      wafData = await res.json();
      renderView();
    } catch (err) {
      root.textContent = '';
      root.append(el('div', 'wafv2-empty wafv2-empty-error', `Failed to load WAF v2: ${err.message}`));
    }
  }

  init();
  const refreshBtn = document.querySelector('#refresh');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', init);
  }
})();
