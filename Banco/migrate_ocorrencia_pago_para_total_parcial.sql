-- Migracao: ocorrencia.status — substituir 'pago' por 'pago total' e 'pago parcial'.
-- Apenas tabela `ocorrencia` (sem alterar performance, contrato, parcela).
-- Executar na base consorcio_gm apos backup.

-- 1) Incluir novos literais no ENUM mantendo 'pago' para migrar dados
ALTER TABLE `ocorrencia`
  MODIFY COLUMN `status` ENUM(
    'cobranca',
    'pago',
    'pago total',
    'pago parcial',
    'indenizado',
    'parcela paga',
    'parcela vencida',
    'parcela indenizada'
  ) DEFAULT NULL;

-- 2) Historico: tratar quitacao total antiga como 'pago total'
UPDATE `ocorrencia` SET `status` = 'pago total' WHERE `status` = 'pago';

-- 3) ENUM final sem o valor 'pago'
ALTER TABLE `ocorrencia`
  MODIFY COLUMN `status` ENUM(
    'cobranca',
    'pago total',
    'pago parcial',
    'indenizado',
    'parcela paga',
    'parcela vencida',
    'parcela indenizada'
  ) DEFAULT NULL;
