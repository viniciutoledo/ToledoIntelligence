import { User } from '@shared/schema';
import { supabase } from './supabase';

interface EmailOptions {
  to: string;
  subject: string;
  htmlContent?: string;
  textContent?: string;
}

/**
 * Em ambiente de desenvolvimento, simula o envio de email
 * Apenas imprime no console e sempre retorna sucesso
 * 
 * Em produção, seria necessário configurar um serviço de envio de email
 * como SendGrid, Mailgun, Amazon SES ou similar
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  // No ambiente de desenvolvimento, apenas imprimimos o email no console
  console.log('----------- EMAIL SIMULADO -----------');
  console.log(`Para: ${options.to}`);
  console.log(`Assunto: ${options.subject}`);
  console.log('Conteúdo:');
  console.log(options.textContent || options.htmlContent);
  console.log('------------------------------------');
  
  try {
    // Tenta registrar o email no banco de dados do Supabase para fins de registro
    // Não é necessário para o funcionamento, apenas para registro
    await supabase
      .from('dev_emails')
      .insert([
        {
          to: options.to,
          subject: options.subject,
          content: options.textContent || options.htmlContent
        }
      ]);
  } catch (error) {
    // Ignora erros ao registrar no Supabase - pode não ter a tabela
    console.log('Aviso: Não foi possível registrar o email simulado no Supabase');
  }
  
  // Sempre retorna sucesso em desenvolvimento
  return true;
}

/**
 * Gera e "envia" um código OTP para o usuário
 * Em desenvolvimento, apenas registra no console
 */
export async function sendOtpEmail(user: User, otp: string): Promise<boolean> {
  // Gera os conteúdos do email
  const subject = user.language === "pt" 
    ? "Código de verificação ToledoIA"
    : "ToledoIA verification code";
  
  const textContent = user.language === "pt"
    ? `Seu código de verificação é: ${otp}\nEste código expira em 10 minutos.\n\n*** CÓDIGO PARA DESENVOLVIMENTO: 123456 ***`
    : `Your verification code is: ${otp}\nThis code expires in 10 minutes.\n\n*** DEVELOPMENT CODE: 123456 ***`;
  
  const htmlContent = user.language === "pt"
    ? `<h1>Código de verificação ToledoIA</h1>
       <p>Seu código de verificação é: <strong>${otp}</strong></p>
       <p>Este código expira em 10 minutos.</p>
       <p><strong>*** PARA DESENVOLVIMENTO VOCÊ TAMBÉM PODE USAR: 123456 ***</strong></p>`
    : `<h1>ToledoIA verification code</h1>
       <p>Your verification code is: <strong>${otp}</strong></p>
       <p>This code expires in 10 minutes.</p>
       <p><strong>*** FOR DEVELOPMENT YOU CAN ALSO USE: 123456 ***</strong></p>`;
  
  // Envia o email (simulado em desenvolvimento)
  return await sendEmail({
    to: user.email,
    subject,
    htmlContent,
    textContent
  });
}