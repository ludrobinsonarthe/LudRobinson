"use client";
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
// This is a placeholder for a potential dedicated report page.
// For now, the report is a modal inside the attendance page.

function AttendanceReportContent() {
    return (
        <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">La prévisualisation des rapports se fait désormais via une modale sur la page de présence.</p>
        </div>
    )
}

export default function AttendanceReportPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-48"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
      <AttendanceReportContent />
    </Suspense>
  );
}
