/* ============================================================
   Project data. Edit this file to change the work section.

   title    : project name (card caption and panel heading)
   pitch    : one-line summary under the card
   year     : shown on the right of the caption
   category : comma-separated, each part becomes a pill on the card
   poster   : 4:3 thumbnail image (path relative to index.html)
   art      : optional HTML used instead of a poster (see SHERWAY_ART)
   video    : optional mp4, plays when the card is opened
   problem  : Problem definition row
   kpi      : exactly three { v: value, l: label }
   tldr     : TL;DR row
   href     : case study page ("View case study")
   ============================================================ */

const BASE = 'https://michaeljpark.github.io/portfolio2026/';

/* CF Sherway: CF monogram on Cadillac Fairview blue, with the project title. */
const SHERWAY_ART =
  '<div class="art" style="background:#006197">' +
  '<img class="art-mark" src="assets/images/cf-mark-white.svg" alt="">' +
  '<span class="art-title">The New Roots</span>' +
  '</div>';

const PROJECTS = [
  {
    title: "Clink", pitch: "Dynamic workspace for small teams", year: "2026",
    category: "Full-stack web app, incubating",
    video: "assets/video/clink.mp4", poster: "assets/images/clink.webp",
    problem: "A small team's context is scattered across its tools, and information that can't be reached when it's needed is effectively lost.",
    kpi: [{ v: "3", l: "Team members" }, { v: "4", l: "Roles, from UX to full-stack" }, { v: "20+", l: "Active users, closed beta" }],
    tldr: "An infinite canvas of typed blocks, comment threads, and document review that keeps a small team's reasoning next to its work.",
    href: BASE + "clink-afterwork.html"
  },
  {
    title: "OnGen Radio", pitch: "Personalized, curated radio experience driven by AI", year: "2026",
    category: "Thesis project, AI radio",
    video: "assets/video/ongen-radio.mp4", poster: "assets/images/ongen-radio.webp",
    problem: "What shapes a person's day is spread across many apps and feeds, and radio, the one medium that works hands-free, still plays the same broadcast to everyone.",
    kpi: [{ v: "147", l: "Field pilot users, 408 sessions" }, { v: "35.6s", l: "Median interaction time" }, { v: "73", l: "SUS score, Pilot 1 (n=17)" }],
    tldr: "A personalized AI radio that turns a person's calendar, reminders, traffic, and local news into short briefings scheduled through the day, mixed in with their own music.",
    href: "ongenoverview.html"
  },
  {
    title: "TokenTrust", pitch: "AI transparency and user data governance", year: "2026",
    category: "Service design, team lead",
    video: "assets/video/tokentrust.mp4", poster: "assets/images/tokentrust.webp",
    problem: "People have no way to see what their data is worth, where it goes, or who profits from it, and no law requires that its value be returned to them.",
    kpi: [{ v: "81%", l: "Saw a pricing problem in AI (n=28)" }, { v: "86%", l: "Idea acceptance, ICE scoring" }, { v: "6", l: "Audit axes across 3 AI services" }],
    tldr: "A governance platform that scores the quality of user-contributed AI data, pays users tokens for it, and lets that value move across platforms.",
    href: BASE + "tokentrust.html"
  },
  {
    title: "CF Sherway Gardens: The New Roots", pitch: "A public realm for newcomers", year: "2024",
    category: "Client project, Cadillac Fairview",
    video: "", poster: "", art: SHERWAY_ART,
    problem: "Sherway Gardens works for shopping but not for visiting. Its car-first layout gives people no reason to come without a purchase in mind.",
    kpi: [{ v: "7", l: "On-site interviews" }, { v: "13", l: "Mentions of cultural welcome" }, { v: "10", l: "Mentions of shopping in person" }],
    tldr: "Sherway Stamp, a poster-triggered audio story system where visitors collect stamps across the mall, events, and retail, giving them a reason to return.",
    href: BASE + "cf-sherway.html"
  }
];
