import { useCallback, useRef, useState } from 'react';
import { API_BASE_URL } from '../client';

export type ChatMessage = {
    role: 'user' | 'assistant' | 'system';
    content: string;
};

export type Protocol = 'openai-chat' | 'anthropic' | 'gemini' | 'volcengine';

export const PROTOCOL_OPTIONS: { value: Protocol; label: string }[] = [
    { value: 'openai-chat', label: 'OpenAI Chat' },
    { value: 'anthropic', label: 'Anthropic' },
    { value: 'gemini', label: 'Gemini' },
    { value: 'volcengine', label: 'Volcengine' },
];

export type ChatParams = {
    temperature?: number;
    maxTokens?: number;
    stream?: boolean;
    protocol?: Protocol;
};

// ─── SSE Response Parsing ──────────────────────────────────────────────────

function extractDeltaContent(protocol: Protocol, data: string): string | null {
    try {
        const parsed = JSON.parse(data);
        switch (protocol) {
            case 'anthropic': {
                // Anthropic: {"type":"content_block_delta","delta":{"type":"text_delta","text":"..."}}
                if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                    return parsed.delta.text;
                }
                return null;
            }
            case 'gemini': {
                // Gemini: {"candidates":[{"content":{"parts":[{"text":"..."}]}}]}
                const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
                return text || null;
            }
            default: {
                // OpenAI / Volcengine: {"choices":[{"delta":{"content":"..."}}]}
                return parsed.choices?.[0]?.delta?.content ?? null;
            }
        }
    } catch {
        return null;
    }
}

function extractNonStreamContent(protocol: Protocol, data: any): string {
    switch (protocol) {
        case 'anthropic': {
            // Anthropic: {"content":[{"type":"text","text":"..."}]}
            const blocks = data.content;
            if (Array.isArray(blocks)) {
                return blocks
                    .filter((b: any) => b.type === 'text')
                    .map((b: any) => b.text)
                    .join('');
            }
            return JSON.stringify(data);
        }
        case 'gemini': {
            // Gemini: {"candidates":[{"content":{"parts":[{"text":"..."}]}}]}
            return data.candidates?.[0]?.content?.parts?.[0]?.text ?? JSON.stringify(data);
        }
        default: {
            // OpenAI / Volcengine
            return data.choices?.[0]?.message?.content ?? JSON.stringify(data);
        }
    }
}

// ─── Hook ──────────────────────────────────────────────────────────────────

export function useTestChat() {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isStreaming, setIsStreaming] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastRequest, setLastRequest] = useState<string>('');
    const [lastResponse, setLastResponse] = useState<string>('');
    const abortRef = useRef<AbortController | null>(null);

    const chat = useCallback(async (
        model: string,
        userMessages: ChatMessage[],
        params?: ChatParams,
    ) => {
        const protocol = params?.protocol ?? 'openai-chat';
        setIsStreaming(true);
        setError(null);
        setLastResponse('');

        const controller = new AbortController();
        abortRef.current = controller;

        const requestBody = {
            model,
            protocol,
            messages: userMessages.map(m => ({ role: m.role, content: m.content })),
            temperature: params?.temperature,
            max_tokens: params?.maxTokens,
            stream: params?.stream ?? true,
        };

        setLastRequest(JSON.stringify(requestBody, null, 2));

        // Add user message to state
        const userMsg = userMessages[userMessages.length - 1];
        if (userMsg?.role === 'user') {
            setMessages(prev => [...prev, { role: 'user', content: userMsg.content }]);
        }

        try {
            const token = typeof window !== 'undefined'
                ? (() => {
                    try {
                        const raw = localStorage.getItem('auth-storage');
                        return raw ? JSON.parse(raw)?.state?.token : null;
                    } catch { return null; }
                })()
                : null;

            const resp = await fetch(`${API_BASE_URL}/api/v1/test/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'text/event-stream',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
                },
                body: JSON.stringify(requestBody),
                signal: controller.signal,
            });

            if (!resp.ok) {
                const text = await resp.text();
                throw new Error(text || `HTTP ${resp.status}`);
            }

            if (params?.stream === false) {
                const data = await resp.json();
                const content = extractNonStreamContent(protocol, data);
                setMessages(prev => [...prev, { role: 'assistant', content }]);
                setLastResponse(JSON.stringify(data, null, 2));
                return;
            }

            // SSE streaming
            const reader = resp.body?.getReader();
            if (!reader) throw new Error('No response body');

            const decoder = new TextDecoder();
            let buffer = '';
            let assistantContent = '';
            let responseLog = '';

            setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed.startsWith('data: ')) continue;
                    const data = trimmed.slice(6);
                    if (data === '[DONE]') {
                        responseLog += 'data: [DONE]\n';
                        continue;
                    }

                    responseLog += `data: ${data}\n`;

                    const delta = extractDeltaContent(protocol, data);
                    if (delta) {
                        assistantContent += delta;
                        setMessages(prev => {
                            const updated = [...prev];
                            const last = updated[updated.length - 1];
                            if (last?.role === 'assistant') {
                                updated[updated.length - 1] = { ...last, content: assistantContent };
                            }
                            return updated;
                        });
                    }
                }
            }

            setLastResponse(responseLog);
        } catch (err: unknown) {
            if (err instanceof DOMException && err.name === 'AbortError') return;
            const msg = err instanceof Error ? err.message : String(err);
            setError(msg);
            // Remove empty assistant placeholder on error
            setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant' && last.content === '') {
                    return prev.slice(0, -1);
                }
                return prev;
            });
        } finally {
            setIsStreaming(false);
            abortRef.current = null;
        }
    }, []);

    const stop = useCallback(() => {
        abortRef.current?.abort();
    }, []);

    const reset = useCallback(() => {
        setMessages([]);
        setError(null);
        setLastRequest('');
        setLastResponse('');
    }, []);

    return { chat, messages, isStreaming, error, stop, reset, lastRequest, lastResponse };
}
