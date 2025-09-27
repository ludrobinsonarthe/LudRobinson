import { redirect } from 'next/navigation';

export default function RootPage() {
  // Cette page a pour seul rôle de rediriger l'utilisateur vers la page de connexion.
  // La vérification de l'authentification et la redirection vers le tableau de bord
  // sont gérées par les pages /dashboard et /login.
  redirect('/login');

  // Ce composant ne rendra jamais rien.
  return null;
}
