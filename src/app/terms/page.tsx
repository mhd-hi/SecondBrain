import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service | SecondBrain ETS',
  description: 'Terms of Service for SecondBrain ETS.',
};

const sections: { title: string; body: string[] }[] = [
  {
    title: '1. Acceptance of Terms',
    body: [
      'By accessing or using SecondBrain ETS ("the Service"), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service.',
    ],
  },
  {
    title: '2. Description of the Service',
    body: [
      'SecondBrain ETS is an AI-powered course management assistant. It parses course plans and breaks them down into tasks, calendars, and progress-tracking views to help students stay organized.',
    ],
  },
  {
    title: '3. Accounts',
    body: [
      'You must sign in using a supported authentication provider to use the Service. You are responsible for maintaining the confidentiality of your account and for all activity that occurs under it.',
      'You must provide accurate information and use only your own accounts.',
    ],
  },
  {
    title: '4. Acceptable Use',
    body: [
      'You agree not to:',
      'Use the Service for any unlawful purpose.',
      'Attempt to access, scrape, or disrupt the Service, its infrastructure, or other users\' data.',
      'Upload content you do not have the right to use, including course plans you are not authorized to process.',
      'Reverse engineer, resell, or commercialize the Service without permission.',
    ],
  },
  {
    title: '5. AI-Generated Content',
    body: [
      'The Service uses AI to generate tasks and suggestions from your course plans. AI output may be incomplete, inaccurate, or out of date. It is provided for convenience only and is not official academic advice. Always verify deadlines and requirements against your official course plan.',
    ],
  },
  {
    title: '6. Intellectual Property',
    body: [
      'The Service, including its design, code, and branding, is owned by its developers and protected by applicable law. You retain ownership of the content you submit. Course plans and other institutional materials remain the property of their respective owners.',
    ],
  },
  {
    title: '7. Availability and Changes',
    body: [
      'The Service is provided as-is and may be modified, interrupted, or discontinued at any time without notice. We do not guarantee uninterrupted or error-free operation.',
    ],
  },
  {
    title: '8. Limitation of Liability',
    body: [
      'To the maximum extent permitted by law, the developers of SecondBrain ETS shall not be liable for any indirect, incidental, or consequential damages, including missed deadlines, academic consequences, or data loss, arising from your use of the Service.',
    ],
  },
  {
    title: '9. Termination',
    body: [
      'We may suspend or terminate your access to the Service at any time, including for violation of these Terms. You may stop using the Service at any time.',
    ],
  },
  {
    title: '10. Changes to These Terms',
    body: [
      'We may update these Terms from time to time. Continued use of the Service after changes are posted constitutes acceptance of the updated Terms.',
    ],
  },
  {
    title: '11. Contact',
    body: [
      'Questions about these Terms can be raised via the project repository: https://github.com/mhd-hi/SecondBrain',
    ],
  },
];

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight">Terms of Service</h1>
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
