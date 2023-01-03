import * as dt from "./utils/datetime.js";
import * as tb from "./utils/table.js";

window.switch_button = document.getElementById("switch_mode_button");
window.task_input = document.getElementById("task_input");
window.history_table = document.getElementById("history_table");
window.summary_table = document.getElementById("summary_table");
window.timer_status = "break";

// Prepare timers
window.work_timer = document.work_timer;
window.break_timer = document.break_timer;
window.total_working_timer = document.total_working_timer;
window.long_break_timer = document.long_break_timer;

// Setup worker to each timer
window.work_timer.worker = new Worker("/assets/js/worker.js");
window.work_timer.worker.onmessage = function (e) {
  cntDown(window.work_timer);
};
window.break_timer.worker = new Worker("/assets/js/worker.js");
window.break_timer.worker.onmessage = function (e) {
  cntDown(window.break_timer);
};
window.total_working_timer.worker = new Worker("/assets/js/worker.js");
window.total_working_timer.worker.onmessage = function (e) {
  cntUp(window.total_working_timer);
};
window.long_break_timer.worker = new Worker("/assets/js/worker.js");
window.long_break_timer.worker.onmessage = function (e) {
  cntDown(window.long_break_timer);
};

function getTaskStr() {
  let task_value = window.task_input.value;
  if (task_value === "") return "working";
  return `"${window.task_input.value}"`;
}

function cntDown(timer) {
  let time = dt.calcTime(timer);
  processTime(timer, time - 1);
}

function cntUp(timer) {
  let time = dt.calcTime(timer);
  processTime(timer, time + 1);
}

function processTime(timer, time) {
  if (time === 0) {
    if (timer.name === "work_timer") {
      dt.setTime(break_timer, dt.calcTime(break_timer) + 300);
      dt.setTime(work_timer, 1500);
    } else if (timer.name === "break_timer") {
      audio.src = "/assets/cpa.mp3";
      audio.play();
      dt.setTime(timer, time);
    } else if (timer.name === "long_break_timer") {
      dt.setTime(long_break_timer, 18000);
      window.long_break_timer.worker.postMessage(0);
      document.getElementById("take_long_break_button").disabled = false;
    }
  } else dt.setTime(timer, time);
}

function work2break() {
  window.timer_status = "break";
  window.switch_button.value = "Back to work";
  window.switch_button.style.background = "#caddfc";
  window.work_timer.worker.postMessage(0);
  window.total_working_timer.worker.postMessage(0);
  window.break_timer.worker.postMessage(1);
  tb.addRow(window.history_table, [dt.createDateStr(), `Take a break`]);
  window.task_input.disabled = false;
  window.task_input.style.background = "white";
}

function break2Work() {
  window.timer_status = "work";
  window.switch_button.value = "Take a break";
  window.switch_button.style.background = "#ffc0b8";
  audio.pause();
  if (dt.calcTime(break_timer) < 0) {
    dt.setTime(work_timer, dt.calcTime(work_timer) - dt.calcTime(break_timer));
    dt.setTime(break_timer, 0);
  }
  window.break_timer.worker.postMessage(0);
  window.work_timer.worker.postMessage(1);
  window.total_working_timer.worker.postMessage(1);
  tb.addRow(window.history_table, [
    dt.createDateStr(),
    `Start ${getTaskStr()}`,
  ]);
  window.task_input.disabled = true;
  window.task_input.style.background = "#f0f0f0";
}

window.start = function () {
  audio.src = "/assets/uhazabu.mp3";
  audio.play();
  tb.addRow(window.history_table, [dt.createDateStr(), "Start opening"]);
  work2break();
  document.getElementById("start").style.display = "none";
  document.getElementById("timer_main").style.display = "block";
  document.getElementById("summary").style.display = "block";
};

window.switchMode = function () {
  if (window.timer_status == "work") {
    work2break();
  } else {
    break2Work();
  }
};

window.takeLongBreak = function () {
  let new_break_time = dt.calcTime(break_timer) + 1800;
  dt.setTime(break_timer, new_break_time);
  if (new_break_time > 0) audio.pause();
  if (window.timer_status === "break") window.break_timer.worker.postMessage(0);
  work2break();
  document.getElementById("take_long_break_button").disabled = true;
  window.long_break_timer.worker.postMessage(1);
};

window.summerize = function () {
  // Stop timers
  window.break_timer.worker.postMessage(0);
  window.work_timer.worker.postMessage(0);
  window.total_working_timer.worker.postMessage(0);
  window.long_break_timer.worker.postMessage(0);
  // Add summerize header
  let summarize_button = document.getElementById("summarize");
  let summary_header = document.getElementById("summary_header");
  summary_header.innerHTML =
    '<h2>Summary <button id="copy" onclick="copy()"><i class="far fa-clipboard"></i></button></h2>';
  document.getElementById("summary_table_wrapper").style.visibility = "visible";
  // Hide or disable elements
  summarize_button.style.display = "none";
  document.getElementById("take_long_break_button").disabled = true;
  window.switch_button.disabled = true;
  window.task_input.disabled = true;
  // Add to tables
  tb.addRow(window.history_table, [dt.createDateStr(), `End today's job`]);
  document.summary_text = tb.createSummary(window.history_table, window.summary_table);
};

window.copy = function () {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(document.summary_text);
  }
  document.getElementById("copy").getElementsByTagName("i")[0].className =
    "fas fa-check";
};
