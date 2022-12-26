---
layout: post
title: Modified Pomodoro Technique
date: 2022-12-26
categories: [Technology, Web]
tags: [JavaScript, Product]
---

<audio id="audio"></audio>

<div id="buttons">
<input id="switch_mode_button" type="button" value="Start Working" onclick="switch_mode()">
<input id="take_lunch_button" type="button" value="Take a 30 min break" onclick="take_lunch()">
</div>

<div id="forms">
<h2>Work Timer</h2>
<form name="work_timer">
<input type="number" value=0 readonly>:<input type="number" value=25 readonly>:<input type="number" value=0 readonly>
<!-- <input id="working_hour" value=0>hour<input id="working_min" value=25>min<input id="working_sec" value=0>sec -->
</form>

<h2>Rest Timer</h2>
<form name="rest_timer">
<input type="number" value=0 readonly>:<input type="number" value=0 readonly>:<input type="number" value=0 readonly>
<!-- <input id="rest_hour" value=0>hour<input id="rest_min" value=0>min<input id="rest_sec" value=0>sec -->
</form>

<h2>Total Working Time</h2>
<form name="total_working_timer">
<input type="number" value=0 readonly>:<input type="number" value=0 readonly>:<input type="number" value=0 readonly>
<!-- <input id="rest_hour" value=0>hour<input id="rest_min" value=0>min<input id="rest_sec" value=0>sec -->
</form>
</div>

<script type="text/javascript" src="./assets/js/timer.js"></script>

<style>
input {
  border: none;
}

form {
  font-size: 5vmax;
  color: gray;
}

input[type="number"] {
  /* width: 200px; */
  width: 28%;
  background: none;
  /* font-size: 100px; */
  font-size: 4vmax;
  text-align: center;
}

input[type="button"] {
  /* width: 45%; */
  width: 300px;
  max-width: 90%;
  margin-right: 20px;
  margin-left: 20px;
  margin-bottom: 20px;
}

#buttons {
  text-align: center;
}

#forms {
  text-align: center;
}

</style>
