"use client";

import { Badge, Box, Button, Card, Checkbox, Heading, Stack, Text } from "@chakra-ui/react";
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
    <Stack className="preview-task-list" gap={3}>
      {tasks.map((task, i) => (
        <Checkbox.Root key={task} checked={completed.includes(i)} onCheckedChange={() => toggleTask(i)} colorPalette="copper" size="sm" alignItems="start">
          <Checkbox.HiddenInput />
          <Checkbox.Control mt="1px"><Checkbox.Indicator /></Checkbox.Control>
          <Checkbox.Label fontSize="14px" fontWeight="500" lineHeight="1.5" color={completed.includes(i) ? "fg.muted" : "fg"} textDecoration={completed.includes(i) ? "line-through" : undefined}>{task}</Checkbox.Label>
        </Checkbox.Root>
      ))}
    </Stack>
  );

  return (
    <Box className="preview-wrap">
      <Box
        className="practice-preview"
        aria-label="Interactive practice workspace preview"
      >
        <aside className="preview-sidebar">
          <Mark className="preview-mark" />
          <nav aria-label="Example workspace">
            {navigation.map(({ name, icon: Icon }) => (
              <Button variant="ghost"
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
              </Button>
            ))}
          </nav>
          <Box className="sidebar-motto">
            <span />A calmer practice.
            <br />
            Brighter days.
          </Box>
        </aside>
        <Box className="preview-main">
          <header className="preview-heading">
            <Heading as="h2">{active}</Heading>
            {(active === "Today" || active === "Bookings") && <Box className="preview-date">
              <span>{formattedDate}</span>
              <Button variant="ghost" aria-label="Previous day" onClick={() => { setDay(day - 1); setDetail(null); }}>
                <ChevronLeft size={16} />
              </Button>
              <Button variant="ghost" aria-label="Next day" onClick={() => { setDay(day + 1); setDetail(null); }}>
                <ChevronRight size={16} />
              </Button>
            </Box>}
          </header>
          {detail ? (
            <Box className="preview-detail">
              <Button variant="ghost"
                className="close-detail"
                onClick={() => setDetail(null)}
                aria-label="Close details"
              >
                <X size={18} />
              </Button>
              <Text className="eyebrow">Example workspace</Text>
              <Heading as="h3">{detail}</Heading>
              <Text>
                Everything you need for the next step, kept together with the
                conversation.
              </Text>
              <Box className="detail-note">
                This is an interactive design preview using fictional
                information.
              </Box>
              <Button variant="ghost" className="preview-back" onClick={() => setDetail(null)}>
                Back to {active.toLowerCase()} <ArrowRight size={14} />
              </Button>
            </Box>
          ) : (
            <>
              {(active === "Today" || active === "Bookings") && (
                <Box className="appointments">
                  {day !== 0 && <Text className="preview-description">No appointments on this day.</Text>}
                  {(day === 0 ? appointments : []).map(([time, title, subtitle, colour]) => (
                    <Button variant="ghost"
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
                    </Button>
                  ))}
                </Box>
              )}
              {active === "Today" && (
                <Box className="preview-cards">
                  <Card.Root as="section" className="preview-card">
                    <Heading as="h3">
                      Enquiries <Badge colorPalette="copper" rounded="full">3</Badge>
                    </Heading>
                    <Box className="enquiry-list">
                      {enquiries.map((e, i) => (
                        <Button variant="ghost"
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
                        </Button>
                      ))}
                    </Box>
                    <Button variant="ghost"
                      className="preview-link"
                      onClick={() => setActive("Enquiries")}
                    >
                      View all enquiries <ArrowRight size={13} />
                    </Button>
                  </Card.Root>
                  <Card.Root as="section" className="preview-card">
                    <Heading as="h3">Your next steps</Heading>
                    {taskList}
                    <Button variant="ghost"
                      className="preview-link"
                      onClick={() => setActive("Tasks")}
                    >
                      View all tasks <ArrowRight size={13} />
                    </Button>
                  </Card.Root>
                </Box>
              )}
              {active === "Tasks" && (
                <Box className="workspace-section">
                  <Text className="preview-description">
                    A little less on your mind.
                  </Text>
                  {taskList}
                  <Text className="task-progress" aria-live="polite">
                    {completed.length} of {tasks.length} tasks complete
                  </Text>
                </Box>
              )}
              {active === "Enquiries" && (
                <Box className="workspace-section">
                  <Text className="preview-description">
                    Every conversation has a place.
                  </Text>
                  {enquiries.map((e) => (
                    <Button variant="ghost"
                      className="workspace-row"
                      key={e}
                      onClick={() => setDetail(e)}
                    >
                      <MessageCircle size={17} />
                      {e}
                      <ChevronRight size={15} />
                    </Button>
                  ))}
                </Box>
              )}
              {active === "Clients" && (
                <Box className="workspace-section">
                  <Text className="preview-description">
                    The people at the heart of your practice.
                  </Text>
                  {["Alex Morgan", "Jamie Ellis", "Sam Taylor"].map(
                    (name, i) => (
                      <Button variant="ghost"
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
                      </Button>
                    ),
                  )}
                </Box>
              )}
              {active === "Messages" && (
                <Box className="workspace-section">
                  <Text className="preview-description">
                    Your conversations, easy to find.
                  </Text>
                  {[
                    "A question before my first session",
                    "Thank you for today",
                    "Moving next week’s appointment",
                  ].map((e) => (
                    <Button variant="ghost"
                      className="workspace-row"
                      key={e}
                      onClick={() => setDetail(e)}
                    >
                      <Mail size={17} />
                      {e}
                      <ChevronRight size={15} />
                    </Button>
                  ))}
                </Box>
              )}
              {active === "Settings" && (
                <Box className="workspace-section">
                  <Text className="preview-description">
                    Made to fit the way you work.
                  </Text>
                  {[
                    "Practice details",
                    "Services and prices",
                    "Booking availability",
                  ].map((e) => (
                    <Button variant="ghost"
                      className="workspace-row"
                      key={e}
                      onClick={() => setDetail(e)}
                    >
                      <Settings size={16} />
                      {e}
                      <ChevronRight size={15} />
                    </Button>
                  ))}
                </Box>
              )}
            </>
          )}
        </Box>
      </Box>
      <Text className="preview-caption">
        <span /> A glimpse of your practice, organised.{" "}
        <a className="try-preview" href="/app">
          Explore the workspace <ArrowRight size={16} />
        </a>
      </Text>
    </Box>
  );
}
