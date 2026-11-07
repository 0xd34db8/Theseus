"use client";

import React, { useState, useEffect } from "react";
import {
  saveAIConfig,
  getAIConfig,
  removeApiKey,
  getDefaultModelForProvider,
} from "@/lib/storage";
import { AIConfig, LLMProvider } from "@/types/ai";
import { testUniversalApiKey } from "@/lib/ai";
import {
  Key,
  Check,
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onKeyUpdated?: (key: string) => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({
  isOpen,
  onClose,
  onKeyUpdated,
}) => {
  const [provider, setProvider] = useState<LLMProvider>("gemini");
  const [inputKey, setInputKey] = useState<string>("");
  const [model, setModel] = useState<string>("");
  const [baseURL, setBaseURL] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [savedFeedback, setSavedFeedback] = useState<boolean>(false);

  // Load existing config on mount / open
  useEffect(() => {
    if (isOpen) {
      const cfg = getAIConfig();
      setProvider(cfg.provider);
      setInputKey(cfg.apiKey || "");
      setModel(cfg.model || "");
      setBaseURL(cfg.baseURL || "");
      setTestResult(null);
      setSavedFeedback(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleProviderChange = (newProvider: LLMProvider) => {
    setProvider(newProvider);
    setModel(getDefaultModelForProvider(newProvider));
    setTestResult(null);
  };

  const handleKeyChange = (val: string) => {
    setInputKey(val);
    setTestResult(null);
  };

  const handleTestKey = async () => {
    const keyToTest = inputKey.trim();
    if (!keyToTest) {
      setTestResult({
        success: false,
        message: "Please enter an API key to test",
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const result = await testUniversalApiKey({
        provider,
        apiKey: keyToTest,
        model: model.trim() || getDefaultModelForProvider(provider),
        baseURL: baseURL.trim() || undefined,
      });

      if (result.valid) {
        setTestResult({
          success: true,
          message: "Connection verified.",
        });
      } else {
        setTestResult({
          success: false,
          message: result.error || "Validation failed.",
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || "Failed to reach provider",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    const cleanKey = inputKey.trim();
    const cleanConfig: AIConfig = {
      provider,
      apiKey: cleanKey,
      model: model.trim() || getDefaultModelForProvider(provider),
      baseURL: baseURL.trim() || undefined,
    };

    saveAIConfig(cleanConfig);
    onKeyUpdated?.(cleanKey);

    setSavedFeedback(true);
    setTimeout(() => {
      setSavedFeedback(false);
      onClose();
    }, 500);
  };

  const handleRemove = () => {
    removeApiKey();
    setInputKey("");
    setTestResult(null);
    onKeyUpdated?.("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-3xl border border-border shadow-2xl w-full max-w-md p-6 space-y-4 font-manrope animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-subtle flex items-center justify-center text-foreground">
              <Key className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-medium text-foreground">
                API Key settings
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-subtle transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Provider Selector */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Provider
          </label>
          <select
            value={provider}
            onChange={(e) => handleProviderChange(e.target.value as LLMProvider)}
            className="w-full px-3 py-2 bg-subtle border border-border rounded-xl text-xs text-foreground outline-hidden focus:border-accent font-manrope cursor-pointer"
          >
            <option value="gemini">Google Gemini</option>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic Claude</option>
            <option value="openrouter">OpenRouter</option>
            <option value="groq">Groq</option>
            <option value="custom">Custom / OpenAI Compatible</option>
          </select>
        </div>

        {/* API Key Input */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            API Key
          </label>
          <div className="relative flex items-center">
            <input
              type={showPassword ? "text" : "password"}
              value={inputKey}
              onChange={(e) => handleKeyChange(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              placeholder="Paste your API key"
              className="w-full pl-3.5 pr-10 py-2.5 bg-subtle border border-border rounded-xl text-xs text-foreground placeholder-muted-foreground outline-hidden focus:border-accent focus:bg-card font-mono"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 text-muted-foreground hover:text-foreground p-1 cursor-pointer"
              title={showPassword ? "Hide key" : "Show key"}
            >
              {showPassword ? (
                <EyeOff className="w-3.5 h-3.5" />
              ) : (
                <Eye className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Advanced Options Toggle */}
        <div>
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground cursor-pointer"
          >
            {showAdvanced ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
            <span>Advanced (Model & Endpoint)</span>
          </button>
        </div>

        {showAdvanced && (
          <div className="space-y-3 pt-1 border-t border-border-subtle">
            {/* Model Name */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Model Name
              </label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder={getDefaultModelForProvider(provider)}
                className="w-full px-3 py-2 bg-subtle border border-border rounded-xl text-xs text-foreground outline-hidden focus:border-accent font-mono"
              />
            </div>

            {/* Custom Base URL (if custom or openrouter or overridden) */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Base URL (optional)
              </label>
              <input
                type="text"
                value={baseURL}
                onChange={(e) => setBaseURL(e.target.value)}
                placeholder={
                  provider === "custom"
                    ? "http://localhost:11434/v1"
                    : "Default provider endpoint"
                }
                className="w-full px-3 py-2 bg-subtle border border-border rounded-xl text-xs text-foreground outline-hidden focus:border-accent font-mono"
              />
            </div>
          </div>
        )}

        {/* Test Connection Button & Result */}
        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={handleTestKey}
            disabled={isTesting || !inputKey.trim()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border hover:bg-subtle text-[11px] font-medium text-foreground-subtle transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isTesting ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                <span>Testing...</span>
              </>
            ) : (
              <span>Test API Key</span>
            )}
          </button>

          {testResult && (
            <div
              className={`flex items-center gap-1.5 text-[11px] font-medium ${
                testResult.success
                  ? "text-emerald-500"
                  : "text-red-500"
              }`}
            >
              {testResult.success ? (
                <Check className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
              )}
              <span className="truncate max-w-[220px]">{testResult.message}</span>
            </div>
          )}
        </div>

        {/* Success Feedback */}
        {savedFeedback && (
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-xs flex items-center gap-2">
            <Check className="w-3.5 h-3.5 text-emerald-500" />
            <span>Saved</span>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-border-subtle">
          {inputKey ? (
            <button
              type="button"
              onClick={handleRemove}
              className="text-xs text-red-500 hover:underline font-medium cursor-pointer"
            >
              Remove
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-subtle rounded-full transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 text-xs font-medium text-primary-foreground bg-primary hover:bg-primary-hover rounded-full transition-all shadow-2xs cursor-pointer"
            >
              Save Key
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
