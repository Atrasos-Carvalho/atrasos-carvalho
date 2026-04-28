function registrar(tipo) {
  if (tipo == "popHorario") {
    popupH = document.getElementById("popHorario");
    popupH.style.marginLeft = "0";
    setTimeout(() => {
      popupH.style.marginLeft = "-700px";
    }, 3500);
  } else if (tipo == "popAtraso") {
    popupA = document.getElementById("popAtraso");
    popupA.style.marginLeft = "0";
    setTimeout(() => {
      popupA.style.marginLeft = "-700px";
    }, 3500);
  } else if (tipo == "popFalta") {
    popupF = document.getElementById("popFalta");
    popupF.style.marginLeft = "0";
    setTimeout(() => {
      popupF.style.marginLeft = "-700px";
    }, 3500);
  }
}
