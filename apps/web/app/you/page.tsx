import { redirect } from 'next/navigation';

export default function LegacyYouPage() {
  redirect('/account');
}
