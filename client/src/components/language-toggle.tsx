import { useLanguage } from "@/hooks/use-language";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

export function LanguageToggle({ className }: { className?: string }) {
  const { language, changeLanguage } = useLanguage();
  const { user, changeLanguageMutation } = useAuth();

  const toggleLanguage = (lang: string) => {
    // Change the UI language immediately
    changeLanguage(lang);
    
    // If user is logged in, also update the language in the database
    if (user && (lang === "pt" || lang === "en")) {
      changeLanguageMutation.mutate(lang);
    }
  };

  return (
    <div className={`${className} bg-white shadow rounded-full flex text-sm`}>
      <Button
        variant="ghost"
        onClick={() => toggleLanguage("pt")}
        className={`px-3 py-1 rounded-full ${
          language === "pt" ? "bg-primary text-white" : "text-neutral-600"
        }`}
      >
        PT
      </Button>
      <Button
        variant="ghost"
        onClick={() => toggleLanguage("en")}
        className={`px-3 py-1 rounded-full ${
          language === "en" ? "bg-primary text-white" : "text-neutral-600"
        }`}
      >
        EN
      </Button>
    </div>
  );
}
