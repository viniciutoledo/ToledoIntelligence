import { supabase } from './supabase';
import { User } from '@shared/schema';

interface EmailOptions {
  to: string;
  subject: string;
  htmlContent?: string;
  textContent?: string;
}

/**
 * Envia email usando Supabase - isso usa a API nativa do Supabase para emails
 * configurada no projeto Supabase
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    // Usando o método nativo do Supabase para envio de emails
    // Nota: Este método requer que o email esteja configurado no Supabase Admin
    const { error } = await supabase.auth.resetPasswordForEmail(options.to, {
      redirectTo: process.env.SUPABASE_REDIRECT_URL || 'http://localhost:5000/',
      data: {
        subject: options.subject,
        html_content: options.htmlContent,
        text_content: options.textContent,
        custom_email: true
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
 * Utilizando o método de autenticação OAuth do Supabase para enviar o email
 */
export async function sendOtpEmail(user: User, otp: string): Promise<boolean> {
  try {
    // Usamos o método signInWithOtp para enviar um código por email
    const { error } = await supabase.auth.signInWithOtp({
      email: user.email,
      options: {
        // Não queremos que o usuário possa fazer login com este link, apenas receber o email
        shouldCreateUser: false,
        data: {
          otp: otp,
          language: user.language,
          app_mode: 'verification'
        }
      }
    });
    
    if (error) {
      console.error('Erro ao enviar OTP via Supabase:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Erro ao enviar OTP:', error);
    return false;
  }
}