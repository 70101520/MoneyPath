'use client';
import { useEffect, useState } from 'react';

type Settings = {
  provider: 'OLLAMA' | 'GPT_OSS' | 'OPENAI';
  ollamaUrl: string;
  ollamaModel: string;
  gptOssUrl: string;
  gptOssModel: string;
  openaiModel: string;
  openaiApiKey?: string;
  openaiKeyConfigured: boolean;
};
const defaults: Settings = {
  provider: 'OLLAMA', ollamaUrl: 'http://ollama:11434', ollamaModel: 'qwen3.5:4b-q4_K_M',
  gptOssUrl: 'http://gpt-oss:8000/v1', gptOssModel: 'openai/gpt-oss-20b',
  openaiModel: 'gpt-5.5', openaiKeyConfigured: false,
};

export function AiMode({ demo }: { demo: boolean }) {
  const [settings, setSettings] = useState(defaults);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [memory, setMemory] = useState('');
  const [memories, setMemories] = useState<{ id: string; content: string }[]>([]);
  useEffect(() => {
    if (!demo) {
      void fetch('/api/ai-settings').then((r) => r.json()).then(setSettings);
      void fetch('/api/assistant-memory').then((r) => r.json()).then((body) => setMemories(body.memories ?? []));
    }
  }, [demo]);
  const update = (key: keyof Settings, value: string | boolean) =>
    setSettings((current) => ({ ...current, [key]: value }));
  async function save() {
    if (demo) return setMessage('Sign in to change the AI provider.');
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/ai-settings', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setMessage('AI provider saved. Ask MoneyPath will use it from the next message.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to save.'); }
    finally { setBusy(false); }
  }
  async function test() {
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/ai-settings/test', { method: 'POST' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setMessage(`${body.provider} is reachable. Model: ${body.model}.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Provider unavailable.'); }
    finally { setBusy(false); }
  }
  async function addMemory() {
    const response = await fetch('/api/assistant-memory', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: memory }) });
    const body = await response.json();
    if (!response.ok) return setMessage(body.error);
    setMemories((rows) => [{ id: body.id, content: memory }, ...rows]); setMemory(''); setMessage('Preference saved to encrypted assistant memory.');
  }
  async function removeMemory(id: string) {
    const response = await fetch('/api/assistant-memory', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    if (response.ok) setMemories((rows) => rows.filter((row) => row.id !== id));
  }
  const cards = [
    { id: 'OLLAMA' as const, title: 'Ollama', text: 'Local inference. Financial context stays on your machine.' },
    { id: 'GPT_OSS' as const, title: 'GPT-OSS-20B Local', text: 'Separate local OpenAI-compatible inference service.' },
    { id: 'OPENAI' as const, title: 'OpenAI API', text: 'Cloud provider. Your question and relevant financial context leave this server.' },
  ];
  return <div className="planning ai-mode">
    <section className="panel planning-insights">
      <h2>AI Mode</h2>
      <p>Choose one default provider for Ask MoneyPath. Finance calculations and balances always come from MoneyPath, regardless of provider.</p>
      <div className="provider-grid">
        {cards.map((card) => <button type="button" key={card.id} className={`provider-card ${settings.provider === card.id ? 'active' : ''}`} onClick={() => update('provider', card.id)}>
          <span className={`badge ${settings.provider === card.id ? 'green' : 'neutral'}`}>{settings.provider === card.id ? 'Active' : 'Inactive'}</span>
          <strong>{card.title}</strong><small>{card.text}</small>
        </button>)}
      </div>
      {settings.provider === 'OPENAI' && <div className="information warning"><div><strong>External cloud mode</strong><p>Relevant MoneyPath financial context will be sent to OpenAI for this mode.</p></div></div>}
    </section>
    <section className="panel planning-insights">
      <h2>Provider configuration</h2>
      <div className="form-grid">
        <label>Ollama endpoint<input value={settings.ollamaUrl} onChange={(e) => update('ollamaUrl', e.target.value)} /></label>
        <label>Ollama model<input value={settings.ollamaModel} onChange={(e) => update('ollamaModel', e.target.value)} /></label>
        <label>GPT-OSS endpoint<input value={settings.gptOssUrl} onChange={(e) => update('gptOssUrl', e.target.value)} /></label>
        <label>GPT-OSS model<input value={settings.gptOssModel} onChange={(e) => update('gptOssModel', e.target.value)} /></label>
        <label>OpenAI model<input value={settings.openaiModel} onChange={(e) => update('openaiModel', e.target.value)} /></label>
        <label>OpenAI API key<input type="password" value={settings.openaiApiKey ?? ''} placeholder={settings.openaiKeyConfigured ? 'Key already stored; leave blank to keep it' : 'sk-…'} autoComplete="off" onChange={(e) => update('openaiApiKey', e.target.value)} /></label>
      </div>
      <div className="inline-actions"><button className="button primary" disabled={busy} onClick={save}>Save AI mode</button><button className="button secondary" disabled={busy || demo} onClick={test}>Test active provider</button></div>
      {message && <p role="status">{message}</p>}
    </section>
    <section className="panel planning-insights"><h2>Assistant memory</h2><p>Save stable preferences such as language or response style. Money values and financial records are rejected here and always read from MoneyPath.</p><div className="inline-actions"><input value={memory} maxLength={300} placeholder="Example: Explain in simple Hinglish" onChange={(e) => setMemory(e.target.value)} /><button className="button secondary" disabled={!memory.trim() || demo} onClick={addMemory}>Add memory</button></div>{memories.map((item) => <p key={item.id}>{item.content} <button className="text-button" onClick={() => removeMemory(item.id)}>Delete</button></p>)}</section>
    <section className="panel planning-insights"><h2>Local voice service</h2><p>Voice uses the same chat endpoint and active provider. Wake word, VAD, speech recognition and speech synthesis run as separate local services; no Alexa or Amazon cloud dependency is used.</p><p className="muted">The local speech service must be configured before microphone controls are enabled.</p></section>
  </div>;
}
