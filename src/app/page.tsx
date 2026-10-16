import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Bricolage_Grotesque, Geist_Mono } from 'next/font/google';
import { BookOpen, CalendarDays, LayoutGrid, ListChecks, Sparkles, Timer } from 'lucide-react';
import { ROUTES } from '@/lib/page-routes';
import { auth } from '@/server/auth';
import '@/styles/landing.css';

const display = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--landing-display',
});

const mono = Geist_Mono({
  subsets: ['latin'],
  variable: '--landing-mono',
});

export const metadata: Metadata = {
  title: 'SecondBrain ETS: Your semester, sorted before week one',
  description:
    'SecondBrain reads your course plans with AI and turns every evaluation and deadline into tasks, a calendar, and a study timer. Sign in with Google or Discord.',
};

const planItems = [
  { name: 'Examen intra', meta: 'S07 · 30 %' },
  { name: 'TP2 remise', meta: 'S10 · 25 %' },
  { name: 'Examen final', meta: 'S15 · 40 %' },
];

const tasks = [
  { name: 'Study plan, Examen intra', due: 'W6', done: true },
  { name: 'TP2 milestone 1', due: 'W8', done: false },
  { name: 'Final exam review', due: 'W13', done: false },
];

const steps = [
  {
    label: 'Week 0',
    title: 'Add your course',
    body: 'Course code, term, first day of class. Thirty seconds each.',
  },
  {
    label: 'Week 0',
    title: 'Drop in the plan de cours',
    body: 'Upload the PDF your prof posted. SecondBrain reads it with AI and pulls out evaluations, weights, and weeks.',
  },
  {
    label: 'All term',
    title: 'Get your semester back',
    body: 'Tasks land on your board and calendar with dates already worked out, so exam weeks never take you by surprise.',
  },
];

const features = [
  {
    icon: ListChecks,
    title: 'Done vs. to do',
    body: 'See what you have left and what you have already finished, per course or for the whole term. Nothing piles up unseen.',
  },
  {
    icon: LayoutGrid,
    title: 'Task board',
    body: 'Kanban columns for to do, in progress, and done, with subtasks and drag-and-drop.',
  },
  {
    icon: CalendarDays,
    title: 'Semester calendar',
    body: 'Every course deadline on one grid. Switch between month and week views.',
  },
  {
    icon: Timer,
    title: 'Pomodoro timer',
    body: 'Focus sessions that log themselves, with history you can actually read.',
  },
  {
    icon: Sparkles,
    title: 'AI assistant',
    body: 'Too lazy to fill out forms? Tell it what\'s coming and it adds the tasks for you. It speaks MCP too, so Claude or ChatGPT can manage your board with an API key.',
  },
  {
    icon: BookOpen,
    title: 'Course pages',
    body: 'One home per course with its tasks, links, and deadlines in the same spot.',
  },
];

const GITHUB_URL = 'https://github.com/mhd-hi/SecondBrain';

export default async function LandingPage() {
  const session = await auth();
  const signedIn = Boolean(session?.user?.id);

  return (
    <div className={`landing ${display.variable} ${mono.variable}`}>
      <header className="landing-topbar">
        <div className="landing-container landing-topbar-inner">
          <Link href={ROUTES.LANDING} className="landing-brand">
            <Image
              src="/assets/pochita-bread.png"
              alt=""
              width={30}
              height={30}
              loading="eager"
              unoptimized
              className="object-contain shrink-0"
            />
            SecondBrain ETS
          </Link>
          <Link
            href={signedIn ? ROUTES.DASHBOARD : ROUTES.SIGNIN}
            className="landing-btn landing-btn-ghost landing-btn-sm"
          >
            {signedIn ? 'Open app' : 'Sign in'}
          </Link>
        </div>
      </header>

      <main>
        <section className="landing-hero">
          <div className="landing-container landing-hero-inner">
            <div>
              <h1 className="landing-h1 landing-anim">
                Your semester, <span className="landing-hl">sorted</span>{' '}
                before week one.
              </h1>
              <p className="landing-hero-sub landing-anim landing-delay-2">
                Upload a course plan and SecondBrain reads every deadline and
                evaluation with AI, so you always know what&apos;s done, what&apos;s
                due, and what to study next. No more cramming the night before.
              </p>
              <div className="landing-hero-actions landing-anim landing-delay-3">
                <Link
                  href={signedIn ? ROUTES.DASHBOARD : ROUTES.SIGNIN}
                  className="landing-btn landing-btn-primary"
                >
                  {signedIn ? 'Open your dashboard' : 'Get started'}
                </Link>
                <a href="#features" className="landing-btn landing-btn-ghost">
                  See what you get
                </a>
              </div>
            </div>

            <div className="landing-artifact" aria-hidden="true">
              <div className="landing-plan-card landing-anim landing-delay-2">
                <div className="landing-plan-head">
                  <span className="landing-plan-title">PLAN DE COURS</span>
                  <span className="landing-course-badge">LOG121 · A2026</span>
                </div>
                {planItems.map((item) => (
                  <div key={item.name} className="landing-plan-row">
                    <span className="landing-plan-name">{item.name}</span>
                    <span className="landing-plan-meta">{item.meta}</span>
                  </div>
                ))}
                <div className="landing-plan-more">+ 14 more items found</div>
              </div>

              <div className="landing-connector landing-anim landing-delay-4">
                <span className="landing-connector-badge">
                  <Image
                    src="/assets/pochita-bread.png"
                    alt=""
                    width={26}
                    height={26}
                    loading="eager"
                    unoptimized
                    className="object-contain"
                  />
                </span>
              </div>

              <div className="landing-task-card landing-anim landing-delay-5">
                <div className="landing-task-label">EXTRACTED TASKS</div>
                {tasks.map((task) => (
                  <div
                    key={task.name}
                    className={`landing-task-row${task.done ? ' is-done' : ''}`}
                  >
                    <span className="landing-task-check">
                      {task.done && (
                        <svg viewBox="0 0 20 20">
                          <polyline points="5 10.5 9 14.5 15 6.5" />
                        </svg>
                      )}
                    </span>
                    <span className="landing-task-name">{task.name}</span>
                    <span className="landing-task-due">{task.due}</span>
                  </div>
                ))}
                <div className="landing-task-foot">
                  Synced to Board · Calendar · Pomodoro
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="landing-section">
          <div className="landing-container">
            <div className="landing-section-head">
              <h2 className="landing-h2">
                From PDF to plan in three steps.
              </h2>
            </div>
            <div className="landing-steps">
              {steps.map((step) => (
                <div key={step.title} className="landing-step">
                  <p className="landing-step-label">{step.label}</p>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="features" className="landing-section">
          <div className="landing-container">
            <div className="landing-section-head">
              <h2 className="landing-h2">
                Everything a term needs, in one place.
              </h2>
            </div>
            <div className="landing-features">
              {features.map((feature) => (
                <div key={feature.title} className="landing-feature">
                  <div className="landing-feature-icon">
                    <feature.icon aria-hidden="true" />
                  </div>
                  <h3>{feature.title}</h3>
                  <p>{feature.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-section landing-cta">
          <div className="landing-container">
            <h2 className="landing-h2">Finals week is closer than it looks.</h2>
            <p>
              Spread the work out now and future you walks into every exam
              already prepared.
            </p>
            <Link
              href={signedIn ? ROUTES.DASHBOARD : ROUTES.SIGNIN}
              className="landing-btn landing-btn-primary"
            >
              {signedIn ? 'Open your dashboard' : 'Add your first course'}
            </Link>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-container landing-footer-inner">
          <p className="landing-footer-copy">
            © 2026 SecondBrain ETS. Not affiliated with the ÉTS.
          </p>
          <nav className="landing-footer-links" aria-label="Legal and project links">
            <Link href={ROUTES.TERMS}>Terms of Service</Link>
            <Link href={ROUTES.PRIVACY}>Privacy Policy</Link>
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
              GitHub
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
