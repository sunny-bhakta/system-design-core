/**
 * Alerting System
 * Demonstrates alert rules, thresholds, and notification channels
 */

/**
 * Alert Rule
 */
class AlertRule {
  constructor(config) {
    this.name = config.name;
    this.metric = config.metric;
    this.condition = config.condition; // 'gt', 'lt', 'eq', 'gte', 'lte'
    this.threshold = config.threshold;
    this.duration = config.duration || 60000; // Alert if condition met for this duration
    this.severity = config.severity || 'warning'; // 'info', 'warning', 'critical'
    this.enabled = config.enabled !== false;
    
    this.triggeredAt = null;
    this.lastCheck = null;
    this.triggerCount = 0;
  }

  /**
   * Check if rule should trigger
   */
  check(value) {
    this.lastCheck = Date.now();
    
    let shouldTrigger = false;
    switch (this.condition) {
      case 'gt':
        shouldTrigger = value > this.threshold;
        break;
      case 'lt':
        shouldTrigger = value < this.threshold;
        break;
      case 'eq':
        shouldTrigger = value === this.threshold;
        break;
      case 'gte':
        shouldTrigger = value >= this.threshold;
        break;
      case 'lte':
        shouldTrigger = value <= this.threshold;
        break;
      default:
        shouldTrigger = false;
    }

    if (shouldTrigger) {
      if (!this.triggeredAt) {
        this.triggeredAt = Date.now();
      }
      
      // Check if condition met for required duration
      if (Date.now() - this.triggeredAt >= this.duration) {
        this.triggerCount++;
        return {
          triggered: true,
          rule: this.name,
          metric: this.metric,
          value,
          threshold: this.threshold,
          severity: this.severity,
          duration: Date.now() - this.triggeredAt
        };
      }
    } else {
      // Reset if condition no longer met
      if (this.triggeredAt) {
        this.triggeredAt = null;
        this.triggerCount = 0;
      }
    }

    return { triggered: false };
  }

  /**
   * Reset alert
   */
  reset() {
    this.triggeredAt = null;
    this.triggerCount = 0;
  }
}

/**
 * Alert Manager
 */
class AlertManager {
  constructor() {
    this.rules = new Map();
    this.activeAlerts = new Map();
    this.notificationChannels = [];
    this.alertHistory = [];
  }

  /**
   * Register alert rule
   */
  registerRule(rule) {
    this.rules.set(rule.name, rule);
  }

  /**
   * Register notification channel
   */
  registerChannel(channel) {
    this.notificationChannels.push(channel);
  }

  /**
   * Evaluate all rules
   */
  evaluateRules(metrics) {
    const alerts = [];

    for (const [name, rule] of this.rules.entries()) {
      if (!rule.enabled) continue;

      const metricValue = metrics[rule.metric];
      if (metricValue === undefined) continue;

      const result = rule.check(metricValue);
      
      if (result.triggered) {
        const alertKey = `${rule.name}_${rule.metric}`;
        
        // Check if already active
        if (!this.activeAlerts.has(alertKey)) {
          this.activeAlerts.set(alertKey, {
            ...result,
            triggeredAt: Date.now(),
            id: `alert-${Date.now()}-${Math.random()}`
          });

          // Send notifications
          this.sendNotifications(this.activeAlerts.get(alertKey));
          
          alerts.push(this.activeAlerts.get(alertKey));
        }
      } else {
        // Check if alert should be resolved
        const alertKey = `${rule.name}_${rule.metric}`;
        if (this.activeAlerts.has(alertKey)) {
          const alert = this.activeAlerts.get(alertKey);
          this.resolveAlert(alertKey, alert);
        }
      }
    }

    return alerts;
  }

  /**
   * Send notifications
   */
  async sendNotifications(alert) {
    for (const channel of this.notificationChannels) {
      try {
        await channel.send(alert);
      } catch (error) {
        console.error(`Failed to send alert via ${channel.name}:`, error);
      }
    }
  }

  /**
   * Resolve alert
   */
  resolveAlert(alertKey, alert) {
    this.activeAlerts.delete(alertKey);
    
    const resolvedAlert = {
      ...alert,
      resolvedAt: Date.now(),
      duration: Date.now() - alert.triggeredAt
    };

    this.alertHistory.push(resolvedAlert);

    // Send resolution notifications
    for (const channel of this.notificationChannels) {
      if (channel.sendResolution) {
        channel.sendResolution(resolvedAlert);
      }
    }

    return resolvedAlert;
  }

  /**
   * Get active alerts
   */
  getActiveAlerts() {
    return Array.from(this.activeAlerts.values());
  }

  /**
   * Get alert history
   */
  getAlertHistory(limit = 100) {
    return this.alertHistory.slice(-limit);
  }
}

/**
 * Notification Channels
 */
class EmailChannel {
  constructor(config) {
    this.name = 'email';
    this.recipients = config.recipients || [];
  }

  async send(alert) {
    console.log(`[EMAIL] Alert: ${alert.rule} - ${alert.metric} = ${alert.value} (threshold: ${alert.threshold})`);
    console.log(`  Recipients: ${this.recipients.join(', ')}`);
    console.log(`  Severity: ${alert.severity}`);
    // Simulate email sending
    return { success: true, channel: 'email' };
  }

  async sendResolution(alert) {
    console.log(`[EMAIL] Alert Resolved: ${alert.rule} - Duration: ${alert.duration}ms`);
  }
}

class SlackChannel {
  constructor(config) {
    this.name = 'slack';
    this.webhookUrl = config.webhookUrl;
    this.channel = config.channel || '#alerts';
  }

  async send(alert) {
    const message = {
      channel: this.channel,
      text: `🚨 Alert: ${alert.rule}`,
      attachments: [{
        color: alert.severity === 'critical' ? 'danger' : 'warning',
        fields: [
          { title: 'Metric', value: alert.metric, short: true },
          { title: 'Value', value: String(alert.value), short: true },
          { title: 'Threshold', value: String(alert.threshold), short: true },
          { title: 'Severity', value: alert.severity, short: true }
        ]
      }]
    };

    console.log(`[SLACK] Sending to ${this.channel}:`, JSON.stringify(message, null, 2));
    // Simulate webhook call
    return { success: true, channel: 'slack' };
  }

  async sendResolution(alert) {
    console.log(`[SLACK] Alert Resolved: ${alert.rule}`);
  }
}

class PagerDutyChannel {
  constructor(config) {
    this.name = 'pagerduty';
    this.apiKey = config.apiKey;
    this.escalationPolicy = config.escalationPolicy;
  }

  async send(alert) {
    if (alert.severity === 'critical') {
      console.log(`[PAGERDUTY] Creating incident for: ${alert.rule}`);
      console.log(`  Escalation Policy: ${this.escalationPolicy}`);
      // Simulate PagerDuty API call
      return { 
        success: true, 
        channel: 'pagerduty',
        incidentId: `inc-${Date.now()}`
      };
    }
    return { success: false, reason: 'Only critical alerts trigger PagerDuty' };
  }

  async sendResolution(alert) {
    console.log(`[PAGERDUTY] Resolving incident for: ${alert.rule}`);
  }
}

/**
 * Alert Aggregator
 * Prevents alert flooding
 */
class AlertAggregator {
  constructor(config = {}) {
    this.window = config.window || 60000; // 1 minute
    this.maxAlerts = config.maxAlerts || 10;
    this.alerts = [];
  }

  /**
   * Check if alert should be sent
   */
  shouldSend(alert) {
    const now = Date.now();
    
    // Remove old alerts
    this.alerts = this.alerts.filter(a => now - a.timestamp < this.window);
    
    // Check if too many alerts
    if (this.alerts.length >= this.maxAlerts) {
      return false;
    }
    
    // Add alert
    this.alerts.push({
      ...alert,
      timestamp: now
    });
    
    return true;
  }

  getStats() {
    return {
      alertsInWindow: this.alerts.length,
      maxAlerts: this.maxAlerts,
      window: this.window
    };
  }
}

// Example usage
async function demonstrateAlerting() {
  console.log('=== Alerting System ===\n');

  const alertManager = new AlertManager();

  // Register alert rules
  alertManager.registerRule(new AlertRule({
    name: 'high_error_rate',
    metric: 'error_rate',
    condition: 'gt',
    threshold: 0.1, // 10%
    duration: 30000, // 30 seconds
    severity: 'critical'
  }));

  alertManager.registerRule(new AlertRule({
    name: 'high_cpu_usage',
    metric: 'cpu_usage',
    condition: 'gt',
    threshold: 80, // 80%
    duration: 60000, // 1 minute
    severity: 'warning'
  }));

  alertManager.registerRule(new AlertRule({
    name: 'low_memory',
    metric: 'memory_available',
    condition: 'lt',
    threshold: 1024, // MB
    duration: 30000,
    severity: 'warning'
  }));

  // Register notification channels
  alertManager.registerChannel(new EmailChannel({
    recipients: ['admin@example.com', 'ops@example.com']
  }));

  alertManager.registerChannel(new SlackChannel({
    webhookUrl: 'https://hooks.slack.com/...',
    channel: '#alerts'
  }));

  alertManager.registerChannel(new PagerDutyChannel({
    apiKey: 'api-key',
    escalationPolicy: 'critical-alerts'
  }));

  // Simulate metrics
  const metrics1 = {
    error_rate: 0.05,
    cpu_usage: 75,
    memory_available: 2048
  };

  const metrics2 = {
    error_rate: 0.15, // Triggers alert
    cpu_usage: 85, // Triggers alert
    memory_available: 512 // Triggers alert
  };

  console.log('Evaluating metrics 1:', metrics1);
  const alerts1 = alertManager.evaluateRules(metrics1);
  console.log('Alerts triggered:', alerts1.length);

  console.log('\nEvaluating metrics 2:', metrics2);
  const alerts2 = alertManager.evaluateRules(metrics2);
  console.log('Alerts triggered:', alerts2.length);

  // Wait a bit
  await new Promise(resolve => setTimeout(resolve, 100));

  // Check active alerts
  console.log('\nActive Alerts:', alertManager.getActiveAlerts());

  // Simulate metrics returning to normal
  const metrics3 = {
    error_rate: 0.02,
    cpu_usage: 60,
    memory_available: 3072
  };

  console.log('\nEvaluating metrics 3 (normal):', metrics3);
  alertManager.evaluateRules(metrics3);

  console.log('\nActive Alerts:', alertManager.getActiveAlerts());
  console.log('\nAlert History:', alertManager.getAlertHistory(5));
}

if (require.main === module) {
  demonstrateAlerting();
}

module.exports = {
  AlertRule,
  AlertManager,
  EmailChannel,
  SlackChannel,
  PagerDutyChannel,
  AlertAggregator
};

