'use client';

import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useCreateSite, useCreateSiteAccount, useDetectSitePlatform, SitePlatform, SiteCredentialType } from '@/api/endpoints/site';
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

function defaultCredentialType(platform: SitePlatform): SiteCredentialType {
    switch (platform) {
        case SitePlatform.Sub2API:
            return SiteCredentialType.AccessToken;
        case SitePlatform.OpenAI:
        case SitePlatform.Claude:
        case SitePlatform.Gemini:
            return SiteCredentialType.APIKey;
        default:
            return SiteCredentialType.UsernamePassword;
    }
}

export function Step1AddSite() {
    const { setStep, setSiteId, setAccountId } = useWizardStore();
    const createSite = useCreateSite();
    const createAccount = useCreateSiteAccount();
    const detectPlatform = useDetectSitePlatform();

    const [name, setName] = useState('');
    const [baseUrl, setBaseUrl] = useState('');
    const [platform, setPlatform] = useState<string>('');
    const [token, setToken] = useState('');
    const [platformUserId, setPlatformUserId] = useState('');
    const [submitting, setSubmitting] = useState(false);

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();

        if (!name.trim()) {
            toast.error('请输入站点名称');
            return;
        }
        if (!baseUrl.trim()) {
            toast.error('请输入站点 URL');
            return;
        }
        if (!token.trim()) {
            toast.error('请输入账号令牌');
            return;
        }

        let resolvedPlatform = platform as SitePlatform | '';

        if (!resolvedPlatform) {
            try {
                const detected = await detectPlatform.mutateAsync(baseUrl.trim());
                resolvedPlatform = detected.platform as SitePlatform;
                toast.success(`自动检测到平台：${PLATFORM_OPTIONS.find((p) => p.value === resolvedPlatform)?.label ?? resolvedPlatform}`);
            } catch {
                toast.error('无法自动检测平台类型，请手动选择');
                return;
            }
        }

        setSubmitting(true);
        try {
            const site = await createSite.mutateAsync({
                name: name.trim(),
                platform: resolvedPlatform as SitePlatform,
                base_url: baseUrl.trim(),
                enabled: true,
                proxy: false,
                site_proxy: null,
                use_system_proxy: false,
                external_checkin_url: null,
                is_pinned: false,
                sort_order: 0,
                global_weight: 1,
                custom_header: [],
            });

            setSiteId(site.id);

            const credType = defaultCredentialType(resolvedPlatform as SitePlatform);
            const accountPayload = {
                site_id: site.id,
                name: '默认账号',
                credential_type: credType,
                username: '',
                password: '',
                access_token: credType === SiteCredentialType.AccessToken ? token.trim() : '',
                api_key: credType === SiteCredentialType.APIKey ? token.trim() : '',
                refresh_token: '',
                token_expires_at: 0,
                platform_user_id: platformUserId.trim() ? Number(platformUserId.trim()) : null,
                account_proxy: null,
                enabled: true,
                auto_sync: true,
                auto_checkin: true,
                random_checkin: false,
                checkin_interval_hours: 24,
                checkin_random_window_minutes: 120,
            };

            const account = await createAccount.mutateAsync(accountPayload as Parameters<typeof createAccount.mutateAsync>[0]);
            setAccountId(account.id);

            toast.success('站点和账号已创建');
            setStep(2);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : '创建失败');
        } finally {
            setSubmitting(false);
        }
    }

    return (
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
                        <Label className="grid gap-2">
                            <span>站点 URL</span>
                            <Input
                                value={baseUrl}
                                onChange={(e) => setBaseUrl(e.target.value)}
                                placeholder="https://api.example.com"
                                className="rounded-xl"
                            />
                        </Label>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <Label className="grid gap-2">
                            <span>平台</span>
                            <Select value={platform} onValueChange={setPlatform}>
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
                        <Label className="grid gap-2">
                            <span>账号令牌</span>
                            <Input
                                type="password"
                                value={token}
                                onChange={(e) => setToken(e.target.value)}
                                placeholder="API Key / Access Token / 密码"
                                className="rounded-xl"
                            />
                        </Label>
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
                        <Button type="submit" className="rounded-xl" disabled={submitting}>
                            {submitting ? '创建中...' : '创建站点并继续'}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
