/**
 * Metrics Collector
 *
 * Collects and exposes proxy metrics for monitoring.
 * Compatible with Prometheus format.
 */

export interface RequestMetric {
  timestamp: number;
  intent: string;
  method: string;
  statusCode: number;
  durationMs: number;
  bytesIn: number;
  bytesOut: number;
  clientIp: string;
  error?: string;
  /** NestFlow intent category: auth | session | device | tickauth | identity | general */
  intentCategory?: string;
}

export interface MetricsSummary {
  uptime: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  p50ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  requestsPerSecond: number;
  bytesIn: number;
  bytesOut: number;
  topIntents: Array<{ intent: string; count: number }>;
  errorRate: number;
  statusCodeCounts: Record<string, number>;
}

export class MetricsCollector {
  private startTime = Date.now();
  private metrics: RequestMetric[] = [];
  private maxMetrics = 10000; // Keep last 10k metrics in memory
  private cleanupInterval: NodeJS.Timeout;

  // Counters for cumulative metrics
  private totalRequests = 0;
  private totalSuccesses = 0;
  private totalFailures = 0;
  private totalBytesIn = 0;
  private totalBytesOut = 0;

  constructor() {
    // Cleanup old metrics every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 300000);
  }

  /**
   * Record a request metric
   */
  record(metric: RequestMetric): void {
    this.metrics.push(metric);
    this.totalRequests++;
    this.totalBytesIn += metric.bytesIn;
    this.totalBytesOut += metric.bytesOut;

    if (metric.statusCode >= 200 && metric.statusCode < 400) {
      this.totalSuccesses++;
    } else {
      this.totalFailures++;
    }

    // Trim if over limit
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
  }

  /**
   * Get metrics summary
   */
  getSummary(windowMs: number = 60000): MetricsSummary {
    const now = Date.now();
    const windowStart = now - windowMs;
    const windowMetrics = this.metrics.filter(
      (m) => m.timestamp >= windowStart,
    );

    const durations = windowMetrics
      .map((m) => m.durationMs)
      .sort((a, b) => a - b);
    const intentCounts = new Map<string, number>();
    const statusCounts: Record<string, number> = {};

    for (const m of windowMetrics) {
      intentCounts.set(m.intent, (intentCounts.get(m.intent) || 0) + 1);
      const statusGroup = `${Math.floor(m.statusCode / 100)}xx`;
      statusCounts[statusGroup] = (statusCounts[statusGroup] || 0) + 1;
    }

    const topIntents = [...intentCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([intent, count]) => ({ intent, count }));

    const windowSeconds = windowMs / 1000;
    const failedInWindow = windowMetrics.filter(
      (m) => m.statusCode >= 400,
    ).length;

    return {
      uptime: now - this.startTime,
      totalRequests: this.totalRequests,
      successfulRequests: this.totalSuccesses,
      failedRequests: this.totalFailures,
      averageResponseTime: this.average(durations),
      p50ResponseTime: this.percentile(durations, 50),
      p95ResponseTime: this.percentile(durations, 95),
      p99ResponseTime: this.percentile(durations, 99),
      requestsPerSecond: windowMetrics.length / windowSeconds,
      bytesIn: this.totalBytesIn,
      bytesOut: this.totalBytesOut,
      topIntents,
      errorRate:
        windowMetrics.length > 0 ? failedInWindow / windowMetrics.length : 0,
      statusCodeCounts: statusCounts,
    };
  }

  /**
   * Get metrics in Prometheus format
   */
  getPrometheusMetrics(): string {
    const summary = this.getSummary();
    const lines: string[] = [];

    lines.push('# HELP axis_proxy_uptime_seconds Proxy uptime in seconds');
    lines.push('# TYPE axis_proxy_uptime_seconds gauge');
    lines.push(
      `axis_proxy_uptime_seconds ${Math.floor(summary.uptime / 1000)}`,
    );

    lines.push('# HELP axis_proxy_requests_total Total number of requests');
    lines.push('# TYPE axis_proxy_requests_total counter');
    lines.push(`axis_proxy_requests_total ${summary.totalRequests}`);

    lines.push(
      '# HELP axis_proxy_requests_success_total Total successful requests',
    );
    lines.push('# TYPE axis_proxy_requests_success_total counter');
    lines.push(
      `axis_proxy_requests_success_total ${summary.successfulRequests}`,
    );

    lines.push('# HELP axis_proxy_requests_failed_total Total failed requests');
    lines.push('# TYPE axis_proxy_requests_failed_total counter');
    lines.push(`axis_proxy_requests_failed_total ${summary.failedRequests}`);

    lines.push(
      '# HELP axis_proxy_response_time_ms Response time in milliseconds',
    );
    lines.push('# TYPE axis_proxy_response_time_ms summary');
    lines.push(
      `axis_proxy_response_time_ms{quantile="0.5"} ${summary.p50ResponseTime}`,
    );
    lines.push(
      `axis_proxy_response_time_ms{quantile="0.95"} ${summary.p95ResponseTime}`,
    );
    lines.push(
      `axis_proxy_response_time_ms{quantile="0.99"} ${summary.p99ResponseTime}`,
    );

    lines.push('# HELP axis_proxy_bytes_in_total Total bytes received');
    lines.push('# TYPE axis_proxy_bytes_in_total counter');
    lines.push(`axis_proxy_bytes_in_total ${summary.bytesIn}`);

    lines.push('# HELP axis_proxy_bytes_out_total Total bytes sent');
    lines.push('# TYPE axis_proxy_bytes_out_total counter');
    lines.push(`axis_proxy_bytes_out_total ${summary.bytesOut}`);

    lines.push('# HELP axis_proxy_error_rate Current error rate (0-1)');
    lines.push('# TYPE axis_proxy_error_rate gauge');
    lines.push(`axis_proxy_error_rate ${summary.errorRate.toFixed(4)}`);

    lines.push('# HELP axis_proxy_rps Requests per second');
    lines.push('# TYPE axis_proxy_rps gauge');
    lines.push(`axis_proxy_rps ${summary.requestsPerSecond.toFixed(2)}`);

    // NestFlow intent category breakdown
    const categoryCounts = new Map<string, number>();
    for (const m of this.metrics) {
      const cat = m.intentCategory || 'general';
      categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
    }
    if (categoryCounts.size > 0) {
      lines.push(
        '# HELP axis_proxy_nestflow_intents_total NestFlow intent requests by category',
      );
      lines.push('# TYPE axis_proxy_nestflow_intents_total counter');
      for (const [category, count] of categoryCounts) {
        lines.push(
          `axis_proxy_nestflow_intents_total{category="${category}"} ${count}`,
        );
      }
    }

    return lines.join('\n');
  }

  /**
   * Get recent requests (for debugging)
   */
  getRecentRequests(limit: number = 100): RequestMetric[] {
    return this.metrics.slice(-limit);
  }

  /**
   * Destroy the collector
   */
  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.metrics = [];
  }

  private average(arr: number[]): number {
    if (arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  private percentile(arr: number[], p: number): number {
    if (arr.length === 0) return 0;
    const index = Math.ceil((p / 100) * arr.length) - 1;
    return arr[Math.max(0, index)];
  }

  private cleanup(): void {
    const cutoff = Date.now() - 3600000; // Keep last hour
    this.metrics = this.metrics.filter((m) => m.timestamp >= cutoff);
  }
}

// Singleton instance
export const metrics = new MetricsCollector();
