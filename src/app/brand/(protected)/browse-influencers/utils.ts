export function pruneEmpty<T>(obj: T): T {
if (obj && typeof obj === 'object') {
for (const key of Object.keys(obj as any)) {
const v = (obj as any)[key];
if (v == null) { delete (obj as any)[key]; continue; }
if (Array.isArray(v)) {
if (v.length === 0) { delete (obj as any)[key]; continue; }
} else if (typeof v === 'object') {
(obj as any)[key] = pruneEmpty(v);
if (Object.keys((obj as any)[key]).length === 0) delete (obj as any)[key];
}
if (typeof v === 'number' && Number.isNaN(v)) delete (obj as any)[key];
}
}
return obj;
}