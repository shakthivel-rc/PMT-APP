/*
 * The reports chunk: every reports screen, loaded together on the first visit to any of
 * them (App.tsx lazy-loads this module once per screen, which Vite bundles as one chunk).
 */
export { default as ReportsHome } from './components/ReportsHome';
export { default as ReportPage } from './components/ReportPage';
export { ReportJobPage, SavedReportRoute } from './components/ReportRoutes';
