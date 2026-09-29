export function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

function drawClock(canvas, date) {
  if (!canvas || !date) return;
  const size = canvas.width;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 6;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, size, size);

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,255,255,0.15)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  for (let i = 0; i < 12; i++) {
    const a = ((i * 30 - 90) * Math.PI) / 180;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r * 0.82, cy + Math.sin(a) * r * 0.82);
    ctx.lineTo(cx + Math.cos(a) * r * 0.93, cy + Math.sin(a) * r * 0.93);
    ctx.strokeStyle = "rgba(255,255,255,0.6)";
    ctx.lineWidth = i % 3 === 0 ? 2 : 1;
    ctx.stroke();
  }

  const hours = date.getHours() % 12;
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();
  const ms = date.getMilliseconds();

  const secA = (((seconds + ms / 1000) * 6 - 90) * Math.PI) / 180;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(secA) * r * 0.82, cy + Math.sin(secA) * r * 0.82);
  ctx.strokeStyle = "#0064ff";
  ctx.lineWidth = 1;
  ctx.stroke();

  const minA = (((minutes + seconds / 60) * 6 - 90) * Math.PI) / 180;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(minA) * r * 0.65, cy + Math.sin(minA) * r * 0.65);
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 2;
  ctx.stroke();

  const hourA = (((hours + minutes / 60) * 30 - 90) * Math.PI) / 180;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(hourA) * r * 0.45, cy + Math.sin(hourA) * r * 0.45);
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fill();
}

let calendarPopup = null;
let currentMonth = new Date();
let tickTimer = null;

export function toggleCalendarPopup() {
  if (calendarPopup) {
    closeCalendarPopup();
  } else {
    openCalendarPopup();
  }
}

export function closeCalendarPopup() {
  if (tickTimer) {
    clearInterval(tickTimer);
    tickTimer = null;
  }
  if (calendarPopup) {
    calendarPopup.remove();
    calendarPopup = null;
  }
  document.removeEventListener("keydown", handleKeydown);
}

function openCalendarPopup() {
  currentMonth = new Date();

  const popup = document.createElement("div");
  popup.id = "calendar-popup";
  popup.className = "calendar-popup";
  popup.innerHTML = `
    <div class="calendar-body">
      <div class="calendar-left-col">
        <div class="calendar-header">
          <button class="calendar-nav-btn" data-nav="prev" title="Previous month">‹</button>
          <div class="calendar-month-year-container">
            <div class="calendar-month-year"></div>
            <button class="calendar-today-btn">Today</button>
          </div>
          <button class="calendar-nav-btn" data-nav="next" title="Next month">›</button>
        </div>
        <div class="calendar-grid"></div>
      </div>
      <div class="calendar-right-col">
        <canvas class="calendar-analog-canvas" width="120" height="120"></canvas>
        <div class="calendar-digital-text"></div>
      </div>
    </div>`;

  document.body.appendChild(popup);
  calendarPopup = popup;

  popup.querySelector('[data-nav="prev"]').onclick = (e) => {
    e.stopPropagation();
    currentMonth.setMonth(currentMonth.getMonth() - 1);
    renderCalendar();
  };
  popup.querySelector('[data-nav="next"]').onclick = (e) => {
    e.stopPropagation();
    currentMonth.setMonth(currentMonth.getMonth() + 1);
    renderCalendar();
  };
  popup.querySelector(".calendar-today-btn").onclick = (e) => {
    e.stopPropagation();
    currentMonth = new Date();
    renderCalendar();
  };

  renderCalendar();
  updateClock();

  tickTimer = setInterval(() => {
    if (!calendarPopup) {
      clearInterval(tickTimer);
      tickTimer = null;
      return;
    }
    updateClock();
  }, 1000);

  document.addEventListener("keydown", handleKeydown);
  setTimeout(() => {
    document.addEventListener("click", closeOnClickOutside);
  }, 0);
}

function handleKeydown(e) {
  if (!calendarPopup) return;
  if (e.key === "Escape") {
    closeCalendarPopup();
  } else if (e.key === "ArrowLeft") {
    currentMonth.setMonth(currentMonth.getMonth() - 1);
    renderCalendar();
  } else if (e.key === "ArrowRight") {
    currentMonth.setMonth(currentMonth.getMonth() + 1);
    renderCalendar();
  } else if (e.key === "ArrowUp") {
    currentMonth.setFullYear(currentMonth.getFullYear() + 1);
    renderCalendar();
  } else if (e.key === "ArrowDown") {
    currentMonth.setFullYear(currentMonth.getFullYear() - 1);
    renderCalendar();
  }
}

function closeOnClickOutside(e) {
  if (!calendarPopup) {
    document.removeEventListener("click", closeOnClickOutside);
    return;
  }
  if (!calendarPopup.contains(e.target) && e.target.id !== "date") {
    closeCalendarPopup();
    document.removeEventListener("click", closeOnClickOutside);
  }
}

function updateClock() {
  if (!calendarPopup) return;
  const canvas = calendarPopup.querySelector(".calendar-analog-canvas");
  const digitalText = calendarPopup.querySelector(".calendar-digital-text");
  const now = new Date();
  if (canvas) drawClock(canvas, now);
  if (digitalText) {
    digitalText.textContent = now.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });
  }
}

function renderCalendar() {
  if (!calendarPopup) return;
  const monthYear = calendarPopup.querySelector(".calendar-month-year");
  const grid = calendarPopup.querySelector(".calendar-grid");
  if (!monthYear || !grid) return;

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  monthYear.textContent = new Date(year, month).toLocaleDateString([], {
    month: "long",
    year: "numeric"
  });

  grid.innerHTML = "";

  const weekHeader = document.createElement("div");
  weekHeader.className = "calendar-week-header";
  weekHeader.textContent = "W";
  weekHeader.title = "Week number";
  grid.appendChild(weekHeader);

  ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].forEach((day) => {
    const dayHeader = document.createElement("div");
    dayHeader.className = "calendar-day-header";
    dayHeader.textContent = day;
    grid.appendChild(dayHeader);
  });

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const today = new Date();
  const isCurrentMonth = today.getMonth() === month && today.getFullYear() === year;
  const currentDay = today.getDate();

  let dayCounter = 1;

  for (let row = 0; row < 6; row++) {
    const weekNum = document.createElement("div");
    weekNum.className = "calendar-week-number";
    const refDay = Math.min(Math.max(1, 1 + row * 7 - firstDay), daysInMonth);
    weekNum.textContent = getWeekNumber(new Date(year, month, refDay));
    grid.appendChild(weekNum);

    for (let col = 0; col < 7; col++) {
      const cellIndex = row * 7 + col;
      const dayCell = document.createElement("div");
      dayCell.className = "calendar-day";

      if (cellIndex >= firstDay && dayCounter <= daysInMonth) {
        const day = dayCounter;
        dayCell.textContent = day;

        if (isCurrentMonth && day === currentDay) {
          dayCell.classList.add("today");
        }

        if (col === 0 || col === 6) {
          dayCell.classList.add("weekend");
        }

        dayCell.addEventListener("click", () => {
          grid.querySelectorAll(".calendar-day.selected").forEach((el) => el.classList.remove("selected"));
          dayCell.classList.add("selected");
        });

        dayCounter++;
      } else {
        dayCell.classList.add("empty");
      }

      grid.appendChild(dayCell);
    }
  }
}
