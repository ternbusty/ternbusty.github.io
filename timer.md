---
layout: post
title: Modified Pomodoro Technique
date: 2022-12-26
categories: [Technology, Web]
tags: [JavaScript, Product]
---

<audio id="audio"></audio>

<div id="prompt">
<input id="start" type="button" value="Start today's job" onclick="start()">
</div>

<div id="timer_main">
<div id="task">
<input id="task_input" type="text" placeholder="Type your task">
</div>

<div id="buttons">
<input id="switch_mode_button" type="button" value="Start working" onclick="switchMode()">
<input id="take_lunch_button" type="button" value="Take a 30 min break" onclick="takeLunch()">
</div>

<div id="forms">
<h2>Work Block Timer</h2>
<form name="work_timer">
<input type="number" value=0 readonly>:<input type="number" value=25 readonly>:<input type="number" value=0 readonly>
</form>

<h2>Break Timer</h2>
<form name="break_timer">
<input type="number" value=0 readonly>:<input type="number" value=5 readonly>:<input type="number" value=0 readonly>
</form>

<h2>Total Working Time</h2>
<form name="total_working_timer">
<input type="number" value=0 readonly>:<input type="number" value=0 readonly>:<input type="number" value=0 readonly>
</form>
</div>

<div id="long_break_timer">
<h2>Long Break Timer</h2>
<form name="long_break_timer">
<input type="number" value=5 readonly>:<input type="number" value=0 readonly>:<input type="number" value=0 readonly>
</form>
</div>

<div id="history">
<h2>History</h2>
</div>
<div class="table-wrapper"><table id="history_table">
  <tbody>
  </tbody>
</table></div>
</div>

<div id="summary">
<div id="summary_header">
<!-- <h2>Summary <button id="copy"><i class="far fa-clipboard"></i></button></h2> -->
</div>
<input id="summarize" type="button" value="Summerize" onclick="summerize()">
</div>
<div class="table-wrapper" id="summary_table_wrapper"><table id="summary_table">
  <!-- <thead><tr><th>Start Date</th><td class="task_name">Job Name</td><td>Work</td><td>Break</td></tr></thead> -->
  <tbody>
  <tr><th>Start Date</th><td class="task_name">Job Name</td><td>Work</td><td>Break</td></tr>
  </tbody>
</table></div>

<script type="text/javascript" src="./assets/js/timer.js"></script>

<style>
#prompt, #task, #buttons, #history, #summary {
  text-align: center;
}

#timer_main, #long_break_timer, #summary {
  display: none;
}

#summary_table_wrapper {
  visibility: hidden;
}

#forms {
  margin-top: 20px;
  text-align: center;
}

#start {
  /* font-size: 2vmax; */
  font-size: 20px;
  width: 450px;
  height: 50px;
  /* padding: 10px; */
  border-radius: 6px;
}

#copy {
  background: none;
  border: none;
  color: gray;
  font-size: 90%;
}

form {
  font-size: 5vmax;
  color: gray;
}

input {
  border: none;
}

input[type="text"] {
  min-width: 75%;
  max-width: 90%;
  margin-right: 20px;
  margin-left: 20px;
  font-size: 20px;
  background: none;
  text-align: center;
  border: 1px solid #aaa;
  margin-bottom: 40px;
  border-radius:6px;
  height: 50px;
}

input:focus, button:focus {
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
  font-size: 20px;
  height: 50px;
  width: 300px;
  max-width: 90%;
  margin-right: 20px;
  margin-left: 20px;
  margin-bottom: 20px;
  border-radius: 6px;
}

.task_name {
  width: 50%;
}

table th {
  padding-left: 10px;
  width: 23%;
}

table {
  word-wrap: break-word;
  margin-top: 20px;
  margin-left: auto;
  margin-right: auto;
  width: 90%;
}

.table-wrapper>table tbody tr td{
  white-space: normal;
}

@media (min-width: 520px) {
  table {
    table-layout: fixed;
  }
}

</style>
