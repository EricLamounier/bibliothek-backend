import { FastifyReply, FastifyRequest } from 'fastify';
import pool from '../config/db';
import { verifyJWT } from '../utils/jwt';
import { deleteImages, processAndUploadImage } from '../utils/imagekit';
import { MultipartFile } from '@fastify/multipart';

export const getAluno = async (request: FastifyRequest, reply: FastifyReply) => {
    const { aluno, situacao } = request.query as { aluno?: number, situacao?: string };
    console.log(aluno, situacao)
    let query = `
        SELECT
            PES.*,
            AL.*
        FROM PESSOA PES
        JOIN ALUNO AL ON PES.CODIGOPESSOA = AL.CODIGOPESSOA
    `;
    const conditions: string[] = []
    const values: any[] = []
    let paramIndex = 1

    if (aluno) {
        const alunos = Array.isArray(aluno) ? aluno : [aluno]
        const placeholders = alunos.map((_, i) => `$${paramIndex + i}`)
        conditions.push(`AL.CODIGOALUNO IN (${placeholders.join(',')})`)
        values.push(...alunos)
        paramIndex += alunos.length
    }

    if (situacao) {
        const situacoes = Array.isArray(situacao) ? situacao : [situacao]
        const placeholders = situacoes.map((_, i) => `$${paramIndex + i}`)
        conditions.push(`SITUACAO IN (${placeholders.join(',')})`)
        values.push(...situacoes.map(Number))
        paramIndex += situacoes.length
    }

    if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ') + ' AND PES.TIPOPESSOA = 0'
    } else {
        query += ' WHERE PES.TIPOPESSOA = 0'
    }

    query += `
        GROUP BY PES.CODIGOPESSOA, PES.NOME, PES.CONTATO, AL.CODIGOALUNO
    `;

    const { rows: alunos } = await pool.query(query, values);

    reply.status(200).send({
        message: 'Alunos fetched successfully!',
        data: alunos
    });
};

export const getProfessor222 = async (request: FastifyRequest, reply: FastifyReply) => {
    const { codigoprofessor, situacao, disciplina } = request.query as { codigoprofessor?: number | number[], situacao?: number | number[], disciplina?: number | number[] }
  
    let query = `
      SELECT 
        PROF.*,
        PES.*,
        COALESCE(
          JSON_AGG(DISTINCT to_jsonb(D)) FILTER (WHERE D.CODIGODISCIPLINA IS NOT NULL),
          '[]'
        ) AS disciplinas
      FROM PESSOA PES
      JOIN PROFESSOR PROF ON PES.CODIGOPESSOA = PROF.CODIGOPESSOA
      LEFT JOIN PROFESSOR_DISCIPLINA PD ON PROF.CODIGOPROFESSOR = PD.CODIGOPROFESSOR
      LEFT JOIN DISCIPLINA D ON PD.CODIGODISCIPLINA = D.CODIGODISCIPLINA
    `
    const conditions: string[] = []
    const values: any[] = []
    let paramIndex = 1

    if (codigoprofessor) {
      const codigos = Array.isArray(codigoprofessor) ? codigoprofessor : [codigoprofessor]
      const placeholders = codigos.map((_, i) => `$${paramIndex + i}`)
      conditions.push(`PROF.CODIGOPROFESSOR IN (${placeholders.join(',')})`)
      values.push(...codigos)
      paramIndex += codigos.length
    }
  
    // filtro por situação
    if (situacao) {
      const situacoes = Array.isArray(situacao) ? situacao : [situacao]
      const placeholders = situacoes.map((_, i) => `$${paramIndex + i}`)
      conditions.push(`PES.SITUACAO IN (${placeholders.join(',')})`)
      values.push(...situacoes.map(Number))
      paramIndex += situacoes.length
    }
  
    // filtro por disciplina
    if (disciplina) {

      const disciplinas = Array.isArray(disciplina) ? disciplina : [disciplina]
      console.log(disciplinas)
      const placeholders = disciplinas.map((_, i) => `$${paramIndex + i}`)
      conditions.push(`D.CODIGODISCIPLINA IN (${placeholders.join(',')})`)
      values.push(...disciplinas)
      paramIndex += disciplinas.length
    }
  
    // monta WHERE com TIPOPESSOA fixo
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ') + ' AND PES.TIPOPESSOA = 1'
    } else {
      query += ' WHERE PES.TIPOPESSOA = 1'
    }
  
    query += `
      GROUP BY 
        PES.CODIGOPESSOA, 
        PES.NOME, 
        PES.CONTATO, 
        PROF.CODIGOPROFESSOR
    `
  
    console.log(codigoprofessor, situacao, disciplina) // debug seguro
  
    const { rows } = await pool.query(query, values)
    console.log(rows)
  
    reply.status(200).send({ message: 'Professors fetched successfully!', data: rows })
}

export const postAluno = async(request: FastifyRequest, reply: FastifyReply) => {
    
    const token = request.cookies.token;

    const { aluno: alunoField, image } = request.body as { aluno: { value: string }, image?: MultipartFile };
    const aluno = JSON.parse(alunoField.value); 

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
                console.log(err)
                return reply.status(500).send({ message: 'Failed to upload image', error: err });
            }
        }

        await pool.query('BEGIN');
        
        const dataPessoa = [aluno.nome, aluno.contato, aluno.observacao, imageUrl, 0];
        const queryPessoa = `INSERT INTO PESSOA (NOME, CONTATO, OBSERVACAO, IMAGEM, TIPOPESSOA)
                            VALUES ($1, $2, $3, $4, $5) RETURNING *`;
        const {rows: [pessoaRow]} = await pool.query(queryPessoa, dataPessoa);

        const queryAluno = "INSERT INTO ALUNO (MATRICULA, DATAMATRICULA, DATAVENCIMENTOCARTEIRINHA, CODIGOPESSOA) VALUES ($1, $2, $3, $4) RETURNING *";
        const data = [aluno.matricula, aluno.datamatricula, aluno.datavencimentocarteirinha, pessoaRow.codigopessoa]
        const {rows: [alunoRow]} = await pool.query(queryAluno, data);

        await pool.query('COMMIT');

        const createdData = {
            ...pessoaRow,
            ...alunoRow
        }
 
        reply.status(200).send({ message: 'Aluno inserted successfully!', data:  createdData});
    }catch(err : any){
        console.log(err)
        imageUrl && await deleteImages([imageUrl])
        reply.status(500).send({ message: 'Aluno not inserted!', data: err, errorMessage: err?.message });
    }
};

export const putAluno = async (request: FastifyRequest, reply: FastifyReply) => {
    const token = request.cookies.token;

    const { aluno: alunoField, image } = request.body as { aluno: { value: string }, image?: MultipartFile };
    const aluno = JSON.parse(alunoField.value);

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
        const { rows: [imagemBDId] } = await pool.query(queryImagem, [aluno.codigopessoa]);

        if(image){ // Imagem foi enviada
            if (imagemBDId.imagem) await deleteImages([imagemBDId.imagem]);

            // Envio nova imagem
            imageID = await processAndUploadImage(image, '/PessoasImagens');

            // Crio URL com a nova imagem
            imagemUrl = imageID ? imageID : null


        }else{ // Imagem não foi enviada

            if(aluno.imageChanged == 2) { // Imagem prévia removida
                // Remove imagem do banco e deleta do ImageKit
                if(imagemBDId.imagem){ // tem imagem no banco
                    const queryImagem = 'UPDATE PESSOA SET IMAGEM = $1 WHERE CODIGOPESSOA = $2';
                    await pool.query(queryImagem, [null, aluno.codigopessoa]);
                    await deleteImages([imagemBDId.imagem]);
                }
            }else{ // Não alterou a imagem prévia
                imagemUrl = imagemBDId.imagem ? imagemBDId.imagem : null;
            }
        }

        await pool.query('BEGIN');
        const queryPessoa = "UPDATE PESSOA SET NOME = $1, CONTATO = $2, IMAGEM = COALESCE($3, IMAGEM), OBSERVACAO = $4, SITUACAO = $5 WHERE CODIGOPESSOA = $6";
        const data = [aluno.nome, aluno.contato, imageID, aluno.observacao, aluno.situacao, aluno.codigopessoa];
        await pool.query(queryPessoa, data);

        const queryAluno = `UPDATE ALUNO 
                            SET MATRICULA = $1, 
                                DATAVENCIMENTOCARTEIRINHA = $2,
                                DATAMATRICULA = $3
                            WHERE CODIGOPESSOA = $4
                            `;
        const dataAluno = [aluno.matricula, aluno.datavencimentocarteirinha, aluno.datamatricula, aluno.codigopessoa];
        await pool.query(queryAluno, dataAluno);

        const updatedAluno = {
            ...aluno,
            imagem: imagemUrl
        }

        await pool.query('COMMIT');

        reply.status(200).send({ message: 'Aluno updated successfully!', data:  updatedAluno});
    }catch(err : any){
        console.log(err)
        reply.status(500).send({ message: 'Aluno not updated!', data: err, errorMessage: err?.message });
    }
};

export const deleteAluno = async (request: FastifyRequest, reply: FastifyReply) => {
    const { codigopessoa } = request.query as {codigopessoa : number};
    const token = request.cookies.token;

    try{
        if(!codigopessoa){
            return reply.status(400).send({ message: "Aluno's ID required!" })
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

        const queryAluno = 'DELETE FROM ALUNO WHERE CODIGOPESSOA = $1';
        const queryPessoa = 'DELETE FROM PESSOA WHERE CODIGOPESSOA = $1';
        
        await pool.query(queryAluno, data);
        await pool.query(queryPessoa, data);

        imagemId.imagem && await deleteImages([imagemId.imagem])

        await pool.query('COMMIT');

        reply.status(200).send({ message: 'Aluno deleted successfully!', data:  codigopessoa});
    }catch(err : any){
        reply.status(200).send({ message: 'Aluno not deleted!', data: err, errorMessage: err?.message });
    }
};