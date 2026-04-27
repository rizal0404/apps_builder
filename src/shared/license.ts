import { LICENSE_PREFIX, LICENSE_TIERS, type LicenseTier } from './constants';

export interface LicenseInfo {
  raw: string;
  tier: LicenseTier;
  segments: string[];
}

const KEY_RE = new RegExp(
  `^${LICENSE_PREFIX}-[A-Z0-9]{3}-[A-Z0-9]{3}-[A-Z0-9]{3}-(FREE|PLUS|PRO)$`,
);

/** Parse a license key like `GSP-NBD-JSJ-5F8-PRO`. Throws on invalid format. */
export function parseLicense(raw: string): LicenseInfo {
  const trimmed = raw.trim().toUpperCase();
  if (!KEY_RE.test(trimmed)) {
    throw new Error(
      `Invalid license format. Expected ${LICENSE_PREFIX}-XXX-XXX-XXX-{${LICENSE_TIERS.join('|')}}.`,
    );
  }
  const segments = trimmed.split('-');
  const tier = segments[4] as LicenseTier;
  return { raw: trimmed, tier, segments };
}

export function isValidLicenseFormat(raw: string): boolean {
  try {
    parseLicense(raw);
    return true;
  } catch {
    return false;
  }
}
