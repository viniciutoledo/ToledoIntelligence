import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/hooks/use-language";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

export function LoginForm({
  activeRole,
  setActiveRole,
  onSuccess,
}: {
  activeRole: "technician" | "admin";
  setActiveRole: (role: "technician" | "admin") => void;
  onSuccess: () => void;
}) {
  const { loginMutation } = useAuth();
  const { t } = useLanguage();
  
  const formSchema = z.object({
    email: z.string().email(t("errors.validation")),
    password: z.string().min(1, t("errors.validation")),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      await loginMutation.mutateAsync({
        ...values,
        role: activeRole,
      });
      onSuccess();
    } catch (error) {
      console.error("Login error:", error);
    }
  };

  return (
    <>
      {/* Role Selector */}
      <div className="flex justify-center space-x-4 mb-6">
        <Button
          type="button"
          onClick={() => setActiveRole("technician")}
          className={`py-2 px-4 ${
            activeRole === "technician"
              ? "bg-primary text-white"
              : "bg-neutral-200 text-neutral-700"
          } rounded-md focus:outline-none`}
        >
          {t("auth.technician")}
        </Button>
        <Button
          type="button"
          onClick={() => setActiveRole("admin")}
          className={`py-2 px-4 ${
            activeRole === "admin"
              ? "bg-primary text-white"
              : "bg-neutral-200 text-neutral-700"
          } rounded-md focus:outline-none`}
        >
          {t("auth.admin")}
        </Button>
      </div>

      {/* Login Form */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("common.email")}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t("auth.emailPlaceholder")}
                    {...field}
                    type="email"
                    required
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("common.password")}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t("auth.passwordPlaceholder")}
                    {...field}
                    type="password"
                    required
                  />
                </FormControl>
                <p className="text-xs text-neutral-500 mt-1">
                  {t("common.passwordRequirements")}
                </p>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button
            type="submit"
            className="w-full group relative flex justify-center py-2 px-4"
            disabled={loginMutation.isPending}
          >
            <span className="absolute left-0 inset-y-0 flex items-center pl-3">
              {loginMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <svg
                  className="h-5 w-5 text-primary-500 group-hover:text-primary-400"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              )}
            </span>
            {t("common.login")}
          </Button>
        </form>
      </Form>
    </>
  );
}
