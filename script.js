document.addEventListener("DOMContentLoaded", () => {
  fazerCounts();
});

async function registrar(tipo, id) {
  const sucesso = await create(id);

  if (!sucesso) return;

  const popup = document.getElementById(tipo);

  if (popup) {
    popup.style.marginLeft = "0";
    setTimeout(() => {
      popup.style.marginLeft = "-700px";
    }, 3500);
  }

  fazerCounts();
}

async function create(id) {
  try {
    const res = await axios.post(
      "https://ms-atrasos-carvalho.onrender.com/registros/create",
      { tipo_id: id },
    );
    return true;
  } catch (error) {
    if (error.response && error.response.status === 409) {
      const popupE = document.getElementById("popErro");
      popupE.style.marginLeft = "0";
      setTimeout(() => {
        popupE.style.marginLeft = "-700px";
      }, 3500);
    }
    console.error("Erro: ", error);
    return false;
  } 
}

async function getCount() {
  try {
    const res = await axios.get(
      "https://ms-atrasos-carvalho.onrender.com/registros/find-count",
    );

    return res.data;
  } catch (error) {
    console.error("Erro: ", error);
  }
}

function fazerCounts() {
  const hor = document.getElementById("horario");
  const atr = document.getElementById("atrasado");
  const fal = document.getElementById("falta");

  getCount().then(data => {
    if (data) {
      hor.textContent = data.total_cedo;
      atr.textContent = data.total_atraso;
      fal.textContent = data.total_falta;
    }
  });
}
