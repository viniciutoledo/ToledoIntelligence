-- Adiciona a coluna progress à tabela training_documents
ALTER TABLE training_documents ADD COLUMN IF NOT EXISTS progress integer DEFAULT 0;
