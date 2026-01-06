'use client';

import { useCallback, useEffect, useRef } from 'react';
import { driver } from 'driver.js';
import type { DriveStep, Driver } from 'driver.js';
import 'driver.js/dist/driver.css';

type DashboardTabId = 'dashboard' | 'notifications' | 'analytics' | 'reliability' | 'api' | 'comments';
type TourMode = 'full' | DashboardTabId;
type TourGroup = 'nav' | DashboardTabId;

type StepMeta = {
  tab?: DashboardTabId;
  pane?: string;
  notifyTab?: 'email' | 'webhooks' | 'incidents' | 'maintenance';
  group: TourGroup;
};

type StepDefinition = {
  step: DriveStep;
  meta: StepMeta;
};

type GuidedTourProps = {
  activeTab: DashboardTabId;
  setTab: (tab: DashboardTabId) => void;
};

const buildStep = (
  element: string,
  title: string,
  description: string,
  meta: StepMeta,
  popover?: DriveStep['popover']
): StepDefinition => ({
  step: {
    element,
    popover: {
      title,
      description,
      side: 'bottom',
      align: 'start',
      ...popover,
    },
  },
  meta,
});

const ALL_STEPS: StepDefinition[] = [
  buildStep(
    '[data-tour="nav"]',
    'Navigation',
    'Jump between dashboard, alerts, analytics, reliability, API, and RSS from here.',
    { group: 'nav' }
  ),
  buildStep(
    '[data-tour="theme-toggle"]',
    'Theme',
    'Toggle light and dark mode to match your working environment.',
    { group: 'nav' },
    { side: 'bottom', align: 'center' }
  ),
  buildStep(
    '[data-tour="nav-alerts"]',
    'Instant alerts',
    'Create alert subscriptions from anywhere in the product.',
    { group: 'nav' },
    { side: 'bottom', align: 'center' }
  ),
  buildStep(
    '[data-tour="nav-rss"]',
    'RSS feed',
    'Subscribe to status changes in your feed reader.',
    { group: 'nav' },
    { side: 'bottom', align: 'center' }
  ),

  buildStep(
    '[data-tour="tab-bar"]',
    'Sections',
    'Use these tabs to move between core workflows.',
    { group: 'dashboard', tab: 'dashboard' }
  ),
  buildStep(
    '[data-tour="dashboard-summary"]',
    'Live system summary',
    'The top-level health signal across all providers, refreshed every 60 seconds.',
    { group: 'dashboard', tab: 'dashboard' }
  ),
  buildStep(
    '[data-tour="dashboard-early-warnings"]',
    'Early warning signals',
    'Synthetic + crowd telemetry to catch incidents before official updates land.',
    { group: 'dashboard', tab: 'dashboard' }
  ),
  buildStep(
    '[data-tour="dashboard-staleness"]',
    'Status staleness',
    'Highlights mismatches between official status and observed telemetry.',
    { group: 'dashboard', tab: 'dashboard' }
  ),
  buildStep(
    '[data-tour="dashboard-filters"]',
    'Search & filters',
    'Find providers fast, then filter by status, speed, and uptime.',
    { group: 'dashboard', tab: 'dashboard' }
  ),
  buildStep(
    '[data-tour="dashboard-provider-grid"]',
    'Provider cards',
    'Every provider includes status, latency, uptime, and quick alert actions.',
    { group: 'dashboard', tab: 'dashboard' }
  ),
  buildStep(
    '[data-tour="share-export"]',
    'Share & export',
    'Export snapshots, copy API links, or generate status badges.',
    { group: 'dashboard', tab: 'dashboard' }
  ),
  buildStep(
    '[data-tour="dashboard-stay-loop"]',
    'Stay in the loop',
    'Connect alerts, webhooks, and RSS to your watchlist.',
    { group: 'dashboard', tab: 'dashboard' }
  ),

  buildStep(
    '[data-tour="notifications-panel"]',
    'Notifications hub',
    'Email, webhooks, incidents, and maintenance in one place.',
    { group: 'notifications', tab: 'notifications', notifyTab: 'email' }
  ),
  buildStep(
    '[data-tour="notifications-email"]',
    'Email alerts',
    'Subscribe to providers and confirm via email.',
    { group: 'notifications', tab: 'notifications', notifyTab: 'email' }
  ),
  buildStep(
    '[data-tour="notifications-webhooks"]',
    'Webhook alerts',
    'Register a webhook endpoint for real-time status changes.',
    { group: 'notifications', tab: 'notifications', notifyTab: 'webhooks' }
  ),
  buildStep(
    '[data-tour="notifications-incidents"]',
    'Incident history',
    'Review timelines, impact summaries, and updates.',
    { group: 'notifications', tab: 'notifications', notifyTab: 'incidents' }
  ),
  buildStep(
    '[data-tour="notifications-maintenance"]',
    'Maintenance windows',
    'Track scheduled work that might impact availability.',
    { group: 'notifications', tab: 'notifications', notifyTab: 'maintenance' }
  ),

  buildStep(
    '[data-tour="analytics-overview"]',
    'Analytics overview',
    'Engagement signals and cost inputs from the last 7 days.',
    { group: 'analytics', tab: 'analytics' }
  ),
  buildStep(
    '[data-tour="analytics-metrics"]',
    'Engagement mix',
    'Understand which actions drive attention and alerts.',
    { group: 'analytics', tab: 'analytics' }
  ),
  buildStep(
    '[data-tour="analytics-compare"]',
    'Provider benchmarking',
    'Compare uptime, latency, and incidents across vendors.',
    { group: 'analytics', tab: 'analytics' }
  ),
  buildStep(
    '[data-tour="analytics-timeline"]',
    'Incident timeline',
    'Review recent outages and degradations by provider.',
    { group: 'analytics', tab: 'analytics' }
  ),
  buildStep(
    '[data-tour="analytics-detail"]',
    'Provider detail',
    'Components, incidents, and maintenance from the normalized feed.',
    { group: 'analytics', tab: 'analytics' }
  ),

  buildStep(
    '[data-tour="reliability-intro"]',
    'Reliability Lab',
    'Deep diagnostics, model-level telemetry, and fallback intelligence.',
    { group: 'reliability', tab: 'reliability' }
  ),
  buildStep(
    '[data-tour="reliability-panes"]',
    'Switch lenses',
    'Jump between canaries, matrices, replays, forecasts, and more.',
    { group: 'reliability', tab: 'reliability' }
  ),
  buildStep(
    '[data-tour="reliability-canary"]',
    'Canary Copilot',
    'Compare official, observed, and account-specific health.',
    { group: 'reliability', tab: 'reliability', pane: 'canary' }
  ),
  buildStep(
    '[data-tour="reliability-model"]',
    'Model detail',
    'Inspect latency, error rates, and throughput for a single model.',
    { group: 'reliability', tab: 'reliability', pane: 'model' }
  ),
  buildStep(
    '[data-tour="reliability-matrix"]',
    'Model Matrix',
    'Spot hot zones across models, regions, and endpoints.',
    { group: 'reliability', tab: 'reliability', pane: 'matrix' }
  ),
  buildStep(
    '[data-tour="reliability-replay"]',
    'Incident Replay',
    'Time-travel through incidents and evaluate fallback rules.',
    { group: 'reliability', tab: 'reliability', pane: 'replay' }
  ),
  buildStep(
    '[data-tour="reliability-forecast"]',
    'Reliability Forecast',
    'Predict near-term risk based on telemetry drift.',
    { group: 'reliability', tab: 'reliability', pane: 'forecast' }
  ),
  buildStep(
    '[data-tour="reliability-rate"]',
    'Rate limits',
    'Track throttling signals and 429 pressure.',
    { group: 'reliability', tab: 'reliability', pane: 'rate' }
  ),
  buildStep(
    '[data-tour="reliability-radar"]',
    'Change Radar',
    'Surface pricing, limits, and policy changes.',
    { group: 'reliability', tab: 'reliability', pane: 'radar' }
  ),
  buildStep(
    '[data-tour="reliability-behavioral"]',
    'Behavioral stability',
    'Monitor refusal, schema validity, and tool-call health.',
    { group: 'reliability', tab: 'reliability', pane: 'behavioral' }
  ),
  buildStep(
    '[data-tour="reliability-ask"]',
    'Ask Status',
    'Query the telemetry with evidence-backed answers.',
    { group: 'reliability', tab: 'reliability', pane: 'ask' }
  ),

  buildStep(
    '[data-tour="api-demo"]',
    'API & badges',
    'Test endpoints and embed live status in your apps.',
    { group: 'api', tab: 'api' }
  ),
  buildStep(
    '[data-tour="api-endpoints"]',
    'Endpoint catalog',
    'Run live requests against health, status, and webhook APIs.',
    { group: 'api', tab: 'api' }
  ),

  buildStep(
    '[data-tour="comments-section"]',
    'Community feedback',
    'Capture real-world outages and user sentiment.',
    { group: 'comments', tab: 'comments' }
  ),
];

const GROUPS_BY_MODE: Record<TourMode, TourGroup[]> = {
  full: ['nav', 'dashboard', 'notifications', 'analytics', 'reliability', 'api', 'comments'],
  dashboard: ['dashboard'],
  notifications: ['notifications'],
  analytics: ['analytics'],
  reliability: ['reliability'],
  api: ['api'],
  comments: ['comments'],
};

function buildSteps(mode: TourMode): StepDefinition[] {
  const allowed = new Set(GROUPS_BY_MODE[mode]);
  return ALL_STEPS.filter((step) => allowed.has(step.meta.group));
}

export default function GuidedTour({ activeTab, setTab }: GuidedTourProps) {
  const driverRef = useRef<Driver | null>(null);
  const stepsRef = useRef<StepDefinition[]>([]);
  const activeTabRef = useRef(activeTab);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  const syncForIndex = useCallback(
    (index: number) => {
      const entry = stepsRef.current[index];
      if (!entry) return;
      const { tab, pane } = entry.meta;
      if (tab && tab !== activeTabRef.current) {
        setTab(tab);
      }
      if (pane) {
        window.dispatchEvent(new CustomEvent('ai-status:reliability-pane', { detail: { pane } }));
      }
      if (entry.meta.notifyTab) {
        window.dispatchEvent(
          new CustomEvent('ai-status:notifications-tab', { detail: { tab: entry.meta.notifyTab } })
        );
      }
    },
    [setTab]
  );

  const startTour = useCallback(
    (mode: TourMode) => {
      const steps = buildSteps(mode);
      if (!steps.length) return;

      if (driverRef.current?.isActive()) {
        driverRef.current.destroy();
      }

      stepsRef.current = steps;

      const instance = driver({
        animate: true,
        allowClose: true,
        overlayOpacity: 0.6,
        overlayColor: '#0f172a',
        stagePadding: 8,
        stageRadius: 16,
        showProgress: true,
        popoverClass: 'ai-tour-popover',
        onHighlightStarted: (_el, _step, opts) => {
          const index = opts.state.activeIndex ?? 0;
          syncForIndex(index);
        },
        onNextClick: (_el, _step, opts) => {
          const index = opts.state.activeIndex ?? 0;
          const nextIndex = Math.min(index + 1, stepsRef.current.length - 1);
          syncForIndex(nextIndex);
          setTimeout(() => opts.driver.moveNext(), 200);
        },
        onPrevClick: (_el, _step, opts) => {
          const index = opts.state.activeIndex ?? 0;
          const prevIndex = Math.max(index - 1, 0);
          syncForIndex(prevIndex);
          setTimeout(() => opts.driver.movePrevious(), 200);
        },
        onDestroyed: () => {
          driverRef.current = null;
        },
      });

      driverRef.current = instance;
      syncForIndex(0);
      setTimeout(() => instance.drive(0), 0);
    },
    [syncForIndex]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ mode?: TourMode }>).detail;
      startTour(detail?.mode || 'full');
    };
    window.addEventListener('ai-status:start-tour', handler as EventListener);
    return () => window.removeEventListener('ai-status:start-tour', handler as EventListener);
  }, [startTour]);

  return null;
}
