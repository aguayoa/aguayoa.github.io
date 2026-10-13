// Sample content shown to visitors who haven't signed in (their edits stay in their own browser).
// Signed-in users' real data lives in Supabase.

window.STATUS_LABELS = {
  active: "Active",
  planning: "Planning",
  talks: "In talks",
  paused: "Paused",
  done: "Done",
};

window.SAMPLE_PROJECTS = [
  {
    name: "Sample: Launch a side project",
    tagline: "Try editing me: change the name, check off a step, add your own.",
    category: "Sample",
    status: "planning",
    icon: "🚀",
    link: "",
    overview:
      "This is a sample project so you can see how Aware Life works. Click any field to edit it. Sign in with your email to create your own projects and keep them private and synced.",
    focus: ["Pick the idea", "Set a first milestone", "Tell one person about it"],
    tasks: [
      { text: "Write the idea in one sentence", done: true },
      { text: "List three first steps", done: false },
      { text: "Do the first step", done: false },
    ],
  },
];

// Sample reminders and events, dated relative to today
const sampleDay = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
window.SAMPLE_REMINDERS = [
  { title: "Welcome to Aware Life 👋", due_date: sampleDay(0), due_time: "09:00", color: "#0a84ff", done: false },
  { title: "Try adding your own reminder", due_date: sampleDay(2), due_time: null, color: "#34c759", done: false },
  { title: "Review the week", due_date: sampleDay(5), due_time: "17:30", color: "#ff9f0a", done: false },
];
window.SAMPLE_EVENTS = [
  { title: "Sample trip ✈️", start_date: sampleDay(9), end_date: sampleDay(13), color: "#6b46c1", note: "" },
  { title: "Launch day", start_date: sampleDay(3), end_date: sampleDay(3), color: "#1f8a4c", note: "" },
];

window.SAMPLE_SKILLS = [
  { name: "Data analytics with Python", area: "learn", status: "current", progress: 35, note: "Finish the pandas module this week" },
  { name: "Run a half marathon", area: "fitness", status: "aspire", progress: 0, note: "" },
  { name: "Speak Spanish conversationally", area: "learn", status: "aspire", progress: 0, note: "" },
  { name: "Public speaking", area: "mind", status: "aspire", progress: 0, note: "" },
  { name: "Meditate 20 minutes a day", area: "mind", status: "aspire", progress: 0, note: "" },
];

window.SAMPLE_TODOS = [
  { text: "Open the tool bag in the Time Chamber", done: false },
  { text: "Write a summary for today", done: false },
  { text: "Sign in to save your own", done: false },
];
