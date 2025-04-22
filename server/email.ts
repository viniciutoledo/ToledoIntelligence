import { supabase } from './supabase';
import { User } from '@shared/schema';

interface EmailOptions {
  to: string;
  subject: string;
  htmlContent?: string;
  textContent?: string;
}

/**
 * Envia email usando Supabase - isso vai para a funcionalidade de email
 * configurada no projeto Supabase (se estiver configurada)
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    // Aqui usamos o Supabase Functions para enviar email
    // Nota: você precisa ter configurado uma função no Supabase para processar emails
    const { data, error } = await supabase.functions.invoke('send-email', {
      body: {
        to: options.to,
        subject: options.subject,
        html: options.htmlContent,
        text: options.textContent
      }
    });
    
    if (error) {
      console.error('Erro ao enviar email via Supabase:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Erro ao enviar email:', error);
    return false;
  }
}

/**
 * Gera e envia um código OTP para o usuário
 */
export async function sendOtpEmail(user: User, otp: string): Promise<boolean> {
  const subject = user.language === "pt" 
    ? "Código de verificação ToledoIA"
    : "ToledoIA verification code";
  
  const textContent = user.language === "pt"
    ? `Seu código de verificação é: ${otp}\nEste código expira em 10 minutos.`
    : `Your verification code is: ${otp}\nThis code expires in 10 minutes.`;
  
  const htmlContent = user.language === "pt"
    ? `<h1>Código de verificação ToledoIA</h1>
       <p>Seu código de verificação é: <strong>${otp}</strong></p>
       <p>Este código expira em 10 minutos.</p>`
    : `<h1>ToledoIA verification code</h1>
       <p>Your verification code is: <strong>${otp}</strong></p>
       <p>This code expires in 10 minutes.</p>`;
  
  return await sendEmail({
    to: user.email,
    subject,
    htmlContent,
    textContent
  });
}