import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';

// Ler o arquivo HTML do template
const templatePath = path.join(__dirname, 'template.html');
const emailTemplate = fs.readFileSync(templatePath, 'utf8');

// Create a transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'cepf.bibliothek@gmail.com',
    pass: 'owngvvmhkwhvwbhz',
  },
});

function renderTemplate(template: string, data: { [x: string]: any; verificationCode?: any; username?: any; }, text: string) {
    return template.replace(/{{(\w+)}}/g, (_: any, key: string | number) => data[key] || text);
}

export const generateTempPassword = (length = 8) => {
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!?";
    return Array.from({ length }, () => charset[Math.floor(Math.random() * charset.length)]).join('');
};

export const generateCode = (length = 6) => {
    const charset = "0123456789";
    return Array.from({ length }, () => charset[Math.floor(Math.random() * charset.length)]).join('');
};

const sleep = (ms=5000) => new Promise(resolve => setTimeout(resolve, ms));

export const sendEmails = async(name: any, email: any, code: string, text: string | undefined, subject="Seu acesso Bibliothek") => {
	if(!text){
		text = `Hey, ${name}! Aqui está sua senha de acesso temporária. Não compartilhe com ninguém, ok?`;
	}

    const emails = [
        {
            email: email,
            name: name,
            verificationCode: code
        },
    ]

	for(const email of emails){
		const recipientData = {
			verificationCode: email.verificationCode,
			name: email.name,
		};

		const renderedHtml = renderTemplate(emailTemplate, recipientData, text);
		
		const mailOptions = {
		  from: 'Bibliothek CEPF <cepf.bibliothek@gmail.com>',    // Sender address
		  to: email.email, // List of recipients
		  subject: subject,           // Subject line
		  html: renderedHtml,
		  headers: {
			'Content-Language': 'pt-br' // Define the language of the email as Brazilian Portuguese
		  }
		};

		transporter.sendMail(mailOptions, (error: any, info: { response: any; }) => {
		  if (error) {
			console.log('Error:', error);
		  } else {
			console.log('Email sent:', info.response);
		  }
		});
		await sleep(5000);
	}
}