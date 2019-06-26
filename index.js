"use strict";

(() => {
  /* Constants */
  const NOTES = ["c", "c+", "d", "d+", "e", "f", "f+", "g", "g+", "a", "a+", "b"];

  const SAMPLE_SIZE = 5000;
  const SAMPLE_RATE = 44100;
  const SIN_FREQ_TABLE = [...Array(210).keys()].map(x => 50 * Math.pow(2, x / 24));

  const LPF1 = "1";
  const LPF2 = "2";
  const HPF1 = "-1";
  const HPF2 = "-2";

  /* Functions */
  const isValidNote = note =>
      note >= 0 && note <= 127;

  const isValidDetune = detune =>
      detune >= -99 && detune <= 99;

  const isValidFrq = frq =>
      frq >= 0 && frq <= 127;

  const isValidRes = res =>
      res >= 0 && res <= 127;

  const getFreqFromNote = (note, detune) =>
      440 * Math.pow(2, ((note - 69) * 100 + (detune || 0)) / 1200);

  const getMmlFromNote = note =>
      "O" + Math.floor(note / 12) + NOTES[Math.floor(note % 12)];

  const getFreqResponse = (type, note, detune, frq, res) => {
    const k = getFreqFromNote(note, detune) * (2.0 * Math.PI / (SAMPLE_RATE * 440.0));
    let cut = getFreqFromNote(frq) * k;
    if (cut < (1.0 / 127.0)) cut = 0.0;
    if (cut > (1.0 - 0.0001)) cut = 1.0 - 0.0001;
    res /= 127.0;
    const fb = res + res / (1.0 - cut);

    return SIN_FREQ_TABLE.map(sinFreq => {
      const samples = new Array(SAMPLE_SIZE);
      for (let i = 0; i < SAMPLE_SIZE; i++) {
        samples[i] = Math.sin(2.0 * Math.PI * sinFreq * (i / SAMPLE_RATE));
      }

      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0;
      let t1 = 0, t2 = 0;
      let input = 0;
      switch (type) {
        case LPF1:
          for (let i = 0; i < SAMPLE_SIZE; i++) {
            b0 = b0 + cut * (samples[i] - b0 + fb * (b0 - b1));
            b1 = b1 + cut * (b0 - b1);
            samples[i] = b1;
          }
          break;
        case HPF1:
          for (let i = 0; i < SAMPLE_SIZE; i++) {
            input = samples[i];
            b0 = b0 + cut * (input - b0 + fb * (b0 - b1));
            b1 = b1 + cut * (b0 - b1);
            samples[i] = input - b0;
          }
          break;
        case LPF2:
          for (let i = 0; i < SAMPLE_SIZE; i++) {
            let q = 1.0 - cut;
            const p = cut + 0.8 * cut * q;
            const f = p + p - 1.0;
            q = res * (1.0 + 0.5 * q * (1.0 - q + 5.6 * q * q));
            input = samples[i];
            input -= q * b4;
            t1 = b1; b1 = (input + b0) * p - b1 * f;
            t2 = b2; b2 = (b1 + t1) * p - b2 * f;
            t1 = b3; b3 = (b2 + t2) * p - b3 * f;
            b4 = (b3 + t1) * p - b4 * f;
            b0 = input;
            samples[i] = b4;
          }
          break;
        case HPF2:
          for (let i = 0; i < SAMPLE_SIZE; i++) {
            let q = 1.0 - cut;
            const p = cut + 0.8 * cut * q;
            const f = p + p - 1.0;
            q = res * (1.0 + 0.5 * q * (1.0 - q + 5.6 * q * q));
            input = samples[i];
            input -= q * b4;
            t1 = b1; b1 = (input + b0) * p - b1 * f;
            t2 = b2; b2 = (b1 + t1) * p - b2 * f;
            t1 = b3; b3 = (b2 + t2) * p - b3 * f;
            b4 = (b3 + t1) * p - b4 * f;
            b0 = input;
            samples[i] = input - b4;
          }
          break;
      }
      return [sinFreq, 20.0 * Math.log10(Math.max(...samples.map(x => Math.abs(x)).slice(SAMPLE_SIZE / 2)))];
    });
  };

  const makeGraphTitle = (type, note, frq, res) =>
      "@F" + type + ",0," + frq + "," + res + " " + getMmlFromNote(note);

  const drawGraph = () => {
    // Input from UI
    const type = selectType.value;
    const note = parseInt(inputNote.value);
    const detune = parseInt(inputDetune.value);
    const frq = parseInt(inputFrq.value);
    const res = parseInt(inputRes.value);

    // Validation check
    const errMsg = [];
    if (!isValidNote(note)) errMsg.push("Invalid Note Number '" + inputNote.value + "'");
    if (!isValidDetune(detune)) errMsg.push("Invalid Detune '" + inputDetune.value + "'");
    if (!isValidFrq(frq)) errMsg.push("Invalid Cut-off Frequency '" + inputFrq.value + "'");
    if (!isValidRes(res)) errMsg.push("Invalid Resonance '" + inputRes.value + "'");
    if (errMsg.length > 0) {
      while (divGraph.lastChild) divGraph.removeChild(divGraph.lastChild);
      errMsg.forEach(msg => divGraph.insertAdjacentHTML("beforeend", msg + "<br>"));
      return;
    }

    // Draw
    const data = new google.visualization.DataTable();
    data.addColumn("number", "Frequency");
    data.addColumn("number", "Power");
    data.addRows(getFreqResponse(type, note, detune, frq, res));
    const chart = new google.visualization.LineChart(divGraph);
    chart.draw(data, {
      title: makeGraphTitle(type, note, frq, res),
      width: 800,
      height: 480,
      legend: "none",
      "chartArea": { "width": "80%", "height": "80%" },
      hAxis: {
        title: "Frequency [Hz]",
        scaleType: "log"
      },
      vAxis: {
        title: "Power [dB]",
        format: "#.#dB",
        viewWindow: { min: -60, max: 20 }
      }
    });
  };

  /* Event handler */
  const onInputNote = e => {
    const note = parseInt(e.target.value);
    if (isValidNote(note)) {
      spanNote.textContent = getMmlFromNote(note);;
    }
  };

  const onKeyDown = e => {
    if (e.keyCode === 13) drawGraph();
  };

  /* Initialization */
  document.addEventListener("DOMContentLoaded", e => {
    google.charts.load("current", { packages: ["corechart", "line"] });
    google.charts.setOnLoadCallback(() => {
      inputNote.addEventListener("input", onInputNote, false);
      btnDraw.addEventListener("click", drawGraph, false);
      window.addEventListener("keydown", onKeyDown, false);
    });

    spanNote.textContent = getMmlFromNote(parseInt(inputNote.value));
  }, false);
})();
