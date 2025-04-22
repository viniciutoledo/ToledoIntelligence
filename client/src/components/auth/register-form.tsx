import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/hooks/use-language";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
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
import { Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { passwordSchema } from "@shared/schema";

export function RegisterForm({
  onSuccess,
}: {
  onSuccess: () => void;
}) {
  const { registerMutation } = useAuth();
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  
  // Create a more robust form schema with password validation
  const formSchema = z.object({
    email: z.string().email(t("errors.validation")),
    password: passwordSchema,
    confirmPassword: z.string().min(12, t("errors.validation")),
    role: z.enum(["technician", "admin"]),
    language: z.enum(["pt", "en"]),
  }).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
      role: "technician",
      language: language as "pt" | "en",
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    // Limpa o erro anterior ao tentar submeter novamente
    setRegistrationError(null);
    
    try {
      await registerMutation.mutateAsync(values);
      toast({
        title: t("common.success"),
        description: t("auth.registrationSuccess"),
      });
      onSuccess();
    } catch (error: any) {
      console.error("Registration error:", error);
      
      // Verifica se o erro é de email já cadastrado
      if (error.message && error.message.includes("Email already registered")) {
        setRegistrationError(t("auth.emailAlreadyRegistered"));
      } else {
        setRegistrationError(t("auth.registrationError"));
      }
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {registrationError && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{t("common.error")}</AlertTitle>
            <AlertDescription>{registrationError}</AlertDescription>
          </Alert>
        )}
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
        
        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("common.confirmPassword")}</FormLabel>
              <FormControl>
                <Input
                  placeholder={t("auth.passwordPlaceholder")}
                  {...field}
                  type="password"
                  required
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="role"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Role</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="technician">{t("auth.technician")}</SelectItem>
                    <SelectItem value="admin">{t("auth.admin")}</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="language"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("common.language")}</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a language" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="pt">{t("common.portuguese")}</SelectItem>
                    <SelectItem value="en">{t("common.english")}</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        <Button
          type="submit"
          className="w-full mt-4"
          disabled={registerMutation.isPending}
        >
          {registerMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          {t("common.register")}
        </Button>
      </form>
    </Form>
  );
}
