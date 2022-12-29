let work_timer = document.work_timer;
let rest_timer = document.rest_timer;
let total_working_timer = document.total_working_timer;

work_timer.worker = new Worker("/assets/js/worker.js");
work_timer.worker.onmessage = function (e) {
  cntDown(work_timer);
};
rest_timer.worker = new Worker("/assets/js/worker.js");
rest_timer.worker.onmessage = function (e) {
  cntDown(rest_timer);
};
total_working_timer.worker = new Worker("/assets/js/worker.js");
total_working_timer.worker.onmessage = function (e) {
  cntUp(total_working_timer);
};

let button = document.getElementById("switch_mode_button");
let task_input = document.getElementById("task_input");
let table = document.getElementById("history_table");
let timer_status = "not_started";

function addRow(table, date_str, task_str) {
  var tr = table.insertRow(-1);
  var th = document.createElement("th");
  th.innerHTML = date_str;
  tr.appendChild(th);
  var cell = tr.insertCell(1);
  cell.innerHTML = task_str;
}

function createDateStr() {
  let zero_padding = function (i) {
    return i.toString().padStart(2, "0");
  };
  let d = new Date();
  let date_str = `${d.getFullYear()}-${zero_padding(
    d.getMonth() + 1
  )}-${zero_padding(d.getDate())}`;
  let time_str = `${zero_padding(d.getHours())}:${zero_padding(
    d.getMinutes()
  )}`;
  return `${date_str} ${time_str}`;
}

function calcTime(timer) {
  let hour = parseInt(timer.elements[0].value);
  let min = parseInt(timer.elements[1].value);
  let sec = parseInt(timer.elements[2].value);
  let time = hour * 3600 + min * 60 + sec;
  return parseInt(time);
}

function setTime(timer, time) {
  let abstime = Math.abs(time);
  let hour = Math.floor(abstime / 3600);
  let min = Math.floor((abstime % 3600) / 60);
  let sec = abstime % 60;
  timer.elements[0].value = time >= 0 ? hour : -1 * hour;
  timer.elements[1].value = time >= 0 ? min : -1 * min;
  timer.elements[2].value = time >= 0 ? sec : -1 * sec;
}

function processTime(timer, time) {
  if (time === 0) {
    if (timer.name === "work_timer") {
      setTime(rest_timer, calcTime(rest_timer) + 300);
      setTime(work_timer, 1500);
    } else if (timer.name === "rest_timer") {
      audio.src = "/assets/cpa.mp3";
      audio.play();
      setTime(timer, time);
    }
  } else setTime(timer, time);
}

function cntDown(timer) {
  let time = calcTime(timer);
  processTime(timer, time - 1);
}

function cntUp(timer) {
  let time = calcTime(timer);
  processTime(timer, time + 1);
}

function take_lunch() {
  timer_status = "rest";
  button.value = "Back to work";
  setTime(rest_timer, calcTime(rest_timer) + 1800);
  work_timer.worker.postMessage(0);
  total_working_timer.worker.postMessage(0);
  rest_timer.worker.postMessage(1);
  document.getElementById("take_lunch_button").style.display = "none";
  addRow(table, createDateStr(), `Take a break`);
}

function switch_mode() {
  let get_task_str = function () {
    let task_value = task_input.value;
    if (task_value === "") return "working";
    return task_value;
  };
  if (timer_status == "not_started") {
    // not started -> work
    timer_status = "work";
    button.value = "Take a rest";
    work_timer.worker.postMessage(1);
    total_working_timer.worker.postMessage(1);
    document.getElementById("history").innerHTML = "<h2>History</h2>";
    addRow(table, createDateStr(), `Start ${get_task_str()}`);
  } else if (timer_status == "work") {
    // work -> rest
    timer_status = "rest";
    button.value = "Back to work";
    work_timer.worker.postMessage(0);
    total_working_timer.worker.postMessage(0);
    rest_timer.worker.postMessage(1);
    addRow(table, createDateStr(), `Take a rest`);
  } else {
    // rest -> work
    timer_status = "work";
    button.value = "Take a rest";
    audio.pause();
    if (calcTime(rest_timer) < 0) {
      setTime(work_timer, calcTime(work_timer) - calcTime(rest_timer));
      setTime(rest_timer, 0);
    }
    rest_timer.worker.postMessage(0);
    work_timer.worker.postMessage(1);
    total_working_timer.worker.postMessage(1);
    addRow(table, createDateStr(), `Start ${get_task_str()}`);
  }
}
