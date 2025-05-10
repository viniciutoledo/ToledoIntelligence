import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  return (
    <div className={cn("markdown-content", className)}>
      <ReactMarkdown
        components={{
          // Estilizando headings
          h1: ({ node, ...props }) => <h1 className="text-2xl font-bold mb-4 mt-6" {...props} />,
          h2: ({ node, ...props }) => <h2 className="text-xl font-bold mb-3 mt-5" {...props} />,
          h3: ({ node, ...props }) => <h3 className="text-lg font-bold mb-3 mt-4" {...props} />,
          h4: ({ node, ...props }) => <h4 className="text-base font-bold mb-2 mt-3" {...props} />,
          
          // Estilizando listas
          ul: ({ node, ...props }) => <ul className="list-disc pl-6 mb-4" {...props} />,
          ol: ({ node, ...props }) => <ol className="list-decimal pl-6 mb-4" {...props} />,
          li: ({ node, ...props }) => <li className="mb-1" {...props} />,
          
          // Estilizando parágrafos
          p: ({ node, ...props }) => <p className="mb-4" {...props} />,
          
          // Estilizando blocos de código
          code: ({ node, className, children, ...props }) => {
            const match = /language-(\w+)/.exec(className || '');
            
            // Se for um bloco de código com linguagem especificada
            if (match) {
              return (
                <div className="rounded-md overflow-hidden mb-4">
                  <div className="bg-neutral-800 text-white text-xs px-4 py-1">
                    {match[1].toUpperCase()}
                  </div>
                  <pre className="p-4 bg-neutral-100 dark:bg-neutral-900 overflow-x-auto">
                    <code className={className} {...props}>
                      {children}
                    </code>
                  </pre>
                </div>
              );
            }
            
            // Se for um inline code (sem linguagem especificada)
            return (
              <code 
                className="bg-neutral-100 dark:bg-neutral-800 rounded px-1 py-0.5 text-sm font-mono" 
                {...props}
              >
                {children}
              </code>
            );
          },
          
          // Estilizando blockquotes
          blockquote: ({ node, ...props }) => (
            <blockquote 
              className="border-l-4 border-neutral-300 dark:border-neutral-600 pl-4 py-1 my-4 text-neutral-600 dark:text-neutral-400" 
              {...props} 
            />
          ),
          
          // Estilizando tabelas
          table: ({ node, ...props }) => (
            <div className="overflow-x-auto mb-4">
              <table className="min-w-full border-collapse" {...props} />
            </div>
          ),
          thead: ({ node, ...props }) => <thead className="bg-neutral-100 dark:bg-neutral-800" {...props} />,
          tbody: ({ node, ...props }) => <tbody {...props} />,
          tr: ({ node, ...props }) => <tr className="border-b border-neutral-200 dark:border-neutral-700" {...props} />,
          th: ({ node, ...props }) => <th className="px-4 py-2 text-left font-medium" {...props} />,
          td: ({ node, ...props }) => <td className="px-4 py-2" {...props} />,
          
          // Estilizando links
          a: ({ node, ...props }) => (
            <a 
              className="text-primary hover:underline" 
              target="_blank" 
              rel="noopener noreferrer" 
              {...props} 
            />
          ),
          
          // Estilizando divisores
          hr: ({ node, ...props }) => <hr className="my-6 border-neutral-300 dark:border-neutral-700" {...props} />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}