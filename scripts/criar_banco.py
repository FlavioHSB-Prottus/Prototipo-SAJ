# -*- coding: utf-8 -*-
import argparse
import os
import sys
import re
import pymysql

# 1. AJUSTE O NOME DO BANCO AQUI SE NECESSÁRIO
DB_HOST = os.environ.get("DB_HOST", "localhost")
DB_USER = os.environ.get("DB_USER", "root")
DB_PASSWORD = os.environ.get("DB_PASSWORD", "root")
DB_NAME = os.environ.get("DB_NAME", "consorcio_gm")

# 2. SQL PURO E COM PONTO-E-VÍRGULA
RAW_SQL = """
CREATE TABLE `arquivos_gm` (
  `id_arquivo_gm` int(11) NOT NULL AUTO_INCREMENT,
  `data_arquivo` date DEFAULT NULL,
  `conteudo` longtext DEFAULT NULL,
  `data_processamento` timestamp NULL DEFAULT current_timestamp(),
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id_arquivo_gm`),
  UNIQUE KEY `arquivos_gm_data_arquivo_IDX` (`data_arquivo`) USING BTREE,
  KEY `idx_dt_arq` (`data_arquivo`)
);

CREATE TABLE `funcionario` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nome` varchar(255) NOT NULL,
  `data_nascimento` date DEFAULT NULL,
  `cpf_cnpj` varchar(20) NOT NULL,
  `ativo` bit(1) NOT NULL DEFAULT b'1',
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `login` varchar(50) DEFAULT NULL,
  `senha` varchar(50) DEFAULT NULL,
  `acesso_externo` bit(1) DEFAULT b'0',
  `email` varchar(255) DEFAULT NULL,
  `ddd` varchar(5) DEFAULT NULL,
  `numero` varchar(30) DEFAULT NULL,
  `logradouro` varchar(255) DEFAULT NULL,
  `bairro` varchar(100) DEFAULT NULL,
  `complemento` varchar(100) DEFAULT NULL,
  `cep` varchar(10) DEFAULT NULL,
  `cidade` varchar(100) DEFAULT NULL,
  `estado` varchar(2) DEFAULT NULL,
  `departamento` varchar(25) DEFAULT NULL,
  `nivel_acesso` varchar(20) DEFAULT NULL,
  `sexo` varchar(1) DEFAULT NULL,
  `matricula` varchar(25) DEFAULT NULL,
  `foto` mediumblob DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `cpf_cnpj` (`cpf_cnpj`),
  UNIQUE KEY `funcionario_login_IDX` (`login`) USING BTREE
);

CREATE TABLE `grupo` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `nome` varchar(255) NOT NULL,
  `descricao` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
);

CREATE TABLE `pessoa` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `cpf_cnpj` varchar(20) DEFAULT NULL,
  `nome_completo` varchar(255) DEFAULT NULL,
  `data_nascimento` date DEFAULT NULL,
  `profissao` varchar(100) DEFAULT NULL,
  `conjuge_nome` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `cpf_cnpj` (`cpf_cnpj`)
);

CREATE TABLE `email` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `id_pessoa` bigint(20) NOT NULL,
  `tipo` varchar(40) NOT NULL DEFAULT 'principal',
  `email` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_email_pessoa_tipo` (`id_pessoa`,`tipo`),
  KEY `idx_email_pessoa` (`id_pessoa`),
  CONSTRAINT `fk_email_pessoa` FOREIGN KEY (`id_pessoa`) REFERENCES `pessoa` (`id`) ON DELETE CASCADE
);

CREATE TABLE `empresa` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `apelido` varchar(15) NOT NULL,
  `ativo` bit(1) DEFAULT NULL,
  `bradesco` bit(1) DEFAULT NULL,
  `id_pessoa` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `id_pessoa` (`id_pessoa`),
  CONSTRAINT `empresa_ibfk_1` FOREIGN KEY (`id_pessoa`) REFERENCES `pessoa` (`id`) ON DELETE CASCADE
);

CREATE TABLE `endereco` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `id_pessoa` bigint(20) NOT NULL,
  `tipo` varchar(40) NOT NULL COMMENT 'principal, secundario, avalista_principal, ...',
  `logradouro` varchar(255) DEFAULT NULL,
  `bairro` varchar(100) DEFAULT NULL,
  `complemento` varchar(100) DEFAULT NULL,
  `cep` varchar(10) DEFAULT NULL,
  `cidade` varchar(100) DEFAULT NULL,
  `estado` varchar(2) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_endereco_pessoa_tipo` (`id_pessoa`,`tipo`),
  KEY `idx_endereco_pessoa` (`id_pessoa`),
  CONSTRAINT `fk_endereco_pessoa` FOREIGN KEY (`id_pessoa`) REFERENCES `pessoa` (`id`) ON DELETE CASCADE
);

CREATE TABLE `funcionario_grupo` (
  `id_funcionario` int(11) NOT NULL,
  `id_grupo` bigint(20) NOT NULL,
  PRIMARY KEY (`id_funcionario`,`id_grupo`),
  KEY `fk_grupo` (`id_grupo`),
  CONSTRAINT `fk_funcionario` FOREIGN KEY (`id_funcionario`) REFERENCES `funcionario` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_grupo` FOREIGN KEY (`id_grupo`) REFERENCES `grupo` (`id`) ON DELETE CASCADE
);

CREATE TABLE `header` (
  `id_registro` int(11) NOT NULL AUTO_INCREMENT,
  `tipo_reg` varchar(1) DEFAULT NULL,
  `cnpj` varchar(14) DEFAULT NULL,
  `empresa` varchar(50) DEFAULT NULL,
  `data` varchar(15) DEFAULT NULL,
  `numero_do_lote` varchar(6) DEFAULT NULL,
  `id_arquivo_gm` int(11) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id_registro`),
  KEY `fk_header_arquivos` (`id_arquivo_gm`),
  CONSTRAINT `fk_header_arquivos` FOREIGN KEY (`id_arquivo_gm`) REFERENCES `arquivos_gm` (`id_arquivo_gm`) ON DELETE CASCADE
);

CREATE TABLE `mensagem` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `id_remetente` int(11) NOT NULL,
  `id_destinatario` int(11) NOT NULL,
  `assunto` text NOT NULL,
  `descricao` text DEFAULT NULL,
  `data_envio` datetime NOT NULL DEFAULT current_timestamp(),
  `id_resposta` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `id_remetente` (`id_remetente`),
  KEY `id_destinatario` (`id_destinatario`),
  KEY `id_resposta` (`id_resposta`),
  CONSTRAINT `mensagem_ibfk_1` FOREIGN KEY (`id_remetente`) REFERENCES `funcionario` (`id`) ON DELETE CASCADE,
  CONSTRAINT `mensagem_ibfk_2` FOREIGN KEY (`id_destinatario`) REFERENCES `funcionario` (`id`) ON DELETE CASCADE,
  CONSTRAINT `mensagem_ibfk_3` FOREIGN KEY (`id_resposta`) REFERENCES `mensagem` (`id`) ON DELETE CASCADE
);

CREATE TABLE `registro2` (
  `id_registro` int(11) NOT NULL AUTO_INCREMENT,
  `tipo` varchar(1) DEFAULT NULL,
  `grupo` varchar(6) DEFAULT NULL,
  `cota` varchar(4) DEFAULT NULL,
  `sequencia` varchar(2) DEFAULT NULL,
  `aviso` varchar(8) DEFAULT NULL,
  `tipomov` varchar(4) DEFAULT NULL,
  `vencimento` varchar(15) DEFAULT NULL,
  `agentecob` varchar(6) DEFAULT NULL,
  `valorpar` varchar(30) DEFAULT NULL,
  `multajur` varchar(30) DEFAULT NULL,
  `valortot` varchar(30) DEFAULT NULL,
  `numeroext` varchar(20) DEFAULT NULL,
  `datenvio` varchar(15) DEFAULT NULL,
  `assembléia` varchar(3) DEFAULT NULL,
  `numero_parcela` varchar(3) DEFAULT NULL,
  `fdo_comum` varchar(30) DEFAULT NULL,
  `tx_adm` varchar(30) DEFAULT NULL,
  `fd_reserva` varchar(30) DEFAULT NULL,
  `seguro` varchar(30) DEFAULT NULL,
  `id_arquivo_gm` int(11) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id_registro`),
  KEY `idx_r2_grupo_cota` (`grupo`,`cota`),
  KEY `idx_r2_parcela` (`numero_parcela`),
  KEY `idx_r2_vencimento` (`vencimento`),
  KEY `idx_r2_join` (`id_arquivo_gm`,`grupo`,`cota`),
  KEY `idx_r2_num_venc` (`numero_parcela`,`vencimento`),
  KEY `idx_r2_parcela_single` (`numero_parcela`),
  KEY `idx_r2_vencimento_single` (`vencimento`),
  KEY `idx_r2_valor` (`valortot`),
  KEY `idx_r2_juros` (`multajur`),
  CONSTRAINT `fk_registro2_arquivos` FOREIGN KEY (`id_arquivo_gm`) REFERENCES `arquivos_gm` (`id_arquivo_gm`) ON DELETE CASCADE
);

CREATE TABLE `registro3` (
  `id_registro` int(11) NOT NULL AUTO_INCREMENT,
  `tipo` varchar(1) DEFAULT NULL,
  `grupo` varchar(6) DEFAULT NULL,
  `cota` varchar(4) DEFAULT NULL,
  `sequencia` varchar(2) DEFAULT NULL,
  `chassi` varchar(21) DEFAULT NULL,
  `placa` varchar(10) DEFAULT NULL,
  `codigo_renavam` varchar(13) DEFAULT NULL,
  `modelo` varchar(15) DEFAULT NULL,
  `ano_modelo` varchar(9) DEFAULT NULL,
  `cor` varchar(16) DEFAULT NULL,
  `marca` varchar(20) DEFAULT NULL,
  `data_nota_fiscal` varchar(15) DEFAULT NULL,
  `endereco` varchar(100) DEFAULT NULL,
  `bairro` varchar(30) DEFAULT NULL,
  `cep` varchar(8) DEFAULT NULL,
  `cidade` varchar(50) DEFAULT NULL,
  `estado` varchar(2) DEFAULT NULL,
  `matricula` varchar(8) DEFAULT NULL,
  `cartorio` varchar(50) DEFAULT NULL,
  `vl_avaliacao` varchar(30) DEFAULT NULL,
  `id_arquivo_gm` int(11) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id_registro`),
  KEY `idx_r3_grupo_cota` (`grupo`,`cota`),
  KEY `idx_r3_join` (`id_arquivo_gm`,`grupo`,`cota`),
  CONSTRAINT `fk_registro3_arquivos` FOREIGN KEY (`id_arquivo_gm`) REFERENCES `arquivos_gm` (`id_arquivo_gm`) ON DELETE CASCADE
);

CREATE TABLE `registro4` (
  `id_registro` int(11) NOT NULL AUTO_INCREMENT,
  `tipo` varchar(1) DEFAULT NULL,
  `grupo` varchar(6) DEFAULT NULL,
  `cota` varchar(4) DEFAULT NULL,
  `sequencia` varchar(2) DEFAULT NULL,
  `tipo_referencia` varchar(21) DEFAULT NULL,
  `nome` varchar(40) DEFAULT NULL,
  `endereço` varchar(40) DEFAULT NULL,
  `bairro` varchar(25) DEFAULT NULL,
  `ddd` varchar(3) DEFAULT NULL,
  `fone` varchar(15) DEFAULT NULL,
  `ramal` varchar(4) DEFAULT NULL,
  `observação_1` varchar(255) DEFAULT NULL,
  `id_arquivo_gm` int(11) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id_registro`),
  KEY `fk_registro4_arquivos` (`id_arquivo_gm`),
  CONSTRAINT `fk_registro4_arquivos` FOREIGN KEY (`id_arquivo_gm`) REFERENCES `arquivos_gm` (`id_arquivo_gm`) ON DELETE CASCADE
);

CREATE TABLE `registro5` (
  `id_registro` int(11) NOT NULL AUTO_INCREMENT,
  `tipo` varchar(1) DEFAULT NULL,
  `grupo` varchar(6) DEFAULT NULL,
  `cota` varchar(4) DEFAULT NULL,
  `sequencia` varchar(2) DEFAULT NULL,
  `cpf_avalista` varchar(14) DEFAULT NULL,
  `avalista` varchar(40) DEFAULT NULL,
  `end_aval` varchar(40) DEFAULT NULL,
  `bairro` varchar(25) DEFAULT NULL,
  `compl_aval` varchar(10) DEFAULT NULL,
  `cep_aval` varchar(8) DEFAULT NULL,
  `cidade_aval` varchar(30) DEFAULT NULL,
  `estado_aval` varchar(2) DEFAULT NULL,
  `ddd_aval` varchar(3) DEFAULT NULL,
  `telefone_aval` varchar(15) DEFAULT NULL,
  `ddd_celular_aval` varchar(3) DEFAULT NULL,
  `celular_aval` varchar(15) DEFAULT NULL,
  `email_aval` varchar(50) DEFAULT NULL,
  `empresa_aval` varchar(30) DEFAULT NULL,
  `endereco2_aval` varchar(40) DEFAULT NULL,
  `bairro2` varchar(25) DEFAULT NULL,
  `cep2_aval` varchar(8) DEFAULT NULL,
  `cidade2_aval` varchar(30) DEFAULT NULL,
  `estado2_aval` varchar(2) DEFAULT NULL,
  `ddd2_coml_aval` varchar(3) DEFAULT NULL,
  `telefone2_aval` varchar(15) DEFAULT NULL,
  `ramal_coml_aval` varchar(4) DEFAULT NULL,
  `conjuge_avalista` varchar(40) DEFAULT NULL,
  `ddd_coml_conj_aval` varchar(3) DEFAULT NULL,
  `fon_coml_conj_aval` varchar(15) DEFAULT NULL,
  `ramal_coml_conj_aval` varchar(4) DEFAULT NULL,
  `refer_a_aval` varchar(40) DEFAULT NULL,
  `endref_a_aval` varchar(40) DEFAULT NULL,
  `bairr_refe_aval` varchar(25) DEFAULT NULL,
  `ddd_a_ref_aval` varchar(3) DEFAULT NULL,
  `fon_a_aval` varchar(15) DEFAULT NULL,
  `ram_a_aval` varchar(4) DEFAULT NULL,
  `refer_b_aval` varchar(40) DEFAULT NULL,
  `endref_b_aval` varchar(40) DEFAULT NULL,
  `bairrob_refe_aval` varchar(25) DEFAULT NULL,
  `ddd_b_ref_aval` varchar(3) DEFAULT NULL,
  `fon_b_aval` varchar(15) DEFAULT NULL,
  `ram_b_aval` varchar(4) DEFAULT NULL,
  `refer_c_aval` varchar(40) DEFAULT NULL,
  `endref_c_aval` varchar(40) DEFAULT NULL,
  `bairro_c_aval` varchar(25) DEFAULT NULL,
  `ddd_c_ref_aval` varchar(3) DEFAULT NULL,
  `fon_c_aval` varchar(15) DEFAULT NULL,
  `ram_c_aval` varchar(4) DEFAULT NULL,
  `refer_d_aval` varchar(40) DEFAULT NULL,
  `endref_d_aval` varchar(40) DEFAULT NULL,
  `bairro_d_aval` varchar(25) DEFAULT NULL,
  `ddd_d_ref_aval` varchar(3) DEFAULT NULL,
  `fon_d_aval` varchar(15) DEFAULT NULL,
  `ram_d_aval` varchar(4) DEFAULT NULL,
  `id_arquivo_gm` int(11) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id_registro`),
  KEY `idx_r5_grupo_cota` (`grupo`,`cota`),
  KEY `idx_r5_join` (`id_arquivo_gm`,`grupo`,`cota`),
  CONSTRAINT `fk_registro5_arquivos` FOREIGN KEY (`id_arquivo_gm`) REFERENCES `arquivos_gm` (`id_arquivo_gm`) ON DELETE CASCADE
);

CREATE TABLE `registro_1` (
  `id_registro` int(11) NOT NULL AUTO_INCREMENT,
  `tipo` varchar(1) DEFAULT NULL,
  `grupo` varchar(6) DEFAULT NULL,
  `cota` varchar(4) DEFAULT NULL,
  `versao` varchar(2) DEFAULT NULL,
  `cgc_cpf` varchar(14) DEFAULT NULL,
  `nome` varchar(40) DEFAULT NULL,
  `status` varchar(15) DEFAULT NULL,
  `amort` varchar(30) DEFAULT NULL,
  `atras` varchar(30) DEFAULT NULL,
  `mensal` varchar(30) DEFAULT NULL,
  `mensal_c_taxas` varchar(30) DEFAULT NULL,
  `seguro_mensal_c_taxas` varchar(30) DEFAULT NULL,
  `taxa_adm_do_grupo` varchar(30) DEFAULT NULL,
  `fundo_de_reserva_do_grupo` varchar(30) DEFAULT NULL,
  `prazo` varchar(3) DEFAULT NULL,
  `plano_basico` varchar(3) DEFAULT NULL,
  `dt_ult_ass_gr` varchar(15) DEFAULT NULL,
  `cat_c_seg` varchar(11) DEFAULT NULL,
  `valor_do_bem_sem_taxas` varchar(30) DEFAULT NULL,
  `dif_parc_acumulado` varchar(30) DEFAULT NULL,
  `vl_parc` varchar(30) DEFAULT NULL,
  `modelo` varchar(12) DEFAULT NULL,
  `endereco` varchar(40) DEFAULT NULL,
  `bairro` varchar(25) DEFAULT NULL,
  `compl` varchar(10) DEFAULT NULL,
  `cep` varchar(8) DEFAULT NULL,
  `cidade` varchar(30) DEFAULT NULL,
  `estado` varchar(2) DEFAULT NULL,
  `ddd_telefone` varchar(3) DEFAULT NULL,
  `telefone` varchar(15) DEFAULT NULL,
  `ddd_celular` varchar(3) DEFAULT NULL,
  `celular` varchar(15) DEFAULT NULL,
  `email` varchar(50) DEFAULT NULL,
  `empresa` varchar(30) DEFAULT NULL,
  `endereco2` varchar(40) DEFAULT NULL,
  `bairro2` varchar(25) DEFAULT NULL,
  `compl_2` varchar(10) DEFAULT NULL,
  `cep2` varchar(8) DEFAULT NULL,
  `cidade2` varchar(30) DEFAULT NULL,
  `estado2` varchar(2) DEFAULT NULL,
  `ddd2` varchar(3) DEFAULT NULL,
  `telefone2` varchar(15) DEFAULT NULL,
  `ramal_coml_devedor` varchar(4) DEFAULT NULL,
  `conjuge_consorciado` varchar(40) DEFAULT NULL,
  `ddd_coml_conj` varchar(3) DEFAULT NULL,
  `fon_coml_conj` varchar(15) DEFAULT NULL,
  `ramal_coml_conj_devedor` varchar(4) DEFAULT NULL,
  `data_nascimento` varchar(15) DEFAULT NULL,
  `nome_pai` varchar(40) DEFAULT NULL,
  `nome_mae` varchar(40) DEFAULT NULL,
  `profissao` varchar(40) DEFAULT NULL,
  `data_entrega_bem` varchar(15) DEFAULT NULL,
  `data_da_expectativa` varchar(15) DEFAULT NULL,
  `data_adesão` varchar(15) DEFAULT NULL,
  `data_transferencia` varchar(15) DEFAULT NULL,
  `tipo_contemplacao` varchar(1) DEFAULT NULL,
  `data_contemplacao` varchar(15) DEFAULT NULL,
  `percentual_lance` varchar(30) DEFAULT NULL,
  `rev` varchar(6) DEFAULT NULL,
  `nome_rev` varchar(40) DEFAULT NULL,
  `codigo_da_campanha` varchar(6) DEFAULT NULL,
  `numero_do_contrato` varchar(10) DEFAULT NULL,
  `id_arquivo_gm` int(11) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id_registro`),
  KEY `idx_r1_grupo_cota` (`grupo`,`cota`),
  KEY `idx_r1_join` (`id_arquivo_gm`,`grupo`,`cota`),
  KEY `idx_r1_cpf` (`cgc_cpf`),
  KEY `idx_r1_contrato` (`numero_do_contrato`),
  KEY `idx_r1_status` (`status`),
  KEY `idx_r1_adesao` (`data_adesão`),
  KEY `idx_r1_updated` (`updated_at`),
  KEY `idx_r1_encerramento` (`dt_ult_ass_gr`),
  CONSTRAINT `fk_registro_1_arquivos` FOREIGN KEY (`id_arquivo_gm`) REFERENCES `arquivos_gm` (`id_arquivo_gm`) ON DELETE CASCADE
);

CREATE TABLE `registro_6` (
  `id_registro` int(11) NOT NULL AUTO_INCREMENT,
  `tipo` varchar(1) DEFAULT NULL,
  `grupo` varchar(6) DEFAULT NULL,
  `cota` varchar(4) DEFAULT NULL,
  `sequencia` varchar(2) DEFAULT NULL,
  `aviso` varchar(8) DEFAULT NULL,
  `tipomov` varchar(4) DEFAULT NULL,
  `vencimento` varchar(15) DEFAULT NULL,
  `agentecob` varchar(6) DEFAULT NULL,
  `valorpar` varchar(30) DEFAULT NULL,
  `multajur` varchar(30) DEFAULT NULL,
  `valortot` varchar(30) DEFAULT NULL,
  `numeroext` varchar(20) DEFAULT NULL,
  `datenvio` varchar(15) DEFAULT NULL,
  `assembléia` varchar(3) DEFAULT NULL,
  `numero_parcela` varchar(3) DEFAULT NULL,
  `fdo_comum` varchar(30) DEFAULT NULL,
  `tx_adm` varchar(30) DEFAULT NULL,
  `fd_reserva` varchar(30) DEFAULT NULL,
  `seguro` varchar(30) DEFAULT NULL,
  `id_arquivo_gm` int(11) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id_registro`),
  KEY `fk_registro_6_arquivos` (`id_arquivo_gm`),
  CONSTRAINT `fk_registro_6_arquivos` FOREIGN KEY (`id_arquivo_gm`) REFERENCES `arquivos_gm` (`id_arquivo_gm`) ON DELETE CASCADE
);

CREATE TABLE `telefone` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `id_pessoa` bigint(20) NOT NULL,
  `tipo` varchar(40) NOT NULL COMMENT 'fixo, celular, comercial_devedor, comercial_conjuge, avalista_fixo, avalista_celular, ...',
  `ddd` varchar(5) DEFAULT NULL,
  `numero` varchar(30) NOT NULL,
  `ramal` varchar(10) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `cpc` enum('sim','não','amigo','parente') DEFAULT NULL,
  `status` enum('bom','medio','ruim') DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_telefone_pessoa_tipo` (`id_pessoa`,`tipo`),
  KEY `idx_telefone_pessoa` (`id_pessoa`),
  CONSTRAINT `fk_telefone_pessoa` FOREIGN KEY (`id_pessoa`) REFERENCES `pessoa` (`id`) ON DELETE CASCADE
);

CREATE TABLE `trailer` (
  `id_registro` int(11) NOT NULL AUTO_INCREMENT,
  `tipo_reg` varchar(1) DEFAULT NULL,
  `data` varchar(15) DEFAULT NULL,
  `total_reg_1` varchar(30) DEFAULT NULL,
  `qtd_parcelas` varchar(30) DEFAULT NULL,
  `valor_parcelas` varchar(30) DEFAULT NULL,
  `qtd_parcelas_1` varchar(10) DEFAULT NULL,
  `valor_parcelas_1` varchar(30) DEFAULT NULL,
  `numero_do_lote` varchar(8) DEFAULT NULL,
  `id_arquivo_gm` int(11) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id_registro`),
  KEY `fk_trailer_arquivos` (`id_arquivo_gm`),
  CONSTRAINT `fk_trailer_arquivos` FOREIGN KEY (`id_arquivo_gm`) REFERENCES `arquivos_gm` (`id_arquivo_gm`) ON DELETE CASCADE
);

CREATE TABLE `contrato` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `id_pessoa` bigint(20) NOT NULL,
  `id_avalista` bigint(20) DEFAULT NULL,
  `numero_contrato` varchar(50) DEFAULT NULL,
  `grupo` varchar(20) DEFAULT NULL,
  `cota` varchar(20) DEFAULT NULL,
  `versao` varchar(10) DEFAULT NULL,
  `status_txt` varchar(50) DEFAULT NULL,
  `valor_credito` decimal(16,2) DEFAULT NULL,
  `prazo_meses` int(11) DEFAULT NULL,
  `data_adesao` date DEFAULT NULL,
  `encerramento_grupo` date DEFAULT NULL,
  `taxa_administracao` decimal(16,4) DEFAULT NULL,
  `fundo_reserva` decimal(16,4) DEFAULT NULL,
  `percentual_lance` decimal(16,4) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `status` enum('aberto','fechado','indenizado') DEFAULT 'aberto',
  `id_empresa` bigint(20) DEFAULT NULL,
  `id_seguradora` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_grupo_cota` (`grupo`,`cota`),
  KEY `id_pessoa` (`id_pessoa`),
  KEY `id_avalista` (`id_avalista`),
  KEY `contrato_ibfk_3` (`id_empresa`),
  KEY `contrato_ibfk_4` (`id_seguradora`),
  CONSTRAINT `contrato_ibfk_1` FOREIGN KEY (`id_pessoa`) REFERENCES `pessoa` (`id`),
  CONSTRAINT `contrato_ibfk_2` FOREIGN KEY (`id_avalista`) REFERENCES `pessoa` (`id`) ON DELETE SET NULL,
  CONSTRAINT `contrato_ibfk_3` FOREIGN KEY (`id_empresa`) REFERENCES `empresa` (`id`) ON DELETE SET NULL,
  CONSTRAINT `contrato_ibfk_4` FOREIGN KEY (`id_seguradora`) REFERENCES `empresa` (`id`) ON DELETE SET NULL
);

CREATE TABLE `funcionario_cobranca` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `id_funcionario` int(11) NOT NULL,
  `id_contrato` bigint(20) NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `responsavel_primario` bit(1) NOT NULL DEFAULT b'1',
  `relacao_ativa` bit(1) NOT NULL DEFAULT b'1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `funcionario_cobranca_id_funcionario_IDX` (`id_funcionario`,`id_contrato`) USING BTREE,
  KEY `id_contrato` (`id_contrato`),
  CONSTRAINT `funcionario_cobranca_ibfk_1` FOREIGN KEY (`id_funcionario`) REFERENCES `funcionario` (`id`),
  CONSTRAINT `funcionario_cobranca_ibfk_2` FOREIGN KEY (`id_contrato`) REFERENCES `contrato` (`id`)
);

CREATE TABLE `ocorrencia` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `id_contrato` bigint(20) NOT NULL,
  `id_arquivo_gm` int(11) DEFAULT NULL,
  `descricao` varchar(255) DEFAULT '',
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `status` enum('aberto','fechado','indenizado','parcela paga','parcela vencida') DEFAULT NULL,
  `data_arquivo` date DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `id_contrato` (`id_contrato`),
  KEY `id_arquivo_gm` (`id_arquivo_gm`),
  KEY `fk_ocorrencia_data` (`data_arquivo`),
  CONSTRAINT `fk_ocorrencia_data` FOREIGN KEY (`data_arquivo`) REFERENCES `arquivos_gm` (`data_arquivo`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `ocorrencia_ibfk_1` FOREIGN KEY (`id_contrato`) REFERENCES `contrato` (`id`) ON DELETE CASCADE,
  CONSTRAINT `ocorrencia_ibfk_2` FOREIGN KEY (`id_arquivo_gm`) REFERENCES `arquivos_gm` (`id_arquivo_gm`) ON DELETE CASCADE
);

CREATE TABLE `parcela` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `id_contrato` bigint(20) NOT NULL,
  `numero_parcela` int(11) DEFAULT NULL,
  `vencimento` date DEFAULT NULL,
  `valor_nominal` decimal(16,2) DEFAULT NULL,
  `valor_total` decimal(16,2) DEFAULT NULL,
  `multa_juros` decimal(16,2) DEFAULT NULL,
  `status` enum('aberto','fechado','indenizado') DEFAULT 'aberto',
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_contrato_parcela` (`id_contrato`,`numero_parcela`,`vencimento`),
  CONSTRAINT `parcela_ibfk_1` FOREIGN KEY (`id_contrato`) REFERENCES `contrato` (`id`) ON DELETE CASCADE
);

CREATE TABLE `protocolo` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `id_remetente` int(11) NOT NULL,
  `id_destinatario` int(11) NOT NULL,
  `data_envio` date DEFAULT curdate(),
  `data_resposta` date DEFAULT NULL,
  `aceito` bit(1) DEFAULT NULL,
  `titulo` varchar(50) NOT NULL,
  `descricao` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp(),
  `id_contrato` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `id_remetente` (`id_remetente`),
  KEY `id_destinatario` (`id_destinatario`),
  KEY `protocolo_contrato_fk` (`id_contrato`),
  CONSTRAINT `protocolo_contrato_fk` FOREIGN KEY (`id_contrato`) REFERENCES `contrato` (`id`) ON DELETE CASCADE,
  CONSTRAINT `protocolo_ibfk_1` FOREIGN KEY (`id_remetente`) REFERENCES `funcionario` (`id`) ON DELETE CASCADE,
  CONSTRAINT `protocolo_ibfk_2` FOREIGN KEY (`id_destinatario`) REFERENCES `funcionario` (`id`) ON DELETE CASCADE
);

CREATE TABLE `solicitacao` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `id_remetente` int(11) NOT NULL,
  `id_destinatario` int(11) NOT NULL,
  `data_aguardar` date NOT NULL,
  `descricao` varchar(255) DEFAULT NULL,
  `resposta_solicitacao` bigint(20) DEFAULT NULL,
  `data_envio` datetime NOT NULL DEFAULT current_timestamp(),
  `id_contrato` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `id_remetente` (`id_remetente`),
  KEY `id_destinatario` (`id_destinatario`),
  KEY `resposta_solicitacao` (`resposta_solicitacao`),
  KEY `solicitacao_contrato_fk` (`id_contrato`),
  CONSTRAINT `solicitacao_contrato_fk` FOREIGN KEY (`id_contrato`) REFERENCES `contrato` (`id`) ON DELETE CASCADE,
  CONSTRAINT `solicitacao_ibfk_1` FOREIGN KEY (`id_remetente`) REFERENCES `funcionario` (`id`) ON DELETE CASCADE,
  CONSTRAINT `solicitacao_ibfk_2` FOREIGN KEY (`id_destinatario`) REFERENCES `funcionario` (`id`) ON DELETE CASCADE,
  CONSTRAINT `solicitacao_ibfk_3` FOREIGN KEY (`resposta_solicitacao`) REFERENCES `solicitacao` (`id`) ON DELETE CASCADE
);

CREATE TABLE `tramitacao` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `id_pessoa` bigint(20) NOT NULL,
  `id_contrato` bigint(20) NOT NULL,
  `forma` enum('ligacao','whatsapp','email') NOT NULL,
  `cpc` enum('sim','nao','parente','amigo','avalista') NOT NULL,
  `data` timestamp NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `descricao` text DEFAULT NULL,
  `id_funcionario` int(11) NOT NULL,
  `tipo` enum('ativo','passivo') NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_tramitacao_pessoa` (`id_pessoa`),
  KEY `idx_tramitacao_contrato` (`id_contrato`),
  KEY `fk_tramitacao_funcionario` (`id_funcionario`),
  CONSTRAINT `fk_tramitacao_contrato` FOREIGN KEY (`id_contrato`) REFERENCES `contrato` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_tramitacao_funcionario` FOREIGN KEY (`id_funcionario`) REFERENCES `funcionario` (`id`),
  CONSTRAINT `fk_tramitacao_pessoa` FOREIGN KEY (`id_pessoa`) REFERENCES `pessoa` (`id`) ON DELETE CASCADE
);

CREATE TABLE `agenda` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `atividade` varchar(255) NOT NULL,
  `descricao` text DEFAULT NULL,
  `data` timestamp NOT NULL,
  `prioridade` enum('baixa','media','alta') NOT NULL,
  `id_contrato` bigint(20) DEFAULT NULL,
  `id_funcionario` int(11) NOT NULL,
  `status` enum('pendente','concluido') DEFAULT 'pendente',
  PRIMARY KEY (`id`),
  KEY `fk_agenda_contrato` (`id_contrato`),
  KEY `fk_agenda_funcionario` (`id_funcionario`),
  CONSTRAINT `fk_agenda_contrato` FOREIGN KEY (`id_contrato`) REFERENCES `contrato` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_agenda_funcionario` FOREIGN KEY (`id_funcionario`) REFERENCES `funcionario` (`id`)
);

CREATE TABLE `bens` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `id_contrato` bigint(20) DEFAULT NULL,
  `chassi` varchar(30) DEFAULT NULL,
  `placa` varchar(15) DEFAULT NULL,
  `codigo_renavam` varchar(20) DEFAULT NULL,
  `modelo` varchar(50) DEFAULT NULL,
  `ano_modelo` varchar(15) DEFAULT NULL,
  `cor` varchar(30) DEFAULT NULL,
  `marca` varchar(30) DEFAULT NULL,
  `data_nota_fiscal` date DEFAULT NULL,
  `matricula` varchar(20) DEFAULT NULL,
  `cartorio` varchar(100) DEFAULT NULL,
  `vl_avaliacao` decimal(15,2) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `fk_bens_contrato` (`id_contrato`),
  CONSTRAINT `fk_bens_contrato` FOREIGN KEY (`id_contrato`) REFERENCES `contrato` (`id`) ON DELETE CASCADE
);

CREATE TABLE `cobranca` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `id_contrato` bigint(20) NOT NULL,
  `data_arquivo` date NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `cobranca_id_contrato_IDX` (`id_contrato`,`data_arquivo`) USING BTREE,
  KEY `cobranca_arquivos_gm_fk` (`data_arquivo`),
  CONSTRAINT `cobranca_contrato_fk` FOREIGN KEY (`id_contrato`) REFERENCES `contrato` (`id`) ON DELETE CASCADE
);

CREATE TABLE `negativacao` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `id_contrato` bigint(20) NOT NULL,
  `id_parcela` bigint(20) NOT NULL,
  `dias_atraso` int(11) DEFAULT NULL,
  `data_negativacao` datetime DEFAULT current_timestamp(),
  `status` varchar(32) NOT NULL DEFAULT 'enviado',
  `resposta_api` text DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `numero_parcela` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_negativacao_contrato` (`id_contrato`),
  KEY `negativacao_parcela_FK` (`id_parcela`),
  KEY `negativacao_id_contrato_IDX` (`id_contrato`,`id_parcela`) USING BTREE,
  CONSTRAINT `fk_negativacao_contrato` FOREIGN KEY (`id_contrato`) REFERENCES `contrato` (`id`) ON DELETE CASCADE,
  CONSTRAINT `negativacao_parcela_FK` FOREIGN KEY (`id_parcela`) REFERENCES `parcela` (`id`)
);
"""

def connect_server():
    return pymysql.connect(
        host=DB_HOST, user=DB_USER, password=DB_PASSWORD,
        charset="utf8mb4", autocommit=True
    )

def connect_db():
    return pymysql.connect(
        host=DB_HOST, user=DB_USER, password=DB_PASSWORD,
        database=DB_NAME, charset="utf8mb4", autocommit=True
    )

def criar_database():
    conn = connect_server()
    cursor = conn.cursor()
    cursor.execute(f"CREATE DATABASE IF NOT EXISTS `{DB_NAME}` CHARACTER SET utf8mb4")
    cursor.close()
    conn.close()

def criar_tabelas(cursor):
    cursor.execute("SET FOREIGN_KEY_CHECKS = 0")
    criadas = 0
    # O segredo está aqui: split pelo ponto e vírgula e ignorar strings vazias
    statements = [s.strip() for s in RAW_SQL.split(";") if s.strip()]
    
    for stmt in statements:
        # Regex flexível para achar o nome da tabela no comando
        match = re.search(r"CREATE TABLE.*?`([^`]+)`", stmt, re.S | re.I)
        nome = match.group(1) if match else "desconhecida"
        
        try:
            cursor.execute(stmt)
            criadas += 1
            print(f"    - Tabela `{nome}` OK.")
        except Exception as e:
            print(f"    - ERRO na tabela `{nome}`: {e}")
    
    cursor.execute("SET FOREIGN_KEY_CHECKS = 1")
    return criadas

def main():
    print(f"Iniciando processo no banco: {DB_NAME}...")
    criar_database()
    conn = connect_db()
    cursor = conn.cursor()
    
    num = criar_tabelas(cursor)
    print(f"\nSucesso! {num} comandos SQL processados.")
    
    cursor.close()
    conn.close()

if __name__ == "__main__":
    main()