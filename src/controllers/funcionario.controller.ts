import { FastifyReply, FastifyRequest } from 'fastify';
import pool from '../config/db';
import { verifyJWT, hashPassword } from '../utils/jwt';
import { sendEmails, generateTempPassword } from '../gmail/gmail';
import { deleteImages, processAndUploadImage } from '../utils/imagekit';
import { MultipartFile } from '@fastify/multipart';

export const getFuncionario = async (request: FastifyRequest, reply: FastifyReply) => {
    const { funcionario, privilegio, situacao } = request.query as { funcionario?: number, privilegio?: string, situacao?: string };
    //console.log(funcionario, privilegio, situacao)
    let query = `SELECT 
                    PES.*,
                    FUN.CODIGOFUNCIONARIO,
                    FUN.EMAIL,
                    FUN.DATAADMISSAO,
                    FUN.PRIVILEGIO	
                FROM PESSOA PES JOIN FUNCIONARIO FUN ON PES.CODIGOPESSOA = FUN.CODIGOPESSOA
            `;
    const conditions: string[] = []
    const values: any[] = []
    let paramIndex = 1

    if (funcionario) {
        const funcionarios = Array.isArray(funcionario) ? funcionario : [funcionario]
        const placeholders = funcionarios.map((_, i) => `$${paramIndex + i}`)
        conditions.push(`FUN.CODIGOFUNCIONARIO IN (${placeholders.join(',')})`)
        values.push(...funcionarios)
        paramIndex += funcionarios.length
    }

    if (privilegio) {
        const privilegios = Array.isArray(privilegio) ? privilegio : [privilegio]
        const placeholders = privilegios.map((_, i) => `$${paramIndex + i}`)
        conditions.push(`FUN.PRIVILEGIO IN (${placeholders.join(',')})`)
        values.push(...privilegios)
        paramIndex += privilegios.length
    }

    if (situacao) {
        const situacoes = Array.isArray(situacao) ? situacao : [situacao]
        const placeholders = situacoes.map((_, i) => `$${paramIndex + i}`)
        conditions.push(`SITUACAO IN (${placeholders.join(',')})`)
        values.push(...situacoes.map(Number))
        paramIndex += situacoes.length
    }

    if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ') + ' AND PES.TIPOPESSOA = 2'
    } else {
        query += ' WHERE PES.TIPOPESSOA = 2'
    }

    query += `
        GROUP BY PES.CODIGOPESSOA, PES.NOME, PES.CONTATO, FUN.CODIGOFUNCIONARIO
    `;

    //console.log(query, values)

    const { rows : funcionarios } = await pool.query(query, values);

    reply.status(200).send({ message: 'Funcionarios fetched successfully!', data: funcionarios });
};

export const postFuncionario = async(request: FastifyRequest, reply: FastifyReply) => {
    
    const token = request.cookies.token;

    const { funcionario: funcionarioField, image } = request.body as { funcionario: { value: string }, image?: MultipartFile };
    const funcionario = JSON.parse(funcionarioField.value);

    let imageUrl = null
    try{
        if(!token){
            return reply.status(401).send({ message: 'Token not found!' });
        }

        const res = await verifyJWT(token);

        if(!res){
            return reply.status(401).send({ message: 'Expired section!', data: ''});
        }

        if (image) {
            try {
                imageUrl = await processAndUploadImage(image, '/PessoasImagens');
            } catch (err) {
                //console.log(err)
                return reply.status(500).send({ message: 'Failed to upload image', error: err });
            }
        }

        await pool.query('BEGIN');
        
        const dataPessoa = [funcionario.nome, funcionario.contato, funcionario.observacao, imageUrl, 2];
        const queryPessoa = `INSERT INTO PESSOA (NOME, CONTATO, OBSERVACAO, IMAGEM, TIPOPESSOA)
                            VALUES ($1, $2, $3, $4, $5) RETURNING *`;
        const {rows: [pessoaRow]} = await pool.query(queryPessoa, dataPessoa);
        // Pega senha temporaria
        const tempPassword = generateTempPassword()
        const hashedPassword = await hashPassword(tempPassword)

        const queryFuncionario = "INSERT INTO FUNCIONARIO (EMAIL, DATAADMISSAO, PRIVILEGIO, SENHA, CODIGOPESSOA) VALUES ($1, $2, $3, $4, $5) RETURNING *";
        const data = [funcionario.email, funcionario.dataadmissao, funcionario.privilegio, hashedPassword, pessoaRow.codigopessoa]
        const {rows: [funcionarioRow]} = await pool.query(queryFuncionario, data);

        await pool.query('COMMIT');

        const createdData = {
            ...funcionarioRow,
            ...pessoaRow
        }

        const {senha, ...formatedFuncionario} = createdData;

        sendEmails(funcionario.nome, funcionario.email, tempPassword, undefined, "Seu acesso Bibliothek");
 
        reply.status(200).send({ message: 'Funcionario inserted successfully!', data:  formatedFuncionario});
    }catch(err : any){
        //console.log(err)
        imageUrl && await deleteImages([imageUrl])
        reply.status(500).send({ message: 'Funcionario not inserted!', data: err, errorMessage: err?.message });
    }
};

export const putFuncionario = async (request: FastifyRequest, reply: FastifyReply) => {
    const token = request.cookies.token;

    const { funcionario: funcionarioField, image } = request.body as { funcionario: { value: string }, image?: MultipartFile };
    const funcionario = JSON.parse(funcionarioField.value);

    try{

        if(!token){
            return reply.status(401).send({ message: 'Token not found!' });
        }

        const res = await verifyJWT(token);

        if(!res){
            return reply.status(401).send({ message: 'Expired section!', data: ''});
        }

        let imagemUrl = null;
        let imageID = null;
        const queryImagem = 'SELECT IMAGEM FROM PESSOA WHERE CODIGOPESSOA = $1 LIMIT 1';
        const { rows: [imagemBDId] } = await pool.query(queryImagem, [funcionario.codigopessoa]);

        if(image){ // Imagem foi enviada
            if (imagemBDId.imagem) await deleteImages([imagemBDId.imagem]);

            // Envio nova imagem
            imageID = await processAndUploadImage(image, '/PessoasImagens');

            // Crio URL com a nova imagem
            imagemUrl = imageID

        }else{ // Imagem não foi enviada
            if(funcionario.imageChanged == 2) { // Imagem prévia removida
                // Remove imagem do banco e deleta do ImageKit
                if(imagemBDId.imagem){ // tem imagem no banco
                    const queryImagem = 'UPDATE PESSOA SET IMAGEM = $1 WHERE CODIGOPESSOA = $2';
                    await pool.query(queryImagem, [null, funcionario.codigopessoa]);
                    await deleteImages([imagemBDId.imagem]);
                }
            }else{ // Não alterou a imagem prévia
                imagemUrl = imagemBDId.imagem ? imagemBDId.imagem : null;
            }
        }

        await pool.query('BEGIN');
        const queryPessoa = "UPDATE PESSOA SET NOME = $1, CONTATO = $2, IMAGEM = COALESCE($3, IMAGEM), OBSERVACAO = $4, SITUACAO = $5 WHERE CODIGOPESSOA = $6";
        const data = [funcionario.nome, funcionario.contato, imageID, funcionario.observacao, funcionario.situacao, funcionario.codigopessoa];
        await pool.query(queryPessoa, data);

        const queryFuncionario = `UPDATE FUNCIONARIO 
                                    SET 
                                        EMAIL = $1,
                                        PRIVILEGIO = $2,
                                        DATAADMISSAO = $3
                                    WHERE CODIGOFUNCIONARIO = $4
                            `;
        const dataFuncionario = [funcionario.email, funcionario.privilegio, funcionario.dataadmissao, funcionario.codigofuncionario];
        await pool.query(queryFuncionario, dataFuncionario);

        const updatedFuncionario = {
            ...funcionario,
            imagem: imagemUrl
        }

        await pool.query('COMMIT');

        reply.status(200).send({ message: 'Funcionario updated successfully!', data:  updatedFuncionario});
    }catch(err : any){
        //console.log(err)
        reply.status(500).send({ message: 'Funcionario not updated!', data: err, errorMessage: err?.message });
    }
};

export const resetSenhaFuncionario = async (request: FastifyRequest, reply: FastifyReply) => {
    const { funcionario} = request.body 

    try{

        const tempPassword = generateTempPassword()
        const hashedPassword = await hashPassword(tempPassword)

        await pool.query('BEGIN');

        const queryFuncionario = `UPDATE FUNCIONARIO 
                                    SET SENHA = $1
                                    WHERE EMAIL = $2 AND CODIGOFUNCIONARIO = $3 RETURNING *
                            `;
        const dataFuncionario = [hashedPassword, funcionario.email, funcionario.codigofuncionario];
        const {rows: [funcionarioRow]} = await pool.query(queryFuncionario, dataFuncionario);
        
        await sendEmails(funcionarioRow.usuario, funcionarioRow.email, tempPassword, funcionarioRow.usuario);

        reply.status(200).send({ message: 'Funcionario updated successfully!', data:  funcionario});
        await pool.query('COMMIT');
    }catch(err : any){
        //console.log(err)
        await pool.query('ROLLBACK');
        reply.status(500).send({ message: 'Funcionario not updated!', data: err, errorMessage: err?.message });
    }
};

export const deleteFuncionario = async (request: FastifyRequest, reply: FastifyReply) => {
    const { codigopessoa } = request.query as {codigopessoa : number};
    const token = request.cookies.token;
    try{
        if(!codigopessoa){
            return reply.status(400).send({ message: "Funcionario's ID required!" })
        }

        if(!token){
            return reply.status(401).send({ message: 'Token not found!' });
        }

        const res = await verifyJWT(token);

        if(!res){
            return reply.status(401).send({ message: 'Expired section!', data: ''});
        }

        await pool.query('BEGIN');

        const data = [codigopessoa];

        const queryImagem = 'SELECT IMAGEM FROM PESSOA WHERE CODIGOPESSOA = $1 LIMIT 1';
        const { rows: [imagemId] } = await pool.query(queryImagem, data);

        const queryFuncionario = 'DELETE FROM FUNCIONARIO WHERE CODIGOPESSOA = $1';
        const queryPessoa = 'DELETE FROM PESSOA WHERE CODIGOPESSOA = $1';
        
        await pool.query(queryFuncionario, data);
        await pool.query(queryPessoa, data);

        imagemId.imagem && await deleteImages([imagemId.imagem])

        await pool.query('COMMIT');

        reply.status(200).send({ message: 'Funcionario deleted successfully!', data:  codigopessoa});
    }catch(err : any){
        await pool.query('ROLLBACK');
        reply.status(200).send({ message: 'Funcionario not deleted!', data: err, errorMessage: err?.message });
    }
};