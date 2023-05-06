import * as dt from "./datetime.js";

export function addRow(table, cell_text_array) {
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

export function createSummary(history_table, summary_table) {
  let job_name, job_start_date_str;
  job_name = job_start_date_str = "";
  let break_start_date_str = null;
  let current_break_time, total_break_time, total_job_time;
  current_break_time = total_break_time = total_job_time = 0;
  let summary_text = "";

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
        let job_hm_str = dt.convertTimeToHM(current_job_time / 1000);
        let break_hm_str = dt.convertTimeToHM(current_break_time / 1000);
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
  let total_job_hm_str = dt.convertTimeToHM(total_job_time / 1000);
  let total_break_hm_str = dt.convertTimeToHM(total_break_time / 1000);
  addRow(summary_table, [
    dt.createDateStr(),
    "<b>Total</b>",
    `<b>${total_job_hm_str}</b>`,
    `<b>${total_break_hm_str}</b>`,
  ]);
  summary_text += `${dt.createDateStr()}\tTotal\t${total_job_hm_str}\t${total_break_hm_str}\n`;
  return summary_text;
}
