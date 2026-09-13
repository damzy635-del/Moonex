import type { GroundingSource } from '../types';

export type ResearchStatus = 'idle' | 'planning' | 'searching' | 'synthesizing' | 'completed';
export type ResearchStep = 'planning' | 'searching' | 'synthesizing';
export type ResearchStepState = 'pending' | 'active' | 'complete';

const STEP_ORDER: ResearchStep[] = ['planning', 'searching', 'synthesizing'];

export function getResearchStepState(
  status: ResearchStatus,
  step: ResearchStep,
): ResearchStepState {
  if (status === 'completed') return 'complete';
  if (status === 'idle') return 'pending';

  const currentIndex = STEP_ORDER.indexOf(status as ResearchStep);
  const stepIndex = STEP_ORDER.indexOf(step);
  if (currentIndex < 0 || stepIndex < 0) return 'pending';
  if (stepIndex < currentIndex) return 'complete';
  if (stepIndex === currentIndex) return 'active';
  return 'pending';
}

export function normalizeResearchSources(sources: GroundingSource[]): GroundingSource[] {
  const seen = new Set<string>();
  const normalized: GroundingSource[] = [];

  for (const source of sources) {
    const title = source.title?.trim();
    const url = source.url?.trim();
    if (!title || !url || !/^https?:\/\//i.test(url)) continue;

    const key = url.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push({ title, url });
  }

  return normalized;
}
