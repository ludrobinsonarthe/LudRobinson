import { redirect } from 'next/navigation';

export default function RootPage() {
  // This is a server component, so we can directly redirect.
  // The actual authentication check happens in the layout or middleware.
  // This page simply acts as an entry point to guide the user.
  redirect('/login');
}
