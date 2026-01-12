import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Status',
  description: 'Live status dashboard for AI provider APIs.',
  alternates: {
    canonical: '/status',
  },
};

export const dynamic = 'force-dynamic';

export { default } from '../page';
