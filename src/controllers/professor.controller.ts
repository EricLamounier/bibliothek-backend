import { FastifyReply, FastifyRequest } from 'fastify';
import pool from '../config/db';
import { verifyJWT } from '../utils/jwt';
import { deleteImages, processAndUploadImage, processAndUploadImageBase64 } from '../utils/imagekit';
import { MultipartFile } from '@fastify/multipart';

export const getProfessor = async (request: FastifyRequest, reply: FastifyReply) => {
    const { codigoprofessor, situacao, disciplina } = request.query as { codigoprofessor?: number | number[], situacao?: number | number[], disciplina?: number | number[] }
    
    const token = request.cookies.token || request.headers.authorization?.replace('Bearer ', '');
    try{
        if(!token){
            return reply.code(401).send({ error: "Token not found!" });
        }

        const resp = await verifyJWT(token)
        if(!resp){
            return reply.code(401).send({ error: "Invalid JWT Token!" });
        }
        
        let query0 = `
        SELECT 
            PROF.*,
            PES.*,
            0 AS sync,
            COALESCE(
                PES.CODIGOPESSOA AS CODIGOPESSOA,
                PROF.CODIGOPROFESSOR AS CODIGOPROFESSOR,
                JSON_AGG(DISTINCT to_jsonb(D)) FILTER (WHERE D.CODIGODISCIPLINA IS NOT NULL),
                '[]'
            ) AS disciplinas
        FROM PESSOA PES
        JOIN PROFESSOR PROF ON PES.CODIGOPESSOA = PROF.CODIGOPESSOA
        LEFT JOIN PROFESSOR_DISCIPLINA PD ON PROF.CODIGOPROFESSOR = PD.CODIGOPROFESSOR
        LEFT JOIN DISCIPLINA D ON PD.CODIGODISCIPLINA = D.CODIGODISCIPLINA
        `
        let query = `
            SELECT 
                PROF.*,
                PES.*,
                0 AS sync,
                COALESCE(
                    JSON_AGG(
                        DISTINCT jsonb_build_object(
                            'codigopessoa', PES.CODIGOPESSOA,
                            'codigoprofessor', PROF.CODIGOPROFESSOR
                        ) || to_jsonb(D)
                    ) FILTER (WHERE D.CODIGODISCIPLINA IS NOT NULL),
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
            conditions.push(`PROF.CODIGOPESSOA IN (${placeholders.join(',')})`)
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
        
        const { rows } = await pool.query(query, values)
        reply.status(200).send({ message: 'Professors fetched successfully!', data: rows });
    }catch(err){
        console.log(err)
        reply.status(400).send({ message: 'Professors not fetched!', data: err });
    }
}

export const postProfessor = async (request: FastifyRequest, reply: FastifyReply) => {
    const token = request.cookies.token || request.headers.authorization?.replace('Bearer ', '');
  
    const professor = request.body as any;
  
    if (!token) {
      return reply.status(401).send({ message: 'Token not found!' });
    }
  
    const res = await verifyJWT(token);
    if (!res) {
      return reply.status(401).send({ message: 'Expired session!', data: '' });
    }

    let imagemImageKit = null;
  
    try {
        await pool.query('BEGIN');

        if (professor.imagemBase64) {
            try {
            imagemImageKit = await processAndUploadImageBase64(professor.imagemBase64, '/PessoasImagens');
            } catch (err) {
            await pool.query('ROLLBACK');
            return reply.status(500).send({ message: 'Failed to upload image', error: err });
            }
        }

        // Inserção em PESSOA
        const dataPessoa = [professor.nome, professor.contato, imagemImageKit?.fileId, professor.observacao, 1];
        const queryPessoa = `INSERT INTO PESSOA (NOME, CONTATO, IMAGEM, OBSERVACAO, TIPOPESSOA)
                                VALUES ($1, $2, $3, $4, $5) RETURNING *`;
        const { rows: [pessoaRow] } = await pool.query(queryPessoa, dataPessoa);

        // Inserção em PROFESSOR
        const queryProfessor = "INSERT INTO PROFESSOR (IDENTIFICADOR, CODIGOPESSOA) VALUES ($1, $2) RETURNING *";
        const dataProfessor = [professor.identificador, pessoaRow.codigopessoa];
        const { rows: [professorRow] } = await pool.query(queryProfessor, dataProfessor);

        // Inserção em PROFESSOR_DISCIPLINA
        for (const disciplina of professor.disciplinas) {
            const queryProfessorDisciplina = `
            INSERT INTO PROFESSOR_DISCIPLINA (CODIGOPROFESSOR, CODIGODISCIPLINA, CODIGOPESSOA) 
            VALUES ($1, $2, $3) RETURNING *`;
            const dataDisciplina = [professorRow.codigoprofessor, disciplina.codigodisciplina, pessoaRow.codigopessoa];
            await pool.query(queryProfessorDisciplina, dataDisciplina);
            disciplina.sync = 0;
        }

        const results = {
            ...professorRow,
            codigopessoatemp: professor.codigopessoa,
            disciplinas: professor.disciplinas,
            ...pessoaRow,
            sync: 0,
        };

        await pool.query('COMMIT');

        reply.status(200).send({
        message: 'Professor inserted successfully!',
        data: results,
    });
  
    } catch (err) {
      console.log(err)
      await pool.query('ROLLBACK');
      imagemImageKit && await deleteImages([imagemImageKit.fileId]);
      reply.status(500).send({ message: 'Erro ao inserir professores!', data: err });
    }
  };  

export const putProfessor = async (request: FastifyRequest, reply: FastifyReply) => {
    const token = request.cookies.token || request.headers.authorization?.replace('Bearer ', '');
    
    const professor = request.body as any;
    let imagemImageKit = null;

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
        const { rows: [imagemBDId] } = await pool.query(queryImagem, [professor.codigopessoa]);

        if(professor.imagemBase64){ // Imagem foi enviada
            if (imagemBDId.imagem) await deleteImages([imagemBDId.imagem]);

            // Envio nova imagem
            imagemImageKit = await processAndUploadImageBase64(professor.imagemBase64, '/PessoasImagens');
        }else{ // Imagem não foi enviada

            if(professor.imageChanged == 2) { // Imagem prévia removida
                // Remove imagem do banco e deleta do ImageKit
                if(imagemBDId.imagem){ // tem imagem no banco
                    const queryImagem = 'UPDATE PESSOA SET IMAGEM = $1 WHERE CODIGOPESSOA = $2';
                    await pool.query(queryImagem, [null, professor.codigopessoa]);
                    await deleteImages([imagemBDId.imagem]);
                }
            }
        }

        await pool.query('BEGIN');
        const queryPessoa = `UPDATE PESSOA SET NOME = $1, CONTATO = $2, IMAGEM = COALESCE($3, IMAGEM), OBSERVACAO = $4, SITUACAO = $5 WHERE CODIGOPESSOA = $6`;
        const data = [professor.nome, professor.contato, imagemImageKit?.fileId, professor.observacao, professor.situacao, professor.codigopessoa];
        await pool.query(queryPessoa, data);

        const queryProfessor = "UPDATE PROFESSOR SET IDENTIFICADOR = $1 WHERE CODIGOPROFESSOR = $2";
        const dataProfessor = [professor.identificador, professor.codigoprofessor];
        await pool.query(queryProfessor, dataProfessor);

        let disciplinas = professor.disciplinas.filter((d: any) => d.sync === 0)

        // Update author relationships
        if (professor.disciplinas && professor.disciplinas.length > 0) {
            const queryInsertDisciplinaProfessor = `
                INSERT INTO PROFESSOR_DISCIPLINA (CODIGOPESSOA, CODIGOPROFESSOR, CODIGODISCIPLINA)
                VALUES ($1, $2, $3)
            `;
            const queryDeleteDisciplinaProfessor = `
                DELETE FROM PROFESSOR_DISCIPLINA
                WHERE CODIGOPESSOA = $1 AND CODIGODISCIPLINA = $2
            `;

            for (const disciplina of professor.disciplinas) {
                // Insere nova disciplina
                if(disciplina.sync === 1){
                    const newDisciplina = await pool.query(queryInsertDisciplinaProfessor, [professor.codigopessoa, professor.codigoprofessor, disciplina.codigodisciplina]);
                    disciplinas.push({
                        ...disciplina,
                        sync: 0,
                        codigodisciplinatemp: disciplina.codigodisciplina
                    });
                }

                // Exclui disciplina
                if(disciplina.sync === 3){
                    await pool.query(queryDeleteDisciplinaProfessor, [professor.codigopessoa, disciplina.codigodisciplina]);
                }
            }
        }

        const updatedProfessor = {
            ...professor,
            imagem: imagemImageKit?.fileId,
            disciplinas: disciplinas,
            sync: 0,
        }
        await pool.query('COMMIT');

        reply.status(200).send({ message: 'Professor updated successfully!', data: updatedProfessor});
    }catch(err){
        console.log(err)
        await pool.query('ROLLBACK');
        imagemImageKit && await deleteImages([imagemImageKit.fileId]);
        reply.status(500).send({ message: 'Professor not updated!', data: err });
    }
};

export const deleteProfessor = async (request: FastifyRequest, reply: FastifyReply) => {
    const { professor } = request.body as {professor : any};
    const token = request.cookies.token || request.headers.authorization?.replace('Bearer ', '');

    try{
        if(!professor){
            return reply.status(400).send({ message: "Professor's ID required!" })
        }

        if(!token){
            return reply.status(401).send({ message: 'Token not found!' });
        }

        const res = await verifyJWT(token);

        if(!res){
            return reply.status(401).send({ message: 'Expired section!', data: ''});
        }

        await pool.query('BEGIN');

        const data = [professor.codigopessoa];

        const queryProfessorDisciplina = `DELETE FROM PROFESSOR_DISCIPLINA WHERE CODIGOPESSOA = $1`;
        const queryProfessor = `DELETE FROM PROFESSOR WHERE CODIGOPESSOA = $1`;
        const queryPessoa = `DELETE FROM PESSOA WHERE CODIGOPESSOA = $1`;
        
        await pool.query(queryProfessorDisciplina, data);
        await pool.query(queryProfessor, data);
        await pool.query(queryPessoa, data);

        await pool.query('COMMIT');

        reply.status(200).send({ message: 'Professor deleted successfully!', data:  professor});
    }catch(err){
        await pool.query('ROLLBACK');
        console.log(err)
        reply.status(500).send({ message: 'Professor not deleted!', data: err });
    }
};