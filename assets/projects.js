// ─────────────────────────────────────────────────────────────
// Edit this file to update the site. Every project page is built
// from the entries below — add a new object to add a new project.
//
// status: "active" | "planning" | "talks" | "paused" | "done"
// tasks:  { text, done }  — done: true shows a checked box
// ─────────────────────────────────────────────────────────────

window.PROJECTS = [
  {
    id: "ai-data-analytics",
    name: "AI Data Analytics",
    tagline: "Coursework and portfolio in AI-driven data analytics.",
    category: "Education",
    status: "active",
    icon: "📊",
    link: null,
    overview:
      "Currently enrolled in AI Data Analytics classes. This page tracks coursework, skills learned, and portfolio projects that come out of the program.",
    focus: [
      "Complete current course modules",
      "Build portfolio projects from class work",
      "Apply analytics skills to my other ventures",
    ],
    tasks: [
      { text: "Enroll in AI Data Analytics classes", done: true },
      { text: "Finish current module", done: false },
      { text: "Publish first portfolio project to GitHub", done: false },
      { text: "Use analytics on Javlin Concepts sales data", done: false },
    ],
  },
  {
    id: "javlin-concepts",
    name: "Javlin Concepts",
    tagline: "Partner venture pursuing government contracts and sales.",
    category: "Business · Partnership",
    status: "active",
    icon: "🏛️",
    link: "https://javlinconcepts.com",
    overview:
      "A project with my friend at javlinconcepts.com. Current focus is finding and bidding on government contracts and landing the first sales.",
    focus: [
      "Find government contract opportunities",
      "Prepare bid materials",
      "Close first sales",
    ],
    tasks: [
      { text: "Launch javlinconcepts.com", done: true },
      { text: "Register in SAM.gov (get UEI)", done: false },
      { text: "Identify NAICS codes for our services", done: false },
      { text: "Write a capability statement", done: false },
      { text: "Set up saved searches for contract opportunities", done: false },
      { text: "Submit first bid", done: false },
      { text: "Land first sale", done: false },
    ],
  },
  {
    id: "aware",
    name: "Aware",
    tagline: "Media company and apparel brand, starting with shirts.",
    category: "Brand · Media · Apparel",
    status: "planning",
    icon: "👕",
    link: null,
    overview:
      "Aware is a media company launching with a line of shirts. Before selling, the brand needs a trademark and a dedicated business account so all proceeds and revenue are kept separate.",
    focus: [
      "Secure the Aware trademark",
      "Open a business bank account for proceeds",
      "Design and produce the first shirts",
    ],
    tasks: [
      { text: "Search existing trademarks for \"Aware\"", done: false },
      { text: "File trademark application", done: false },
      { text: "Form business entity and get an EIN", done: false },
      { text: "Open business bank account", done: false },
      { text: "Finalize first shirt designs", done: false },
      { text: "Pick a print / production vendor", done: false },
      { text: "Plan media content and channels", done: false },
    ],
  },
  {
    id: "fridge-cig",
    name: "Fridge Cig",
    tagline: "Early-stage concept, currently in talks.",
    category: "Concept",
    status: "talks",
    icon: "🧊",
    link: null,
    overview:
      "Fridge Cig is very early. The idea is still being discussed, and this page will grow as the concept takes shape.",
    focus: [
      "Define the concept",
      "Decide who's involved and their roles",
      "Decide whether to move forward",
    ],
    tasks: [
      { text: "Write a one-paragraph description of the idea", done: false },
      { text: "Agree on partners and roles", done: false },
      { text: "Go / no-go decision", done: false },
    ],
  },
];

window.STATUS_LABELS = {
  active: "Active",
  planning: "Planning",
  talks: "In talks",
  paused: "Paused",
  done: "Done",
};
