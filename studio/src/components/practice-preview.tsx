"use client";

import { useState } from "react";
import {
  House,
  MessageCircle,
  CalendarDays,
  Users,
  SquareCheck,
  Mail,
  Settings,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Check,
  X,
} from "lucide-react";
import { Mark } from "./ui";

const navigation = [
  { name: "Today", icon: House },
  { name: "Enquiries", icon: MessageCircle },
  { name: "Bookings", icon: CalendarDays },
  { name: "Clients", icon: Users },
  { name: "Tasks", icon: SquareCheck },
  { name: "Messages", icon: Mail },
  { name: "Settings", icon: Settings },
];
const appointments = [
  ["9:00", "Initial consultation", "New enquiry", "green"],
  ["11:00", "Follow-up session", "Returning client", "blue"],
  ["14:00", "Online session", "Video call", "purple"],
  ["16:30", "Admin time", "Emails and notes", "grey"],
];
const enquiries = [
  "New website enquiry",
  "Interested in reflexology",
  "Follow-up on appointment",
];
const tasks = [
  "Reply to new enquiry",
  "Confirm tomorrow’s booking",
  "Send session information",
  "Update availability",
];

export function PracticePreview() {
  const [active, setActive] = useState("Today");
  const [day, setDay] = useState(0);
  const [completed, setCompleted] = useState<number[]>([]);
  const [detail, setDetail] = useState<string | null>(null);
  const date = new Date(Date.UTC(2026, 3, 23 + day));
  const formattedDate = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(date);
  function toggleTask(i: number) {
    setCompleted((prev) =>
      prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i],
    );
  }
  const taskList = (
    <div className="task-list">
      {tasks.map((task, i) => (
        <label key={task} className={completed.includes(i) ? "done" : ""}>
          <input
            type="checkbox"
            checked={completed.includes(i)}
            onChange={() => toggleTask(i)}
          />
          <span className="checkbox">
            {completed.includes(i) && <Check size={11} />}
          </span>
          <span>{task}</span>
        </label>
      ))}
    </div>
  );

  return (
    <div className="preview-wrap">
      <div
        className="practice-preview"
        aria-label="Interactive practice workspace preview"
      >
        <aside className="preview-sidebar">
          <Mark className="preview-mark" />
          <nav aria-label="Example workspace">
            {navigation.map(({ name, icon: Icon }) => (
              <button
                key={name}
                type="button"
                onClick={() => {
                  setActive(name);
                  setDetail(null);
                }}
                aria-current={active === name ? "page" : undefined}
              >
                <Icon size={18} strokeWidth={1.25} />
                <span>{name}</span>
              </button>
            ))}
          </nav>
          <div className="sidebar-motto">
            <span />A calmer practice.
            <br />
            Brighter days.
          </div>
        </aside>
        <div className="preview-main">
          <header className="preview-heading">
            <h2>{active}</h2>
            {(active === "Today" || active === "Bookings") && <div className="preview-date">
              <span>{formattedDate}</span>
              <button aria-label="Previous day" onClick={() => { setDay(day - 1); setDetail(null); }}>
                <ChevronLeft size={16} />
              </button>
              <button aria-label="Next day" onClick={() => { setDay(day + 1); setDetail(null); }}>
                <ChevronRight size={16} />
              </button>
            </div>}
          </header>
          {detail ? (
            <div className="preview-detail">
              <button
                className="close-detail"
                onClick={() => setDetail(null)}
                aria-label="Close details"
              >
                <X size={18} />
              </button>
              <p className="eyebrow">Example workspace</p>
              <h3>{detail}</h3>
              <p>
                Everything you need for the next step, kept together with the
                conversation.
              </p>
              <div className="detail-note">
                This is an interactive design preview using fictional
                information.
              </div>
              <button className="preview-back" onClick={() => setDetail(null)}>
                Back to {active.toLowerCase()} <ArrowRight size={14} />
              </button>
            </div>
          ) : (
            <>
              {(active === "Today" || active === "Bookings") && (
                <div className="appointments">
                  {day !== 0 && <p className="preview-description">No appointments on this day.</p>}
                  {(day === 0 ? appointments : []).map(([time, title, subtitle, colour]) => (
                    <button
                      className="appointment"
                      key={time}
                      onClick={() => setDetail(title)}
                    >
                      <time>{time}</time>
                      <span className={`status-dot ${colour}`} />
                      <span>
                        <strong>{title}</strong>
                        <small>{subtitle}</small>
                      </span>
                      <ChevronRight size={15} strokeWidth={1} />
                    </button>
                  ))}
                </div>
              )}
              {active === "Today" && (
                <div className="preview-cards">
                  <section className="preview-card">
                    <h3>
                      Enquiries <span className="count">3</span>
                    </h3>
                    <div className="enquiry-list">
                      {enquiries.map((e, i) => (
                        <button
                          key={e}
                          onClick={() => {
                            setActive("Enquiries");
                            setDetail(e);
                          }}
                        >
                          <span className={`status-dot enquiry-${i}`} />
                          <span>
                            {e}
                            <small>
                              {["2 hours ago", "5 hours ago", "1 day ago"][i]}
                            </small>
                          </span>
                        </button>
                      ))}
                    </div>
                    <button
                      className="preview-link"
                      onClick={() => setActive("Enquiries")}
                    >
                      View all enquiries <ArrowRight size={13} />
                    </button>
                  </section>
                  <section className="preview-card">
                    <h3>Your next steps</h3>
                    {taskList}
                    <button
                      className="preview-link"
                      onClick={() => setActive("Tasks")}
                    >
                      View all tasks <ArrowRight size={13} />
                    </button>
                  </section>
                </div>
              )}
              {active === "Tasks" && (
                <div className="workspace-section">
                  <p className="preview-description">
                    A little less on your mind.
                  </p>
                  {taskList}
                  <p className="task-progress" aria-live="polite">
                    {completed.length} of {tasks.length} tasks complete
                  </p>
                </div>
              )}
              {active === "Enquiries" && (
                <div className="workspace-section">
                  <p className="preview-description">
                    Every conversation has a place.
                  </p>
                  {enquiries.map((e) => (
                    <button
                      className="workspace-row"
                      key={e}
                      onClick={() => setDetail(e)}
                    >
                      <MessageCircle size={17} />
                      {e}
                      <ChevronRight size={15} />
                    </button>
                  ))}
                </div>
              )}
              {active === "Clients" && (
                <div className="workspace-section">
                  <p className="preview-description">
                    The people at the heart of your practice.
                  </p>
                  {["Alex Morgan", "Jamie Ellis", "Sam Taylor"].map(
                    (name, i) => (
                      <button
                        className="workspace-row"
                        key={name}
                        onClick={() => setDetail(name)}
                      >
                        <span className="avatar">
                          {name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </span>
                        <span>
                          {name}
                          <small>
                            {i === 0 ? "New client" : "Returning client"}
                          </small>
                        </span>
                        <ChevronRight size={15} />
                      </button>
                    ),
                  )}
                </div>
              )}
              {active === "Messages" && (
                <div className="workspace-section">
                  <p className="preview-description">
                    Your conversations, easy to find.
                  </p>
                  {[
                    "A question before my first session",
                    "Thank you for today",
                    "Moving next week’s appointment",
                  ].map((e) => (
                    <button
                      className="workspace-row"
                      key={e}
                      onClick={() => setDetail(e)}
                    >
                      <Mail size={17} />
                      {e}
                      <ChevronRight size={15} />
                    </button>
                  ))}
                </div>
              )}
              {active === "Settings" && (
                <div className="workspace-section">
                  <p className="preview-description">
                    Made to fit the way you work.
                  </p>
                  {[
                    "Practice details",
                    "Services and prices",
                    "Booking availability",
                  ].map((e) => (
                    <button
                      className="workspace-row"
                      key={e}
                      onClick={() => setDetail(e)}
                    >
                      <Settings size={16} />
                      {e}
                      <ChevronRight size={15} />
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <p className="preview-caption">
        <span /> A glimpse of your practice, organised.{" "}
        <a className="try-preview" href="/app">
          Explore the app <ArrowRight size={12} />
        </a>
      </p>
    </div>
  );
}
