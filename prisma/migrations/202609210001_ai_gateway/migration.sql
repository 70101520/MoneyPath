CREATE TABLE "AiSettings" (
  "userId" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'OLLAMA',
  "ollamaUrl" TEXT NOT NULL DEFAULT 'http://ollama:11434',
  "ollamaModel" TEXT NOT NULL DEFAULT 'qwen3.5:4b-q4_K_M',
  "gptOssUrl" TEXT NOT NULL DEFAULT 'http://gpt-oss:8000/v1',
  "gptOssModel" TEXT NOT NULL DEFAULT 'openai/gpt-oss-20b',
  "openaiModel" TEXT NOT NULL DEFAULT 'gpt-5.5',
  "openaiApiKey" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiSettings_pkey" PRIMARY KEY ("userId"),
  CONSTRAINT "AiSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "AssistantMemory" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "searchText" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AssistantMemory_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AssistantMemory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "AssistantMemory_userId_updatedAt_idx" ON "AssistantMemory"("userId", "updatedAt");
