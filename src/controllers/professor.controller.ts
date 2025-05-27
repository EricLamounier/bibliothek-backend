import { FastifyReply, FastifyRequest } from 'fastify';
import pool from '../config/db';
import { verifyJWT } from '../utils/jwt';

interface ProfessorProps {
    userID: number | string;
    nome: string;
    observacao?: string;
};

export const postProfessor = async(request: FastifyRequest, reply: FastifyReply) => {
    
    const token = request.cookies.token;

    const { professor } = request.body  //as { professor: ProfessorProps };

    console.log(professor)
    try{
        if(!token){
            return reply.status(401).send({ message: 'Token not found!' });
        }

        const res = await verifyJWT(token);

        if(!res){
            return reply.status(401).send({ message: 'Expired section!', data: ''});
        }

        await pool.query('BEGIN');

        const dataPessoa = [professor.nome, professor.contato, professor.observacao, 1];
        const queryPessoa = `INSERT INTO PESSOA (NOME, CONTATO, OBSERVACAO, TIPO)
                            VALUES ($1, $2, $3, $4) RETURNING *`;
        const {rows: [pessoaRow]} = await pool.query(queryPessoa, dataPessoa);

        const queryProfessor = "INSERT INTO PROFESSOR (IDENTIFICADOR, PESSOA_ID) VALUES ($1, $2) RETURNING *";
        const data = [professor.identificador, pessoaRow.id]
        const {rows: [professorRow]} = await pool.query(queryProfessor, data);

        for(const disciplina of professor.disciplinas){
            const queryProfessorDisciplina = "INSERT INTO PROFESSOR_DISCIPLINA (PROFESSOR_ID, PESSOA_ID, DISCIPLINA_ID) VALUES ($1, $2, $3) RETURNING *";
            const dataDisciplina = [professorRow.id, pessoaRow.id, disciplina.id];
            await pool.query(queryProfessorDisciplina, dataDisciplina);
        }

        await pool.query('COMMIT');
        //console.log('ok')

        const createdData = {
            ...professor,
            id: professorRow.id,
            pessoa_id: pessoaRow.id,
            situacao: 1
        }

        console.log(createdData)
 
        reply.status(200).send({ message: 'Professor inserted successfully!', data:  createdData});
    }catch(err){
        reply.status(500).send({ message: 'Professor not inserted!', data: err });
    }
};

export const getProfessor = async (request: FastifyRequest, reply: FastifyReply) => {
    const query = `SELECT 
                    PROF.ID AS id,
                    PES.*,
                    PES.ID AS pessoa_id,
                    PES.TIPO AS pessoa_tipo,
                    PROF.ID AS professor_id,
                    PROF.IDENTIFICADOR,
                    COALESCE(JSON_AGG(DISTINCT to_jsonb(D)) FILTER (WHERE D.ID IS NOT NULL), '[]') AS disciplinas
                    FROM PESSOA PES
                    JOIN PROFESSOR PROF ON PES.ID = PROF.PESSOA_ID
                    LEFT JOIN PROFESSOR_DISCIPLINA PD ON PROF.ID = PD.PROFESSOR_ID
                    LEFT JOIN DISCIPLINA D ON PD.DISCIPLINA_ID = D.ID
                    WHERE PES.TIPO = 1
                    GROUP BY PES.ID, PES.NOME, PES.CONTATO, PROF.ID;
                    `;
    const { rows } = await pool.query(query);

    reply.status(200).send({ message: 'Professors fetched successfully!', data: rows });
};

export const putProfessor = async (request: FastifyRequest, reply: FastifyReply) => {
    const { professor } = request.body
    const token = request.cookies.token;
    console.clear()
    console.log(professor)
    console.log('\n\n')

    try{

        if(!token){
            return reply.status(401).send({ message: 'Token not found!' });
        }

        const res = await verifyJWT(token);

        if(!res){
            return reply.status(401).send({ message: 'Expired section!', data: ''});
        }

        await pool.query('BEGIN');
        const queryPessoa = "UPDATE PESSOA SET NOME = $1, CONTATO = $2, OBSERVACAO = $3, SITUACAO = $4 WHERE ID = $5";
        const data = [professor.nome, professor.contato, professor.observacao, professor.situacao, professor.pessoa_id];
        await pool.query(queryPessoa, data);

        const queryProfessor = "UPDATE PROFESSOR SET IDENTIFICADOR = $1 WHERE ID = $2";
        const dataProfessor = [professor.identificador, professor.id];
        await pool.query(queryProfessor, dataProfessor);

        // Update author relationships
        if (professor.disciplinas && professor.disciplinas.length > 0) {
            const queryInsertDisciplinaProfessor = `
                INSERT INTO PROFESSOR_DISCIPLINA (PROFESSOR_ID, PESSOA_ID, DISCIPLINA_ID)
                VALUES ($1, $2, $3)
            `;
            const queryDeleteDisciplinaProfessor = `
                DELETE FROM PROFESSOR_DISCIPLINA
                WHERE PROFESSOR_ID = $1 AND PESSOA_ID = $2 AND DISCIPLINA_ID = $3
            `;

            for (const disciplina of professor.disciplinas) {

                // Insere novo autor
                if(disciplina.sync === 1){
                    await pool.query(queryInsertDisciplinaProfessor, [professor.id, professor.pessoa_id, disciplina.id]);
                }

                // Exclui autor
                if(disciplina.sync === 2){
                    await pool.query(queryDeleteDisciplinaProfessor, [professor.id, professor.pessoa_id, disciplina.id]);
                }
            }
        }

        const updatedProfessor = {
            ...professor,
            disciplinas: professor.disciplinas = professor.disciplinas
                .filter((disciplina: any) => disciplina.sync !== 2)
                .map((disciplina: any) => ({ ...disciplina, sync: 0 })),
        }

        console.log(updatedProfessor)

        await pool.query('COMMIT');

        reply.status(200).send({ message: 'Professor updated successfully!', data: updatedProfessor});
    }catch(err){
        reply.status(500).send({ message: 'Professor not updated!', data: err });
    }
};

export const deleteProfessor = async (request: FastifyRequest, reply: FastifyReply) => {
    const { pessoaID } = request.query as {pessoaID : number};
    const token = request.cookies.token;

    console.log(pessoaID)

    try{
        if(!pessoaID){
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

        const data = [pessoaID];

        const queryProfessorDisciplina = "DELETE FROM PROFESSOR_DISCIPLINA WHERE PESSOA_ID = $1";
        const queryProfessor = 'DELETE FROM PROFESSOR WHERE PESSOA_ID = $1';
        const queryPessoa = 'DELETE FROM PESSOA WHERE ID = $1';
        
        await pool.query(queryProfessorDisciplina, data);
        await pool.query(queryProfessor, data);
        await pool.query(queryPessoa, data);

        await pool.query('COMMIT');

        reply.status(200).send({ message: 'Professor deleted successfully!', data:  []});
    }catch(err){
        reply.status(500).send({ message: 'Professor not deleted!', data: err });
    }
};