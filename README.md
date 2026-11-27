# Sistema de Gestão de TI

Sistema de gerenciamento do departamento de TI, para uso local (sem login).
Módulo concluído: **Dashboard** (Etapa 01). Os demais itens do menu aparecem como "Em breve".

## Tecnologias

| Camada | Tecnologia |
|---|---|
| Aplicação (interface + servidor) | Next.js 16 · React 19 · TypeScript |
| Estilo | Tailwind CSS 4 |
| Gráficos | Recharts 3 |
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
#    Na primeira vez, cria a pasta .pgdata/ e os bancos gestao_ti, gestao_ti_demo e gestao_ti_test
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
| `npm test` | Roda os testes automáticos (usa o banco `gestao_ti_test`; o banco precisa estar ligado) |
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
| `gestao_ti_test` | Usado só pelos testes automáticos (apagado a cada execução) |

> O banco **não liga sozinho** com o Windows. Rode `npm run db:up` antes de trabalhar.
> Os dados ficam em `.pgdata/` (fora do Git). Apagar essa pasta apaga todos os dados locais.

## Primeiros passos no banco real

O banco real começa vazio (sem usuários nem setores). Em **Configurações → Usuários e setores**:

1. cadastre os setores da empresa;
2. cadastre um administrador (ele passa a ser o usuário atual automaticamente);
3. cadastre técnicos e solicitantes.

Enquanto não existir administrador ativo, os cadastros ficam liberados. Depois, só administradores
podem cadastrar ou editar. Nada é excluído: usuários e setores fora de uso são desativados.

### Usuário atual (sem login)

O seletor no canto superior direito define quem está usando o sistema neste navegador. Esse usuário
fica registrado em cada ação (abertura, atribuição, comentários...).

> **Limitação de segurança:** o sistema não tem autenticação. Qualquer pessoa com acesso ao computador
> pode trocar de usuário. A identificação serve para **registrar** quem fez cada ação, não para **proteger**.

## Dashboard

Tudo é calculado a partir dos PRs registrados no banco; nenhum número é estimado.

| Área | O que mostra |
|---|---|
| Indicadores | PRs registrados, abertos, em andamento, pendentes, concluídos e atrasados, com comparação ao período anterior |
| Desempenho | Primeira resposta e tempo de resolução médios, taxa de conclusão e % dentro do prazo |
| Volume de PRs | Abertos x concluídos por dia, semana ou mês, com dica, totais e tabela |
| Alertas de atraso | PRs atrasados agora, com os de prioridade crítica primeiro |
| Desempenho dos técnicos | Tabela ordenável: atribuídos, concluídos, carteira, atrasados, tempo médio e % no prazo |
| PRs por setor | Participação de cada setor, com comparação |
| Tempo por categoria | Tempo médio de resolução de cada categoria |
| Atividades recentes | Linha do tempo das últimas ações em todos os PRs |

O filtro de período (7, 30 ou 90 dias, este ano ou personalizado) e o agrupamento do gráfico
ficam no endereço da página (ex.: `/dashboard?periodo=90d&agrupar=mes`), então podem ser salvos nos favoritos.

### Regras dos indicadores

- **Horário:** todas as datas seguem o horário de Brasília.
- **Períodos:** "últimos N dias" vai de 00:00 de N−1 dias atrás até agora; "este ano", de 1º de janeiro até agora;
  "personalizado" usa dias inteiros (até 731 dias, sem datas futuras).
- **Comparação:** com o período imediatamente anterior, de mesma duração. Sem PRs antes do período,
  aparece "Sem base de comparação" (nunca um percentual inventado).
- **Registrados e concluídos** contam o que aconteceu *dentro* do período. **Abertos, em andamento,
  pendentes e atrasados** mostram a situação no *fim* do período.
- **Atrasado:** PR em atendimento (aberto, em andamento ou pendente) com o prazo vencido.
- **Prazo (SLA) de resolução:** definido pela prioridade — Crítica 4h, Alta 8h, Média 24h, Baixa 72h
  (valores cadastrados na tabela de prioridades).
- **Primeira resposta:** da abertura até a primeira ação de alguém que não seja o solicitante
  (atribuição, comentário ou mudança de status).
- **Tempo de resolução:** da abertura até a conclusão. **Taxa de conclusão:** dos PRs abertos no período,
  quantos já foram concluídos (cancelados não contam).
- **Tempo corrido:** os tempos incluem noites, fins de semana e feriados. O cálculo em horário útil está
  preparado no código e será ativado quando existir o calendário de expediente.
- **Alertas e atividades** sempre mostram a situação atual, independente do filtro.

### Regra para o futuro módulo de PRs

A situação de cada PR em qualquer data é reconstruída a partir do histórico (`pr_eventos`).
Por isso, **toda mudança de status ou de responsável precisa gerar o evento correspondente**.
Sem isso, as comparações com períodos anteriores ficariam erradas.

### Modo demonstração

Para ver o Dashboard com dados fictícios: rode `npm run db:demo`, defina `APP_DATA_MODE=demo` no `.env`
e reinicie o `npm run dev`. Uma faixa amarela no topo indica que os dados são fictícios.
Volte para `APP_DATA_MODE=real` para usar os dados reais.

### Banco desligado

Se o banco não estiver ligado, o Dashboard mostra uma orientação em vez dos números.
Rode `npm run db:up` e recarregue a página.
