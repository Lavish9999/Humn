import type { DetectorProvider, DetectorRole } from '../types';
import { unavailableDetectorResult } from '../types';
import { createHiveProvider } from './hive';
import { createIlluminartyProvider } from './illuminarty';
import { createSightengineProvider } from './sightengine';

function unsupportedProvider(name: string, role: DetectorRole): DetectorProvider {
  return {
    name,
    role,
    configured: false,
    async analyze() {
      return unavailableDetectorResult(name, role, 'UNSUPPORTED_PROVIDER');
    },
  };
}

export function createDetectorProvider(name: string, role: DetectorRole): DetectorProvider {
  switch (name.trim().toLowerCase()) {
    case 'sightengine':
      return createSightengineProvider(role);
    case 'hive':
      return createHiveProvider(role);
    case 'illuminarty':
      return createIlluminartyProvider(role);
    default:
      return unsupportedProvider(name || 'unconfigured', role);
  }
}
