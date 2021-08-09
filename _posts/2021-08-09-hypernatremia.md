---
layout: post
title: 高 Na 血症
date: 2021-08-09
categories: [医学]
tags: [医学]
---

## 症状
- 軽症: 無気力・いらいら感
- 重症: 見当識障害・痙攣・昏睡 (Na > 150 で症状が出やすい)

## 治療
- 無症状で軽度なら飲水励行でよい
- 血管内脱水がありそう (低血圧、頻脈、腋窩・口腔内乾燥、ツルゴール低下) なときは外液投与。250mL/hr くらい？
- 血管内脱水がない or 落ち着いたときは、5% ブドウ糖液を投与。速度は下記参照
- 高 Na 血症では通常水が血管側に抜けて細胞は小さくなっているが、慢性の場合は細胞の大きさがある程度回復している場合も多い。なので、特に慢性の場合に急速に補正するのは脳浮腫のリスクを上げる

### 5% ブドウ糖液の投与速度計算
1. 水分欠乏量 $W$ [L] $=$ 体重 [kg] $\times 0.6 \times \frac{Na - 140}{140}$
2. 補正速度は
- 急性 (48 時間以内) なら 12mEq/L/day (0.50mEq/L)
- 慢性 (48 時間以上) なら 8mEq/L/day (0.33mEq/L)
- 発症時期不明の場合は慢性として考える。この場合、$T = \frac{Na - 140}{0.33}$ 時間かける。
3. 1 時間あたりの投与速度は $\frac{W}{T}$ [L/hr] となる。
4. これに、 1 日に必要な水分量 (1500mL, いつも 3 本回ししているノリで) = 62.5mL/hr を加える。

### 投与速度計算用フォーム
<div class="Form">
<div class="Form-Item">
<p class="Form-Item-Label">
<span class="Form-Item-Label-Required">必須</span>経過</p>
<select id="progress" class="Form-Item-Input" onKeyUp="update()">
<option value="chronic">慢性</option>
<option value="acute">急性</option>
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
<span class="Form-Item-Label-Required">必須</span>不感蒸泄分
</p>
<input type="number" class="Form-Item-Input" id="water-loss" value="1500" onKeyUp="update()">　mL
</div>

<div class="Form-Item">
<p class="Form-Item-Label"><span class="Form-Item-Label-Required">必須</span>血清 Na</p>
<input type="number" class="Form-Item-Input" id="Na" placeholder="140" onKeyUp="update()">　mEq
</div>

<p id="result"></p>
</div>

<script>
  function update() {
    var progress = document.getElementById("progress").value;
    var weight = Number(document.getElementById("weight").value);
    var na = Number(document.getElementById("Na").value);
    var wl = Number(document.getElementById("water-loss").value);
    var result = '<b>計算結果</b>';
    if (na === 0 || weight === 0) {
      result += "未入力の項目があります";
    } else {
      var W = weight * 0.6 * (na - 140) / 140;
      var speed = (progress === 'acute') ? 0.50 : 0.33;
      var T = (na - 140) / speed;
      var a = Math.round(1000 * W / T);
      var b = Math.round(wl / 24);
      result +=  `<ul><li>補正のための投与速度: ${a} mL/hr</li>
      <li>不感蒸泄分: ${b} mL/hr</li>
      <li><b>合計: ${a + b} mL/hr</b></li></ul>
      `;
    }
    document.getElementById("result").innerHTML = result;
  }
</script>

<link rel="stylesheet" type="text/css" href="../../assets/css/form.css" media="screen">


