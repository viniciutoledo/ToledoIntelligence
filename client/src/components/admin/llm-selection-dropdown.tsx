import React, { useState } from "react";
import { Check, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface LlmModel {
  name: string;
  value: string;
  isNew?: boolean;
}

export interface LlmCategory {
  name: string;
  icon: React.ReactNode;
  models: LlmModel[];
}

interface LlmSelectionDropdownProps {
  value?: string;
  onValueChange: (value: string) => void;
  multiSelect?: boolean;
  className?: string;
}

export function LlmSelectionDropdown({
  value,
  onValueChange,
  multiSelect = false,
  className,
}: LlmSelectionDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    "OpenAI": true,
    "Anthropic": false,
    "Meta": false,
    "Alibaba": false,
    "Deepseek": false,
    "Maritaca": false,
  });
  const [selectedValues, setSelectedValues] = useState<string[]>(value ? [value] : []);

  // LLM categories and models definition
  const llmCategories: LlmCategory[] = [
    {
      name: "OpenAI",
      icon: <div className="w-5 h-5 rounded-full bg-gradient-to-r from-teal-400 to-green-500 flex items-center justify-center text-white text-xs">O</div>,
      models: [
        { name: "GPT-4.1", value: "gpt-4.1", isNew: true },
        { name: "GPT-4.1 Mini", value: "gpt-4.1-mini", isNew: true },
        { name: "o4-Mini", value: "o4-mini", isNew: true },
        { name: "o3", value: "o3", isNew: true },
        { name: "GPT-4o", value: "gpt-4o" },
        { name: "GPT-4o Mini", value: "gpt-4o-mini" },
        { name: "o3-Mini (Beta)", value: "o3-mini-beta" },
        { name: "o1", value: "o1" },
        { name: "GPT-4 Turbo", value: "gpt-4-turbo" },
      ],
    },
    {
      name: "Anthropic",
      icon: <div className="w-5 h-5 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center text-white text-xs">A</div>,
      models: [
        { name: "Claude 3.5 Sonnet", value: "claude-3-5-sonnet" },
        { name: "Claude 3.7 Sonnet", value: "claude-3-7-sonnet-20250219" },
        { name: "Claude 3.5 Haiku", value: "claude-3-5-haiku" },
      ],
    },
    {
      name: "Meta",
      icon: <div className="w-5 h-5 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center text-white text-xs">M</div>,
      models: [
        { name: "LLAMA 3.3", value: "llama-3.3" },
      ],
    },
    {
      name: "Alibaba",
      icon: <div className="w-5 h-5 rounded-full bg-gradient-to-r from-orange-500 to-red-500 flex items-center justify-center text-white text-xs">A</div>,
      models: [
        { name: "Qwen 2.5 Max", value: "qwen-2.5-max" },
      ],
    },
    {
      name: "Deepseek",
      icon: <div className="w-5 h-5 rounded-full bg-gradient-to-r from-blue-400 to-cyan-500 flex items-center justify-center text-white text-xs">D</div>,
      models: [
        { name: "Deepseek V3", value: "deepseek-v3" },
      ],
    },
    {
      name: "Maritaca",
      icon: <div className="w-5 h-5 rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 flex items-center justify-center text-white text-xs">M</div>,
      models: [
        { name: "Sabiá 3", value: "sabia-3" },
      ],
    },
  ];

  // Handle category toggle
  const toggleCategory = (categoryName: string) => {
    setExpandedCategories({
      ...expandedCategories,
      [categoryName]: !expandedCategories[categoryName],
    });
  };

  // Handle model selection
  const handleModelSelect = (modelValue: string) => {
    if (multiSelect) {
      // For multi-select, toggle the selection
      const newSelected = selectedValues.includes(modelValue)
        ? selectedValues.filter(v => v !== modelValue)
        : [...selectedValues, modelValue];
      
      setSelectedValues(newSelected);
      // For multi-select, we might want to pass the array of selected values
      // This depends on how you want to handle multiple selections
      onValueChange(newSelected[newSelected.length - 1] || "");
    } else {
      // For single select, just set the value
      setSelectedValues([modelValue]);
      onValueChange(modelValue);
      setIsOpen(false); // Close dropdown after selection for single select
    }
  };

  // Find the selected model name for display
  const getSelectedModelName = (): string => {
    if (selectedValues.length === 0) return "Selecione um modelo";
    
    if (selectedValues.length === 1) {
      // Find the model across all categories
      for (const category of llmCategories) {
        const model = category.models.find(m => m.value === selectedValues[0]);
        if (model) return model.name;
      }
    }
    
    return `${selectedValues.length} modelos selecionados`;
  };

  return (
    <div className="relative">
      {/* Dropdown trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center justify-between w-full h-10 px-3 py-2 bg-background border border-input rounded-md",
          "text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2",
          "focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
      >
        <span className="truncate">{getSelectedModelName()}</span>
        <ChevronDown className={`h-4 w-4 opacity-50 transition-transform ${isOpen ? 'rotate-180' : 'rotate-0'}`} />
      </button>

      {/* Dropdown content */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-card rounded-md shadow-lg border border-border overflow-hidden">
          <div className="max-h-80 overflow-y-auto p-1">
            {llmCategories.map((category) => (
              <div key={category.name} className="mb-1">
                {/* Category header */}
                <button
                  type="button"
                  onClick={() => toggleCategory(category.name)}
                  className="flex items-center w-full px-2 py-1.5 rounded-md hover:bg-accent group"
                >
                  {expandedCategories[category.name] ? (
                    <ChevronDown className="h-4 w-4 mr-2 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 mr-2 text-muted-foreground" />
                  )}
                  
                  {category.icon}
                  <span className="ml-2 text-sm font-medium">{category.name}</span>
                </button>
                
                {/* Models list */}
                {expandedCategories[category.name] && (
                  <div className="ml-7 mt-1">
                    {category.models.map((model) => (
                      <button
                        key={model.value}
                        type="button"
                        onClick={() => handleModelSelect(model.value)}
                        className={cn(
                          "flex items-center w-full px-2 py-1.5 text-sm rounded-md",
                          "hover:bg-accent",
                          selectedValues.includes(model.value) && "bg-accent"
                        )}
                      >
                        <span className="flex-1 text-left">{model.name}</span>
                        
                        {model.isNew && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300">
                            Novo
                          </span>
                        )}
                        
                        {selectedValues.includes(model.value) && (
                          <Check className="h-4 w-4 ml-2 text-primary" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}