(() => {
  const root = document.querySelector('#docdb-console-root');
  if (!root) return;

  const { el, button, toast, formatDate, statusIndicator, kvGrid } = window.ServiceConsole || {};

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

  function renderClusterCard(cluster) {
    const card = el('article', 'docdb-panel docdb-cluster-card');
    const header = el('div', 'docdb-panel-heading');
    const title = el('span', null, `Cluster: ${cluster.DBClusterIdentifier || 'Unnamed'}`);
    const status = statusIndicator(cluster.Status || 'available');
    header.append(title, status);
    card.append(header);

    const endpoint = cluster.Endpoint || 'localhost';
    const port = cluster.Port || 27017;
    const user = cluster.MasterUsername || 'root';
    const connUri = `mongodb://${user}:password@${endpoint}:${port}/?tls=true&replicaSet=rs0&readPreference=secondaryPreferred`;

    const attributes = [
      { label: 'Cluster Identifier', value: cluster.DBClusterIdentifier },
      { label: 'Engine & Version', value: `${cluster.Engine || 'docdb'} ${cluster.EngineVersion || '5.0.0'}` },
      { label: 'Status', value: cluster.Status || 'available', isStatus: true },
      { label: 'Endpoint', value: `${endpoint}:${port}` },
      { label: 'Master Username', value: user },
      { label: 'Subnet Group', value: cluster.DBSubnetGroup || 'default' },
      { label: 'Members', value: (cluster.DBClusterMembers || []).length ? `${cluster.DBClusterMembers.length} instances` : '0 instances' },
      { label: 'Availability Zones', value: (cluster.AvailabilityZones || ['us-east-1a', 'us-east-1b']).join(', ') },
    ];
    card.append(kvGrid(attributes));

    // Connection string copier section
    const connStrip = el('div', 'docdb-connection-strip');
    const stripHeader = el('div', 'docdb-connection-header');
    stripHeader.append(el('strong', null, 'Connection URI (MongoDB Compatible)'));
    
    const codeBox = el('div', 'docdb-connection-code');
    const code = el('code', null, connUri);
    const copyBtn = button('Copy URI', 'secondary-button docdb-copy-btn', () => {
      copyToClipboard(connUri, 'MongoDB connection URI copied!');
    });
    codeBox.append(code, copyBtn);
    connStrip.append(stripHeader, codeBox);
    card.append(connStrip);

    return card;
  }

  async function init() {
    root.textContent = '';
    const loading = el('div', 'docdb-empty', 'Loading DocumentDB clusters...');
    root.append(loading);

    try {
      const res = await fetch('/api/docdb/');
      const data = await res.json();
      root.textContent = '';

      const clusters = data.clusters || [];
      const instances = data.instances || [];

      if (!clusters.length) {
        // Sample local emulator cluster card
        const sampleCluster = {
          DBClusterIdentifier: 'floci-docdb-cluster',
          Status: 'available',
          Engine: 'docdb',
          EngineVersion: '5.0.0',
          Endpoint: 'docdb.localhost.floci.io',
          Port: 27017,
          MasterUsername: 'admin',
          DBSubnetGroup: 'default-vpc-subnets',
          AvailabilityZones: ['us-east-1a', 'us-east-1b', 'us-east-1c'],
          DBClusterMembers: [{ DBInstanceIdentifier: 'floci-docdb-instance-1', IsClusterWriter: true }],
        };
        root.append(renderClusterCard(sampleCluster));
      } else {
        clusters.forEach((c) => root.append(renderClusterCard(c)));
      }

      // Instances panel
      if (instances.length) {
        const instPanel = el('div', 'docdb-panel');
        instPanel.append(el('div', 'docdb-panel-heading', `DB Instances (${instances.length})`));
        instances.forEach((inst) => {
          const instCard = el('div', 'docdb-instance-card');
          instCard.append(kvGrid([
            { label: 'Instance Identifier', value: inst.DBInstanceIdentifier },
            { label: 'Class', value: inst.DBInstanceClass || 'db.t3.medium' },
            { label: 'Status', value: inst.DBInstanceStatus || 'available', isStatus: true },
            { label: 'Cluster', value: inst.DBClusterIdentifier || 'floci-docdb-cluster' },
          ]));
          instPanel.append(instCard);
        });
        root.append(instPanel);
      }
    } catch (err) {
      root.textContent = '';
      root.append(el('div', 'docdb-empty docdb-empty-error', `Failed to load DocumentDB: ${err.message}`));
    }
  }

  init();
  const refreshBtn = document.querySelector('#refresh');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', init);
  }
})();
