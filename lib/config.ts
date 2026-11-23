// Shared by the server (validation) and the client (UI). No secrets here.
export const MAX_INPUT_CHARS = 4000;
export const MAX_CONTEXT_MESSAGES = 10;          // how much history is sent to the model each turn
export const MAX_MESSAGES_PER_CONVERSATION = 40; // keeps one chat from growing without limit

export const SUGGESTIONS = [
  { title: "Polish an email", prompt: "Rewrite this email so it sounds professional but friendly:\n\n" },
  { title: "Summarize text", prompt: "Summarize the following in five short bullet points:\n\n" },
  { title: "Draft a reply", prompt: "Draft a polite reply to this message:\n\n" },
  { title: "Brainstorm ideas", prompt: "Give me 10 creative name ideas for a small business that sells " },
];

// Your credit. Fill this in, then put your photo at public/developer.jpg (square works best).
// Leave a link empty ("") to hide it.
export const DEVELOPER = {
  name: "R Subash Chandra Bose",
  role: "Full-stack developer", 
  photo: "https://avatars.githubusercontent.com/u/143197207?v=4",
  bio: "I design and build fast, reliable web apps and AI features with Next.js, Tailwind, Prisma and Postgres. This demo was built by me.",
  email: "subashchandraboseravi45@gmail.com",
  whatsapp: "+917845442450", // digits only, with country code
  github: "https://github.com/Bgmi10",
};