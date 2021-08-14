class gas_calculator {
  constructor() {
    this.ph_status_text,
      this.status_text,
      this.compensate_item,
      this.actual_value,
      this.adjusted_value,
      this.ag,
      this.adjusted_hco3;
    this.is_ag_computable = false;
    this.is_acidemia = this.is_alkaremia = false;
    this.is_metabolic_acidosis =
      this.is_respiratory_acidosis =
      this.is_metabolic_alkarosis =
      this.is_respiratory_alkarosis =
        false;
    this.is_ag_high = false;
    this.is_compensate_correct = false;
    this.compensate_status_text = "";
    this.is_unable_to_judge = false;
    this.progress = document.getElementById("progress").value;
    this.ph = Number(document.getElementById("pH").value);
    this.paco2 = Number(document.getElementById("PaCO2").value);
    this.hco3 = Number(document.getElementById("HCO3-").value);
    this.na = Number(document.getElementById("Na").value);
    this.cl = Number(document.getElementById("Cl").value);
    this.alb = Number(document.getElementById("Alb").value);
  }

  judge_ph() {
    if (this.ph <= 7.35) {
      this.ph_status_text = "アシデミア";
      this.is_acidemia = true;
    } else if (this.ph >= 7.45) {
      this.ph_status_text = "アルカレミア";
      this.is_alkaremia = true;
    } else {
      this.ph_status_text = "正常";
    }
  }

  judge_compensate_status() {
    if (this.actual_value < this.adjusted_value - 2) {
      // 予測値より低い
      if (this.compensate_item === "PaCO2") {
        this.compensate_status_text = "呼吸性アルカローシス";
        this.is_respiratory_alkarosis = true;
      } else {
        this.compensate_status_text = "代謝性アシドーシス";
        this.is_metabolic_acidosis = true;
      }
    } else if (this.actual_value > this.adjusted_value + 2) {
      // 予測値より高い
      if (this.compensate_item === "PaCO2") {
        this.compensate_status_text = "呼吸性アシドーシス";
        this.is_respiratory_acidosis = true;
      } else {
        this.compensate_status_text = "代謝性アルカローシス";
        this.is_metabolic_alkarosis = true;
      }
    } else {
      // 正常
      this.is_compensate_correct = true;
    }
  }

  create_compensate_text() {
    this.judge_compensate_status();
    var res = `<b>代償</b>: ${this.compensate_item} ${Math.round(
      this.adjusted_value
    )} (実測 ${this.compensate_item}: ${this.actual_value}) -> 代償は <b>${
      this.is_compensate_correct
        ? "適切"
        : `不適切: ${this.compensate_status_text} が存在`
    }</b>`;
    return res;
  }

  create_ag_text() {
    if (this.ag > 14) return "開大性 = AG 開大性代謝性アシドーシス";
    else if (this.is_metabolic_acidosis) {
      return "非開大性 = AG 正常性代謝性アシドーシス (高 Cl 性代謝性アシドーシス)";
    } else {
      return "非開大性";
    }
  }

  calc_ag() {
    this.ag = this.na - this.cl - this.hco3;
    if (this.alb !== "" && this.alb !== 0) {
      if (this.alb < 4) {
        this.ag += 2.5 * (4 - this.alb);
      }
    }
    if (this.ag >= 14) {
      this.is_ag_high = true;
      this.adjusted_hco3 = this.hco3 + this.ag - 12;
    }
  }

  metabolic_acidosis() {
    this.is_metabolic_acidosis = true;
    this.status_text = "代謝性アシドーシス";
    this.compensate_item = "PaCO2";
    this.actual_value = this.paco2;
    this.adjusted_value = 40 - (24 - this.hco3) * 1.2;
  }

  respiratory_acidosis() {
    this.is_respiratory_acidosis = true;
    this.status_text = "呼吸性アシドーシス";
    this.compensate_item = "HCO3-";
    this.actual_value = this.hco3;
    var ratio = this.progress === "acute" ? 0.1 : 0.35;
    this.adjusted_value = 24 + (this.paco2 - 40) * ratio;
  }

  metabolic_alkarosis() {
    this.is_metabolic_alkarosis = true;
    this.status_text = "代謝性アルカローシス";
    this.compensate_item = "PaCO2";
    this.actual_value = this.paco2;
    this.adjusted_value = 40 + (this.hco3 - 24) * 0.7;
  }

  respiratory_alkarosis() {
    this.is_respiratory_alkarosis = true;
    this.status_text = "呼吸性アルカローシス";
    this.compensate_item = "HCO3-";
    this.actual_value = this.hco3;
    var ratio = this.progress === "acute" ? 0.2 : 0.5;
    this.adjusted_value = 24 - (40 - this.paco2) * ratio;
  }

  quit_judge(text) {
    document.getElementById("result").innerHTML = text;
    this.is_unable_to_judge = true;
    update_diagnosis(this);
  }
}

function update() {
  var result = "<b>計算結果</b><br>";
  var obj = new gas_calculator();
  if (
    obj.ph === "" ||
    obj.paco2 === "" ||
    obj.hco3 === "" ||
    obj.ph === 0 ||
    obj.paco2 === 0 ||
    obj.hco3 === 0
  ) {
    obj.quit_judge("未入力の項目があります");
    return;
  }
  result += "<ul>";
  obj.judge_ph();
  if (obj.na !== "" && obj.cl !== "" && obj.na !== 0 && obj.cl !== 0) {
    obj.is_ag_computable = true;
    obj.calc_ag();
  }

  if (obj.is_acidemia) {
    if (obj.hco3 < 24) obj.metabolic_acidosis();
    if (obj.paco2 > 40) obj.respiratory_acidosis();
    if (obj.hco3 >= 24 && obj.paco2 <= 40) {
      obj.quit_judge("判定不能です。入力内容を再度ご確認ください。");
      return;
    }
  } else if (obj.is_alkaremia) {
    if (obj.hco3 > 24) obj.metabolic_alkarosis();
    if (obj.paco2 < 40) obj.respiratory_alkarosis();
    if (obj.hco3 <= 24 && obj.paco2 >= 40) {
      obj.quit_judge("判定不能です。入力内容を再度ご確認ください。");
      return;
    }
  } else if (obj.is_ag_high) {
    // PH が正常でも、AG 開大しているなら代謝性アシドーシスがある
    obj.metabolic_acidosis();
  }

  var arr = [`<b>pH の確認</b>: ${obj.ph_status_text}`];

  if (obj.is_acidemia || obj.is_alkaremia) {
    arr.push(`<b>呼吸性か代謝性か</b>: ${obj.status_text}`);
    arr.push(obj.create_compensate_text());
  }

  if (obj.is_ag_computable)
    arr.push(`<b>AG</b>: ${obj.ag} -> <b>${obj.create_ag_text()}</b>`);
  if (obj.is_ag_high) {
    // pH 上アシデミアはないが、AG 開大がある場合の代償を計算する
    if (!obj.is_acidemia) arr.push(obj.create_compensate_text());
    // 補正 HCO3- を計算
    arr.push(
      `<b>補正 HCO3-</b>: ${obj.adjusted_hco3} ${
        obj.adjusted_hco3 >= 26
          ? "-> <b>代謝性アルカローシスの合併あり</b>"
          : ""
      }`
    );
    if (obj.adjusted_hco3 >= 26) obj.is_metabolic_alkarosis = true;
  }

  arr.forEach((e) => {
    result += `<li>${e}</li>`;
  });
  result += "</ul>";
  document.getElementById("result").innerHTML = result;
  update_diagnosis(obj);
}

function update_diagnosis(obj) {
  if (obj.is_unable_to_judge) {
    document.getElementById("diagnosis").innerHTML = "";
    return;
  }
  var diagnosis = "<b>鑑別</b>";
  if (obj.is_metabolic_acidosis) {
    if (!obj.is_ag_computable) {
      diagnosis += metabolic_acidosis_ag_normal + metabolic_acidosis_ag_high;
    } else if (!obj.is_ag_high) {
      diagnosis += metabolic_acidosis_ag_normal;
    } else {
      diagnosis += metabolic_acidosis_ag_high;
    }
  }
  if (obj.is_metabolic_alkarosis) {
    diagnosis += metabolic_alkarosis;
  }
  if (obj.is_respiratory_acidosis) {
    diagnosis += respiratory_acidosis;
  }
  if (obj.is_respiratory_alkarosis) {
    diagnosis += respiratory_alkarosis;
  }
  document.getElementById("diagnosis").innerHTML = diagnosis;
}

var metabolic_acidosis_ag_normal = `<details>
<summary>AG 正常性代謝性アシドーシス</summary>
HARD-UP のゴロ合わせで覚える。現実的に最も考えやすいのは下痢と尿酸性化障害 (RTA, 腎不全初期)。<ul>
<li>Hyperalimentation (過栄養)</li>
<li>Acetazoramide (アセタゾラミド): 利尿薬は低 K かつアルカローシスをきたすが、アセタゾラミドは例外。人工的に RTA II 型を起こしているようなもの。</li>
<li>Addison's disease (アジソン病) </li>
<li>Renal tubular acidosis (<b>尿細管性アシドーシス</b>): 例外的に低 K かつアシドーシス</li>
<li>Diarrhea (<b>下痢</b>): 例外的に低 K かつアシドーシス</li>
<li>Ureteroenteric fistula (尿腸管瘻)</li>
<li>Pancreatic fistula (膵液瘻)、parenteral saline (NaCl 大量補液)</li></ul></details>`;

var metabolic_acidosis_ag_high = `<details>
<summary>AG 開大性代謝性アシドーシス</summary>
KUSSMAL-P のゴロ合わせで覚える。<ul>
<li>Ketoasidosis (<b>ケトアシドーシス</b>)</li>
<li>Uremia (尿毒症、<b>腎不全</b>) </li>
<li>Salicylic acid (サリチル酸)</li>
<li>Sepsis</li>
<li>Methanol</li>
<li>Alcoholic, Aspirin intoxication (アルコール中毒、アスピリン中毒)</li>
<li>Lactic acidosis (<b>乳酸アシドーシス</b>。臓器虚血、けいれん発作後、VitB1 欠乏症に注意)</li>
<li>Paraldehyde (パラアルデヒド)</ul></details>`;

var metabolic_alkarosis = `<details>
<summary>代謝性アルカローシス</summary>
<b>尿 Cl < 20mEq のとき</b><ul>
<li>嘔吐 (Cl が口から出ている)。生理食塩水で改善。</li></ul>

<b>尿 Cl > 20mEq のとき</b><ul>
ABCD のゴロ合わせで覚える。尿から Cl が出ていってしまっている。</li>
<li>Aldosterone (アルドステロン症)</li>
<li>Bartter / Gitelman (低 Mg 血症を合併するよね)</li>
<li>Cushing</li>
<li>Depletion of Magnesium</ul></details>`;

var respiratory_acidosis = `<details>
<summary>呼吸性アシドーシス</summary><ul>
<li>急性: 上気道閉塞・喘息発作</li>
<li>慢性: COPD, 中枢神経抑制、神経筋疾患</li></ul></details>`;

var respiratory_alkarosis = `<details>
<summary>呼吸性アルカローシス</summary>
<li>急性: 低酸素血症・発熱・敗血症・過換気・薬物</li>
<li>慢性: 貧血・妊娠・庵不全・脳血管障害</li></ul></details>`;
