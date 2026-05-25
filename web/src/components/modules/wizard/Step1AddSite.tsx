'use client';

import { useCallback, useMemo, useRef, useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useCreateSite, useCreateSiteAccount, useDetectSitePlatform, useSiteList, SitePlatform, SiteCredentialType, type Site } from '@/api/endpoints/site';
import { parseTokenExpiresAtInput } from '@/lib/site-token';
import { useJumpStore } from '@/stores/jump';
import { useWizardStore } from './store';

const PLATFORM_OPTIONS = [
    { value: SitePlatform.NewAPI, label: 'New API' },
    { value: SitePlatform.Sub2API, label: 'Sub2API' },
    { value: SitePlatform.OpenAI, label: 'OpenAI' },
    { value: SitePlatform.Claude, label: 'Claude' },
    { value: SitePlatform.Gemini, label: 'Gemini' },
    { value: SitePlatform.OneAPI, label: 'One API' },
    { value: SitePlatform.OneHub, label: 'One Hub' },
    { value: SitePlatform.AnyRouter, label: 'AnyRouter' },
    { value: SitePlatform.DoneHub, label: 'Done Hub' },
];

const CREDENTIAL_LABELS: Record<SiteCredentialType, string> = {
    [SiteCredentialType.UsernamePassword]: '用户名 / 密码',
    [SiteCredentialType.AccessToken]: 'Access Token',
    [SiteCredentialType.APIKey]: 'API Key',
};

const CREDENTIAL_DESCRIPTIONS: Partial<Record<SiteCredentialType, string>> = {
    [SiteCredentialType.UsernamePassword]: '登录站点后自动获取 Session Token',
    [SiteCredentialType.AccessToken]: '用于管理站点、同步分组与创建网站 Key',
    [SiteCredentialType.APIKey]: '直接用网站 API Key 同步模型与代理转发',
};

const CHECKIN_CAPABLE_PLATFORMS = new Set<SitePlatform>([
    SitePlatform.NewAPI,
    SitePlatform.OneAPI,
    SitePlatform.OneHub,
    SitePlatform.AnyRouter,
]);

const OFFICIAL_API_PLATFORMS = new Set<SitePlatform>([
    SitePlatform.OpenAI,
    SitePlatform.Claude,
    SitePlatform.Gemini,
]);

function defaultCredentialType(platform: SitePlatform): SiteCredentialType {
    if (platform === SitePlatform.Sub2API) {
        return SiteCredentialType.AccessToken;
    }
    if (OFFICIAL_API_PLATFORMS.has(platform)) {
        return SiteCredentialType.APIKey;
    }
    return SiteCredentialType.UsernamePassword;
}

function credentialOptionsForPlatform(platform: SitePlatform | ''): SiteCredentialType[] {
    if (platform && OFFICIAL_API_PLATFORMS.has(platform)) {
        return [SiteCredentialType.APIKey, SiteCredentialType.AccessToken];
    }
    if (platform === SitePlatform.Sub2API) {
        return [SiteCredentialType.AccessToken, SiteCredentialType.APIKey];
    }
    return [SiteCredentialType.UsernamePassword, SiteCredentialType.AccessToken, SiteCredentialType.APIKey];
}

function credentialPlaceholder(type: SiteCredentialType) {
    if (type === SiteCredentialType.APIKey) {
        return '粘贴网站生成的 API Key';
    }
    if (type === SiteCredentialType.AccessToken) {
        return '粘贴 Session Access Token / Cookie';
    }
    return '用户名 / 密码';
}

function canUseAutoCheckin(siteType: 'free' | 'paid', platform: SitePlatform | '', credentialType: SiteCredentialType) {
    if (siteType !== 'free') return false;
    if (credentialType === SiteCredentialType.APIKey) return false;
    if (!platform) return true;
    return CHECKIN_CAPABLE_PLATFORMS.has(platform);
}

function autoCheckinHint(siteType: 'free' | 'paid', platform: SitePlatform | '', credentialType: SiteCredentialType) {
    if (siteType === 'paid') return '付费站点不需要自动签到';
    if (credentialType === SiteCredentialType.APIKey) return 'API Key 凭证无法执行站点签到';
    if (platform && !CHECKIN_CAPABLE_PLATFORMS.has(platform)) return '当前平台不支持自动签到';
    return '开启后会按站点自动化任务定期签到';
}

type DuplicateSitePrompt = {
    site: Site;
    normalizedUrl: string;
};

function normalizeComparableSiteUrl(value: string) {
    let trimmed = value.trim();
    if (!trimmed) return '';

    if (trimmed.startsWith('//')) {
        trimmed = `https:${trimmed}`;
    } else if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)) {
        trimmed = `https://${trimmed}`;
    }

    try {
        const parsed = new URL(trimmed);
        const path = parsed.pathname.replace(/\/+$/, '');
        return `${parsed.protocol.toLowerCase()}//${parsed.hostname.toLowerCase()}${parsed.port ? `:${parsed.port}` : ''}${path === '/' ? '' : path}${parsed.search}`;
    } catch {
        return trimmed.replace(/\/+$/, '').toLowerCase();
    }
}

function getErrorMessage(err: unknown, fallback: string) {
    return err && typeof err === 'object' && 'message' in err && typeof err.message === 'string'
        ? err.message
        : fallback;
}

export function Step1AddSite() {
    const { setStep, setSiteId, setAccountId, setCredentialType: setWizardCredentialType } = useWizardStore();
    const createSite = useCreateSite();
    const createAccount = useCreateSiteAccount();
    const detectPlatform = useDetectSitePlatform();
    const requestJump = useJumpStore((state) => state.requestJump);
    const { data: existingSites, isLoading: isSitesLoading, refetch: refetchSites } = useSiteList();

    const [name, setName] = useState('');
    const [baseUrl, setBaseUrl] = useState('');
    const [platform, setPlatform] = useState<string>('');
    const [siteType, setSiteType] = useState<'free' | 'paid'>('free');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [token, setToken] = useState('');
    const [refreshToken, setRefreshToken] = useState('');
    const [tokenExpiresAt, setTokenExpiresAt] = useState('');
    const [platformUserId, setPlatformUserId] = useState('');
    const [credentialType, setCredentialType] = useState<SiteCredentialType>(SiteCredentialType.UsernamePassword);
    const [autoCheckin, setAutoCheckin] = useState(true);
    const [detectingUrl, setDetectingUrl] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [duplicateSiteDialogOpen, setDuplicateSiteDialogOpen] = useState(false);
    const [duplicateSitePrompt, setDuplicateSitePrompt] = useState<DuplicateSitePrompt | null>(null);
    const currentBaseUrlRef = useRef('');
    const lastDetectedUrlRef = useRef('');
    const pendingDetectionRef = useRef<Promise<SitePlatform | ''> | null>(null);
    const pendingDetectionUrlRef = useRef('');
    const pendingDetectionFeedbackRef = useRef(false);
    const detectionRunIdRef = useRef(0);
    const platformSelectionVersionRef = useRef(0);
    const selectedPlatformRef = useRef<SitePlatform | ''>('');

    const selectedPlatform = platform as SitePlatform | '';
    const credentialOptions = useMemo(
        () => credentialOptionsForPlatform(selectedPlatform),
        [selectedPlatform],
    );
    const autoCheckinEnabled = canUseAutoCheckin(siteType, selectedPlatform, credentialType);
    const effectiveAutoCheckin = autoCheckinEnabled && autoCheckin;
    const showSub2APITokenFields = selectedPlatform === SitePlatform.Sub2API
        && credentialType === SiteCredentialType.AccessToken;
    const showUsernamePasswordFields = credentialType === SiteCredentialType.UsernamePassword;

    const applyPlatform = useCallback((nextPlatform: SitePlatform) => {
        selectedPlatformRef.current = nextPlatform;
        setPlatform(nextPlatform);
        const nextOptions = credentialOptionsForPlatform(nextPlatform);
        if (!nextOptions.includes(SiteCredentialType.UsernamePassword)) {
            setUsername('');
            setPassword('');
        }
        if (nextPlatform !== SitePlatform.Sub2API) {
            setRefreshToken('');
            setTokenExpiresAt('');
        }
        setCredentialType((current) => {
            return nextOptions.includes(current) ? current : defaultCredentialType(nextPlatform);
        });
    }, []);

    const findDuplicateSite = useCallback(async (rawUrl: string, forceRefresh: boolean) => {
        const normalizedUrl = normalizeComparableSiteUrl(rawUrl);
        if (!normalizedUrl) return null;

        let sites = existingSites ?? [];
        if (forceRefresh) {
            const result = await refetchSites();
            if (result.error && !result.data) {
                throw result.error;
            }
            sites = result.data ?? sites;
        }

        return sites.find((site) => (
            !site.archived && normalizeComparableSiteUrl(site.base_url) === normalizedUrl
        )) ?? null;
    }, [existingSites, refetchSites]);

    const showDuplicateSitePrompt = useCallback((site: Site, rawUrl: string) => {
        setDuplicateSitePrompt({
            site,
            normalizedUrl: normalizeComparableSiteUrl(rawUrl),
        });
        setDuplicateSiteDialogOpen(true);
    }, []);

    const handleJumpToDuplicateSite = useCallback(() => {
        if (!duplicateSitePrompt) return;
        setDuplicateSiteDialogOpen(false);
        requestJump({ kind: 'site-channel-card', siteId: duplicateSitePrompt.site.id });
    }, [duplicateSitePrompt, requestJump]);

    const handleDetectBaseUrl = useCallback(async (showFeedback: boolean): Promise<SitePlatform | ''> => {
        const trimmedUrl = baseUrl.trim();
        currentBaseUrlRef.current = trimmedUrl;
        if (!trimmedUrl) {
            if (showFeedback) toast.error('请先输入站点 URL');
            return '';
        }
        if (pendingDetectionRef.current && pendingDetectionUrlRef.current === trimmedUrl) {
            if (showFeedback) {
                pendingDetectionFeedbackRef.current = true;
            }
            return pendingDetectionRef.current;
        }
        if (!showFeedback && lastDetectedUrlRef.current === trimmedUrl && selectedPlatformRef.current) {
            return selectedPlatformRef.current;
        }

        const platformVersion = platformSelectionVersionRef.current;
        const detectionRunId = detectionRunIdRef.current + 1;
        detectionRunIdRef.current = detectionRunId;
        pendingDetectionFeedbackRef.current = showFeedback;
        const detection = (async () => {
            setDetectingUrl(true);
            try {
                try {
                    const duplicateSite = await findDuplicateSite(trimmedUrl, pendingDetectionFeedbackRef.current);
                    if (duplicateSite) {
                        if (detectionRunIdRef.current === detectionRunId && pendingDetectionFeedbackRef.current) {
                            showDuplicateSitePrompt(duplicateSite, trimmedUrl);
                        }
                        return '';
                    }
                } catch (err: unknown) {
                    if (detectionRunIdRef.current === detectionRunId && pendingDetectionFeedbackRef.current) {
                        toast.error('检查已有站点失败', { description: getErrorMessage(err, '请稍后重试') });
                    }
                }

                const detected = await detectPlatform.mutateAsync(trimmedUrl);
                const nextPlatform = detected.platform as SitePlatform;
                if (!nextPlatform) {
                    if (detectionRunIdRef.current === detectionRunId && pendingDetectionFeedbackRef.current) {
                        toast.error('无法识别平台类型');
                    }
                    return '';
                }
                lastDetectedUrlRef.current = trimmedUrl;
                if (currentBaseUrlRef.current === trimmedUrl && platformSelectionVersionRef.current === platformVersion) {
                    const previousPlatform = selectedPlatformRef.current;
                    applyPlatform(nextPlatform);
                    if (
                        (detectionRunIdRef.current === detectionRunId && pendingDetectionFeedbackRef.current) ||
                        previousPlatform !== nextPlatform
                    ) {
                        toast.success(`自动检测到平台：${PLATFORM_OPTIONS.find((p) => p.value === nextPlatform)?.label ?? nextPlatform}`);
                    }
                } else if (detectionRunIdRef.current === detectionRunId && pendingDetectionFeedbackRef.current) {
                    toast.info('站点 URL 或平台已变更，请重新检测');
                }
                return nextPlatform;
            } catch (err: unknown) {
                if (detectionRunIdRef.current === detectionRunId && pendingDetectionFeedbackRef.current) {
                    toast.error(getErrorMessage(err, '自动检测失败'));
                }
                return '';
            } finally {
                if (detectionRunIdRef.current === detectionRunId) {
                    pendingDetectionRef.current = null;
                    pendingDetectionUrlRef.current = '';
                    pendingDetectionFeedbackRef.current = false;
                    setDetectingUrl(false);
                }
            }
        })();

        pendingDetectionRef.current = detection;
        pendingDetectionUrlRef.current = trimmedUrl;
        return detection;
    }, [applyPlatform, baseUrl, detectPlatform, findDuplicateSite, showDuplicateSitePrompt]);

    const handlePlatformChange = useCallback((value: string) => {
        platformSelectionVersionRef.current += 1;
        applyPlatform(value as SitePlatform);
    }, [applyPlatform]);

    const handleCredentialTypeChange = useCallback((type: SiteCredentialType) => {
        setCredentialType(type);
        if (type !== SiteCredentialType.UsernamePassword) {
            setUsername('');
            setPassword('');
        }
    }, []);

    const handleSiteTypeChange = useCallback((value: string) => {
        const nextType = value as 'free' | 'paid';
        setSiteType(nextType);
        setAutoCheckin(nextType === 'free');
    }, []);

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();

        if (submitting || isSitesLoading || detectingUrl) {
            return;
        }

        if (!name.trim()) {
            toast.error('请输入站点名称');
            return;
        }
        if (!baseUrl.trim()) {
            toast.error('请输入站点 URL');
            return;
        }
        if (platformUserId.trim()) {
            const parsed = Number(platformUserId.trim());
            if (!Number.isInteger(parsed) || parsed <= 0) {
                toast.error('账号 ID 必须是正整数');
                return;
            }
        }

        const trimmedName = name.trim();
        if (existingSites?.some((s) => s.name === trimmedName)) {
            toast.error(`站点「${trimmedName}」已存在，请使用其他名称或前往站点管理页面编辑`);
            return;
        }

        setSubmitting(true);
        try {
            const duplicateSite = await findDuplicateSite(baseUrl.trim(), true);
            if (duplicateSite) {
                showDuplicateSitePrompt(duplicateSite, baseUrl);
                return;
            }

            let resolvedPlatform = platform as SitePlatform | '';

            if (!resolvedPlatform) {
                resolvedPlatform = await handleDetectBaseUrl(true);
                if (!resolvedPlatform) {
                    throw new Error('无法识别平台类型，请手动选择平台');
                }
            }
            const allowedCredentials = credentialOptionsForPlatform(resolvedPlatform);
            const resolvedCredentialType = allowedCredentials.includes(credentialType)
                ? credentialType
                : defaultCredentialType(resolvedPlatform);
            if (resolvedCredentialType === SiteCredentialType.UsernamePassword) {
                if (!username.trim() || !password.trim()) {
                    toast.error('请输入用户名和密码');
                    return;
                }
            } else if (!token.trim()) {
                toast.error(resolvedCredentialType === SiteCredentialType.APIKey ? '请输入 API Key' : '请输入 Access Token');
                return;
            }

            const isSub2APISession = resolvedPlatform === SitePlatform.Sub2API
                && resolvedCredentialType === SiteCredentialType.AccessToken;
            let resolvedTokenExpiresAt = 0;
            if (isSub2APISession && tokenExpiresAt.trim()) {
                try {
                    resolvedTokenExpiresAt = parseTokenExpiresAtInput(tokenExpiresAt);
                } catch (err: unknown) {
                    toast.error(getErrorMessage(err, 'token_expires_at 必须是时间戳或可解析时间'));
                    return;
                }
            }

            const site = await createSite.mutateAsync({
                name: name.trim(),
                platform: resolvedPlatform as SitePlatform,
                site_type: siteType,
                base_url: baseUrl.trim(),
                enabled: true,
                proxy_mode: 'direct',
                proxy_config_id: null,
                external_checkin_url: null,
                is_pinned: false,
                sort_order: 0,
                global_weight: 1,
                custom_header: [],
            });

            setSiteId(site.id);

            const accountPayload = {
                site_id: site.id,
                name: '默认账号',
                credential_type: resolvedCredentialType,
                username: resolvedCredentialType === SiteCredentialType.UsernamePassword ? username.trim() : '',
                password: resolvedCredentialType === SiteCredentialType.UsernamePassword ? password.trim() : '',
                access_token: resolvedCredentialType === SiteCredentialType.AccessToken ? token.trim() : '',
                api_key: resolvedCredentialType === SiteCredentialType.APIKey ? token.trim() : '',
                refresh_token: isSub2APISession ? refreshToken.trim() : '',
                token_expires_at: resolvedTokenExpiresAt,
                platform_user_id: platformUserId.trim() ? Number(platformUserId.trim()) : null,
                proxy_mode: 'inherit',
                proxy_config_id: null,
                enabled: true,
                auto_sync: true,
                auto_checkin: canUseAutoCheckin(siteType, resolvedPlatform, resolvedCredentialType) && autoCheckin,
                random_checkin: false,
                checkin_interval_hours: 24,
                checkin_random_window_minutes: 120,
            };

            const account = await createAccount.mutateAsync(accountPayload as Parameters<typeof createAccount.mutateAsync>[0]);
            setAccountId(account.id);
            setWizardCredentialType(resolvedCredentialType);

            toast.success('站点和账号已创建');
            setStep(2);
        } catch (err: unknown) {
            toast.error(getErrorMessage(err, '创建失败'));
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <>
        <Card>
            <CardHeader>
                <CardTitle>添加站点</CardTitle>
                <CardDescription>配置站点信息和账号令牌，创建后将自动同步模型</CardDescription>
            </CardHeader>
            <CardContent>
                <form className="space-y-4" onSubmit={handleSubmit}>
                    <div className="grid gap-4 md:grid-cols-2">
                        <Label className="grid gap-2">
                            <span>站点名称</span>
                            <Input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="例如：主站 NewAPI"
                                className="rounded-xl"
                            />
                        </Label>
                        <div className="grid gap-2">
                            <Label htmlFor="wizard-site-url">站点 URL</Label>
                            <div className="flex gap-2">
                                <Input
                                    id="wizard-site-url"
                                    value={baseUrl}
                                    onChange={(e) => {
                                        const nextUrl = e.target.value;
                                        const trimmedUrl = nextUrl.trim();
                                        setBaseUrl(nextUrl);
                                        currentBaseUrlRef.current = trimmedUrl;
                                        if (lastDetectedUrlRef.current !== trimmedUrl) {
                                            lastDetectedUrlRef.current = '';
                                        }
                                    }}
                                    onBlur={() => {
                                        if (baseUrl.trim() && lastDetectedUrlRef.current !== baseUrl.trim()) {
                                            void handleDetectBaseUrl(false);
                                        }
                                    }}
                                    placeholder="https://api.example.com"
                                    className="rounded-xl"
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="shrink-0 rounded-xl"
                                    disabled={detectingUrl || isSitesLoading || !baseUrl.trim()}
                                    onClick={() => void handleDetectBaseUrl(true)}
                                >
                                    {detectingUrl ? <Loader2 className="size-4 animate-spin" /> : null}
                                    {detectingUrl ? '检测中' : '检测'}
                                </Button>
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <Label className="grid gap-2">
                            <span>平台</span>
                            <Select value={platform} onValueChange={handlePlatformChange}>
                                <SelectTrigger className="w-full rounded-xl">
                                    <SelectValue placeholder="自动检测或手动选择" />
                                </SelectTrigger>
                                <SelectContent>
                                    {PLATFORM_OPTIONS.map((opt) => (
                                        <SelectItem key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </Label>
                        {showUsernamePasswordFields ? (
                            <Label className="grid gap-2">
                                <span>用户名</span>
                                <Input
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="请输入用户名"
                                    className="rounded-xl"
                                />
                            </Label>
                        ) : (
                            <Label className="grid gap-2">
                                <span>{CREDENTIAL_LABELS[credentialType]}</span>
                                <Input
                                    type="password"
                                    value={token}
                                    onChange={(e) => setToken(e.target.value)}
                                    placeholder={credentialPlaceholder(credentialType)}
                                    className="rounded-xl"
                                />
                            </Label>
                        )}
                    </div>

                    <div className="grid gap-2 rounded-xl border border-border/70 bg-muted/20 p-3">
                        <div className="text-sm font-medium">凭证类型</div>
                        <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                            {credentialOptions.map((type) => (
                                <Button
                                    key={type}
                                    type="button"
                                    variant={credentialType === type ? 'default' : 'outline'}
                                    className="h-auto justify-start rounded-xl px-3 py-2 text-left"
                                    onClick={() => handleCredentialTypeChange(type)}
                                >
                                    <span className="grid gap-0.5">
                                        <span>{CREDENTIAL_LABELS[type]}</span>
                                        <span className="text-xs font-normal opacity-80">
                                            {CREDENTIAL_DESCRIPTIONS[type]}
                                        </span>
                                    </span>
                                </Button>
                            ))}
                        </div>
                    </div>

                    {showUsernamePasswordFields ? (
                        <Label className="grid gap-2">
                            <span>密码</span>
                            <Input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="请输入密码"
                                className="rounded-xl"
                            />
                        </Label>
                    ) : null}

                    {showSub2APITokenFields ? (
                        <div className="grid gap-3 rounded-xl border border-border/70 bg-muted/20 p-3">
                            <div className="grid gap-1">
                                <div className="text-sm font-medium">Sub2API 托管续期</div>
                                <p className="text-xs text-muted-foreground">
                                    推荐同时填写 F12 中的 refresh_token 与 token_expires_at，JWT 快过期或 401 时可自动续期。
                                </p>
                            </div>
                            <div className="grid gap-4 md:grid-cols-2">
                                <Label className="grid gap-2">
                                    <span>Refresh Token <span className="text-muted-foreground">(可选)</span></span>
                                    <Input
                                        type="password"
                                        value={refreshToken}
                                        onChange={(e) => setRefreshToken(e.target.value)}
                                        placeholder="Sub2API refresh_token"
                                        className="rounded-xl bg-background"
                                    />
                                </Label>
                                <Label className="grid gap-2">
                                    <span>token_expires_at <span className="text-muted-foreground">(可选)</span></span>
                                    <Input
                                        value={tokenExpiresAt}
                                        onChange={(e) => setTokenExpiresAt(e.target.value)}
                                        placeholder="毫秒时间戳，秒级会自动转换"
                                        className="rounded-xl bg-background"
                                    />
                                </Label>
                            </div>
                        </div>
                    ) : null}

                    <Label className="grid gap-2">
                        <span>站点类型</span>
                        <Select value={siteType} onValueChange={handleSiteTypeChange}>
                            <SelectTrigger className="w-full rounded-xl">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="free">公益（免费）</SelectItem>
                                <SelectItem value="paid">付费</SelectItem>
                            </SelectContent>
                        </Select>
                    </Label>

                    <div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 bg-muted/20 p-3">
                        <div className="grid gap-1">
                            <Label htmlFor="wizard-auto-checkin" className="text-sm font-medium">自动签到</Label>
                            <p className="text-xs text-muted-foreground">
                                {autoCheckinHint(siteType, selectedPlatform, credentialType)}
                            </p>
                        </div>
                        <Switch
                            id="wizard-auto-checkin"
                            checked={effectiveAutoCheckin}
                            disabled={!autoCheckinEnabled}
                            onCheckedChange={setAutoCheckin}
                            aria-label="开启自动签到"
                        />
                    </div>

                    <Label className="grid gap-2">
                        <span>账号 ID <span className="text-muted-foreground">(可选)</span></span>
                        <Input
                            value={platformUserId}
                            onChange={(e) => setPlatformUserId(e.target.value)}
                            placeholder="部分平台同步时需要"
                            className="rounded-xl"
                        />
                    </Label>

                    <div className="flex justify-end pt-2">
                        <Button type="submit" className="rounded-xl" disabled={submitting || isSitesLoading || detectingUrl}>
                            {submitting ? '创建中...' : '创建站点并继续'}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
        <AlertDialog open={duplicateSiteDialogOpen} onOpenChange={setDuplicateSiteDialogOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>站点 URL 已存在</AlertDialogTitle>
                    <AlertDialogDescription>
                        站点「{duplicateSitePrompt?.site.name}」已经使用相同 URL（{duplicateSitePrompt?.normalizedUrl}），不会重复添加。
                        是否跳转到该站点的渠道页面？
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>继续编辑</AlertDialogCancel>
                    <AlertDialogAction onClick={handleJumpToDuplicateSite}>
                        跳转到站点渠道
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        </>
    );
}
