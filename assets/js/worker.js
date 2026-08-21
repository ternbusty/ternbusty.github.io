var timerId = 0;
onmessage = function (e) {
  if (e.data === 0) {
    clearInterval(timerId);
    timerId = 0;
  } else {
    timerId = setInterval(function () {
      postMessage(null);
    }, 1000);
  }
};
