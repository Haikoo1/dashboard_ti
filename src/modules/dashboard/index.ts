// Ponto de entrada do módulo Dashboard: tudo que as telas podem usar.
//
// Consultas (queries/) recebem o banco como primeiro parâmetro. As telas usam
// a conexão padrão (`db` de "@/lib/db"); os testes usam o banco de testes.
export * from "./domain/activity";
export * from "./domain/assignees";
export * from "./domain/comparison";
export * from "./domain/duration";
export * from "./domain/period";
export * from "./domain/summaries";
export * from "./queries/activity";
export * from "./queries/alerts";
export * from "./queries/assignees";
export * from "./queries/indicators";
export * from "./queries/performance";
export * from "./queries/sectors";
export * from "./queries/volume";
