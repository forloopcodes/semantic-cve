export const cosineSim = (a: Float32Array, b: Float32Array): number => {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
};

export const arrToVec = (arr: number[]): Float32Array => new Float32Array(arr);

export const bufToVec = (buf: Buffer): Float32Array => new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);

export const vecToBuf = (vec: Float32Array): Buffer => Buffer.from(vec.buffer);

export const topK = (vecs: { id: string; vec: Float32Array }[], query: Float32Array, k: number): { id: string; score: number }[] => {
  const scored = vecs.map(v => ({ id: v.id, score: cosineSim(query, v.vec) }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
};

export const topKFromBuf = (items: { id: string; buf: Buffer }[], query: Float32Array, k: number, dim: number): { id: string; score: number }[] => {
  const scored = items.map(item => {
    const vec = new Float32Array(item.buf.buffer, item.buf.byteOffset, dim);
    return { id: item.id, score: cosineSim(query, vec) };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
};
