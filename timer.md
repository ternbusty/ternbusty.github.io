---
layout: post
title: Modified Pomodoro Technique
date: 2022-12-26
categories: [Technology, Web]
tags: [JavaScript, Product]
---

<audio id="audio"></audio>

<div id="task">
<input id="task_input" type="text" placeholder="Type your task">
</div>

<div id="buttons">
<input id="switch_mode_button" type="button" value="Start working" onclick="switch_mode()">
<input id="take_lunch_button" type="button" value="Take a 30 min break" onclick="take_lunch()">
</div>

<div id="forms">
<h2>Work Block Timer</h2>
<form name="work_timer">
<input type="number" value=0 readonly>:<input type="number" value=25 readonly>:<input type="number" value=0 readonly>
</form>

<h2>Rest Timer</h2>
<form name="rest_timer">
<input type="number" value=0 readonly>:<input type="number" value=0 readonly>:<input type="number" value=0 readonly>
</form>

<h2>Total Working Time</h2>
<form name="total_working_timer">
<input type="number" value=0 readonly>:<input type="number" value=0 readonly>:<input type="number" value=0 readonly>
</form>
</div>

<div id="history">
</div>
<div class="table-wrapper"><table id="history_table">
  <tbody>
  </tbody>
</table></div>

<script type="text/javascript" src="./assets/js/timer.js"></script>

<style>
input {
  border: none;
}

form {
  font-size: 5vmax;
  color: gray;
}

input[type="text"] {
  width: 75%;
  font-size: 1.2vmax;
  background: none;
  text-align: center;
  border: 1px solid #aaa;
  margin-bottom: 40px;
  border-radius:6px;
}

input[type="text"]:focus {
  outline: none;
}

input[type="text"]:focus::placeholder{
  opacity: 0;
}

input[type="number"] {
  width: 28%;
  background: none;
  font-size: 4vmax;
  text-align: center;
}

input[type="button"] {
  font-size: 1.2vmax;
  width: 300px;
  max-width: 90%;
  margin-right: 20px;
  margin-left: 20px;
  margin-bottom: 20px;
}

table th {
  padding-left: 20px;
  width:30%;
}

#task {
  text-align: center;
}

#buttons {
  text-align: center;
}

#forms {
  margin-top: 20px;
  text-align: center;
}

#history {
  text-align: center;
}

#history_table {
  margin-top: 20px;
  margin-left: auto;
  margin-right: auto;
  width: 75%;
}

</style>
