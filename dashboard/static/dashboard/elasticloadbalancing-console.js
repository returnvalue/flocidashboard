/* global ServiceConsole */

const ElasticLoadBalancingConsole = (() => {
  const consoleUi = window.ServiceConsole;
  const root = document.getElementById('elasticloadbalancing-console-root');
  const breadcrumbsEl = document.getElementById('elasticloadbalancing-breadcrumbs');
  const summaryEl = document.getElementById('elasticloadbalancing-summary');
  const loadedAtEl = document.getElementById('elasticloadbalancing-loaded-at');

  const state = {
    inventory: null,
    selectedLoadBalancerArn: '',
    selectedTargetGroupArn: '',
    selectedListenerArn: '',
  };

  const el = consoleUi.el;
  const apiJson = consoleUi.apiJson;
  const btn = consoleUi.button;
  const toast = (message, isError = false) => consoleUi.toast(message, {
    classPrefix: 'elasticloadbalancing',
    type: isError ? 'error' : 'success',
  });
  const toolbar = (leftItems, rightItems) => consoleUi.toolbar(leftItems, rightItems, 'elasticloadbalancing');
  const openModal = (title, bodyNode, confirmLabel, onConfirm) =>
    consoleUi.openModal(title, bodyNode, confirmLabel, onConfirm, {
      classPrefix: 'elasticloadbalancing',
      toast,
    });

  function loadBalancers() {
    return state.inventory?.v2_load_balancers || [];
  }

  function targetGroups() {
    return state.inventory?.target_groups || [];
  }

  function listeners() {
    return state.inventory?.listeners || [];
  }

  function rules() {
    return state.inventory?.rules || [];
  }

  function targetHealthSets() {
    return state.inventory?.target_health || state.inventory?.target_health_sets || [];
  }

  function selectedLoadBalancer() {
    return loadBalancers().find((item) => item.arn === state.selectedLoadBalancerArn) || loadBalancers()[0] || null;
  }

  function selectedTargetGroup() {
    return targetGroups().find((item) => item.arn === state.selectedTargetGroupArn) || targetGroups()[0] || null;
  }

  function selectedListener() {
    return listeners().find((item) => item.arn === state.selectedListenerArn) || listeners()[0] || null;
  }

  function enc(value) {
    return encodeURIComponent(value || '');
  }

  function parseList(value) {
    return String(value || '').trim().split(/[\n,]+/).map((item) => item.trim()).filter(Boolean);
  }

  function parseTargets(value) {
    return parseList(value).map((item) => {
      const [id, port] = item.split(':');
      const target = { Id: id.trim() };
      if (port) {
        target.Port = Number(port);
      }
      return target;
    });
  }

  function parseTags(value) {
    const trimmed = String(value || '').trim();
    if (!trimmed) {
      return {};
    }
    return JSON.parse(trimmed);
  }

  function renderSummary(summary) {
    consoleUi.renderSummary(summary, summaryEl, {
      serviceKey: 'elasticloadbalancing',
      targets: {
        v2_load_balancers: 'Load balancers',
        target_groups: 'Target groups',
        listeners: 'Listeners and rules',
        rules: 'Listeners and rules',
        target_health_sets: 'Target health',
      },
    });
  }

  function renderBreadcrumbs() {
    if (!breadcrumbsEl) {
      return;
    }
    breadcrumbsEl.textContent = '';
    const home = btn('ELB v2', null, () => {
      state.selectedLoadBalancerArn = '';
      state.selectedTargetGroupArn = '';
      state.selectedListenerArn = '';
      render();
    });
    breadcrumbsEl.append(home);
    const lb = selectedLoadBalancer();
    if (lb) {
      breadcrumbsEl.append(el('span', null, '/'), el('span', null, lb.name || 'Load balancer'));
    }
  }

  function option(select, value, label, selected = false) {
    const node = document.createElement('option');
    node.value = value || '';
    node.textContent = label || value || '';
    node.selected = selected;
    select.append(node);
  }

  function resourceSelect(items, selectedValue, emptyLabel) {
    const select = document.createElement('select');
    if (!items.length) {
      option(select, '', emptyLabel);
      return select;
    }
    items.forEach((item) => option(select, item.arn, item.name || item.arn, item.arn === selectedValue));
    return select;
  }

  function showCreateLoadBalancerModal() {
    const form = el('div');
    const nameInput = document.createElement('input');
    nameInput.placeholder = 'my-alb';
    const typeInput = document.createElement('select');
    option(typeInput, 'application', 'application', true);
    option(typeInput, 'network', 'network');
    const schemeInput = document.createElement('select');
    option(schemeInput, 'internet-facing', 'internet-facing', true);
    option(schemeInput, 'internal', 'internal');
    const subnetsInput = document.createElement('textarea');
    subnetsInput.placeholder = 'subnet-a, subnet-b';
    const securityGroupsInput = document.createElement('textarea');
    securityGroupsInput.placeholder = 'sg-default';
    const ipInput = document.createElement('input');
    ipInput.placeholder = 'ipv4';
    form.append(
      el('label', null, 'Load balancer name'),
      nameInput,
      el('label', null, 'Type'),
      typeInput,
      el('label', null, 'Scheme'),
      schemeInput,
      el('label', null, 'Subnets'),
      subnetsInput,
      el('label', null, 'Security groups'),
      securityGroupsInput,
      el('label', null, 'IP address type'),
      ipInput,
    );
    openModal('Create load balancer', form, 'Create', async (close) => {
      await apiJson('/api/elasticloadbalancing/load-balancers/', {
        method: 'POST',
        body: JSON.stringify({
          name: nameInput.value.trim(),
          type: typeInput.value,
          scheme: schemeInput.value,
          subnets: parseList(subnetsInput.value),
          security_groups: parseList(securityGroupsInput.value),
          ip_address_type: ipInput.value.trim(),
        }),
      });
      close();
      toast('Load balancer created');
      await refresh();
    });
  }

  function showCreateTargetGroupModal() {
    const form = el('div');
    const nameInput = document.createElement('input');
    nameInput.placeholder = 'my-targets';
    const protocolInput = document.createElement('select');
    ['HTTP', 'HTTPS', 'TCP', 'TLS', 'UDP', 'TCP_UDP'].forEach((value) => option(protocolInput, value, value, value === 'HTTP'));
    const portInput = document.createElement('input');
    portInput.type = 'number';
    portInput.value = '80';
    const typeInput = document.createElement('select');
    ['instance', 'ip', 'lambda'].forEach((value) => option(typeInput, value, value, value === 'instance'));
    const vpcInput = document.createElement('input');
    vpcInput.placeholder = 'optional VPC ID';
    const healthInput = document.createElement('input');
    healthInput.placeholder = '/health';
    form.append(
      el('label', null, 'Target group name'),
      nameInput,
      el('label', null, 'Protocol'),
      protocolInput,
      el('label', null, 'Port'),
      portInput,
      el('label', null, 'Target type'),
      typeInput,
      el('label', null, 'VPC ID'),
      vpcInput,
      el('label', null, 'Health check path'),
      healthInput,
    );
    openModal('Create target group', form, 'Create', async (close) => {
      await apiJson('/api/elasticloadbalancing/target-groups/', {
        method: 'POST',
        body: JSON.stringify({
          name: nameInput.value.trim(),
          protocol: protocolInput.value,
          port: Number(portInput.value || 80),
          target_type: typeInput.value,
          vpc_id: vpcInput.value.trim(),
          health_check_path: healthInput.value.trim(),
        }),
      });
      close();
      toast('Target group created');
      await refresh();
    });
  }

  function showTargetsModal(deregister = false) {
    const targetGroup = selectedTargetGroup();
    const form = el('div');
    const groupSelect = resourceSelect(targetGroups(), targetGroup?.arn || '', 'Create a target group first');
    const targetsInput = document.createElement('textarea');
    targetsInput.placeholder = 'i-00000000001:8080';
    form.append(el('label', null, 'Target group'), groupSelect, el('label', null, 'Targets'), targetsInput);
    openModal(deregister ? 'Deregister targets' : 'Register targets', form, deregister ? 'Deregister' : 'Register', async (close) => {
      await apiJson(`/api/elasticloadbalancing/target-groups/${enc(groupSelect.value)}/targets/`, {
        method: deregister ? 'DELETE' : 'POST',
        body: JSON.stringify({ targets: parseTargets(targetsInput.value) }),
      });
      close();
      toast(deregister ? 'Targets deregistered' : 'Targets registered');
      state.selectedTargetGroupArn = groupSelect.value;
      await refresh();
    });
  }

  function showCreateListenerModal() {
    const lb = selectedLoadBalancer();
    const tg = selectedTargetGroup();
    const form = el('div');
    const lbSelect = resourceSelect(loadBalancers(), lb?.arn || '', 'Create a load balancer first');
    const protocolInput = document.createElement('select');
    ['HTTP', 'HTTPS', 'TCP', 'TLS'].forEach((value) => option(protocolInput, value, value, value === 'HTTP'));
    const portInput = document.createElement('input');
    portInput.type = 'number';
    portInput.value = '80';
    const tgSelect = resourceSelect(targetGroups(), tg?.arn || '', 'Create a target group first');
    form.append(
      el('label', null, 'Load balancer'),
      lbSelect,
      el('label', null, 'Protocol'),
      protocolInput,
      el('label', null, 'Port'),
      portInput,
      el('label', null, 'Default target group'),
      tgSelect,
    );
    openModal('Create listener', form, 'Create', async (close) => {
      await apiJson('/api/elasticloadbalancing/listeners/', {
        method: 'POST',
        body: JSON.stringify({
          load_balancer_arn: lbSelect.value,
          protocol: protocolInput.value,
          port: Number(portInput.value || 80),
          target_group_arn: tgSelect.value,
        }),
      });
      close();
      toast('Listener created');
      state.selectedLoadBalancerArn = lbSelect.value;
      await refresh();
    });
  }

  function showCreateRuleModal() {
    const listener = selectedListener();
    const tg = selectedTargetGroup();
    const form = el('div');
    const listenerSelect = resourceSelect(listeners(), listener?.arn || '', 'Create a listener first');
    const priorityInput = document.createElement('input');
    priorityInput.type = 'number';
    priorityInput.value = '10';
    const pathInput = document.createElement('input');
    pathInput.value = '/api/*';
    const tgSelect = resourceSelect(targetGroups(), tg?.arn || '', 'Create a target group first');
    form.append(
      el('label', null, 'Listener'),
      listenerSelect,
      el('label', null, 'Priority'),
      priorityInput,
      el('label', null, 'Path pattern'),
      pathInput,
      el('label', null, 'Forward target group'),
      tgSelect,
    );
    openModal('Create rule', form, 'Create', async (close) => {
      await apiJson('/api/elasticloadbalancing/rules/', {
        method: 'POST',
        body: JSON.stringify({
          listener_arn: listenerSelect.value,
          priority: Number(priorityInput.value || 10),
          path_pattern: pathInput.value.trim(),
          target_group_arn: tgSelect.value,
        }),
      });
      close();
      toast('Rule created');
      state.selectedListenerArn = listenerSelect.value;
      await refresh();
    });
  }

  function showTagsModal() {
    const resource = selectedLoadBalancer()?.arn || selectedTargetGroup()?.arn || '';
    const form = el('div');
    const resourceInput = document.createElement('textarea');
    resourceInput.value = resource;
    const tagsInput = document.createElement('textarea');
    tagsInput.value = '{\n  "env": "dev"\n}';
    form.append(el('label', null, 'Resource ARNs'), resourceInput, el('label', null, 'Tags JSON'), tagsInput);
    openModal('Add tags', form, 'Add', async (close) => {
      await apiJson('/api/elasticloadbalancing/tags/', {
        method: 'POST',
        body: JSON.stringify({
          resource_arns: parseList(resourceInput.value),
          tags: parseTags(tagsInput.value),
        }),
      });
      close();
      toast('Tags added');
      await refresh();
    });
  }

  function showDeleteLoadBalancerModal(lb) {
    const body = el('div');
    body.append(el('p', 'elasticloadbalancing-warning', 'Delete this load balancer?'), el('pre', 'elasticloadbalancing-code-block', lb.arn));
    openModal('Delete load balancer', body, 'Delete', async (close) => {
      await apiJson(`/api/elasticloadbalancing/load-balancers/${enc(lb.arn)}/`, { method: 'DELETE' });
      close();
      state.selectedLoadBalancerArn = '';
      toast('Load balancer deleted');
      await refresh();
    });
  }

  function showDeleteTargetGroupModal(tg) {
    const body = el('div');
    body.append(el('p', 'elasticloadbalancing-warning', 'Delete this target group? Referenced target groups are rejected by Floci.'), el('pre', 'elasticloadbalancing-code-block', tg.arn));
    openModal('Delete target group', body, 'Delete', async (close) => {
      await apiJson(`/api/elasticloadbalancing/target-groups/${enc(tg.arn)}/`, { method: 'DELETE' });
      close();
      state.selectedTargetGroupArn = '';
      toast('Target group deleted');
      await refresh();
    });
  }

  function showDeleteListenerModal(listener) {
    const body = el('div');
    body.append(el('p', 'elasticloadbalancing-warning', 'Delete this listener?'), el('pre', 'elasticloadbalancing-code-block', listener.arn));
    openModal('Delete listener', body, 'Delete', async (close) => {
      await apiJson(`/api/elasticloadbalancing/listeners/${enc(listener.arn)}/`, { method: 'DELETE' });
      close();
      state.selectedListenerArn = '';
      toast('Listener deleted');
      await refresh();
    });
  }

  function showDeleteRuleModal(rule) {
    const body = el('div');
    body.append(el('p', 'elasticloadbalancing-warning', 'Delete this listener rule? Default rules cannot be deleted.'), el('pre', 'elasticloadbalancing-code-block', rule.arn));
    openModal('Delete rule', body, 'Delete', async (close) => {
      await apiJson(`/api/elasticloadbalancing/rules/${enc(rule.arn)}/`, { method: 'DELETE' });
      close();
      toast('Rule deleted');
      await refresh();
    });
  }

  function statusClass(status) {
    return `elasticloadbalancing-status elasticloadbalancing-status-${String(status || 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  }

  function listenerLoadBalancerName(listener) {
    return listener.load_balancer_name || listener.LoadBalancerName || '';
  }

  function listenerActions(listener) {
    return listener.default_actions || listener.DefaultActions || [];
  }

  function ruleActions(rule) {
    return rule.actions || rule.Actions || [];
  }

  function ruleConditions(rule) {
    return rule.conditions || rule.Conditions || [];
  }

  function renderLoadBalancerRow(lb) {
    const active = lb.arn === selectedLoadBalancer()?.arn;
    const row = el('button', `elasticloadbalancing-resource-row${active ? ' elasticloadbalancing-resource-row-active' : ''}`);
    row.append(
      el('span', 'elasticloadbalancing-resource-name', lb.name || 'Load balancer'),
      el('span', 'elasticloadbalancing-resource-meta', `${lb.type || 'application'} / ${lb.scheme || 'internet-facing'} / ${lb.state || 'unknown'}`),
    );
    row.addEventListener('click', () => {
      state.selectedLoadBalancerArn = lb.arn;
      render();
    });
    return row;
  }

  function renderLoadBalancerList() {
    const panel = el('section', 'elasticloadbalancing-panel');
    panel.id = consoleUi.sectionIdForLabel('elasticloadbalancing', 'Load balancers');
    panel.append(el('div', 'elasticloadbalancing-panel-heading', 'Load balancers'));
    const list = el('div', 'elasticloadbalancing-resource-list');
    if (!loadBalancers().length) {
      list.append(el('div', 'elasticloadbalancing-empty', 'No ELB v2 load balancers found. Create an ALB or NLB to start.'));
    } else {
      loadBalancers().forEach((lb) => list.append(renderLoadBalancerRow(lb)));
    }
    panel.append(list);
    return panel;
  }

  function renderLoadBalancerDetail(lb) {
    const panel = el('section', 'elasticloadbalancing-panel');
    const heading = el('div', 'elasticloadbalancing-panel-heading');
    heading.append(el('span', null, lb ? lb.name : 'Load balancer detail'), lb ? el('span', statusClass(lb.state), lb.state || 'unknown') : el('span'));
    panel.append(heading);
    if (!lb) {
      panel.append(el('div', 'elasticloadbalancing-empty', 'Select or create a load balancer.'));
      return panel;
    }
    const details = document.createElement('dl');
    consoleUi.addField(details, 'ARN', lb.arn);
    consoleUi.addField(details, 'DNS name', lb.dns_name);
    consoleUi.addField(details, 'Type', lb.type);
    consoleUi.addField(details, 'Scheme', lb.scheme);
    consoleUi.addField(details, 'IP address type', lb.ip_address_type);
    consoleUi.addField(details, 'Security groups', lb.security_groups || []);
    consoleUi.addField(details, 'Availability zones', lb.availability_zones || []);
    consoleUi.addField(details, 'Attributes', lb.attributes || []);
    consoleUi.addField(details, 'Tags', lb.tags || []);
    panel.append(details);
    return panel;
  }

  function renderTargetGroups() {
    const panel = el('section', 'elasticloadbalancing-panel');
    panel.id = consoleUi.sectionIdForLabel('elasticloadbalancing', 'Target groups');
    panel.append(el('div', 'elasticloadbalancing-panel-heading', 'Target groups'));
    if (!targetGroups().length) {
      panel.append(el('div', 'elasticloadbalancing-empty elasticloadbalancing-empty-compact', 'No target groups found.'));
      return panel;
    }
    const list = el('div', 'elasticloadbalancing-card-list');
    targetGroups().forEach((tg) => {
      const active = tg.arn === selectedTargetGroup()?.arn;
      const card = el('article', `elasticloadbalancing-card${active ? ' elasticloadbalancing-card-active' : ''}`);
      card.append(
        el('strong', null, tg.name || 'Target group'),
        el('span', 'elasticloadbalancing-resource-meta', `${tg.protocol || ''}:${tg.port || ''} / ${tg.target_type || 'instance'}`),
        el('span', 'elasticloadbalancing-resource-meta', tg.arn || ''),
      );
      const actions = el('div', 'elasticloadbalancing-inline-actions');
      actions.append(btn('Select', null, () => {
        state.selectedTargetGroupArn = tg.arn;
        render();
      }), btn('Delete', 'elasticloadbalancing-btn-danger', () => showDeleteTargetGroupModal(tg)));
      card.append(actions);
      list.append(card);
    });
    panel.append(list);
    return panel;
  }

  function renderListenersAndRules() {
    const panel = el('section', 'elasticloadbalancing-panel');
    panel.id = consoleUi.sectionIdForLabel('elasticloadbalancing', 'Listeners and rules');
    panel.append(el('div', 'elasticloadbalancing-panel-heading', 'Listeners and rules'));
    if (!listeners().length) {
      panel.append(el('div', 'elasticloadbalancing-empty elasticloadbalancing-empty-compact', 'No listeners found.'));
      return panel;
    }
    const list = el('div', 'elasticloadbalancing-card-list');
    listeners().forEach((listener) => {
      const listenerRules = rules().filter((rule) => rule.listener_arn === listener.arn || rule.ListenerArn === listener.arn);
      const card = el('article', 'elasticloadbalancing-card');
      card.append(
        el('strong', null, `${listener.protocol || listener.Protocol || 'HTTP'}:${listener.port || listener.Port || ''}`),
        el('span', 'elasticloadbalancing-resource-meta', listenerLoadBalancerName(listener)),
        el('pre', 'elasticloadbalancing-code-block elasticloadbalancing-code-block-compact', consoleUi.valueText(listenerActions(listener))),
      );
      const listenerButtons = el('div', 'elasticloadbalancing-inline-actions');
      listenerButtons.append(btn('Select', null, () => {
        state.selectedListenerArn = listener.arn;
        render();
      }), btn('Delete listener', 'elasticloadbalancing-btn-danger', () => showDeleteListenerModal(listener)));
      card.append(listenerButtons);
      const rulesBlock = el('div', 'elasticloadbalancing-rule-list');
      listenerRules.forEach((rule) => {
        const ruleRow = el('div', 'elasticloadbalancing-rule-row');
        ruleRow.append(
          el('span', 'elasticloadbalancing-resource-name', rule.is_default ? 'default' : `priority ${rule.priority || rule.Priority}`),
          el('span', 'elasticloadbalancing-resource-meta', consoleUi.valueText(ruleConditions(rule))),
          el('span', 'elasticloadbalancing-resource-meta', consoleUi.valueText(ruleActions(rule))),
        );
        if (!rule.is_default && rule.arn) {
          ruleRow.append(btn('Delete rule', 'elasticloadbalancing-btn-danger', () => showDeleteRuleModal(rule)));
        }
        rulesBlock.append(ruleRow);
      });
      card.append(rulesBlock);
      list.append(card);
    });
    panel.append(list);
    return panel;
  }

  function renderTargetHealth() {
    const panel = el('section', 'elasticloadbalancing-panel');
    panel.id = consoleUi.sectionIdForLabel('elasticloadbalancing', 'Target health');
    panel.append(el('div', 'elasticloadbalancing-panel-heading', 'Target health'));
    if (!targetHealthSets().length) {
      panel.append(el('div', 'elasticloadbalancing-empty elasticloadbalancing-empty-compact', 'No registered target health records found.'));
      return panel;
    }
    const list = el('div', 'elasticloadbalancing-card-list');
    targetHealthSets().forEach((healthSet) => {
      const card = el('article', 'elasticloadbalancing-card');
      const descriptions = healthSet.target_health_descriptions || healthSet.TargetHealthDescriptions || [];
      card.append(
        el('strong', null, healthSet.target_group_name || healthSet.target_group_arn || 'Target group'),
        el('span', 'elasticloadbalancing-resource-meta', healthSet.target_group_arn || ''),
        el('pre', 'elasticloadbalancing-code-block elasticloadbalancing-code-block-compact', consoleUi.valueText(descriptions)),
      );
      list.append(card);
    });
    panel.append(list);
    return panel;
  }

  function renderWorkbench() {
    const lb = selectedLoadBalancer();
    const tg = selectedTargetGroup();
    const listener = selectedListener();
    const container = el('div');
    const registerTargetsButton = btn('Register targets', null, () => showTargetsModal(false));
    const createListenerButton = btn('Create listener', null, showCreateListenerModal);
    const createRuleButton = btn('Create rule', null, showCreateRuleModal);
    const deregisterTargetsButton = btn('Deregister targets', 'elasticloadbalancing-btn-secondary', () => showTargetsModal(true));
    const deleteListenerButton = btn('Delete listener', 'elasticloadbalancing-btn-danger', () => listener && showDeleteListenerModal(listener));
    const deleteLoadBalancerButton = btn('Delete load balancer', 'elasticloadbalancing-btn-danger', () => lb && showDeleteLoadBalancerModal(lb));
    const deleteTargetGroupButton = btn('Delete target group', 'elasticloadbalancing-btn-danger', () => tg && showDeleteTargetGroupModal(tg));
    registerTargetsButton.disabled = !tg;
    createListenerButton.disabled = !lb || !tg;
    createRuleButton.disabled = !listener || !tg;
    deregisterTargetsButton.disabled = !tg;
    deleteListenerButton.disabled = !listener;
    deleteLoadBalancerButton.disabled = !lb;
    deleteTargetGroupButton.disabled = !tg;
    container.append(toolbar(
      [
        btn('Create load balancer', null, showCreateLoadBalancerModal),
        btn('Create target group', null, showCreateTargetGroupModal),
        registerTargetsButton,
      ],
      [
        createListenerButton,
        createRuleButton,
        btn('Add tags', null, showTagsModal),
        deregisterTargetsButton,
        deleteListenerButton,
        deleteLoadBalancerButton,
        deleteTargetGroupButton,
      ],
    ));
    const workbench = el('div', 'elasticloadbalancing-workbench');
    const detail = el('div', 'elasticloadbalancing-detail-stack');
    detail.append(renderLoadBalancerDetail(lb), renderTargetGroups(), renderListenersAndRules(), renderTargetHealth());
    workbench.append(renderLoadBalancerList(), detail);
    container.append(workbench);
    return container;
  }

  function render() {
    if (!root) {
      return;
    }
    renderBreadcrumbs();
    root.textContent = '';
    root.append(renderWorkbench());
    if (loadedAtEl) {
      loadedAtEl.textContent = `Loaded ${new Date().toLocaleTimeString()}`;
    }
  }

  async function refresh() {
    const data = await apiJson('/api/elasticloadbalancing/');
    state.inventory = data;
    if (!selectedLoadBalancer() && loadBalancers().length) {
      state.selectedLoadBalancerArn = loadBalancers()[0].arn;
    }
    if (!selectedTargetGroup() && targetGroups().length) {
      state.selectedTargetGroupArn = targetGroups()[0].arn;
    }
    if (!selectedListener() && listeners().length) {
      state.selectedListenerArn = listeners()[0].arn;
    }
    renderSummary(data.summary || {});
    render();
  }

  function init() {
    if (!root) {
      return;
    }
    root.append(el('div', 'elasticloadbalancing-empty', 'Loading...'));
    refresh().catch((error) => toast(error.message, true));
  }

  return { init, refresh };
})();

window.ElasticLoadBalancingConsole = ElasticLoadBalancingConsole;

if (document.getElementById('elasticloadbalancing-console-root')) {
  ElasticLoadBalancingConsole.init();
}
