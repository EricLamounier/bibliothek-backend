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

export const sendEmails = async(name: any, email: any, code: string, text: string | undefined, subject="Seu acesso Bibliothek") => {
	
	const transporter = nodemailer.createTransport({
		service: 'gmail',
		auth: {
		  user: 'cepf.bibliothek@gmail.com',
		  pass: 'owngvvmhkwhvwbhz',
		},
	});

	if(!text){
		text = `Hey${name ? `, ${name}` : ''}! Aqui está sua senha de acesso temporária. Não compartilhe com ninguém, ok?`;
	}
	
	const recipientData = {
		verificationCode: code,
		name: name ? name : '',
	};

	const renderedHtml = renderTemplate(emailTemplate, recipientData, text);
	
	const mailOptions = {
		from: 'Bibliothek CEPF <cepf.bibliothek@gmail.com>',    // Sender address
		to: email, // List of recipients
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

	transporter.close();	
}