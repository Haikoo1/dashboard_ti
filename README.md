# Sistema de Gestão de TI

Sistema de gerenciamento do departamento de TI. Módulo em desenvolvimento: **Dashboard**.

## Tecnologias

| Camada | Tecnologia |
|---|---|
| Aplicação (interface + servidor) | Next.js 16 · React 19 · TypeScript |
| Estilo | Tailwind CSS 4 |
| Banco de dados | PostgreSQL 18 (instância própria do projeto) |
| Acesso ao banco | Prisma 7 |

## Pré-requisitos

- Node.js 20 ou superior
- PostgreSQL instalado no Windows (só são usados os programas dele; o projeto cria um servidor próprio, separado)

## Primeira execução

```bash
# 1. Instalar as dependências
npm install

# 2. Criar o arquivo de configuração e definir uma senha própria
cp .env.example .env

# 3. Ligar o banco do projeto (porta 5433, acessível só deste computador)
#    Na primeira vez, cria a pasta .pgdata/ e os bancos gestao_ti e gestao_ti_demo
npm run db:up

# 4. Criar as tabelas e a configuração inicial no banco real
npm run db:migrate
npm run db:seed

# 5. (Opcional) Montar o banco de demonstração com dados fictícios
#    Para usá-lo, defina APP_DATA_MODE=demo no .env
npm run db:demo

# 6. Iniciar a aplicação em modo de desenvolvimento
npm run dev
```

Acesse http://localhost:3000.

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | Inicia a aplicação em modo de desenvolvimento |
| `npm run build` | Gera a versão de produção (verifica erros) |
| `npm run lint` | Verifica padrões de código |
| `npm run typecheck` | Verifica erros de tipagem |
| `npm run db:up` / `db:down` | Liga / desliga o banco de dados |
| `npm run db:status` | Mostra se o banco está ligado |
| `npm run db:migrate` | Aplica alterações da estrutura do banco (real) |
| `npm run db:seed` | Cadastra a configuração inicial (prioridades com SLA e categorias) no banco real |
| `npm run db:demo` | Recria o banco de **demonstração** com dados fictícios |
| `npm run db:studio` | Abre um visualizador do banco no navegador |

## Bancos de dados

| Banco | Conteúdo |
|---|---|
| `gestao_ti` | Dados **reais** |
| `gestao_ti_demo` | Dados **fictícios** de demonstração, isolados do real |

> O banco **não liga sozinho** com o Windows. Rode `npm run db:up` antes de trabalhar.
> Os dados ficam em `.pgdata/` (fora do Git). Apagar essa pasta apaga todos os dados locais.
