import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useLanguage } from "@/hooks/use-language";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Loader2, Check, ArrowLeft } from "lucide-react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { apiRequest } from "@/lib/queryClient";

// Cores do tema
const colors = {
  primary: "#ff00c7", // Rosa vibrante
  secondary: "#00c2ff", // Azul ciano
  dark: "#0a0a0a", // Quase preto para fundo
  darkGray: "#1a1a1a", // Cinza escuro para cartões
  lightText: "#f8f8f8", // Texto claro
};

// Carregue o Stripe fora do componente
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

interface CheckoutFormProps {
  clientSecret: string;
  planDetails: {
    name: string;
    price: string;
    description: string;
  };
  onSuccess: () => void;
}

function CheckoutForm({ clientSecret, planDetails, onSuccess }: CheckoutFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const { t } = useLanguage();
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Manipulador de envio do formulário
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setPaymentError(null);

    // Confirmar o pagamento
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        // Redirecionar para a página de sucesso após o pagamento
        return_url: window.location.origin + "/checkout-success",
      },
      redirect: "if_required",
    });

    if (error) {
      setPaymentError(
        error.message || t("checkout.genericError")
      );
      toast({
        title: t("common.error"),
        description: error.message || t("checkout.genericError"),
        variant: "destructive",
      });
      setIsProcessing(false);
    } else {
      // Pagamento bem-sucedido sem redirecionamento
      toast({
        title: t("checkout.paymentSuccessful"),
        description: t("checkout.subscriptionActivated"),
      });
      setIsProcessing(false);
      onSuccess();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-gray-800 p-6 rounded-lg mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-white">{planDetails.name}</h3>
          <span className="text-2xl font-bold" style={{ color: colors.primary }}>
            {planDetails.price}
          </span>
        </div>
        <p className="text-gray-400 mb-3">{planDetails.description}</p>
        <div className="flex items-center text-green-400">
          <Check className="h-5 w-5 mr-2" />
          <span>{t("checkout.autoRenews")}</span>
        </div>
      </div>

      <div className="bg-gray-800 p-6 rounded-lg">
        <h3 className="text-xl font-bold mb-4 text-white">
          {t("checkout.paymentMethod")}
        </h3>
        <PaymentElement />
      </div>

      {paymentError && (
        <div className="bg-red-900 bg-opacity-20 border border-red-500 text-red-500 p-4 rounded-lg">
          {paymentError}
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setLocation("/")} disabled={isProcessing}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t("common.back")}
        </Button>
        <Button
          type="submit"
          disabled={!stripe || isProcessing}
          style={{ backgroundColor: isProcessing ? "#6b21a8" : colors.primary }}
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t("checkout.processing")}
            </>
          ) : (
            t("checkout.subscribe")
          )}
        </Button>
      </div>
    </form>
  );
}

export default function CheckoutPage() {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [planDetails, setPlanDetails] = useState<{
    name: string;
    price: string;
    description: string;
  } | null>(null);
  
  const { t } = useLanguage();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  // Extrair o ID do plano da query string
  const searchParams = new URLSearchParams(window.location.search);
  const planId = searchParams.get("plan");
  
  useEffect(() => {
    // Redirecionamentos e verificações
    if (!user) {
      setLocation("/");
      return;
    }

    if (!planId) {
      setError(t("checkout.missingPlanId"));
      setIsLoading(false);
      return;
    }

    // Buscar detalhes do plano e criar intenção de pagamento
    const fetchPaymentIntent = async () => {
      try {
        setIsLoading(true);
        
        // Obter os detalhes do plano do servidor
        const response = await apiRequest("POST", "/api/create-subscription", {
          priceId: planId,
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || t("checkout.subscriptionError"));
        }
        
        const data = await response.json();
        
        // Configurar os detalhes do cliente e do plano
        setClientSecret(data.clientSecret);
        setPlanDetails({
          name: data.planName,
          price: data.planPrice,
          description: data.planDescription,
        });
        
        setIsLoading(false);
      } catch (error: any) {
        setError(error.message || t("checkout.genericError"));
        toast({
          title: t("common.error"),
          description: error.message || t("checkout.genericError"),
          variant: "destructive",
        });
        setIsLoading(false);
      }
    };

    fetchPaymentIntent();
  }, [user, planId, setLocation, t, toast]);

  // Manipulador para após o sucesso do pagamento
  const handlePaymentSuccess = () => {
    // Redirecionar para o dashboard
    setLocation("/dashboard");
  };

  // Loading state
  if (isLoading) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center p-4"
        style={{ backgroundColor: colors.dark, color: colors.lightText }}
      >
        <Loader2 className="h-12 w-12 animate-spin mb-4" style={{ color: colors.primary }} />
        <p className="text-xl">{t("checkout.preparingCheckout")}</p>
      </div>
    );
  }

  // Error state
  if (error || !clientSecret || !planDetails) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center p-4"
        style={{ backgroundColor: colors.dark, color: colors.lightText }}
      >
        <div className="max-w-md w-full bg-gray-800 p-6 rounded-lg text-center">
          <h2 className="text-2xl font-bold mb-4 text-white">
            {t("checkout.somethingWentWrong")}
          </h2>
          <p className="text-gray-400 mb-6">{error || t("checkout.genericError")}</p>
          <Button onClick={() => setLocation("/")} className="w-full" style={{ backgroundColor: colors.primary }}>
            {t("common.backToHome")}
          </Button>
        </div>
      </div>
    );
  }

  // Checkout interface
  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: colors.dark, color: colors.lightText }}
    >
      <div className="container mx-auto py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold mb-8 text-center">
            {t("checkout.completeYourSubscription")}
          </h1>

          <Elements
            stripe={stripePromise}
            options={{
              clientSecret,
              appearance: {
                theme: "night",
                variables: {
                  colorPrimary: colors.primary,
                  colorBackground: colors.darkGray,
                  colorText: colors.lightText,
                  colorDanger: "#ef4444",
                  fontFamily: "Inter, system-ui, sans-serif",
                  borderRadius: "8px",
                },
              },
            }}
          >
            <CheckoutForm
              clientSecret={clientSecret}
              planDetails={planDetails}
              onSuccess={handlePaymentSuccess}
            />
          </Elements>
        </div>
      </div>
    </div>
  );
}