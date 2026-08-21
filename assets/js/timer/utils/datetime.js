function zero_padding(i) {
  return i.toString().padStart(2, "0");
}

function convertTimeToHMS(time) {
  let abstime = Math.abs(time);
  let hour = Math.floor(abstime / 3600);
  let min = Math.floor((abstime % 3600) / 60);
  let sec = abstime % 60;
  if (time >= 0) return [hour, min, sec];
  else return [-1 * hour, -1 * min, -1 * sec];
}

export function createDateStr() {
  let d = new Date();
  let date_str = `${d.getFullYear()}-${zero_padding(
    d.getMonth() + 1
  )}-${zero_padding(d.getDate())}`;
  let time_str = `${zero_padding(d.getHours())}:${zero_padding(
    d.getMinutes()
  )}`;
  return `${date_str} ${time_str}`;
}

export function calcTime(timer) {
  let hour = parseInt(timer.elements[0].value);
  let min = parseInt(timer.elements[1].value);
  let sec = parseInt(timer.elements[2].value);
  let time = hour * 3600 + min * 60 + sec;
  return parseInt(time);
}

export function setTime(timer, time) {
  let hms_array = convertTimeToHMS(time);
  timer.elements[0].value = hms_array[0];
  timer.elements[1].value = hms_array[1];
  timer.elements[2].value = hms_array[2];
}

export function convertTimeToHM(time) {
  let hms_array = convertTimeToHMS(time);
  let hms_str = `${zero_padding(hms_array[0])}:${zero_padding(hms_array[1])}`;
  return hms_str;
}
