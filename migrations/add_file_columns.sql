-- Adicionar colunas em chat_messages (se ainda não existirem)
ALTER TABLE chat_messages 
ADD COLUMN IF NOT EXISTS file_data TEXT,
ADD COLUMN IF NOT EXISTS file_mime_type TEXT;

-- Adicionar colunas em widget_chat_messages (se ainda não existirem)
ALTER TABLE widget_chat_messages 
ADD COLUMN IF NOT EXISTS file_data TEXT,
ADD COLUMN IF NOT EXISTS file_mime_type TEXT;