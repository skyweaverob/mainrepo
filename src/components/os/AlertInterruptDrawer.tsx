'use client';

import { useState, useEffect } from 'react';
import {
  AlertTriangle,
  X,
  Clock,
  DollarSign,
  Zap,
  CheckCircle2,
  ArrowRight,
  Bell,
} from 'lucide-react';
import { formatCurrencyDelta } from '@/lib/formatters';
import type { OSAlert, AlertSeverity } from '@/types';

interface AlertInterruptDrawerProps {
  alerts: OSAlert[];
  onAcknowledge: (alertId: string) => void;
  onAction: (alertId: string, actionType: string) => void;
}

const SEVERITY_CONFIG: Record<AlertSeverity, {
  bgColor: string;
  borderColor: string;
  iconColor: string;
  textColor: string;
  label: string;
}> = {
  critical: {
    bgColor: 'bg-red-50',
    borderColor: 'border-red-300',
    iconColor: 'text-red-600',
    textColor: 'text-red-800',
    label: 'ACTION REQUIRED',
  },
  warning: {
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-300',
    iconColor: 'text-amber-600',
    textColor: 'text-amber-800',
    label: 'EXPIRING UPSIDE',
  },
  info: {
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    iconColor: 'text-blue-600',
    textColor: 'text-blue-800',
    label: 'FYI',
  },
};

/**
 * AlertInterruptDrawer - OS-grade interrupt system for critical alerts
 * Red alerts force acknowledgement before user can proceed
 */
export function AlertInterruptDrawer({
  alerts,
  onAcknowledge,
  onAction,
}: AlertInterruptDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // Find unacknowledged critical alerts
  const criticalAlerts = alerts.filter(
    (a) => a.severity === 'critical' && !a.acknowledged
  );
  const warningAlerts = alerts.filter(
    (a) => a.severity === 'warning' && !a.acknowledged
  );
  const unacknowledgedCount = alerts.filter((a) => !a.acknowledged).length;

  // Show modal for critical alerts
  useEffect(() => {
    if (criticalAlerts.length > 0) {
      setShowModal(true);
    }
  }, [criticalAlerts.length]);

  const handleAcknowledge = (alertId: string) => {
    onAcknowledge(alertId);
    // Close modal if no more critical alerts
    if (criticalAlerts.length <= 1) {
      setShowModal(false);
    }
  };

  const handleAction = (alertId: string, actionType: string) => {
    onAction(alertId, actionType);
    handleAcknowledge(alertId);
  };

  // Calculate total leakage
  const totalLeakage = alerts
    .filter((a) => !a.acknowledged && a.dollarLeakagePerDay)
    .reduce((sum, a) => sum + (a.dollarLeakagePerDay || 0), 0);

  return (
    <>
      {/* Alert Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`relative flex items-center gap-2 px-3 py-1.5 rounded transition-colors ${
          criticalAlerts.length > 0
            ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30'
            : warningAlerts.length > 0
            ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
            : 'bg-slate-500/20 text-slate-300 hover:bg-slate-500/30'
        }`}
      >
        <Bell className="w-4 h-4" />
        <span className="text-xs font-medium">
          {unacknowledgedCount > 0 ? unacknowledgedCount : 'No'} Alerts
        </span>
        {unacknowledgedCount > 0 && (
          <span className={`absolute -top-1 -right-1 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${
            criticalAlerts.length > 0 ? 'bg-red-500 text-white' : 'bg-amber-500 text-white'
          }`}>
            {unacknowledgedCount}
          </span>
        )}
      </button>

      {/* Critical Alert Modal - Blocks interaction until acknowledged */}
      {showModal && criticalAlerts.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-2xl max-w-lg w-full mx-4 overflow-hidden">
            {/* Header */}
            <div className="bg-red-600 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-full">
                  <AlertTriangle className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">
                    Action Required
                  </h2>
                  <p className="text-sm text-red-100">
                    {criticalAlerts.length} critical alert{criticalAlerts.length > 1 ? 's' : ''} require your attention
                  </p>
                </div>
              </div>
            </div>

            {/* Alert Content */}
            <div className="p-6 space-y-4 max-h-[60vh] overflow-auto">
              {criticalAlerts.map((alert) => (
                <AlertCard
                  key={alert.id}
                  alert={alert}
                  onAcknowledge={() => handleAcknowledge(alert.id)}
                  onAction={(actionType) => handleAction(alert.id, actionType)}
                />
              ))}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200">
              <p className="text-xs text-slate-500 text-center">
                You must acknowledge all critical alerts to continue
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Drawer for all alerts */}
      {isOpen && (
        <div className="fixed inset-0 z-40">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setIsOpen(false)}
          />

          {/* Drawer */}
          <div className="absolute right-0 top-0 bottom-0 w-96 bg-white shadow-2xl flex flex-col">
            {/* Header */}
            <div className="px-4 py-3 bg-[#002855] flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-white" />
                <span className="font-bold text-white">System Alerts</span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-white/10 rounded"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Summary */}
            {totalLeakage > 0 && (
              <div className="px-4 py-3 bg-red-50 border-b border-red-200">
                <div className="flex items-center gap-2 text-red-700">
                  <DollarSign className="w-4 h-4" />
                  <span className="text-sm font-medium">
                    Total leakage: {formatCurrencyDelta(-totalLeakage, { compact: true })}/day
                  </span>
                </div>
              </div>
            )}

            {/* Alert List */}
            <div className="flex-1 overflow-auto p-4 space-y-3">
              {alerts.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                  <p className="text-slate-600 font-medium">All clear</p>
                  <p className="text-sm text-slate-400">No active alerts</p>
                </div>
              ) : (
                alerts.map((alert) => (
                  <AlertCard
                    key={alert.id}
                    alert={alert}
                    compact
                    onAcknowledge={() => onAcknowledge(alert.id)}
                    onAction={(actionType) => onAction(alert.id, actionType)}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function AlertCard({
  alert,
  compact = false,
  onAcknowledge,
  onAction,
}: {
  alert: OSAlert;
  compact?: boolean;
  onAcknowledge: () => void;
  onAction: (actionType: string) => void;
}) {
  const config = SEVERITY_CONFIG[alert.severity];

  return (
    <div
      className={`rounded-lg border-2 ${config.borderColor} ${config.bgColor} ${
        alert.acknowledged ? 'opacity-50' : ''
      }`}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className={`w-5 h-5 ${config.iconColor}`} />
            <span className={`text-[10px] font-bold ${config.textColor}`}>
              {config.label}
            </span>
          </div>
          {alert.acknowledged && (
            <span className="text-xs text-slate-400">Acknowledged</span>
          )}
        </div>

        {/* Title & Description */}
        <h3 className={`font-bold ${config.textColor} mb-1`}>{alert.title}</h3>
        <p className="text-sm text-slate-600 mb-3">{alert.description}</p>

        {/* Metrics */}
        <div className="flex items-center gap-4 mb-3">
          {alert.dollarLeakagePerDay && (
            <div className="flex items-center gap-1 text-red-600">
              <DollarSign className="w-4 h-4" />
              <span className="text-sm font-bold">
                {formatCurrencyDelta(-alert.dollarLeakagePerDay, { compact: true })}/day
              </span>
            </div>
          )}
          {alert.deadline && (
            <div className="flex items-center gap-1 text-slate-600">
              <Clock className="w-4 h-4" />
              <span className="text-sm">
                Due: {new Date(alert.deadline).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        {!alert.acknowledged && (
          <div className="flex items-center gap-2">
            {alert.action && (
              <button
                onClick={() => onAction(alert.action!.type)}
                className="flex items-center gap-1 px-3 py-1.5 bg-[#002855] text-white text-sm font-medium rounded hover:bg-[#001a3d] transition-colors"
              >
                <Zap className="w-3 h-3" />
                {alert.action.label}
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
            <button
              onClick={onAcknowledge}
              className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded transition-colors"
            >
              Acknowledge
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default AlertInterruptDrawer;
