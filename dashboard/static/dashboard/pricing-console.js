(() => {
  const root = document.querySelector('#pricing-console-root');
  if (!root) return;

  const { el, button, toast, statusIndicator, kvGrid } = window.ServiceConsole || {};

  let selectedService = 'ec2';
  let ec2Type = 't3.medium';
  let ec2Count = 2;
  let s3Gb = 500;
  let lambdaMillions = 10;
  let lambdaDuration = 250;

  const RATES = {
    ec2: {
      't3.micro': 0.0104,
      't3.small': 0.0208,
      't3.medium': 0.0416,
      'c5.large': 0.0850,
      'm5.xlarge': 0.1920,
      'g5.xlarge': 1.0060,
    },
    s3: {
      storageGb: 0.023,
      putK: 0.005,
      getK: 0.0004,
    },
    lambda: {
      perMillionReq: 0.20,
      perGbSecond: 0.0000166667,
    },
    rds: {
      'db.t3.micro': 0.017,
      'db.t3.medium': 0.068,
      'db.m5.large': 0.178,
    },
  };

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

  function calculateCost() {
    if (selectedService === 'ec2') {
      const hourly = (RATES.ec2[ec2Type] || 0.0416) * ec2Count;
      const monthly = hourly * 730;
      return { hourly, monthly, label: `${ec2Count}x ${ec2Type} Linux on-demand instance(s)` };
    }
    if (selectedService === 's3') {
      const monthly = s3Gb * RATES.s3.storageGb;
      const hourly = monthly / 730;
      return { hourly, monthly, label: `${s3Gb} GB S3 Standard Storage` };
    }
    if (selectedService === 'lambda') {
      // 512MB default = 0.5GB
      const gbSeconds = lambdaMillions * 1000000 * (lambdaDuration / 1000) * 0.5;
      const computeCost = gbSeconds * RATES.lambda.perGbSecond;
      const requestCost = lambdaMillions * RATES.lambda.perMillionReq;
      const monthly = computeCost + requestCost;
      const hourly = monthly / 730;
      return { hourly, monthly, label: `${lambdaMillions}M reqs @ ${lambdaDuration}ms (512MB RAM)` };
    }
    // RDS default
    const hourly = RATES.rds['db.t3.medium'];
    return { hourly, monthly: hourly * 730, label: 'Single-AZ db.t3.medium PostgreSQL' };
  }

  function renderCalculator() {
    const card = el('div', 'pricing-calculator-card');
    card.append(el('h3', null, 'AWS Pricing Calculator Simulator (Local Cost Modeler)'));
    card.append(el('p', 'pricing-meta', 'Estimate infrastructure spend before provisioning real cloud resources:'));

    const grid = el('div', 'pricing-calc-grid');

    // Service selector
    const sField = el('div', 'pricing-calc-field');
    sField.append(el('label', null, 'AWS Service'));
    const sSelect = el('select', null);
    sSelect.innerHTML = `
      <option value="ec2" ${selectedService === 'ec2' ? 'selected' : ''}>Amazon EC2 (Compute)</option>
      <option value="s3" ${selectedService === 's3' ? 'selected' : ''}>Amazon S3 (Storage)</option>
      <option value="lambda" ${selectedService === 'lambda' ? 'selected' : ''}>AWS Lambda (Serverless)</option>
      <option value="rds" ${selectedService === 'rds' ? 'selected' : ''}>Amazon RDS (Database)</option>
    `;
    sSelect.addEventListener('change', (e) => {
      selectedService = e.target.value;
      render();
    });
    sField.append(sSelect);
    grid.append(sField);

    if (selectedService === 'ec2') {
      // Type
      const tField = el('div', 'pricing-calc-field');
      tField.append(el('label', null, 'Instance Type'));
      const tSelect = el('select', null);
      Object.keys(RATES.ec2).forEach((type) => {
        const opt = el('option', null, `${type} ($${RATES.ec2[type]}/hr)`);
        opt.value = type;
        if (type === ec2Type) opt.selected = true;
        tSelect.append(opt);
      });
      tSelect.addEventListener('change', (e) => {
        ec2Type = e.target.value;
        render();
      });
      tField.append(tSelect);

      // Count
      const cField = el('div', 'pricing-calc-field');
      cField.append(el('label', null, 'Instance Count'));
      const cInput = el('input', null);
      cInput.type = 'number';
      cInput.min = '1';
      cInput.max = '100';
      cInput.value = ec2Count;
      cInput.addEventListener('input', (e) => {
        ec2Count = parseInt(e.target.value, 10) || 1;
        render();
      });
      cField.append(cInput);

      grid.append(tField, cField);
    } else if (selectedService === 's3') {
      const gbField = el('div', 'pricing-calc-field');
      gbField.append(el('label', null, 'Storage Capacity (GB / mo)'));
      const gbInput = el('input', null);
      gbInput.type = 'number';
      gbInput.min = '1';
      gbInput.value = s3Gb;
      gbInput.addEventListener('input', (e) => {
        s3Gb = parseInt(e.target.value, 10) || 0;
        render();
      });
      gbField.append(gbInput);
      grid.append(gbField);
    } else if (selectedService === 'lambda') {
      const reqField = el('div', 'pricing-calc-field');
      reqField.append(el('label', null, 'Monthly Invocations (Millions)'));
      const reqInput = el('input', null);
      reqInput.type = 'number';
      reqInput.min = '1';
      reqInput.value = lambdaMillions;
      reqInput.addEventListener('input', (e) => {
        lambdaMillions = parseFloat(e.target.value) || 0;
        render();
      });
      reqField.append(reqInput);

      const durField = el('div', 'pricing-calc-field');
      durField.append(el('label', null, 'Avg Execution Duration (ms)'));
      const durInput = el('input', null);
      durInput.type = 'number';
      durInput.min = '10';
      durInput.value = lambdaDuration;
      durInput.addEventListener('input', (e) => {
        lambdaDuration = parseInt(e.target.value, 10) || 100;
        render();
      });
      durField.append(durInput);

      grid.append(reqField, durField);
    }

    card.append(grid);

    // Total estimate display
    const { hourly, monthly, label } = calculateCost();
    const estPanel = el('div', 'pricing-estimate-panel');
    
    const totalWrap = el('div', 'pricing-estimate-total');
    totalWrap.append(
      el('span', 'pricing-estimate-total-label', 'Estimated Monthly Spend'),
      el('span', 'pricing-estimate-total-val', `$${monthly.toFixed(2)} / month`),
      el('span', 'pricing-meta', `($${hourly.toFixed(4)} / hour) • ${label}`)
    );

    estPanel.append(totalWrap);
    card.append(estPanel);

    // SDK CLI query copier
    const cliCmd = `aws pricing get-products --service-code ${selectedService === 'ec2' ? 'AmazonEC2' : selectedService === 's3' ? 'AmazonS3' : 'AWSLambda'} --region us-east-1`;
    const cliBox = el('div', 'pricing-sdk-cmd');
    cliBox.append(el('code', null, cliCmd));
    cliBox.append(button('Copy CLI Query', 'secondary-button', () => {
      copyToClipboard(cliCmd, 'AWS CLI pricing query command copied!');
    }));
    card.append(cliBox);

    return card;
  }

  function renderRateCatalog() {
    const wrap = el('div', 'pricing-panel');
    wrap.append(el('div', 'pricing-panel-heading', 'Reference Pricing Catalog (us-east-1 Standard Rates)'));

    const sampleRates = [
      { service: 'Amazon EC2', type: 't3.micro (2 vCPU, 1 GiB RAM)', rate: '$0.0104 / hour ($7.59 / mo)' },
      { service: 'Amazon EC2', type: 't3.medium (2 vCPU, 4 GiB RAM)', rate: '$0.0416 / hour ($30.37 / mo)' },
      { service: 'Amazon S3', type: 'S3 Standard Storage', rate: '$0.023 / GB / month' },
      { service: 'AWS Lambda', type: 'Compute (512MB RAM)', rate: '$0.00000833 / second ($0.20 / M req)' },
      { service: 'Amazon RDS', type: 'db.t3.medium (PostgreSQL)', rate: '$0.068 / hour ($49.64 / mo)' },
    ];

    sampleRates.forEach((r) => {
      const row = el('div', 'pricing-item');
      row.append(kvGrid([
        { label: 'Service', value: r.service },
        { label: 'Resource / Tier', value: r.type },
        { label: 'Rate (USD)', value: r.rate },
      ]));
      wrap.append(row);
    });

    return wrap;
  }

  function render() {
    root.textContent = '';
    root.append(renderCalculator(), renderRateCatalog());
  }

  render();
  const refreshBtn = document.querySelector('#refresh');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      render();
      toast('Pricing catalog refreshed!');
    });
  }
})();
