let work_timer = document.work_timer;
let break_timer = document.break_timer;
let total_working_timer = document.total_working_timer;
let long_break_timer = document.long_break_timer;

work_timer.worker = new Worker("/assets/js/worker.js");
work_timer.worker.onmessage = function (e) {
  cntDown(work_timer);
};
break_timer.worker = new Worker("/assets/js/worker.js");
break_timer.worker.onmessage = function (e) {
  cntDown(break_timer);
};
total_working_timer.worker = new Worker("/assets/js/worker.js");
total_working_timer.worker.onmessage = function (e) {
  cntUp(total_working_timer);
};
long_break_timer.worker = new Worker("/assets/js/worker.js");
long_break_timer.worker.onmessage = function (e) {
  cntDown(long_break_timer);
};

let button = document.getElementById("switch_mode_button");
let task_input = document.getElementById("task_input");
let history_table = document.getElementById("history_table");
let summary_table = document.getElementById("summary_table");
let timer_status = "break";

function addRow(table, cell_text_array) {
  // let tbody = table.getElementsByTagName("tbody")[0];
  // let tr = tbody.insertRow(-1);
  let tr = table.insertRow(-1);
  let th = document.createElement("th");
  th.innerHTML = cell_text_array[0];
  tr.appendChild(th);
  if (cell_text_array.length > 1) {
    for (let i = cell_text_array.length - 1; i >= 1; i--) {
      let cell = tr.insertCell(1);
      cell.innerHTML = cell_text_array[i];
    }
  }
}

let zero_padding = function (i) {
  return i.toString().padStart(2, "0");
};

function createDateStr() {
  // let zero_padding = function (i) {
  //   return i.toString().padStart(2, "0");
  // };
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

function convertTimeToHMS(time) {
  let abstime = Math.abs(time);
  let hour = Math.floor(abstime / 3600);
  let min = Math.floor((abstime % 3600) / 60);
  let sec = abstime % 60;
  if (time >= 0) return [hour, min, sec];
  else return [-1 * hour, -1 * min, -1 * sec];
}

function setTime(timer, time) {
  let hms_array = convertTimeToHMS(time);
  timer.elements[0].value = hms_array[0];
  timer.elements[1].value = hms_array[1];
  timer.elements[2].value = hms_array[2];
}

function processTime(timer, time) {
  if (time === 0) {
    if (timer.name === "work_timer") {
      setTime(break_timer, calcTime(break_timer) + 300);
      setTime(work_timer, 1500);
    } else if (timer.name === "break_timer") {
      audio.src = "/assets/cpa.mp3";
      audio.play();
      setTime(timer, time);
    } else if (timer.name === "long_break_timer") {
      setTime(long_break_timer, 18000);
      long_break_timer.worker.postMessage(0);
      document.getElementById("take_lunch_button").disabled = false;
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

function getTaskStr() {
  let task_value = task_input.value;
  if (task_value === "") return "working";
  return `"${task_input.value}"`;
}

function work2break() {
  timer_status = "break";
  button.value = "Back to work";
  button.style.background = "#caddfc";
  work_timer.worker.postMessage(0);
  total_working_timer.worker.postMessage(0);
  break_timer.worker.postMessage(1);
  addRow(history_table, [createDateStr(), `Take a break`]);
  task_input.disabled = false;
  task_input.style.background = "white";
}

function break2Work() {
  timer_status = "work";
  button.value = "Take a break";
  button.style.background = "#ffc0b8";
  audio.pause();
  if (calcTime(break_timer) < 0) {
    setTime(work_timer, calcTime(work_timer) - calcTime(break_timer));
    setTime(break_timer, 0);
  }
  break_timer.worker.postMessage(0);
  work_timer.worker.postMessage(1);
  total_working_timer.worker.postMessage(1);
  addRow(history_table, [createDateStr(), `Start ${getTaskStr()}`]);
  task_input.disabled = true;
  task_input.style.background = "#f0f0f0";
}

function takeLunch() {
  let new_break_time = calcTime(break_timer) + 1800;
  setTime(break_timer, new_break_time);
  if (new_break_time > 0) audio.pause();
  if (timer_status === "break") break_timer.worker.postMessage(0);
  work2break();
  document.getElementById("take_lunch_button").disabled = true;
  long_break_timer.worker.postMessage(1);
}

function start() {
  audio.src = "/assets/uhazabu.mp3";
  audio.play();
  addRow(history_table, [createDateStr(), "Start opening"]);
  work2break();
  document.getElementById("start").style.display = "none";
  document.getElementById("timer_main").style.display = "block";
  document.getElementById("summary").style.display = "block";
}

function switchMode() {
  if (timer_status == "work") {
    work2break();
  } else {
    break2Work();
  }
}

function convertTimeToHM(time) {
  let hms_array = convertTimeToHMS(time);
  let hms_str = `${zero_padding(hms_array[0])}:${zero_padding(hms_array[1])}`;
  return hms_str;
}

function createSummaryTable() {
  let job_name, job_start_date_str;
  job_name = job_start_date_str = "";
  let break_start_date_str = null;
  let current_break_time, total_break_time, total_job_time;
  current_break_time = total_break_time = total_job_time = 0;
  let summary_text = "";
  // addRow(summary_table, ["Start Date", "Job Name", "Work", "Break"]);

  for (var i = 0; i < history_table.rows.length; i++) {
    var date_str = history_table.rows[i].cells[0].innerText;
    var cell_text = history_table.rows[i].cells[1].innerText;
    if (cell_text === "Take a break") {
      // If break is not in progress, update break_star_date_str with a new one
      if (break_start_date_str === "" || break_start_date_str === null)
        break_start_date_str = date_str;
    } else {
      let new_job_name = cell_text.split("Start ")[1];
      // If break is in progress, end break
      if (break_start_date_str !== "" && break_start_date_str !== null) {
        let tmp_break_time =
          Date.parse(date_str) - Date.parse(break_start_date_str);
        current_break_time += tmp_break_time;
        break_start_date_str = "";
        total_break_time += tmp_break_time;
      }
      // Check if the job is a new one
      if (new_job_name === job_name) continue;
      // End the current job
      if (job_name !== "") {
        let current_job_time =
          Date.parse(date_str) -
          Date.parse(job_start_date_str) -
          current_break_time;
        total_job_time += current_job_time;
        let job_hm_str = convertTimeToHM(current_job_time / 1000);
        let break_hm_str = convertTimeToHM(current_break_time / 1000);
        addRow(summary_table, [
          job_start_date_str,
          job_name,
          job_hm_str,
          break_hm_str,
        ]);
        summary_text += `${job_start_date_str}\t${job_name}\t${job_hm_str}\t${break_hm_str}\n`;
      }
      // Start new job
      job_name = new_job_name;
      job_start_date_str = date_str;
      current_break_time = 0;
    }
  }
  total_job_hm_str = convertTimeToHM(total_job_time / 1000);
  total_break_hm_str = convertTimeToHM(total_break_time / 1000);
  addRow(summary_table, [
    createDateStr(),
    "<b>Total</b>",
    `<b>${total_job_hm_str}</b>`,
    `<b>${total_break_hm_str}</b>`,
  ]);
  summary_text += `${createDateStr()}\tTotal\t${total_job_hm_str}\t${total_break_hm_str}\n`;
  document.summary_text = summary_text;
}

function copy() {
  // console.log("hoge");
  if (navigator.clipboard) {
    navigator.clipboard.writeText(document.summary_text);
  }
  document.getElementById("copy").getElementsByTagName("i")[0].className =
    "fas fa-check";
}

function summerize() {
  // Stop timers
  break_timer.worker.postMessage(0);
  work_timer.worker.postMessage(0);
  total_working_timer.worker.postMessage(0);
  long_break_timer.worker.postMessage(0);
  // Add summerize header
  let summarize_button = document.getElementById("summarize");
  let summary_header = document.getElementById("summary_header");
  summary_header.innerHTML =
    '<h2>Summary <button id="copy" onclick="copy()"><i class="far fa-clipboard"></i></button></h2>';
  // '<h2>Summary <button aria-label="copy" data-title-succeed="Copied!" data-original-title="" title=""><i class="far fa-clipboard"></i></button></h2>';
  document.getElementById("summary_table_wrapper").style.visibility = "visible";
  // Hide or disable elements
  summarize_button.style.display = "none";
  document.getElementById("take_lunch_button").disabled = true;
  button.disabled = true;
  task_input.disabled = true;
  // Add to tables
  addRow(history_table, [createDateStr(), `End today's job`]);
  createSummaryTable();
}
