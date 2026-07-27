const SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

export function parseSemver(value) {
  if (typeof value !== 'string') return null;
  const match = SEMVER_PATTERN.exec(value);
  if (!match) return null;
  return Object.freeze({
    raw: value,
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    core: Object.freeze([match[1], match[2], match[3]]),
    prerelease: Object.freeze(match[4] ? match[4].split('.') : []),
    build: Object.freeze(match[5] ? match[5].split('.') : []),
  });
}

export const isSemver = value => parseSemver(value) !== null;

function compareIdentifier(left, right) {
  const leftNumeric = /^\d+$/.test(left);
  const rightNumeric = /^\d+$/.test(right);
  if (leftNumeric && rightNumeric) {
    if (left.length !== right.length) return left.length < right.length ? -1 : 1;
    return left.localeCompare(right, 'en');
  }
  if (leftNumeric) return -1;
  if (rightNumeric) return 1;
  return left.localeCompare(right, 'en');
}

export function compareSemver(leftValue, rightValue) {
  const left = parseSemver(leftValue);
  const right = parseSemver(rightValue);
  if (!left || !right) throw new TypeError('compareSemver requires two valid semantic versions');

  for (let index = 0; index < left.core.length; index += 1) {
    const result = compareIdentifier(left.core[index], right.core[index]);
    if (result !== 0) return result < 0 ? -1 : 1;
  }

  if (!left.prerelease.length && !right.prerelease.length) return 0;
  if (!left.prerelease.length) return 1;
  if (!right.prerelease.length) return -1;

  const length = Math.max(left.prerelease.length, right.prerelease.length);
  for (let index = 0; index < length; index += 1) {
    if (left.prerelease[index] === undefined) return -1;
    if (right.prerelease[index] === undefined) return 1;
    const result = compareIdentifier(left.prerelease[index], right.prerelease[index]);
    if (result !== 0) return result < 0 ? -1 : 1;
  }
  return 0;
}

export { SEMVER_PATTERN };
