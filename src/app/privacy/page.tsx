import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy | SecondBrain ETS',
  description: 'Privacy Policy for SecondBrain ETS.',
};

const sections: { title: string; body: string[] }[] = [
  {
    title: '1. Overview',
    body: [
      'This Privacy Policy explains what data SecondBrain ETS ("the Service") collects, how it is used, and the choices you have. By using the Service, you agree to this policy.',
    ],
  },
  {
    title: '2. Data We Collect',
    body: [
      'Account data: your name, email address, and profile identifier from the authentication provider you use to sign in.',
      'Course data: course plans you upload or select, and the tasks, schedules, and preferences you create in the Service.',
      'Usage and diagnostic data: error reports and logs (including via Sentry) used to detect and fix problems.',
    ],
  },
  {
    title: '3. How We Use Data',
    body: [
      'To provide the Service: authenticate you, parse your course plans, generate and display tasks, and sync your dashboard.',
      'To maintain the Service: monitor errors and performance, and prevent abuse.',
      'We do not sell your data, and we do not use it for advertising.',
    ],
  },
  {
    title: '4. AI Processing',
    body: [
      'Course plans you submit are processed by AI services to generate tasks and schedules. This content is used only to provide the Service\'s features to you. Always verify AI-generated output against your official course plan.',
    ],
  },
  {
    title: '5. Data Sharing',
    body: [
      'We share data only with the providers necessary to operate the Service:',
      'Authentication provider (to sign you in).',
      'Database and hosting providers (to store and serve your data).',
      'AI service providers (to process course plans).',
      'Error-tracking provider (Sentry) for diagnostics.',
      'We may disclose data if required by law.',
    ],
  },
  {
    title: '6. Data Retention and Deletion',
    body: [
      'Your data is retained while your account is active. If you stop using the Service or request deletion, we will delete your course data and account information, except where retention is required by law.',
    ],
  },
  {
    title: '7. Security',
    body: [
      'We use industry-standard measures such as encrypted transport (HTTPS), access controls, and scoped database access. No method of storage or transmission is completely secure, and we cannot guarantee absolute security.',
    ],
  },
  {
    title: '8. Your Rights',
    body: [
      'Depending on your jurisdiction, you may have rights to access, correct, export, or delete your personal data. To exercise these rights, contact us via the project repository: https://github.com/mhd-hi/SecondBrain',
    ],
  },
  {
    title: '9. Children',
    body: [
      'The Service is intended for university students and is not directed at children under 13. We do not knowingly collect data from children under 13.',
    ],
  },
  {
    title: '10. Changes to This Policy',
    body: [
      'We may update this policy from time to time. Changes are posted on this page with an updated "Last updated" date.',
    ],
  },
];

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Last updated: September 6, 2026
      </p>
      <div className="mt-8 space-y-8">
        {sections.map((section) => (
          <section key={section.title}>
            <h2 className="text-lg font-semibold">{section.title}</h2>
            <div className="mt-2 space-y-2 text-sm leading-relaxed text-muted-foreground">
              {section.body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
