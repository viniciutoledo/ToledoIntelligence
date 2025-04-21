import { useState } from "react";
import { useLanguage } from "@/hooks/use-language";
import { useLlm } from "@/hooks/use-llm";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { formatDate } from "@/lib/utils";

export function LlmSettings() {
  const { t } = useLanguage();
  const { llmData, isLoading, testConnectionMutation, saveConfigMutation } = useLlm();
  const [showApiKey, setShowApiKey] = useState(false);

  const formSchema = z.object({
    model_name: z.string().min(1, "Model is required"),
    api_key: z.string().min(1, "API key is required"),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      model_name: llmData?.config?.model_name || "claude-3-7-sonnet-20250219",
      api_key: llmData?.config?.api_key || "",
    },
  });

  // Update form when data is loaded
  useState(() => {
    if (llmData?.config) {
      form.reset({
        model_name: llmData.config.model_name,
        api_key: llmData.config.api_key || "",
      });
    }
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    await saveConfigMutation.mutateAsync(values);
  };

  const handleTestConnection = () => {
    const values = form.getValues();
    testConnectionMutation.mutate(values);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("admin.llmSettings")}</CardTitle>
          <CardDescription>{t("admin.llmSettingsSubtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center items-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("admin.llmSettings")}</CardTitle>
        <CardDescription>{t("admin.llmSettingsSubtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="model_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("admin.llmModel")}</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select model" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="claude-3-7-sonnet-20250219">Claude 3.7 Sonnet</SelectItem>
                      <SelectItem value="claude-3-opus-20240229">Claude 3 Opus</SelectItem>
                      <SelectItem value="claude-3-haiku-20240307">Claude 3 Haiku</SelectItem>
                      <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                      <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                    </SelectContent>
                  </Select>
                  {llmData?.config && (
                    <p className="mt-1 text-xs text-neutral-500">
                      {t("admin.currentModel")} {llmData.config.model_name}{" "}
                      ({t("admin.updatedAt")} {formatDate(llmData.config.updated_at)})
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="api_key"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("admin.apiKey")}</FormLabel>
                  <div className="flex">
                    <FormControl>
                      <Input
                        type={showApiKey ? "text" : "password"}
                        className="flex-grow rounded-r-none"
                        {...field}
                      />
                    </FormControl>
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-l-none"
                      onClick={() => setShowApiKey(!showApiKey)}
                    >
                      {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="mt-1 text-xs text-neutral-500">
                    {t("admin.apiKey")} (AES-256 encrypted)
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                className="mr-2"
                onClick={handleTestConnection}
                disabled={testConnectionMutation.isPending}
              >
                {testConnectionMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {t("admin.testConnection")}
              </Button>
              <Button
                type="submit"
                disabled={saveConfigMutation.isPending}
              >
                {saveConfigMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {t("admin.saveSettings")}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
