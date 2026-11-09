(function () {
  var KEY = "redup_rules_v1";
  var root = document.documentElement;
  var gate = document.getElementById("rulesGate");
  if (!gate) return;
  var pages = gate.querySelectorAll(".rules-page");
  var dots = gate.querySelectorAll(".rules-dot");
  var age = document.getElementById("rulesAge");
  var agree = document.getElementById("rulesAgree");
  var accept = document.getElementById("rulesAccept");
  var next = document.getElementById("rulesNext");
  var back = document.getElementById("rulesBack");
  var open = document.getElementById("rulesOpen");

  function accepted() {
    try { return localStorage.getItem(KEY) === "1"; } catch (e) { return false; }
  }
  function show(n) {
    pages.forEach(function (p) { p.hidden = p.getAttribute("data-page") !== String(n); });
    dots.forEach(function (d, i) { d.classList.toggle("active", i === n - 1); });
    var card = gate.querySelector(".rules-card");
    if (card) card.scrollTop = 0;
  }
  function update() {
    accept.disabled = !(age.checked && agree.checked);
  }
  function openGate() {
    show(1);
    var ok = accepted();
    age.checked = ok;
    agree.checked = ok;
    update();
    gate.classList.add("open");
    root.classList.add("rules-open");
    if (next) next.focus();
  }
  function closeGate() {
    gate.classList.remove("open");
    root.classList.remove("rules-pending", "rules-open");
  }

  next.addEventListener("click", function () { show(2); });
  back.addEventListener("click", function () { show(1); });
  age.addEventListener("change", update);
  agree.addEventListener("change", update);
  accept.addEventListener("click", function () {
    if (accept.disabled) return;
    try { localStorage.setItem(KEY, "1"); } catch (e) {}
    closeGate();
  });
  if (open) {
    open.addEventListener("click", function (event) {
      event.preventDefault();
      openGate();
    });
  }
  if (!accepted()) openGate();
})();
