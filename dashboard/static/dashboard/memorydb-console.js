(() => {
  const root = document.querySelector('#memorydb-console-root');
  if (!root) return;

  const { el, button, toast, statusIndicator, kvGrid } = window.ServiceConsole || {};

  let activeTab = 'clusters';
  let memoryData = null;

  function copyToClipboard(text, msg = 'Copied to clipboard!') {
    navigator.clipboard.writeText(text).then(() => {
      toast(msg);
    }).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.append(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      toast(msg);
    });
  }

  function renderCluster(cluster) {
    const card = el('article', 'memorydb-panel');
    const header = el('div', 'memorydb-panel-heading');
    header.append(
      el('span', null, `Cluster: ${cluster.Name || 'Unnamed'}`),
      statusIndicator(cluster.Status || 'available')
    );
    card.append(header);

    const endpoint = cluster.ClusterEndpoint?.Address || `${(cluster.Name || 'floci-cluster').toLowerCase()}.memorydb.localhost.floci.io`;
    const port = cluster.ClusterEndpoint?.Port || 6379;
    const redisCmd = `redis-cli -h ${endpoint} -p ${port} --tls -a <auth-token>`;

    card.append(kvGrid([
      { label: 'Cluster Name', value: cluster.Name },
      { label: 'Status', value: cluster.Status || 'available', isStatus: true },
      { label: 'Node Type', value: cluster.NodeType || 'db.r6g.large' },
      { label: 'Shards', value: `${cluster.NumberOfShards || 1} shard(s)` },
      { label: 'Engine Version', value: cluster.EngineVersion || '7.0' },
      { label: 'TLS Enabled', value: cluster.TLSEnabled !== false ? 'Yes' : 'No' },
      { label: 'ACL Name', value: cluster.ACLName || 'open-access' },
      { label: 'Endpoint', value: `${endpoint}:${port}` },
    ]));

    // Connection strip
    const connStrip = el('div', 'memorydb-connection-strip');
    connStrip.append(el('strong', null, 'Connect with Redis CLI (TLS)'));
    const codeBox = el('div', 'memorydb-connection-code');
    codeBox.append(el('code', null, redisCmd));
    codeBox.append(button('Copy Command', 'secondary-button', () => {
      copyToClipboard(redisCmd, 'Redis connection command copied!');
    }));
    connStrip.append(codeBox);
    card.append(connStrip);

    return card;
  }

  function renderUsersAndACLs(users = [], acls = []) {
    const wrap = el('div', 'memorydb-panel-wrap');

    // ACLs
    const aclPanel = el('div', 'memorydb-panel');
    aclPanel.append(el('div', 'memorydb-panel-heading', `Access Control Lists (${acls.length || 1})`));
    const effectiveAcls = acls.length ? acls : [{ Name: 'open-access', Status: 'active', UserNames: ['default', 'admin'], Clusters: ['floci-memorydb-cluster'] }];
    effectiveAcls.forEach((acl) => {
      const row = el('div', 'memorydb-user-card');
      row.append(kvGrid([
        { label: 'ACL Name', value: acl.Name },
        { label: 'Status', value: acl.Status || 'active', isStatus: true },
        { label: 'Users', value: (acl.UserNames || []).join(', ') || 'default' },
        { label: 'Associated Clusters', value: (acl.Clusters || []).join(', ') || 'None' },
      ]));
      aclPanel.append(row);
    });
    wrap.append(aclPanel);

    // Users
    const userPanel = el('div', 'memorydb-panel');
    userPanel.append(el('div', 'memorydb-panel-heading', `Users (${users.length || 2})`));
    const effectiveUsers = users.length ? users : [
      { Name: 'default', Status: 'active', AccessString: 'on ~* +@all', Authentication: { Type: 'password' } },
      { Name: 'readonly-app', Status: 'active', AccessString: 'on ~cache:* +@read', Authentication: { Type: 'password' } },
    ];
    effectiveUsers.forEach((u) => {
      const row = el('div', 'memorydb-user-card');
      row.append(kvGrid([
        { label: 'Username', value: u.Name },
        { label: 'Status', value: u.Status || 'active', isStatus: true },
        { label: 'Access String', value: u.AccessString || 'on ~* +@all' },
        { label: 'Auth Type', value: u.Authentication?.Type || 'password' },
      ]));
      userPanel.append(row);
    });
    wrap.append(userPanel);

    return wrap;
  }

  function renderView() {
    root.textContent = '';

    // Tabs
    const tabs = el('div', 'memorydb-tabs');
    const clusterTab = el('button', `memorydb-tab ${activeTab === 'clusters' ? 'memorydb-tab-active' : ''}`, 'Clusters');
    const userTab = el('button', `memorydb-tab ${activeTab === 'users' ? 'memorydb-tab-active' : ''}`, 'Users & ACLs');
    
    clusterTab.addEventListener('click', () => { activeTab = 'clusters'; renderView(); });
    userTab.addEventListener('click', () => { activeTab = 'users'; renderView(); });
    tabs.append(clusterTab, userTab);
    root.append(tabs);

    if (activeTab === 'clusters') {
      const clusters = memoryData?.clusters || [];
      if (!clusters.length) {
        root.append(renderCluster({
          Name: 'floci-memorydb-cluster',
          Status: 'available',
          NodeType: 'db.r6g.large',
          NumberOfShards: 2,
          EngineVersion: '7.0',
          TLSEnabled: true,
          ACLName: 'open-access',
          ClusterEndpoint: { Address: 'clustercfg.floci-memorydb.localhost.floci.io', Port: 6379 },
        }));
      } else {
        clusters.forEach((c) => root.append(renderCluster(c)));
      }
    } else {
      root.append(renderUsersAndACLs(memoryData?.users, memoryData?.acls));
    }
  }

  async function init() {
    try {
      const res = await fetch('/api/memorydb/');
      memoryData = await res.json();
      renderView();
    } catch (err) {
      root.textContent = '';
      root.append(el('div', 'memorydb-empty memorydb-empty-error', `Failed to load MemoryDB: ${err.message}`));
    }
  }

  init();
  const refreshBtn = document.querySelector('#refresh');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', init);
  }
})();
