import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Send,
    Square,
    ChevronDown,
    ChevronRight,
    Bug,
    Settings,
    RotateCcw,
    User,
    Bot,
} from 'lucide-react';
import { useChannelList } from '@/api/endpoints/channel';
import { useTestChat, type ChatMessage, type Protocol, PROTOCOL_OPTIONS } from '@/api/endpoints/tester';
import { cn } from '@/lib/utils';

// ─── Helpers ────────────────────────────────────────────────────────────────

function extractModels(channels: Array<{ raw: { model: string; custom_model: string; enabled: boolean } }>): string[] {
    const modelSet = new Set<string>();
    for (const ch of channels) {
        if (!ch.raw.enabled) continue;
        for (const m of [...ch.raw.model.split(','), ...ch.raw.custom_model.split(',')]) {
            const trimmed = m.trim();
            if (trimmed) modelSet.add(trimmed);
        }
    }
    return Array.from(modelSet).sort();
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function renderContent(content: string): string {
    // Simple code block support: ```lang\ncode\n```
    const parts = content.split(/(```[\s\S]*?```)/g);
    return parts.map(part => {
        if (part.startsWith('```') && part.endsWith('```')) {
            const inner = part.slice(3, -3);
            const firstNewline = inner.indexOf('\n');
            const lang = firstNewline > 0 ? inner.slice(0, firstNewline).trim() : '';
            const code = firstNewline > 0 ? inner.slice(firstNewline + 1) : inner;
            return `<pre class="bg-muted rounded-md p-3 my-2 overflow-x-auto text-sm"><code class="language-${escapeHtml(lang)}">${escapeHtml(code)}</code></pre>`;
        }
        // Inline code
        const withInline = part.replace(/`([^`]+)`/g, '<code class="bg-muted px-1.5 py-0.5 rounded text-sm">$1</code>');
        // Newlines to <br>
        return `<p>${escapeHtml(withInline).replace(/\n/g, '<br/>')}</p>`;
    }).join('');
}

// ─── Component ──────────────────────────────────────────────────────────────

export function Tester() {
    const { data: channels } = useChannelList();
    const { chat, messages, isStreaming, error, stop, reset, lastRequest, lastResponse } = useTestChat();

    const [model, setModel] = useState('');
    const [protocol, setProtocol] = useState<Protocol>('openai-chat');
    const [stream, setStream] = useState(true);
    const [temperature, setTemperature] = useState(1.0);
    const [maxTokens, setMaxTokens] = useState<number | ''>('');
    const [systemPrompt, setSystemPrompt] = useState('');
    const [input, setInput] = useState('');
    const [showParams, setShowParams] = useState(false);
    const [showDebug, setShowDebug] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const models = useMemo(() => extractModels(channels ?? []), [channels]);

    const activeModel = model && models.includes(model) ? model : models[0] ?? '';

    // Auto-scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = useCallback(() => {
        const trimmed = input.trim();
        if (!trimmed || !activeModel || isStreaming) return;

        const userMessages: ChatMessage[] = [];
        if (systemPrompt.trim()) {
            userMessages.push({ role: 'system', content: systemPrompt.trim() });
        }
        userMessages.push({ role: 'user', content: trimmed });

        chat(activeModel, userMessages, {
            temperature,
            maxTokens: maxTokens === '' ? undefined : maxTokens,
            stream,
            protocol,
        });

        setInput('');
        inputRef.current?.focus();
    }, [input, activeModel, isStreaming, systemPrompt, temperature, maxTokens, stream, protocol, chat]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] max-w-4xl mx-auto">
            {/* Top Bar */}
            <div className="flex items-center gap-3 p-4 border-b">
                <div className="flex-1">
                    <Select value={activeModel} onValueChange={setModel}>
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select a model..." />
                        </SelectTrigger>
                        <SelectContent>
                            {models.map(m => (
                                <SelectItem key={m} value={m}>{m}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <Select value={protocol} onValueChange={(v) => setProtocol(v as Protocol)}>
                    <SelectTrigger className="w-40">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {PROTOCOL_OPTIONS.map(p => (
                            <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Stream</span>
                    <Switch checked={stream} onCheckedChange={setStream} />
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={reset}
                    title="Reset conversation"
                >
                    <RotateCcw className="size-4" />
                </Button>
            </div>

            {/* Parameter Panel */}
            <div className="border-b">
                <button
                    className="flex items-center gap-2 w-full px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setShowParams(!showParams)}
                >
                    {showParams ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                    <Settings className="size-4" />
                    Parameters
                </button>
                {showParams && (
                    <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                            <label className="text-sm font-medium mb-1 block">
                                Temperature: {temperature.toFixed(1)}
                            </label>
                            <input
                                type="range"
                                min="0"
                                max="2"
                                step="0.1"
                                value={temperature}
                                onChange={e => setTemperature(parseFloat(e.target.value))}
                                className="w-full accent-primary"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-1 block">Max Tokens</label>
                            <input
                                type="number"
                                min="1"
                                placeholder="auto"
                                value={maxTokens}
                                onChange={e => setMaxTokens(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                                className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs focus-visible:ring-[3px] focus-visible:ring-ring/50 outline-none"
                            />
                        </div>
                        <div className="sm:col-span-3">
                            <label className="text-sm font-medium mb-1 block">System Prompt</label>
                            <textarea
                                value={systemPrompt}
                                onChange={e => setSystemPrompt(e.target.value)}
                                placeholder="Optional system prompt..."
                                rows={2}
                                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs focus-visible:ring-[3px] focus-visible:ring-ring/50 outline-none resize-none"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                        <Bot className="size-12 mb-4 opacity-30" />
                        <p className="text-lg font-medium">Model Tester</p>
                        <p className="text-sm">Select a model and start chatting</p>
                    </div>
                )}
                {messages.map((msg, i) => (
                    <div
                        key={i}
                        className={cn(
                            'flex gap-3',
                            msg.role === 'user' ? 'justify-end' : 'justify-start',
                        )}
                    >
                        {msg.role !== 'user' && (
                            <div className="flex-shrink-0 mt-1">
                                <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center">
                                    <Bot className="size-4 text-primary" />
                                </div>
                            </div>
                        )}
                        <div
                            className={cn(
                                'max-w-[80%] rounded-lg px-4 py-2.5 text-sm',
                                msg.role === 'user'
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted',
                            )}
                        >
                            {msg.role === 'system' && (
                                <Badge variant="outline" className="mb-1 text-xs">system</Badge>
                            )}
                            {msg.role === 'user' ? (
                                <p className="whitespace-pre-wrap">{msg.content}</p>
                            ) : (
                                <div
                                    className="prose prose-sm dark:prose-invert max-w-none [&_pre]:my-2 [&_code]:text-sm"
                                    dangerouslySetInnerHTML={{ __html: renderContent(msg.content) }}
                                />
                            )}
                        </div>
                        {msg.role === 'user' && (
                            <div className="flex-shrink-0 mt-1">
                                <div className="size-8 rounded-full bg-secondary flex items-center justify-center">
                                    <User className="size-4" />
                                </div>
                            </div>
                        )}
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* Error */}
            {error && (
                <div className="mx-4 mb-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                    {error}
                </div>
            )}

            {/* Input Area */}
            <div className="border-t p-4">
                <div className="flex gap-2">
                    <textarea
                        ref={inputRef}
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Type a message... (Enter to send, Shift+Enter for newline)"
                        rows={2}
                        disabled={isStreaming}
                        className="flex-1 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs focus-visible:ring-[3px] focus-visible:ring-ring/50 outline-none resize-none disabled:opacity-50"
                    />
                    {isStreaming ? (
                        <Button variant="destructive" size="icon" onClick={stop} title="Stop">
                            <Square className="size-4" />
                        </Button>
                    ) : (
                        <Button
                            size="icon"
                            onClick={handleSend}
                            disabled={!input.trim() || !activeModel}
                            title="Send"
                        >
                            <Send className="size-4" />
                        </Button>
                    )}
                </div>
            </div>

            {/* Debug Panel */}
            <div className="border-t">
                <button
                    className="flex items-center gap-2 w-full px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setShowDebug(!showDebug)}
                >
                    {showDebug ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                    <Bug className="size-4" />
                    Debug
                </button>
                {showDebug && (
                    <div className="px-4 pb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">Last Request</p>
                            <pre className="bg-muted rounded-md p-3 text-xs overflow-auto max-h-48 whitespace-pre-wrap">
                                {lastRequest || '(none)'}
                            </pre>
                        </div>
                        <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">Last Response Events</p>
                            <pre className="bg-muted rounded-md p-3 text-xs overflow-auto max-h-48 whitespace-pre-wrap">
                                {lastResponse || '(none)'}
                            </pre>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
