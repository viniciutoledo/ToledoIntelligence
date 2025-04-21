import { useLanguage } from "@/hooks/use-language";
import { Button } from "@/components/ui/button";

export function BlockedAccount({ onBackToLogin }: { onBackToLogin: () => void }) {
  const { t } = useLanguage();
  
  return (
    <div>
      <div className="text-center text-red-600">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mx-auto"
        >
          <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </div>
      <div className="text-center mt-4">
        <h2 className="text-2xl font-bold text-neutral-800">
          {t("auth.accountBlocked")}
        </h2>
        <p className="mt-4 text-neutral-600">
          {t("auth.accountBlockedMessage")}
        </p>
      </div>
      <div className="pt-4">
        <Button 
          variant="outline" 
          className="w-full"
          onClick={onBackToLogin}
        >
          {t("auth.backToLogin")}
        </Button>
      </div>
    </div>
  );
}
