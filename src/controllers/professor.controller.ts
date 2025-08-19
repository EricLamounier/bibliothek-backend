import { FastifyReply, FastifyRequest } from 'fastify';
import pool from '../config/db';
import { verifyJWT } from '../utils/jwt';
import { deleteImages, processAndUploadImage } from '../utils/imagekit';
import { MultipartFile } from '@fastify/multipart';

export const postProfessor = async(request: FastifyRequest, reply: FastifyReply) => {
    
    const token = request.cookies.token;
    
    const { professor: professorField, image } = request.body as { professor: { value: string }, image?: MultipartFile };
    const professor = JSON.parse(professorField.value);
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

        const dataPessoa = [professor.nome, professor.contato, imageUrl, professor.observacao, 1];
        const queryPessoa = `INSERT INTO PESSOA (NOME, CONTATO, IMAGEM, OBSERVACAO, TIPOPESSOA)
                            VALUES ($1, $2, $3, $4, $5) RETURNING *`;
        const {rows: [pessoaRow]} = await pool.query(queryPessoa, dataPessoa);

        const queryProfessor = "INSERT INTO PROFESSOR (IDENTIFICADOR, CODIGOPESSOA) VALUES ($1, $2) RETURNING *";
        const data = [professor.identificador, pessoaRow.codigopessoa]
        const {rows: [professorRow]} = await pool.query(queryProfessor, data);

        for(const disciplina of professor.disciplinas){
            const queryProfessorDisciplina = "INSERT INTO PROFESSOR_DISCIPLINA (CODIGOPROFESSOR, CODIGODISCIPLINA, CODIGOPESSOA) VALUES ($1, $2, $3) RETURNING *";
            const dataDisciplina = [professorRow.codigoprofessor, disciplina.codigodisciplina, pessoaRow.codigopessoa];
            await pool.query(queryProfessorDisciplina, dataDisciplina);
        }

        await pool.query('COMMIT');

        const createdData = {
            ...professorRow,
            disciplinas: professor.disciplinas,
            ...pessoaRow
        }
 
        reply.status(200).send({ message: 'Professor inserted successfully!', data:  createdData});
    }catch(err){
        await pool.query('ROLLBACK');
        //console.log(err)
        reply.status(500).send({ message: 'Professor not inserted!', data: err });
    }
};

export const getProfessor = async (request: FastifyRequest, reply: FastifyReply) => {
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
      //console.log(disciplinas)
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
  
    //console.log(codigoprofessor, situacao, disciplina) // debug seguro
  
    const { rows } = await pool.query(query, values)
    //console.log(rows)
  
    reply.status(200).send({ message: 'Professors fetched successfully!', data: rows })
}
  

export const putProfessor = async (request: FastifyRequest, reply: FastifyReply) => {
    const token = request.cookies.token;
    
    const { professor: professorField, image } = request.body as { professor: { value: string }, image?: MultipartFile };
    const professor = JSON.parse(professorField.value);
    //console.log(professor)
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

        if(image){ // Imagem foi enviada
            if (imagemBDId.imagem) await deleteImages([imagemBDId.imagem]);

            // Envio nova imagem
            imageID = await processAndUploadImage(image, '/PessoasImagens');

            // Crio URL com a nova imagem
            imagemUrl = imageID ? imageID : null


        }else{ // Imagem não foi enviada

            if(professor.imageChanged == 2) { // Imagem prévia removida
                // Remove imagem do banco e deleta do ImageKit
                if(imagemBDId.imagem){ // tem imagem no banco
                    const queryImagem = 'UPDATE PESSOA SET IMAGEM = $1 WHERE CODIGOPESSOA = $2';
                    await pool.query(queryImagem, [null, professor.codigopessoa]);
                    await deleteImages([imagemBDId.imagem]);
                }
            }else{ // Não alterou a imagem prévia
                imagemUrl = imagemBDId.imagem ? imagemBDId.imagem : null;
            }
        }

        await pool.query('BEGIN');
        const queryPessoa = `UPDATE PESSOA SET NOME = $1, CONTATO = $2, IMAGEM = COALESCE($3, IMAGEM), OBSERVACAO = $4, SITUACAO = $5 WHERE CODIGOPESSOA = $6`;
        const data = [professor.nome, professor.contato, imagemUrl, professor.observacao, professor.situacao, professor.codigopessoa];
        await pool.query(queryPessoa, data);

        const queryProfessor = "UPDATE PROFESSOR SET IDENTIFICADOR = $1 WHERE CODIGOPROFESSOR = $2";
        const dataProfessor = [professor.identificador, professor.codigoprofessor];
        await pool.query(queryProfessor, dataProfessor);

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

                // Insere novo autor
                if(disciplina.sync === 1){
                    await pool.query(queryInsertDisciplinaProfessor, [professor.codigopessoa, professor.codigoprofessor, disciplina.codigodisciplina]);
                }

                // Exclui autor
                if(disciplina.sync === 2){
                    await pool.query(queryDeleteDisciplinaProfessor, [professor.codigopessoa, disciplina.codigodisciplina]);
                }
            }
        }

        const updatedProfessor = {
            ...professor,
            imagem: imagemUrl,
            disciplinas: professor.disciplinas = professor.disciplinas
                .filter((disciplina: any) => disciplina.sync !== 2)
                .map((disciplina: any) => ({ ...disciplina, sync: 0 })),
        }

        await pool.query('COMMIT');

        reply.status(200).send({ message: 'Professor updated successfully!', data: updatedProfessor});
    }catch(err){
        await pool.query('ROLLBACK');
        //console.log(err)
        reply.status(500).send({ message: 'Professor not updated!', data: err });
    }
};

export const deleteProfessor = async (request: FastifyRequest, reply: FastifyReply) => {
    const { codigopessoa } = request.query as {codigopessoa : number};
    const token = request.cookies.token;

    try{
        if(!codigopessoa){
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

        const data = [codigopessoa];

        const queryProfessorDisciplina = "DELETE FROM PROFESSOR_DISCIPLINA WHERE CODIGOPESSOA = $1";
        const queryProfessor = 'DELETE FROM PROFESSOR WHERE CODIGOPESSOA = $1';
        const queryPessoa = 'DELETE FROM PESSOA WHERE CODIGOPESSOA = $1';
        
        await pool.query(queryProfessorDisciplina, data);
        await pool.query(queryProfessor, data);
        await pool.query(queryPessoa, data);

        await pool.query('COMMIT');

        reply.status(200).send({ message: 'Professor deleted successfully!', data:  []});
    }catch(err){
        await pool.query('ROLLBACK');
        //console.log(err)
        reply.status(500).send({ message: 'Professor not deleted!', data: err });
    }
};