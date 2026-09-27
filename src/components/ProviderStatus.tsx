import React from 'react';
import { CheckCircle2, CircleAlert, Clock3, Loader2, XCircle } from 'lucide-react';

export type ProviderHealth = {
  status: 'unknown' | 'checking' | 'active' | 'invalid' | 'rate_limited' | 'unavailable' | 'not_configured' | string;
  verified: boolean;
  checked_at?: number | null;
  latency_ms?: number | null;
  reason?: string | null;
  retry_after?: number | null;
};

interface ProviderStatusProps {
  health: Record<string, ProviderHealth>;
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
}

const PROVIDERS = [
  { id: 'openai', name: 'OpenAI' },
  { id: 'google', name: 'Google' },
  { id: 'mistral', name: 'Mistral' },
  { id: 'groq', name: 'Groq' },
];

function stateFor(status: string) {
  switch (status) {
    case 'active':
      return { label: 'Verified', icon: CheckCircle2, className: 'text-emerald-400', detail: 'Credentials verified' };
    case 'invalid':
      return { label: 'Invalid', icon: XCircle, className: 'text-rose-400', detail: 'Credentials rejected' };
    case 'rate_limited':
      return { label: 'Rate Limited', icon: Clock3, className: 'text-amber-400', detail: 'Provider is temporarily rate limited' };
    case 'unavailable':
      return { label: 'Unavailable', icon: CircleAlert, className: 'text-amber-400', detail: 'Provider could not be reached' };
    case 'checking':
      return { label: 'Checking…', icon: Loader2, className: 'text-sky-400', detail: 'Verifying credentials' };
    case 'not_configured':
      return { label: 'Not Configured', icon: CircleAlert, className: 'text-gray-500', detail: 'No provider credential configured' };
    default:
      return { label: 'Not Verified', icon: CircleAlert, className: 'text-gray-400', detail: 'Credentials have not been verified yet' };
  }
}

export const ProviderStatus: React.FC<ProviderStatusProps> = ({ health, loading = false, error = null, onRefresh }) => (
  <div className="space-y-3">
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="text-sm font-semibold text-gray-200">Provider Credential Status</div>
        <p className="mt-1 text-xs leading-relaxed text-gray-500">
          Moonex checks configured provider credentials through the server. API keys are never shown here.
        </p>
      </div>
      {onRefresh && (
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="shrink-0 rounded-lg border border-gray-700 bg-[#1f1f1f] px-3 py-1.5 text-xs font-semibold text-gray-300 hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Checking…' : 'Refresh'}
        </button>
      )}
    </div>

    {error && (
      <div className="rounded-lg border border-rose-900/60 bg-rose-950/20 px-3 py-2 text-xs text-rose-300">
        {error}
      </div>
    )}

    <div className="grid gap-2">
      {PROVIDERS.map((provider) => {
        const current = health[provider.id];
        const state = stateFor(current?.status || 'unknown');
        const Icon = state.icon;
        return (
          <div key={provider.id} className="flex items-center justify-between gap-3 rounded-xl border border-gray-800 bg-[#1f1f1f] px-3 py-2.5">
            <div className="flex min-w-0 items-center gap-2.5">
              <Icon className={`h-4 w-4 shrink-0 ${state.className} ${current?.status === 'checking' ? 'animate-spin' : ''}`} />
              <div className="min-w-0">
                <div className="text-xs font-semibold text-gray-200">{provider.name}</div>
                <div className="text-[10px] text-gray-500">{state.detail}</div>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className={`text-xs font-semibold ${state.className}`}>{state.label}</div>
              {typeof current?.latency_ms === 'number' && (
                <div className="text-[10px] text-gray-600">{Math.round(current.latency_ms)} ms</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  </div>
);
