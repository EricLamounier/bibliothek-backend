import { FastifyReply, FastifyRequest } from 'fastify';
import pool from '../config/db';
import { verifyJWT, hashPassword } from '../utils/jwt';
import { sendEmails, generateTempPassword } from '../gmail/gmail';
import { deleteImages, processAndUploadImageBase64 } from '../utils/imagekit';

export const getFuncionario = async (request: FastifyRequest, reply: FastifyReply) => {
    const { funcionario, privilegio, situacao } = request.query as { funcionario?: number, privilegio?: string, situacao?: string };
    const token = request.cookies.token || request.headers.authorization?.replace('Bearer ', '');

    if(!token){
        return reply.code(401).send({ error: "Token not found!" });
    }

    const resp = await verifyJWT(token)
    if(!resp){
        return reply.code(401).send({ error: "Invalid JWT Token!" });
    }
    
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

    const { rows : funcionarios } = await pool.query(query, values);

    reply.status(200).send({ message: 'Funcionarios fetched successfully!', data: funcionarios });
};

export const postFuncionario = async(request: FastifyRequest, reply: FastifyReply) => {
    
    const token = request.cookies.token || request.headers.authorization?.replace('Bearer ', '');

    const funcionario = request.body as any ;

    let imagemImageKit = null
    try{
        if(!token){
            return reply.status(401).send({ message: 'Token not found!' });
        }

        const res = await verifyJWT(token);

        if(!res){
            return reply.status(401).send({ message: 'Expired section!', data: ''});
        }

        const funcionarioRequest = res.funcionario;
        if (funcionarioRequest.tipopessoa !== 2 || Number(funcionarioRequest.privilegio) !== 999) {
            return reply.status(401).send({ message: 'Funcionário sem privilégio para criar outros funcionários!', data: ''});
        }
        
        if(funcionario.imagemBase64){
            try {
                imagemImageKit = await processAndUploadImageBase64(funcionario.imagemBase64, '/PessoasImagens');
            } catch (err) {
                console.log(err)
                return reply.status(500).send({ message: 'Failed to upload image', error: err });
            }
        }

        await pool.query('BEGIN');
        
        const dataPessoa = [funcionario.nome, funcionario.contato, funcionario.observacao, imagemImageKit?.fileId, 2];
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

        //sendEmails(funcionario.nome, funcionario.email, tempPassword, undefined, "Seu acesso Bibliothek");
 
        reply.status(200).send({ message: 'Funcionario inserted successfully!', data:  formatedFuncionario});
    }catch(err : any){
        await pool.query('ROLLBACK');
        console.log(err)
        imagemImageKit && await deleteImages([imagemImageKit?.fileId])
        reply.status(500).send({ message: 'Funcionario not inserted!', data: err, errorMessage: err?.message });
    }
};

export const putFuncionario = async (request: FastifyRequest, reply: FastifyReply) => {
    const token = request.cookies.token || request.headers.authorization?.replace('Bearer ', '');

    const { funcionario } = request.body as { funcionario: any };
    let imagemImageKit = null;

    try{

        if(!token){
            return reply.status(401).send({ message: 'Token not found!' });
        }

        const res = await verifyJWT(token);

        if(!res){
            return reply.status(401).send({ message: 'Expired section!', data: ''});
        }

        const funcionarioRequest = res.funcionario;
       if (funcionarioRequest.tipopessoa !== 2 || Number(funcionarioRequest.privilegio) !== 999) {
            return reply.status(401).send({ message: 'Funcionário sem privilégio para editar outros funcionários!', data: ''});
        }

        const queryImagem = 'SELECT IMAGEM FROM PESSOA WHERE CODIGOPESSOA = $1 LIMIT 1';
        const { rows: [imagemBDId] } = await pool.query(queryImagem, [funcionario.codigopessoa]);

        if(funcionario.imagemBase64){ // Imagem foi enviada
            if (imagemBDId.imagem) await deleteImages([imagemBDId.imagem]);

            // Envio nova imagem
            imagemImageKit = await processAndUploadImageBase64(funcionario.imagemBase64, '/PessoasImagens');

        }else{ // Imagem não foi enviada
            if(funcionario.imageChanged == 2) { // Imagem prévia removida
                // Remove imagem do banco e deleta do ImageKit
                if(imagemBDId.imagem){ // tem imagem no banco
                    const queryImagem = 'UPDATE PESSOA SET IMAGEM = $1 WHERE CODIGOPESSOA = $2';
                    await pool.query(queryImagem, [null, imagemBDId.fileId]);
                    await deleteImages([imagemBDId.fileId]);
                }
            }
        }

        await pool.query('BEGIN');
        const queryPessoa = "UPDATE PESSOA SET NOME = $1, CONTATO = $2, IMAGEM = COALESCE($3, IMAGEM), OBSERVACAO = $4, SITUACAO = $5 WHERE CODIGOPESSOA = $6";
        const data = [funcionario.nome, funcionario.contato, imagemImageKit?.fileId, funcionario.observacao, funcionario.situacao, funcionario.codigopessoa];
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
            imagem: imagemImageKit?.fileId
        }

        await pool.query('COMMIT');

        reply.status(200).send({ message: 'Funcionario updated successfully!', data:  updatedFuncionario});
    }catch(err : any){
        await pool.query('ROLLBACK');
        imagemImageKit && await deleteImages([imagemImageKit?.fileId])      
        reply.status(500).send({ message: 'Funcionario not updated!', data: err, errorMessage: err?.message });
    }
};

export const deleteFuncionario = async (request: FastifyRequest, reply: FastifyReply) => {
    const { codigopessoa } = request.query as {codigopessoa : number};
    const token = request.cookies.token || request.headers.authorization?.replace('Bearer ', '');
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

        const funcionarioRequest = res.funcionario;
        if (funcionarioRequest.tipopessoa !== 2 || Number(funcionarioRequest.privilegio) !== 999) {
            return reply.status(401).send({ message: 'Funcionário sem privilégio para excluir outros funcionários!', data: ''});
        }
        
        if(funcionarioRequest.codigopessoa == codigopessoa){
            return reply.status(401).send({ message: 'Funcionário não pode excluir ele mesmo!', data: ''});
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

export const resetSenhaFuncionario = async (request: FastifyRequest, reply: FastifyReply) => {
    const { funcionario} = request.body as {funcionario : any}; 
    const token = request.cookies.token || request.headers.authorization?.replace('Bearer ', '');

    if(!token){
        return reply.code(401).send({ error: "Token not found!" });
    }

    const res = await verifyJWT(token)
    if(!res){
        return reply.code(401).send({ error: "Invalid JWT Token!" });
    }

    const funcionarioRequest = res.funcionario;
   if (funcionarioRequest.tipopessoa !== 2 || Number(funcionarioRequest.privilegio) !== 999) {
        return reply.status(401).send({ message: 'Funcionário sem privilégio para alterar funcionários!', data: ''});
    }
    
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
        
        await sendEmails(funcionario.nome, funcionarioRow.email, tempPassword, funcionarioRow.usuario);

        reply.status(200).send({ message: 'Funcionario updated successfully!', data:  funcionario});
        await pool.query('COMMIT');
    }catch(err : any){
        //console.log(err)
        await pool.query('ROLLBACK');
        reply.status(500).send({ message: 'Funcionario not updated!', data: err, errorMessage: err?.message });
    }
};