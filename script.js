const API_URL = "https://ms-atrasos-carvalho.onrender.com";
// Altere este número para ajustar o total de dias da apuração.
const TOTAL_DIAS = 110;
let contagensAtualizadas = { noHorario: 0, atrasos: 0, faltas: 0 };
let historicoAtual = null;

document.addEventListener("DOMContentLoaded", () => {
  atualizarTotalDiasNaTela();
  document.querySelectorAll(".nav-link").forEach(button => {
    button.addEventListener("click", () => abrirPagina(button.dataset.page));
  });
  fazerCounts();
});

function abrirPagina(pageId) {
  document.querySelectorAll(".page").forEach(page => {
    page.hidden = page.id !== pageId;
  });
  document.querySelectorAll(".nav-link").forEach(button => {
    const active = button.dataset.page === pageId;
    button.classList.toggle("active", active);
    button.setAttribute("aria-current", active ? "page" : "false");
  });
  if (pageId === "resultados") fazerCounts();
  if (pageId === "historico") carregarHistorico();
}

async function registrar(tipo, id) {
  const sucesso = await create(id);
  if (!sucesso) return;

  mostrarPopup(tipo);
  fazerCounts();
}

async function create(id) {
  try {
    await axios.post(`${API_URL}/registros/create`, { tipo_id: id });
    return true;
  } catch (error) {
    if (error.response && error.response.status === 409) mostrarPopup("popErro");
    console.error("Erro ao registrar:", error);
    return false;
  }
}

function mostrarPopup(id) {
  const popup = document.getElementById(id);
  if (!popup) return;
  popup.classList.add("show");
  window.setTimeout(() => popup.classList.remove("show"), 3500);
}

async function getCount() {
  const response = await axios.get(`${API_URL}/registros/find-count`);
  return response.data;
}

async function carregarHistorico() {
  const refreshButton = document.getElementById("refreshHistory");
  const emptyMessage = document.getElementById("historyEmpty");
  const chart = document.getElementById("historyChart");
  if (refreshButton) refreshButton.disabled = true;
  if (emptyMessage) {
    emptyMessage.hidden = false;
    emptyMessage.textContent = "Carregando histórico…";
  }
  if (chart) chart.setAttribute("hidden", "");

  try {
    const response = await axios.get(`${API_URL}/registros/find-all`, { timeout: 15000 });
    const registros = extrairRegistros(response.data);
    const historico = montarHistorico(registros);
    if (historico.datas.length === 0) {
      if (emptyMessage) emptyMessage.textContent = "Não há registros históricos disponíveis.";
      texto("historyRange", "0 dias com registro");
      return;
    }

    const ultimaData = historico.datas[historico.datas.length - 1];
    texto("historyRange", `${historico.datas.length} dias com registro · ${formatarData(historico.datas[0])} a ${formatarData(ultimaData)}`);
    if (historico.pontos.length === 0) {
      if (emptyMessage) emptyMessage.textContent = "Ainda não há votos válidos para desenhar a curva.";
      return;
    }

    desenharGraficoHistorico(historico);
    historicoAtual = historico;
    configurarTooltipHistorico();
    if (chart) chart.removeAttribute("hidden");
    if (emptyMessage) emptyMessage.hidden = true;
  } catch (error) {
    console.error("Erro ao buscar o histórico:", error);
    if (emptyMessage) emptyMessage.textContent = "Não foi possível carregar o histórico. Tente atualizar.";
    texto("historyRange", "Histórico indisponível");
  } finally {
    if (emptyMessage && !emptyMessage.hidden && emptyMessage.textContent === "Carregando histórico…") {
      emptyMessage.textContent = "O histórico não pôde ser exibido. Tente atualizar.";
    }
    if (refreshButton) refreshButton.disabled = false;
  }
}

function extrairRegistros(payload) {
  let dados = payload;
  if (typeof dados === "string") {
    try {
      dados = JSON.parse(dados);
    } catch {
      return [];
    }
  }
  if (Array.isArray(dados)) return dados;
  if (Array.isArray(dados?.registros)) return dados.registros;
  if (Array.isArray(dados?.data)) return dados.data;
  return [];
}

function montarHistorico(registros) {
  const porData = new Map();
  registros.forEach(registro => {
    const data = timestampDoRegistro(registro?.data ?? registro?.Data ?? registro?.date);
    if (data === null) return;
    const chave = new Date(data).toISOString().slice(0, 10);
    if (!porData.has(chave)) porData.set(chave, { data, noHorario: 0, atrasos: 0, faltas: 0 });
    const dia = porData.get(chave);
    const tipo = Number(registro?.tipo_id ?? registro?.tipoId ?? registro?.TipoID);
    if (tipo === 1) dia.noHorario += 1;
    if (tipo === 2) dia.atrasos += 1;
    if (tipo === 3) dia.faltas += 1;
  });

  const dias = [...porData.values()].sort((a, b) => a.data - b.data);
  let noHorarioAcumulado = 0;
  let atrasosAcumulados = 0;
  const pontos = [];
  dias.forEach(dia => {
    noHorarioAcumulado += dia.noHorario;
    atrasosAcumulados += dia.atrasos;
    const votosValidos = noHorarioAcumulado + atrasosAcumulados;
    if (!votosValidos) return;
    pontos.push({
      data: dia.data,
      atrasos: (atrasosAcumulados / votosValidos) * 100,
      noHorario: (noHorarioAcumulado / votosValidos) * 100,
    });
  });
  return { datas: dias.map(dia => dia.data), pontos };
}

function timestampDoRegistro(valor) {
  const correspondencia = String(valor ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!correspondencia) return null;
  const [, ano, mes, dia] = correspondencia;
  const timestamp = Date.UTC(Number(ano), Number(mes) - 1, Number(dia));
  return Number.isFinite(timestamp) ? timestamp : null;
}

function desenharGraficoHistorico(historico) {
  const plot = document.getElementById("historyPlot");
  const chartDesc = document.getElementById("historyChartDesc");
  if (!plot) return;
  plot.replaceChildren();

  const largura = 900;
  const margem = { esquerda: 72, direita: 26, topo: 28, base: 62 };
  const alturaGrafico = 430 - margem.topo - margem.base;
  const larguraGrafico = largura - margem.esquerda - margem.direita;
  const inicio = historico.datas[0];
  const fim = historico.datas[historico.datas.length - 1];
  const posicaoX = data => margem.esquerda + (fim === inicio ? 0.5 : (data - inicio) / (fim - inicio)) * larguraGrafico;
  const posicaoY = valor => margem.topo + ((100 - valor) / 100) * alturaGrafico;

  [0, 25, 50, 75, 100].forEach(valor => {
    const y = posicaoY(valor);
    criarElementoSvg(plot, "line", { x1: margem.esquerda, y1: y, x2: largura - margem.direita, y2: y, class: "history-gridline" });
    criarElementoSvg(plot, "text", { x: margem.esquerda - 12, y: y + 4, class: "history-y-label" }, `${valor}%`);
  });
  criarElementoSvg(plot, "line", { x1: margem.esquerda, y1: margem.topo, x2: margem.esquerda, y2: margem.topo + alturaGrafico, class: "history-axis-line" });
  criarElementoSvg(plot, "line", { x1: margem.esquerda, y1: margem.topo + alturaGrafico, x2: largura - margem.direita, y2: margem.topo + alturaGrafico, class: "history-axis-line" });

  const datasEixo = fim === inicio ? [inicio] : [inicio, inicio + (fim - inicio) / 2, fim];
  datasEixo.forEach(data => criarElementoSvg(plot, "text", { x: posicaoX(data), y: margem.topo + alturaGrafico + 28, class: "history-x-label" }, formatarDataCurta(data)));

  desenharSerie(plot, historico.pontos, "atrasos", "history-line-late", posicaoX, posicaoY);
  desenharSerie(plot, historico.pontos, "noHorario", "history-line-ontime", posicaoX, posicaoY);
  criarElementoSvg(plot, "line", { id: "historyHoverGuide", x1: 0, y1: margem.topo, x2: 0, y2: margem.topo + alturaGrafico, class: "history-hover-line", style: "display:none" });
  if (chartDesc) chartDesc.textContent = `A série mostra as porcentagens acumuladas após cada dia com votos válidos, entre ${formatarData(inicio)} e ${formatarData(fim)}.`;
}

function desenharSerie(plot, pontos, chave, classeLinha, posicaoX, posicaoY) {
  const caminho = pontos.map((ponto, indice) => `${indice === 0 ? "M" : "L"} ${posicaoX(ponto.data).toFixed(2)} ${posicaoY(ponto[chave]).toFixed(2)}`).join(" ");
  if (caminho) criarElementoSvg(plot, "path", { d: caminho, class: `history-line ${classeLinha}` });
  pontos.forEach(ponto => {
    const detalhes = `${formatarData(ponto.data)} — ATRASOS ${formatarPercentual(ponto.atrasos)} — NO HORÁRIO ${formatarPercentual(ponto.noHorario)}`;
    criarElementoSvg(plot, "circle", { cx: posicaoX(ponto.data), cy: posicaoY(ponto[chave]), r: 8, class: "history-hit-target", "aria-label": detalhes });
  });
}

function configurarTooltipHistorico() {
  const chart = document.getElementById("historyChart");
  if (!chart || chart.dataset.tooltipConfigurado === "true") return;
  chart.dataset.tooltipConfigurado = "true";
  chart.addEventListener("pointermove", mostrarTooltipHistorico);
  chart.addEventListener("pointerleave", esconderTooltipHistorico);
}

function mostrarTooltipHistorico(event) {
  if (!historicoAtual || historicoAtual.pontos.length === 0) return;
  const chart = document.getElementById("historyChart");
  const wrapper = document.querySelector(".history-chart-wrap");
  const tooltip = document.getElementById("historyTooltip");
  if (!chart || !wrapper || !tooltip) return;

  const chartBounds = chart.getBoundingClientRect();
  const wrapperBounds = wrapper.getBoundingClientRect();
  if (!chartBounds.width) return;
  const pointerX = ((event.clientX - chartBounds.left) / chartBounds.width) * 900;
  const firstDate = historicoAtual.datas[0];
  const lastDate = historicoAtual.datas[historicoAtual.datas.length - 1];
  const plotLeft = 72;
  const plotWidth = 900 - 72 - 26;
  const xForDate = date => plotLeft + (lastDate === firstDate ? 0.5 : (date - firstDate) / (lastDate - firstDate)) * plotWidth;
  const ponto = historicoAtual.pontos.reduce((maisProximo, atual) =>
    Math.abs(xForDate(atual.data) - pointerX) < Math.abs(xForDate(maisProximo.data) - pointerX) ? atual : maisProximo,
  );

  const guide = document.getElementById("historyHoverGuide");
  if (guide) {
    const x = xForDate(ponto.data);
    guide.setAttribute("x1", String(x));
    guide.setAttribute("x2", String(x));
    guide.style.display = "block";
  }

  tooltip.replaceChildren();
  const dataLabel = document.createElement("strong");
  dataLabel.textContent = formatarData(ponto.data);
  const classificacao = [
    { nome: "ATRASOS", percentual: ponto.atrasos, classe: "tooltip-late" },
    { nome: "NO HORÁRIO", percentual: ponto.noHorario, classe: "tooltip-ontime" },
  ].sort((a, b) => b.percentual - a.percentual);
  tooltip.append(dataLabel);
  classificacao.forEach(candidato => {
    const linha = document.createElement("span");
    linha.className = candidato.classe;
    linha.textContent = `● ${candidato.nome} ${formatarPercentual(candidato.percentual)}`;
    tooltip.append(linha);
  });
  tooltip.hidden = false;

  const left = event.clientX - wrapperBounds.left + 14;
  const top = event.clientY - wrapperBounds.top - tooltip.offsetHeight - 12;
  tooltip.style.left = `${Math.max(8, Math.min(left, wrapper.clientWidth - tooltip.offsetWidth - 8))}px`;
  tooltip.style.top = `${Math.max(8, top)}px`;
}

function esconderTooltipHistorico() {
  const tooltip = document.getElementById("historyTooltip");
  if (tooltip) tooltip.hidden = true;
  const guide = document.getElementById("historyHoverGuide");
  if (guide) guide.style.display = "none";
}

function criarElementoSvg(pai, tipo, atributos, textoSvg) {
  const elemento = document.createElementNS("http://www.w3.org/2000/svg", tipo);
  Object.entries(atributos).forEach(([chave, valor]) => elemento.setAttribute(chave, String(valor)));
  if (textoSvg !== undefined) elemento.textContent = textoSvg;
  pai.appendChild(elemento);
  return elemento;
}

function formatarData(timestamp) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(timestamp));
}

function formatarDataCurta(timestamp) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" }).format(new Date(timestamp));
}

async function fazerCounts() {
  const refreshButton = document.getElementById("refreshResults");
  if (refreshButton) refreshButton.disabled = true;

  try {
    const data = await getCount();
    contagensAtualizadas = {
      noHorario: numero(data?.total_cedo),
      atrasos: numero(data?.total_atraso),
      faltas: numero(data?.total_falta),
    };
    atualizarPlacar(contagensAtualizadas.noHorario, contagensAtualizadas.atrasos, contagensAtualizadas.faltas);
  } catch (error) {
    console.error("Erro ao buscar a apuração:", error);
    const updatedAt = document.getElementById("updatedAt");
    if (updatedAt) updatedAt.textContent = "Não foi possível atualizar";
  } finally {
    if (refreshButton) refreshButton.disabled = false;
  }
}

function numero(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function atualizarTotalDiasNaTela() {
  texto("headerTotalDays", `${TOTAL_DIAS} dias`);
  texto("totalDaysDisplay", TOTAL_DIAS);
  const progressBar = document.getElementById("progressBar");
  if (progressBar) progressBar.setAttribute("aria-valuemax", String(TOTAL_DIAS));
}

function atualizarPlacar(noHorario, atrasos, faltas) {
  const validos = noHorario + atrasos;
  const totalRegistros = validos + faltas;
  const apurados = Math.min(totalRegistros, TOTAL_DIAS);
  const diasRestantes = Math.max(0, TOTAL_DIAS - apurados);
  const percentualApurado = (apurados / TOTAL_DIAS) * 100;
  const percentualAtrasos = validos ? (atrasos / validos) * 100 : 0;
  const percentualNoHorario = validos ? (noHorario / validos) * 100 : 0;
  const percentualFaltas = totalRegistros ? (faltas / totalRegistros) * 100 : 0;

  texto("horario", noHorario);
  texto("atrasado", atrasos);
  texto("falta", faltas);
  texto("diasApurados", apurados);
  texto("totalRegistros", totalRegistros);
  texto("validVotes", validos);
  texto("lateVotes", atrasos);
  texto("onTimeVotes", noHorario);
  texto("absenceVotes", faltas);
  texto("lateVotesCard", atrasos);
  texto("onTimeVotesCard", noHorario);
  texto("latePercent", formatarPercentual(percentualAtrasos));
  texto("onTimePercent", formatarPercentual(percentualNoHorario));
  texto("progressLabel", `${formatarPercentual(percentualApurado)} apurado`);
  texto("updatedAt", new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "medium" }).format(new Date()));

  const progressFill = document.getElementById("progressFill");
  if (progressFill) progressFill.style.width = `${percentualApurado}%`;
  const progressBar = document.getElementById("progressBar");
  if (progressBar) {
    progressBar.setAttribute("aria-valuenow", String(apurados));
    progressBar.setAttribute("aria-valuemax", String(TOTAL_DIAS));
  }
  largura("lateSegment", validos ? (atrasos / totalRegistros) * 100 : 0);
  largura("onTimeSegment", validos ? (noHorario / totalRegistros) * 100 : 0);
  largura("absenceSegment", percentualFaltas);
  preencherMoldura("lateAvatar", percentualAtrasos);
  preencherMoldura("onTimeAvatar", percentualNoHorario);

  const diferenca = atrasos - noHorario;
  const vencedor = validos > 0 && Math.abs(diferenca) > diasRestantes
    ? (diferenca > 0 ? "late" : "onTime")
    : null;
  const candidateGrid = document.getElementById("candidateGrid");
  if (candidateGrid) {
    candidateGrid.classList.toggle("has-winner", vencedor !== null);
    candidateGrid.classList.toggle("winner-late", vencedor === "late");
    candidateGrid.classList.toggle("winner-on-time", vencedor === "onTime");
  }
  const empateFinal = diasRestantes === 0 && diferenca === 0;
  const statusAtrasos = vencedor ? (vencedor === "late" ? "Eleito" : "Não eleito") : empateFinal ? "Empate" : "";
  const statusNoHorario = vencedor ? (vencedor === "onTime" ? "Eleito" : "Não eleito") : empateFinal ? "Empate" : "";
  atualizarCandidato("candidateLate", "lateStatus", vencedor === "late", statusAtrasos);
  atualizarCandidato("candidateOnTime", "onTimeStatus", vencedor === "onTime", statusNoHorario);
  texto("electionRule", vencedor
    ? `${vencedor === "late" ? "ATRASOS" : "NO HORÁRIO"} está eleito matematicamente: a vantagem de ${Math.abs(diferenca)} voto(s) supera os ${diasRestantes} dias restantes. Faltas são abstenções e não entram no cálculo.`
    : empateFinal
      ? "Apuração encerrada em empate. Nenhum candidato foi eleito."
      : `Em apuração: faltam ${diasRestantes} dias. A liderança de ${Math.abs(diferenca)} voto(s) ainda pode mudar; faltas são abstenções.`);
}

function atualizarCandidato(cardId, statusId, elected, statusText) {
  const card = document.getElementById(cardId);
  if (card) {
    card.classList.toggle("is-elected", elected);
    card.classList.toggle("is-not-elected", statusText === "Não eleito");
  }
  texto(statusId, statusText);
}

function texto(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = String(value);
}

function largura(id, percent) {
  const element = document.getElementById(id);
  if (element) element.style.width = `${Math.max(0, Math.min(percent, 100))}%`;
}

function preencherMoldura(id, percent) {
  const avatar = document.getElementById(id);
  if (avatar) avatar.style.setProperty("--vote-angle", `${Math.max(0, Math.min(percent, 100)) * 3.6}deg`);
}

function formatarPercentual(value) {
  return `${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}
