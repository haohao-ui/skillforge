import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import Navbar from "@/components/Navbar";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  Sparkles,
  Zap,
  FileCode,
  Download,
  Shield,
  ArrowRight,
  Loader2,
} from "lucide-react";

const FEATURES = [
  { icon: Zap, title: "7 步自动生成", desc: "需求分析到交付，全流程自动化" },
  {
    icon: FileCode,
    title: "完整 Skill 包",
    desc: "SKILL.md + scripts/ + references/",
  },
  { icon: Shield, title: "质量审计内置", desc: "10 维度评分 + 自动修复" },
  { icon: Download, title: "一键下载", desc: "ZIP 打包，即装即用" },
];

export default function Home() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [skillName, setSkillName] = useState("");
  const [domain, setDomain] = useState("");
  const [features, setFeatures] = useState("");
  const [scenarios, setScenarios] = useState("");
  const [extraNotes, setExtraNotes] = useState("");
  const [llmApiUrl, setLlmApiUrl] = useState("");
  const [llmApiKey, setLlmApiKey] = useState("");
  const [llmModel, setLlmModel] = useState("");
  const [llmMaxTokens, setLlmMaxTokens] = useState("");
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  const runtimeConfigQuery = trpc.system.runtimeConfig.useQuery();

  const generateMutation = trpc.skill.generate.useMutation({
    onSuccess: data => {
      navigate(`/generate/${data.id}`);
    },
  });

  useEffect(() => {
    if (settingsLoaded || !runtimeConfigQuery.data) return;

    const stored =
      typeof window !== "undefined"
        ? window.localStorage.getItem("skillforge.llm-settings")
        : null;

    if (stored) {
      try {
        const parsed = JSON.parse(stored) as {
          llmApiUrl?: string;
          llmApiKey?: string;
          llmModel?: string;
          llmMaxTokens?: string;
        };
        setLlmApiUrl(
          parsed.llmApiUrl ?? runtimeConfigQuery.data.defaultApiUrl ?? ""
        );
        setLlmApiKey(parsed.llmApiKey ?? "");
        setLlmModel(parsed.llmModel ?? runtimeConfigQuery.data.defaultModel);
        setLlmMaxTokens(
          parsed.llmMaxTokens ?? String(runtimeConfigQuery.data.defaultMaxTokens)
        );
        setSettingsLoaded(true);
        return;
      } catch {
        /* ignore invalid local settings */
      }
    }

    setLlmApiUrl(runtimeConfigQuery.data.defaultApiUrl ?? "");
    setLlmApiKey("");
    setLlmModel(runtimeConfigQuery.data.defaultModel);
    setLlmMaxTokens(String(runtimeConfigQuery.data.defaultMaxTokens));
    setSettingsLoaded(true);
  }, [runtimeConfigQuery.data, settingsLoaded]);

  useEffect(() => {
    if (!settingsLoaded || typeof window === "undefined") return;

    window.localStorage.setItem(
      "skillforge.llm-settings",
      JSON.stringify({
        llmApiUrl,
        llmApiKey,
        llmModel,
        llmMaxTokens,
      })
    );
  }, [llmApiKey, llmApiUrl, llmMaxTokens, llmModel, settingsLoaded]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!skillName.trim() || !domain.trim() || !features.trim()) return;
    const parsedMaxTokens = Number.parseInt(llmMaxTokens, 10);
    generateMutation.mutate({
      skillName: skillName.trim(),
      domain: domain.trim(),
      features: features.trim(),
      scenarios: scenarios.trim() || undefined,
      extraNotes: extraNotes.trim() || undefined,
      llmApiUrl: llmApiUrl.trim() || undefined,
      llmApiKey: llmApiKey.trim() || undefined,
      llmModel: llmModel.trim() || undefined,
      llmMaxTokens:
        Number.isFinite(parsedMaxTokens) && parsedMaxTokens > 0
          ? parsedMaxTokens
          : undefined,
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />

      {/* Hero + Features combined */}
      <section className="relative overflow-hidden border-b border-border/40">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/3" />
        <div className="container relative py-8 md:py-12">
          <div className="mx-auto max-w-3xl text-center mb-6">
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="h-3 w-3" />
              基于 100+ 优秀 Skills 深度分析
            </div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
              Perfect Skill
              <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                {" "}
                Generator
              </span>
            </h1>
            <p className="mt-2 text-sm text-muted-foreground max-w-xl mx-auto">
              输入需求，AI 自动执行 7 步流程，生成符合最佳实践的生产级 Agent
              Skill 包
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-3xl mx-auto">
            {FEATURES.map(f => (
              <div
                key={f.title}
                className="flex flex-col items-center text-center p-3 rounded-lg border border-border/40 bg-card/80 backdrop-blur-sm"
              >
                <div className="mb-1.5 flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <f.icon className="h-4 w-4" />
                </div>
                <h3 className="font-semibold text-xs">{f.title}</h3>
                <p className="mt-0.5 text-[11px] text-muted-foreground leading-tight">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Main Form */}
      <section className="container py-6 pb-12">
        <Card className="mx-auto max-w-2xl shadow-md border-border/60">
          <CardHeader className="text-center pb-1 pt-5 px-5">
            <CardTitle className="text-xl">创建新 Skill</CardTitle>
            <CardDescription className="text-xs">
              描述你想创建的 Agent Skill，系统将自动完成全部 7 个步骤
            </CardDescription>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {!isAuthenticated && !authLoading ? (
              <div className="text-center py-6">
                <p className="text-muted-foreground mb-3 text-sm">
                  请先登录后再创建 Skill
                </p>
                <Button asChild>
                  <a href={getLoginUrl()}>登录开始使用</a>
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="skillName" className="text-xs">
                      技能名称 *
                    </Label>
                    <Input
                      id="skillName"
                      placeholder="例如：code-reviewer"
                      value={skillName}
                      onChange={e => setSkillName(e.target.value)}
                      className="h-9 text-sm"
                      required
                    />
                    <p className="text-[11px] text-muted-foreground">
                      hyphen-case 格式
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="domain" className="text-xs">
                      目标领域 *
                    </Label>
                    <Input
                      id="domain"
                      placeholder="例如：代码质量与审查"
                      value={domain}
                      onChange={e => setDomain(e.target.value)}
                      className="h-9 text-sm"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="features" className="text-xs">
                    核心功能 *
                  </Label>
                  <Textarea
                    id="features"
                    placeholder="描述核心功能，例如：&#10;- 自动审查代码质量&#10;- 检测安全漏洞&#10;- 提供重构建议"
                    value={features}
                    onChange={e => setFeatures(e.target.value)}
                    rows={3}
                    className="text-sm resize-none"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="scenarios" className="text-xs">
                      使用场景（可选）
                    </Label>
                    <Textarea
                      id="scenarios"
                      placeholder="描述典型使用场景"
                      value={scenarios}
                      onChange={e => setScenarios(e.target.value)}
                      rows={2}
                      className="text-sm resize-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="extraNotes" className="text-xs">
                      补充说明（可选）
                    </Label>
                    <Textarea
                      id="extraNotes"
                      placeholder="技术栈偏好、平台要求等"
                      value={extraNotes}
                      onChange={e => setExtraNotes(e.target.value)}
                      rows={2}
                      className="text-sm resize-none"
                    />
                  </div>
                </div>

                <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold">模型设置</h3>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        服务端 `.env` 已配置的值优先；未配置时，将使用这里保存的当前浏览器设置。
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-[11px]"
                      disabled={!runtimeConfigQuery.data}
                      onClick={() => {
                        if (!runtimeConfigQuery.data) return;
                        setLlmApiUrl(
                          runtimeConfigQuery.data.defaultApiUrl ?? ""
                        );
                        setLlmApiKey("");
                        setLlmModel(runtimeConfigQuery.data.defaultModel);
                        setLlmMaxTokens(
                          String(runtimeConfigQuery.data.defaultMaxTokens)
                        );
                      }}
                    >
                      恢复默认
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1 sm:col-span-2">
                      <Label htmlFor="llmApiUrl" className="text-xs">
                        API URL
                      </Label>
                      <Input
                        id="llmApiUrl"
                        placeholder="例如：https://api.openai.com/v1/chat/completions"
                        value={llmApiUrl}
                        onChange={e => setLlmApiUrl(e.target.value)}
                        className="h-9 text-sm"
                        disabled={runtimeConfigQuery.data?.useOpenAIOAuth}
                      />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <Label htmlFor="llmApiKey" className="text-xs">
                        API Key
                      </Label>
                      <Input
                        id="llmApiKey"
                        type="password"
                        placeholder={
                          runtimeConfigQuery.data?.hasDefaultApiKey
                            ? "服务端已配置默认 key；留空即可"
                            : "当服务端未配置时，在这里填写"
                        }
                        value={llmApiKey}
                        onChange={e => setLlmApiKey(e.target.value)}
                        className="h-9 text-sm"
                        autoComplete="off"
                        disabled={runtimeConfigQuery.data?.useOpenAIOAuth}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="llmModel" className="text-xs">
                        模型名称
                      </Label>
                      <Input
                        id="llmModel"
                        placeholder="例如：deepseek-chat / gpt-5.4"
                        value={llmModel}
                        onChange={e => setLlmModel(e.target.value)}
                        className="h-9 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="llmMaxTokens" className="text-xs">
                        Max Tokens
                      </Label>
                      <Input
                        id="llmMaxTokens"
                        type="number"
                        min={1}
                        step={1}
                        value={llmMaxTokens}
                        onChange={e => setLlmMaxTokens(e.target.value)}
                        className="h-9 text-sm"
                      />
                    </div>
                  </div>
                  {!runtimeConfigQuery.data?.useOpenAIOAuth &&
                  !runtimeConfigQuery.data?.hasDefaultApiKey &&
                  !llmApiKey.trim() ? (
                    <p className="text-[11px] text-amber-600">
                      当前服务端未配置默认 API Key。直接生成前，需要在这里填入可用的
                      API Key。
                    </p>
                  ) : null}
                  <p className="text-[11px] text-muted-foreground">
                    默认 URL：{runtimeConfigQuery.data?.defaultApiUrl ?? "未配置"} ·
                    当前默认：{runtimeConfigQuery.data?.defaultModel ?? "加载中"} ·{" "}
                    {runtimeConfigQuery.data?.defaultMaxTokens ?? "..."} tokens ·
                    数据库 {runtimeConfigQuery.data?.databaseDialect ?? "加载中"}
                    {runtimeConfigQuery.data?.useOpenAIOAuth
                      ? " · OpenAI OAuth 模式"
                      : " · OpenAI-compatible API 模式"}
                  </p>
                </div>

                <Button
                  type="submit"
                  className="w-full gap-2"
                  disabled={
                    generateMutation.isPending ||
                    !skillName.trim() ||
                    !domain.trim() ||
                    !features.trim()
                  }
                >
                  {generateMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      正在创建...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      开始生成 Skill
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
