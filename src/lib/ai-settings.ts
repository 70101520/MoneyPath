import { db } from './db';
import { decrypt } from './security';

export type AiProvider = 'OLLAMA' | 'GPT_OSS' | 'OPENAI';
export type AiRuntime = {
  provider: AiProvider;
  baseUrl: string;
  model: string;
  apiKey?: string;
};

export async function aiRuntime(userId: string): Promise<AiRuntime> {
  const row = await db.aiSettings.findUnique({ where: { userId } });
  const provider = (row?.provider ?? 'OLLAMA') as AiProvider;
  if (provider === 'GPT_OSS')
    return {
      provider,
      baseUrl: row?.gptOssUrl ?? process.env.GPT_OSS_BASE_URL ?? 'http://gpt-oss:8000/v1',
      model: row?.gptOssModel ?? process.env.GPT_OSS_MODEL ?? 'openai/gpt-oss-20b',
    };
  if (provider === 'OPENAI')
    return {
      provider,
      baseUrl: 'https://api.openai.com/v1',
      model: row?.openaiModel ?? process.env.OPENAI_MODEL ?? 'gpt-5.5',
      apiKey: decrypt(row?.openaiApiKey ?? null) ?? process.env.OPENAI_API_KEY,
    };
  return {
    provider: 'OLLAMA',
    baseUrl: row?.ollamaUrl ?? process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434',
    model: row?.ollamaModel ?? process.env.OLLAMA_MODEL ?? 'qwen3.5:4b-q4_K_M',
  };
}
