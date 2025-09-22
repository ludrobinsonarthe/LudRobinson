import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import 'react-image-crop/dist/ReactCrop.css';
import { AuthProvider } from '@/hooks/use-auth';
import { ThemeProvider } from '@/components/theme-provider';
import { PT_Sans, Space_Grotesk } from 'next/font/google'

const ptSans = PT_Sans({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-body',
})

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-headline',
})


export const metadata: Metadata = {
  title: 'ISGI - Institut Supérieur de Gestion et d\'Ingénierie',
  description: 'Plateforme de communication pour l\'Institut Supérieur de Gestion et d\'Ingénierie (ISGI)',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={`${ptSans.variable} ${spaceGrotesk.variable} font-body antialiased`}>
        <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem
          >
          <AuthProvider>
              {children}
              <Toaster />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

    