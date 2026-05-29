import { EMBEDDING_MODEL } from '@semantic-cve/shared';

const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434';

export const embed = async (text: string): Promise<number[]> => {
  const res = await fetch(`${OLLAMA_URL}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: EMBEDDING_MODEL, prompt: text }),
  });
  if (!res.ok) throw new Error(`Ollama error: ${res.status}`);
  const data = await res.json() as { embedding: number[]; error?: string };
  if (data.error) throw new Error(`Ollama: ${data.error}`);
  return data.embedding;
};

export const embedBatch = async (texts: string[]): Promise<number[][]> => {
  const res = await fetch(`${OLLAMA_URL}/api/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: texts }),
  });
  if (!res.ok) throw new Error(`Ollama batch error: ${res.status}`);
  const data = await res.json() as { embeddings: number[][]; error?: string };
  if (data.error) throw new Error(`Ollama batch: ${data.error}`);
  return data.embeddings;
};

export const healthCheck = async (): Promise<boolean> => {
  try { return (await fetch(`${OLLAMA_URL}/api/tags`)).ok; }
  catch { return false; }
};
