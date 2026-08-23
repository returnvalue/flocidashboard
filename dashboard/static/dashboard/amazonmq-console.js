(() => {
  const root = document.querySelector('#amazonmq-console-root');
  if (!root) return;

  const { el, button, toast, statusIndicator, kvGrid } = window.ServiceConsole || {};

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

  function renderBroker(broker) {
    const card = el('article', 'amazonmq-panel');
    const header = el('div', 'amazonmq-panel-heading');
    header.append(
      el('span', null, `Broker: ${broker.BrokerName || broker.BrokerId || 'Unnamed'}`),
      statusIndicator(broker.BrokerState || 'RUNNING')
    );
    card.append(header);

    const name = (broker.BrokerName || 'floci-mq-broker').toLowerCase();
    const host = `${name}.mq.localhost.floci.io`;

    card.append(kvGrid([
      { label: 'Broker ID', value: broker.BrokerId || 'b-12345678-abcd' },
      { label: 'Broker Name', value: broker.BrokerName || 'floci-mq-broker' },
      { label: 'Broker State', value: broker.BrokerState || 'RUNNING', isStatus: true },
      { label: 'Engine Type & Version', value: `${broker.EngineType || 'RabbitMQ'} ${broker.EngineVersion || '3.11.20'}` },
      { label: 'Host Instance Type', value: broker.HostInstanceType || 'mq.t3.micro' },
      { label: 'Deployment Mode', value: broker.DeploymentMode || 'SINGLE_INSTANCE' },
    ]));

    // Multi-protocol endpoints
    const endpointsWrap = el('div', 'amazonmq-connection-strip');
    endpointsWrap.append(el('strong', null, 'Protocol Endpoints'));

    const protocols = [
      { label: 'AMQP 0-9-1 (SSL)', url: `amqps://${host}:5671` },
      { label: 'MQTT (SSL)', url: `mqtts://${host}:8883` },
      { label: 'STOMP (SSL)', url: `stomps://${host}:61614` },
      { label: 'Web Management Console', url: `https://${host}:15672` },
    ];

    const grid = el('div', 'amazonmq-endpoint-grid');
    protocols.forEach((p) => {
      const epCard = el('div', 'amazonmq-endpoint-card');
      epCard.append(el('span', 'amazonmq-endpoint-label', p.label));
      const urlRow = el('div', 'amazonmq-endpoint-url');
      urlRow.append(el('code', null, p.url));
      urlRow.append(button('Copy', 'secondary-button', () => {
        copyToClipboard(p.url, `${p.label} endpoint copied!`);
      }));
      epCard.append(urlRow);
      grid.append(epCard);
    });

    endpointsWrap.append(grid);
    card.append(endpointsWrap);

    // Users
    const users = broker.Users || [{ Username: 'admin', ConsoleAccess: true, Groups: ['admin', 'developers'] }];
    const userPanel = el('div', 'amazonmq-panel');
    userPanel.append(el('div', 'amazonmq-panel-heading', `Broker Users (${users.length})`));
    users.forEach((u) => {
      const uCard = el('div', 'amazonmq-user-card');
      uCard.append(kvGrid([
        { label: 'Username', value: u.Username },
        { label: 'Console Access', value: u.ConsoleAccess ? 'Enabled' : 'Disabled' },
        { label: 'Groups', value: (u.Groups || []).join(', ') || 'None' },
      ]));
      userPanel.append(uCard);
    });
    card.append(userPanel);

    return card;
  }

  async function init() {
    root.textContent = '';
    const loading = el('div', 'amazonmq-empty', 'Loading Amazon MQ brokers...');
    root.append(loading);

    try {
      const res = await fetch('/api/amazonmq/');
      const data = await res.json();
      root.textContent = '';

      const brokers = data.brokers || [];
      if (!brokers.length) {
        root.append(renderBroker({
          BrokerId: 'b-98765432-floci',
          BrokerName: 'floci-rabbitmq-broker',
          BrokerState: 'RUNNING',
          EngineType: 'RabbitMQ',
          EngineVersion: '3.11.20',
          HostInstanceType: 'mq.t3.micro',
          DeploymentMode: 'SINGLE_INSTANCE',
          Users: [
            { Username: 'floci-admin', ConsoleAccess: true, Groups: ['admin', 'producers', 'consumers'] },
            { Username: 'app-worker', ConsoleAccess: false, Groups: ['consumers'] },
          ],
        }));
      } else {
        brokers.forEach((b) => root.append(renderBroker(b)));
      }
    } catch (err) {
      root.textContent = '';
      root.append(el('div', 'amazonmq-empty amazonmq-empty-error', `Failed to load Amazon MQ: ${err.message}`));
    }
  }

  init();
  const refreshBtn = document.querySelector('#refresh');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', init);
  }
})();
