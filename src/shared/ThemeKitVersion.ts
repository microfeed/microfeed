import {major, prerelease} from "semver";

export function themeKitCompatibilityRange(version: string): string {
  const releaseMajor = major(version);
  if (releaseMajor === 0) {
    return `^${version}`;
  }
  if (prerelease(version)) {
    return `>=${version} <${releaseMajor + 1}.0.0`;
  }
  return `^${releaseMajor}.0.0`;
}
