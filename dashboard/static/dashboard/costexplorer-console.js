(() => {
  const root = document.querySelector('#costexplorer-console-root');
  if (!root) return;

  const { el, button, toast, statusIndicator, kvGrid } = window.ServiceConsole || {};

  let selectedPeriod = '7';
  let selectedGrouping = 'SERVICE';

  const mockDays = [
    { label: 'Aug 17', ec2: 18.2, s3: 4.5, rds: 8.0, lambda: 2.1, bedrock: 6.4 },
    { label: 'Aug 18', ec2: 19.0, s3: 4.6, rds: 8.0, lambda: 3.2, bedrock: 8.5 },
    { label: 'Aug 19', ec2: 18.5, s3: 4.8, rds: 8.0, lambda: 2.8, bedrock: 7.2 },
    { label: 'Aug 20', ec2: 21.4, s3: 5.0, rds: 8.0, lambda: 4.1, bedrock: 14.8 }, // spike
    { label: 'Aug 21', ec2: 19.8, s3: 5.1, rds: 8.0, lambda: 3.5, bedrock: 9.4 },
    { label: 'Aug 22', ec2: 18.9, s3: 5.2, rds: 8.0, lambda: 3.0, bedrock: 8.1 },
    { label: 'Aug 23', ec2: 19.2, s3: 5.3, rds: 8.0, lambda: 2.9, bedrock: 7.8 },
  ];

  function renderMetrics() {
    const grid = el('div', 'costexplorer-metric-grid');

    const m1 = el('div', 'costexplorer-metric-card');
    m1.append(
      el('span', 'costexplorer-metric-label', 'Month-to-Date Spend'),
      el('span', 'costexplorer-metric-value', '$248.60'),
      el('span', 'costexplorer-metric-trend costexplorer-trend-up', '▲ +4.2% vs last month')
    );

    const m2 = el('div', 'costexplorer-metric-card');
    m2.append(
      el('span', 'costexplorer-metric-label', 'Forecasted Month-End Spend'),
      el('span', 'costexplorer-metric-value', '$384.20'),
      el('span', 'costexplorer-metric-trend costexplorer-trend-up', 'Estimated based on 23 days')
    );

    const m3 = el('div', 'costexplorer-metric-card');
    m3.append(
      el('span', 'costexplorer-metric-label', 'Top Cost Contributor'),
      el('span', 'costexplorer-metric-value', 'Amazon EC2'),
      el('span', 'costexplorer-metric-trend', '$135.00 (54.3% of total)')
    );

    const m4 = el('div', 'costexplorer-metric-card');
    m4.append(
      el('span', 'costexplorer-metric-label', 'Daily Burn Rate'),
      el('span', 'costexplorer-metric-value', '$12.80 / day'),
      el('span', 'costexplorer-metric-trend costexplorer-trend-down', '▼ -2.1% past 3 days')
    );

    grid.append(m1, m2, m3, m4);
    return grid;
  }

  function renderChart() {
    const container = el('div', 'costexplorer-chart-container');
    const header = el('div', 'costexplorer-chart-header');
    header.append(el('h3', null, 'Daily Cost & Usage Breakdown ($ USD)'));

    const controls = el('div', 'costexplorer-chart-controls');
    
    // Period select
    const periodSelect = el('select', 'costexplorer-chart-select');
    periodSelect.innerHTML = '<option value="7">Last 7 Days</option><option value="14">Last 14 Days</option><option value="30">Last 30 Days</option>';
    periodSelect.value = selectedPeriod;
    periodSelect.addEventListener('change', (e) => {
      selectedPeriod = e.target.value;
      render();
    });

    // Grouping select
    const groupSelect = el('select', 'costexplorer-chart-select');
    groupSelect.innerHTML = '<option value="SERVICE">Group by: Service</option><option value="REGION">Group by: Region</option>';
    groupSelect.value = selectedGrouping;
    groupSelect.addEventListener('change', (e) => {
      selectedGrouping = e.target.value;
      render();
    });

    controls.append(periodSelect, groupSelect);
    header.append(controls);
    container.append(header);

    // Bars
    const barsWrap = el('div', 'costexplorer-chart-bars');
    const maxDayTotal = 60; // scale factor

    mockDays.forEach((day) => {
      const dayTotal = day.ec2 + day.s3 + day.rds + day.lambda + day.bedrock;
      const col = el('div', 'costexplorer-bar-col');
      col.append(el('span', 'costexplorer-bar-cost', `$${dayTotal.toFixed(1)}`));

      const stack = el('div', 'costexplorer-bar-stack');
      stack.style.height = `${Math.min(180, (dayTotal / maxDayTotal) * 180)}px`;

      const sBedrock = el('div', 'costexplorer-bar-segment costexplorer-seg-bedrock');
      sBedrock.style.height = `${(day.bedrock / dayTotal) * 100}%`;
      sBedrock.title = `Bedrock: $${day.bedrock.toFixed(2)}`;

      const sLambda = el('div', 'costexplorer-bar-segment costexplorer-seg-lambda');
      sLambda.style.height = `${(day.lambda / dayTotal) * 100}%`;
      sLambda.title = `Lambda: $${day.lambda.toFixed(2)}`;

      const sRds = el('div', 'costexplorer-bar-segment costexplorer-seg-rds');
      sRds.style.height = `${(day.rds / dayTotal) * 100}%`;
      sRds.title = `RDS: $${day.rds.toFixed(2)}`;

      const sS3 = el('div', 'costexplorer-bar-segment costexplorer-seg-s3');
      sS3.style.height = `${(day.s3 / dayTotal) * 100}%`;
      sS3.title = `S3: $${day.s3.toFixed(2)}`;

      const sEc2 = el('div', 'costexplorer-bar-segment costexplorer-seg-ec2');
      sEc2.style.height = `${(day.ec2 / dayTotal) * 100}%`;
      sEc2.title = `EC2: $${day.ec2.toFixed(2)}`;

      stack.append(sEc2, sS3, sRds, sLambda, sBedrock);
      col.append(stack, el('span', 'costexplorer-bar-label', day.label));
      barsWrap.append(col);
    });

    container.append(barsWrap);

    // Legend
    const legend = el('div', 'costexplorer-legend');
    const items = [
      { label: 'Amazon EC2', color: '#0972d3' },
      { label: 'Amazon S3', color: '#037f0c' },
      { label: 'Amazon RDS', color: '#8a6d00' },
      { label: 'AWS Lambda', color: '#ec7211' },
      { label: 'Amazon Bedrock', color: '#7d3ac1' },
    ];
    items.forEach((item) => {
      const legItem = el('div', 'costexplorer-legend-item');
      const box = el('div', 'costexplorer-legend-color');
      box.style.background = item.color;
      legItem.append(box, el('span', null, item.label));
      legend.append(legItem);
    });
    container.append(legend);

    return container;
  }

  function renderAnomalies() {
    const wrap = el('div', 'costexplorer-panel');
    wrap.append(el('div', 'costexplorer-panel-heading', 'Cost Anomaly Detection Alerts (Active Watchers)'));

    const alertCard = el('div', 'costexplorer-item');
    alertCard.append(kvGrid([
      { label: 'Anomaly ID', value: 'anom-2026-08-20-bedrock-01' },
      { label: 'Impact / Extra Cost', value: '+$8.40 (+142% above normal)' },
      { label: 'Root Cause Service', value: 'Amazon Bedrock (Claude 3.5 Sonnet token burst)' },
      { label: 'Status', value: 'resolved', isStatus: true },
      { label: 'Detected At', value: 'Aug 20, 2026 14:22:00' },
    ]));
    wrap.append(alertCard);
    return wrap;
  }

  function render() {
    root.textContent = '';
    root.append(renderMetrics(), renderChart(), renderAnomalies());
  }

  render();
  const refreshBtn = document.querySelector('#refresh');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      render();
      toast('Cost Explorer metrics refreshed!');
    });
  }
})();
