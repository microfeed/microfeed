// Immutable get/set by a field path — mirrors the getByPath/setByPath the
// server-side item mapper (edge-src/registry/itemMapper.js) and serializer use,
// so the admin form reads and writes the SAME shape the API expects.
//
// A path is either a dot string ("showInNav", "a.b") or an array of segments
// (["_microfeed", "itunes:title"]) — the latter is required for fields whose
// feedMapping.source is nested (e.g. the itunes:* fields).

export function normalizePath(path) {
  if (Array.isArray(path)) {
    return path;
  }
  return String(path).split(".");
}

export function getByPath(obj, path) {
  const parts = normalizePath(path);
  let cursor = obj;
  for (const part of parts) {
    if (cursor === undefined || cursor === null) {
      return undefined;
    }
    cursor = cursor[part];
  }
  return cursor;
}

// Returns a shallow-cloned copy of `obj` with `value` set at `path`, cloning
// each object along the path so React state updates stay immutable.
export function setByPath(obj, path, value) {
  const parts = normalizePath(path);
  const root = Array.isArray(obj) ? [...obj] : {...(obj || {})};
  let cursor = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    const next = cursor[key];
    cursor[key] = next && typeof next === "object"
      ? (Array.isArray(next) ? [...next] : {...next})
      : {};
    cursor = cursor[key];
  }
  cursor[parts[parts.length - 1]] = value;
  return root;
}
