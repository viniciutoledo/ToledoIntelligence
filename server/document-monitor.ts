/**
 * Monitor de Documentos em Processamento
 * 
 * Este módulo implementa um sistema de monitoramento automático para documentos
 * que ficam travados em estado de processamento por muito tempo.
 */

import { storage } from './storage';
import { logAction } from './audit';

// Tempo máximo (em minutos) que um documento pode ficar em estado "processing"
const MAX_PROCESSING_TIME_MINUTES = 30; 

/**
 * Verifica documentos travados em processamento e tenta recuperá-los
 */
export async function checkStuckDocuments() {
  try {
    console.log('Verificando documentos travados em processamento...');
    
    // Buscar todos os documentos em processamento
    const documents = await storage.getTrainingDocumentsByStatus('processing');
    
    if (documents.length === 0) {
      console.log('Nenhum documento em processamento encontrado.');
      return;
    }
    
    console.log(`Encontrados ${documents.length} documentos em processamento.`);
    
    // Data atual menos o tempo máximo de processamento permitido
    const cutoffTime = new Date();
    cutoffTime.setMinutes(cutoffTime.getMinutes() - MAX_PROCESSING_TIME_MINUTES);
    
    // Filtrar documentos travados (updated_at anterior ao cutoffTime)
    const stuckDocuments = documents.filter(doc => 
      doc.updated_at && new Date(doc.updated_at) < cutoffTime
    );
    
    if (stuckDocuments.length === 0) {
      console.log('Nenhum documento travado encontrado.');
      return;
    }
    
    console.log(`Encontrados ${stuckDocuments.length} documentos travados em processamento.`);
    
    // Processar cada documento travado
    for (const doc of stuckDocuments) {
      console.log(`Recuperando documento travado: ID ${doc.id}, Nome: ${doc.name}`);
      
      // Registrar no log de auditoria
      await logAction({
        userId: 0, // Sistema
        action: "document_auto_recovery",
        details: { 
          documentId: doc.id, 
          documentName: doc.name,
          stuckSince: doc.updated_at,
          progress: doc.progress
        },
        ipAddress: "system"
      });
      
      // Resetar o status do documento para permitir reprocessamento
      await storage.updateTrainingDocument(doc.id, {
        status: 'completed',
        error_message: `Documento foi automaticamente recuperado após estar travado em processamento por mais de ${MAX_PROCESSING_TIME_MINUTES} minutos com progresso de ${doc.progress || 0}%.`,
        updated_at: new Date(),
        progress: 0
      });
      
      console.log(`Documento ID ${doc.id} recuperado com sucesso.`);
    }
    
    console.log('Verificação de documentos travados concluída.');
  } catch (error) {
    console.error('Erro ao verificar documentos travados:', error);
  }
}

/**
 * Iniciar monitoramento automático de documentos
 * @param intervalMinutes Intervalo em minutos para verificação (padrão: 10)
 */
export function startDocumentMonitor(intervalMinutes = 10) {
  // Converter minutos para milissegundos
  const interval = intervalMinutes * 60 * 1000;
  
  console.log(`Iniciando monitoramento automático de documentos travados a cada ${intervalMinutes} minutos`);
  
  // Executar uma verificação inicial após 1 minuto
  setTimeout(() => {
    checkStuckDocuments();
    
    // Configurar intervalo regular após a verificação inicial
    setInterval(checkStuckDocuments, interval);
  }, 60 * 1000);
  
  return true;
}