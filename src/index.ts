// Teste: PR de código sem registro de revisão, com revisao-registrada obrigatória (será fechado sem merge).
// Ponto de entrada da biblioteca. Cada tarefa acrescenta suas exportações aqui.
export { isValidCpf } from './cpf.js';
export { isValidCnpj } from './cnpj.js';
export { checkDocument, detectDocumentType } from './document.js';
export type { DocumentCheck, DocumentType } from './document.js';
