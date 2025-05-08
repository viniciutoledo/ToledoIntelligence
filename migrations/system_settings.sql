-- Criando a tabela system_settings se ela não existir
CREATE TABLE IF NOT EXISTS system_settings (
  id SERIAL PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  updated_by INTEGER REFERENCES users(id),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  description TEXT
);

-- Inserindo valores padrão apenas se eles não existirem
INSERT INTO system_settings (key, value, description)
VALUES 
  ('log_level', 'medium', 'Nível de detalhamento dos logs: low, medium, high'),
  ('log_retention_days', '90', 'Período de retenção de logs em dias'),
  ('require2FA', 'false', 'Se a autenticação de dois fatores é obrigatória para admins'),
  ('autoRegisterTechnicians', 'false', 'Se técnicos podem se registrar automaticamente sem aprovação')
ON CONFLICT (key) DO NOTHING;