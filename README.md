# Research Paper Generator

An AI-powered web platform that automates the generation of academic research papers in IEEE and APA formats. Built for engineering students and early researchers who need structured, publication-ready drafts without deep LaTeX knowledge.

---

## Features

- **AI-Powered Generation** — Generates full research paper content and LaTeX source code using large language models
- **IEEE & APA Formatting** — Strict formatting compliance with IEEEtran document class and natbib-based APA style
- **LaTeX Editor** — Built-in syntax-highlighted editor (Prism.js) for reviewing and editing generated LaTeX
- **PDF Compilation** — Compiles LaTeX to PDF via `pdflatex` through a serverless edge function
- **Paper History** — All generated papers are saved per user in a PostgreSQL database
- **Authentication** — Secure email/password auth with JWT and Row-Level Security

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui |
| Backend | Supabase (Auth, PostgreSQL, Edge Functions) |
| AI Service | LLM via Edge Function (Deno runtime) |
| PDF Compilation | pdflatex via serverless Edge Function |
| Routing | React Router DOM v6 |
| Validation | Zod |

---

## System Architecture

The platform follows a three-tier serverless architecture:

1. **Client Tier** — React SPA handles UI, routing, and form state
2. **Service Tier** — Supabase Edge Functions handle LLM calls and LaTeX compilation
3. **Persistence Tier** — PostgreSQL stores user profiles and generated papers

---

## Getting Started

### Prerequisites

- Node.js v18+
- Supabase account
- LLM API key (configured in Edge Function environment)

### Installation

```bash
git clone https://github.com/your-username/research-paper-generator.git
cd research-paper-generator
npm install
```

### Environment Variables

Create a `.env` file in the root:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Configure LLM API key in your Supabase Edge Function secrets.

### Run Locally

```bash
npm run dev
```

---

## Usage

1. Sign up or log in
2. Fill in the paper configuration form — title, authors, keywords, format (IEEE/APA), and page count
3. Click **Generate** — the system calls the LLM and returns paper content + LaTeX source
4. Review and edit the LaTeX in the built-in editor
5. Compile to PDF or download the `.tex` file

---

## Performance (30-run evaluation)

| Metric | Result |
|--------|--------|
| Avg. LLM Generation Time | 18.4 seconds |
| Avg. PDF Compilation Time | 6.8 seconds |
| First-Attempt LaTeX Success Rate | 76.7% |
| IEEE Formatting Accuracy | 83.3% |
| APA Formatting Accuracy | 76.7% |
| Auth & DB Success Rate | 100% |

---

## Limitations

- LaTeX compilation environment has limited package support (no TikZ external libs)
- Generated outputs are draft-quality — human review required before submission
- Tested primarily on general engineering topics
- No plagiarism detection or citation validation (planned for future)

---

## Roadmap

- [ ] LaTeX error feedback loop for automatic correction
- [ ] Citation integration (CrossRef / Semantic Scholar)
- [ ] Multi-format export via Pandoc
- [ ] Plagiarism detection
- [ ] Collaborative editing with version control
- [ ] Conversational refinement interface

---

## Authors

- **Deepesh Singh** — System architecture, backend, Supabase integration, prompt engineering
- **Shiv Sagar Giri** — Frontend interface and routing
- **Akshay Singh** — LaTeX editor and PDF compilation workflow
- **Ram Kailash Gupta** — Supervision and domain expertise

Bansal Institute of Engineering and Technology, Lucknow

---

## License

This project is for academic purposes. Contact the corresponding author for source code access.
