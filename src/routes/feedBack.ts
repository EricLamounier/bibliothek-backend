import { FastifyInstance } from 'fastify';
import dotenv from 'dotenv';
import axios from 'axios';
dotenv.config();

const feedback : any = {
  0: {
    label: 'Erro',
    id: '24d14ce0189d',
    stickers: {
      0: {
        label: "Erro de acesso",
        value: 0, // urgente
        id: 'e62428b32f41'
      },
      1: {
        label: "Erro de validação",
        value: 1, // urgente
        id: 'e62428b32f41'
      },
      2: {
        label: "Erro de carregamento",
        value: 2, // programavel
        id: '453d0b2106d5'
      },
      3: {
        label: "Outro",
        value: 3, // analise
        id: 'd2893a1708be',
      },
    }
  },
  1: {
    label: 'Alteração',
    id: '0e71e0c3dd0a',
    stickers: {
      0: {
        label: "Alteração de funcionalidade",
        value: 0, // média
        id: 'e62428b32f41'
      },
      1: {
        label: "Alteração de interface",
        value: 1, // média
        id: '66b9fe03b770'
      },
      2: {
        label: "Outro",
        value: 2, // analise
        id: 'd2893a1708be',
      },
    }
  },
  2: {
    label: 'Tarefa',
    id: 'e843225759d7',
    stickers: {
      0: {
        label: "Outro",
        value: 0, // analise
        id: 'd2893a1708be',
      },
    }
  },
}

interface Stickers {
  [key: string]: string;
}

interface TaskPayload {
  title: string;
  description: string;
  columnId: string;
  archived: boolean;
  completed: boolean;
  stickers: Stickers;
}

interface TaskPost {
  title: string;
  type: string;
  priority: string;
  funcionario: any;
}

const postTask = async ({title, type, priority, funcionario}: TaskPost) => {
  const data: TaskPayload = {
    title: title,
    description: `SOLICITAÇÃO DE: Funcionário: ${funcionario.nome} | Código: ${funcionario.codigofuncionario} | Pessoa: ${funcionario.codigopessoa}`,
    columnId: '8c1c1162-2610-4f60-9e78-001f20d02b44',
    archived: false,
    completed: false,
    stickers: {
      "508d2e56-fe56-4b2b-b338-ea00b165eb14": priority, // Prioridade: Urgente
      "83383daa-c08d-4269-9c68-294b3b9ee48c": type, // Tipo: Tarefa
    },
  };

  try {
    const response = await axios.post("https://ru.yougile.com/api-v2/tasks", data, {
      headers: {
        "Authorization": `Bearer ${process.env.YOUGILE_TOKEN}`,
        "Content-Type": "application/json",
      },
    });
  } catch (error: any) {
    console.error("Erro ao criar task:", error.response?.data || error.message);
  }
};

export default async function postFeedback(app: FastifyInstance) {
  app.post('/post', async (request, reply) => {
    try {
        const data = request.body as any;
        const task : any = postTask({
        title: data.descricao,
        type: feedback[data.tipo].id,
        priority: feedback[data.tipo].stickers[data.prioridade].id,      
        funcionario: data.funcionario,
        });
        reply.status(200).send({});
    } catch (error) {
        console.log(error)
        reply.status(500).send({ message: 'Error creating task', error });
    }
  });
}