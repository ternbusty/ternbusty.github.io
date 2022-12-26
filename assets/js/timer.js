let work_timer = document.work_timer;
let rest_timer = document.rest_timer;
let total_working_timer = document.total_working_timer;
let button = document.getElementById("switch_mode_button");
let timer_status = "not_started";

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

function cntStart(timer) {
  timer.interval = setInterval(cntDown, 1000, timer);
}

function cntUpStart(timer) {
  timer.interval = setInterval(cntUp, 1000, timer);
}

function cntStop(timer) {
  clearInterval(timer.interval);
}

function take_lunch() {
  timer_status = "rest";
  button.value = "Back to work";
  setTime(rest_timer, calcTime(rest_timer) + 1800);
  cntStop(work_timer);
  cntStop(total_working_timer);
  cntStart(rest_timer);
  document.getElementById("take_lunch_button").style.display = "none";
}

function switch_mode() {
  if (timer_status == "not_started") {
    // not started -> work
    timer_status = "work";
    button.value = "Take a rest";
    cntStart(work_timer);
    cntUpStart(total_working_timer);
  } else if (timer_status == "work") {
    // work -> rest
    timer_status = "rest";
    button.value = "Back to work";
    cntStop(work_timer);
    cntStop(total_working_timer);
    cntStart(rest_timer);
  } else {
    // rest -> work
    timer_status = "work";
    button.value = "Take a rest";
    audio.pause();
    if (calcTime(rest_timer) < 0) {
      setTime(work_timer, calcTime(work_timer) - calcTime(rest_timer));
      setTime(rest_timer, 0);
    }
    cntStop(rest_timer);
    cntStart(work_timer);
    cntUpStart(total_working_timer);
  }
}
