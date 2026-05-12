-- Migracao: status 'aberto' -> 'cobranca', 'fechado' -> 'pago' (contrato, parcela, ocorrencia, performance)
-- MariaDB/MySQL: expandir ENUM, UPDATE, contrair ENUM.
-- Executar numa janela de manutencao; fazer backup antes.

SET NAMES utf8mb4;

-- 1) contrato.status
ALTER TABLE `contrato`
  MODIFY COLUMN `status` ENUM(
    'aberto','fechado','indenizado',
    'cobranca','pago'
  ) NOT NULL DEFAULT 'aberto';

UPDATE `contrato` SET `status` = 'cobranca' WHERE `status` = 'aberto';
UPDATE `contrato` SET `status` = 'pago' WHERE `status` = 'fechado';

ALTER TABLE `contrato`
  MODIFY COLUMN `status` ENUM('cobranca','pago','indenizado') NOT NULL DEFAULT 'cobranca';

-- 2) parcela.status
ALTER TABLE `parcela`
  MODIFY COLUMN `status` ENUM(
    'aberto','fechado','indenizado',
    'cobranca','pago'
  ) NOT NULL DEFAULT 'aberto';

UPDATE `parcela` SET `status` = 'cobranca' WHERE `status` = 'aberto';
UPDATE `parcela` SET `status` = 'pago' WHERE `status` = 'fechado';

ALTER TABLE `parcela`
  MODIFY COLUMN `status` ENUM('cobranca','pago','indenizado') NOT NULL DEFAULT 'cobranca';

-- 3) ocorrencia.status (NULL permitido no schema fonte)
ALTER TABLE `ocorrencia`
  MODIFY COLUMN `status` ENUM(
    'aberto','fechado','indenizado','parcela paga','parcela vencida','parcela indenizada',
    'cobranca','pago'
  ) DEFAULT NULL;

UPDATE `ocorrencia` SET `status` = 'cobranca' WHERE `status` = 'aberto';
UPDATE `ocorrencia` SET `status` = 'pago' WHERE `status` = 'fechado';

ALTER TABLE `ocorrencia`
  MODIFY COLUMN `status` ENUM(
    'cobranca','pago','indenizado','parcela paga','parcela vencida','parcela indenizada'
  ) DEFAULT NULL;

-- 4) performance.ocorrencia_status
ALTER TABLE `performance`
  MODIFY COLUMN `ocorrencia_status` ENUM(
    'aberto','fechado','indenizado','parcela paga','parcela vencida','parcela indenizada',
    'cobranca','pago'
  ) NOT NULL;

UPDATE `performance` SET `ocorrencia_status` = 'cobranca' WHERE `ocorrencia_status` = 'aberto';
UPDATE `performance` SET `ocorrencia_status` = 'pago' WHERE `ocorrencia_status` = 'fechado';

ALTER TABLE `performance`
  MODIFY COLUMN `ocorrencia_status` ENUM(
    'cobranca','pago','indenizado','parcela paga','parcela vencida','parcela indenizada'
  ) NOT NULL;
