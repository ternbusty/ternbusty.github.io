class status_container {
  constructor() {
    this.metabolic_acidosis = false;
    this.metabolic_alkarosis = false;
    this.respiratory_acidosis = false;
    this.respiratory_alkarosis = false;
  }
}

function judge_ph(ph) {
  var res;
  if (ph <= 7.35) {
    res = "アシデミア";
    ph_change_flag = true;
  } else if (ph >= 7.45) {
    res = "アルカレミア";
    ph_change_flag = true;
  } else {
    res = "正常";
  }
  return res;
}

function reverse_respiratory_metabolic(status_text) {
  var res;
  if (status_text.match(/呼吸性/)) {
    res = status_text.replace("呼吸性", "代謝性");
  } else {
    res = status_text.replace("代謝性", "呼吸性");
  }
  return res;
}

function update() {
  var progress = document.getElementById("progress").value;
  var ph = Number(document.getElementById("pH").value);
  var paco2 = Number(document.getElementById("PaCO2").value);
  var hco3 = Number(document.getElementById("HCO3-").value);
  var na = Number(document.getElementById("Na").value);
  var cl = Number(document.getElementById("Cl").value);
  var alb = Number(document.getElementById("Alb").value);
  var result = "";

  var obj = status_container();

  if (
    ph === "" ||
    paco2 === "" ||
    hco3 === "" ||
    ph === 0 ||
    paco2 === 0 ||
    hco3 === 0
  ) {
    result += "未入力の項目があります";
    document.getElementById("result").innerHTML = result;
    return;
  }
  result += "<ul>";
  var acidemia_or_alkalemia = judge_ph(ph);
  var status_text,
    compensate_item,
    actual_value,
    adjusted_value,
    is_compensate_enough;
  if (acidemia_or_alkalemia === "アシデミア") {
    if (hco3 < 24) {
      status_text = "代謝性アシドーシス";
      compensate_item = "PaCO2";
      actual_value = paco2;
      adjusted_value = 40 - (24 - hco3) * 1.2;
    }
    if (paco2 > 40) {
      status_text = "呼吸性アシドーシス";
      compensate_item = "HCO3-";
      actual_value = hco3;
      var ratio = progress === "acute" ? 0.1 : 0.35;
      adjusted_value = 24 + (paco2 - 40) * ratio;
    }
  }
  if (acidemia_or_alkalemia === "アルカレミア") {
    if (hco3 > 24) {
      status_text = "代謝性アルカローシス";
      compensate_item = "PaCO2";
      actual_value = paco2;
      adjusted_value = 40 + (hco3 - 24) * 0.7;
    }
    if (paco2 < 40) {
      status_text = "呼吸性アルカローシス";
      compensate_item = "HCO3-";
      actual_value = hco3;
      var ratio = progress === "acute" ? 0.2 : 0.5;
      adjusted_value = 24 - (40 - paco2) * ratio;
    }
  }

  var is_compensate_enough =
    actual_value < adjusted_value - 2 || adjusted_value + 2 < actual_value
      ? `不適切: ${reverse_respiratory_metabolic(status_text)} が存在`
      : "適切";
  var arr = [`<b>pH の確認</b>: ${acidemia_or_alkalemia}`];
  if (acidemia_or_alkalemia !== "正常") {
    arr.push(`<b>呼吸性か代謝性か</b>: ${status_text}`);
    arr.push(
      `<b>代償されていれば</b>: ${compensate_item} ${Math.round(
        adjusted_value
      )} (実測 ${compensate_item}: ${actual_value}) -> 代償は <b>${is_compensate_enough}</b>`
    );
  }

  if (na !== "" && cl !== "" && na !== 0 && cl !== 0) {
    var ag = na - cl - hco3;
    if (alb !== "" && alb !== 0) {
      if (alb < 4) {
        ag += 2.5 * (4 - alb);
      }
    }
    var anion_gap_status;
    if (ag > 14) anion_gap_status = "開大性 = AG 開大性代謝性アシドーシス";
    else if (status_text === "代謝性アシドーシス") {
      anion_gap_status =
        "非開大性 = AG 正常性代謝性アシドーシス (高 Cl 性代謝性アシドーシス)";
    } else {
      anion_gap_status = "非開大性";
    }
    arr.push(`<b>AG</b>: ${ag} -> <b>${anion_gap_status}</b>`);
    if (ag > 14) {
      var adjusted_hco3 = hco3 + ag - 12;
      arr.push(
        `<b>補正 HCO3-</b>: ${adjusted_hco3} ${
          adjusted_hco3 >= 26
            ? "-> <b>代謝性アルカローシスの合併症あり</b>"
            : ""
        }`
      );
    }
  }

  arr.forEach((e) => {
    result += `<li>${e}</li>`;
  });
  result += "</ul>";
  document.getElementById("result").innerHTML = result;
}


