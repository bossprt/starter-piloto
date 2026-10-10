// Teste de CI: PR de código sem registro de revisão (será fechado sem merge).
// Ponto de entrada da biblioteca. Cada tarefa acrescenta suas exportações aqui.
export { isValidCpf } from './cpf.js';
export { isValidCnpj } from './cnpj.js';
export { checkDocument, detectDocumentType } from './document.js';
export type { DocumentCheck, DocumentType } from './document.js';
