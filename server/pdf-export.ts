import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const execPromise = promisify(exec);

// Tipos para as análises
export interface AnalysisExportData {
  id: string;
  circuitName: string;
  imageUrl?: string;
  imageBase64?: string;
  description: string;
  analysis: string;
  userId: number;
  userName: string;
  createdAt: Date;
  modelUsed: string;
  tags?: string[];
  recommendations?: string[];
}

/**
 * Gera um PDF a partir dos dados de análise fornecidos
 * @param data Dados da análise para exportar
 * @returns Caminho para o arquivo PDF gerado
 */
export async function generateAnalysisPDF(data: AnalysisExportData): Promise<string> {
  try {
    // Criamos uma pasta temporária para armazenar os arquivos gerados
    const tmpDir = path.join(__dirname, '../tmp');
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }

    // Nome do arquivo baseado em ID único para evitar colisões
    const fileId = uuidv4();
    const htmlFilePath = path.join(tmpDir, `${fileId}.html`);
    const pdfFilePath = path.join(tmpDir, `${fileId}.pdf`);
    
    // Formata a data para o formato brasileiro
    const formattedDate = format(
      data.createdAt, 
      "dd 'de' MMMM 'de' yyyy 'às' HH:mm", 
      { locale: ptBR }
    );

    // Gera o conteúdo HTML do relatório
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Análise de Circuito - ${data.circuitName}</title>
        <style>
          body {
            font-family: 'Segoe UI', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 210mm;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 10px;
            border-bottom: 1px solid #ddd;
          }
          .logo {
            font-size: 24px;
            font-weight: bold;
            color: #4f46e5;
          }
          .subtitle {
            color: #666;
            font-size: 14px;
          }
          .report-title {
            font-size: 22px;
            margin: 20px 0;
            color: #333;
          }
          .metadata {
            background-color: #f9f9f9;
            padding: 15px;
            border-radius: 5px;
            margin-bottom: 20px;
            font-size: 14px;
          }
          .metadata .item {
            margin-bottom: 5px;
          }
          .metadata .label {
            font-weight: bold;
            display: inline-block;
            width: 140px;
          }
          .section {
            margin: 25px 0;
          }
          .section-title {
            font-size: 18px;
            color: #4f46e5;
            margin-bottom: 10px;
            padding-bottom: 5px;
            border-bottom: 1px solid #eee;
          }
          .image-container {
            text-align: center;
            margin: 20px 0;
          }
          .circuit-image {
            max-width: 100%;
            max-height: 300px;
            border: 1px solid #ddd;
          }
          .analysis-content {
            background-color: #f9f9f9;
            padding: 15px;
            border-radius: 5px;
            white-space: pre-wrap;
          }
          .tags {
            margin-top: 20px;
          }
          .tag {
            display: inline-block;
            background-color: #e5e7eb;
            padding: 3px 8px;
            border-radius: 4px;
            margin-right: 5px;
            margin-bottom: 5px;
            font-size: 12px;
          }
          .footer {
            margin-top: 40px;
            padding-top: 10px;
            border-top: 1px solid #ddd;
            text-align: center;
            font-size: 12px;
            color: #666;
          }
          .recommendations {
            margin-top: 20px;
          }
          .recommendations ul {
            padding-left: 20px;
          }
          .page-break {
            page-break-after: always;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">ToledoIA</div>
          <div class="subtitle">Análise de Circuito Eletrônico</div>
        </div>
        
        <h1 class="report-title">${data.circuitName}</h1>
        
        <div class="metadata">
          <div class="item"><span class="label">ID da Análise:</span> ${data.id}</div>
          <div class="item"><span class="label">Data de Criação:</span> ${formattedDate}</div>
          <div class="item"><span class="label">Técnico:</span> ${data.userName}</div>
          <div class="item"><span class="label">Modelo IA:</span> ${data.modelUsed}</div>
        </div>
        
        <div class="section">
          <h2 class="section-title">Descrição do Problema</h2>
          <p>${data.description}</p>
        </div>
        
        ${data.imageBase64 ? `
        <div class="section">
          <h2 class="section-title">Imagem do Circuito</h2>
          <div class="image-container">
            <img class="circuit-image" src="data:image/jpeg;base64,${data.imageBase64}" alt="Imagem do Circuito">
          </div>
        </div>
        ` : ''}
        
        <div class="section">
          <h2 class="section-title">Análise Técnica</h2>
          <div class="analysis-content">${data.analysis.replace(/\n/g, '<br>')}</div>
        </div>
        
        ${data.tags && data.tags.length > 0 ? `
        <div class="section">
          <h2 class="section-title">Tags</h2>
          <div class="tags">
            ${data.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
          </div>
        </div>
        ` : ''}
        
        ${data.recommendations && data.recommendations.length > 0 ? `
        <div class="section">
          <h2 class="section-title">Recomendações</h2>
          <div class="recommendations">
            <ul>
              ${data.recommendations.map(rec => `<li>${rec}</li>`).join('')}
            </ul>
          </div>
        </div>
        ` : ''}
        
        <div class="footer">
          <p>Documento gerado automaticamente pelo sistema ToledoIA em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm:ss")}</p>
          <p>© ${new Date().getFullYear()} ToledoIA - Todos os direitos reservados</p>
        </div>
      </body>
      </html>
    `;

    // Salva o HTML em um arquivo temporário
    fs.writeFileSync(htmlFilePath, htmlContent);

    // Use um utilitário como wkhtmltopdf para converter HTML em PDF
    // Em ambiente de produção, pode ser necessário configurar isso como um pacote de dependência
    // Note que isso depende de ter wkhtmltopdf instalado no servidor
    await execPromise(`wkhtmltopdf --enable-local-file-access ${htmlFilePath} ${pdfFilePath}`);

    // Verifica se o PDF foi gerado
    if (!fs.existsSync(pdfFilePath)) {
      throw new Error('Falha ao gerar o arquivo PDF');
    }

    // Limpa o arquivo HTML temporário
    fs.unlinkSync(htmlFilePath);

    return pdfFilePath;
  } catch (error) {
    console.error('Erro ao gerar o PDF:', error);
    throw new Error(`Falha ao gerar o PDF: ${error.message}`);
  }
}

/**
 * Alternativa para gerar PDF usando bibliotecas JavaScript puras se wkhtmltopdf não estiver disponível
 */
export async function generateAnalysisPDFWithJS(data: AnalysisExportData): Promise<string> {
  // Implementar geração de PDF com bibliotecas como pdfkit, jspdf, etc.
  // Esta seria uma alternativa quando não temos acesso a ferramentas externas como wkhtmltopdf
  throw new Error('Método ainda não implementado');
}

/**
 * Lê um arquivo PDF e retorna como um buffer
 */
export function readPDFFile(filePath: string): Buffer {
  if (!fs.existsSync(filePath)) {
    throw new Error(`O arquivo PDF não existe: ${filePath}`);
  }
  return fs.readFileSync(filePath);
}

/**
 * Limpa arquivos PDF temporários que estão mais velhos que o limite especificado
 */
export function cleanupTempPDFs(maxAgeHours = 24): void {
  const tmpDir = path.join(__dirname, '../tmp');
  if (!fs.existsSync(tmpDir)) return;

  const currentTime = new Date().getTime();
  const files = fs.readdirSync(tmpDir);

  for (const file of files) {
    if (!file.endsWith('.pdf')) continue;
    
    const filePath = path.join(tmpDir, file);
    const stats = fs.statSync(filePath);
    const fileAgeHours = (currentTime - stats.mtimeMs) / (1000 * 60 * 60);
    
    if (fileAgeHours > maxAgeHours) {
      try {
        fs.unlinkSync(filePath);
        console.log(`Arquivo temporário removido: ${filePath}`);
      } catch (error) {
        console.error(`Erro ao remover arquivo temporário ${filePath}:`, error);
      }
    }
  }
}