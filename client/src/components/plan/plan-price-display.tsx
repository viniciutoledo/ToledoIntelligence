import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

type PlanPriceDisplayProps = {
  tier: "basic" | "intermediate";
  className?: string;
};

type PlanPricing = {
  id: number;
  subscription_tier: "none" | "basic" | "intermediate";
  name: string;
  price: number; // Armazenado em centavos
  currency: "USD" | "BRL";
  description: string | null;
  created_at: Date;
  updated_at: Date;
};

/**
 * Componente para exibir o preço do plano de forma dinâmica na landing page e checkout
 */
export function PlanPriceDisplay({ tier, className = "" }: PlanPriceDisplayProps) {
  const [pricing, setPricing] = useState<PlanPricing | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPricing = async () => {
      try {
        setIsLoading(true);
        const response = await apiRequest('GET', `/api/plans/pricing?tier=${tier}`);
        const data = await response.json();
        setPricing(data);
        setError(null);
      } catch (err) {
        console.error("Erro ao buscar preço:", err);
        setError("Erro ao carregar preço");
      } finally {
        setIsLoading(false);
      }
    };

    fetchPricing();
  }, [tier]);

  if (isLoading) {
    return (
      <span className={`inline-flex items-center ${className}`}>
        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
        <span>Carregando...</span>
      </span>
    );
  }

  if (error || !pricing) {
    // Fallback para valores padrão
    return (
      <span className={className}>
        {tier === "basic" ? "R$29,90" : "R$39,90"}
      </span>
    );
  }

  // Formatar preço de centavos para reais com o símbolo da moeda
  const formattedPrice = pricing.currency === "BRL"
    ? `R$${(pricing.price / 100).toFixed(2).replace('.', ',')}`
    : `$${(pricing.price / 100).toFixed(2)}`;

  return (
    <span className={className}>{formattedPrice}</span>
  );
}