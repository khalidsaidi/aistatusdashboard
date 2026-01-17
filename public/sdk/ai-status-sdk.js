(function (window) {
  const state = {
    config: {
      telemetryKey: null,
      clientId: null,
      accountId: null,
      providerId: null,
      model: null,
      endpoint: 'api',
      region: 'global',
      tier: 'unknown',
      streaming: false,
    },
  };

  function configure(options) {
    state.config = Object.assign({}, state.config, options || {});
  }

  function buildPayload(metrics) {
    return Object.assign(
      {
        clientId: state.config.clientId,
        accountId: state.config.accountId,
        providerId: state.config.providerId,
        model: state.config.model,
        endpoint: state.config.endpoint,
        region: state.config.region,
        tier: state.config.tier,
        streaming: Boolean(state.config.streaming),
        source: state.config.accountId ? 'account' : 'crowd',
      },
      metrics || {}
    );
  }

  function sendTelemetry(payload) {
    const url = '/api/telemetry/ingest';
    const headers = { 'Content-Type': 'application/json' };
    const hasKey = Boolean(state.config.telemetryKey);
    if (hasKey) {
      headers['x-telemetry-key'] = state.config.telemetryKey;
    }

    const body = JSON.stringify(payload);
    if (!hasKey && navigator.sendBeacon) {
      try {
        const blob = new Blob([body], { type: 'application/json' });
        navigator.sendBeacon(url, blob);
        return;
      } catch (_) {
        // fall back to fetch
      }
    }

    fetch(url, { method: 'POST', headers, body, keepalive: true }).catch(function () {});
  }

  function report(metrics) {
    const payload = buildPayload(metrics);
    if (!payload.clientId || !payload.providerId || !payload.model) {
      return;
    }
    if (payload.latencyMs === undefined) {
      payload.latencyMs = 0;
    }
    sendTelemetry(payload);
  }

  window.AIStatusSDK = {
    configure,
    report,
  };
})(window);
