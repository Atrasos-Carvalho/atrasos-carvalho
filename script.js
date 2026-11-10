const API_URL = "https://ms-atrasos-carvalho.onrender.com";
// Altere este número para ajustar o total de dias da apuração.
const TOTAL_DIAS = 111;
let contagensAtualizadas = { noHorario: 0, atrasos: 0, faltas: 0 };

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
  largura("lateMeter", percentualAtrasos);
  largura("onTimeMeter", percentualNoHorario);
  preencherMoldura("lateAvatar", percentualAtrasos);
  preencherMoldura("onTimeAvatar", percentualNoHorario);

  const diferenca = atrasos - noHorario;
  const vencedor = validos > 0 && Math.abs(diferenca) > diasRestantes
    ? (diferenca > 0 ? "late" : "onTime")
    : null;
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
