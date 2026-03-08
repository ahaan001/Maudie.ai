import type { RegulatoryProfile } from '@/types/regulatory';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsonLoader = () => Promise<any>;

const profileMap: Record<string, JsonLoader> = {
  fda_assistive_wearable: () => import('@/regulatory_profiles/fda_assistive_wearable.json'),
  fda_surgical: () => import('@/regulatory_profiles/fda_surgical.json'),
  ce_mdr: () => import('@/regulatory_profiles/ce_mdr.json'),
};

// Profiles are static at runtime — cache indefinitely in memory
const profileCache = new Map<string, RegulatoryProfile>();

export async function loadRegulatoryProfile(profileId: string): Promise<RegulatoryProfile> {
  if (profileCache.has(profileId)) return profileCache.get(profileId)!;
  const loader = profileMap[profileId] ?? profileMap['fda_assistive_wearable'];
  const mod = await loader();
  const profile = (mod.default ?? mod) as RegulatoryProfile;
  profileCache.set(profileId, profile);
  return profile;
}
