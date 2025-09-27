import { redirect } from 'next/navigation';

export default function RootPage() {
  // Cette page a pour seul rôle de rediriger l'utilisateur vers le tableau de bord.
  // La vérification de l'authentification (et la redirection vers /login si nécessaire)
  // est gérée par le layout du tableau de bord.
  redirect('/dashboard');

  // Ce composant ne rendra jamais rien.
  return null;
}
