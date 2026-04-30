function registrar(tipo) {
  if (tipo == "popHorario") {
    create(1).then(() => {
      popupH = document.getElementById("popHorario");
      popupH.style.marginLeft = "0";
      setTimeout(() => {
        popupH.style.marginLeft = "-700px";
      }, 3500);
    });
  } else if (tipo == "popAtraso") {
    create(2).then(() => {
      popupA = document.getElementById("popAtraso");
      popupA.style.marginLeft = "0";
      setTimeout(() => {
        popupA.style.marginLeft = "-700px";
      }, 3500);
    });
  } else if (tipo == "popFalta") {
    create(3).then(() => {
      popupF = document.getElementById("popFalta");
      popupF.style.marginLeft = "0";
      setTimeout(() => {
        popupF.style.marginLeft = "-700px";
      }, 3500);
    });
  }
}

async function create(id) {
  try {
    const res = await fetch(
      "https://ms-atrasos-carvalho.onrender.com/url/registros/create",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: id }),
      },
    );
  } catch (error) {
    console.error("Erro: ", error);
  }
}
