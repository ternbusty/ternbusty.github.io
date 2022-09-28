---
layout: post
title: 低 Na 血症
date: 2021-08-09
categories: [Medicine, Electrolytes]
tags: []
---

## 症状
- 軽症 (130-135)
- 中等症 (125-129): 悪心・混乱・頭痛
- 重症 (< 125): 嘔吐・心/呼吸器症状、痙攣、昏睡・昏迷

## 補正 Na の計算
### 蛋白・脂質高値のとき (偽性低 Na 血症)
- 補正後の値が基準範囲内であれば治療は必要ない。式を見れば分かるように、相当高くなっていなければ低 Na にはならないが……
- 血ガスではこれらの影響を受けないので注意。

$$
\mbox{補正 Na} = \mbox{Na} + \frac{\mbox{TG} - 100}{460} \\
\mbox{補正 Na} = \mbox{Na} + 1.2 \times (\mbox{TP} - 7)
$$

### 高血糖のとき (高浸透圧性低 Na 血症)
- 補正後の値が基準範囲内であれば治療は必要ない (高血糖の方をなんとかすべき)。
- 水が間質・血管に移動し、細胞は小さくなっている。グリセロール、マンニトールなど脳浮腫の治療でも同じことが起こるのは納得がいく。

$$
\mbox{補正 Na} = \mbox{Na} + 2 \times \frac{\mbox{Glu} - 100}{100}
$$

## 診断
1. 尿浸透圧が 100mOsm/kg であれば水中毒を疑う
   - 尿浸透圧は、尿浸透圧の下二桁 x 20-40 で計算できる (1.015 なら 300-600 mOsm/kg)
2. FENa の計算

$$
\mbox{FENa} = \frac{\mbox{尿中 Na} \times \mbox{血清 Cr}}{\mbox{血清 Na} \times \mbox{尿中 Cr}} \times 100
$$

FENa > 1% の場合は Na 排泄が亢進しているため、腎性を疑う。

## 治療
- 急性の低 Na では 8mEq/L/day (0.33mEq/L/hr) 以下、慢性ではさらに緩徐に補正を行う。
- Na < 125 未満でありかつ意識障害・痙攣・嘔吐などの重篤な症状がある場合は 3% 食塩水の適応となる。輸液ポンプを用いて 30mL/hr で開始し、1hr ごとに採血し 5mEq/L 程度上昇したら (およそ数時間) その後 24hr 補正を中止する。
- 上記の適応外の場合は生食か水制限による治療を行う。

### 補正速度の計算
- 輸液 1L 投与による血清 Na 上昇の予測式

$$
\mbox{血清 Na 上昇 [mEq/L]} = \frac{\mbox{輸液中 (Na + K)} - \mbox{血清 Na}}{\mbox{体重} \times 0.6 + 1}
$$

- 何もしなかった場合の 1h 後の血清 Na 上昇を尿所見で予測

$$
\mbox{血清 Na 上昇[mEq/L/hr]} = \frac{\mbox{血清 Na} \times 体重 \times 0.6 - \mbox{(尿中 Na + K)} \times \mbox{尿量}}{\mbox{体重} \times 0.6 - \mbox{尿量}} - \mbox{血清 Na}
$$

- 計算フォーム (Na 8mEq/L/day 上昇を目指す場合)

<div class="Form">
<div class="Form-Item">
<p class="Form-Item-Label"><span class="Form-Item-Label-Required">必須</span>血清 Na</p>
<input type="number" class="Form-Item-Input" id="Na" placeholder="140" onKeyUp="update()">　mEq
</div>

<div class="Form-Item">
<p class="Form-Item-Label"><span class="Form-Item-Label-Required">必須</span>投与輸液</p>
<select id="hydration" class="Form-Item-Input" oninput="update()">
<option value="3percent">3 % 食塩水</option>
<option value="saline">生理食塩水</option>
<option value="ringer">乳酸リンゲル</option>
</select>
</div>

<div class="Form-Item">
<p class="Form-Item-Label">
<span class="Form-Item-Label-Required">必須</span>体重
</p>
<input type="number" class="Form-Item-Input" id="weight" value="50" onKeyUp="update()">　kg
</div>

<div class="Form-Item">
<p class="Form-Item-Label">
尿量
</p>
<input type="number" class="Form-Item-Input" id="out" value="" onKeyUp="update()">　L
</div>

<div class="Form-Item">
<p class="Form-Item-Label">
尿中 Na
</p>
<input type="number" class="Form-Item-Input" id="outNa" value="" placeholder="50-300" onKeyUp="update()">　mEq/L
</div>

<div class="Form-Item">
<p class="Form-Item-Label">
尿中 K
</p>
<input type="number" class="Form-Item-Input" id="outK" value="" placeholder="12-130" onKeyUp="update()">　mEq/L
</div>

<p id="result"></p>
</div>

## 参考文献
- レジデントのためのこれだけ輸液, 佐藤弘明, 日本医事新報社, 2020

<script>
  function update() {
    var weight = Number(document.getElementById("weight").value);
    var na = Number(document.getElementById("Na").value);
    var hydration = document.getElementById("hydration").value;
    var out = Number(document.getElementById("out").value);
    var outNa = Number(document.getElementById("outNa").value);
    var outK = Number(document.getElementById("outK").value);
    var result = '<b>計算結果</b>';
    if (na === 0 || weight === 0) {
      result += ": 未入力の項目があります";
    } else {
      var inNa, inK;
      if (hydration === "3percent") {
        inNa = 510;
        inK = 0;
      } else if (hydration === "saline") {
        inNa = 154;
        inK = 0;
      } else {
        inNa = 131;
        inK = 4;
      }
      var fluid_volume = weight * 0.6;
      var up_by_hydration = ((inNa + inK) - na) / (fluid_volume + 1);
      var up_by_out_1_hour = 0;
      if (out * outNa * outK !== 0) {
         up_by_out_1_hour = (na * fluid_volume - (outNa + outK) * out) / (fluid_volume - out) - na;
      }
      var speed = (0.33 - up_by_out_1_hour) / up_by_hydration * 1000;
      var a = Math.round(up_by_hydration);
      var b = (up_by_out_1_hour !== 0) ? Math.round(up_by_out_1_hour * 100) / 100 + 'mL/hr': '未計算';
      var c = Math.round(speed);
      result +=  `<ul><li>輸液 1L による Na 上昇: ${a} mL/hr</li>
      <li>尿排泄による 1h 上昇分: ${b}</li>
      <li><b>投与スピード: ${c} mL/hr</b></li></ul>
      `;
    }
    document.getElementById("result").innerHTML = result;
  }
</script>

<link rel="stylesheet" type="text/css" href="../../assets/css/form.css" media="screen">

