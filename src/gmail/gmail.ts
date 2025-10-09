import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';

// Ler o arquivo HTML do template
const templatePath = path.join(__dirname, 'template.html');
const emailTemplate = fs.readFileSync(templatePath, 'utf8');

function renderTemplate(template: string, data: { [x: string]: any; verificationCode?: any; username?: any; }, text: string) {
    return template.replace(/{{(\w+)}}/g, (_: any, key: string | number) => data[key] || text);
}

export const generateTempPassword = (length = 6) => {
    const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#";
    return Array.from({ length }, () => charset[Math.floor(Math.random() * charset.length)]).join('');
};

export const generateCode = (length = 6) => {
    const charset = "0123456789";
    return Array.from({ length }, () => charset[Math.floor(Math.random() * charset.length)]).join('');
};

const sleep = (ms=5000) => new Promise(resolve => setTimeout(resolve, ms));

export const sendEmails = async (
  name: string,
  email: string,
  code: string,
  text?: string,
  subject = "Seu acesso Bibliothek"
) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_EMAIL,
      pass: process.env.GMAIL_PASSWORD,
    },
  });

  const messageText =
    text ||
    `Hey${name ? `, ${name}` : ""}! Aqui está sua senha de acesso temporário. Não compartilhe com ninguém, ok?`;

  const recipientData = {
    verificationCode: code,
    name: name || "",
  };

  try {
    const renderedHtml = renderTemplate(emailTemplate, recipientData, messageText);

    const mailOptions = {
      from: "Bibliothek CEPF <cepf.bibliothek@gmail.com>",
      to: email,
      subject,
      html: renderedHtml,
      headers: {
        "Content-Language": "pt-br",
      },
    };

    const info = await transporter.sendMail(mailOptions);
  } catch (error: any) {
    console.error("Falha ao enviar email:", {
      message: error.message,
      code: error.code,
      response: error.response,
      stack: error.stack,
    });
  } finally {
    // Fecha a conexão apenas se for um transport baseado em conexão direta (não no pool)
    if (typeof transporter.close === "function") {
      transporter.close();
    }
  }
};