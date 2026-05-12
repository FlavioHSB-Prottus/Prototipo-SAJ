<?
###########################################################################################
## JOAO BARBOSA ASSESSORIA JURIDICA - RUA QUARENTA E OITO, 138 - ESPINHEIRO - RECIFE/PE
## SISTEMA DE ASSESSORIA JURIDICA PARA WEB - VERSAO 1.0 - TECNOLOGIA: PHP/MYSQL
## PROGRAMACAO E DESENVOLVIMENTO: WANDERSON BERNARDO - WANREC@YAHOO.COM.BR
## RECIFE/PE - MAIO DE 2005
###########################################################################################
?>
<?
include "sistema.includes.php"; 
include "sistema.verifica.sessao.php";
$nivel_acesso = "1,4";
include "sistema.verifica.permissao.php";
?>
<?

if (empty($tipoarquivo) || ($tipoarquivo <> "I" && $tipoarquivo <> "E")) {
	header("location:pagina.inicio.php?erro=3"); 
}

if (empty($data_inicio)) $data_inicio = $temp_data_inicio = diminui_data(5,data_atual_br());
if (empty($data_fim)) $data_fim = $temp_data_fim = data_atual_br();

if (!empty($acao) && ($acao=='gerar_arquivo')) { 

	// ********** seleção no banco *****************
	$data_inicio = converte_data_us($data_inicio);
	$data_fim = converte_data_us($data_fim);

	if ($tipoarquivo == "I") {
		$completa_sql = " and t033_tramitacao.T033_ID_SITUACAO in (9498) and t033_tramitacao.T033_DATA_TRAMITACAO >= '$data_inicio 00:00:00' and t033_tramitacao.T033_DATA_TRAMITACAO <= '$data_fim 23:59:59' ";
	} else if ($tipoarquivo == "E") {
		$completa_sql = " and t033_tramitacao.T033_ID_SITUACAO in (9499) and t033_tramitacao.T033_DATA_TRAMITACAO >= '$data_inicio 00:00:00' and t033_tramitacao.T033_DATA_TRAMITACAO <= '$data_fim 23:59:59' ";
	}

	$dados = " 

		select 
			t025_processo_cobranca.T025_CONTRATO,
			t025_processo_cobranca.T025_ID_EMPRESA,
			t025_processo_cobranca.T025_ID_CONSORCIO,
			t025_processo_cobranca.T025_ID_CONSORCIADO,		
			t025_processo_cobranca.T025_DATA_ENTRADA,
			t025_processo_cobranca.T025_DATA_COBRANCA,
			t025_processo_cobranca.T025_DATA_1_INADIMPLENCIA,
			t025_processo_cobranca.T025_DATA_CESSAO_DIREITO,
			t025_processo_cobranca.T025_VALOR_NEGATIVACAO,
			t025_processo_cobranca.T025_DATA_ENC_DIVIDA,

			t022_empresa.T022_ID,
			t022_empresa.T022_APELIDO,
					
			t023_consorciado.T023_ID,
			t023_consorciado.T023_CPF_CNPJ,
			t023_consorciado.T023_TIPO_PESSOA,
			t023_consorciado.T023_DP_NOME,
			t023_consorciado.T023_DPJ_RAZAO_SOCIAL,
			t023_consorciado.T023_DP_DATA_NASCIMENTO,
			t023_consorciado.T023_DP_ENDERECO,
			t023_consorciado.T023_DP_CEP,
			t023_consorciado.T023_DPJ_ENDERECO,
			t023_consorciado.T023_DPJ_CEP,
			t023_consorciado.T023_DP_ID_CIDADE, 
			t023_consorciado.T023_DPJ_ID_CIDADE,
			t023_consorciado.T023_DP_TELEFONE_RESIDENCIAL,
			t023_consorciado.T023_DPJ_TELEFONE,
			t023_consorciado.T023_ID_AVALISTA,

			t033_tramitacao.T033_CONTRATO,
			t033_tramitacao.T033_ID_SITUACAO,
			t033_tramitacao.T033_DATA_TRAMITACAO

		from 
			t025_processo_cobranca, t022_empresa, t023_consorciado, t033_tramitacao
		where	
			t025_processo_cobranca.T025_ID_EMPRESA = t022_empresa.T022_ID and
			t025_processo_cobranca.T025_ID_EMPRESA in (58, 64) and
			t025_processo_cobranca.T025_ID_CONSORCIO = '$consorcio' and
			t025_processo_cobranca.T025_ID_CONSORCIADO = t023_consorciado.T023_ID and
			t025_processo_cobranca.T025_CONTRATO = t033_tramitacao.T033_CONTRATO and
			t033_tramitacao.T033_DATA_TRAMITACAO > t025_processo_cobranca.T025_DATA_ENTRADA
			$completa_sql
		order by t033_tramitacao.T033_DATA_TRAMITACAO desc
		
		";

	$resp_dados = mysql_query($dados,$conexao) or die ('MySQL Erro: ' . mysql_error());

	$data_geracao = data_atual_us(); 
	$dia_corrente = date(d); 
	$mes_corrente = date(m);
	$ano_corrente = date(Y);
	$ano_corrente2 = date(y);
	$codigocliservico = "00359893";
	$brancos = "";
	$brancos2 = " ";
	$sequencia = "0000001";
	$contador = 1;
	
	$sql_query_consulta_acao = " select * from t016_acoes_automaticas where T016_ACAO = 'sequencia_arquivo_serasa' "; 
	$resposta_consulta_acao = mysql_query($sql_query_consulta_acao,$conexao) or die ('MySQL Erro: ' . mysql_error());

	if (($resposta_consulta_acao) && mysql_num_rows($resposta_consulta_acao)>0) { 
		$sequencia_arquivo_negativacao = trim(mysql_result($resposta_consulta_acao, 0, "T016_HORA"));
		$sql_query_atualiza_acao = " update t016_acoes_automaticas set T016_DATA_HORA = now(), T016_HORA = T016_HORA+1 where T016_ACAO = 'sequencia_arquivo_serasa' "; 
		$resposta_atualiza_acao = mysql_query($sql_query_atualiza_acao,$conexao) or die ('MySQL Erro: ' . mysql_error());
	}

	$seq_arquivo = $sequencia_arquivo_negativacao;
	for ($x = strlen($seq_arquivo); $x < 6; $x++) $seq_arquivo = "0".$seq_arquivo;
	
	for ($x = strlen($brancos); $x < 55; $x++) $brancos = $brancos." ";
	for ($x = strlen($brancos2); $x < 452; $x++) $brancos2 = $brancos2." ";

	if ($consorcio == 2) {
		$arquivo = "arquivos/SERASA_VOLKS_$dia_corrente$mes_corrente$ano_corrente$sequencia_arquivo_negativacao.TXT";
	} else {
		$arquivo = "arquivos/SERASA_GM_$dia_corrente$mes_corrente$ano_corrente$sequencia_arquivo_negativacao.TXT";
	}

	$linha_inicial = "0061074175".$ano_corrente.$mes_corrente.$dia_corrente."0081212216001600JOAO BARBOSA                                                          SERASA-CONVEM04" . 
	$seq_arquivo . "E000400437789202" . $brancos2 . $sequencia."\r\n";

	if (file_exists($arquivo)) unlink($arquivo);

	if (!$abrir = fopen($arquivo, 'a')) {
		$msg_sistema_erro = "Erro de criação/abertura no arquivo ($arquivo)";
	} else {

		if (!fwrite($abrir, $linha_inicial)) {
			$msg_sistema_erro = "Erro de gravação dos dados no arquivo ($arquivo)";
		} 
		Registra_LOG("Gerado arquivo de negativação em " . data_atual_br() . " com o suposto nome: $arquivo, período: $data_inicio a $data_fim ");

		while($array_resposta = mysql_fetch_array($resp_dados)) { 
		
			$contador++;
		
			$usuario = strtoupper($array_resposta["T021_LOGIN"]);
			$contrato = $contratosistema = $array_resposta["T025_CONTRATO"];
			$contrato_nrs = str_replace("/", "", $contrato);
			$contrato_nrs = str_replace("-", "", $contrato_nrs);

			$id_empresa = $array_resposta["T025_ID_EMPRESA"];
			$id_consorcio = $array_resposta["T025_ID_CONSORCIO"];
			
			$id_avalista = $array_resposta["T023_ID_AVALISTA"];
			
			$data_cobranca = $array_resposta["T025_DATA_COBRANCA"];
			$data_inadimplencia = str_replace("-", "", $array_resposta["T025_DATA_1_INADIMPLENCIA"]);
			
			$query_busca_dados_parcela = " SELECT T032_VENCIMENTO FROM t032_parcelas where T032_CONTRATO = '$contratosistema' and T032_DATA_PAGTO >= '$data_cobranca' order by T032_VENCIMENTO desc ";
			$resposta_busca_dados_parcela = mysql_query($query_busca_dados_parcela,$conexao) or die ('MySQL Erro: ' . mysql_error());				
			
			if (mysql_num_rows($resposta_busca_dados_parcela) > 0) {
				$data_ultima_parc_paga = converte_data_br(mysql_result($resposta_busca_dados_parcela, 0, 0));
				$dia_base = substr($data_ultima_parc_paga,0,2);
				$mes_base = substr($data_ultima_parc_paga,3,2);
				$ano_base = substr($data_ultima_parc_paga,6,4);
				$prox_vencimento = proximo_vencimento($dia_base, $mes_base, $ano_base, $data_ultima_parc_paga, "mais");
				$data_1_inadimplencia = converte_data_us($prox_vencimento);
				$data_inadimplencia = str_replace("-", "", $data_1_inadimplencia);
			}
			
			//$data_fim_contrato = str_replace("-", "", $array_resposta["T025_DATA_CESSAO_DIREITO"]);
			$data_fim_contrato = str_replace("-", "", $array_resposta["T025_DATA_ENC_DIVIDA"]);
			$valor_negativar = str_replace(".", "", $array_resposta["T025_VALOR_NEGATIVACAO"]);
						
			//$consorcio = strtoupper($array_resposta["T024_RAZAO_SOCIAL"]);
			$responsavel = strtoupper($array_resposta["T021_LOGIN"]);
			
			$tipo_consorciado = $array_resposta["T023_TIPO_PESSOA"];
			$cpf_cnpj = $array_resposta["T023_CPF_CNPJ"];
			
			$data_negativacao = substr($array_resposta["T033_DATA_TRAMITACAO"],0,10);

			/*$query_busca_demost = " select * from t047_demonstrativo_debito where T047_CONTRATO = '$contrato' and T047_DATA >= '$data_negativacao' order by T047_DATA asc ";
			$resposta_busca_demost = mysql_query($query_busca_demost,$conexao) or die ('MySQL Erro: ' . mysql_error());
			
			if (($resposta_busca_demost) && (mysql_num_rows($resposta_busca_demost)>0)) { 
				$valor_negativar = mysql_result($resposta_busca_demost, 0, "T047_VALOR_NEGATIVAR");
				$qtde_parcela_negativar = mysql_result($resposta_busca_demost, 0, "T047_QTDE_PARCELAS_NEGATIVAR");
				$valor_negativar = str_replace(".", "", $valor_negativar);
			} else {
				$valor_negativar = "0";
				$qtde_parcela_negativar = "1";
			}*/
			
			$qtde_parcela_negativar = "1";
	
			if ($tipo_consorciado == "F") {
				$desc_cpf_cnpj = "CPF".$cpf_cnpj;
				$motivo_envio = "RG";
				$consorciado 				= trim(strtoupper($array_resposta["T023_DP_NOME"]));
				$consorciado_endereco		= trim(strtoupper($array_resposta["T023_DP_ENDERECO"]));
				$consorciado_complemento	= trim(strtoupper($array_resposta["T023_DP_COMPLEMENTO"]));
				$consorciado_bairro			= trim(strtoupper($array_resposta["T023_DP_BAIRRO"]));
				$consorciado_cep			= trim($array_resposta["T023_DP_CEP"]);
				$consorciado_id_cidade		= $array_resposta["T023_DP_ID_CIDADE"];
				$consorciado_dtnasc		 	= str_replace("-", "", $array_resposta["T023_DP_DATA_NASCIMENTO"]);
				$consorciado_telefone		= trim($array_resposta["T023_DP_TELEFONE_RESIDENCIAL"]);
			} else if ($tipo_consorciado == "J") {
				$desc_cpf_cnpj = "CNPJ".$cpf_cnpj;
				$motivo_envio = "CS";
				$consorciado 				= trim(strtoupper($array_resposta["T023_DPJ_RAZAO_SOCIAL"]));
				$consorciado_endereco		= trim(strtoupper($array_resposta["T023_DPJ_ENDERECO"]));
				$consorciado_complemento	= trim(strtoupper($array_resposta["T023_DPJ_COMPLEMENTO"]));
				$consorciado_bairro			= trim(strtoupper($array_resposta["T023_DPJ_BAIRRO"]));
				$consorciado_cep			= trim($array_resposta["T023_DPJ_CEP"]);
				$consorciado_id_cidade		= $array_resposta["T023_DPJ_ID_CIDADE"];
				$consorciado_telefone		= trim($array_resposta["T023_DPJ_TELEFONE"]);
				$consorciado_dtnasc = "00000000";
			}
			if (!empty($consorciado_id_cidade) || ($consorciado_id_cidade!=0))  {
				$query_cidade_estado = " select * from t002_cidade where T002_ID = $consorciado_id_cidade ";
				$resposta_cidade_estado = mysql_query($query_cidade_estado,$conexao);
				$consorciado_cidade = trim(strtoupper(mysql_result($resposta_cidade_estado,0,"T002_DESCRICAO")));
				$consorciado_estado	= trim(mysql_result($resposta_cidade_estado,0,"T002_ID_ESTADO"));
			}
			
			// for ($x = strlen($contrato); $x < 26; $x++) $contrato = $contrato." ";
			for ($x = strlen($contrato); $x < 22; $x++) $contrato = $contrato." ";
			$consorciado = substr($consorciado,0,69);
			for ($x = strlen($consorciado); $x < 70; $x++) $consorciado = $consorciado." ";

			$consorciado_endereco = substr($consorciado_endereco,0,44);
			for ($x = strlen($consorciado_endereco); $x < 45; $x++) $consorciado_endereco = $consorciado_endereco." ";
			
			$consorciado_bairro = substr($consorciado_bairro,0,19);
			for ($x = strlen($consorciado_bairro); $x < 20; $x++) $consorciado_bairro = $consorciado_bairro." ";
			
			for ($x = strlen($consorciado_cep); $x < 8; $x++) $consorciado_cep = "0".$consorciado_cep;
			
			$consorciado_cidade = substr($consorciado_cidade,0,24);
			for ($x = strlen($consorciado_cidade); $x < 25; $x++) $consorciado_cidade = $consorciado_cidade." ";
						
			for ($x = strlen($cpf_cnpj); $x < 15; $x++) $cpf_cnpj = "0".$cpf_cnpj;
		
			for ($x = strlen($valor_negativar); $x < 15; $x++) $valor_negativar = "0".$valor_negativar;	
			$valor_debito = $valor_negativar;
			
			for ($x = strlen($contrato_nrs); $x < 16; $x++) $contrato_nrs = "0".$contrato_nrs;	
			
			//for ($x = strlen($qtde_parcela_negativar); $x < 3; $x++) $qtde_parcela_negativar = "0".$qtde_parcela_negativar;	
			//$nr_parcelas = $qtde_parcela_negativar;
			
			$contador2 = $contador;
			for ($x = strlen($contador2); $x < 7; $x++) $contador2 = "0".$contador2;	
			
			$brancos3 = " ";
			for ($x = strlen($brancos3); $x < 55; $x++) $brancos3 = $brancos3." ";
			$brancos4 = " ";
			for ($x = strlen($brancos4); $x < 140; $x++) $brancos4 = $brancos4." ";
			
			if ($tipoarquivo == "E") { $motivo_baixa = "02"; }
			else { $motivo_baixa = "00"; }
			
			if ($tipo_consorciado=="F") { $tipo_consorciado_cpf_cnpj = "2"; }
			else { $tipo_consorciado_cpf_cnpj = "1"; }
			
			
			if ($id_empresa == 58) {
				$cnpjconsorcio = "49937055000111GMAC ADMINISTRADORA DE CONSORCIO LTDA       ";
				$cod_id_serasa = "5016";
			} else {
				$cnpjconsorcio = "61074175000138MAPFRE SEGUROS GERAIS S.A.                  ";  // "49937055000111CONSORCIO NACIONAL CHEVROLET LTDA           ";
				$cod_id_serasa = "5015";
			}
			//	$cnpjconsorcio = "49937055000111CONSORCIO NACIONAL CHEVROLET LTDA           ";
			//	$cod_id_serasa = "5015";
			// $cnpjconsorcio = "47658539000104CONSORCIO NACIONAL VOLKSWAGEN ADMINISTRADORA";
			// $cod_id_serasa = "2004";
	
			
			$linha_conteudo = "1" . $tipoarquivo . "000127".$data_inadimplencia.$data_fim_contrato."C3     ".$tipo_consorciado.$tipo_consorciado_cpf_cnpj.$cpf_cnpj.$motivo_baixa.$brancos3.$consorciado.$consorciado_dtnasc.$brancos4 .
			$consorciado_endereco.$consorciado_bairro.$consorciado_cidade.$consorciado_estado.$consorciado_cep.$valor_debito.$contrato_nrs."000000000" . 
			"J10".$cnpjconsorcio."  ".$cod_id_serasa."                                                               " . $contador2 . "\r\n";
			
			
			if ($id_empresa == 58 && $id_avalista <> 0) {
				
				$query_busca_avalista = " select * from t027_avalista where T027_ID = '$id_avalista'  and TRIM(T027_DA_CPF) <> '' and TRIM(T027_DA_NOME) <> '' ";
				$resposta_busca_avalista = mysql_query($query_busca_avalista,$conexao) or die ('MySQL Erro: ' . mysql_error() . " #1 > $query_busca");
					
				if (mysql_num_rows($resposta_busca_avalista) > 0) {

					$av_tp_pessoa = "F"; $av_tp_cpf_cnpj = "2"; $av_dtnasc = "00000000";
					$av_cpf_cnpj = trim(strtoupper(mysql_result($resposta_busca_avalista, 0, "T027_DA_CPF")));
					$av_nome = trim(strtoupper(mysql_result($resposta_busca_avalista, 0, "T027_DA_NOME")));
					$av_endereco = trim(strtoupper(mysql_result($resposta_busca_avalista, 0, "T027_DA_ENDERECO")));
					$av_complemento = trim(strtoupper(mysql_result($resposta_busca_avalista, 0, "T027_DA_COMPLEMENTO")));
					$av_bairro = trim(strtoupper(mysql_result($resposta_busca_avalista, 0, "T027_DA_BAIRRO")));
					$av_cep = trim(mysql_result($resposta_busca_avalista, 0, "T027_DA_CEP"));
					$av_id_cidade = mysql_result($resposta_busca_avalista, 0, "T027_DA_ID_CIDADE");

					if (!empty($av_id_cidade) || ($av_id_cidade!=0))  {
						$query_cidade_estado = " select * from t002_cidade where T002_ID = $av_id_cidade ";
						$resposta_cidade_estado = mysql_query($query_cidade_estado,$conexao);
						$av_cidade = trim(strtoupper(mysql_result($resposta_cidade_estado,0,"T002_DESCRICAO")));
						$av_estado	= trim(mysql_result($resposta_cidade_estado,0,"T002_ID_ESTADO"));
					}
					
					for ($x = strlen($av_cpf_cnpj); $x < 15; $x++) $av_cpf_cnpj = "0".$av_cpf_cnpj;
					$av_nome = substr($av_nome,0,69);
					for ($x = strlen($av_nome); $x < 70; $x++) $av_nome = $av_nome." ";
					$av_endereco = substr($av_endereco,0,44);
					for ($x = strlen($av_endereco); $x < 45; $x++) $av_endereco = $av_endereco." ";
					$av_bairro = substr($av_bairro,0,19);
					for ($x = strlen($av_bairro); $x < 20; $x++) $av_bairro = $av_bairro." ";
					for ($x = strlen($av_cep); $x < 8; $x++) $av_cep = "0".$av_cep;
					$av_cidade = substr($av_cidade,0,24);
					for ($x = strlen($av_cidade); $x < 25; $x++) $av_cidade = $av_cidade." ";
					
					$contador++;
					$contador2 = $contador;
					for ($x = strlen($contador2); $x < 7; $x++) $contador2 = "0".$contador2;
						
					$linha_conteudo = $linha_conteudo . "1" . $tipoarquivo . "000127".$data_inadimplencia.$data_fim_contrato."C3     ".$av_tp_pessoa.$av_tp_cpf_cnpj.$av_cpf_cnpj.$motivo_baixa.$brancos3.$av_nome.$av_dtnasc.$brancos4 .
					$av_endereco.$av_bairro.$av_cidade.$av_estado.$av_cep.$valor_debito.$contrato_nrs."000000000" . 
					"J10".$cnpjconsorcio."  ".$cod_id_serasa."                                                               " . $contador2 . "\r\n";				
				
				}

			}
			
			if (!fwrite($abrir, $linha_conteudo)) {
				$msg_sistema_erro .= "Erro de gravação dos dados no arquivo ($arquivo)<br>";

			} 		
			
		}

		$contador++;
		$contador2 = $contador;
		for ($x = strlen($contador2); $x < 7; $x++) $contador2 = "0".$contador2;	
					
		$brancos_2 = " ";
		for ($x = strlen($brancos_2); $x < 592; $x++) $brancos_2 = $brancos_2." ";	
		$linha_final = "9".$brancos_2.$contador2."\r\n";

		if (!fwrite($abrir, $linha_final)) {
			$msg_sistema_erro = "Erro de gravação dos dados no arquivo ($arquivo)";
		} 

		fclose($abrir);
		
		// header("location:$arquivo");
		header("Content-type: application/save");
		header('Content-Disposition: attachment; filename="' . basename($arquivo) . '"');
		header('Expires: 0');
		header('Pragma: no-cache');
		readfile("$arquivo");
		unlink($arquivo);
		exit;
		
	}

}

?>
<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN" "http://www.w3.org/TR/html4/loose.dtd">
<html><!-- InstanceBegin template="/Templates/template3.dwt.php" codeOutsideHTMLIsLocked="false" -->
<head>
<!-- InstanceBeginEditable name="doctitle" -->
<title>Jo&atilde;o Barbosa Assessoria Juridica :: </title>
<!-- InstanceEndEditable -->
<meta http-equiv="Content-Type" content="text/html; charset=iso-8859-1">
<!-- InstanceBeginEditable name="head" -->
<!-- InstanceEndEditable -->

<script type="text/javascript" src="sistema.funcoes.js"></script>
<script type="text/javascript" src="sistema.jsdomenu.js"></script>
<script type="text/javascript" src="sistema.jsdomenubar.js"></script>
<script type="text/javascript" src="sistema.menu.js"></script>

</head>

<link rel="stylesheet" type="text/css" href="sistema.estilo.menu.css" />
<link rel="stylesheet" type="text/css" href="sistema.estilos.css" />

<body onload="initjsDOMenu()">
<!-- InstanceBeginEditable name="EditRegion3" -->
<table width="780" border="0" align="center" cellpadding="0" cellspacing="0" background="img/fundo.gif">
  <tr>
    <td width="800"><? include 'sistema.cabecalho.php'; ?></td>
  </tr>
  <tr>
    <td><? include 'sistema.usuario.php'; ?></td>
  </tr>
  <tr>
    <td><? include 'sistema.menu.php'; ?></td>
  </tr>
  <tr>
    <td><? include 'sistema.mensagem.php'; ?></td>
  </tr>
  <tr>
    <td><table width="400" border="1" align="center" cellpadding="0" cellspacing="0" bordercolor="#000000" bgcolor="#CCE6FF">
      <tr>
        <td><table width="400" border="0" align="center" cellpadding="3" cellspacing="3">
          <form action="<?= $PHP_SELF; ?>" method="post" id="geracao" name="geracao">
            <tr>
              <td colspan="2" class="titulos"><div align="center">Gerar Arquivo de <? if ($tipoarquivo=="I") { echo "Inclusão"; } else if ($tipoarquivo=="E") { echo "Exclusão"; } ?> Negativa&ccedil;&atilde;o SERASA</div></td>
            </tr>
            <tr>
              <td>&nbsp;</td>
              <td>&nbsp;</td>
            </tr>
			<tr bgcolor="#CCE6FF">
				<td width="98"><div align="right">Cons&oacute;rcio:</div></td>
				<td width="281"><div align="left">
					<select name="consorcio" id="consorcio" class="campos">
						<option value="2">VOLKS</option>
						<option value="4">GM</option>
					  </select><script language='javascript'>Ajustar_Combo(this.geracao.consorcio, "<? echo $consorcio; ?>"  )</script>
				</td>
		    </tr>
            <tr>
              <td width="98"><div align="right">Data:&nbsp;</div></td>
              <td width="281"><div align="left">
                <input name="data_inicio" type="text" class="campos" id="data_inicio" OnBlur="Valida_Data(this)" OnKeyDown="Formata_Data(this)" value="<?= $data_inicio; ?>" size="12" maxlength="10">
e
<input name="data_fim" type="text" class="campos" id="data_fim" OnBlur="Valida_Data(this)" OnKeyDown="Formata_Data(this)" value="<?= $data_fim; ?>" size="12" maxlength="10">
              </div></td>
            </tr>
            <tr>
              <td colspan="2">&nbsp;</td>
            </tr>
            <tr>
              <td colspan="2"><div align="center">
                  <input name="tipoarquivo" type="hidden" id="tipoarquivo" value="<?= $tipoarquivo; ?>">
                  <input name="acao" type="hidden" id="acao" value="gerar_arquivo">
                  <input name="ok" type="submit" id="ok" value="Gerar Arquivo" class="campos">
              </div></td>
            </tr>
          </form>
        </table></td>
      </tr>
    </table>    </td>
  </tr>
  <tr>
    <td><? include 'sistema.rodape.php'; ?></td>
  </tr>
</table>
<!-- InstanceEndEditable -->
</body>
<!-- InstanceEnd --></html>